import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal, effect, Output, EventEmitter, Input } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PermisosService } from '../../services/permisos.service';
import { AuthService } from '../../services/auth.service';
import { EmpresaService } from '../../services/empresa.service';
import { SidebarStateService } from '../../services/sidebar-state.service';
import { MenuItem } from '../../interfaces/permisos-interface';

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

  // Eventos
  @Output() sidebarToggle = new EventEmitter<boolean>();
  @Input() forceCollapsed: boolean = false;

  constructor(
    private permisosService: PermisosService,
    private authService: AuthService,
    private empresaService: EmpresaService,
    private sidebarState: SidebarStateService,
    private router: Router
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

    // Efecto para actualizar navegación cuando se carguen los permisos
    effect(() => {
      const navegacion = this.permisosService.navegacion();
      console.log('navegacion', navegacion);
      if (navegacion && navegacion.length > 0) {
        this.menuItems.set(navegacion);
      }
    });
  }

  private routerEventsSubscription: ReturnType<Router['events']['subscribe']> | null = null;

  ngOnInit(): void {
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
        console.log('Estado de configuración:', response.data);
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
      // Respetar el menú de la API (con submenús y flechas); solo inyectar "Crear Primer Colaborador" si aplica
      if (!estado.tieneColaboradores) {
        const items = [...navegacionDesdeApi];
        const sepIndex = items.findIndex((i) => i.tipo === 'separador');
        const insertIndex = sepIndex >= 0 ? sepIndex + 1 : items.length;
        items.splice(insertIndex, 0, {
          nombre: 'Crear Primer Colaborador',
          icono: 'bi bi-person-plus',
          ruta: '/colaborador/create',
          visible: true,
        });
        this.menuItems.set(items);
      }
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
        submenu: [
          { nombre: 'Resumen diario', ruta: '/facturacion/resumenes-diarios', permiso: '', visible: true },
          { nombre: 'Emisión de notas', ruta: '/facturacion/notas-credito-debito', permiso: '', visible: true },
          { nombre: 'Comunicación de baja', ruta: '/facturacion/comunicacion-baja', permiso: '', visible: true }
        ]
      },
      { tipo: 'separador' },
      { nombre: 'Configuración', icono: 'bi bi-gear', ruta: '/configuracion', visible: true },
      { nombre: 'Integraciones / APIs de pago', icono: 'bi bi-credit-card', ruta: '/configuracion/integraciones', visible: true },
    ];

    this.menuItems.set(navegacionCompleta);
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
        console.log(response);
        if (response.data) {
          this.menuItems.set(response.data);
        }
      },
      error: (error) => {
        console.error('Error al cargar navegación:', error);
        // Cargar navegación por defecto en caso de error
        this.cargarNavegacionDefecto();
      }
    });
  }

  /**
   * Navegación por defecto en caso de error
   */
  private cargarNavegacionDefecto(): void {
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
        submenu: [
          { nombre: 'Resumen diario', ruta: '/facturacion/resumenes-diarios', permiso: '', visible: true },
          { nombre: 'Emisión de notas', ruta: '/facturacion/notas-credito-debito', permiso: '', visible: true },
          { nombre: 'Comunicación de baja', ruta: '/facturacion/comunicacion-baja', permiso: '', visible: true }
        ]
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
