import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal, effect, Output, EventEmitter, Input } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { PermisosService } from '../../services/permisos.service';
import { AuthService } from '../../services/auth.service';
import { EmpresaService } from '../../services/empresa.service';
import { SidebarStateService } from '../../services/sidebar-state.service';
import { MenuItem, SubMenuItem } from '../../interfaces/permisos-interface';
import { nivelPlan } from '../../config/saas-plan-reglas.util';

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
  /** Módulos/dominios con submenú abierto (varios a la vez: dominio + módulo activo). */
  openSubmenus = signal<ReadonlySet<string>>(new Set());
  
  // Datos del usuario
  userName = signal<string>('Usuario');
  empresaNombre = signal<string>('');

  // Estado de configuración de la empresa
  estadoConfiguracion = signal<any>(null);
  /** Código rubro sistema (HOTEL, GRF, etc.) para etiquetas del menú. */
  codigoRubroEmpresa = signal<string | null>(null);

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
        this.empresaNombre.set(userData.razonSocial || '');
      }
    });

    // Efecto: al cambiar navegación, estado empresa o plan SaaS, fusionar menú (p. ej. Compras SUNAT + guías).
    effect(() => {
      const navegacion = this.permisosService.navegacion();
      const estado = this.estadoConfiguracion();
      this.permisosService.planCodeEfectivo();
      this.permisosService.contextoPlanCargado();
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
  private mobileTopnavSub: Subscription | null = null;

  ngOnInit(): void {
    this.cargarEstadoConfiguracion();
    this.cargarRubroEmpresa();
    this.cargarNavegacion();

    // Abrir el submenú que contiene la ruta actual al navegar (conserva flechas y estado)
    this.routerEventsSubscription = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.abrirSubmenuSegunRutaActual());

    // Aplicar una vez por si la ruta actual ya es un submenú (ej. recarga de página)
    setTimeout(() => this.abrirSubmenuSegunRutaActual(), 0);

    // Sincronizar estado visual con el servicio (ya inicializado desde localStorage)
    this.isCollapsed.set(this.sidebarState.sidebarCollapsed());

    this.mobileTopnavSub = this.sidebarState.mobileSidebarToggleRequest.subscribe(() => {
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 991.98px)').matches) {
        this.toggleMobileSidebar();
      }
    });
  }

  ngOnDestroy(): void {
    this.routerEventsSubscription?.unsubscribe();
    this.mobileTopnavSub?.unsubscribe();
  }

  /**
   * Carga el estado de configuración de la empresa
   */
  private cargarRubroEmpresa(): void {
    const actual = this.empresaService.getEmpresaActual()?.codigoRubro;
    if (actual) {
      this.codigoRubroEmpresa.set(String(actual).trim().toUpperCase());
      return;
    }
    this.empresaService.refreshEmpresaFromApi().subscribe({
      next: (emp) => {
        const cod = emp?.codigoRubro != null ? String(emp.codigoRubro).trim().toUpperCase() : '';
        this.codigoRubroEmpresa.set(cod || null);
        this.refrescarEtiquetaHistorialVentas();
      },
      error: () => {}
    });
  }

  private esRubroHotel(): boolean {
    const cod = String(this.codigoRubroEmpresa() || '').trim().toUpperCase();
    return cod === 'HOTEL' || cod === 'HTL';
  }

  private etiquetaHistorialVentas(): string {
    return this.esRubroHotel() ? 'Recepción' : 'Historial';
  }

  /** Renombra «Historial» → «Recepción» en submenús de ventas cuando el rubro es hotel. */
  private parchearSubmenuVentas(submenu: SubMenuItem[]): SubMenuItem[] {
    const esGestora = this.estadoConfiguracion()?.esGestora === true;
    const base = (esGestora || this.esRubroHotel())
      ? submenu.filter((s) => s.ruta !== '/ventas/rapida')
      : submenu;
    if (!this.esRubroHotel()) return base;
    const label = this.etiquetaHistorialVentas();
    return base.map((s) => {
      if (s.ruta === '/ventas' && (s.nombre === 'Historial' || s.nombre === 'Recepción')) {
        return { ...s, nombre: label };
      }
      if (s.submenu?.length) {
        return { ...s, submenu: this.parchearSubmenuVentas(s.submenu) };
      }
      return s;
    });
  }

  private refrescarEtiquetaHistorialVentas(): void {
    const estado = this.estadoConfiguracion();
    if (estado) {
      this.actualizarNavegacionSegunEstado(estado);
      return;
    }
    const nav = this.permisosService.navegacion();
    if (nav?.length) {
      this.menuItems.set(nav.map((i) => this.patchItemNavegacion(i, {})));
    }
  }

  private cargarEstadoConfiguracion(): void {
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (response) => {
        this.estadoConfiguracion.set(response.data);
        this.actualizarNavegacionSegunEstado(response.data);
      },
      error: (error) => {
        console.error('Error al cargar estado de configuración:', error);
      }
    });
  }

  private patchItemNavegacion(item: MenuItem, estado: any): MenuItem {
    if (item.tipo === 'grupo' || item.tipo === 'separador') {
      return item;
    }
    if (item.tipo === 'dominio' && item.submenu?.length) {
      return {
        ...item,
        submenu: item.submenu.map((s) => this.patchSubmenuDominio(s, estado))
      };
    }
    const mod = (item.modulo || '').toString().toLowerCase();
    if (!item.submenu && item.ruta === '/compras') {
      return {
        nombre: item.nombre,
        icono: item.icono || 'bi bi-bag',
        modulo: 'compras',
        visible: item.visible !== false,
        submenu: this.buildSubmenuCompras()
      };
    }
    if (!item.submenu && item.ruta === '/ventas') {
      return {
        nombre: item.nombre,
        icono: item.icono || 'bi bi-cart',
        modulo: 'ventas',
        visible: item.visible !== false,
        submenu: this.buildSubmenuVentas()
      };
    }
    if (item.submenu?.length && mod === 'ventas') {
      return { ...item, submenu: this.parchearSubmenuVentas(item.submenu) };
    }
    if (item.submenu?.length && mod === 'compras') {
      return { ...item, submenu: this.mergeSubmenuComprasSunat(item.submenu, item.visible !== false) };
    }
    if (item.submenu && mod === 'facturacion') {
      return { ...item, submenu: this.mergeSubmenuFacturacionGuias(item.submenu, estado) };
    }
    return item;
  }

  private patchSubmenuDominio(sub: SubMenuItem, estado: any): SubMenuItem {
    if (sub.tipo === 'modulo' && sub.modulo) {
      const mod = sub.modulo.toString().toLowerCase();
      if (mod === 'ventas' && sub.submenu) {
        return { ...sub, submenu: this.parchearSubmenuVentas(sub.submenu) };
      }
      if (mod === 'compras' && sub.submenu) {
        return { ...sub, submenu: this.mergeSubmenuComprasSunat(sub.submenu, true) };
      }
      if (mod === 'facturacion' && sub.submenu) {
        return { ...sub, submenu: this.mergeSubmenuFacturacionGuias(sub.submenu, estado) };
      }
    }
    return sub;
  }

  private mergeSubmenuComprasSunat(submenu: SubMenuItem[], visibleParent: boolean): SubMenuItem[] {
    const sunatRuta = '/compras/comprobantes-sunat';
    const visSunat = this.puedeVerComprasSunatMenu();
    const base = submenu.filter((s) => s.ruta !== sunatRuta);
    const insert: SubMenuItem = {
      nombre: 'Compras SUNAT',
      ruta: sunatRuta,
      permiso: 'VER_COMPRAS',
      visible: visSunat && visibleParent
    };
    const idxLista = base.findIndex((s) => s.ruta === '/compras');
    return idxLista >= 0
      ? [...base.slice(0, idxLista + 1), insert, ...base.slice(idxLista + 1)]
      : [...base, insert];
  }

  private mergeSubmenuFacturacionGuias(submenu: SubMenuItem[], estado: any): SubMenuItem[] {
    let base = submenu.filter(
      (s) => s.ruta !== '/facturacion/guias-remision' && s.ruta !== '/facturacion/guias-transportista'
    );
    if (!base.some((s) => s.ruta === '/facturacion/emision-guias')) {
      const idxCom = base.findIndex((s) => s.ruta === '/facturacion/comunicacion-baja');
      const emisionItem: SubMenuItem = {
        nombre: 'Emisión de guías',
        ruta: '/facturacion/emision-guias',
        permiso: '',
        visible: true
      };
      base = idxCom >= 0 ? [...base.slice(0, idxCom + 1), emisionItem, ...base.slice(idxCom + 1)] : [...base, emisionItem];
    }
    const guiasItems: SubMenuItem[] = estado?.habilitarGuiasElectronicas
      ? [
          { nombre: 'Guías de remisión', ruta: '/facturacion/guias-remision', permiso: '', visible: true },
          { nombre: 'Guías transportista', ruta: '/facturacion/guias-transportista', permiso: '', visible: true }
        ]
      : [];
    return [...base, ...guiasItems];
  }

  /**
   * Actualiza la navegación basada en el estado de configuración.
   * No reemplaza el menú cuando la API ya devolvió ítems con submenús (para conservar las flechas).
   */
  private actualizarNavegacionSegunEstado(estado: any): void {
    if (!estado) return;

    const navegacionDesdeApi = this.permisosService.navegacion();
    const tieneMenuConSubmenus = navegacionDesdeApi?.some(
      (item) =>
        item.tipo === 'dominio' ||
        (item.submenu && (item.submenu?.length ?? 0) > 0)
    ) ?? false;

    if (tieneMenuConSubmenus && navegacionDesdeApi && navegacionDesdeApi.length > 0) {
      const items: MenuItem[] = navegacionDesdeApi.map((i: MenuItem) => this.patchItemNavegacion(i, estado));
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
      {
        nombre: 'Compras',
        icono: 'bi bi-bag',
        modulo: 'compras',
        visible: true,
        submenu: this.buildSubmenuCompras()
      },
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
      { nombre: 'Vincular WhatsApp', icono: 'bi bi-whatsapp', ruta: '/configuracion/whatsapp', visible: true },
    ];

    this.menuItems.set(navegacionCompleta);
  }

  /**
   * Plan Emprendedor+ (SaaS). Mientras no cargue el plan, se muestra el ítem; el guard corta si no aplica.
   */
  private puedeVerComprasSunatMenu(): boolean {
    if (this.permisosService.deploymentMode() !== 'saas') {
      return true;
    }
    if (!this.permisosService.contextoPlanCargado()) {
      return true;
    }
    const code = this.permisosService.planCodeEfectivo();
    if (!code) {
      return false;
    }
    return nivelPlan(code) >= 2;
  }

  private buildSubmenuCompras(): SubMenuItem[] {
    return [
      { nombre: 'Listado de compras', ruta: '/compras', permiso: '', visible: true },
      {
        nombre: 'Reporte detallado',
        ruta: '/compras/reporte-detallado',
        permiso: 'REPORTE_DETALLADO_COMPRAS',
        visible: this.permisosService.tienePermiso('REPORTE_DETALLADO_COMPRAS')
      },
      {
        nombre: 'Compras SUNAT',
        ruta: '/compras/comprobantes-sunat',
        permiso: '',
        visible: this.puedeVerComprasSunatMenu()
      }
    ].filter((s) => s.visible !== false);
  }

  private buildSubmenuVentas(): SubMenuItem[] {
    const labelHistorial = this.etiquetaHistorialVentas();
    return [
      { nombre: labelHistorial, ruta: '/ventas', permiso: 'VER_VENTAS', visible: true },
      {
        nombre: 'Reporte detallado',
        ruta: '/ventas/reporte-detallado',
        permiso: 'REPORTE_DETALLADO_VENTAS',
        visible: this.permisosService.tienePermiso('REPORTE_DETALLADO_VENTAS')
      }
    ].filter((s) => s.visible !== false);
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
    const abiertos = new Set<string>();

    const rutaActiva = (ruta?: string | null): boolean => {
      if (!ruta) return false;
      return url === ruta || url.startsWith(ruta + '/');
    };

    for (const item of items) {
      if (item.tipo === 'dominio' && item.submenu?.length && item.modulo) {
        for (const sub of item.submenu) {
          if (sub.tipo === 'modulo' && sub.submenu?.length && sub.modulo) {
            const activo = sub.submenu.some((link) => rutaActiva(link.ruta));
            if (activo) {
              abiertos.add(item.modulo);
              abiertos.add(sub.modulo);
              this.openSubmenus.set(abiertos);
              return;
            }
          }
          if (rutaActiva(sub.ruta)) {
            abiertos.add(item.modulo);
            this.openSubmenus.set(abiertos);
            return;
          }
        }
      }
      if (item.submenu?.length && item.modulo) {
        const activo = item.submenu.some((sub) => rutaActiva(sub.ruta));
        if (activo) {
          abiertos.add(item.modulo);
          this.openSubmenus.set(abiertos);
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
      {
        nombre: 'Compras',
        icono: 'bi bi-bag',
        modulo: 'compras',
        visible: true,
        submenu: this.buildSubmenuCompras()
      },
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
      this.openSubmenus.set(new Set());
    }
  }

  /**
   * Toggle del sidebar en móvil
   */
  toggleMobileSidebar(): void {
    const opening = !this.isMobileOpen();
    this.isMobileOpen.set(opening);
    // En móvil, si el usuario dejó colapsado en desktop, expandimos solo vista para poder usar submenús.
    if (opening && this.isCollapsed()) {
      this.isCollapsed.set(false);
    }
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
  toggleSubmenu(modulo: string, event?: Event): void {
    event?.stopPropagation();
    const next = new Set(this.openSubmenus());
    const esDominio = modulo.startsWith('DOMINIO_');

    if (next.has(modulo)) {
      next.delete(modulo);
      if (esDominio) {
        this.menuItems().forEach((item) => {
          if (item.tipo === 'dominio' && item.modulo === modulo && item.submenu) {
            item.submenu.forEach((sub) => {
              if (sub.tipo === 'modulo' && sub.modulo) {
                next.delete(sub.modulo);
              }
            });
          }
        });
      }
    } else {
      if (esDominio) {
        [...next].forEach((k) => {
          if (k.startsWith('DOMINIO_')) {
            next.delete(k);
          }
        });
      }
      next.add(modulo);
    }
    this.openSubmenus.set(next);
  }

  isSubmenuOpen(modulo: string): boolean {
    return this.openSubmenus().has(modulo);
  }

  esSubmenuModulo(sub: SubMenuItem): boolean {
    return sub.tipo === 'modulo' && !!sub.submenu?.length;
  }

  esDominio(item: MenuItem): boolean {
    return item.tipo === 'dominio' && !!item.submenu?.length;
  }

  /**
   * Navega a una ruta. Nueva venta se abre en otra pestaña.
   */
  navigateTo(ruta: string | null): void {
    if (ruta) {
      const target = this.normalizarRuta(ruta);
      if (target === '/ventas/create') {
        const segments = target.split('/').filter(Boolean);
        const url = this.router.serializeUrl(this.router.createUrlTree(segments));
        window.open(url, '_blank');
        this.closeMobileSidebar();
      } else {
        // Navegación + cierre drawer: en WebKit móvil cerrar en el mismo tick que el click a veces anula la ruta.
        this.router.navigateByUrl(target).then((ok) => {
          if (!ok) {
            console.error('No se pudo navegar a ruta de sidebar:', target);
          }
          setTimeout(() => this.closeMobileSidebar(), 0);
        });
      }
    }
  }

  /** Normaliza rutas de menú para navegación absoluta consistente (desktop/móvil). */
  private normalizarRuta(ruta: string): string {
    const r = String(ruta || '').trim();
    if (!r) return '/home';
    return r.startsWith('/') ? r : `/${r}`;
  }

  /** Ítem navegable (excluye separadores y etiquetas de dominio). */
  esItemMenu(item: MenuItem): boolean {
    if (item.tipo === 'separador' || item.tipo === 'grupo') {
      return false;
    }
    if (item.tipo === 'dominio') {
      return item.visible !== false;
    }
    return item.visible !== false;
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
