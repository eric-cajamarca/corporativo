import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import {
  DashboardService,
  ResumenDashboard,
} from '../../../services/dashboard.service';
import {
  UtilidadesService,
  FilaUtilidad,
} from '../../../services/utilidades.service';
import { PdfService } from '../../../services/pdf.service';
import { ExcelService } from '../../../services/excel.service';
import { EmpresaService } from '../../../services/empresa.service';
import { Empresa as EmpresaPdf } from '../../../interfaces/pdf-interface';
import { formatFechaLocal, getFechaHoyLocal } from '../../../utils/fecha-local.util';
import { PackReportesNegocio, ReportesNegocioPdfService } from '../../../services/reportes-negocio-pdf.service';
import {
  ReportesService,
  CompraProveedorItem,
  InventarioResumenItem,
  ClienteRentabilidadItem,
  CarteraCreditosResumen,
} from '../../../services/reportes.service';
import { Chart } from 'chart.js/auto';

declare var iziToast: { success: (o: object) => void; error: (o: object) => void };

type ReporteId =
  | 'ventas'
  | 'compras'
  | 'inventario'
  | 'clientes'
  | 'creditos'
  | 'financiero'
  | 'productos'
  | 'margen';

interface ReporteConfig {
  id: ReporteId;
  nombre: string;
  descripcion: string;
  icono: string;
  tipo: 'financiero' | 'compras' | 'inventario' | 'clientes' | 'productos' | 'creditos';
}

type DatosReporteRow = Record<string, unknown>;

@Component({
  selector: 'app-index-reportes',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './index-reportes.component.html',
  styleUrl: './index-reportes.component.css'
})
export class IndexReportesComponent implements OnInit {
  public sidebarState = inject(SidebarStateService);
  private dashboardService = inject(DashboardService);
  private utilidadesService = inject(UtilidadesService);
  private pdfService = inject(PdfService);
  private excelService = inject(ExcelService);
  private reportesService = inject(ReportesService);
  private empresaService = inject(EmpresaService);
  private reportesNegocioPdf = inject(ReportesNegocioPdfService);

  generandoInformePdf = false;
  empresaPdf: EmpresaPdf | null = null;
  private cachedPack: PackReportesNegocio | null = null;
  private cachedPackKey: string | null = null;

  // Filtros de fecha
  fechaInicio: string = '';
  fechaFin: string = '';
  periodoSeleccionado: string = 'Este Mes';
  error: string = '';

  // Reportes disponibles
  reportes: ReporteConfig[] = [
    {
      id: 'ventas',
      nombre: 'Reporte de Ventas',
      descripcion: 'Análisis detallado de ventas por período',
      icono: 'bi bi-graph-up-arrow',
      tipo: 'financiero',
    },
    {
      id: 'compras',
      nombre: 'Reporte de Compras',
      descripcion: 'Resumen de compras y proveedores',
      icono: 'bi bi-bag-check',
      tipo: 'compras',
    },
    {
      id: 'inventario',
      nombre: 'Estado del Inventario',
      descripcion: 'Stock actual y movimientos',
      icono: 'bi bi-box-seam',
      tipo: 'inventario',
    },
    {
      id: 'clientes',
      nombre: 'Análisis de Clientes',
      descripcion: 'Comportamiento y rentabilidad de clientes',
      icono: 'bi bi-people',
      tipo: 'clientes',
    },
    {
      id: 'creditos',
      nombre: 'Cartera de Créditos',
      descripcion: 'Estado de cuentas por cobrar',
      icono: 'bi bi-cash-coin',
      tipo: 'creditos',
    },
    {
      id: 'financiero',
      nombre: 'Estado Financiero',
      descripcion: 'Ingresos, costos y utilidad bruta',
      icono: 'bi bi-cash-stack',
      tipo: 'financiero',
    },
    {
      id: 'productos',
      nombre: 'Productos Más Vendidos',
      descripcion: 'Ranking de productos por ventas',
      icono: 'bi bi-star-fill',
      tipo: 'productos',
    },
    {
      id: 'margen',
      nombre: 'Análisis de Márgenes',
      descripcion: 'Rentabilidad por producto y categoría',
      icono: 'bi bi-percent',
      tipo: 'financiero',
    }];

  // Datos del reporte actual
  reporteActual: ReporteConfig | null = null;
  datosReporte: DatosReporteRow[] = [];
  cargando: boolean = false;

  resumenCreditos: CarteraCreditosResumen | null = null;

  // Resumen principal del dashboard
  resumenDashboard: ResumenDashboard | null = null;

  // Gráficos
  chartVentas: any;
  chartCompras: any;
  chartProductos: any;

  constructor(
    private _router: Router
  ) {}

  ngOnInit(): void {
    this.inicializarFechas();
    this.cargarEmpresaPdf();
    this.cargarReportesPrincipales();
  }

  private cargarEmpresaPdf(): void {
    this.empresaService.getEmpresa$().subscribe((emp) => {
      const e = emp as {
        razon_Social?: string;
        nombreComercial?: string;
        nombre?: string;
        ruc?: string;
        direccion?: string;
        telefono?: string;
        logo?: string;
      };
      if (emp) {
        const nombre = e.razon_Social || e.nombreComercial || e.nombre || '';
        this.empresaPdf = {
          logo: e.logo || '',
          nombre,
          ruc: e.ruc || '',
          direccion: e.direccion || '',
          telefono: e.telefono || ''
        };
      }
    });
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }

  inicializarFechas(): void {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.fechaFin = getFechaHoyLocal();
    this.fechaInicio = formatFechaLocal(primerDiaMes);
  }

  aplicarFiltroFechas(): void {
    this.cargarReportesPrincipales();
    if (this.reporteActual) {
      this.cargarDatosReporte(this.reporteActual.id);
    }
    this.cachedPack = null;
    this.cachedPackKey = null;
  }

  cargarReportesPrincipales(): void {
    this.error = '';
    this.cargando = true;
    this.dashboardService.obtenerResumen(this.periodoSeleccionado).subscribe({
      next: (res) => {
        this.resumenDashboard = res.data;
        this.cargando = false;
        setTimeout(() => this.crearGraficos(), 100);
      },
      error: (err) => {
        this.error =
          err?.error?.message ||
          err?.message ||
          'Error al cargar el resumen de reportes';
        this.resumenDashboard = null;
        this.cargando = false;
      },
    });
  }

  seleccionarReporte(reporte: ReporteConfig): void {
    this.reporteActual = reporte;
    this.cargarDatosReporte(reporte.id);
  }

  cargarDatosReporte(tipo: string): void {
    this.cargando = true;
    this.error = '';
    this.datosReporte = [];

    switch (tipo as ReporteId) {
      case 'ventas': {
        if (
          this.resumenDashboard &&
          this.resumenDashboard.graficoVentas?.mesPorDia
        ) {
          const serie = this.resumenDashboard.graficoVentas.mesPorDia;
          this.datosReporte = serie.etiquetas.map((label, index) => ({
            periodo: label,
            ventas: serie.datos[index] ?? 0,
          }));
        }
        this.cargando = false;
        this.actualizarGraficos();
        break;
      }
      case 'productos': {
        if (this.resumenDashboard?.productosMasVendidos) {
          this.datosReporte = this.resumenDashboard.productosMasVendidos.map(
            (p) => ({
              nombre: p.nombre,
              categoria: p.categoria,
              ventas: p.ventas,
              monto: p.monto,
            })
          );
        }
        this.cargando = false;
        this.actualizarGraficos();
        break;
      }
      case 'financiero':
      case 'margen': {
        const tipoPeriodoBack = this.mapPeriodoAUtilidades();
        this.utilidadesService
          .getUtilidades(tipoPeriodoBack, this.fechaInicio, this.fechaFin)
          .subscribe({
            next: (res) => {
              this.datosReporte = (res.data || []).map((row: FilaUtilidad) => ({
                periodo: row.periodo,
                ingresos: row.ingresos,
                costos: row.costos,
                utilidadBruta: row.utilidadBruta,
              }));
              this.cargando = false;
              this.actualizarGraficos();
            },
            error: (err) => {
              this.error =
                err?.error?.message ||
                err?.message ||
                'Error al cargar utilidades';
              this.datosReporte = [];
              this.cargando = false;
            },
          });
        break;
      }
      case 'compras': {
        this.reportesService
          .obtenerComprasPorProveedor(this.fechaInicio, this.fechaFin)
          .subscribe({
            next: (res) => {
              const data = res.data || [];
              this.datosReporte = data.map((row: CompraProveedorItem) => ({
                proveedor: row.proveedor,
                numeroCompras: row.numeroCompras,
                totalCompras: row.totalCompras,
                totalItems: row.totalItems,
              }));
              this.actualizarGraficoComprasDesdeDatos(data);
              this.cargando = false;
            },
            error: (err) => {
              this.error =
                err?.error?.message ||
                err?.message ||
                'Error al obtener compras por proveedor';
              this.datosReporte = [];
              this.cargando = false;
            },
          });
        break;
      }
      case 'inventario': {
        this.reportesService.obtenerInventarioResumen().subscribe({
          next: (res) => {
            const data = res.data || [];
            this.datosReporte = data.map((row: InventarioResumenItem) => ({
              codigo: row.codigo,
              producto: row.nombreProducto,
              categoria: row.categoria,
              stockTotal: row.stockTotal,
              valorInventario: row.valorInventario,
            }));
            this.cargando = false;
            this.actualizarGraficos();
          },
          error: (err) => {
            this.error =
              err?.error?.message ||
              err?.message ||
              'Error al obtener resumen de inventario';
            this.datosReporte = [];
            this.cargando = false;
          },
        });
        break;
      }
      case 'clientes': {
        this.reportesService
          .obtenerClientesRentabilidad(this.fechaInicio, this.fechaFin)
          .subscribe({
            next: (res) => {
              const data = res.data || [];
              this.datosReporte = data.map((row: ClienteRentabilidadItem) => ({
                cliente: row.cliente,
                comprasTotales: row.comprasTotales,
                numeroVentas: row.numeroVentas,
                ticketPromedio: row.ticketPromedio,
                ultimaCompra: row.ultimaCompra,
                deudaPendiente: row.deudaPendiente,
              }));
              this.cargando = false;
              this.actualizarGraficos();
            },
            error: (err) => {
              this.error =
                err?.error?.message ||
                err?.message ||
                'Error al obtener análisis de clientes';
              this.datosReporte = [];
              this.cargando = false;
            },
          });
        break;
      }
      case 'creditos': {
        this.reportesService.obtenerCarteraCreditos().subscribe({
          next: (res) => {
            this.resumenCreditos = res.data || null;
            const r = this.resumenCreditos;
            if (r) {
              this.datosReporte = [
                {
                  indicador: 'Total créditos',
                  valor: r.totalCreditos,
                },
                {
                  indicador: 'Monto total créditos',
                  valor: r.montoTotalCreditos,
                },
                {
                  indicador: 'Créditos activos',
                  valor: r.creditosActivos,
                },
                {
                  indicador: 'Saldo pendiente total',
                  valor: r.saldoPendienteTotal,
                },
                {
                  indicador: 'Total cobrado',
                  valor: r.totalCobrado,
                },
                {
                  indicador: 'Eficiencia de cobro (%)',
                  valor: r.eficienciaCobro,
                }];
            } else {
              this.datosReporte = [];
            }
            this.cargando = false;
            this.actualizarGraficos();
          },
          error: (err) => {
            this.error =
              err?.error?.message ||
              err?.message ||
              'Error al obtener cartera de créditos';
            this.datosReporte = [];
            this.cargando = false;
          },
        });
        break;
      }
      default: {
        this.error =
          'Este reporte aún no tiene un detalle específico implementado.';
        this.cargando = false;
        this.actualizarGraficos();
        break;
      }
    }
  }

  private mapPeriodoAUtilidades(): 'dia' | 'mes' | 'anio' | 'rango' {
    switch (this.periodoSeleccionado) {
      case 'Hoy':
        return 'dia';
      case 'Este Año':
        return 'anio';
      case 'Esta Semana':
        return 'rango';
      case 'Este Mes':
      default:
        return 'mes';
    }
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

      const etiquetas =
        this.resumenDashboard?.graficoVentas?.doceMeses?.etiquetas ||
        this.resumenDashboard?.ventasMensualesLabels ||
        [];
      const datos =
        this.resumenDashboard?.graficoVentas?.doceMeses?.datos ||
        this.resumenDashboard?.ventasMensuales ||
        [];

      this.chartVentas = new Chart(ctx, {
        type: 'line',
        data: {
          labels: etiquetas,
          datasets: [
            {
              label: 'Ventas (S/)',
              data: datos,
              borderColor: '#3498db',
              backgroundColor: 'rgba(52, 152, 219, 0.1)',
              tension: 0.4,
            }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
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

      // Por defecto, el gráfico se alimenta cuando se carga el reporte de compras
      this.chartCompras = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Compras (S/)',
              data: [],
              backgroundColor: '#e74c3c',
              borderColor: '#c0392b',
              borderWidth: 1,
            }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
        },
      });
    }
  }

  private actualizarGraficoComprasDesdeDatos(data: CompraProveedorItem[]): void {
    const ctx = document.getElementById('chartCompras') as HTMLCanvasElement;
    if (!ctx) {
      return;
    }
    if (this.chartCompras) {
      this.chartCompras.destroy();
    }
    const labels = data.map((d) => d.proveedor);
    const valores = data.map((d) => d.totalCompras);
    this.chartCompras = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Compras (S/)',
            data: valores,
            backgroundColor: '#e74c3c',
            borderColor: '#c0392b',
            borderWidth: 1,
          }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  crearGraficoProductos(): void {
    const ctx = document.getElementById('chartProductos') as HTMLCanvasElement;
    if (ctx) {
      if (this.chartProductos) {
        this.chartProductos.destroy();
      }

      const etiquetas =
        this.resumenDashboard?.productosMasVendidos?.map((p) => p.nombre) ||
        ['Cemento', 'Varilla', 'Bloques', 'Pintura', 'Otros'];
      const datos =
        this.resumenDashboard?.productosMasVendidos?.map((p) => p.monto) ||
        [35, 25, 20, 12, 8];

      this.chartProductos = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: etiquetas,
          datasets: [
            {
              data: datos,
              backgroundColor: [
                '#3498db',
                '#e74c3c',
                '#27ae60',
                '#f39c12',
                '#9b59b6'],
            }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
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
    // Por ahora los gráficos se basan en el resumen general del dashboard.
    // Aquí podríamos adaptar los datasets según el reporte seleccionado si se requiere.
  }

  cambiarPeriodo(periodo: string): void {
    this.periodoSeleccionado = periodo;
    this.aplicarRangoPeriodo(periodo);
    this.cargarReportesPrincipales();
    if (this.reporteActual) {
      this.cargarDatosReporte(this.reporteActual.id);
    }
    this.cachedPack = null;
    this.cachedPackKey = null;
  }

  /** Sincroniza fechas del filtro con el período rápido (alineado a análisis financiero). */
  private aplicarRangoPeriodo(periodo: string): void {
    const hoy = new Date();
    const fmt = formatFechaLocal;
    const y = hoy.getFullYear();
    const m = hoy.getMonth();
    switch (periodo) {
      case 'Hoy':
        this.fechaInicio = fmt(hoy);
        this.fechaFin = fmt(hoy);
        break;
      case 'Esta Semana': {
        const dia = hoy.getDay();
        const diff = dia === 0 ? 6 : dia - 1;
        const ini = new Date(hoy);
        ini.setDate(hoy.getDate() - diff);
        this.fechaInicio = fmt(ini);
        this.fechaFin = fmt(hoy);
        break;
      }
      case 'Este Año':
        this.fechaInicio = `${y}-01-01`;
        this.fechaFin = `${y}-12-31`;
        break;
      case 'Este Mes':
      default: {
        const ini = new Date(y, m, 1);
        const fin = new Date(y, m + 1, 0);
        this.fechaInicio = fmt(ini);
        this.fechaFin = fmt(fin);
        break;
      }
    }
  }

  /**
   * PDF con todos los reportes del módulo (una hoja por reporte).
   * Usa las mismas fuentes que las tarjetas: dashboard, reportes API y utilidades.
   */
  generarPdfTodosReportes(): void {
    if (!this.fechaInicio || !this.fechaFin) {
      iziToast.error({
        title: 'Fechas requeridas',
        message: 'Indique fecha inicio y fecha fin antes de generar el PDF.'
      });
      return;
    }
    this.generandoInformePdf = true;
    const periodoLabel = `${this.fechaInicio} — ${this.fechaFin}`;
    const cacheKey = `${this.periodoSeleccionado}|${this.fechaInicio}|${this.fechaFin}`;

    if (this.cachedPack && this.cachedPackKey === cacheKey) {
      const nombreArchivo = `reportes-negocio-${this.fechaInicio}_${this.fechaFin}.pdf`;
      const datos = this.reportesNegocioPdf.armarDatosPdf(
        this.cachedPack,
        this.empresaPdf,
        periodoLabel,
        this.periodoSeleccionado
      );
      this.pdfService.generarPdfReportesNegocio(datos, nombreArchivo).subscribe({
        next: (blob) => {
          this.generandoInformePdf = false;
          this.pdfService.previsualizar(blob);
          iziToast.success({
            title: 'PDF generado',
            message: 'Informe con todos los reportes (una sección por hoja).'
          });
        },
        error: (err) => {
          this.generandoInformePdf = false;
          iziToast.error({
            title: 'Error PDF',
            message:
              err?.error?.error ||
              err?.message ||
              'No se pudo generar el PDF (verifique pdf-backend).'
          });
        }
      });
      return;
    }

    this.reportesNegocioPdf
      .cargarPack(this.periodoSeleccionado, this.fechaInicio, this.fechaFin)
      .subscribe({
        next: (pack) => {
          this.cachedPack = pack;
          this.cachedPackKey = cacheKey;
          const nombreArchivo = `reportes-negocio-${this.fechaInicio}_${this.fechaFin}.pdf`;
          const datos = this.reportesNegocioPdf.armarDatosPdf(
            pack,
            this.empresaPdf,
            periodoLabel,
            this.periodoSeleccionado
          );
          this.pdfService.generarPdfReportesNegocio(datos, nombreArchivo).subscribe({
            next: (blob) => {
              this.generandoInformePdf = false;
              this.pdfService.previsualizar(blob);
              iziToast.success({
                title: 'PDF generado',
                message: 'Informe con todos los reportes (una sección por hoja).'
              });
            },
            error: (err) => {
              this.generandoInformePdf = false;
              iziToast.error({
                title: 'Error PDF',
                message:
                  err?.error?.error ||
                  err?.message ||
                  'No se pudo generar el PDF (verifique pdf-backend).'
              });
            }
          });
        },
        error: () => {
          this.generandoInformePdf = false;
          iziToast.error({
            title: 'Error',
            message: 'No se pudieron cargar los datos de los reportes.'
          });
        }
      });
  }

  getObjectKeys(obj: DatosReporteRow): string[] {
    return Object.keys(obj);
  }

  getNumericValue(row: DatosReporteRow, key: string): number {
    const value = row[key];
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value.replace?.(/,/g, '') ?? value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  isCurrencyField(key: string): boolean {
    const currencyFields = ['total', 'monto', 'compras', 'ventas', 'utilidad', 'valor', 'deuda'];
    return currencyFields.includes(key);
  }

  exportarReporte(formato: string): void {
    if (formato === 'pdf') {
      this.generarPdfTodosReportes();
      return;
    }
    if (!this.reporteActual || this.datosReporte.length === 0) {
      iziToast.error({
        title: 'Sin datos',
        message: 'Seleccione un reporte con datos para exportar a Excel.'
      });
      return;
    }

    const columnas = this.getObjectKeys(this.datosReporte[0]);
    const filas = this.datosReporte.map((row) =>
      columnas.map((col) => row[col] as string | number | null | undefined)
    );

    const titulo = `${this.reporteActual.nombre} - ${this.fechaInicio} a ${this.fechaFin}`;

    if (formato === 'excel') {
      this.excelService
        .generarExcel({
          title: titulo,
          filename: `${this.reporteActual?.id}-reporte-${this.fechaInicio}-${this.fechaFin}`,
          columns: columnas,
          rows: filas as (string | number)[][],
          worksheetName: 'Reporte',
        })
        .subscribe({
          next: (blob) => {
            this.excelService.descargar(
              blob,
              `${this.reporteActual?.id}-reporte-${this.fechaInicio}-${this.fechaFin}.xlsx`
            );
          },
          error: (err) => {
            this.error =
              err?.error?.message ||
              err?.message ||
              'Error al exportar reporte a Excel';
          },
        });
    }
  }

  imprimirReporte(): void {
    window.print();
  }

  navigateTo(module: string): void {
    
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
            }
  }
}