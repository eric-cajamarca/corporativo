import { Component, OnInit, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../topnav/topnav.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AuthService } from '../../services/auth.service';
import { PermisosService } from '../../services/permisos.service';

declare var Chart: any;

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [FormsModule, CommonModule, TopnavComponent, SidebarComponent],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css'
})
export class InicioComponent implements OnInit {

  // Estado del sidebar
  sidebarCollapsed = signal<boolean>(false);

  // Información del usuario
  public userName: string = 'Usuario';
  public userRole: string = '';

  // Período seleccionado
  public periodoSeleccionado: string = 'Este Mes';

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

  // Alertas y notificaciones
  public alertas: any[] = [];

  // Estado de carga
  public cargandoDatos = signal<boolean>(true);

  constructor(
    private router: Router,
    public authService: AuthService,
    private permisosService: PermisosService
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
    this.initializeDashboard();
    
    // Verificar preferencia de sidebar
    const collapsed = localStorage.getItem('sidebarCollapsed');
    if (collapsed === 'true') {
      this.sidebarCollapsed.set(true);
    }
  }

  /**
   * Inicializa el dashboard cargando datos
   */
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
  private cargarDatosDashboard(): void {
    // Simular carga de datos (reemplazar con llamadas reales al backend)
    setTimeout(() => {
      // Datos de ejemplo - Reemplazar con datos reales del backend
      this.ventasTotales = 125000;
      this.utilidadNeta = 25000;
      this.clientesActivos = 450;
      this.roi = 18.5;
      
      this.ventasVariacion = 12.5;
      this.utilidadVariacion = 8.2;
      this.clientesVariacion = 5.1;

      this.ingresos = 150000;
      this.costos = 100000;
      this.utilidadBruta = 50000;
      this.gastosOperativos = 25000;

      this.productosMasVendidos = [
        { nombre: 'Cemento Portland', categoria: 'Materiales', ventas: 1250, monto: 25000 },
        { nombre: 'Varilla de Hierro', categoria: 'Acero', ventas: 890, monto: 18000 },
        { nombre: 'Bloques de Concreto', categoria: 'Materiales', ventas: 650, monto: 13000 },
        { nombre: 'Arena Fina', categoria: 'Agregados', ventas: 520, monto: 10400 },
        { nombre: 'Pintura Látex', categoria: 'Pinturas', ventas: 380, monto: 9500 }
      ];

      this.alertas = [
        {
          titulo: 'Stock Bajo',
          mensaje: 'Cemento Portland tiene menos de 50 unidades',
          icono: 'fa-exclamation-triangle',
          tipo: 'warning',
          tiempo: 'Hace 2 horas'
        },
        {
          titulo: 'Pago Pendiente',
          mensaje: 'Cliente ABC debe S/ 2,500 por factura #00125',
          icono: 'fa-clock',
          tipo: 'info',
          tiempo: 'Hace 4 horas'
        },
        {
          titulo: 'Nueva Venta',
          mensaje: 'Venta registrada por S/ 1,250',
          icono: 'fa-check-circle',
          tipo: 'success',
          tiempo: 'Hace 6 horas'
        }
      ];

      this.cargandoDatos.set(false);
      
      // Crear gráficos después de cargar datos
      setTimeout(() => this.createCharts(), 100);
    }, 500);
  }

  /**
   * Crea los gráficos del dashboard
   */
  private createCharts(): void {
    // Verificar si Chart.js está disponible
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js no está disponible');
      return;
    }

    // Destruir gráficos existentes
    const existingChart = Chart.getChart("ventasChart");
    if (existingChart) {
      existingChart.destroy();
    }

    // Datos del gráfico
    const ventasData = {
      labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
      datasets: [{
        label: "Ventas Mensuales (S/)",
        data: [85000, 92000, 88000, 95000, 102000, 115000, 125000, 118000, 132000, 145000, 138000, 150000],
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

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            label: function(context: any) {
              return 'S/ ' + context.parsed.y.toLocaleString('es-PE');
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value: any) {
              return 'S/ ' + (value / 1000).toFixed(0) + 'k';
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
        options: chartOptions
      });
    }
  }

  /**
   * Maneja el evento de toggle del sidebar
   */
  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
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
