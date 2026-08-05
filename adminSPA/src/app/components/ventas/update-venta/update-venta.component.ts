import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import {
  VentasService,
  ComprobantePdfData,
  DetalleVentaEdicionPayload,
  VentaEdicionPayload
} from '../../../services/ventas.service';
import { DocumentoService } from '../../../services/documento.service';
import { FormaPago } from '../../../interfaces/formasPago-interface';
import { BuscadorProductosModalService } from '../../../services/buscador-productos-modal.service';
import { ClienteService } from '../../../services/cliente.service';
import { ProductoSeleccionado } from '../../shared/buscador-productos-modal/buscador-productos-modal.component';
import { ImpuestoService } from '../../../services/impuesto.service';
import { Impuesto } from '../../../interfaces/impuesto.interface';
import {
  armarDetallesConIgv,
  calcularMontoIgv,
  esImpuestoIgv,
  redondear2 as redondearIgv2
} from '../../../utils/venta-igv.util';

export interface ClienteOption {
  idCliente: number;
  rSocial: string;
  ruc: string;
}

declare var iziToast: any;
declare var bootstrap: { Modal: { getOrCreateInstance: (el: HTMLElement) => { show: () => void; hide: () => void }; getInstance: (el: HTMLElement | null) => { hide: () => void } | null } };

interface DetallePagoEdicionUi {
  item: number;
  idFormaPago: number;
  descripcion: string;
  monto: number;
  referencia: string;
}

interface DetalleEdicion {
  idDetalle?: number;
  idProducto: string;
  codigo: string;
  descripcion: string;
  descripcionProducto?: string;
  permiteDescripcionEnVenta?: boolean;
  cantidad: number;
  pVenta: number;
  descuento: number;
  total: number;
}

@Component({
  selector: 'app-update-venta',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './update-venta.component.html',
  styleUrl: './update-venta.component.css'
})
export class UpdateVentaComponent implements OnInit {
  idVenta: number | null = null;
  loading = true;
  saving = false;
  noEditable = false;
  /** Mensaje específico cuando no se puede editar (SUNAT, anulado, plazo cotización). */
  mensajeNoEditable = '';
  compVenta = '';
  fEmision = '';
  /** Fecha/hora de emisión tal cual vino del API (para no perder la hora al guardar con solo `<input type="date">`). */
  fEmisionOriginalCompleta = '';
  idCliente: number | null = null;
  clienteRazonSocial = '';
  clienteRuc = '';
  clientes: ClienteOption[] = [];
  /** Total del comprobante (igual criterio que nueva venta). */
  total = 0;
  /** Suma de cantidad × p. venta (antes de impuestos añadidos). */
  subtotalOperativo = 0;
  montoIgv = 0;
  montoExonerado = 0;
  idSucursal: string | null = null;
  detalles: DetalleEdicion[] = [];

  /** Impuestos activos de la empresa (misma fuente que nueva venta). */
  impuestosActivosEmpresa: Impuesto[] = [];

  formasPago: FormaPago[] = [];
  formaPagoSeleccionada: FormaPago = {
    idFormaPago: 0,
    descripcion: '',
    tipo: 0,
    requiereReferencia: 0,
    activo: 0,
    recibido: 0,
    vuelto: 0,
    referencia: ''
  };
  detallePago: DetallePagoEdicionUi[] = [];
  detailForm = { monto: 0, referencia: '' };
  pagaCon = 0;
  vuelto = 0;
  /** Estado de pago al cargar (1 = pendiente; no se exige coincidencia exacta con el total). */
  idEstadoPagoCargado = 2;
  codigoComprobanteEdicion = '';
  private payloadEdicionPendiente: {
    venta: VentaEdicionPayload;
    detalles: DetalleVentaEdicionPayload[];
  } | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ventasService: VentasService,
    private documentoService: DocumentoService,
    private buscadorProductosModal: BuscadorProductosModalService,
    private clienteService: ClienteService,
    private impuestoService: ImpuestoService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.idVenta = id ? parseInt(id, 10) : null;
    if (this.idVenta == null || isNaN(this.idVenta)) {
      this.loading = false;
      return;
    }

    forkJoin({
      comp: this.ventasService.getComprobanteParaPdf(this.idVenta),
      imp: this.impuestoService.obtenerTodos().pipe(catchError(() => of({ data: [] as Impuesto[] }))),
      formas: this.documentoService.getFormasPago().pipe(catchError(() => of({ data: [] as FormaPago[] })))
    }).subscribe({
      next: ({ comp, imp, formas }) => {
        const list: Impuesto[] = imp?.data || [];
        this.impuestosActivosEmpresa = list.filter((i) => this.impuestoEstaActivo(i));
        this.formasPago = Array.isArray(formas?.data) ? formas.data : [];

        const data: ComprobantePdfData | null = comp?.data ?? null;
        if (!data) {
          this.loading = false;
          return;
        }
        const v = data.venta;
        const idEstadoSunat = v.idEstadoSunat;
        const eliminado = !!v.eliminado;
        const codComp = (v.codigoComprobante || '').trim().toUpperCase();
        const nombreComp = (v.nombreComprobante || '').toLowerCase();
        const esNotaVentaSinSunat = codComp === 'NV' || nombreComp.includes('nota de venta');
        let cotizacionFueraPlazo = false;
        if (codComp === 'CT' || codComp === 'NV') {
          const t = new Date(String(v.fEmision || '').replace(' ', 'T')).getTime();
          cotizacionFueraPlazo = Number.isFinite(t) && Date.now() - t > 24 * 60 * 60 * 1000;
        }
        this.mensajeNoEditable = '';
        if (eliminado) {
          this.noEditable = true;
          this.mensajeNoEditable = 'El comprobante fue anulado. No se puede editar.';
        } else if (!esNotaVentaSinSunat && (idEstadoSunat === 1 || idEstadoSunat === 2 || idEstadoSunat === 3)) {
          this.noEditable = true;
          this.mensajeNoEditable = 'El comprobante ya fue enviado o aceptado en SUNAT. No se puede editar.';
        } else if (cotizacionFueraPlazo) {
          this.noEditable = true;
          this.mensajeNoEditable =
            'La cotización / nota de venta solo puede editarse dentro de las 24 horas posteriores a su emisión.';
        } else if (v.tieneDespachos === true) {
          this.noEditable = true;
          this.mensajeNoEditable =
            'El comprobante tiene despachos registrados. No se puede editar.';
        } else if (v.tieneNotasCreditoDebito === true) {
          this.noEditable = true;
          this.mensajeNoEditable =
            'El comprobante tiene notas de crédito o débito vinculadas. No se puede editar.';
        } else {
          this.noEditable = false;
        }
        this.compVenta = v.compVenta || '';
        this.fEmisionOriginalCompleta = (v.fEmision ?? '').toString().trim();
        this.fEmision = this.fEmisionOriginalCompleta.slice(0, 10);
        this.idCliente = v.idCliente != null ? Number(v.idCliente) : null;
        this.clienteRazonSocial = (data.cliente?.razonSocial || data.cliente?.rSocial || '').toString();
        this.clienteRuc = (data.cliente?.ruc || '').toString();
        this.cargarClientes();
        this.idSucursal = v.idSucursal != null ? String(v.idSucursal) : null;
        this.detalles = (data.items || []).map((d: any) => {
          const descProd = (d.descripcionProducto ?? d.descripcion ?? '').toString();
          const descLin = (d.descripcion ?? '').toString();
          return {
            idDetalle: d.idDetalle,
            idProducto: d.idProducto != null ? String(d.idProducto) : '',
            codigo: d.codigo || '',
            descripcion: descLin,
            descripcionProducto: descProd,
            permiteDescripcionEnVenta: !!(d.permiteDescripcionEnVenta === true || d.permiteDescripcionEnVenta === 1),
            cantidad: Number(d.cantidad) || 0,
            pVenta: Number(d.pVenta) || 0,
            descuento: 0,
            total: Number(d.total) || 0
          };
        });
        this.recalcularTotal();
        this.codigoComprobanteEdicion = (v.codigoComprobante || '').trim().toUpperCase();
        this.idEstadoPagoCargado =
          v.idEstadoPago != null && !Number.isNaN(Number(v.idEstadoPago)) ? Number(v.idEstadoPago) : 2;
        this.initDetallePagoDesdeComprobante(data);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  cargarClientes(): void {
    this.clienteService.obtener_clientes().subscribe({
      next: (res) => {
        const data = res?.data ?? res?.clientes ?? [];
        this.clientes = Array.isArray(data) ? data.map((c: any) => ({
          idCliente: Number(c.idCliente),
          rSocial: (c.rSocial ?? c.r_Social ?? '').toString().trim(),
          ruc: (c.ruc ?? '').toString().trim()
        })) : [];
        if (this.idCliente != null && this.idCliente > 0 && !this.clientes.some((x) => x.idCliente === this.idCliente)) {
          this.clientes = [
            { idCliente: this.idCliente, rSocial: this.clienteRazonSocial || '(Cliente actual)', ruc: this.clienteRuc || '' },
            ...this.clientes
          ];
        }
      },
      error: () => {
        this.clientes = [];
      }
    });
  }

  onClienteChange(): void {
    const c = this.clientes.find((x) => x.idCliente === this.idCliente);
    if (c) {
      this.clienteRazonSocial = c.rSocial;
      this.clienteRuc = c.ruc;
    }
  }

  private redondear2(n: number): number {
    return redondearIgv2(n);
  }

  private impuestoEstaActivo(impuesto: Impuesto): boolean {
    const estado: unknown = (impuesto as { estado?: unknown })?.estado;
    if (estado === true || estado === 1) return true;
    if (estado === false || estado === 0 || estado == null) return false;
    const s = String(estado).trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'activo' || s === 'activa';
  }

  /**
   * Misma lógica que `actualizaTotales` en nueva venta (sin descuento por lista).
   * Actualiza totales de pantalla y líneas `d.total` como importe de línea mostrado (base o bruto según caso).
   */
  recalcularTotal(): void {
    const descuentos = 0;
    let subTotal = 0;
    this.detalles.forEach((item) => {
      const cant = Number(item.cantidad) || 0;
      const pVenta = Number(item.pVenta) || 0;
      subTotal += this.redondear2(pVenta * cant);
    });
    subTotal = this.redondear2(subTotal);
    const neto = this.redondear2(subTotal - descuentos);

    const igvImpuesto = this.impuestosActivosEmpresa.find((i) => esImpuestoIgv(i.descripcion));
    const tieneIGV = !!igvImpuesto;

    let exonerado = 0;
    if (tieneIGV) {
      exonerado = 0;
    } else {
      exonerado = neto;
    }

    const pIncluyeIGV = !!igvImpuesto?.pIncluyeIGV;
    const porcentajeIgv = igvImpuesto ? Number(igvImpuesto.porcentaje) || 0 : 0;
    let igv = 0;
    if (igvImpuesto) {
      igv = calcularMontoIgv(neto, porcentajeIgv, pIncluyeIGV);
    }

    const otrosImpuestos = this.impuestosActivosEmpresa.filter((i) => {
      const d = (i.descripcion || '').toUpperCase();
      return !d.includes('IGV') && d !== 'EXO';
    });

    let totalImpuestosASumar = pIncluyeIGV ? 0 : igv;
    for (const imp of otrosImpuestos) {
      const porcentaje = Number(imp.porcentaje) || 0;
      const monto = this.redondear2(neto * (porcentaje / 100));
      const pIncluyeIGVImp = !!imp.pIncluyeIGV;
      const esISC = (imp.descripcion || '').toUpperCase().includes('ISC');
      if (esISC || !pIncluyeIGVImp) {
        totalImpuestosASumar += monto;
      }
    }

    const totalComprobante = this.redondear2(neto + totalImpuestosASumar);

    this.subtotalOperativo = pIncluyeIGV ? this.redondear2(neto - igv) : subTotal;
    this.montoIgv = igv;
    this.montoExonerado = exonerado;
    this.total = totalComprobante;

    const afectoIgvPorLinea = !!igvImpuesto && porcentajeIgv > 0 && tieneIGV;

    if (afectoIgvPorLinea) {
      const montos = armarDetallesConIgv(
        this.detalles.map((d) => ({
          cantidad: Number(d.cantidad) || 0,
          pVenta: Number(d.pVenta) || 0
        })),
        porcentajeIgv,
        pIncluyeIGV,
        true
      );
      this.montoIgv = this.redondear2(
        montos.reduce((s, m) => s + this.redondear2(m.total - m.subtotal), 0)
      );
      this.detalles.forEach((d, idx) => {
        d.total = montos[idx]?.total ?? this.redondear2((Number(d.cantidad) || 0) * (Number(d.pVenta) || 0));
      });
    } else {
      this.detalles.forEach((d) => {
        const cant = Number(d.cantidad) || 0;
        const p = Number(d.pVenta) || 0;
        d.total = this.redondear2(cant * p);
      });
    }
  }

  formatearMoneda(value: number): string {
    return 'S/ ' + Number(value).toFixed(2);
  }

  private initDetallePagoDesdeComprobante(data: ComprobantePdfData): void {
    this.detallePago = [];
    const rows = data.detallePago || [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const idMp = Number(r.idMediosPago);
      if (!Number.isFinite(idMp) || idMp <= 0) continue;
      const fp = this.formasPago.find((f) => Number(f.idFormaPago) === idMp);
      this.detallePago.push({
        item: this.detallePago.length + 1,
        idFormaPago: idMp,
        descripcion: fp?.descripcion || `Medio ${idMp}`,
        monto: this.redondear2(Number(r.monto) || 0),
        referencia: 'N/A'
      });
    }
    this.detallePago.forEach((row, idx) => {
      row.item = idx + 1;
    });
    const tot = this.redondear2(Number(this.total) || 0);
    if (this.detallePago.length === 0 && tot > 0) {
      const eff = this.formasPago.find((f) => (f.descripcion || '').trim().toUpperCase() === 'EFECTIVO');
      if (eff?.idFormaPago != null) {
        this.detallePago.push({
          item: 1,
          idFormaPago: Number(eff.idFormaPago),
          descripcion: eff.descripcion || 'EFECTIVO',
          monto: tot,
          referencia: 'N/A'
        });
      }
    }
  }

  calcularVuelto(): void {
    this.vuelto = this.redondear2((Number(this.pagaCon) || 0) - (Number(this.total) || 0));
  }

  calcularTotalTablaDetallePago(): number {
    return this.redondear2(
      this.detallePago.reduce((sum, item) => sum + (Number(item.monto) || 0), 0)
    );
  }

  agregarDetallePago(): void {
    const monto = this.redondear2(Number(this.detailForm.monto) || 0);
    const idForma =
      this.formaPagoSeleccionada?.idFormaPago != null ? Number(this.formaPagoSeleccionada.idFormaPago) : 0;
    if (monto <= 0 || !idForma) return;

    const desc =
      this.formasPago.find((f) => Number(f.idFormaPago) === idForma)?.descripcion || 'Pago';
    const ref = (this.detailForm.referencia || '').trim() || 'N/A';

    const existente = this.detallePago.find((d) => Number(d.idFormaPago) === idForma);
    if (existente) {
      existente.monto = this.redondear2((Number(existente.monto) || 0) + monto);
    } else {
      this.detallePago.push({
        item: this.detallePago.length + 1,
        idFormaPago: idForma,
        descripcion: desc,
        monto,
        referencia: ref
      });
      this.detallePago.forEach((item, idx) => {
        item.item = idx + 1;
      });
    }

    this.detailForm.referencia = '';
    this.actualizarMontoSaldo();
  }

  eliminarFilaDetallePago(index: number): void {
    if (index < 0 || index >= this.detallePago.length) return;
    this.detallePago.splice(index, 1);
    this.detallePago.forEach((item, idx) => {
      item.item = idx + 1;
    });
    this.actualizarMontoSaldo();
  }

  normalizarMontoDetallePago(detalle: DetallePagoEdicionUi): void {
    const n = this.redondear2(Number(detalle.monto) || 0);
    detalle.monto = n < 0 ? 0 : n;
    this.actualizarMontoSaldo();
  }

  onMontoTablaDetallePagoChange(): void {
    this.actualizarMontoSaldo();
  }

  getSaldoPendientePago(): number {
    const total = Number(this.total) || 0;
    const pendiente = Math.max(0, total - this.calcularTotalTablaDetallePago());
    return this.redondear2(pendiente);
  }

  actualizarMontoSaldo(): void {
    this.detailForm.monto = this.getSaldoPendientePago();
  }

  private aplicarDetallePagoEfectivoPorDefectoSiVacio(): void {
    if (this.detallePago.length > 0) return;
    const total = this.redondear2(Number(this.total) || 0);
    if (total <= 0) return;
    const efectivo = this.formasPago.find(
      (f) => (f.descripcion || '').trim().toUpperCase() === 'EFECTIVO'
    );
    if (!efectivo?.idFormaPago) return;
    const idForma = Number(efectivo.idFormaPago);
    this.detallePago.push({
      item: 1,
      idFormaPago: idForma,
      descripcion: efectivo.descripcion || 'EFECTIVO',
      monto: total,
      referencia: 'N/A'
    });
  }

  private abrirModalPagoEdicion(): void {
    const efectivo = this.formasPago.find(
      (f) => (f.descripcion || '').trim().toUpperCase() === 'EFECTIVO'
    );
    if (efectivo) {
      this.formaPagoSeleccionada = { ...efectivo };
    }
    this.aplicarDetallePagoEfectivoPorDefectoSiVacio();
    this.actualizarMontoSaldo();
    const total = Number(this.total) || 0;
    this.pagaCon = total;
    this.calcularVuelto();
    const modalEl = document.getElementById('modalPagoEdicion');
    if (!modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl as HTMLElement);
    modal.show();
  }

  private esCotizacionEdicion(): boolean {
    return this.codigoComprobanteEdicion.trim().toUpperCase() === 'CT';
  }

  confirmarGuardarConPago(): void {
    if (!this.payloadEdicionPendiente || this.idVenta == null) return;

    const totalVenta = this.redondear2(Number(this.total) || 0);
    const totalPago = this.calcularTotalTablaDetallePago();
    const esPagoPendiente = this.idEstadoPagoCargado === 1;
    if (!this.esCotizacionEdicion() && !esPagoPendiente && totalPago > 0 && Math.abs(totalPago - totalVenta) > 0.01) {
      iziToast.warning({
        title: 'Advertencia',
        message: 'El total del detalle de pago no coincide con el total del comprobante.'
      });
      return;
    }

    const detallePagoApi = this.detallePago
      .map((d) => ({
        idMediosPago: Number(d.idFormaPago),
        monto: this.redondear2(Number(d.monto) || 0)
      }))
      .filter((x) => x.idMediosPago > 0 && x.monto > 0);

    if (detallePagoApi.length === 0) {
      iziToast.warning({
        title: 'Advertencia',
        message: 'Agregue al menos una forma de pago con monto mayor a cero.'
      });
      return;
    }

    const modalEl = document.getElementById('modalPagoEdicion');
    const inst = bootstrap.Modal.getInstance(modalEl);
    inst?.hide();

    this.saving = true;
    this.ventasService
      .actualizarVenta(this.idVenta, {
        ...this.payloadEdicionPendiente,
        detallePago: detallePagoApi
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.payloadEdicionPendiente = null;
          iziToast.success({ title: 'Éxito', message: 'Venta actualizada.' });
          this.router.navigate(['/ventas']);
        },
        error: (err) => {
          this.saving = false;
          const msg = err?.error?.error || err?.message || 'Error al actualizar.';
          iziToast.error({ title: 'Error', message: msg });
        }
      });
  }

  eliminarDetalle(index: number): void {
    if (index >= 0 && index < this.detalles.length) {
      this.detalles.splice(index, 1);
      this.recalcularTotal();
    }
  }

  private descripcionLineaEdicion(d: DetalleEdicion): string | undefined {
    if (!d.permiteDescripcionEnVenta) return undefined;
    const cur = (d.descripcion ?? '').trim();
    const orig = (d.descripcionProducto ?? '').trim();
    if (!cur || cur === orig) return undefined;
    return cur.length > 500 ? cur.slice(0, 500) : cur;
  }

  agregarProductos(): void {
    const idSucursal = this.idSucursal || undefined;
    this.buscadorProductosModal.abrir({ idSucursal }).then((producto: ProductoSeleccionado | null) => {
      if (producto == null) return;
      const pVenta = Number(producto.pVenta) || 0;
      const desc = (producto.descripcion ?? '').toString();
      const perm = !!(producto as { permiteDescripcionEnVenta?: boolean }).permiteDescripcionEnVenta;
      this.detalles.push({
        idProducto: producto.idProducto ?? '',
        codigo: producto.codigo ?? '',
        descripcion: desc,
        descripcionProducto: desc,
        permiteDescripcionEnVenta: perm,
        cantidad: 1,
        pVenta,
        descuento: 0,
        total: pVenta
      });
      this.recalcularTotal();
    });
  }

  volver(): void {
    this.router.navigate(['/ventas']);
  }

  /** Extrae HH:mm:ss de un string de fecha/hora del backend. */
  private extraerHoraFEmisionDesdeTexto(s: string): string {
    if (!s) return '00:00:00';
    const t = s.replace('T', ' ');
    const m = t.match(/(\d{2}:\d{2}:\d{2})/);
    return m ? m[1] : '00:00:00';
  }

  /**
   * Combina la fecha del formulario con la hora original de emisión (misma lógica que debe aplicar el backend para NV/CT).
   */
  private fEmisionParaGuardarVenta(): string {
    const fechaForm = (this.fEmision || '').trim().slice(0, 10);
    const orig = (this.fEmisionOriginalCompleta || '').trim();
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const ahoraIso = (): string => {
      const n = new Date();
      return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}T${pad2(n.getHours())}:${pad2(n.getMinutes())}:${pad2(n.getSeconds())}`;
    };
    if (!fechaForm) {
      if (orig) {
        const n = orig.replace(' ', 'T');
        return n.length >= 19 ? n.slice(0, 19) : ahoraIso();
      }
      return ahoraIso();
    }
    const hora = this.extraerHoraFEmisionDesdeTexto(orig);
    return `${fechaForm}T${hora}`;
  }

  /**
   * Arma cabecera y detalle persistibles, alineados con nueva venta y con líneas gravadas
   * (subtotal base, total con IGV) para coherencia en JSON SUNAT.
   */
  private construirPayloadGuardado(): {
    venta: VentaEdicionPayload;
    detalles: DetalleVentaEdicionPayload[];
  } {
    const descuentos = 0;
    let subTotal = 0;
    this.detalles.forEach((item) => {
      const cant = Number(item.cantidad) || 0;
      const pVenta = Number(item.pVenta) || 0;
      subTotal += this.redondear2(pVenta * cant);
    });
    subTotal = this.redondear2(subTotal);
    const neto = this.redondear2(subTotal - descuentos);

    const igvImpuesto = this.impuestosActivosEmpresa.find((i) => esImpuestoIgv(i.descripcion));
    const tieneIGV = !!igvImpuesto;
    const porcentajeIgv = igvImpuesto ? Number(igvImpuesto.porcentaje) || 0 : 0;
    const pIncluyeIGV = !!igvImpuesto?.pIncluyeIGV;

    let exonerado = 0;
    if (!tieneIGV) {
      exonerado = neto;
    }

    const igvMonto = igvImpuesto
      ? calcularMontoIgv(neto, porcentajeIgv, pIncluyeIGV)
      : 0;

    const otrosImpuestos = this.impuestosActivosEmpresa.filter((i) => {
      const d = (i.descripcion || '').toUpperCase();
      return !d.includes('IGV') && d !== 'EXO';
    });

    let otrosSinIgv = 0;
    for (const imp of otrosImpuestos) {
      const porcentaje = Number(imp.porcentaje) || 0;
      const monto = this.redondear2(neto * (porcentaje / 100));
      const pIncluyeIGVImp = !!imp.pIncluyeIGV;
      const esISC = (imp.descripcion || '').toUpperCase().includes('ISC');
      if (esISC || !pIncluyeIGVImp) {
        otrosSinIgv += monto;
      }
    }
    otrosSinIgv = this.redondear2(otrosSinIgv);

    const montosLinea = armarDetallesConIgv(
      this.detalles.map((d) => ({
        cantidad: Number(d.cantidad) || 0,
        pVenta: Number(d.pVenta) || 0
      })),
      porcentajeIgv,
      pIncluyeIGV,
      tieneIGV
    );

    const detallesPayload: DetalleVentaEdicionPayload[] = this.detalles.map((d, idx) => {
      const m = montosLinea[idx];
      return {
        ...(d.idDetalle != null && d.idDetalle > 0 ? { idDetalle: d.idDetalle } : {}),
        idProducto: d.idProducto,
        cantidad: d.cantidad,
        pVenta: d.pVenta,
        descuento: d.descuento,
        subtotal: m.subtotal,
        total: m.total,
        igv: m.igv,
        descripcionLinea: this.descripcionLineaEdicion(d)
      };
    });

    const igvPersistido = this.redondear2(
      montosLinea.reduce((s, m) => s + this.redondear2(m.total - m.subtotal), 0)
    );
    const igvFinal = igvPersistido > 0 ? igvPersistido : igvMonto;
    const baseImponible = pIncluyeIGV
      ? this.redondear2(neto - igvFinal)
      : neto;
    const totalComprobante = pIncluyeIGV
      ? this.redondear2(neto + otrosSinIgv)
      : this.redondear2(neto + igvFinal + otrosSinIgv);

    const venta: VentaEdicionPayload = {
      fEmision: this.fEmisionParaGuardarVenta(),
      idCliente: this.idCliente != null && this.idCliente > 0 ? this.idCliente : undefined,
      subtotal: baseImponible,
      igv: igvFinal,
      exonerado,
      gratuito: 0,
      otrosCargos: 0,
      descuentos,
      total: totalComprobante
    };

    return { venta, detalles: detallesPayload };
  }

  guardar(): void {
    if (this.idVenta == null || this.noEditable) return;
    if (this.detalles.length === 0) {
      iziToast.warning({ title: 'Advertencia', message: 'Agregue al menos un ítem.' });
      return;
    }

    this.payloadEdicionPendiente = this.construirPayloadGuardado();

    if (this.idEstadoPagoCargado === 1 || this.esCotizacionEdicion()) {
      this.guardarSinFormaPago();
      return;
    }

    if (this.formasPago.length === 0) {
      iziToast.warning({
        title: 'Advertencia',
        message: 'No se pudieron cargar las formas de pago. Intente de nuevo.'
      });
      return;
    }
    this.abrirModalPagoEdicion();
  }

  private guardarSinFormaPago(): void {
    if (!this.payloadEdicionPendiente || this.idVenta == null) return;

    this.saving = true;
    this.ventasService
      .actualizarVenta(this.idVenta, { ...this.payloadEdicionPendiente })
      .subscribe({
        next: () => {
          this.saving = false;
          this.payloadEdicionPendiente = null;
          iziToast.success({ title: 'Éxito', message: 'Venta actualizada.' });
          this.router.navigate(['/ventas']);
        },
        error: (err) => {
          this.saving = false;
          const msg = err?.error?.error || err?.message || 'Error al actualizar.';
          iziToast.error({ title: 'Error', message: msg });
        }
      });
  }
}
