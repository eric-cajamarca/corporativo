import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../topnav/topnav.component';

declare var Chart: any;

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [FormsModule, CommonModule, TopnavComponent],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css'
})
export class InicioComponent implements OnInit {

  // Información del usuario
  public userName: string = 'Administrador';
  public userRole: string = 'Administrador';

  // Período seleccionado
  public periodoSeleccionado: string = 'Este Mes';

  // KPIs principales
  public ventasTotales: number = 125000;
  public utilidadNeta: number = 25000;
  public clientesActivos: number = 450;
  public roi: number = 18.5;

  // Resumen financiero
  public ingresos: number = 150000;
  public costos: number = 100000;
  public utilidadBruta: number = 50000;
  public gastosOperativos: number = 25000;

  // Productos más vendidos
  public productosMasVendidos: any[] = [
    { nombre: 'Cemento Portland', categoria: 'Materiales', ventas: 1250, monto: 25000 },
    { nombre: 'Varilla de Hierro', categoria: 'Acero', ventas: 890, monto: 18000 },
    { nombre: 'Bloques de Concreto', categoria: 'Materiales', ventas: 650, monto: 13000 },
    { nombre: 'Arena Fina', categoria: 'Agregados', ventas: 520, monto: 10400 },
    { nombre: 'Pintura Látex', categoria: 'Pinturas', ventas: 380, monto: 9500 }
  ];

  // Alertas y notificaciones
  public alertas: any[] = [
    {
      titulo: 'Stock Bajo',
      mensaje: 'Cemento Portland tiene menos de 50 unidades',
      icono: 'fa-exclamation-triangle',
      tiempo: 'Hace 2 horas'
    },
    {
      titulo: 'Pago Pendiente',
      mensaje: 'Cliente ABC debe S/ 2,500 por factura #00125',
      icono: 'fa-clock',
      tiempo: 'Hace 4 horas'
    },
    {
      titulo: 'Nueva Venta',
      mensaje: 'Venta registrada por S/ 1,250',
      icono: 'fa-check-circle',
      tiempo: 'Hace 6 horas'
    }
  ];

  public token:any = "";
  
  
  constructor(
    private _adminService:AdminService,
    private _router:Router,
    //private _cookieService: CookieService,
  ) { 
    //this.token = this._cookieService.get('token');
  }

  ngOnInit(): void {
    this.initializeDashboard();
    this.setupSidebar();
    this.createCharts();
  }

  private initializeDashboard(): void {
    // Aquí podríamos cargar datos reales del backend
    // Por ahora usamos datos de ejemplo
    console.log('Dashboard inicializado');
  }

  private setupSidebar(): void {
    // Configurar funcionalidad del sidebar
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const closeBtn = document.getElementById('sidebarClose');

    if (closeBtn && overlay) {
      closeBtn.addEventListener('click', () => {
        sidebar?.classList.remove('show');
        overlay?.classList.remove('show');
      });

      overlay.addEventListener('click', () => {
        sidebar?.classList.remove('show');
        overlay?.classList.remove('show');
      });
    }
  }

  private createCharts(): void {
    // Destruir gráficos existentes si los hay
    const existingChart = Chart.getChart("ventasChart");
    if (existingChart) {
      existingChart.destroy();
    }

    // Datos del gráfico de ventas
    const ventasData = {
      labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
      datasets: [{
        label: "Ventas Mensuales (S/)",
        data: [85000, 92000, 88000, 95000, 102000, 115000, 125000, 118000, 132000, 145000, 138000, 150000],
        backgroundColor: "rgba(13, 110, 253, 0.1)",
        borderColor: "rgba(13, 110, 253, 1)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "rgba(13, 110, 253, 1)",
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
        legend: {
          display: false
        },
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
              return 'S/ ' + value.toLocaleString('es-PE');
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      },
      elements: {
        point: {
          hoverBorderWidth: 3
        }
      }
    };

    // Crear el gráfico
    const ctx = document.getElementById("ventasChart") as HTMLCanvasElement;
    if (ctx) {
      new Chart(ctx, {
        type: "line",
        data: ventasData,
        options: chartOptions
      });
    }
  }

  // Métodos públicos
  navigateTo(module: string): void {
    // Aquí implementaríamos la navegación a diferentes módulos
    console.log('Navegando a:', module);

    switch (module) {
      case 'dashboard':
        // Ya estamos aquí
        break;
      case 'caja':
        this._router.navigate(['/caja']);
        break;
      case 'creditos':
        this._router.navigate(['/creditos']);
        break;
      case 'analisis':
        this._router.navigate(['/analisis']);
        break;
      case 'ventas':
        this._router.navigate(['/ventas']);
        break;
      case 'compras':
        this._router.navigate(['/compras']);
        break;
      case 'inventario':
        this._router.navigate(['/inventario']);
        break;
      case 'clientes':
        this._router.navigate(['/clientes']);
        break;
      case 'configuracion':
        this._router.navigate(['/configuracion']);
        break;
      case 'reportes':
        this._router.navigate(['/reportes']);
        break;
      default:
        console.log('Módulo no implementado:', module);
    }
  }

  refreshData(): void {
    // Simular refresh de datos
    console.log('Refrescando datos...');
    this.createCharts();

    // Aquí podríamos recargar datos del backend
    // this.loadDashboardData();
  }

  cambiarPeriodo(periodo: string): void {
    this.periodoSeleccionado = periodo;
    console.log('Cambiando período a:', periodo);

    // Aquí podríamos recargar datos con el nuevo período
    // this.loadDataForPeriod(periodo);
  }
}
