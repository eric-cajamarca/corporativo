import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var Chart: any;

@Component({
  selector: 'app-index-reportes',
  imports: [FormsModule, CommonModule, TopnavComponent],
  templateUrl: './index-reportes.component.html',
  styleUrl: './index-reportes.component.css'
})
export class IndexReportesComponent implements OnInit {

  // Filtros de fecha
  fechaInicio: string = '';
  fechaFin: string = '';
  periodoSeleccionado: string = 'Este Mes';

  // Reportes disponibles
  reportes = [
    {
      id: 'ventas',
      nombre: 'Reporte de Ventas',
      descripcion: 'Análisis detallado de ventas por período',
      icono: 'fas fa-chart-line',
      tipo: 'financiero'
    },
    {
      id: 'compras',
      nombre: 'Reporte de Compras',
      descripcion: 'Resumen de compras y proveedores',
      icono: 'fas fa-shopping-bag',
      tipo: 'compras'
    },
    {
      id: 'inventario',
      nombre: 'Estado del Inventario',
      descripcion: 'Stock actual y movimientos',
      icono: 'fas fa-boxes',
      tipo: 'inventario'
    },
    {
      id: 'clientes',
      nombre: 'Análisis de Clientes',
      descripcion: 'Comportamiento y rentabilidad de clientes',
      icono: 'fas fa-users',
      tipo: 'clientes'
    },
    {
      id: 'creditos',
      nombre: 'Cartera de Créditos',
      descripcion: 'Estado de cuentas por cobrar',
      icono: 'fas fa-hand-holding-usd',
      tipo: 'financiero'
    },
    {
      id: 'financiero',
      nombre: 'Estado Financiero',
      descripcion: 'Balance general y resultados',
      icono: 'fas fa-balance-scale',
      tipo: 'financiero'
    },
    {
      id: 'productos',
      nombre: 'Productos Más Vendidos',
      descripcion: 'Ranking de productos por ventas',
      icono: 'fas fa-star',
      tipo: 'productos'
    },
    {
      id: 'margen',
      nombre: 'Análisis de Márgenes',
      descripcion: 'Rentabilidad por producto y categoría',
      icono: 'fas fa-percentage',
      tipo: 'financiero'
    }
  ];

  // Datos del reporte actual
  reporteActual: any = null;
  datosReporte: any[] = [];
  cargando: boolean = false;

  // Gráficos
  chartVentas: any;
  chartCompras: any;
  chartProductos: any;

  constructor(
    private _adminService: AdminService,
    private _router: Router
  ) {}

  ngOnInit(): void {
    this.inicializarFechas();
    this.cargarReportesPrincipales();
  }

  inicializarFechas(): void {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    this.fechaFin = hoy.toISOString().split('T')[0];
    this.fechaInicio = primerDiaMes.toISOString().split('T')[0];
  }

  cargarReportesPrincipales(): void {
    this.cargando = true;

    // Simular carga de datos
    setTimeout(() => {
      this.datosReporte = [
        {
          periodo: 'Enero 2024',
          ventas: 125000,
          compras: 85000,
          utilidad: 40000,
          clientes: 150
        },
        {
          periodo: 'Febrero 2024',
          ventas: 132000,
          compras: 92000,
          utilidad: 40000,
          clientes: 165
        },
        {
          periodo: 'Marzo 2024',
          ventas: 145000,
          compras: 98000,
          utilidad: 47000,
          clientes: 172
        }
      ];

      this.cargando = false;
      this.crearGraficos();
    }, 1000);
  }

  seleccionarReporte(reporte: any): void {
    this.reporteActual = reporte;
    this.cargarDatosReporte(reporte.id);
  }

  cargarDatosReporte(tipo: string): void {
    this.cargando = true;

    // Simular carga de datos del reporte específico
    setTimeout(() => {
      switch (tipo) {
        case 'ventas':
          this.datosReporte = this.generarDatosVentas();
          break;
        case 'compras':
          this.datosReporte = this.generarDatosCompras();
          break;
        case 'inventario':
          this.datosReporte = this.generarDatosInventario();
          break;
        case 'clientes':
          this.datosReporte = this.generarDatosClientes();
          break;
        case 'creditos':
          this.datosReporte = this.generarDatosCreditos();
          break;
        case 'productos':
          this.datosReporte = this.generarDatosProductos();
          break;
        default:
          this.datosReporte = [];
      }

      this.cargando = false;
      this.actualizarGraficos();
    }, 800);
  }

  // Métodos para generar datos simulados
  generarDatosVentas(): any[] {
    return [
      { fecha: '2024-01-01', total: 25000, productos: 45, clientes: 12 },
      { fecha: '2024-01-02', total: 32000, productos: 52, clientes: 15 },
      { fecha: '2024-01-03', total: 28500, productos: 48, clientes: 14 }
    ];
  }

  generarDatosCompras(): any[] {
    return [
      { proveedor: 'Proveedor A', total: 45000, productos: 25, fecha: '2024-01-01' },
      { proveedor: 'Proveedor B', total: 32000, productos: 18, fecha: '2024-01-02' },
      { proveedor: 'Proveedor C', total: 28000, productos: 22, fecha: '2024-01-03' }
    ];
  }

  generarDatosInventario(): any[] {
    return [
      { producto: 'Cemento Portland', stock: 150, valor: 7500, ubicacion: 'Almacén A' },
      { producto: 'Varilla Hierro', stock: 200, valor: 12000, ubicacion: 'Almacén B' },
      { producto: 'Bloques Concreto', stock: 300, valor: 9000, ubicacion: 'Almacén A' }
    ];
  }

  generarDatosClientes(): any[] {
    return [
      { nombre: 'Cliente A', compras: 125000, ultimoPago: '2024-01-15', deuda: 0 },
      { nombre: 'Cliente B', compras: 98000, ultimoPago: '2024-01-10', deuda: 2500 },
      { nombre: 'Cliente C', compras: 156000, ultimoPago: '2024-01-20', deuda: 0 }
    ];
  }

  generarDatosCreditos(): any[] {
    return [
      { cliente: 'Cliente A', monto: 15000, fecha: '2024-01-01', vencimiento: '2024-02-01', estado: 'Pendiente' },
      { cliente: 'Cliente B', monto: 25000, fecha: '2024-01-05', vencimiento: '2024-02-05', estado: 'Pagado' },
      { cliente: 'Cliente C', monto: 18000, fecha: '2024-01-10', vencimiento: '2024-02-10', estado: 'Vencido' }
    ];
  }

  generarDatosProductos(): any[] {
    return [
      { nombre: 'Cemento Portland', ventas: 1250, monto: 25000, margen: 15.5 },
      { nombre: 'Varilla Hierro', ventas: 890, monto: 18000, margen: 12.3 },
      { nombre: 'Bloques Concreto', ventas: 650, monto: 13000, margen: 18.7 }
    ];
  }

  crearGraficos(): void {
    this.crearGraficoVentas();
    this.crearGraficoCompras();
    this.crearGraficoProductos();
  }

  crearGraficoVentas(): void {
    const ctx = document.getElementById('chartVentas') as HTMLCanvasElement;
    if (ctx) {
      if (this.chartVentas) {
        this.chartVentas.destroy();
      }

      this.chartVentas = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
          datasets: [{
            label: 'Ventas (S/)',
            data: [125000, 132000, 145000, 138000, 152000, 165000],
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  }

  crearGraficoCompras(): void {
    const ctx = document.getElementById('chartCompras') as HTMLCanvasElement;
    if (ctx) {
      if (this.chartCompras) {
        this.chartCompras.destroy();
      }

      this.chartCompras = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Proveedor A', 'Proveedor B', 'Proveedor C', 'Proveedor D'],
          datasets: [{
            label: 'Compras (S/)',
            data: [45000, 32000, 28000, 35000],
            backgroundColor: '#e74c3c',
            borderColor: '#c0392b',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  }

  crearGraficoProductos(): void {
    const ctx = document.getElementById('chartProductos') as HTMLCanvasElement;
    if (ctx) {
      if (this.chartProductos) {
        this.chartProductos.destroy();
      }

      this.chartProductos = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Cemento', 'Varilla', 'Bloques', 'Pintura', 'Otros'],
          datasets: [{
            data: [35, 25, 20, 12, 8],
            backgroundColor: [
              '#3498db',
              '#e74c3c',
              '#27ae60',
              '#f39c12',
              '#9b59b6'
            ]
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }
  }

  actualizarGraficos(): void {
    // Actualizar gráficos según el reporte seleccionado
    if (this.reporteActual) {
      this.actualizarGraficosPorTipo(this.reporteActual.id);
    }
  }

  actualizarGraficosPorTipo(tipo: string): void {
    // Lógica para actualizar gráficos según el tipo de reporte
    console.log('Actualizando gráficos para:', tipo);
  }

  cambiarPeriodo(periodo: string): void {
    this.periodoSeleccionado = periodo;
    // Recargar datos según el período
    this.cargarReportesPrincipales();
  }

  getObjectKeys(obj: any): string[] {
    return Object.keys(obj);
  }

  isCurrencyField(key: string): boolean {
    const currencyFields = ['total', 'monto', 'compras', 'ventas', 'utilidad', 'valor', 'deuda'];
    return currencyFields.includes(key);
  }

  exportarReporte(formato: string): void {
    console.log(`Exportando reporte en formato: ${formato}`);
    // Lógica para exportar
  }

  imprimirReporte(): void {
    window.print();
  }

  navigateTo(module: string): void {
    console.log('Navegando a:', module);

    switch (module) {
      case 'dashboard':
        this._router.navigate(['/home']);
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
        // Ya estamos aquí
        break;
      default:
        console.log('Módulo no implementado:', module);
    }
  }
}