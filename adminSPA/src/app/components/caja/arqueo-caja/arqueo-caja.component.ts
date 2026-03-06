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

  /** Modal forma de pago: filas de response.data filtradas por formaPago (Concepto, Forma pago, Total). */
  public detalleFormaPago: { formaPago: string; tipo: 'I' | 'E'; items: { concepto: string; formaPago: string; importe: number }[] } | null = null;
  public mostrarModalDetalleFormaPago = false;

  public totalIngresos: number = 0;
  public totalEgresos: number = 0;

  public loading: boolean = false;

  private iconosPorConcepto: Record<string, string> = {
    APERTURA_CAJA: 'bi bi-lock-open-fill',
    VENTA_CONTADO: 'bi bi-cart-check',
    VENTA_CREDITO: 'bi bi-credit-card',
    PAGO_CUOTA: 'bi bi-hand-thumbs-up',
    INGRESO_EXTRA: 'bi bi-arrow-down',
    INGRESOS: 'bi bi-arrow-down',
    COMPRA_CONTADO: 'bi bi-cart-check',
    GASTO_ADMINISTRATIVO: 'bi bi-briefcase',
    GASTO_OPERATIVO: 'bi bi-tools',
    PAGO_SERVICIOS: 'bi bi-file-invoice',
    RETIRO_EFECTIVO: 'bi bi-arrow-up'
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

    // Llamada al backend: devuelve data (filas crudas), ventasCredito y cobroCreditos
    this.cajaService.obtenerArqueoDinamico({
      fecha: !usaRango ? this.fecha : undefined,
      fechaInicial: usaRango ? this.fecha : undefined,
      fechaFinal: usaRango ? this.fechaFinal : undefined,
      idCaja: this.cajaSeleccionada
    }).subscribe({
      next: (response) => {
        console.log('[Arqueo] 1. Respuesta cruda obtenerArqueoDinamico:', response);

        const filas: { concepto: string; tipoOperacion: string; formaPago: string; importe: number }[] = response.data || [];
        console.log('[Arqueo] 2. Filas extraídas (response.data):', filas);

        // Mapas para agrupar: por concepto (I/E) y por forma de pago (ingresos/egresos)
        const conceptosMap = new Map<string, { tipoOperacion: 'I' | 'E'; importe: number }>();
        const ingresosMap = new Map<string, number>();
        const egresosMap = new Map<string, number>();

        // Recorrer cada fila del backend y acumular en conceptos y por forma de pago
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
        console.log('[Arqueo] 3. Después del forEach - conceptosMap:', Object.fromEntries(conceptosMap));
        console.log('[Arqueo] 3. Después del forEach - ingresosMap:', Object.fromEntries(ingresosMap));
        console.log('[Arqueo] 3. Después del forEach - egresosMap:', Object.fromEntries(egresosMap));

        // Resumen por concepto (ej. VENTA CONTADO, APERTURA_CAJA): con icono y signo (egresos negativos)
        this.resumenConceptos = Array.from(conceptosMap.entries())
          .map(([key, val]) => {
            const [concepto] = key.split('|');
            return {
              concepto: concepto.replace(/_/g, ' '),
              tipoOperacion: val.tipoOperacion,
              importe: val.tipoOperacion === 'E' ? -val.importe : val.importe,
              icono: this.iconosPorConcepto[concepto] || 'bi bi-coins'
            };
          })
          .sort((a, b) => (a.tipoOperacion === 'I' ? 0 : 1) - (b.tipoOperacion === 'I' ? 0 : 1));
        console.log('[Arqueo] 4. resumenConceptos (con icono, egresos negativos):', this.resumenConceptos);

        // Filas crudas para detalle; ingresos/egresos agrupados por forma de pago (modales)
        this.filasArqueoRaw = filas.map((r: any) => ({
          concepto: (r.concepto || 'Sin especificar').replace(/_/g, ' '),
          tipoOperacion: (r.tipoOperacion || 'I') === 'I' ? 'I' : 'E',
          formaPago: this.normalizarFormaPago(r.formaPago || 'Sin especificar'),
          importe: Number(r.importe || 0)
        }));
        this.movimientosIngresos = Array.from(ingresosMap.entries()).map(([formaPago, importe]) => ({ formaPago, importe }));
        this.movimientosEgresos = Array.from(egresosMap.entries()).map(([formaPago, importe]) => ({ formaPago, importe }));
        console.log('[Arqueo] 5. filasArqueoRaw:', this.filasArqueoRaw);
        console.log('[Arqueo] 5. movimientosIngresos:', this.movimientosIngresos);
        console.log('[Arqueo] 5. movimientosEgresos:', this.movimientosEgresos);

        // Totales y datos extra del response; luego se arma la primera tabla (resumen fijo de 6 filas)
        this.totalIngresos = this.resumenConceptos.filter(c => c.tipoOperacion === 'I').reduce((acc, c) => acc + c.importe, 0);
        this.totalEgresos = this.resumenConceptos.filter(c => c.tipoOperacion === 'E').reduce((acc, c) => acc + Math.abs(c.importe), 0);
        this.ventasCreditoImporte = Number((response as any).ventasCredito?.importe) || 0;
        this.cobroCreditosImporte = Number((response as any).cobroCreditos?.importe) || 0;
        this.detalleArqueo = (response as any).detalle || [];
        console.log('[Arqueo] 6. Totales - totalIngresos, totalEgresos, ventasCreditoImporte, cobroCreditosImporte:', {
          totalIngresos: this.totalIngresos,
          totalEgresos: this.totalEgresos,
          ventasCreditoImporte: this.ventasCreditoImporte,
          cobroCreditosImporte: this.cobroCreditosImporte
        });
        console.log('[Arqueo] 7. detalleArqueo (response.detalle):', this.detalleArqueo);
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

  /** Items del primer modal: agrupados por comprobante (Comprobante, Cliente/Proveedor/descripcion, Total). */
  detalleConcepto: { concepto: string; items: { comprobante: string; clienteOrProveedor: string; total: number }[] } | null = null;
  mostrarModalDetalle = false;

  private normConcepto(s: string): string {
    return (s || '').toUpperCase().replace(/_/g, ' ').trim();
  }

  /** Agrupa items por comprobante: una fila por comprobante con Total = suma de importes. */
  private agruparPorComprobante(
    raw: { comprobante: string; clienteOrProveedor: string; importe: number }[]
  ): { comprobante: string; clienteOrProveedor: string; total: number }[] {
    const map = new Map<string, { clienteOrProveedor: string; total: number }>();
    raw.forEach(r => {
      const key = (r.comprobante || '').trim();
      const prev = map.get(key);
      const importe = r.importe;
      if (!prev) {
        map.set(key, { clienteOrProveedor: r.clienteOrProveedor || '', total: importe });
      } else {
        prev.total += importe;
      }
    });
    return Array.from(map.entries()).map(([comprobante, v]) => ({
      comprobante,
      clienteOrProveedor: v.clienteOrProveedor,
      total: v.total
    }));
  }

  /** Abre el modal con el detalle del concepto (response.detalle): Comprobante, Cliente/Proveedor/descripcion, Total por comprobante. */
  verDetalleFila(fila: FilaArqueoConcepto): void {
    const raw = this.detalleArqueo
      .filter(d =>
        this.normConcepto(d.concepto) === this.normConcepto(fila.concepto) &&
        d.tipoOperacion === fila.tipoOperacion
      )
      .map(d => ({
        comprobante: d.comprobante,
        clienteOrProveedor: d.clienteOrProveedor,
        importe: fila.tipoOperacion === 'E' ? -d.importe : d.importe
      }));
    const items = this.agruparPorComprobante(raw);
    this.detalleConcepto = { concepto: fila.concepto, items };
    this.mostrarModalDetalle = true;
  }

  cerrarModalDetalle(): void {
    this.mostrarModalDetalle = false;
    this.detalleConcepto = null;
  }

  /** Subtotal del detalle concepto (suma de totales por comprobante). */
  subtotalDetalleConcepto(): number {
    if (!this.detalleConcepto || !this.detalleConcepto.items.length) return 0;
    return this.detalleConcepto.items.reduce((acc, item) => acc + item.total, 0);
  }

  get totalMovimientosIngresos(): number {
    return this.movimientosIngresos.reduce((acc, m) => acc + m.importe, 0);
  }

  get totalMovimientosEgresos(): number {
    return this.movimientosEgresos.reduce((acc, m) => acc + m.importe, 0);
  }

  /** Solo movimientos con forma de pago Efectivo (restan del efectivo disponible en caja). */
  get totalIngresosEfectivo(): number {
    return this.movimientosIngresos
      .filter(m => (m.formaPago || '').toUpperCase() === 'EFECTIVO')
      .reduce((acc, m) => acc + m.importe, 0);
  }

  /** Solo movimientos con forma de pago Efectivo (restan del efectivo disponible en caja). */
  get totalEgresosEfectivo(): number {
    return this.movimientosEgresos
      .filter(m => (m.formaPago || '').toUpperCase() === 'EFECTIVO')
      .reduce((acc, m) => acc + m.importe, 0);
  }

  /** Efectivo disponible en caja: solo considera movimientos en efectivo; el resto se muestra pero no afecta este saldo. */
  get saldoEfectivoDisponible(): number {
    return this.totalIngresosEfectivo - this.totalEgresosEfectivo;
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
    if (t === 'CONTADO' || t === 'EFECTIVO') return 'EFECTIVO';
    return (formaPago || '').trim() || 'Sin especificar';
  }

  /** Abre el modal de detalle por forma de pago: datos de response.data filtrados por formaPago (Concepto, Forma pago, Total). */
  verDetalleFormaPago(formaPago: string, tipo: 'I' | 'E'): void {
    const items = this.filasArqueoRaw
      .filter(r => r.formaPago === formaPago && r.tipoOperacion === tipo)
      .map(r => ({
        concepto: r.concepto,
        formaPago: r.formaPago,
        importe: r.tipoOperacion === 'E' ? -r.importe : r.importe
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

