import { Component, OnInit, OnDestroy, effect, Output, EventEmitter, Input, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Subscription, filter, throttleTime, asyncScheduler } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { PermisosService } from '../../services/permisos.service';
import { TipoCambioService, TipoCambioData } from '../../services/tipo-cambio.service';
import { ConsultarPlacaModalComponent } from '../facturacion/consultar-placa-modal/consultar-placa-modal.component';
import { ConsultarSoatModalComponent } from '../facturacion/consultar-soat-modal/consultar-soat-modal.component';
import { VehiculosService } from '../../services/vehiculos.service';
import { DeploymentContextService } from '../../services/deployment-context.service';
import { SaasSubscriptionService } from '../../services/saas-subscription.service';
import {
  puedeVerArqueoCaja,
  tarjetaMostrarArqueoDemoPlan,
  tarjetaPermiteConsultaPlacaSoat
} from '../../utils/plan-tarjeta-perfil.util';
import { AppBannerRibbonComponent } from '../app-banner-ribbon/app-banner-ribbon.component';
import { AppBannerService } from '../../services/app-banner.service';

declare const iziToast: any;

@Component({
  selector: 'app-topnav',
  standalone: true,
  imports: [
    FormsModule,
    RouterModule,
    CommonModule,
    ConsultarPlacaModalComponent,
    ConsultarSoatModalComponent,
    AppBannerRibbonComponent
  ],
  templateUrl: './topnav.component.html',
  styleUrl: './topnav.component.css'
})
export class TopnavComponent implements OnInit, OnDestroy {
  // Datos del usuario
  public userName: string = '';
  public userRole: string = '';
  public empresaNombre: string = '';
  public empresaLogo: string = '';
  public isAuthenticated: boolean = false;

  // Estado de notificaciones (ejemplo)
  public notificacionesCount: number = 0;
  public notificaciones: any[] = [];

  // Tipo de cambio (solo si empresa autorizada)
  public tipoCambio: TipoCambioData | null = null;
  public showTipoCambioDropdown = false;
  public mesTipoCambio: TipoCambioData[] = [];
  public mesTipoCambioAnio = new Date().getFullYear();
  public mesTipoCambioMes = new Date().getMonth() + 1;
  public loadingTipoCambioMes = false;

  // Eventos
  @Output() toggleSidebar = new EventEmitter<void>();
  @Input() sidebarCollapsed: boolean = false;

  // Búsqueda
  public searchQuery: string = '';
  public showSearchResults: boolean = false;

  // Modales de consultas Factiliza
  public mostrarModalPlaca = false;
  public mostrarModalSoat = false;
  /** Cantidad de vehículos con SOAT vencido (para notificación en menú) */
  public soatVencidoCount = 0;
  private soatVencidoToastYaMostrado = false;

  /** Tarjeta de perfil: enlaces según plan SaaS (Factiliza placa/SOAT desde profesional; demo + arqueo). */
  public mostrarPlacaSoatTarjeta = true;
  public mostrarMiPerfilSuscripcion = false;
  public mostrarArqueoCajaTarjeta = false;
  private planSuscripcionCode: string | null = null;
  private ultimaEmpresaMiEstado: string | null = null;
  private miEstadoSuscripcionEnVuelo = false;
  private bannerNavSub?: Subscription;

  constructor(
    private router: Router,
    public authService: AuthService,
    private permisosService: PermisosService,
    private tipoCambioService: TipoCambioService,
    private vehiculosService: VehiculosService,
    private cdr: ChangeDetectorRef,
    private deploymentContext: DeploymentContextService,
    private saasSubscription: SaasSubscriptionService,
    private appBanner: AppBannerService
  ) {
    // Efecto para actualizar datos del usuario cuando cambien
    effect(() => {
      const userData = this.authService.userData();
      if (userData) {
        this.userName = userData.nombres || 'Usuario';
        this.userRole = userData.rol || '';
        this.empresaNombre = userData.razonSocial || '';
        this.isAuthenticated = true;
        this.cargarTipoCambio();
        this.cargarSoatVencidoCount(true);
        this.appBanner.refrescar();
      } else {
        this.userName = '';
        this.userRole = '';
        this.empresaNombre = '';
        this.isAuthenticated = false;
        this.appBanner.limpiar();
        this.tipoCambio = null;
        this.ultimaEmpresaMiEstado = null;
        this.planSuscripcionCode = null;
        this.miEstadoSuscripcionEnVuelo = false;
        this.mostrarPlacaSoatTarjeta = true;
        this.mostrarMiPerfilSuscripcion = false;
        this.mostrarArqueoCajaTarjeta = false;
      }
    });

    effect(() => {
      const userData = this.authService.userData();
      this.permisosService.permisos();
      if (!userData) {
        return;
      }
      this.deploymentContext.cargarSiNecesario().subscribe((cfg) => {
        const dm = cfg?.deploymentMode || 'enterprise';
        if (dm !== 'saas') {
          this.ultimaEmpresaMiEstado = null;
          this.planSuscripcionCode = null;
          this.miEstadoSuscripcionEnVuelo = false;
          this.mostrarPlacaSoatTarjeta = true;
          this.mostrarMiPerfilSuscripcion = false;
          this.mostrarArqueoCajaTarjeta = false;
          this.cdr.markForCheck();
          return;
        }
        this.mostrarMiPerfilSuscripcion = true;
        const emp = (userData.idEmpresa || '').toString();
        const debePedirEstado = emp && emp !== this.ultimaEmpresaMiEstado && !this.miEstadoSuscripcionEnVuelo;
        if (debePedirEstado) {
          this.mostrarPlacaSoatTarjeta = false;
          this.mostrarArqueoCajaTarjeta = false;
          this.miEstadoSuscripcionEnVuelo = true;
          this.saasSubscription.getMiEstado().subscribe({
            next: (r) => {
              this.miEstadoSuscripcionEnVuelo = false;
              this.ultimaEmpresaMiEstado = emp;
              this.planSuscripcionCode = r.suscripcion?.planCode ?? null;
              this.aplicarFlagsTarjetaPerfil(r.deploymentMode, this.planSuscripcionCode, userData);
              this.cdr.markForCheck();
            },
            error: () => {
              this.miEstadoSuscripcionEnVuelo = false;
              this.planSuscripcionCode = null;
              this.mostrarPlacaSoatTarjeta = false;
              this.mostrarArqueoCajaTarjeta = false;
              this.cdr.markForCheck();
            }
          });
        } else if (this.ultimaEmpresaMiEstado === emp && this.ultimaEmpresaMiEstado) {
          this.aplicarFlagsTarjetaPerfil(dm, this.planSuscripcionCode, userData);
          this.cdr.markForCheck();
        }
      });
    });
  }

  private aplicarFlagsTarjetaPerfil(
    deploymentMode: string,
    planCode: string | null,
    userData: { rol: string }
  ): void {
    this.mostrarPlacaSoatTarjeta = tarjetaPermiteConsultaPlacaSoat(deploymentMode, planCode);
    const esAdmin = (userData.rol || '').trim() === 'Administrador';
    const perms = this.permisosService.permisos();
    this.mostrarArqueoCajaTarjeta =
      tarjetaMostrarArqueoDemoPlan(deploymentMode, planCode) && puedeVerArqueoCaja(esAdmin, perms);
  }

  ngOnInit(): void {
    // Inicializar el servicio de autenticación
    this.authService.initialize();
    // Cargar tipo de cambio tras dar tiempo a que verifyToken complete (por si el effect no disparó)
    setTimeout(() => {
      if (this.isAuthenticated) this.cargarTipoCambio();
    }, 600);
    // Cargar notificaciones (ejemplo)
    this.cargarNotificaciones();

    this.bannerNavSub = this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        throttleTime(90_000, asyncScheduler, { leading: true, trailing: true })
      )
      .subscribe(() => {
        if (this.isAuthenticated) {
          this.appBanner.refrescar();
        }
      });

    setTimeout(() => {
      if (this.isAuthenticated) {
        this.appBanner.refrescar();
      }
    }, 1600);
  }

  ngOnDestroy(): void {
    this.bannerNavSub?.unsubscribe();
  }

  private cargarSoatVencidoCount(mostrarToast = false): void {
    this.vehiculosService.listarVehiculosSoatVencido().subscribe({
      next: (res) => {
        const list = res?.data || [];
        this.soatVencidoCount = list.length;
        if (this.soatVencidoCount > 0 && mostrarToast && !this.soatVencidoToastYaMostrado && typeof iziToast !== 'undefined') {
          this.soatVencidoToastYaMostrado = true;
          iziToast.warning({
            title: 'SOAT vencido',
            message: `Tiene ${this.soatVencidoCount} vehículo(s) con SOAT vencido. Ver en Mi perfil → Consultar placa.`,
            position: 'topRight'
          });
        }
        this.cdr.markForCheck();
      },
      error: () => { this.soatVencidoCount = 0; }
    });
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
    this.appBanner.limpiar();
    this.permisosService.limpiarPermisos();
    this.authService.forceLogout();
  }

  /**
   * Navega al perfil del usuario
   */
  navigateToProfile(): void {
    this.router.navigate(['/perfil']);
  }

  abrirModalPlaca(): void {
    this.mostrarModalPlaca = true;
  }

  onCerrarModalPlaca(): void {
    this.mostrarModalPlaca = false;
    this.cargarSoatVencidoCount(false);
  }

  abrirModalSoat(): void {
    this.mostrarModalSoat = true;
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
   * Carga tipo de cambio del día (solo si empresa autorizada)
   */
  private cargarTipoCambio(): void {
    this.tipoCambioService.getTipoCambioDia().subscribe(data => {
      this.tipoCambio = data;
      this.cdr.markForCheck();
    });
  }

  toggleTipoCambioDropdown(): void {
    this.showTipoCambioDropdown = !this.showTipoCambioDropdown;
    if (this.showTipoCambioDropdown) {
      const now = new Date();
      this.mesTipoCambioAnio = now.getFullYear();
      this.mesTipoCambioMes = now.getMonth() + 1;
      this.cargarTipoCambioMes();
    }
    this.cdr.markForCheck();
  }

  cargarTipoCambioMes(): void {
    this.loadingTipoCambioMes = true;
    this.mesTipoCambio = [];
    this.cdr.markForCheck();
    this.tipoCambioService.getTipoCambioMes(this.mesTipoCambioAnio, this.mesTipoCambioMes).subscribe(data => {
      this.mesTipoCambio = data;
      this.loadingTipoCambioMes = false;
      this.cdr.markForCheck();
    }, () => {
      this.loadingTipoCambioMes = false;
      this.cdr.markForCheck();
    });
  }

  prevMesTipoCambio(): void {
    if (this.mesTipoCambioMes === 1) {
      this.mesTipoCambioMes = 12;
      this.mesTipoCambioAnio--;
    } else {
      this.mesTipoCambioMes--;
    }
    this.cargarTipoCambioMes();
  }

  nextMesTipoCambio(): void {
    if (this.mesTipoCambioMes === 12) {
      this.mesTipoCambioMes = 1;
      this.mesTipoCambioAnio++;
    } else {
      this.mesTipoCambioMes++;
    }
    this.cargarTipoCambioMes();
  }

  nombreMes(mes: number): string {
    const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return nombres[mes - 1] || '';
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
