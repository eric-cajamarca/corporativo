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
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { EmpresaService } from '../../../services/empresa.service';
import { numeroALetras } from '../../../utils/numeroALetras';
import { openComprobanteVaTicket } from '../../../utils/comprobante-va-ticket.util';
import { Empresa } from '../../../interfaces/pdf-interface';

declare var bootstrap: any;
declare var iziToast: any;

@Component({
  selector: 'app-ventas-pendientes-pago',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent],
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
  detallePago: Array<{ item: number; idFormaPago: number; descripcion: string; monto: number; referencia: string }> = [];
  detailForm = { monto: 0, referencia: '' };
  guardandoPago = false;
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
    //public sidebarState: SidebarStateService
  ) {}

  esGestora = false;

  ngOnInit(): void {
    this.cargarFormasPago();
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
        this.formasPago = res.data || [];
        const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
        if (efectivo) this.selectedIdFormaPago = efectivo.idFormaPago;
        else if (this.formasPago.length) this.selectedIdFormaPago = this.formasPago[0].idFormaPago;
      },
      error: () => { this.formasPago = []; }
    });
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
    this.detallePago = [];
    this.detailForm = { monto: Number(venta.total) || 0, referencia: '' };
    const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
    this.selectedIdFormaPago = efectivo ? efectivo.idFormaPago : (this.formasPago[0]?.idFormaPago ?? 0);
    const el = document.getElementById('modalCobrarPendiente');
    if (el) bootstrap.Modal.getOrCreateInstance(el).show();
  }

  abrirModalCobrarEmpresa(venta: VentaPendientePago): void {
    this.ventaSeleccionadaEmpresa = venta;
    this.detallePago = [];
    this.detailForm = { monto: Number(venta.total) || 0, referencia: '' };
    const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
    this.selectedIdFormaPago = efectivo ? efectivo.idFormaPago : (this.formasPago[0]?.idFormaPago ?? 0);
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
        if (!openComprobanteVaTicket(res.data, idVentaAgrupada) && typeof iziToast !== 'undefined') {
          iziToast.warning({
            title: 'Aviso',
            message: 'Permita ventanas emergentes para ver e imprimir el ticket VA.',
            position: 'topRight'
          });
        }
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
    const detallePago = this.detallePago.map(d => ({ idMediosPago: d.idFormaPago, monto: d.monto }));
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
