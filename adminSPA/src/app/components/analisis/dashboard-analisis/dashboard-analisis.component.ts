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
  public vistaActiva: 'dashboard' | 'balance' | 'resultados' | 'ratios' | 'diagnostico' = 'dashboard';

  public loading = {
    dashboard: false,
    balance: false,
    resultados: false,
    ratios: false,
    diagnostico: false
  };

  public filtros = {
    periodo: '',
    fechaDesde: '',
    fechaHasta: ''
  };

  constructor(
    private analisisService: AnalisisService
  ) {}

  ngOnInit(): void {
    this.cargarDashboard();
    this.cargarDiagnosticoFinanciero();
  }

  cambiarVista(vista: 'dashboard' | 'balance' | 'resultados' | 'ratios' | 'diagnostico') {
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
    }
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
    this.analisisService.obtenerBalanceGeneral(this.filtros.periodo).subscribe({
      next: (response) => {
        if (response.data) {
          this.balanceGeneral = response.data;
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
        if (response.data) {
          this.estadoResultados = response.data;
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
        if (response.data) {
          this.ratiosFinancieros = response.data;
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
        if (response.data) {
          this.diagnosticoFinanciero = response.data;
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
      case 'REGULAR': return 'warning';
      case 'DEFICIENTE': return 'danger';
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
      currency: 'PEN'
    }).format(value);
  }

  formatPercent(value: number): string {
    return (value * 100).toFixed(2) + '%';
  }

  isPositive(value: number): boolean {
    return value > 0;
  }
}