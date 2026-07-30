import { Component, OnInit, signal, effect, OnDestroy } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SidebarStateService } from '../../services/sidebar-state.service';
import { AuthService } from '../../services/auth.service';
import { PermisosService } from '../../services/permisos.service';
import { DashboardService, ResumenDashboard, ResumenDiario } from '../../services/dashboard.service';
import { EmpresaService } from '../../services/empresa.service';
import { SaasSubscriptionService } from '../../services/saas-subscription.service';
import { OnboardingWizardComponent } from '../onboarding/onboarding-wizard/onboarding-wizard.component';
import { PasoOnboarding } from '../../interfaces/onboarding.interface';
import { Chart } from 'chart.js/auto';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule, OnboardingWizardComponent],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css'
})
export class InicioComponent implements OnInit, OnDestroy {

  private routerSub: Subscription | null = null;

  // Onboarding
  pasosOnboarding: PasoOnboarding[] = [];
  onboardingProgreso = 0;
  mostrarOnboarding = false;
  onboardingStorageKey = 'onboarding_oculto';
  public userName: string = 'Usuario';
  public userRole: string = '';

  // Período seleccionado
  public periodoSeleccionado: string = 'Hoy';

  /** Resumen operativo del día */
  public resumenDiario: ResumenDiario | null = null;
  public cargandoResumenDiario = false;

  // KPIs principales
  public ventasTotales: number = 0;
  public utilidadNeta: number = 0;
  public clientesActivos: number = 0;
  public roi: number = 0;

  // Variaciones (cambio respecto al período anterior)
  public ventasVariacion: number = 0;
  public utilidadVariacion: number = 0;
  public clientesVariacion: number = 0;

  // Resumen financiero
  public ingresos: number = 0;
  public costos: number = 0;
  public utilidadBruta: number = 0;
  public gastosOperativos: number = 0;

  // Productos más vendidos
  public productosMasVendidos: any[] = [];

  // Ventas mensuales (12 meses) para el gráfico - compatibilidad
  public ventasMensualesChart: number[] = [];
  public ventasMensualesLabels: string[] = [];
  // Vistas del gráfico de tendencia: porDiaHora | mesPorDia | seisMeses | doceMeses
  public vistaGraficoVentas: 'porDiaHora' | 'mesPorDia' | 'seisMeses' | 'doceMeses' = 'porDiaHora';
  public graficoVentas: { porDiaHora?: { etiquetas: string[]; datos: number[]; leyenda: string }; mesPorDia?: { etiquetas: string[]; datos: number[]; leyenda: string }; seisMeses?: { etiquetas: string[]; datos: number[]; leyenda: string }; doceMeses?: { etiquetas: string[]; datos: number[]; leyenda: string } } | null = null;

  // Alertas y notificaciones
  public alertas: any[] = [];

  // Estado de carga
  public cargandoDatos = signal<boolean>(true);

  /** Empresa gestora: dashboard consolidado + filas por empresa gestionada */
  public esGestora = false;
  public porEmpresaDashboard: { idEmpresa: string; razonSocial: string; resumen: ResumenDashboard }[] = [];

  /** SaaS: aviso si falta completar pago / vincular suscripción */
  public mostrarAlertaSuscripcion = false;

  constructor(
    private router: Router,
    public authService: AuthService,
    private permisosService: PermisosService,
    private dashboardService: DashboardService,
    private empresaService: EmpresaService,
    private saasSubscriptionService: SaasSubscriptionService,
    public sidebarState: SidebarStateService
  ) {
    // Efecto para actualizar datos del usuario
    effect(() => {
      const userData = this.authService.userData();
      if (userData) {
        this.userName = userData.nombres || 'Usuario';
        this.userRole = userData.rol || '';
      }
    });
  }

  ngOnInit(): void {
    this.onboardingStorageKey = `onboarding_oculto_${this.authService.userData()?.idEmpresa ?? 'empresa'}`;

    this.saasSubscriptionService.getMiEstado().subscribe({
      next: (r) => {
        if (r.deploymentMode === 'saas' && r.suscripcion?.estado === 'PENDIENTE_PAGO') {
          this.mostrarAlertaSuscripcion = true;
        }
      },
      error: () => {}
    });

    this.cargarEstadoOnboarding();

    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        if (e.urlAfterRedirects === '/home' || e.urlAfterRedirects.startsWith('/home?')) {
          this.cargarEstadoOnboarding(false);
        }
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  cargarEstadoOnboarding(refrescarDashboard = true): void {
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (res) => {
        const data = res?.data;
        this.esGestora = !!data?.esGestora;
        this.pasosOnboarding = Array.isArray(data?.pasosOnboarding) ? data.pasosOnboarding : [];
        this.onboardingProgreso = Number(data?.onboardingProgreso) || 0;
        this.mostrarOnboarding = !!data?.mostrarOnboarding && !this.esGestora;
        if (refrescarDashboard) {
          this.initializeDashboard();
        }
      },
      error: () => {
        this.esGestora = false;
        this.mostrarOnboarding = false;
        if (refrescarDashboard) {
          this.initializeDashboard();
        }
      }
    });
  }

  // Información del usuario
  private initializeDashboard(): void {
    this.cargandoDatos.set(true);
    
    // Cargar permisos del usuario
    this.permisosService.cargarPermisosUsuario().subscribe({
      next: () => {
        // Cargar datos del dashboard
        this.cargarDatosDashboard();
      },
      error: (error) => {
        console.error('Error al cargar permisos:', error);
        this.cargarDatosDashboard();
      }
    });
  }

  /**
   * Carga los datos del dashboard
   */
  private aplicarResumenDashboard(d: ResumenDashboard | null | undefined): void {
    if (d) {
      this.ventasTotales = Number(d.ventasTotales) || 0;
      this.utilidadNeta = Number(d.utilidadNeta) || 0;
      this.clientesActivos = Number(d.clientesActivos) || 0;
      this.roi = Number(d.roi) || 0;
      this.ventasVariacion = Number(d.ventasVariacion) || 0;
      this.utilidadVariacion = Number(d.utilidadVariacion) || 0;
      this.clientesVariacion = Number(d.clientesVariacion) || 0;
      this.ingresos = Number(d.ingresos) || 0;
      this.costos = Number(d.costos) || 0;
      this.utilidadBruta = Number(d.utilidadBruta) || 0;
      this.gastosOperativos = Number(d.gastosOperativos) || 0;
      this.productosMasVendidos = Array.isArray(d.productosMasVendidos) ? d.productosMasVendidos : [];
      this.ventasMensualesChart = Array.isArray(d.ventasMensuales) && d.ventasMensuales.length >= 12
        ? d.ventasMensuales.slice(0, 12)
        : (Array.isArray(d.ventasMensuales) ? d.ventasMensuales : []);
      this.ventasMensualesLabels = Array.isArray(d.ventasMensualesLabels) ? d.ventasMensualesLabels : [];
      this.graficoVentas = d.graficoVentas || null;
      this.alertas = Array.isArray(d.alertas) ? d.alertas : [];
    }
  }

  private cargarDatosDashboard(): void {
    this.cargandoDatos.set(true);
    this.porEmpresaDashboard = [];
    this.cargarResumenDiario();

    if (this.esGestora) {
      this.dashboardService.obtenerResumenConsolidado(this.periodoSeleccionado).subscribe({
        next: (response) => {
          const payload = response.data;
          if (payload?.consolidado) {
            this.aplicarResumenDashboard(payload.consolidado);
          }
          this.porEmpresaDashboard = Array.isArray(payload?.porEmpresa) ? payload.porEmpresa : [];
          this.cargandoDatos.set(false);
          setTimeout(() => this.createCharts(), 100);
        },
        error: (error) => {
          console.error('Error al cargar dashboard consolidado:', error);
          this.dashboardService.obtenerResumen(this.periodoSeleccionado).subscribe({
            next: (response) => {
              this.aplicarResumenDashboard(response.data);
              this.cargandoDatos.set(false);
              setTimeout(() => this.createCharts(), 100);
            },
            error: () => {
              this.cargandoDatos.set(false);
              this.ventasTotales = 0;
              this.ventasMensualesChart = [];
            }
          });
        }
      });
      return;
    }

    this.dashboardService.obtenerResumen(this.periodoSeleccionado).subscribe({
      next: (response) => {
        this.aplicarResumenDashboard(response.data);
        this.cargandoDatos.set(false);
        setTimeout(() => this.createCharts(), 100);
      },
      error: (error) => {
        console.error('Error al cargar dashboard:', error);
        this.cargandoDatos.set(false);
        this.ventasTotales = 0;
        this.utilidadNeta = 0;
        this.ingresos = 0;
        this.costos = 0;
        this.utilidadBruta = 0;
        this.gastosOperativos = 0;
        this.ventasMensualesChart = [];
      }
    });
  }

  /**
   * Cambia la vista del gráfico de tendencia de ventas y redibuja
   */
  cambiarVistaGraficoVentas(vista: 'porDiaHora' | 'mesPorDia' | 'seisMeses' | 'doceMeses'): void {
    this.vistaGraficoVentas = vista;
    this.createCharts();
  }

  /**
   * Obtiene la etiqueta del dropdown para la vista actual del gráfico
   */
  get etiquetaVistaGrafico(): string {
    const map: Record<string, string> = {
      porDiaHora: 'Por día (Hora)',
      mesPorDia: 'Mes (Por día)',
      seisMeses: '6 meses (Por mes)',
      doceMeses: '12 meses (Por mes)'
    };
    return map[this.vistaGraficoVentas] || '12 meses (Por mes)';
  }

  /**
   * Crea los gráficos del dashboard
   */
  private createCharts(): void {
    const existingChart = Chart.getChart("ventasChart");
    if (existingChart) {
      existingChart.destroy();
    }

    const vista = this.vistaGraficoVentas;
    let chartLabels: string[];
    let chartData: number[];
    let leyendaTexto: string;

    if (this.graficoVentas && this.graficoVentas[vista]) {
      const v = this.graficoVentas[vista]!;
      chartLabels = v.etiquetas || [];
      chartData = v.datos || [];
      leyendaTexto = v.leyenda || 'Ventas';
    } else {
      chartLabels = this.ventasMensualesLabels.length >= 12 ? this.ventasMensualesLabels : ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      chartData = this.ventasMensualesChart.length >= 12 ? this.ventasMensualesChart : [...this.ventasMensualesChart, ...Array(12 - this.ventasMensualesChart.length).fill(0)];
      leyendaTexto = 'Por mes';
    }

    const ventasData = {
      labels: chartLabels,
      datasets: [{
        label: `Ventas (S/) - ${leyendaTexto}`,
        data: chartData,
        backgroundColor: "rgba(102, 126, 234, 0.1)",
        borderColor: "rgba(102, 126, 234, 1)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "rgba(102, 126, 234, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    };

    const chartOptions: Record<string, unknown> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            label: (context: { parsed?: { y?: number | null } }) => {
              const y = context.parsed?.y ?? 0;
              return 'S/ ' + Number(y).toLocaleString('es-PE');
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value: number | string) {
              const n = typeof value === 'number' ? value : parseFloat(String(value));
              return 'S/ ' + (n / 1000).toFixed(0) + 'k';
            }
          },
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        },
        x: { grid: { display: false } }
      }
    };

    const ctx = document.getElementById("ventasChart") as HTMLCanvasElement;
    if (ctx) {
      new Chart(ctx, {
        type: "line",
        data: ventasData,
        options: chartOptions as object
      });
    }
  }

  /**
   * Navega a un módulo específico
   */
  navigateTo(module: string): void {
    const routes: { [key: string]: string } = {
      'dashboard': '/home',
      'caja': '/caja',
      'creditos': '/creditos',
      'analisis': '/analisis',
      'ventas': '/ventas',
      'ventas-create': '/ventas/create',
      'ventas-rapida': '/ventas/rapida',
      'compras': '/compras',
      'compras-create': '/compras/create',
      'inventario': '/inventario',
      'clientes': '/clientes',
      'configuracion': '/configuracion',
      'reportes': '/reportes',
      'productos': '/productos'
    };

    if (routes[module]) {
      this.router.navigate([routes[module]]);
    } else {
      console.warn('Módulo no encontrado:', module);
    }
  }

  /**
   * Carga el resumen operativo del día (siempre datos de hoy).
   */
  private cargarResumenDiario(): void {
    if (this.esGestora) {
      this.resumenDiario = null;
      return;
    }
    this.cargandoResumenDiario = true;
    this.dashboardService.obtenerResumenDiario().subscribe({
      next: (response) => {
        this.resumenDiario = response.data ?? null;
        this.cargandoResumenDiario = false;
      },
      error: (error) => {
        console.error('Error al cargar resumen diario:', error);
        this.resumenDiario = null;
        this.cargandoResumenDiario = false;
      }
    });
  }

  /** Etiqueta legible de la fecha del resumen diario */
  get etiquetaFechaResumen(): string {
    if (!this.resumenDiario?.fecha) return 'Hoy';
    const partes = this.resumenDiario.fecha.split('-');
    if (partes.length !== 3) return this.resumenDiario.fecha;
    const d = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    return d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /**
   * Refresca los datos del dashboard
   */
  refreshData(): void {
    this.cargarDatosDashboard();
  }

  /**
   * Cambia el período del dashboard
   */
  cambiarPeriodo(periodo: string): void {
    this.periodoSeleccionado = periodo;
    this.cargarDatosDashboard();
  }

  /**
   * Obtiene la clase CSS según el tipo de alerta
   */
  getAlertClass(tipo: string): string {
    const classes: { [key: string]: string } = {
      'warning': 'alert-warning',
      'success': 'alert-success',
      'info': 'alert-info',
      'danger': 'alert-danger'
    };
    return classes[tipo] || 'alert-info';
  }

  /**
   * Obtiene el color del icono según el tipo
   */
  getAlertIconColor(tipo: string): string {
    const colors: { [key: string]: string } = {
      'warning': 'text-warning',
      'success': 'text-success',
      'info': 'text-info',
      'danger': 'text-danger'
    };
    return colors[tipo] || 'text-info';
  }
}
