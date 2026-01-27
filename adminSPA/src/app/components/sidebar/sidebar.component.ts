import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, effect, Output, EventEmitter, Input } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { PermisosService } from '../../services/permisos.service';
import { AuthService } from '../../services/auth.service';
import { MenuItem } from '../../interfaces/permisos-interface';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit {
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

  // Eventos
  @Output() sidebarToggle = new EventEmitter<boolean>();
  @Input() forceCollapsed: boolean = false;

  constructor(
    private permisosService: PermisosService,
    private authService: AuthService,
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

  ngOnInit(): void {
    this.cargarNavegacion();
    
    // Verificar si hay preferencia guardada
    const collapsed = localStorage.getItem('sidebarCollapsed');
    if (collapsed === 'true') {
      this.isCollapsed.set(true);
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
      { nombre: 'Dashboard', icono: 'fas fa-tachometer-alt', ruta: '/home', visible: true },
      { tipo: 'separador' },
      { nombre: 'Ventas', icono: 'fas fa-shopping-cart', ruta: '/ventas', visible: true },
      { nombre: 'Compras', icono: 'fas fa-shopping-bag', ruta: '/compras', visible: true },
      { nombre: 'Inventario', icono: 'fas fa-boxes', ruta: '/inventario', visible: true },
    ];
    this.menuItems.set(navegacionDefecto);
  }

  /**
   * Toggle del sidebar (colapsar/expandir)
   */
  toggleSidebar(): void {
    const newState = !this.isCollapsed();
    this.isCollapsed.set(newState);
    localStorage.setItem('sidebarCollapsed', String(newState));
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
   * Navega a una ruta
   */
  navigateTo(ruta: string | null): void {
    if (ruta) {
      this.router.navigate([ruta]);
      // Cerrar sidebar en móvil después de navegar
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
