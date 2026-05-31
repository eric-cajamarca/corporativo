import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AnalisisService } from '../../../services/analisis.service';
import { PdfService, PdfDatosDinamicos } from '../../../services/pdf.service';
import { EmpresaService } from '../../../services/empresa.service';
import { Empresa as EmpresaPdf } from '../../../interfaces/pdf-interface';
import {
  DashboardEjecutivo,
  BalanceGeneral,
  EstadoResultados,
  RatiosFinancieros,
  DiagnosticoFinanciero,
  FlujoCajaAnalisis,
  FlujoCajaSerieMensual
} from '../../../interfaces/analisis-interface';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var iziToast: any;

@Component({
  selector: 'app-dashboard-analisis',
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './dashboard-analisis.component.html',
  styleUrl: './dashboard-analisis.component.css'
})
export class DashboardAnalisisComponent implements OnInit {

  public dashboard: DashboardEjecutivo | null = null;
  public balanceGeneral: BalanceGeneral | null = null;
  public balanceGeneralList: BalanceGeneral[] = [];
  public balanceGeneralIndex = 0;
  public flujoCaja: FlujoCajaAnalisis | null = null;
  public flujoCajaSerie: FlujoCajaSerieMensual | null = null;
  public estadoResultados: EstadoResultados | null = null;
  public ratiosFinancieros: RatiosFinancieros | null = null;
  public diagnosticoFinanciero: DiagnosticoFinanciero | null = null;

  public periodoSeleccionado = 'MES_ACTUAL';
  public vistaActiva: 'dashboard' | 'balance' | 'resultados' | 'ratios' | 'diagnostico' | 'gastos' | 'flujo-caja' = 'dashboard';

  public loading = {
    dashboard: false,
    balance: false,
    resultados: false,
    ratios: false,
    diagnostico: false,
    gastos: false,
    flujoCaja: false
  };

  public listGastos: { idGasto: string; fecha: string; tipo: string; monto: number; descripcion?: string }[] = [];
  public nuevoGasto = { fecha: '', tipo: 'ADMINISTRACION', monto: 0, descripcion: '' };

  public filtros = {
    periodo: 'MES_ACTUAL',
    fechaDesde: '',
    fechaHasta: ''
  };

  /** Estado de resultados puede venir como array (varios meses); mostramos el primero o el seleccionado */
  public estadoResultadosList: EstadoResultados[] = [];
  public estadoResultadosIndex = 0;

  public empresa: EmpresaPdf | null = null;
  public generandoInformePdf = false;

  constructor(
    private analisisService: AnalisisService,
    private pdfService: PdfService,
    private empresaService: EmpresaService
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    if (!this.filtros.fechaDesde) this.filtros.fechaDesde = `${y}-${m}-01`;
    if (!this.filtros.fechaHasta) this.filtros.fechaHasta = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    this.empresaService.getEmpresa$().subscribe((emp) => {
      const e = emp as { razon_Social?: string; nombreComercial?: string; nombre?: string; ruc?: string; direccion?: string; telefono?: string; logo?: string };
      if (emp) {
        const nombre = e.razon_Social || e.nombreComercial || e.nombre || '';
        this.empresa = {
          logo: e.logo || '',
          nombre,
          ruc: e.ruc || '',
          direccion: e.direccion || '',
          telefono: e.telefono || ''
        };
      }
    });
    this.cargarDashboard();
    this.cargarDiagnosticoFinanciero();
  }

  cambiarVista(vista: 'dashboard' | 'balance' | 'resultados' | 'ratios' | 'diagnostico' | 'gastos' | 'flujo-caja') {
    this.vistaActiva = vista;

    switch (vista) {
      case 'balance':
        if (!this.balanceGeneralList.length) this.cargarBalanceGeneral();
        break;
      case 'resultados':
        if (!this.estadoResultados) this.cargarEstadoResultados();
        break;
      case 'ratios':
        if (!this.ratiosFinancieros) this.cargarRatiosFinancieros();
        break;
      case 'diagnostico':
        if (!this.diagnosticoFinanciero) this.cargarDiagnosticoFinanciero();
        break;
      case 'gastos':
        this.cargarGastos();
        break;
      case 'flujo-caja':
        this.cargarFlujoCaja();
        break;
    }
  }

  private filtrosConsulta() {
    const rangoManual =
      !!this.filtros.fechaDesde &&
      !!this.filtros.fechaHasta &&
      (this.vistaActiva === 'resultados' || this.vistaActiva === 'flujo-caja');
    return {
      periodo: this.filtros.periodo || 'MES_ACTUAL',
      fechaDesde: rangoManual ? this.filtros.fechaDesde : undefined,
      fechaHasta: rangoManual ? this.filtros.fechaHasta : undefined
    };
  }

  cargarGastos() {
    this.loading.gastos = true;
    this.analisisService.listarGastos(this.filtros.fechaDesde, this.filtros.fechaHasta).subscribe({
      next: (res) => {
        this.listGastos = Array.isArray(res.data) ? res.data : [];
        this.loading.gastos = false;
      },
      error: () => {
        this.listGastos = [];
        this.loading.gastos = false;
      }
    });
  }

  registrarGasto() {
    const m = Number(this.nuevoGasto.monto);
    if (!this.nuevoGasto.fecha || m <= 0) {
      iziToast.warning({ title: 'Datos incompletos', message: 'Indique fecha y monto mayor a 0.' });
      return;
    }
    this.analisisService.crearGasto({
      fecha: this.nuevoGasto.fecha,
      tipo: this.nuevoGasto.tipo,
      monto: m,
      descripcion: this.nuevoGasto.descripcion || undefined
    }).subscribe({
      next: () => {
        iziToast.success({ title: 'Gasto registrado', message: 'Se usará en el estado de resultados.' });
        this.nuevoGasto = { fecha: '', tipo: 'ADMINISTRACION', monto: 0, descripcion: '' };
        this.cargarGastos();
        this.cargarEstadoResultados();
        this.cargarDashboard();
        if (this.vistaActiva === 'flujo-caja') this.cargarFlujoCaja();
      },
      error: (err) => {
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo registrar el gasto.' });
      }
    });
  }

  eliminarGasto(idGasto: string) {
    if (!confirm('¿Eliminar este gasto?')) return;
    this.analisisService.eliminarGasto(idGasto).subscribe({
      next: () => {
        this.cargarGastos();
        this.cargarEstadoResultados();
        this.cargarDashboard();
        if (this.vistaActiva === 'flujo-caja') this.cargarFlujoCaja();
      },
      error: () => iziToast.error({ title: 'Error', message: 'No se pudo eliminar.' })
    });
  }

  cargarDashboard() {
    this.loading.dashboard = true;
    this.analisisService.obtenerDashboardEjecutivo(this.filtrosConsulta()).subscribe({
      next: (response) => {
        if (response.data) {
          this.dashboard = response.data;
        }
        this.loading.dashboard = false;
      },
      error: (error) => {
        console.error('Error al cargar dashboard:', error);
        iziToast.error({
          title: 'Error',
          message: 'Error al cargar el dashboard ejecutivo'
        });
        this.loading.dashboard = false;
      }
    });
  }

  cargarBalanceGeneral() {
    this.loading.balance = true;
    this.analisisService.obtenerBalanceGeneral(this.filtrosConsulta()).subscribe({
      next: (response) => {
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          this.balanceGeneralList = response.data;
          this.balanceGeneralIndex = Math.max(0, response.data.length - 1);
          this.balanceGeneral = response.data[this.balanceGeneralIndex];
        } else if (response.data) {
          this.balanceGeneralList = [response.data];
          this.balanceGeneralIndex = 0;
          this.balanceGeneral = response.data;
        } else {
          this.balanceGeneralList = [];
          this.balanceGeneral = null;
        }
        this.loading.balance = false;
      },
      error: (error) => {
        console.error('Error al cargar balance general:', error);
        iziToast.error({
          title: 'Error',
          message: 'Error al cargar el balance general'
        });
        this.loading.balance = false;
      }
    });
  }

  cargarEstadoResultados() {
    this.loading.resultados = true;
    this.analisisService.obtenerEstadoResultados({
      fechaDesde: this.filtros.fechaDesde,
      fechaHasta: this.filtros.fechaHasta,
      agruparPor: 'MES'
    }).subscribe({
      next: (response) => {
        if (response.data && (Array.isArray(response.data) ? response.data.length > 0 : true)) {
          const data = response.data;
          if (Array.isArray(data)) {
            this.estadoResultadosList = data;
            this.estadoResultadosIndex = 0;
            this.estadoResultados = data[0];
          } else {
            this.estadoResultadosList = [data];
            this.estadoResultadosIndex = 0;
            this.estadoResultados = data;
          }
        } else {
          this.estadoResultadosList = [];
          this.estadoResultados = null;
        }
        this.loading.resultados = false;
      },
      error: (error) => {
        console.error('Error al cargar estado de resultados:', error);
        iziToast.error({
          title: 'Error',
          message: 'Error al cargar el estado de resultados'
        });
        this.loading.resultados = false;
      }
    });
  }

  cargarRatiosFinancieros() {
    this.loading.ratios = true;
    this.analisisService.obtenerRatiosFinancieros().subscribe({
      next: (response) => {
        if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
          this.ratiosFinancieros = response.data;
        } else {
          this.ratiosFinancieros = null;
        }
        this.loading.ratios = false;
      },
      error: (error) => {
        console.error('Error al cargar ratios financieros:', error);
        iziToast.error({
          title: 'Error',
          message: 'Error al cargar los ratios financieros'
        });
        this.loading.ratios = false;
      }
    });
  }

  cargarDiagnosticoFinanciero() {
    this.loading.diagnostico = true;
    this.analisisService.obtenerDiagnosticoFinanciero().subscribe({
      next: (response) => {
        if (response.data && typeof response.data === 'object' && response.data.saludFinanciera !== undefined) {
          this.diagnosticoFinanciero = response.data;
        } else if (response.data && (response.data as any).mensaje) {
          this.diagnosticoFinanciero = null;
        } else {
          this.diagnosticoFinanciero = response.data || null;
        }
        this.loading.diagnostico = false;
      },
      error: (error) => {
        console.error('Error al cargar diagnóstico financiero:', error);
        iziToast.error({
          title: 'Error',
          message: 'Error al cargar el diagnóstico financiero'
        });
        this.loading.diagnostico = false;
      }
    });
  }

  cargarFlujoCaja() {
    this.loading.flujoCaja = true;
    const filtros = this.filtrosConsulta();
    this.analisisService.obtenerFlujoCaja(filtros).subscribe({
      next: (response) => {
        this.flujoCaja = response.data || null;
        this.loading.flujoCaja = false;
      },
      error: () => {
        this.flujoCaja = null;
        this.loading.flujoCaja = false;
        iziToast.error({ title: 'Error', message: 'No se pudo cargar el flujo de caja.' });
      }
    });
    if (filtros.periodo === 'ANO_ACTUAL') {
      this.analisisService.obtenerFlujoCajaSerie(filtros).subscribe({
        next: (res) => { this.flujoCajaSerie = res.data || null; },
        error: () => { this.flujoCajaSerie = null; }
      });
    } else {
      this.flujoCajaSerie = null;
    }
  }

  aplicarFiltros() {
    if (this.vistaActiva === 'dashboard') {
      this.cargarDashboard();
    } else if (this.vistaActiva === 'balance') {
      this.cargarBalanceGeneral();
    } else if (this.vistaActiva === 'resultados') {
      this.cargarEstadoResultados();
    } else if (this.vistaActiva === 'flujo-caja') {
      this.cargarFlujoCaja();
    }
  }

  seleccionarPeriodoBalance(index: number) {
    if (this.balanceGeneralList[index]) {
      this.balanceGeneralIndex = index;
      this.balanceGeneral = this.balanceGeneralList[index];
    }
  }

  refrescarDatos() {
    this.cargarDashboard();
    if (this.vistaActiva !== 'dashboard') {
      this.cambiarVista(this.vistaActiva);
    }
    this.cargarDiagnosticoFinanciero();
  }

  /** Rango de fechas del informe según filtro de período (para PDF e estado de resultados). */
  private obtenerRangoInforme(): { fechaInicio: string; fechaFin: string; periodoLabel: string } {
    const manual =
      !!this.filtros.fechaDesde &&
      !!this.filtros.fechaHasta &&
      (this.vistaActiva === 'resultados' || this.vistaActiva === 'flujo-caja');
    if (manual) {
      return {
        fechaInicio: this.filtros.fechaDesde,
        fechaFin: this.filtros.fechaHasta,
        periodoLabel: `${this.filtros.fechaDesde} — ${this.filtros.fechaHasta}`
      };
    }
    const hoy = new Date();
    const y = hoy.getFullYear();
    const m = hoy.getMonth();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    switch (this.filtros.periodo || 'MES_ACTUAL') {
      case 'MES_ANTERIOR': {
        const ini = new Date(y, m - 1, 1);
        const fin = new Date(y, m, 0);
        const p = `${ini.getFullYear()}-${String(ini.getMonth() + 1).padStart(2, '0')}`;
        return { fechaInicio: fmt(ini), fechaFin: fmt(fin), periodoLabel: p };
      }
      case 'TRIMESTRE': {
        const trim = Math.floor(m / 3);
        const ini = new Date(y, trim * 3, 1);
        const fin = new Date(y, trim * 3 + 3, 0);
        return { fechaInicio: fmt(ini), fechaFin: fmt(fin), periodoLabel: `T${trim + 1}-${y}` };
      }
      case 'ANO_ACTUAL':
        return {
          fechaInicio: `${y}-01-01`,
          fechaFin: `${y}-12-31`,
          periodoLabel: String(y)
        };
      default: {
        const ini = new Date(y, m, 1);
        const fin = new Date(y, m + 1, 0);
        const p = `${y}-${String(m + 1).padStart(2, '0')}`;
        return { fechaInicio: fmt(ini), fechaFin: fmt(fin), periodoLabel: p };
      }
    }
  }

  /** Genera PDF del análisis completo: una sección por hoja. */
  imprimirInformeFinanciero(): void {
    this.generandoInformePdf = true;
    const filtrosApi = this.filtrosConsulta();
    const rango = this.obtenerRangoInforme();

    forkJoin({
      dashboard: this.analisisService.obtenerDashboardEjecutivo(filtrosApi).pipe(
        map((r) => r.data),
        catchError(() => of(null))
      ),
      balanceList: this.analisisService.obtenerBalanceGeneral(filtrosApi).pipe(
        map((r) => (Array.isArray(r.data) ? r.data : r.data ? [r.data] : [])),
        catchError(() => of([]))
      ),
      flujoCaja: this.analisisService.obtenerFlujoCaja(filtrosApi).pipe(
        map((r) => r.data),
        catchError(() => of(null))
      ),
      estadoResultadosList: this.analisisService
        .obtenerEstadoResultados({
          fechaDesde: rango.fechaInicio,
          fechaHasta: rango.fechaFin,
          agruparPor: 'MES'
        })
        .pipe(
          map((r) => (Array.isArray(r.data) ? r.data : r.data ? [r.data] : [])),
          catchError(() => of([]))
        ),
      ratios: this.analisisService.obtenerRatiosFinancieros().pipe(
        map((r) => r.data),
        catchError(() => of(null))
      ),
      diagnostico: this.analisisService.obtenerDiagnosticoFinanciero().pipe(
        map((r) => r.data),
        catchError(() => of(null))
      ),
      gastos: this.analisisService.listarGastos(rango.fechaInicio, rango.fechaFin).pipe(
        map((r) => (Array.isArray(r.data) ? r.data : [])),
        catchError(() => of([]))
      ),
      flujoSerie:
        filtrosApi.periodo === 'ANO_ACTUAL'
          ? this.analisisService.obtenerFlujoCajaSerie(filtrosApi).pipe(
              map((r) => r.data),
              catchError(() => of(null))
            )
          : of(null)
    }).subscribe({
      next: (pack) => {
        const nombreArchivo = `analisis-financiero-${rango.periodoLabel.replace(/\s/g, '_')}.pdf`;
        const datos: PdfDatosDinamicos = {
          empresa: this.empresa ?? {
            logo: '',
            nombre: '',
            ruc: '',
            direccion: '',
            telefono: ''
          },
          periodoLabel: rango.periodoLabel,
          ...pack
        };
        this.pdfService.generarPdfAnalisisFinanciero(datos, nombreArchivo).subscribe({
          next: (blob) => {
            this.generandoInformePdf = false;
            this.pdfService.previsualizar(blob);
            iziToast.success({
              title: 'Informe generado',
              message: 'Se abrió el PDF con una sección por hoja.'
            });
          },
          error: (err) => {
            this.generandoInformePdf = false;
            iziToast.error({
              title: 'Error',
              message: err?.error?.error || err?.message || 'No se pudo generar el PDF (verifique pdf-backend).'
            });
          }
        });
      },
      error: () => {
        this.generandoInformePdf = false;
        iziToast.error({ title: 'Error', message: 'No se pudieron cargar los datos del informe.' });
      }
    });
  }

  // Helpers para formato y colores
  getSaludFinancieraColor(salud: string): string {
    switch (salud) {
      case 'EXCELENTE': return 'success';
      case 'BUENA': return 'primary';
      case 'REGULAR':
      case 'ACEPTABLE': return 'info';
      case 'DEFICIENTE':
      case 'REQUIERE ATENCIÓN': return 'danger';
      default: return 'secondary';
    }
  }

  getRatioEstadoColor(estado: string): string {
    switch (estado) {
      case 'OPTIMO': return 'success';
      case 'ACEPTABLE': return 'primary';
      case 'PREOCUPANTE': return 'warning';
      case 'CRITICO': return 'danger';
      default: return 'secondary';
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value ?? 0);
  }

  formatPercent(value: number): string {
    if (value == null || isNaN(value)) return '0.00%';
    return (value * 100).toFixed(2) + '%';
  }

  /** Para ratios tipo liquidez (ej. 1.5 = 1.50x), no porcentaje */
  formatRatio(value: number): string {
    if (value == null || isNaN(value)) return '0.00';
    return Number(value).toFixed(2);
  }

  seleccionarPeriodoResultados(index: number) {
    if (this.estadoResultadosList[index]) {
      this.estadoResultadosIndex = index;
      this.estadoResultados = this.estadoResultadosList[index];
    }
  }

  isPositive(value: number): boolean {
    return value > 0;
  }
}