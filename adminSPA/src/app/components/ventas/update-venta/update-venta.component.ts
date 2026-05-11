import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { VentasService, ComprobantePdfData, DetalleVentaEdicionPayload, VentaEdicionPayload } from '../../../services/ventas.service';
import { BuscadorProductosModalService } from '../../../services/buscador-productos-modal.service';
import { ClienteService } from '../../../services/cliente.service';
import { ProductoSeleccionado } from '../../shared/buscador-productos-modal/buscador-productos-modal.component';
import { ImpuestoService } from '../../../services/impuesto.service';
import { Impuesto } from '../../../interfaces/impuesto.interface';

export interface ClienteOption {
  idCliente: number;
  rSocial: string;
  ruc: string;
}

declare var iziToast: any;

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
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent],
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ventasService: VentasService,
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
      imp: this.impuestoService.obtenerTodos().pipe(catchError(() => of({ data: [] as Impuesto[] })))
    }).subscribe({
      next: ({ comp, imp }) => {
        const list: Impuesto[] = imp?.data || [];
        this.impuestosActivosEmpresa = list.filter((i) => this.impuestoEstaActivo(i));

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
        this.fEmision = (v.fEmision || '').toString().slice(0, 10);
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
    return Math.round((Number(n) || 0) * 100) / 100;
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

    const tieneIGV = this.impuestosActivosEmpresa.some((i) =>
      (i.descripcion || '').toUpperCase().includes('IGV')
    );

    let exonerado = 0;
    if (tieneIGV) {
      exonerado = 0;
    } else {
      exonerado = neto;
    }

    const igvImpuesto = this.impuestosActivosEmpresa.find((i) =>
      (i.descripcion || '').toUpperCase().includes('IGV')
    );

    let igv = 0;
    if (igvImpuesto) {
      const porcentaje = Number(igvImpuesto.porcentaje) || 0;
      const igvMontoCalc = this.redondear2(neto * (porcentaje / 100));
      const pIncluyeIGV = !!igvImpuesto.pIncluyeIGV;
      if (!pIncluyeIGV) {
        igv = igvMontoCalc;
      }
    }

    const otrosImpuestos = this.impuestosActivosEmpresa.filter((i) => {
      const d = (i.descripcion || '').toUpperCase();
      return !d.includes('IGV') && d !== 'EXO';
    });

    let totalImpuestosASumar = igv;
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

    this.subtotalOperativo = subTotal;
    this.montoIgv = igv;
    this.montoExonerado = exonerado;
    this.total = totalComprobante;

    const porcentajeIgv = igvImpuesto ? Number(igvImpuesto.porcentaje) || 0 : 0;
    const pIncluyeIGV = !!igvImpuesto?.pIncluyeIGV;
    const afectoIgvPorLinea =
      !!igvImpuesto && !pIncluyeIGV && porcentajeIgv > 0 && tieneIGV;

    if (afectoIgvPorLinea) {
      const bases = this.detalles.map((d) => {
        const cant = Number(d.cantidad) || 0;
        const p = Number(d.pVenta) || 0;
        return this.redondear2(cant * p);
      });
      const igvLines = bases.map((b) => this.redondear2(b * (porcentajeIgv / 100)));
      let sumIgvLines = this.redondear2(igvLines.reduce((a, b) => a + b, 0));
      const diff = this.redondear2(igv - sumIgvLines);
      if (igvLines.length && Math.abs(diff) >= 0.005) {
        igvLines[igvLines.length - 1] = this.redondear2(igvLines[igvLines.length - 1] + diff);
      }
      this.montoIgv = this.redondear2(igvLines.reduce((a, b) => a + b, 0));
      this.detalles.forEach((d, idx) => {
        const base = bases[idx];
        const igvL = igvLines[idx];
        d.total = this.redondear2(base + igvL);
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
    this.buscadorProductosModal.abrir(idSucursal).then((producto: ProductoSeleccionado | null) => {
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

    const tieneIGV = this.impuestosActivosEmpresa.some((i) =>
      (i.descripcion || '').toUpperCase().includes('IGV')
    );

    let exonerado = 0;
    if (tieneIGV) {
      exonerado = 0;
    } else {
      exonerado = neto;
    }

    const igvImpuesto = this.impuestosActivosEmpresa.find((i) =>
      (i.descripcion || '').toUpperCase().includes('IGV')
    );

    const porcentajeIgv = igvImpuesto ? Number(igvImpuesto.porcentaje) || 0 : 0;
    const pIncluyeIGV = !!igvImpuesto?.pIncluyeIGV;

    let igvMonto = 0;
    if (igvImpuesto && !pIncluyeIGV) {
      igvMonto = this.redondear2(neto * (porcentajeIgv / 100));
    }

    const otrosImpuestos = this.impuestosActivosEmpresa.filter((i) => {
      const d = (i.descripcion || '').toUpperCase();
      return !d.includes('IGV') && d !== 'EXO';
    });

    let totalImpuestosASumar = igvMonto;
    for (const imp of otrosImpuestos) {
      const porcentaje = Number(imp.porcentaje) || 0;
      const monto = this.redondear2(neto * (porcentaje / 100));
      const pIncluyeIGVImp = !!imp.pIncluyeIGV;
      const esISC = (imp.descripcion || '').toUpperCase().includes('ISC');
      if (esISC || !pIncluyeIGVImp) {
        totalImpuestosASumar += monto;
      }
    }

    const otrosSinIgv = this.redondear2(totalImpuestosASumar - igvMonto);

    const detallesPayload: DetalleVentaEdicionPayload[] = [];
    const afectoIgvPorLinea =
      !!igvImpuesto && !pIncluyeIGV && porcentajeIgv > 0 && tieneIGV;

    if (afectoIgvPorLinea) {
      const bases = this.detalles.map((d) => {
        const cant = Number(d.cantidad) || 0;
        const p = Number(d.pVenta) || 0;
        return this.redondear2(cant * p);
      });
      const igvLines = bases.map((b) => this.redondear2(b * (porcentajeIgv / 100)));
      let sumIgvLines = this.redondear2(igvLines.reduce((a, b) => a + b, 0));
      const diff = this.redondear2(igvMonto - sumIgvLines);
      if (igvLines.length && Math.abs(diff) >= 0.005) {
        igvLines[igvLines.length - 1] = this.redondear2(igvLines[igvLines.length - 1] + diff);
      }
      sumIgvLines = this.redondear2(igvLines.reduce((a, b) => a + b, 0));

      this.detalles.forEach((d, idx) => {
        const subL = bases[idx];
        const totL = this.redondear2(subL + igvLines[idx]);
        detallesPayload.push({
          idProducto: d.idProducto,
          cantidad: d.cantidad,
          pVenta: d.pVenta,
          descuento: d.descuento,
          subtotal: subL,
          total: totL,
          igv: true,
          descripcionLinea: this.descripcionLineaEdicion(d)
        });
      });

      const totalComprobante = this.redondear2(neto + sumIgvLines + otrosSinIgv);

      const venta: VentaEdicionPayload = {
        fEmision: this.fEmision
          ? this.fEmision + 'T00:00:00'
          : (() => {
              const n = new Date();
              const y = n.getFullYear(),
                m = String(n.getMonth() + 1).padStart(2, '0'),
                d = String(n.getDate()).padStart(2, '0');
              return `${y}-${m}-${d}T00:00:00`;
            })(),
        idCliente: this.idCliente != null && this.idCliente > 0 ? this.idCliente : undefined,
        subtotal: neto,
        igv: sumIgvLines,
        exonerado,
        gratuito: 0,
        otrosCargos: 0,
        descuentos,
        total: totalComprobante
      };

      return { venta, detalles: detallesPayload };
    }

    this.detalles.forEach((d) => {
      const cant = Number(d.cantidad) || 0;
      const p = Number(d.pVenta) || 0;
      const subL = this.redondear2(cant * p);
      detallesPayload.push({
        ...(d.idDetalle != null && d.idDetalle > 0 ? { idDetalle: d.idDetalle } : {}),
        idProducto: d.idProducto,
        cantidad: d.cantidad,
        pVenta: d.pVenta,
        descuento: d.descuento,
        subtotal: subL,
        total: subL,
        igv: false,
        descripcionLinea: this.descripcionLineaEdicion(d)
      });
    });

    const totalComprobante = this.redondear2(neto + totalImpuestosASumar);

    const venta: VentaEdicionPayload = {
      fEmision: this.fEmision
        ? this.fEmision + 'T00:00:00'
        : (() => {
            const n = new Date();
            const y = n.getFullYear(),
              m = String(n.getMonth() + 1).padStart(2, '0'),
              d = String(n.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}T00:00:00`;
          })(),
      idCliente: this.idCliente != null && this.idCliente > 0 ? this.idCliente : undefined,
      subtotal: subTotal,
      igv: igvMonto,
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
    this.saving = true;
    const { venta: ventaPayload, detalles: detallesPayload } = this.construirPayloadGuardado();
    this.ventasService.actualizarVenta(this.idVenta, { venta: ventaPayload, detalles: detallesPayload }).subscribe({
      next: () => {
        this.saving = false;
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
