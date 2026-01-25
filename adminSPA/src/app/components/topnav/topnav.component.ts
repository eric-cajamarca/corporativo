import { Component, OnInit, effect, Output, EventEmitter, Input } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { PermisosService } from '../../services/permisos.service';

@Component({
  selector: 'app-topnav',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './topnav.component.html',
  styleUrl: './topnav.component.css'
})
export class TopnavComponent implements OnInit {
  // Datos del usuario
  public userName: string = '';
  public userRole: string = '';
  public empresaNombre: string = '';
  public empresaLogo: string = '';
  public isAuthenticated: boolean = false;

  // Estado de notificaciones (ejemplo)
  public notificacionesCount: number = 0;
  public notificaciones: any[] = [];

  // Eventos
  @Output() toggleSidebar = new EventEmitter<void>();
  @Input() sidebarCollapsed: boolean = false;

  // Búsqueda
  public searchQuery: string = '';
  public showSearchResults: boolean = false;

  constructor(
    private router: Router,
    public authService: AuthService,
    private permisosService: PermisosService,
  ) {
    // Efecto para actualizar datos del usuario cuando cambien
    effect(() => {
      const userData = this.authService.userData();
      if (userData) {
        this.userName = userData.nombres || 'Usuario';
        this.userRole = userData.rol || '';
        this.empresaNombre = userData.razonSocial || '';
        this.isAuthenticated = true;
      } else {
        this.userName = '';
        this.userRole = '';
        this.empresaNombre = '';
        this.isAuthenticated = false;
      }
    });
  }

  ngOnInit(): void {
    // Inicializar el servicio de autenticación
    this.authService.initialize();
    
    // Cargar notificaciones (ejemplo)
    this.cargarNotificaciones();
  }

  /**
   * Emite evento para toggle del sidebar
   */
  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  /**
   * Cierra sesión
   */
  logout(): void {
    this.permisosService.limpiarPermisos();
    this.authService.forceLogout();
  }

  /**
   * Navega al perfil del usuario
   */
  navigateToProfile(): void {
    this.router.navigate(['/perfil']);
  }

  /**
   * Navega a configuración
   */
  navigateToSettings(): void {
    this.router.navigate(['/configuracion']);
  }

  /**
   * Navega a la empresa
   */
  navigateToEmpresa(): void {
    this.router.navigate(['/editar-empresa']);
  }

  /**
   * Verifica si el usuario tiene un rol específico
   */
  hasRole(role: string): boolean {
    return this.userRole === role;
  }

  /**
   * Obtiene las iniciales del usuario
   */
  getUserInitials(): string {
    if (!this.userName) return 'U';
    const parts = this.userName.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return this.userName.substring(0, 2).toUpperCase();
  }

  /**
   * Realiza búsqueda global
   */
  onSearch(): void {
    if (this.searchQuery.trim()) {
      console.log('Buscando:', this.searchQuery);
      // Implementar búsqueda global aquí
      this.showSearchResults = true;
    }
  }

  /**
   * Cierra los resultados de búsqueda
   */
  closeSearchResults(): void {
    this.showSearchResults = false;
    this.searchQuery = '';
  }

  /**
   * Carga notificaciones del usuario
   */
  private cargarNotificaciones(): void {
    // Ejemplo de notificaciones
    this.notificaciones = [
      {
        id: 1,
        titulo: 'Stock bajo',
        mensaje: 'Producto XYZ tiene menos de 10 unidades',
        tipo: 'warning',
        fecha: new Date(),
        leido: false
      },
      {
        id: 2,
        titulo: 'Nueva venta',
        mensaje: 'Se registró una venta por S/ 1,250.00',
        tipo: 'success',
        fecha: new Date(),
        leido: false
      }
    ];
    this.notificacionesCount = this.notificaciones.filter(n => !n.leido).length;
  }

  /**
   * Marca una notificación como leída
   */
  marcarComoLeida(id: number): void {
    const notificacion = this.notificaciones.find(n => n.id === id);
    if (notificacion) {
      notificacion.leido = true;
      this.notificacionesCount = this.notificaciones.filter(n => !n.leido).length;
    }
  }

  /**
   * Marca todas las notificaciones como leídas
   */
  marcarTodasComoLeidas(): void {
    this.notificaciones.forEach(n => n.leido = true);
    this.notificacionesCount = 0;
  }

  /**
   * Obtiene el icono según el tipo de notificación
   */
  getNotificacionIcon(tipo: string): string {
    const icons: { [key: string]: string } = {
      'warning': 'fas fa-exclamation-triangle text-warning',
      'success': 'fas fa-check-circle text-success',
      'error': 'fas fa-times-circle text-danger',
      'info': 'fas fa-info-circle text-info'
    };
    return icons[tipo] || icons['info'];
  }
}
