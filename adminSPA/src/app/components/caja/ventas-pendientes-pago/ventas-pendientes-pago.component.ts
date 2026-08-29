import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { VentasService, VentaPendientePagoAgrupada, VentaPendientePago, ComprobanteVentaAgrupada } from '../../../services/ventas.service';
import { CajaService } from '../../../services/caja.service';
import { DocumentoService } from '../../../services/documento.service';
import { PdfService } from '../../../services/pdf.service';
import { WhatsappService } from '../../../services/whatsapp.service';
import { FormaPago } from '../../../interfaces/formasPago-interface';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { EmpresaService } from '../../../services/empresa.service';
import { numeroALetras } from '../../../utils/numeroALetras';
import { openComprobanteVaTicket } from '../../../utils/comprobante-va-ticket.util';
import { Empresa } from '../../../interfaces/pdf-interface';
import { CreditosService } from '../../../services/creditos.service';
import { TablasSunatService } from '../../../services/tablas-sunat.service';
import { esFormaOMedioSaldoFavor, filtrarSinSaldoFavor } from '../../../utils/saldo-favor-pago.util';

declare var bootstrap: any;
declare var iziToast: any;

@Component({
  selector: 'app-ventas-pendientes-pago',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ventas-pendientes-pago.component.html',
  styleUrl: './ventas-pendientes-pago.component.css'
})
export class VentasPendientesPagoComponent implements OnInit {
  sidebarState = inject(SidebarStateService);
  list: VentaPendientePagoAgrupada[] = [];
  listEmpresa: VentaPendientePago[] = [];
  loading = false;
  /** Filtro: idVentaAgrupada (incluye escaneo código de barras) o nombre/RUC cliente */
  filtroIdVenta = '';
  filtroCliente = '';

  /** Modal Cobrar */
  ventaSeleccionada: VentaPendientePagoAgrupada | null = null;
  ventaSeleccionadaEmpresa: VentaPendientePago | null = null;
  formasPago: FormaPago[] = [];
  /** ID forma de pago seleccionada en el modal (para el select). */
  selectedIdFormaPago: number = 0;
  detallePago: Array<{
    item: number;
    idFormaPago: number | null;
    idMediosPago?: number | null;
    descripcion: string;
    monto: number;
    referencia: string;
  }> = [];
  detailForm = { monto: 0, referencia: '' };
  guardandoPago = false;
  /** Saldo a favor del cliente de la venta abierta en el modal de cobro. */
  saldoFavorCliente = 0;
  private idMediosPagoSaldoFavor: number | null = null;
  cajas: Array<{ idCaja: string; idSucursal: string; idApertura: string; nombre: string }> = [];
  comprobantesVenta: ComprobanteVentaAgrupada[] = [];
  cargandoComprobantes = false;
  errorComprobantes = '';
  generandoPdf = false;
  comprobanteImprimiendoId: number | null = null;
  /** idVentaAgrupada mientras se carga el ticket VA para impresión. */
  imprimiendoVaId: string | null = null;
  idVentaPdfComprobanteHijo: number | null = null;
  mostrarWhatsappFormHijo = false;
  datosParaWhatsappHijo: { datos: unknown; nombreArchivo: string } | null = null;
  whatsappMensajeHijo: string | null = null;
  whatsappNumberHijo = '';
  whatsappCaptionHijo = '';
  whatsappFormatoHijo: 'A4' | 'A5' | 'ticket' = 'A4';
  enviandoWhatsappHijo = false;

  page = 1;
  pageSize = 10;
  get totalItems(): number {
    return this.esGestora ? this.list.length : this.listEmpresa.length;
  }
  get listPaginated(): VentaPendientePagoAgrupada[] {
    const start = (this.page - 1) * this.pageSize;
    return this.list.slice(start, start + this.pageSize);
  }
  get listPaginatedEmpresa(): VentaPendientePago[] {
    const start = (this.page - 1) * this.pageSize;
    return this.listEmpresa.slice(start, start + this.pageSize);
  }
  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }
  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }
  desdePagina(): number {
    return (this.page - 1) * this.pageSize + 1;
  }
  hastaPagina(): number {
    return Math.min(this.page * this.pageSize, this.totalItems);
  }
  cambiarPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.page = p;
  }

  constructor(
    private ventasService: VentasService,
    private cajaService: CajaService,
    private documentoService: DocumentoService,
    private pdfService: PdfService,
    private whatsappService: WhatsappService,
    private empresaService: EmpresaService,
    private creditosService: CreditosService,
    private tablasSunatService: TablasSunatService,
  ) {}

  esGestora = false;

  ngOnInit(): void {
    this.cargarFormasPago();
    this.cargarIdMedioSaldoFavor();
    this.cargarCajasAbiertas();
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (res) => {
        const estado = res?.data;
        this.esGestora = !!estado?.esGestora;
        this.cargar();
      },
      error: () => {
        this.esGestora = false;
        this.cargar();
      }
    });
  }

  cargarFormasPago(): void {
    this.documentoService.getFormasPago().subscribe({
      next: (res) => {
        this.formasPago = filtrarSinSaldoFavor(res.data || []);
        const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
        if (efectivo) this.selectedIdFormaPago = efectivo.idFormaPago;
        else if (this.formasPago.length) this.selectedIdFormaPago = this.formasPago[0].idFormaPago;
      },
      error: () => { this.formasPago = []; }
    });
  }

  private cargarIdMedioSaldoFavor(): void {
    this.tablasSunatService.obtener_medios_pago().subscribe({
      next: (res) => {
        const todos = res.data || [];
        const saf = todos.find((m: { codigo?: string; descripcion?: string }) => esFormaOMedioSaldoFavor(m));
        this.idMediosPagoSaldoFavor =
          saf?.idMediosPago != null ? Number(saf.idMediosPago) : null;
      },
      error: () => {
        this.idMediosPagoSaldoFavor = null;
      }
    });
  }

  private idClienteVentaModal(): number | null {
    const id =
      this.ventaSeleccionada?.idCliente ?? this.ventaSeleccionadaEmpresa?.idCliente ?? null;
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private cargarSaldoFavorClienteModal(): void {
    const id = this.idClienteVentaModal();
    if (id == null) {
      this.saldoFavorCliente = 0;
      return;
    }
    this.creditosService.obtenerSaldoFavorCliente(id).subscribe({
      next: (r) => {
        this.saldoFavorCliente = Math.round((Number(r?.data?.saldo) || 0) * 100) / 100;
      },
      error: () => {
        this.saldoFavorCliente = 0;
      }
    });
  }

  /** Aplica saldo a favor al detalle de cobro (medio SAF; no aparece en el select). */
  aplicarSaldoFavorEnPago(): void {
    const disponible = Math.round((Number(this.saldoFavorCliente) || 0) * 100) / 100;
    if (disponible <= 0.009) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Aviso', message: 'El cliente no tiene saldo a favor.', position: 'topRight' });
      }
      return;
    }
    const pendiente = Math.round((this.saldoPendiente()) * 100) / 100;
    if (pendiente <= 0.009) {
      if (typeof iziToast !== 'undefined') {
        iziToast.info({ title: 'Info', message: 'El pago ya cubre el total de la venta.', position: 'topRight' });
      }
      return;
    }
    const idMedios = this.idMediosPagoSaldoFavor;
    if (idMedios == null || !Number.isFinite(idMedios)) {
      if (typeof iziToast !== 'undefined') {
        iziToast.error({
          title: 'Error',
          message: 'No está configurado el medio «Saldo a favor» (código SAF). Ejecute la migración saldo_favor_cliente.sql.',
          position: 'topRight'
        });
      }
      return;
    }
    const monto = Math.min(disponible, pendiente);
    const existente = this.detallePago.find(
      (d) =>
        Number(d.idMediosPago) === idMedios ||
        String(d.descripcion || '').toLowerCase().includes('saldo a favor')
    );
    if (existente) {
      existente.monto = Math.round(((Number(existente.monto) || 0) + monto) * 100) / 100;
      existente.idMediosPago = idMedios;
    } else {
      this.detallePago.push({
        item: this.detallePago.length + 1,
        idFormaPago: null,
        idMediosPago: idMedios,
        descripcion: 'Saldo a favor',
        monto,
        referencia: 'Saldo a favor'
      });
      this.detallePago.forEach((item, idx) => {
        item.item = idx + 1;
      });
    }
    this.detailForm.monto = this.saldoPendiente();
    if (typeof iziToast !== 'undefined') {
      iziToast.success({
        title: 'Saldo a favor',
        message: `Se aplicaron S/ ${monto.toFixed(2)} de saldo a favor.`,
        position: 'topRight'
      });
    }
  }

  cargarCajasAbiertas(): void {
    this.cajaService.obtenerCajas().subscribe({
      next: (r) => {
        this.cajas = (r.data || []).filter((c: any) => c.cajaAbierta && c.idApertura);
      },
      error: () => { this.cajas = []; }
    });
  }

  cargar(): void {
    this.loading = true;
    const idV = (this.filtroIdVenta || '').trim();
    const cli = (this.filtroCliente || '').trim();
    if (this.esGestora) {
      const params: { idVentaAgrupada?: string; cliente?: string } = {};
      if (idV) params.idVentaAgrupada = idV;
      if (cli) params.cliente = cli;
      this.ventasService.getPendientesPago(params).subscribe({
        next: (res) => {
          this.list = res.data || [];
          this.page = 1;
          this.loading = false;
        },
        error: () => {
          this.list = [];
          this.loading = false;
        }
      });
    } else {
      const params: { idVenta?: string; cliente?: string } = {};
      if (idV) params.idVenta = idV;
      if (cli) params.cliente = cli;
      this.ventasService.getPendientesPagoEmpresa(params).subscribe({
        next: (res) => {
          this.listEmpresa = res.data || [];
          this.page = 1;
          this.loading = false;
        },
        error: () => {
          this.listEmpresa = [];
          this.loading = false;
        }
      });
    }
  }

  buscar(): void {
    this.cargar();
  }

  /** Para escaneo: el input puede recibir idVenta por código de barras; al soltar Enter buscar. */
  onFiltroKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.cargar();
  }

  abrirModalCobrar(venta: VentaPendientePagoAgrupada): void {
    this.ventaSeleccionada = venta;
    this.ventaSeleccionadaEmpresa = null;
    this.detallePago = [];
    this.detailForm = { monto: Number(venta.total) || 0, referencia: '' };
    const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
    this.selectedIdFormaPago = efectivo ? efectivo.idFormaPago : (this.formasPago[0]?.idFormaPago ?? 0);
    this.cargarSaldoFavorClienteModal();
    const el = document.getElementById('modalCobrarPendiente');
    if (el) bootstrap.Modal.getOrCreateInstance(el).show();
  }

  abrirModalCobrarEmpresa(venta: VentaPendientePago): void {
    this.ventaSeleccionadaEmpresa = venta;
    this.ventaSeleccionada = null;
    this.detallePago = [];
    this.detailForm = { monto: Number(venta.total) || 0, referencia: '' };
    const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
    this.selectedIdFormaPago = efectivo ? efectivo.idFormaPago : (this.formasPago[0]?.idFormaPago ?? 0);
    this.cargarSaldoFavorClienteModal();
    const el = document.getElementById('modalCobrarPendiente');
    if (el) bootstrap.Modal.getOrCreateInstance(el).show();
  }

  /** Comprobante venta agrupada: solo ticket (ventana + Imprimir). */
  imprimirTicketVA(idVentaAgrupada: string): void {
    if (!idVentaAgrupada) return;
    this.imprimiendoVaId = idVentaAgrupada;
    this.ventasService.getComprobanteVAParaPdf(idVentaAgrupada).subscribe({
      next: (res) => {
        this.imprimiendoVaId = null;
        if (!res?.data) {
          if (typeof iziToast !== 'undefined') {
            iziToast.warning({ title: 'Aviso', message: 'No se pudieron cargar los datos del comprobante VA.', position: 'topRight' });
          }
          return;
        }
        void openComprobanteVaTicket(res.data).then((ok) => {
          if (!ok && typeof iziToast !== 'undefined') {
            iziToast.warning({
              title: 'Aviso',
              message: 'Permita ventanas emergentes para ver e imprimir el ticket VA.',
              position: 'topRight'
            });
          }
        });
      },
      error: () => {
        this.imprimiendoVaId = null;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudo cargar el ticket VA.', position: 'topRight' });
        }
      }
    });
  }

  abrirModalComprobantes(venta: VentaPendientePagoAgrupada): void {
    this.ventaSeleccionada = venta;
    this.comprobantesVenta = [];
    this.errorComprobantes = '';
    this.cargandoComprobantes = true;
    this.ventasService.listarComprobantesVentaAgrupada(venta.idVentaAgrupada).subscribe({
      next: (res) => {
        this.comprobantesVenta = res.data || [];
        this.cargandoComprobantes = false;
      },
      error: () => {
        this.cargandoComprobantes = false;
        this.errorComprobantes = 'No se pudieron cargar los comprobantes.';
      }
    });
  }

  imprimirComprobante(idVenta: number, formato: 'A4' | 'A5' | 'ticket'): void {
    this.generandoPdf = true;
    this.comprobanteImprimiendoId = idVenta;
    this.ventasService.getComprobanteParaPdf(idVenta).subscribe({
      next: (res) => {
        const d = res.data;
        if (!d) {
          this.generandoPdf = false;
          this.comprobanteImprimiendoId = null;
          return;
        }
        const cantidadLetras = numeroALetras(Number(d.venta?.total ?? 0));
        const nombreArchivo = `comprobante-${(d.venta?.compVenta || 'venta').replace(/-/g, '_')}.pdf`;
        const emp = d.empresa ?? {};
        const empAny = emp as Record<string, unknown>;
        const logoStr = String(empAny['logo'] ?? empAny['Logo'] ?? '');
        const empresa: Empresa = {
          logo: logoStr,
          nombre: (emp as { nombre?: string }).nombre ?? '',
          ruc: (emp as { ruc?: string }).ruc ?? '',
          direccion: (emp as { direccion?: string }).direccion ?? '',
          telefono: (emp as { telefono?: string }).telefono ?? ''
        };
        const datos = {
          empresa: { ...empresa, ...emp, logo: logoStr },
          venta: d.venta,
          cliente: d.cliente,
          items: d.items,
          impuestos: Array.isArray(d.impuestos) ? d.impuestos : [],
          cantidadLetras,
          nombreArchivo
        };
        this.pdfService.generarPdfComprobanteVenta(datos, formato, nombreArchivo).subscribe({
          next: (blob) => {
            this.pdfService.previsualizar(blob);
            this.generandoPdf = false;
            this.comprobanteImprimiendoId = null;
          },
          error: () => {
            this.generandoPdf = false;
            this.comprobanteImprimiendoId = null;
          }
        });
      },
      error: () => {
        this.generandoPdf = false;
        this.comprobanteImprimiendoId = null;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudieron cargar los datos del comprobante.', position: 'topRight' });
        }
      }
    });
  }

  abrirModalPdfComprobanteHijo(idVenta: number): void {
    this.idVentaPdfComprobanteHijo = idVenta;
    this.mostrarWhatsappFormHijo = false;
    this.datosParaWhatsappHijo = null;
    this.whatsappMensajeHijo = null;
    const el = document.getElementById('pdfModalComprobanteHijoPendientes');
    if (el && (window as unknown as { bootstrap?: { Modal: { getOrCreateInstance: (e: HTMLElement) => { show: () => void } } } }).bootstrap) {
      (window as unknown as { bootstrap: { Modal: { getOrCreateInstance: (e: HTMLElement) => { show: () => void } } } }).bootstrap.Modal.getOrCreateInstance(el).show();
    }
  }

  generarPdfComprobanteHijo(formato: 'A4' | 'A5' | 'ticket'): void {
    const id = this.idVentaPdfComprobanteHijo;
    if (id == null) return;
    this.imprimirComprobante(id, formato);
  }

  cerrarFormWhatsappHijo(): void {
    this.mostrarWhatsappFormHijo = false;
    this.datosParaWhatsappHijo = null;
    this.whatsappNumberHijo = '';
    this.whatsappCaptionHijo = '';
    this.whatsappFormatoHijo = 'A4';
    this.whatsappMensajeHijo = null;
  }

  abrirFormWhatsappHijo(): void {
    const idVenta = this.idVentaPdfComprobanteHijo;
    if (idVenta == null) return;
    this.generandoPdf = true;
    this.whatsappMensajeHijo = null;
    this.ventasService.getComprobanteParaPdf(idVenta).subscribe({
      next: (res) => {
        const d = res.data;
        this.generandoPdf = false;
        if (!d) return;
        const cantidadLetras = numeroALetras(Number(d.venta?.total ?? 0));
        const nombreArchivo = `comprobante-${(d.venta?.compVenta || 'venta').replace(/-/g, '_')}.pdf`;
        const emp = d.empresa ?? {};
        const empAny = emp as Record<string, unknown>;
        const logoStr = String(empAny['logo'] ?? empAny['Logo'] ?? '');
        const empresa: Empresa = {
          logo: logoStr,
          nombre: (emp as { nombre?: string }).nombre ?? '',
          ruc: (emp as { ruc?: string }).ruc ?? '',
          direccion: (emp as { direccion?: string }).direccion ?? '',
          telefono: (emp as { telefono?: string }).telefono ?? ''
        };
        const datos = {
          empresa: { ...empresa, ...emp, logo: logoStr },
          venta: d.venta,
          cliente: d.cliente,
          items: d.items,
          impuestos: Array.isArray(d.impuestos) ? d.impuestos : [],
          cantidadLetras,
          nombreArchivo
        };
        this.datosParaWhatsappHijo = { datos, nombreArchivo };
        this.whatsappNumberHijo = (d.cliente as { celular?: string })?.celular ?? '';
        this.mostrarWhatsappFormHijo = true;
      },
      error: (err) => {
        this.generandoPdf = false;
        this.whatsappMensajeHijo = err?.error?.error || err?.message || 'No se pudieron cargar los datos.';
      }
    });
  }

  enviarPdfPorWhatsappHijo(): void {
    if (!this.datosParaWhatsappHijo || !this.whatsappNumberHijo.trim()) {
      this.whatsappMensajeHijo = 'Ingrese el número de WhatsApp (ej. 51999999999).';
      return;
    }
    this.enviandoWhatsappHijo = true;
    this.whatsappMensajeHijo = null;
    const { datos, nombreArchivo } = this.datosParaWhatsappHijo;
    const formato = this.whatsappFormatoHijo;
    this.pdfService.generarPdfComprobanteVenta(datos as never, formato, nombreArchivo).subscribe({
      next: (blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : dataUrl;
          this.whatsappService.enviarArchivo(this.whatsappNumberHijo.trim(), base64, nombreArchivo, 'document', this.whatsappCaptionHijo.trim() || undefined).subscribe({
            next: (res) => {
              this.enviandoWhatsappHijo = false;
              this.whatsappMensajeHijo = res.message;
              if (res.success) setTimeout(() => this.cerrarFormWhatsappHijo(), 2000);
            },
            error: (err) => {
              this.enviandoWhatsappHijo = false;
              this.whatsappMensajeHijo = err?.error?.message || err?.message || 'Error al enviar por WhatsApp.';
            }
          });
        };
        reader.readAsDataURL(blob);
      },
      error: () => {
        this.enviandoWhatsappHijo = false;
        this.whatsappMensajeHijo = 'Error al generar el PDF.';
      }
    });
  }

  cerrarModalCobrar(): void {
    const el = document.getElementById('modalCobrarPendiente');
    if (el) bootstrap.Modal.getInstance(el)?.hide();
    this.ventaSeleccionada = null;
    this.ventaSeleccionadaEmpresa = null;
    this.detallePago = [];
    this.saldoFavorCliente = 0;
  }

  totalDetallePago(): number {
    return this.detallePago.reduce((s, d) => s + (Number(d.monto) || 0), 0);
  }

  saldoPendiente(): number {
    const total = this.ventaSeleccionada
      ? Number(this.ventaSeleccionada.total) || 0
      : (this.ventaSeleccionadaEmpresa ? Number(this.ventaSeleccionadaEmpresa.total) || 0 : 0);
    return Math.max(0, total - this.totalDetallePago());
  }

  agregarDetalle(): void {
    const monto = Math.round((Number(this.detailForm.monto) || 0) * 100) / 100;
    const idForma = Number(this.selectedIdFormaPago) || 0;
    if (monto <= 0 || !idForma) return;
    const desc = this.formasPago.find((f: FormaPago) => f.idFormaPago === idForma)?.descripcion || 'Pago';
    this.detallePago.push({
      item: this.detallePago.length + 1,
      idFormaPago: idForma,
      descripcion: desc,
      monto,
      referencia: this.detailForm.referencia || 'N/A'
    });
    this.detailForm.referencia = '';
    this.detailForm.monto = this.saldoPendiente();
  }

  eliminarDetalle(index: number): void {
    this.detallePago.splice(index, 1);
    this.detallePago.forEach((item, idx) => item.item = idx + 1);
    this.detailForm.monto = this.saldoPendiente();
  }

  guardarPago(): void {
    if (!this.ventaSeleccionada && !this.ventaSeleccionadaEmpresa) return;
    const totalVenta = this.ventaSeleccionada
      ? Number(this.ventaSeleccionada.total) || 0
      : (this.ventaSeleccionadaEmpresa ? Number(this.ventaSeleccionadaEmpresa.total) || 0 : 0);
    const totalPago = this.totalDetallePago();
    if (totalPago <= 0) {
      if (typeof iziToast !== 'undefined') iziToast.warning({ title: 'Advertencia', message: 'Agregue al menos un pago.', position: 'topRight' });
      return;
    }
    if (Math.abs(totalPago - totalVenta) > 0.01) {
      if (typeof iziToast !== 'undefined') iziToast.warning({ title: 'Advertencia', message: 'El total del pago no coincide con el total de la venta.', position: 'topRight' });
      return;
    }
    const detallePago = this.detallePago
      .filter((d) => (Number(d.monto) || 0) > 0 && (d.idMediosPago != null || d.idFormaPago != null))
      .map((d) => ({
        idMediosPago: d.idMediosPago != null ? Number(d.idMediosPago) : undefined,
        idFormaPago: d.idFormaPago != null ? Number(d.idFormaPago) : undefined,
        descripcion: d.descripcion != null ? String(d.descripcion) : undefined,
        monto: Number(d.monto)
      }));
    if (detallePago.length === 0) {
      if (typeof iziToast !== 'undefined') iziToast.warning({ title: 'Advertencia', message: 'Agregue al menos un pago válido.', position: 'topRight' });
      return;
    }
    const idApertura = this.cajas.length > 0 ? this.cajas[0].idApertura : undefined;
    this.guardandoPago = true;
    if (this.ventaSeleccionada) {
      this.ventasService.cobrarVentaAgrupada(this.ventaSeleccionada.idVentaAgrupada, { detallePago, idApertura }).subscribe({
        next: () => {
          this.guardandoPago = false;
          this.cerrarModalCobrar();
          if (typeof iziToast !== 'undefined') {
            iziToast.success({
              title: 'Éxito',
              message: 'Cobro registrado. Use el botón de impresora en la lista para el ticket VA.',
              position: 'topRight'
            });
          }
          this.cargar();
        },
        error: () => {
          this.guardandoPago = false;
        }
      });
    } else if (this.ventaSeleccionadaEmpresa) {
      this.ventasService.cobrarVenta(this.ventaSeleccionadaEmpresa.idVenta, { detallePago, idApertura }).subscribe({
        next: () => {
          this.guardandoPago = false;
          this.cerrarModalCobrar();
          if (typeof iziToast !== 'undefined') iziToast.success({ title: 'Éxito', message: 'Cobro registrado correctamente.', position: 'topRight' });
          this.cargar();
        },
        error: () => {
          this.guardandoPago = false;
        }
      });
    }
  }

  formatNumber(value: number): string {
    return (value ?? 0).toFixed(2);
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
