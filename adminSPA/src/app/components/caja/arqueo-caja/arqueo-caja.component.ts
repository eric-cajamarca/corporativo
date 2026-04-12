import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CajaService } from '../../../services/caja.service';
import { PdfService } from '../../../services/pdf.service';
import { EmpresaService } from '../../../services/empresa.service';
import { DocumentoService } from '../../../services/documento.service';
import { WhatsappService } from '../../../services/whatsapp.service';
import { Caja } from '../../../interfaces/caja-interface';
import { Empresa } from '../../../interfaces/pdf-interface';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var iziToast: any;

export interface FilaArqueoConcepto {
  concepto: string;
  tipoOperacion: 'I' | 'E';
  importe: number;
  icono: string;
  /** Si true, no hay filas en detalle de caja (SUNAT/movimientos); ocultar botón Detalle. */
  sinDetalle?: boolean;
}

export interface ArqueoTotalesPorEmpresaFila {
  idEmpresa: string;
  razonSocial: string;
  movimientos: { concepto: string; tipoOperacion: string; formaPago: string; importe: number }[];
  ventasCredito?: { importe?: number };
  cobroCreditos?: { importe?: number };
  totalIngresos: number;
  totalEgresos: number;
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

  public esGestora = false;
  public totalesPorEmpresa: ArqueoTotalesPorEmpresaFila[] = [];

  mostrarModalPdf = false;
  generandoPdf = false;
  empresa: Empresa | null = null;
  mostrarWhatsappForm = false;
  whatsappNumber = '';
  whatsappFormato: 'A4' | 'A5' | 'ticket' = 'A4';
  enviandoWhatsapp = false;
  whatsappMensaje: string | null = null;

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
    private pdfService: PdfService,
    private empresaService: EmpresaService,
    private documentoService: DocumentoService,
    private whatsappService: WhatsappService,
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

  private static totalesDesdeFilasMovimiento(
    filas: { tipoOperacion?: string; importe?: number }[]
  ): { ingresos: number; egresos: number } {
    let ingresos = 0;
    let egresos = 0;
    for (const r of filas || []) {
      const tipo = (r.tipoOperacion || 'I') === 'I' ? 'I' : 'E';
      const imp = Number(r.importe || 0);
      if (tipo === 'I') ingresos += imp;
      else egresos += imp;
    }
    return { ingresos, egresos };
  }

  ngOnInit(): void {
    this.fecha = ArqueoCajaComponent.fechaLocalHoy();
    this.cargarCajas();
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (res) => {
        this.esGestora = !!res?.data?.esGestora;
        this.consultar();
      },
      error: () => {
        this.esGestora = false;
        this.consultar();
      }
    });
    this.empresaService.getEmpresa$().subscribe((emp) => {
      const e = emp as any;
      const razonSocial = e?.razon_Social ?? e?.nombre ?? '';
      const nombreValido = (razonSocial && razonSocial !== 'Nombre Predeterminado') ? razonSocial : '';
      this.empresa = emp ? {
        logo: e?.logo ?? '',
        nombre: nombreValido,
        ruc: e?.ruc ?? '',
        direccion: e?.direccion ?? '',
        telefono: e?.celular ?? e?.telefono ?? ''
      } : null;
    });
  }

  /** Se ejecuta al cambiar fecha inicial o final para recargar los datos. */
  onFechaChange(): void {
    this.consultar();
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
    this.totalesPorEmpresa = [];

    // Llamada al backend: devuelve data (filas crudas), ventasCredito y cobroCreditos
    this.cajaService.obtenerArqueoDinamico({
      fecha: !usaRango ? this.fecha : undefined,
      fechaInicial: usaRango ? this.fecha : undefined,
      fechaFinal: usaRango ? this.fechaFinal : undefined,
      idCaja: this.cajaSeleccionada
    }).subscribe({
      next: (response) => {
        
        const filas: { concepto: string; tipoOperacion: string; formaPago: string; importe: number }[] = response.data || [];
        
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
                        
        // Resumen por concepto (ej. VENTA CONTADO, APERTURA_CAJA): con icono y signo (egresos negativos)
        this.ventasCreditoImporte = this.importeArqueoCredito((response as any).ventasCredito);
        this.cobroCreditosImporte = this.importeArqueoCredito((response as any).cobroCreditos);

        const baseResumen = Array.from(conceptosMap.entries())
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

        this.resumenConceptos = [
          ...baseResumen,
          {
            concepto: 'Venta al crédito',
            tipoOperacion: 'I',
            importe: this.ventasCreditoImporte,
            icono: 'bi bi-credit-card-2-front',
            sinDetalle: true
          },
          {
            concepto: 'Cobro de créditos',
            tipoOperacion: 'I',
            importe: this.cobroCreditosImporte,
            icono: 'bi bi-cash-coin',
            sinDetalle: true
          }
        ];

        // Filas crudas para detalle; ingresos/egresos agrupados por forma de pago (modales)
        this.filasArqueoRaw = filas.map((r: any) => ({
          concepto: (r.concepto || 'Sin especificar').replace(/_/g, ' '),
          tipoOperacion: (r.tipoOperacion || 'I') === 'I' ? 'I' : 'E',
          formaPago: this.normalizarFormaPago(r.formaPago || 'Sin especificar'),
          importe: Number(r.importe || 0)
        }));
        this.movimientosIngresos = Array.from(ingresosMap.entries()).map(([formaPago, importe]) => ({ formaPago, importe }));
        this.movimientosEgresos = Array.from(egresosMap.entries()).map(([formaPago, importe]) => ({ formaPago, importe }));
                        
        // Totales desde filas de caja (sin las dos filas informativas de crédito, para no mezclar con efectivo)
        this.totalIngresos = baseResumen.filter(c => c.tipoOperacion === 'I').reduce((acc, c) => acc + c.importe, 0);
        this.totalEgresos = baseResumen.filter(c => c.tipoOperacion === 'E').reduce((acc, c) => acc + Math.abs(c.importe), 0);
        this.detalleArqueo = (response as any).detalle || [];
        const porEmp = (response as any).totalesPorEmpresa;
        if (Array.isArray(porEmp) && porEmp.length > 0) {
          this.totalesPorEmpresa = porEmp.map((pe: any) => {
            const t = ArqueoCajaComponent.totalesDesdeFilasMovimiento(pe.movimientos || []);
            return {
              idEmpresa: pe.idEmpresa,
              razonSocial: pe.razonSocial || '',
              movimientos: pe.movimientos || [],
              ventasCredito: pe.ventasCredito,
              cobroCreditos: pe.cobroCreditos,
              totalIngresos: t.ingresos,
              totalEgresos: t.egresos
            };
          });
        }
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

  /** Total primera tabla: solo resta efectivo en Compra al contado; el resto de compras al contado (Yape, transferencia, etc.) se muestra pero no afecta. */
  get totalConceptos(): number {
    if (!this.filasArqueoRaw || this.filasArqueoRaw.length === 0) {
      return this.resumenConceptos.reduce((acc, f) => acc + f.importe, 0);
    }
    return this.filasArqueoRaw.reduce((acc, r) => {
      const conceptoNorm = this.normConcepto(r.concepto || '');
      const isCompraContadoEgreso = conceptoNorm === 'COMPRA CONTADO' && r.tipoOperacion === 'E';
      const formaNorm = this.normalizarFormaPago(r.formaPago || '');
      const isEfectivo = formaNorm === 'EFECTIVO';
      if (isCompraContadoEgreso && !isEfectivo) return acc;
      const sign = r.tipoOperacion === 'E' ? -1 : 1;
      return acc + sign * (r.importe || 0);
    }, 0);
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

  /** Indica si hay movimientos cargados (habilita PDF, Imprimir, Guardar). */
  get tieneMovimientos(): boolean {
    return (this.filasArqueoRaw && this.filasArqueoRaw.length > 0) || (this.resumenConceptos && this.resumenConceptos.length > 0);
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

  /** Normaliza importe devuelto por API (string/Decimal) en filas ventasCredito / cobroCreditos por empresa. */
  importeArqueoCredito(bloque: { importe?: unknown } | undefined): number {
    if (!bloque || bloque.importe == null) return 0;
    const n = Number(bloque.importe);
    return Number.isFinite(n) ? n : 0;
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

  abrirModalPdf(): void {
    this.mostrarWhatsappForm = false;
    this.whatsappMensaje = null;
    this.mostrarModalPdf = true;
  }

  cerrarModalPdf(): void {
    this.mostrarModalPdf = false;
    this.mostrarWhatsappForm = false;
    this.whatsappMensaje = null;
  }

  private getDatosArqueoPdf(): Record<string, unknown> {
    const cajaNombre = this.cajaSeleccionada === 'TODAS' ? 'Todas' : (this.cajas.find((c) => c.idCaja === this.cajaSeleccionada)?.nombre ?? '');
    return {
      empresa: this.empresa ?? {},
      fecha: this.fecha,
      fechaFinal: this.fechaFinal || undefined,
      cajaNombre,
      resumenConceptos: this.resumenConceptos,
      movimientosIngresos: this.movimientosIngresos,
      movimientosEgresos: this.movimientosEgresos,
      totalConceptos: this.totalConceptos,
      totalMovimientosIngresos: this.totalMovimientosIngresos,
      totalMovimientosEgresos: this.totalMovimientosEgresos,
      saldoEfectivoDisponible: this.saldoEfectivoDisponible,
      nombreArchivo: `arqueo-caja-${this.fecha}${this.fechaFinal ? '-' + this.fechaFinal : ''}.pdf`
    };
  }

  generarPdf(formato: 'A4' | 'A5' | 'ticket'): void {
    this.generandoPdf = true;
    const datos = this.getDatosArqueoPdf();
    const nombreArchivo = (datos['nombreArchivo'] as string) || 'arqueo-caja.pdf';
    this.pdfService.generarPdfArqueoCaja(datos as any, formato, nombreArchivo).subscribe({
      next: (blob) => {
        this.pdfService.previsualizar(blob);
        this.generandoPdf = false;
      },
      error: (err) => {
        this.generandoPdf = false;
        iziToast.error({ title: 'Error', message: err?.error?.error || err?.message || 'Error al generar el PDF.' });
      }
    });
  }

  abrirFormWhatsapp(): void {
    this.mostrarWhatsappForm = true;
    this.whatsappMensaje = null;
  }

  enviarPdfPorWhatsapp(): void {
    if (!this.whatsappNumber.trim()) {
      this.whatsappMensaje = 'Ingrese el número de WhatsApp (ej. 51999999999).';
      return;
    }
    this.enviandoWhatsapp = true;
    this.whatsappMensaje = null;
    const datos = this.getDatosArqueoPdf();
    const nombreArchivo = (datos['nombreArchivo'] as string) || 'arqueo-caja.pdf';
    this.pdfService.generarPdfArqueoCaja(datos as any, this.whatsappFormato, nombreArchivo).subscribe({
      next: (blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : dataUrl;
          this.whatsappService.enviarArchivo(this.whatsappNumber.trim(), base64, nombreArchivo, 'document').subscribe({
            next: (res) => {
              this.enviandoWhatsapp = false;
              this.whatsappMensaje = res.message;
              if (res.success) setTimeout(() => this.cerrarModalPdf(), 2000);
            },
            error: (err) => {
              this.enviandoWhatsapp = false;
              this.whatsappMensaje = err?.error?.message || err?.message || 'Error al enviar por WhatsApp.';
            }
          });
        };
        reader.readAsDataURL(blob);
      },
      error: (err) => {
        this.enviandoWhatsapp = false;
        this.whatsappMensaje = err?.error?.error || err?.message || 'Error al generar el PDF.';
      }
    });
  }

  imprimir(): void {
    const ventana = window.open('', '_blank');
    if (!ventana) return;
    const cajaNombre = this.cajaSeleccionada === 'TODAS' ? 'Todas' : (this.cajas.find((c) => c.idCaja === this.cajaSeleccionada)?.nombre ?? '');
    const rango = this.fechaFinal ? `${this.fecha} - ${this.fechaFinal}` : this.fecha;
    const filasConceptos = this.resumenConceptos.map((r) =>
      `<tr><td>${r.concepto}</td><td class="text-end">${r.importe >= 0 ? '+' : ''}${this.formatCurrency(r.importe)}</td></tr>`
    ).join('');
    const filasIngresos = this.movimientosIngresos.map((m) =>
      `<tr><td>${m.formaPago}</td><td class="text-end">${this.formatCurrency(m.importe)}</td></tr>`
    ).join('');
    const filasEgresos = this.movimientosEgresos.map((m) =>
      `<tr><td>${m.formaPago}</td><td class="text-end">${this.formatCurrency(m.importe)}</td></tr>`
    ).join('');
    ventana.document.write(`
      <!DOCTYPE html>
      <html><head><title>Arqueo de Caja</title>
      <style>
        body{font-family:arial,sans-serif;font-size:12px;padding:20px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #ccc;padding:8px}
        th{background:#f2f2f2}
        .text-end{text-align:right}
        h2{color:#0056b3;margin-top:20px}
        .saldo{background:#e8f4fd;padding:12px;margin-top:15px;font-weight:bold;border:1px solid #0056b3}
      </style></head>
      <body>
        <h1>Arqueo de Caja</h1>
        <p><strong>Período:</strong> ${rango} | <strong>Caja:</strong> ${cajaNombre}</p>
        <h2>Resumen por concepto</h2>
        <table><thead><tr><th>Concepto</th><th class="text-end">Importe</th></tr></thead><tbody>${filasConceptos}</tbody>
        <tfoot><tr><td><strong>Total</strong></td><td class="text-end"><strong>${this.formatCurrency(this.totalConceptos)}</strong></td></tr></tfoot></table>
        <h2>Movimientos de Ingresos</h2>
        <table><thead><tr><th>Forma Pago</th><th class="text-end">Importe</th></tr></thead><tbody>${filasIngresos}</tbody>
        <tfoot><tr><td><strong>Total</strong></td><td class="text-end"><strong>${this.formatCurrency(this.totalMovimientosIngresos)}</strong></td></tr></tfoot></table>
        <h2>Movimientos de Egresos</h2>
        <table><thead><tr><th>Forma Pago</th><th class="text-end">Importe</th></tr></thead><tbody>${filasEgresos}</tbody>
        <tfoot><tr><td><strong>Total</strong></td><td class="text-end"><strong>${this.formatCurrency(this.totalMovimientosEgresos)}</strong></td></tr></tfoot></table>
        <div class="saldo">Efectivo disponible en caja: ${this.formatCurrency(this.saldoEfectivoDisponible)}</div>
      </body></html>
    `);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => { ventana.print(); ventana.close(); }, 500);
  }

  guardarSaldoAnterior(): void {
    const saldo = this.saldoEfectivoDisponible;
    if (saldo <= 0) {
      iziToast.warning({ title: 'Advertencia', message: 'El saldo efectivo disponible debe ser mayor a 0 para generar el recibo de saldo anterior.' });
      return;
    }
    const cajasAbiertas = this.cajas.filter((c: any) => c.cajaAbierta && c.idApertura);
    if (cajasAbiertas.length === 0) {
      iziToast.warning({ title: 'Advertencia', message: 'No hay caja abierta. Debe abrir una caja para registrar el saldo anterior.' });
      return;
    }
    const caja = this.cajaSeleccionada === 'TODAS' ? cajasAbiertas[0] : cajasAbiertas.find((c: any) => c.idCaja === this.cajaSeleccionada);
    if (!caja) {
      iziToast.warning({ title: 'Advertencia', message: 'La caja seleccionada no está abierta. Seleccione otra caja.' });
      return;
    }
    const fechaBase = this.fechaFinal || this.fecha;
    const [y, m, d] = fechaBase.split('-').map(Number);
    const diaSiguiente = new Date(y, m - 1, d + 1);
    const fechaSiguiente = `${diaSiguiente.getFullYear()}-${String(diaSiguiente.getMonth() + 1).padStart(2, '0')}-${String(diaSiguiente.getDate()).padStart(2, '0')}`;
    this.documentoService.getFormasPago().subscribe({
      next: (r) => {
        const formasPago = r.data || [];
        const efectivo = formasPago.find((f: any) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
        const idFormaPago = efectivo?.idFormaPago ?? formasPago[0]?.idFormaPago;
        if (!idFormaPago) {
          iziToast.error({ title: 'Error', message: 'No hay forma de pago Efectivo configurada.' });
          return;
        }
        this.cajaService.obtenerTiposMovimiento().subscribe({
          next: (tiposRes) => {
            const tiposIngreso = (tiposRes.data || []).filter((t: any) => t.tipo === 'I');
            const idTipo = tiposIngreso[0]?.idTipoMovimientoCaja;
            if (!idTipo) {
              iziToast.error({ title: 'Error', message: 'No hay tipo de movimiento Ingreso configurado.' });
              return;
            }
            this.cajaService.registrarMovimientoIngreso({
              idApertura: (caja as any).idApertura,
              idTipoMovimientoCaja: idTipo,
              fechaMovimiento: fechaSiguiente + 'T00:00:00',
              concepto: 'Saldo del día anterior',
              monto: saldo,
              idMediosPago: idFormaPago,
              documentoRelacionado: `SA ${fechaSiguiente}`,
              observaciones: `Saldo anterior del día ${this.fecha}${this.fechaFinal ? ' al ' + this.fechaFinal : ''}. Generado desde arqueo.`
            }).subscribe({
              next: () => {
                iziToast.success({ title: 'Éxito', message: 'Recibo de ingreso "Saldo del día anterior" registrado para el ' + fechaSiguiente + '.' });
                this.consultar();
              },
              error: (e) => {
                iziToast.error({ title: 'Error', message: e.error?.message || 'Error al guardar.' });
              }
            });
          },
          error: () => iziToast.error({ title: 'Error', message: 'No se pudieron cargar los tipos de movimiento.' })
        });
      },
      error: () => iziToast.error({ title: 'Error', message: 'No se pudieron cargar las formas de pago.' })
    });
  }
}

