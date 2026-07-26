import { Component, OnInit, OnDestroy, effect, Output, EventEmitter, Input, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Subscription, filter, throttleTime, asyncScheduler } from 'rxjs';
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
import { ConsultarPlacaModalOpenerService } from '../../services/consultar-placa-modal-opener.service';
import { SidebarStateService } from '../../services/sidebar-state.service';
import { NotificacionesService } from '../../services/notificaciones.service';
import { NotificacionItem } from '../../models/notificacion.model';
import { EmpresaService } from '../../services/empresa.service';
import { AyudaTutorialesModalComponent } from './ayuda-tutoriales-modal/ayuda-tutoriales-modal.component';

declare const iziToast: any;

@Component({
  selector: 'app-topnav',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    ConsultarPlacaModalComponent,
    ConsultarSoatModalComponent,
    AppBannerRibbonComponent,
    AyudaTutorialesModalComponent
  ],
  templateUrl: './topnav.component.html',
  styleUrl: './topnav.component.css'
})
export class TopnavComponent implements OnInit, OnDestroy {
  // Datos del usuario
  public userName: string = '';
  public empresaNombre: string = '';
  public empresaLogo: string = '';
  public isAuthenticated: boolean = false;

  // Notificaciones (dashboard + SOAT)
  public notificaciones: NotificacionItem[] = [];
  public notificacionesCount = 0;

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

  // Modales de consultas Factiliza
  public mostrarModalPlaca = false;
  public mostrarModalSoat = false;
  /** Centro de ayuda / tutoriales (manuales PDF) */
  public mostrarModalAyuda = false;
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
  public esGestora = false;
  private bannerNavSub?: Subscription;
  private placaModalOpenSub?: Subscription;

  constructor(
    private router: Router,
    public authService: AuthService,
    private permisosService: PermisosService,
    private tipoCambioService: TipoCambioService,
    private vehiculosService: VehiculosService,
    private cdr: ChangeDetectorRef,
    private deploymentContext: DeploymentContextService,
    private saasSubscription: SaasSubscriptionService,
    private appBanner: AppBannerService,
    private consultarPlacaOpener: ConsultarPlacaModalOpenerService,
    private sidebarState: SidebarStateService,
    public notificacionesService: NotificacionesService,
    private empresaService: EmpresaService
  ) {
    // Efecto para actualizar datos del usuario cuando cambien
    effect(() => {
      const userData = this.authService.userData();
      if (userData) {
        this.userName = userData.nombres || 'Usuario';
        this.empresaNombre = userData.razonSocial || '';
        this.isAuthenticated = true;
        this.cargarTipoCambio();
        this.cargarEstadoConfiguracion();
        this.cargarSoatVencidoCount(true);
        this.appBanner.refrescar();
        this.notificacionesService.refrescar();
      } else {
        this.userName = '';
        this.empresaNombre = '';
        this.isAuthenticated = false;
        this.esGestora = false;
        this.appBanner.limpiar();
        this.notificacionesService.limpiar();
        this.syncNotificacionesUi();
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

    effect(() => {
      this.notificacionesService.items();
      this.notificacionesService.noLeidasCount();
      this.syncNotificacionesUi();
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

    this.bannerNavSub = this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        throttleTime(90_000, asyncScheduler, { leading: true, trailing: true })
      )
      .subscribe(() => {
        if (this.isAuthenticated) {
          this.appBanner.refrescar();
          this.notificacionesService.refrescar();
        }
      });

    setTimeout(() => {
      if (this.isAuthenticated) {
        this.appBanner.refrescar();
        this.notificacionesService.refrescar();
      }
    }, 1600);

    this.placaModalOpenSub = this.consultarPlacaOpener.openRequested$.subscribe(() => {
      this.mostrarModalPlaca = true;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.bannerNavSub?.unsubscribe();
    this.placaModalOpenSub?.unsubscribe();
  }

  private cargarEstadoConfiguracion(): void {
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (res) => {
        this.esGestora = res?.data?.esGestora === true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.esGestora = false;
        this.cdr.markForCheck();
      }
    });
  }

  private cargarSoatVencidoCount(mostrarToast = false): void {
    this.vehiculosService.listarVehiculosSoatVencido().subscribe({
      next: (res) => {
        const list = res?.data || [];
        this.soatVencidoCount = list.length;
        if (this.soatVencidoCount > 0) {
          this.notificacionesService.refrescar();
        }
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
    this.sidebarState.requestMobileSidebarToggle();
    this.toggleSidebar.emit();
  }

  /**
   * Cierra sesión
   */
  logout(): void {
    this.appBanner.limpiar();
    this.notificacionesService.limpiar();
    this.syncNotificacionesUi();
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
    this.consultarPlacaOpener.notificarCerrado();
    this.cargarSoatVencidoCount(false);
  }

  abrirModalSoat(): void {
    this.mostrarModalSoat = true;
  }

  abrirModalAyuda(): void {
    this.mostrarModalAyuda = true;
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
    return String(this.authService.userData()?.rol || '').trim() === role;
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

  private syncNotificacionesUi(): void {
    this.notificaciones = this.notificacionesService.items();
    this.notificacionesCount = this.notificacionesService.noLeidasCount();
    this.cdr.markForCheck();
  }

  onAbrirNotificaciones(): void {
    if (this.isAuthenticated) {
      this.notificacionesService.refrescar();
    }
  }

  onNotificacionClick(notif: NotificacionItem, event: Event): void {
    this.notificacionesService.marcarLeida(notif.id);
    if (notif.id === 'soat-vencido') {
      event.preventDefault();
      this.abrirModalPlaca();
      return;
    }
    if (notif.ruta) {
      event.preventDefault();
      this.router.navigateByUrl(notif.ruta);
    }
  }

  marcarComoLeida(id: string): void {
    this.notificacionesService.marcarLeida(id);
  }

  marcarTodasComoLeidas(): void {
    this.notificacionesService.marcarTodasLeidas();
  }

  getNotificacionIcon(tipo: string): string {
    const icons: { [key: string]: string } = {
      warning: 'fas fa-exclamation-triangle text-warning',
      success: 'fas fa-check-circle text-success',
      error: 'fas fa-times-circle text-danger',
      danger: 'fas fa-times-circle text-danger',
      info: 'fas fa-info-circle text-info'
    };
    return icons[tipo] || icons['info'];
  }
}
