import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { RolService } from '../../../services/rol.service';
import { PermisosService } from '../../../services/permisos.service';
import { UsuarioSucursalService, SucursalConAsignacion } from '../../../services/usuario-sucursal.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { Permiso } from '../../../interfaces/permisos-interface';

declare var iziToast: any;
declare var bootstrap: any;

interface Colaborador {
  idUsuario: string;
  nombres: string;
  apellidos: string;
  email: string;
  estado: boolean;
  idRol: string;
  rol: string; // nombre del rol (viene del backend como R.descripcion as rol)
  descripcion?: string; // alias legacy si la API lo envía
  fRegistro: string;
  ultimoLogin: string;
}

interface Rol {
  idRol: string;
  descripcion: string;
  estado: boolean;
  fCreacion: string;
}

interface SesionUsuario {
  idSesion: string;
  idUsuario: string;
  token: string;
  fechaInicio: string;
  fechaExpiracion: string;
  ipAddress: string;
  userAgent: string;
  activo: boolean;
}

@Component({
  selector: 'app-index-colaborador',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule, TopnavComponent, SidebarComponent, NgbPagination],
  templateUrl: './index-colaborador.component.html',
  styleUrl: './index-colaborador.component.css'
})
export class IndexColaboradorComponent implements OnInit {

  Math: any = Math;

  // Colaboradores
  colaboradores: Colaborador[] = [];
  colaboradores_const: Colaborador[] = [];
  filtro = '';
  load_estado = false;

  // Paginación
  page = 1;
  pageSize = 10;
  maxSize = 5;
  rotate = true;
  boundaryLinks = true;

  // Roles
  roles: Rol[] = [];
  loadingRoles = signal<boolean>(false);
  nuevoRol = { descripcion: '' };
  guardandoRol = signal<boolean>(false);
  rolEditando: { idRol?: any; descripcion?: string } | null = null;

  // Permisos
  permisos: Permiso[] = [];
  loadingPermisos = signal<boolean>(false);
  permisosPorModulo: { [modulo: string]: Permiso[] } = {};

  // Rol-Permisos
  rolSeleccionado: Rol | null = null;
  permisosRol: string[] = []; // IDs de permisos asignados al rol
  loadingPermisosRol = signal<boolean>(false);
  guardandoPermisosRol = signal<boolean>(false);

  // Sesiones
  sesionesUsuario: SesionUsuario[] = [];
  usuarioSesiones: Colaborador | null = null;
  loadingSesiones = signal<boolean>(false);

  // Tabs del modal
  activeTab = signal<string>('roles');

  // Sucursales de usuario
  usuarioSucursales: Colaborador | null = null;
  sucursalesConAsignacion: SucursalConAsignacion[] = [];
  loadingSucursales = signal<boolean>(false);
  guardandoSucursales = signal<boolean>(false);

  constructor(
    private adminService: AdminService,
    private rolService: RolService,
    private permisosService: PermisosService,
    private usuarioSucursalService: UsuarioSucursalService,
    private router: Router,
    public sidebarState: SidebarStateService,
  ) {}

  ngOnInit(): void {
    this.permisosService.cargarPermisosUsuario().subscribe({ error: () => {} });
    this.cargarColaboradores();
  }

  /** SaaS con límites: false si el plan ya no admite más colaboradores. */
  puedeNuevoColaborador(): boolean {
    const lp = this.permisosService.limitesPlan();
    if (!lp) {
      return true;
    }
    return lp.puedeCrearUsuario !== false;
  }

  // =============================================
  // COLABORADORES
  // =============================================

  cargarColaboradores(): void {
    this.adminService.getAdmin().subscribe({
      next: (response) => {
        if (response.data) {
                    this.colaboradores = response.data;
          this.colaboradores_const = response.data;
        } else {
          iziToast.show({
            title: 'Error',
            titleColor: '#dc3545',
            message: 'No tiene acceso a colaboradores',
            position: 'topRight'
          });
          this.router.navigate(['/']);
        }
      },
      error: (error) => {
        console.error('Error:', error);
      }
    });
  }

  filtrar(): void {
    if (this.filtro) {
      const term = new RegExp(this.filtro, 'i');
      this.colaboradores = this.colaboradores_const.filter(
        item => term.test(item.nombres) || term.test(item.apellidos) || term.test(item.email)
      );
    } else {
      this.colaboradores = this.colaboradores_const;
    }
    this.page = 1;
  }

  cambiarEstado(id: string, estadoActual: boolean): void {
    this.load_estado = true;
    this.adminService.cambiar_estado_colaborador_admin(id, { estado: estadoActual }).subscribe({
      next: () => {
        const modalElement = document.getElementById('delete-' + id);
        if (modalElement) {
          const modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
          modalInstance.hide();
        }
        this.load_estado = false;
        this.cargarColaboradores();
        
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: 'Estado cambiado correctamente',
          position: 'topRight'
        });
      },
      error: () => {
        this.load_estado = false;
      }
    });
  }

  onPageChange(newPage: number): void {
    this.page = newPage;
  }

  // =============================================
  // MODAL DE GESTIÓN
  // =============================================

  abrirModalGestion(): void {
    this.cargarRoles();
    this.activeTab.set('roles');
    const modal = new bootstrap.Modal(document.getElementById('modalGestion'));
    modal.show();
  }

  cambiarTab(tab: string): void {
    this.activeTab.set(tab);
    if (tab === 'roles') {
      this.cargarRoles();
    } else if (tab === 'permisos') {
      this.cargarPermisos();
    }
  }

  // =============================================
  // ROLES
  // =============================================

  cargarRoles(): void {
    this.loadingRoles.set(true);
    this.rolService.obtenerRoles().subscribe({
      next: (response) => {
        this.roles = response.data || [];
        this.loadingRoles.set(false);
      },
      error: (error) => {
        console.error('Error cargando roles:', error);
        this.loadingRoles.set(false);
      }
    });
  }

  crearRol(): void {
    if (!this.nuevoRol.descripcion.trim()) {
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        message: 'Ingrese un nombre para el rol',
        position: 'topRight'
      });
      return;
    }

    this.guardandoRol.set(true);
    this.rolService.crearRol(this.nuevoRol).subscribe({
      next: (response) => {
        this.guardandoRol.set(false);
        if (response.data) {
          this.nuevoRol.descripcion = '';
          this.cargarRoles();
          iziToast.show({
            title: 'Éxito',
            titleColor: '#28a745',
            message: 'Rol creado correctamente',
            position: 'topRight'
          });
        } else {
          iziToast.show({
            title: 'Error',
            titleColor: '#dc3545',
            message: response.message || 'Error al crear rol',
            position: 'topRight'
          });
        }
      },
      error: () => {
        this.guardandoRol.set(false);
      }
    });
  }

  editarRol(rol: Rol): void {
    this.rolEditando = { ...rol };
  }

  guardarEdicionRol(): void {
    if (!this.rolEditando) return;

    this.guardandoRol.set(true);
    this.rolService.actualizarRol(this.rolEditando.idRol, { descripcion: this.rolEditando.descripcion }).subscribe({
      next: () => {
        this.guardandoRol.set(false);
        this.rolEditando = null;
        this.cargarRoles();
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: 'Rol actualizado correctamente',
          position: 'topRight'
        });
      },
      error: () => {
        this.guardandoRol.set(false);
      }
    });
  }

  cancelarEdicionRol(): void {
    this.rolEditando = null;
  }

  // =============================================
  // PERMISOS
  // =============================================

  cargarPermisos(): void {
    this.loadingPermisos.set(true);
    this.permisosService.obtenerPermisosEmpresa().subscribe({
      next: (response) => {
        this.permisos = response.data || [];
        this.agruparPermisosPorModulo();
        this.loadingPermisos.set(false);
      },
      error: (error) => {
        console.error('Error cargando permisos:', error);
        this.loadingPermisos.set(false);
      }
    });
  }

  private agruparPermisosPorModulo(): void {
    this.permisosPorModulo = {};
    this.permisos.forEach(permiso => {
      if (!this.permisosPorModulo[permiso.modulo]) {
        this.permisosPorModulo[permiso.modulo] = [];
      }
      this.permisosPorModulo[permiso.modulo].push(permiso);
    });
  }

  getModulos(): string[] {
    return Object.keys(this.permisosPorModulo).sort();
  }

  inicializarPermisos(): void {
    this.permisosService.inicializarPermisos().subscribe({
      next: () => {
        this.cargarPermisos();
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: 'Permisos inicializados correctamente',
          position: 'topRight'
        });
      },
      error: (error) => {
        console.error('Error:', error);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al inicializar permisos',
          position: 'topRight'
        });
      }
    });
  }

  // =============================================
  // ROL-PERMISOS
  // =============================================

  abrirModalRolPermisos(rol: Rol): void {
    this.rolSeleccionado = rol;
    this.cargarPermisosRol(rol.idRol);
    
    const modal = new bootstrap.Modal(document.getElementById('modalRolPermisos'));
    modal.show();
  }

  cargarPermisosRol(idRol: string): void {
    this.loadingPermisosRol.set(true);
    this.permisosRol = [];

    // Cargar permisos de la empresa si no están cargados
    if (this.permisos.length === 0) {
      this.permisosService.obtenerPermisosEmpresa().subscribe({
        next: (response) => {
          this.permisos = response.data || [];
          this.agruparPermisosPorModulo();
          this.cargarPermisosDelRol(idRol);
        }
      });
    } else {
      this.cargarPermisosDelRol(idRol);
    }
  }

  private cargarPermisosDelRol(idRol: string): void {
    this.permisosService.obtenerPermisosRol(idRol).subscribe({
      next: (response) => {
        this.permisosRol = (response.data || []).map((p: Permiso) => p.idPermiso);
        this.loadingPermisosRol.set(false);
      },
      error: () => {
        this.loadingPermisosRol.set(false);
      }
    });
  }

  togglePermiso(idPermiso: string): void {
    const index = this.permisosRol.indexOf(idPermiso);
    if (index > -1) {
      this.permisosRol.splice(index, 1);
    } else {
      this.permisosRol.push(idPermiso);
    }
  }

  tienePermiso(idPermiso: string): boolean {
    return this.permisosRol.includes(idPermiso);
  }

  seleccionarTodosModulo(modulo: string): void {
    const permisosModulo = this.permisosPorModulo[modulo] || [];
    permisosModulo.forEach(p => {
      if (!this.permisosRol.includes(p.idPermiso)) {
        this.permisosRol.push(p.idPermiso);
      }
    });
  }

  deseleccionarTodosModulo(modulo: string): void {
    const permisosModulo = this.permisosPorModulo[modulo] || [];
    permisosModulo.forEach(p => {
      const index = this.permisosRol.indexOf(p.idPermiso);
      if (index > -1) {
        this.permisosRol.splice(index, 1);
      }
    });
  }

  guardarPermisosRol(): void {
    if (!this.rolSeleccionado) return;

    this.guardandoPermisosRol.set(true);
    this.permisosService.actualizarPermisosRol(this.rolSeleccionado.idRol, this.permisosRol).subscribe({
      next: () => {
        this.guardandoPermisosRol.set(false);
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalRolPermisos'));
        modal?.hide();

        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: 'Permisos del rol actualizados',
          position: 'topRight'
        });
      },
      error: () => {
        this.guardandoPermisosRol.set(false);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al guardar permisos',
          position: 'topRight'
        });
      }
    });
  }

  // =============================================
  // SESIONES
  // =============================================

  verSesiones(colaborador: Colaborador): void {
    this.usuarioSesiones = colaborador;
    this.sesionesUsuario = [];
    this.loadingSesiones.set(true);
    
    // Aquí se podría implementar un endpoint para obtener sesiones de un usuario
    // Por ahora mostramos datos de ejemplo
    setTimeout(() => {
      this.sesionesUsuario = [
        {
          idSesion: '1',
          idUsuario: colaborador.idUsuario,
          token: '***',
          fechaInicio: new Date().toISOString(),
          fechaExpiracion: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome 120',
          activo: true
        }
      ];
      this.loadingSesiones.set(false);
    }, 500);

    const modal = new bootstrap.Modal(document.getElementById('modalSesiones'));
    modal.show();
  }

  cerrarSesion(sesion: SesionUsuario): void {
    // Implementar cierre de sesión específica
    iziToast.show({
      title: 'Info',
      titleColor: '#17a2b8',
      message: 'Funcionalidad de cierre de sesión individual pendiente de implementar',
      position: 'topRight'
    });
  }

  cerrarTodasSesiones(): void {
    if (!this.usuarioSesiones) return;
    
    // Implementar cierre de todas las sesiones
    iziToast.show({
      title: 'Info',
      titleColor: '#17a2b8',
      message: 'Funcionalidad de cierre de todas las sesiones pendiente',
      position: 'topRight'
    });
  }

  // =============================================
  // SUCURSALES DE USUARIO
  // =============================================

  abrirModalSucursales(colaborador: Colaborador): void {
    this.usuarioSucursales = colaborador;
    this.loadingSucursales.set(true);
    this.sucursalesConAsignacion = [];

    this.usuarioSucursalService.obtenerSucursalesConAsignacion(colaborador.idUsuario).subscribe({
      next: (response) => {
        this.sucursalesConAsignacion = response.data || [];
        this.loadingSucursales.set(false);
      },
      error: (error) => {
        console.error('Error:', error);
        this.loadingSucursales.set(false);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al cargar sucursales',
          position: 'topRight'
        });
      }
    });

    const modal = new bootstrap.Modal(document.getElementById('modalSucursales'));
    modal.show();
  }

  toggleSucursal(sucursal: SucursalConAsignacion): void {
    sucursal.asignado = !sucursal.asignado;
    if (!sucursal.asignado) {
      sucursal.esDefault = false;
    }
  }

  setSucursalDefault(sucursal: SucursalConAsignacion): void {
    if (!sucursal.asignado) {
      sucursal.asignado = true;
    }
    this.sucursalesConAsignacion.forEach(s => s.esDefault = false);
    sucursal.esDefault = true;
  }

  guardarSucursalesUsuario(): void {
    if (!this.usuarioSucursales) return;

    const sucursalesAsignadas = this.sucursalesConAsignacion
      .filter(s => s.asignado)
      .sort((a, b) => (b.esDefault ? 1 : 0) - (a.esDefault ? 1 : 0))
      .map(s => s.idSucursal);

    this.guardandoSucursales.set(true);

    this.usuarioSucursalService.actualizarAsignaciones(
      this.usuarioSucursales.idUsuario,
      sucursalesAsignadas
    ).subscribe({
      next: () => {
        this.guardandoSucursales.set(false);
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalSucursales'));
        modal?.hide();

        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: 'Sucursales actualizadas correctamente',
          position: 'topRight'
        });
      },
      error: (error) => {
        this.guardandoSucursales.set(false);
        console.error('Error:', error);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al guardar sucursales',
          position: 'topRight'
        });
      }
    });
  }

  // =============================================
  // HELPERS
  // =============================================

  generateColor(initial: string): string {
    const charCode = initial.charCodeAt(0);
    const colors = ['#667eea', '#f5576c', '#4facfe', '#43e97b'];
    return colors[charCode % colors.length];
  }

  getInitials(nombres: string, apellidos: string): string {
    const n = nombres?.charAt(0)?.toUpperCase() || '';
    const a = apellidos?.charAt(0)?.toUpperCase() || '';
    return n + a;
  }
}
