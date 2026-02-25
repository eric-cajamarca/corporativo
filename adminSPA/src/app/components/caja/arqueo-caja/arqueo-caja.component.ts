import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CajaService } from '../../../services/caja.service';
import { Caja } from '../../../interfaces/caja-interface';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
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
  /** Fecha inicial (obligatoria). Si no hay fecha final, se consulta solo ese día. */
  public fecha: string = '';
  public fechaFinal: string = '';
  public cajas: Caja[] = [];
  public cajaSeleccionada: string = 'TODAS';
  public usuarioSeleccionado: string = 'TODOS';

  /** Resumen por concepto (dinámico desde API: APERTURA_CAJA, VENTA_CONTADO, etc.) */
  public resumenConceptos: FilaArqueoConcepto[] = [];

  /** Filas del primer recuadro (calculadas una vez para evitar getter en cada change detection). */
  public filasPrimeraTabla: { clave: string; etiqueta: string; importe: number; icono: string; tipo: string }[] = [];

  /** Total ventas al crédito del período (informativo, no efectivo en caja). */
  public ventasCreditoImporte: number = 0;

  /** Total cobro de créditos del período (desde PagosCuotas/CuotasCredito.fechaPago, consultado en backend). */
  public cobroCreditosImporte: number = 0;

  public movimientosIngresos: { formaPago: string; importe: number }[] = [];
  public movimientosEgresos: { formaPago: string; importe: number }[] = [];

  /** Filas crudas del arqueo (concepto, tipo, formaPago, importe) para el detalle por forma de pago. */
  public filasArqueoRaw: { concepto: string; tipoOperacion: string; formaPago: string; importe: number }[] = [];

  /** Detalle por comprobante (comprobante, cliente/proveedor, importe) desde el backend. */
  public detalleArqueo: { concepto: string; tipoOperacion: string; formaPago: string; importe: number; comprobante: string; clienteOrProveedor: string }[] = [];

  /** Detalle por forma de pago (modal Movimientos Ingresos/Egresos): comprobante, cliente/proveedor, total. */
  public detalleFormaPago: { formaPago: string; tipo: 'I' | 'E'; items: { comprobante: string; clienteOrProveedor: string; importe: number }[] } | null = null;
  public mostrarModalDetalleFormaPago = false;

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
    private cajaService: CajaService,
    public sidebarState: SidebarStateService
  ) {}

  /** Fecha en zona local YYYY-MM-DD (evita que al recargar aparezca un día adelantado por UTC). */
  private static fechaLocalHoy(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  ngOnInit(): void {
    this.fecha = ArqueoCajaComponent.fechaLocalHoy();
    this.cargarCajas();
    this.actualizarFilasPrimeraTabla();
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
        message: 'Seleccione al menos la fecha inicial para consultar el arqueo'
      });
      return;
    }
    const usaRango = !!this.fechaFinal;
    if (usaRango && this.fecha > this.fechaFinal) {
      iziToast.warning({
        title: 'Advertencia',
        message: 'La fecha inicial no puede ser mayor que la fecha final'
      });
      return;
    }

    this.loading = true;
    this.resumenConceptos = [];
    this.ventasCreditoImporte = 0;
    this.cobroCreditosImporte = 0;
    this.movimientosIngresos = [];
    this.movimientosEgresos = [];
    this.filasArqueoRaw = [];
    this.detalleArqueo = [];
    this.totalIngresos = 0;
    this.totalEgresos = 0;

    this.cajaService.obtenerArqueoDinamico({
      fecha: !usaRango ? this.fecha : undefined,
      fechaInicial: usaRango ? this.fecha : undefined,
      fechaFinal: usaRango ? this.fechaFinal : undefined,
      idCaja: this.cajaSeleccionada
    }).subscribe({
      next: (response) => {
        const filas: { concepto: string; tipoOperacion: string; formaPago: string; importe: number }[] = response.data || [];

        const conceptosMap = new Map<string, { tipoOperacion: 'I' | 'E'; importe: number }>();
        const ingresosMap = new Map<string, number>();
        const egresosMap = new Map<string, number>();

        filas.forEach((r: any) => {
          const concepto = r.concepto || 'Sin especificar';
          const tipo = (r.tipoOperacion || 'I') === 'I' ? 'I' : 'E';
          const formaPagoRaw = r.formaPago || 'Sin especificar';
          const formaPago = this.normalizarFormaPago(formaPagoRaw);
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

        this.filasArqueoRaw = filas.map((r: any) => ({
          concepto: (r.concepto || 'Sin especificar').replace(/_/g, ' '),
          tipoOperacion: (r.tipoOperacion || 'I') === 'I' ? 'I' : 'E',
          formaPago: this.normalizarFormaPago(r.formaPago || 'Sin especificar'),
          importe: Number(r.importe || 0)
        }));
        this.movimientosIngresos = Array.from(ingresosMap.entries()).map(([formaPago, importe]) => ({ formaPago, importe }));
        this.movimientosEgresos = Array.from(egresosMap.entries()).map(([formaPago, importe]) => ({ formaPago, importe }));

        this.totalIngresos = this.resumenConceptos.filter(c => c.tipoOperacion === 'I').reduce((acc, c) => acc + c.importe, 0);
        this.totalEgresos = this.resumenConceptos.filter(c => c.tipoOperacion === 'E').reduce((acc, c) => acc + Math.abs(c.importe), 0);
        this.ventasCreditoImporte = Number((response as any).ventasCredito?.importe) || 0;
        this.cobroCreditosImporte = Number((response as any).cobroCreditos?.importe) || 0;
        this.actualizarFilasPrimeraTabla();
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

  /** Actualiza filasPrimeraTabla con los totales actuales (evita getter en template que colgaba la página). */
  private actualizarFilasPrimeraTabla(): void {
    const ventaContado = this.importePorConcepto('VENTA CONTADO');
    this.filasPrimeraTabla = [
      { clave: 'VENTA_CONTADO', etiqueta: 'Venta contado', importe: ventaContado, icono: 'fas fa-shopping-cart', tipo: 'VENTA' },
      { clave: 'VENTA_CREDITO', etiqueta: 'Venta crédito', importe: this.totalVentasCredito, icono: 'fas fa-credit-card', tipo: 'INFO' },
      { clave: 'PAGO_CUOTA', etiqueta: 'Total cobro de créditos', importe: this.totalCobroCreditos, icono: 'fas fa-hand-holding-usd', tipo: 'COBRO' },
      { clave: 'INGRESOS', etiqueta: 'Ingresos', importe: this.totalIngresos, icono: 'fas fa-arrow-down', tipo: 'I' },
      { clave: 'EGRESOS', etiqueta: 'Egresos', importe: -this.totalEgresos, icono: 'fas fa-arrow-up', tipo: 'E' },
      { clave: 'PAGO_CREDITOS', etiqueta: 'Total pago de créditos a proveedores', importe: -this.totalPagoCreditosProveedores, icono: 'fas fa-file-invoice-dollar', tipo: 'PAGO_CREDITO' }
    ];
  }

  private importePorConcepto(conceptoConEspacios: string): number {
    const f = this.resumenConceptos.find(c => c.tipoOperacion === 'I' && this.normConcepto(c.concepto) === this.normConcepto(conceptoConEspacios));
    return f ? f.importe : 0;
  }

  private importePorConceptoEgreso(conceptoConEspacios: string): number {
    const f = this.resumenConceptos.find(c => c.tipoOperacion === 'E' && this.normConcepto(c.concepto) === this.normConcepto(conceptoConEspacios));
    return f ? Math.abs(f.importe) : 0;
  }

  /** Total ventas al crédito (por cobrar, informativo). */
  get totalVentasCredito(): number {
    return this.ventasCreditoImporte;
  }

  /** Total cobro de créditos (desde tabla PagosCuotas por fechaPago en el período). */
  get totalCobroCreditos(): number {
    return this.cobroCreditosImporte;
  }

  /** Total pago de créditos a proveedores (egresos compras / pago proveedores). */
  get totalPagoCreditosProveedores(): number {
    const compra = this.importePorConceptoEgreso('COMPRA CONTADO');
    const pagoProv = this.importePorConceptoEgreso('PAGO PROVEEDORES');
    return compra + pagoProv;
  }

  /** Items del primer modal: comprobante, cliente/proveedor, importe (desde detalleArqueo). */
  detalleConcepto: { concepto: string; items: { comprobante: string; clienteOrProveedor: string; importe: number }[] } | null = null;
  mostrarModalDetalle = false;

  private normConcepto(s: string): string {
    return (s || '').toUpperCase().replace(/_/g, ' ').trim();
  }

  verDetalleFila(fila: { clave: string; etiqueta: string; tipo: string }): void {
    let items: { comprobante: string; clienteOrProveedor: string; importe: number }[] = [];
    switch (fila.clave) {
      case 'VENTA_CONTADO':
        items = this.detalleArqueo
          .filter(d => d.tipoOperacion === 'I' && this.normConcepto(d.concepto) === 'VENTA CONTADO')
          .map(d => ({ comprobante: d.comprobante, clienteOrProveedor: d.clienteOrProveedor, importe: d.importe }));
        break;
      case 'VENTA_CREDITO':
        if (this.ventasCreditoImporte > 0) {
          items = [{ comprobante: '—', clienteOrProveedor: '—', importe: this.ventasCreditoImporte }];
        }
        break;
      case 'PAGO_CUOTA':
        items = this.detalleArqueo
          .filter(d => d.tipoOperacion === 'I' && this.normConcepto(d.concepto) === 'PAGO CUOTA')
          .map(d => ({ comprobante: d.comprobante, clienteOrProveedor: d.clienteOrProveedor, importe: d.importe }));
        break;
      case 'INGRESOS':
        items = this.detalleArqueo
          .filter(d => d.tipoOperacion === 'I')
          .map(d => ({ comprobante: d.comprobante, clienteOrProveedor: d.clienteOrProveedor, importe: d.importe }));
        break;
      case 'EGRESOS':
        items = this.detalleArqueo
          .filter(d => d.tipoOperacion === 'E')
          .map(d => ({ comprobante: d.comprobante, clienteOrProveedor: d.clienteOrProveedor, importe: -d.importe }));
        break;
      case 'PAGO_CREDITOS':
        items = this.detalleArqueo
          .filter(d => d.tipoOperacion === 'E' && (this.normConcepto(d.concepto) === 'COMPRA CONTADO' || this.normConcepto(d.concepto) === 'PAGO PROVEEDORES'))
          .map(d => ({ comprobante: d.comprobante, clienteOrProveedor: d.clienteOrProveedor, importe: -d.importe }));
        break;
      default:
        items = [];
    }
    this.detalleConcepto = { concepto: fila.etiqueta, items };
    this.mostrarModalDetalle = true;
  }

  cerrarModalDetalle(): void {
    this.mostrarModalDetalle = false;
    this.detalleConcepto = null;
  }

  /** Subtotal del detalle concepto (suma de importes). */
  subtotalDetalleConcepto(): number {
    if (!this.detalleConcepto || !this.detalleConcepto.items.length) return 0;
    return this.detalleConcepto.items.reduce((acc, item) => acc + item.importe, 0);
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

  /**
   * Unifica formas de pago equivalentes (EFECTIVO, Efectivo, CONTADO, Contado) en una sola etiqueta
   * para que no aparezcan duplicadas en Movimientos de Ingresos/Egresos (vienen de FormasPago y MediosPago).
   */
  private normalizarFormaPago(formaPago: string): string {
    const t = (formaPago || '').trim().toUpperCase();
    if (t === 'CONTADO' || t === 'EFECTIVO') return 'Efectivo';
    return (formaPago || '').trim() || 'Sin especificar';
  }

  /** Abre el modal de detalle por forma de pago: comprobante, cliente/proveedor, total. */
  verDetalleFormaPago(formaPago: string, tipo: 'I' | 'E'): void {
    const items = this.detalleArqueo
      .filter(d => d.formaPago === formaPago && d.tipoOperacion === tipo)
      .map(d => ({
        comprobante: d.comprobante,
        clienteOrProveedor: d.clienteOrProveedor,
        importe: tipo === 'E' ? -d.importe : d.importe
      }));
    this.detalleFormaPago = { formaPago, tipo, items };
    this.mostrarModalDetalleFormaPago = true;
  }

  cerrarModalDetalleFormaPago(): void {
    this.mostrarModalDetalleFormaPago = false;
    this.detalleFormaPago = null;
  }

  subtotalDetalleFormaPago(): number {
    if (!this.detalleFormaPago || !this.detalleFormaPago.items.length) return 0;
    return this.detalleFormaPago.items.reduce((acc, item) => acc + item.importe, 0);
  }
}

