import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FacturacionService } from '../../../services/facturacion.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { WhatsappService } from '../../../services/whatsapp.service';
import { formatFechaLocal, formatFechaApiParaMostrar, getFechaHoyLocal } from '../../../utils/fecha-local.util';

declare var iziToast: any;
declare var bootstrap: any;

export interface ResumenDiarioListItem {
  idResumenDiarioSunat: string;
  fechaResumen: string;
  numeroCorrelativo: string;
  ticketSunat?: string;
  idEstadoSunat?: number | null;
  fechaEnvio?: string;
  fechaRespuesta?: string;
  codigoRespuesta?: string;
  descripcionRespuesta?: string;
  descripcionEstadoSunat?: string;
  tieneCdr?: boolean | number;
}

@Component({
  selector: 'app-resumenes-diarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resumenes-diarios.component.html',
  styleUrl: './resumenes-diarios.component.css'
})
export class ResumenesDiariosComponent implements OnInit {

  public sidebarState: SidebarStateService = inject(SidebarStateService);
  items: ResumenDiarioListItem[] = [];
  total = 0;
  loading = false;
  fechaDesde = '';
  fechaHasta = '';
  idEstadoSunat: number | null = null;
  pagina = 1;
  porPagina = 20;

  fechaResumenEnviar = '';
  enviando = false;
  consultandoId: string | null = null;
  abriendoArchivoId: string | null = null;

  /** Boletas/notas pendientes por fecha en el rango (para mostrar aviso). */
  boletasPendientesPorFecha: { fechaResumen: string; cantidad: number }[] = [];

  resumenSeleccionadoWa: ResumenDiarioListItem | null = null;
  whatsappResumenNumber = '';
  whatsappResumenCaption = '';
  whatsappResumenMensaje: string | null = null;
  enviandoWhatsappResumen = false;

  constructor(
    private _facturacionService: FacturacionService,
    private _whatsappService: WhatsappService
  ) {}

  ngOnInit(): void {
    this.establecerRangoMes();
    this.cargar();
  }

  establecerRangoMes(): void {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.fechaDesde = formatFechaLocal(primerDia);
    this.fechaHasta = getFechaHoyLocal();
  }

  cargar(): void {
    this.loading = true;
    this._facturacionService.listarResumenesDiarios({
      fechaDesde: this.fechaDesde || undefined,
      fechaHasta: this.fechaHasta || undefined,
      idEstadoSunat: this.idEstadoSunat ?? undefined,
      pagina: this.pagina,
      porPagina: this.porPagina
    }).subscribe({
      next: (res) => {
        this.items = res?.data ?? [];
        this.total = res?.total ?? 0;
        this.loading = false;
        this.cargarBoletasPendientes();
      },
      error: () => {
        this.loading = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudieron cargar los resúmenes.' });
        }
      }
    });
  }

  private cargarBoletasPendientes(): void {
    const fd = this.fechaDesde || '';
    const fh = this.fechaHasta || '';
    if (!fd || !fh) {
      this.boletasPendientesPorFecha = [];
      return;
    }
    this._facturacionService.listarBoletasPendientesPorFecha(fd, fh).subscribe({
      next: (res) => {
        this.boletasPendientesPorFecha = res?.data ?? [];
      },
      error: () => {
        this.boletasPendientesPorFecha = [];
      }
    });
  }

  enviarResumen(): void {
    const fecha = (this.fechaResumenEnviar || '').trim();
    if (!fecha) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Fecha', message: 'Seleccione la fecha del resumen a enviar.' });
      }
      return;
    }
    this.enviando = true;
    this._facturacionService.enviarResumenDiario(fecha).subscribe({
      next: (res) => {
        this.enviando = false;
        this.fechaResumenEnviar = '';
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Enviado', message: res?.message ?? 'Resumen enviado. Consulte el estado en unos instantes.' });
        }
        this.cargar();
      },
      error: (err) => {
        this.enviando = false;
        const msg = err?.error?.message || err?.message || 'Error al enviar el resumen.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        }
      }
    });
  }

  consultarEstado(item: ResumenDiarioListItem): void {
    const id = item?.idResumenDiarioSunat;
    if (!id) return;
    this.consultandoId = id;
    this._facturacionService.consultarEstadoResumenDiario(id).subscribe({
      next: (res) => {
        this.consultandoId = null;
        const msg = res?.data?.mensaje || res?.mensaje;
        if (msg && typeof iziToast !== 'undefined') {
          iziToast.info({ title: 'Estado', message: msg });
        }
        this.cargar();
      },
      error: (err) => {
        this.consultandoId = null;
        const msg = err?.error?.message || err?.message || 'Error al consultar estado.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        }
        this.cargar();
      }
    });
  }

  tieneCdr(item: ResumenDiarioListItem): boolean {
    return item?.tieneCdr === 1 || item?.tieneCdr === true;
  }

  nombreArchivoCdr(item: ResumenDiarioListItem): string {
    const fecha = (item.fechaResumen || '').replace(/\D/g, '').slice(0, 8);
    const corr = item.numeroCorrelativo || '1';
    return fecha ? `cdr-rc-${fecha}-${corr}.xml` : `cdr-rc-${item.idResumenDiarioSunat}.xml`;
  }

  verCdrSunat(item: ResumenDiarioListItem): void {
    const id = item?.idResumenDiarioSunat;
    if (!id) return;
    this.abriendoArchivoId = id + '-cdr';
    this._facturacionService.obtenerCdrResumenDiario(id).subscribe({
      next: (res) => {
        this.abriendoArchivoId = null;
        const content = res?.data?.content ?? '';
        this.abrirContenidoXmlEnPestana(content, this.nombreArchivoCdr(item));
      },
      error: (err) => {
        this.abriendoArchivoId = null;
        const msg = err?.error?.message || err?.message || 'No se pudo cargar el CDR.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'CDR', message: msg });
        }
      }
    });
  }

  descargarCdr(item: ResumenDiarioListItem): void {
    const id = item?.idResumenDiarioSunat;
    if (!id) return;
    this.abriendoArchivoId = id + '-cdr-dl';
    this._facturacionService.obtenerCdrResumenDiario(id).subscribe({
      next: (res) => {
        this.abriendoArchivoId = null;
        const content = res?.data?.content ?? '';
        if (!content) return;
        this.descargarComoArchivo(content, this.nombreArchivoCdr(item));
      },
      error: (err) => {
        this.abriendoArchivoId = null;
        const msg = err?.error?.message || err?.message || 'No se pudo descargar el CDR.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'CDR', message: msg });
        }
      }
    });
  }

  abrirModalWhatsappResumen(item: ResumenDiarioListItem): void {
    this.resumenSeleccionadoWa = item;
    this.whatsappResumenNumber = '';
    this.whatsappResumenCaption = `Resumen diario RC ${this.mostrarFecha(item.fechaResumen)} · Corr. ${item.numeroCorrelativo || ''}`.trim();
    this.whatsappResumenMensaje = this.tieneCdr(item)
      ? null
      : 'No hay CDR guardado. Consulte el estado en SUNAT primero.';
    this.enviandoWhatsappResumen = false;
    setTimeout(() => {
      const el = document.getElementById('whatsappResumenModal');
      if (el && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        bootstrap.Modal.getOrCreateInstance(el).show();
      }
    }, 0);
  }

  enviarWhatsappResumen(): void {
    const item = this.resumenSeleccionadoWa;
    if (!item) return;
    if (!this.whatsappResumenNumber.trim()) {
      this.whatsappResumenMensaje = 'Ingrese el número de WhatsApp (ej. 51999999999).';
      return;
    }
    if (!this.tieneCdr(item)) {
      this.whatsappResumenMensaje = 'No hay CDR disponible. Consulte el estado en SUNAT primero.';
      return;
    }
    this.enviandoWhatsappResumen = true;
    this.whatsappResumenMensaje = null;
    this._facturacionService.obtenerCdrResumenDiario(item.idResumenDiarioSunat).subscribe({
      next: (res) => {
        const content = res?.data?.content ?? '';
        if (!content) {
          this.enviandoWhatsappResumen = false;
          this.whatsappResumenMensaje = 'No hay contenido CDR disponible.';
          return;
        }
        const blob = new Blob([content], { type: 'application/xml;charset=utf-8' });
        this.enviarBlobPorWhatsapp(blob, this.nombreArchivoCdr(item));
      },
      error: (err) => {
        this.enviandoWhatsappResumen = false;
        this.whatsappResumenMensaje = err?.error?.message || err?.message || 'Error al obtener el CDR.';
      }
    });
  }

  cerrarModalWhatsappResumen(): void {
    const el = document.getElementById('whatsappResumenModal');
    if (el && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(el).hide();
    }
    this.resumenSeleccionadoWa = null;
    this.whatsappResumenNumber = '';
    this.whatsappResumenCaption = '';
    this.whatsappResumenMensaje = null;
    this.enviandoWhatsappResumen = false;
  }

  private enviarBlobPorWhatsapp(blob: Blob, nombreArchivo: string): void {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : dataUrl;
      this._whatsappService
        .enviarArchivo(
          this.whatsappResumenNumber.trim(),
          base64,
          nombreArchivo,
          'document',
          this.whatsappResumenCaption.trim() || undefined
        )
        .subscribe({
          next: (res) => {
            this.enviandoWhatsappResumen = false;
            this.whatsappResumenMensaje = res.message;
            if (res.success) {
              setTimeout(() => this.cerrarModalWhatsappResumen(), 2000);
            }
          },
          error: (err) => {
            this.enviandoWhatsappResumen = false;
            this.whatsappResumenMensaje = err?.error?.message || err?.message || 'Error al enviar por WhatsApp.';
          }
        });
    };
    reader.readAsDataURL(blob);
  }

  private abrirContenidoXmlEnPestana(content: string, nombreDescarga: string): void {
    if (!content) return;
    const blob = new Blob([content], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) {
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreDescarga;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }

  private descargarComoArchivo(content: string, nombreArchivo: string): void {
    const blob = new Blob([content], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  descripcionEstado(item: ResumenDiarioListItem): string {
    if (item?.descripcionEstadoSunat) return item.descripcionEstadoSunat;
    if (item?.idEstadoSunat == null) return 'Pendiente de consulta';
    return 'Estado ' + item.idEstadoSunat;
  }

  previewDescripcion(valor: string | null | undefined): string {
    const t = (valor || '').trim();
    if (!t) return '—';
    return t.length > 80 ? t.slice(0, 80) + '…' : t;
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }

  mostrarFecha(valor: string | null | undefined): string {
    return formatFechaApiParaMostrar(valor);
  }
}
