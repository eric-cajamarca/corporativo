import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CajaService } from '../../../services/caja.service';
import { Caja } from '../../../interfaces/caja-interface';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var iziToast: any;

export interface FilaArqueoConcepto {
  concepto: string;
  tipoOperacion: 'I' | 'E';
  importe: number;
  icono: string;
}

@Component({
  selector: 'app-arqueo-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent],
  templateUrl: './arqueo-caja.component.html',
  styleUrl: './arqueo-caja.component.css'
})
export class ArqueoCajaComponent implements OnInit {
  sidebarCollapsed = signal<boolean>(false);
  

  public fecha: string = '';
  public cajas: Caja[] = [];
  public cajaSeleccionada: string = 'TODAS';
  public usuarioSeleccionado: string = 'TODOS';

  /** Resumen por concepto (dinámico desde API: APERTURA_CAJA, VENTA_CONTADO, etc.) */
  public resumenConceptos: FilaArqueoConcepto[] = [];

  public movimientosIngresos: { formaPago: string; importe: number }[] = [];
  public movimientosEgresos: { formaPago: string; importe: number }[] = [];

  public totalIngresos: number = 0;
  public totalEgresos: number = 0;

  public loading: boolean = false;

  private iconosPorConcepto: Record<string, string> = {
    APERTURA_CAJA: 'fas fa-lock-open',
    VENTA_CONTADO: 'fas fa-shopping-cart',
    VENTA_CREDITO: 'fas fa-credit-card',
    PAGO_CUOTA: 'fas fa-hand-holding-usd',
    INGRESO_EXTRA: 'fas fa-arrow-down',
    COMPRA_CONTADO: 'fas fa-shopping-basket',
    GASTO_ADMINISTRATIVO: 'fas fa-briefcase',
    GASTO_OPERATIVO: 'fas fa-tools',
    PAGO_SERVICIOS: 'fas fa-file-invoice',
    RETIRO_EFECTIVO: 'fas fa-arrow-up'
  };

  constructor(
    private cajaService: CajaService
  ) {}

  ngOnInit(): void {
    const hoy = new Date();
    this.fecha = hoy.toISOString().split('T')[0];
    this.cargarCajas();
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
  }

  cargarCajas(): void {
    this.cajaService.obtenerCajas().subscribe({
      next: (response) => {
        if (response.data) {
          this.cajas = response.data;
        }
      },
      error: (error) => {
        console.error('Error al cargar cajas para arqueo:', error);
        iziToast.error({
          title: 'Error',
          message: 'No se pudieron cargar las cajas'
        });
      }
    });
  }

  consultar(): void {
    if (!this.fecha) {
      iziToast.warning({
        title: 'Advertencia',
        message: 'Seleccione una fecha para consultar el arqueo'
      });
      return;
    }

    this.loading = true;
    this.resumenConceptos = [];
    this.movimientosIngresos = [];
    this.movimientosEgresos = [];
    this.totalIngresos = 0;
    this.totalEgresos = 0;

    this.cajaService.obtenerArqueoDinamico(this.fecha, this.cajaSeleccionada).subscribe({
      next: (response) => {
        const filas: { concepto: string; tipoOperacion: string; formaPago: string; importe: number }[] = response.data || [];

        const conceptosMap = new Map<string, { tipoOperacion: 'I' | 'E'; importe: number }>();
        const ingresosMap = new Map<string, number>();
        const egresosMap = new Map<string, number>();

        filas.forEach((r: any) => {
          const concepto = r.concepto || 'Sin especificar';
          const tipo = (r.tipoOperacion || 'I') === 'I' ? 'I' : 'E';
          const formaPago = r.formaPago || 'Sin especificar';
          const importe = Number(r.importe || 0);

          const keyConcepto = `${concepto}|${tipo}`;
          const prev = conceptosMap.get(keyConcepto) || { tipoOperacion: tipo, importe: 0 };
          prev.importe += importe;
          conceptosMap.set(keyConcepto, prev);

          if (tipo === 'I') {
            ingresosMap.set(formaPago, (ingresosMap.get(formaPago) || 0) + importe);
          } else {
            egresosMap.set(formaPago, (egresosMap.get(formaPago) || 0) + importe);
          }
        });

        this.resumenConceptos = Array.from(conceptosMap.entries())
          .map(([key, val]) => {
            const [concepto] = key.split('|');
            return {
              concepto: concepto.replace(/_/g, ' '),
              tipoOperacion: val.tipoOperacion,
              importe: val.tipoOperacion === 'E' ? -val.importe : val.importe,
              icono: this.iconosPorConcepto[concepto] || 'fas fa-coins'
            };
          })
          .sort((a, b) => (a.tipoOperacion === 'I' ? 0 : 1) - (b.tipoOperacion === 'I' ? 0 : 1));

        this.movimientosIngresos = Array.from(ingresosMap.entries()).map(([formaPago, importe]) => ({ formaPago, importe }));
        this.movimientosEgresos = Array.from(egresosMap.entries()).map(([formaPago, importe]) => ({ formaPago, importe }));

        this.totalIngresos = this.resumenConceptos.filter(c => c.tipoOperacion === 'I').reduce((acc, c) => acc + c.importe, 0);
        this.totalEgresos = this.resumenConceptos.filter(c => c.tipoOperacion === 'E').reduce((acc, c) => acc + Math.abs(c.importe), 0);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al obtener arqueo dinámico:', error);
        iziToast.error({
          title: 'Error',
          message: error.error?.message || 'Error al obtener el arqueo'
        });
        this.loading = false;
      }
    });
  }

  get totalConceptos(): number {
    return this.resumenConceptos.reduce((acc, f) => acc + f.importe, 0);
  }

  get totalMovimientosIngresos(): number {
    return this.movimientosIngresos.reduce((acc, m) => acc + m.importe, 0);
  }

  get totalMovimientosEgresos(): number {
    return this.movimientosEgresos.reduce((acc, m) => acc + m.importe, 0);
  }

  formatCurrency(valor: number): string {
    return (valor || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

