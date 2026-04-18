import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal, effect, Output, EventEmitter, Input } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PermisosService } from '../../services/permisos.service';
import { AuthService } from '../../services/auth.service';
import { EmpresaService } from '../../services/empresa.service';
import { SidebarStateService } from '../../services/sidebar-state.service';
import { DeploymentContextService } from '../../services/deployment-context.service';
import { MenuItem, SubMenuItem } from '../../interfaces/permisos-interface';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit, OnDestroy {
  // Estado del sidebar
  isCollapsed = signal<boolean>(false);
  isMobileOpen = signal<boolean>(false);
  
  // Navegación
  menuItems = signal<MenuItem[]>([]);
  openSubmenu = signal<string | null>(null);
  
  // Datos del usuario
  userName = signal<string>('Usuario');
  userRole = signal<string>('');
  empresaNombre = signal<string>('');

  // Estado de configuración de la empresa
  estadoConfiguracion = signal<any>(null);

  /** Enlace a página pública de planes (solo modo SaaS). */
  mostrarPlanesSaas = signal(false);

  // Eventos
  @Output() sidebarToggle = new EventEmitter<boolean>();
  @Input() forceCollapsed: boolean = false;

  constructor(
    private permisosService: PermisosService,
    private authService: AuthService,
    private empresaService: EmpresaService,
    private sidebarState: SidebarStateService,
    private router: Router,
    private deploymentContext: DeploymentContextService
  ) {
    // Efecto para actualizar datos del usuario cuando cambien
    effect(() => {
      const userData = this.authService.userData();
      if (userData) {
        this.userName.set(userData.nombres || 'Usuario');
        this.userRole.set(userData.rol || '');
        this.empresaNombre.set(userData.razonSocial || '');
      }
    });

    // Efecto: al cambiar navegación (API) o estado (habilitarGuiasElectronicas), mostrar menú fusionado
    effect(() => {
      const navegacion = this.permisosService.navegacion();
      const estado = this.estadoConfiguracion();
      if (navegacion && navegacion.length > 0) {
        if (estado) {
          this.actualizarNavegacionSegunEstado(estado);
        } else {
          this.menuItems.set(navegacion);
        }
      }
    });
  }

  private routerEventsSubscription: ReturnType<Router['events']['subscribe']> | null = null;

  ngOnInit(): void {
    this.deploymentContext.cargarSiNecesario().subscribe((cfg) => {
      this.mostrarPlanesSaas.set(!!cfg?.mostrarPlanesPublicos);
    });
    this.cargarEstadoConfiguracion();
    this.cargarNavegacion();

    // Abrir el submenú que contiene la ruta actual al navegar (conserva flechas y estado)
    this.routerEventsSubscription = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.abrirSubmenuSegunRutaActual());

    // Aplicar una vez por si la ruta actual ya es un submenú (ej. recarga de página)
    setTimeout(() => this.abrirSubmenuSegunRutaActual(), 0);

    // Sincronizar estado visual con el servicio (ya inicializado desde localStorage)
    this.isCollapsed.set(this.sidebarState.sidebarCollapsed());
  }

  ngOnDestroy(): void {
    this.routerEventsSubscription?.unsubscribe();
  }

  /**
   * Carga el estado de configuración de la empresa
   */
  private cargarEstadoConfiguracion(): void {
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (response) => {
                this.estadoConfiguracion.set(response.data);
        // Actualizar navegación según el estado
        this.actualizarNavegacionSegunEstado(response.data);
      },
      error: (error) => {
        console.error('Error al cargar estado de configuración:', error);
      }
    });
  }

  /**
   * Actualiza la navegación basada en el estado de configuración.
   * No reemplaza el menú cuando la API ya devolvió ítems con submenús (para conservar las flechas).
   */
  private actualizarNavegacionSegunEstado(estado: any): void {
    if (!estado) return;

    const navegacionDesdeApi = this.permisosService.navegacion();
    const tieneMenuConSubmenus = navegacionDesdeApi?.some(
      (item) => item.submenu && (item.submenu?.length ?? 0) > 0
    ) ?? false;

    if (tieneMenuConSubmenus && navegacionDesdeApi && navegacionDesdeApi.length > 0) {
      const items: MenuItem[] = navegacionDesdeApi.map((i: MenuItem) => {
        const mod = (i.modulo || '').toString().toLowerCase();
        if (i.submenu && mod === 'facturacion') {
          let base: SubMenuItem[] = i.submenu.filter((s: SubMenuItem) =>
            s.ruta !== '/facturacion/guias-remision' &&
            s.ruta !== '/facturacion/guias-transportista'
          );
          const tieneEmision = base.some((s) => s.ruta === '/facturacion/emision-guias');
          if (!tieneEmision) {
            const idxCom = base.findIndex((s) => s.ruta === '/facturacion/comunicacion-baja');
            const emisionItem: SubMenuItem = {
              nombre: 'Emisión de guías',
              ruta: '/facturacion/emision-guias',
              permiso: '',
              visible: true
            };
            base =
              idxCom >= 0
                ? [...base.slice(0, idxCom + 1), emisionItem, ...base.slice(idxCom + 1)]
                : [...base, emisionItem];
          }
          const guiasItems: SubMenuItem[] = estado.habilitarGuiasElectronicas
            ? [
                //{ nombre: 'Configuración de guías electrónicas', ruta: '/facturacion/guias/configuracion', permiso: '', visible: true },
                { nombre: 'Guías de remisión', ruta: '/facturacion/guias-remision', permiso: '', visible: true },
                { nombre: 'Guías transportista', ruta: '/facturacion/guias-transportista', permiso: '', visible: true }
              ]
            : [];
          return { ...i, submenu: [...base, ...guiasItems] };
        }
        return i;
      });
      if (!estado.tieneColaboradores) {
        const sepIndex = items.findIndex((i: any) => i.tipo === 'separador');
        const insertIndex = sepIndex >= 0 ? sepIndex + 1 : items.length;
        items.splice(insertIndex, 0, {
          nombre: 'Crear Primer Colaborador',
          icono: 'bi bi-person-plus',
          ruta: '/colaborador/create',
          visible: true,
        });
      }
      this.menuItems.set(items);
      this.abrirSubmenuSegunRutaActual();
      return;
    }

    const navegacionBasica: MenuItem[] = [
      { nombre: 'Dashboard', icono: 'bi bi-speedometer2', ruta: '/home', visible: true },
      { tipo: 'separador' },
      { nombre: 'Configuración Empresa', icono: 'bi bi-building', ruta: '/editar-empresa', visible: true },
    ];

    if (!estado.tieneColaboradores) {
      navegacionBasica.push({
        nombre: 'Crear Primer Colaborador',
        icono: 'bi bi-person-plus',
        ruta: '/colaborador/create',
        visible: true,
      });
      this.menuItems.set(navegacionBasica);
      return;
    }

    const navegacionCompleta: MenuItem[] = [
      ...navegacionBasica,
      { tipo: 'separador' },
      { nombre: 'Colaboradores', icono: 'bi bi-people', ruta: '/colaborador', visible: true },
      { nombre: 'Ventas', icono: 'bi bi-cart', ruta: '/ventas', visible: true },
      { nombre: 'Compras', icono: 'bi bi-bag', ruta: '/compras', visible: true },
      { nombre: 'Inventario', icono: 'bi bi-box-seam', ruta: '/inventario', visible: true },
      { nombre: 'Productos', icono: 'bi bi-box', ruta: '/productos', visible: true },
      { nombre: 'Clientes', icono: 'bi bi-people', ruta: '/clientes', visible: true },
      { nombre: 'Proveedores', icono: 'bi bi-truck', ruta: '/proveedores', visible: true },
      {
        nombre: 'Facturación',
        icono: 'bi bi-file-earmark-text',
        modulo: 'facturacion',
        visible: true,
        submenu: this.buildSubmenuFacturacion(estado)
      },
      { tipo: 'separador' },
      { nombre: 'Configuración', icono: 'bi bi-gear', ruta: '/configuracion', visible: true },
      { nombre: 'Integraciones / APIs de pago', icono: 'bi bi-credit-card', ruta: '/configuracion/integraciones', visible: true },
    ];

    this.menuItems.set(navegacionCompleta);
  }

  /** Submenú Facturación: emisión de guías siempre visible; resto de guías si están habilitadas en empresa. */
  private buildSubmenuFacturacion(estado: any): SubMenuItem[] {
    const base: SubMenuItem[] = [
      { nombre: 'Resumen diario', ruta: '/facturacion/resumenes-diarios', permiso: '', visible: true },
      { nombre: 'Emisión de notas', ruta: '/facturacion/notas-credito-debito', permiso: '', visible: true },
      { nombre: 'Comunicación de baja', ruta: '/facturacion/comunicacion-baja', permiso: '', visible: true },
      { nombre: 'Emisión de guías', ruta: '/facturacion/emision-guias', permiso: '', visible: true }
    ];
    if (estado?.habilitarGuiasElectronicas) {
      base.push(
        //{ nombre: 'Configuración de guías electrónicas', ruta: '/facturacion/guias/configuracion', permiso: '', visible: true },
        { nombre: 'Guías de remisión', ruta: '/facturacion/guias-remision', permiso: '', visible: true },
        { nombre: 'Guías transportista', ruta: '/facturacion/guias-transportista', permiso: '', visible: true }
      );
    }
    return base;
  }

  /**
   * Abre el submenú que contiene la ruta actual (para que la flecha y el submenú se mantengan visibles al navegar).
   */
  private abrirSubmenuSegunRutaActual(): void {
    const url = this.router.url;
    const items = this.menuItems();
    for (const item of items) {
      if (item.submenu?.length) {
        const modulo = item.modulo ?? '';
        const algunaRutaActiva = item.submenu.some(
          (sub) => sub.ruta === url || url.startsWith(sub.ruta + '/')
        );
        if (algunaRutaActiva) {
          this.openSubmenu.set(modulo);
          return;
        }
      }
    }
  }

  /**
   * Carga la navegación desde el servicio de permisos
   */
  private cargarNavegacion(): void {
    this.permisosService.cargarNavegacion().subscribe({
      next: (response) => {
        const data = response?.data;
        if (data && data.length > 0) {
          this.menuItems.set(data);
        } else {
          const prev = this.permisosService.navegacion();
          if (prev && prev.length > 0) {
            this.menuItems.set(prev);
          } else {
            this.cargarNavegacionDefecto();
          }
        }
      },
      error: () => {
        const prev = this.permisosService.navegacion();
        if (prev && prev.length > 0) {
          this.menuItems.set(prev);
        } else {
          this.cargarNavegacionDefecto();
        }
      }
    });
  }

  /**
   * Navegación por defecto en caso de error
   */
  private cargarNavegacionDefecto(): void {
    const submenuFacturacion: SubMenuItem[] = [
      { nombre: 'Resumen diario', ruta: '/facturacion/resumenes-diarios', permiso: '', visible: true },
      { nombre: 'Emisión de notas', ruta: '/facturacion/notas-credito-debito', permiso: '', visible: true },
      { nombre: 'Comunicación de baja', ruta: '/facturacion/comunicacion-baja', permiso: '', visible: true },
      { nombre: 'Emisión de guías', ruta: '/facturacion/emision-guias', permiso: '', visible: true },
      { nombre: 'Guías de remisión', ruta: '/facturacion/guias-remision', permiso: '', visible: true },
      { nombre: 'Guías transportista', ruta: '/facturacion/guias-transportista', permiso: '', visible: true }
    ];
    const navegacionDefecto: MenuItem[] = [
      { nombre: 'Dashboard', icono: 'bi bi-speedometer2', ruta: '/home', visible: true },
      { tipo: 'separador' },
      { nombre: 'Ventas', icono: 'bi bi-cart', ruta: '/ventas', visible: true },
      { nombre: 'Compras', icono: 'bi bi-bag', ruta: '/compras', visible: true },
      { nombre: 'Inventario', icono: 'bi bi-box-seam', ruta: '/inventario', visible: true },
      {
        nombre: 'Facturación',
        icono: 'bi bi-file-earmark-text',
        modulo: 'facturacion',
        visible: true,
        submenu: submenuFacturacion
      },
    ];
    this.menuItems.set(navegacionDefecto);
  }

  /**
   * Toggle del sidebar (colapsar/expandir)
   */
  toggleSidebar(): void {
    const newState = !this.isCollapsed();
    this.isCollapsed.set(newState);
    this.sidebarState.setCollapsed(newState);
    this.sidebarToggle.emit(newState);
    
    // Cerrar submenús cuando se colapsa
    if (newState) {
      this.openSubmenu.set(null);
    }
  }

  /**
   * Toggle del sidebar en móvil
   */
  toggleMobileSidebar(): void {
    this.isMobileOpen.set(!this.isMobileOpen());
  }

  /**
   * Cierra el sidebar en móvil
   */
  closeMobileSidebar(): void {
    this.isMobileOpen.set(false);
  }

  /**
   * Toggle de submenú
   */
  toggleSubmenu(modulo: string): void {
    if (this.openSubmenu() === modulo) {
      this.openSubmenu.set(null);
    } else {
      this.openSubmenu.set(modulo);
    }
  }

  /**
   * Verifica si un submenú está abierto
   */
  isSubmenuOpen(modulo: string): boolean {
    return this.openSubmenu() === modulo;
  }

  /**
   * Navega a una ruta. Nueva venta se abre en otra pestaña.
   */
  navigateTo(ruta: string | null): void {
    if (ruta) {
      if (ruta === '/ventas/create') {
        const segments = ruta.split('/').filter(Boolean);
        const url = this.router.serializeUrl(this.router.createUrlTree(segments));
        window.open(url, '_blank');
      } else {
        this.router.navigate([ruta]);
      }
      this.closeMobileSidebar();
    }
  }

  /**
   * Verifica si una ruta está activa
   */
  isRouteActive(ruta: string | null): boolean {
    if (!ruta) return false;
    return this.router.url === ruta || this.router.url.startsWith(ruta + '/');
  }

  /**
   * Cierra sesión
   */
  logout(): void {
    this.permisosService.limpiarPermisos();
    this.authService.forceLogout();
  }

  /**
   * Obtiene las iniciales del usuario
   */
  getUserInitials(): string {
    const name = this.userName();
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
}
