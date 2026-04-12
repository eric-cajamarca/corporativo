import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AnalisisService } from '../../../services/analisis.service';
import {
  DashboardEjecutivo,
  BalanceGeneral,
  EstadoResultados,
  RatiosFinancieros,
  DiagnosticoFinanciero
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
  public estadoResultados: EstadoResultados | null = null;
  public ratiosFinancieros: RatiosFinancieros | null = null;
  public diagnosticoFinanciero: DiagnosticoFinanciero | null = null;

  public periodoSeleccionado = 'MES_ACTUAL';
  public vistaActiva: 'dashboard' | 'balance' | 'resultados' | 'ratios' | 'diagnostico' | 'gastos' = 'dashboard';

  public loading = {
    dashboard: false,
    balance: false,
    resultados: false,
    ratios: false,
    diagnostico: false,
    gastos: false
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

  constructor(
    private analisisService: AnalisisService
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    if (!this.filtros.fechaDesde) this.filtros.fechaDesde = `${y}-${m}-01`;
    if (!this.filtros.fechaHasta) this.filtros.fechaHasta = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    this.cargarDashboard();
    this.cargarDiagnosticoFinanciero();
  }

  cambiarVista(vista: 'dashboard' | 'balance' | 'resultados' | 'ratios' | 'diagnostico' | 'gastos') {
    this.vistaActiva = vista;

    switch (vista) {
      case 'balance':
        if (!this.balanceGeneral) this.cargarBalanceGeneral();
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
    }
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
      },
      error: () => iziToast.error({ title: 'Error', message: 'No se pudo eliminar.' })
    });
  }

  cargarDashboard() {
    this.loading.dashboard = true;
    this.analisisService.obtenerDashboardEjecutivo().subscribe({
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
    const periodo = this.filtros.periodo || 'MES_ACTUAL';
    this.analisisService.obtenerBalanceGeneral(periodo).subscribe({
      next: (response) => {
        if (response.data) {
          this.balanceGeneral = Array.isArray(response.data) ? response.data[0] : response.data;
        } else {
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

  aplicarFiltros() {
    if (this.vistaActiva === 'balance') {
      this.cargarBalanceGeneral();
    } else if (this.vistaActiva === 'resultados') {
      this.cargarEstadoResultados();
    }
  }

  refrescarDatos() {
    this.cargarDashboard();
    if (this.vistaActiva !== 'dashboard') {
      this.cambiarVista(this.vistaActiva);
    }
    this.cargarDiagnosticoFinanciero();
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