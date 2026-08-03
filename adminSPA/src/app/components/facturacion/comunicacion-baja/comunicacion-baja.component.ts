import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { FacturacionService, ComprobanteParaBaja, ComunicacionBajaHistorialItem, MotivoBaja } from '../../../services/facturacion.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { PdfService } from '../../../services/pdf.service';
import { WhatsappService } from '../../../services/whatsapp.service';
import { EmpresaService } from '../../../services/empresa.service';
import { Empresa as EmpresaModel } from '../../../models/empresa.model';

declare var iziToast: any;
declare var bootstrap: any;

@Component({
  selector: 'app-comunicacion-baja',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbPagination],
  templateUrl: './comunicacion-baja.component.html',
  styleUrl: './comunicacion-baja.component.css'
})
export class ComunicacionBajaComponent implements OnInit {

  sidebarState = inject(SidebarStateService);
  /** Resultados de búsqueda en el modal (serie/número). */
  comprobantes: ComprobanteParaBaja[] = [];
  motivos: MotivoBaja[] = [];
  motivoDefault = '01';
  loadingComprobantes = false;
  enviando = false;
  listado: ComunicacionBajaHistorialItem[] = [];
  totalListado = 0;
  /** Vacío = sin filtro de fechas (historial completo). */
  fechaDesde = '';
  fechaHasta = '';
  idEstadoSunat: number | null = null;
  pagina = 1;
  /** Tamaño de página del historial (sincronizado con API). */
  readonly porPagina = 10;

  /** Modal búsqueda / baja uno a uno */
  modalSerie = '';
  modalNumero = '';
  busquedaModalRealizada = false;
  comprobanteSeleccionadoId: string | null = null;
  /** Texto completo de descripción SUNAT en el modal. */
  descripcionModalTexto = '';
  consultandoId: string | null = null;
  abriendoArchivoId: string | null = null;
  eliminandoId: string | null = null;

  /** Empresa actual (para encabezado del PDF resumen). */
  empresa: EmpresaModel | null = null;

  /** Modal de envío WhatsApp para una comunicación de baja. */
  bajaSeleccionadaWa: ComunicacionBajaHistorialItem | null = null;
  whatsappBajaTipo: 'pdf' | 'xml' | 'cdr' = 'pdf';
  whatsappBajaNumber = '';
  whatsappBajaCaption = '';
  enviandoWhatsappBaja = false;
  whatsappBajaMensaje: string | null = null;
  generandoPdfBaja = false;

  constructor(
    private _facturacionService: FacturacionService,
    private _pdfService: PdfService,
    private _whatsappService: WhatsappService,
    private _empresaService: EmpresaService
  ) {}

  ngOnInit(): void {
    this.cargarMotivos();
    this.cargarListado();
    this._empresaService.getEmpresa$().subscribe((emp) => {
      this.empresa = emp;
    });
  }

  abrirModalBuscarBaja(): void {
    this.modalSerie = '';
    this.modalNumero = '';
    this.comprobantes = [];
    this.comprobanteSeleccionadoId = null;
    this.busquedaModalRealizada = false;
    setTimeout(() => {
      const el = document.getElementById('modalBuscarBaja');
      if (el && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        bootstrap.Modal.getOrCreateInstance(el).show();
      }
    }, 0);
  }

  cerrarModalBuscarBaja(): void {
    const el = document.getElementById('modalBuscarBaja');
    if (el && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(el).hide();
    }
    this.comprobantes = [];
    this.comprobanteSeleccionadoId = null;
    this.busquedaModalRealizada = false;
  }

  buscarComprobanteEnModal(): void {
    const serie = (this.modalSerie || '').trim().toUpperCase();
    const numeroPad = (this.modalNumero || '').trim();
    if (!serie || !numeroPad) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Búsqueda', message: 'Indique serie y número del comprobante.' });
      }
      return;
    }
    // Buscar con y sin ceros a la izquierda: el API hace LIKE sobre serie-número
    const buscar = `${serie}-${numeroPad}`;
    this.loadingComprobantes = true;
    this.busquedaModalRealizada = true;
    this.comprobanteSeleccionadoId = null;
    this._facturacionService.listarComprobantesParaBaja({
      pagina: 1,
      porPagina: 20,
      buscar
    }).subscribe({
      next: (res) => {
        let rows = res?.data ?? [];
        // Preferir coincidencia exacta serie+número (normalizando ceros)
        const numNorm = numeroPad.replace(/^0+(?=\d)/, '') || '0';
        const exactos = rows.filter((c) => {
          const s = String(c.serie || '').trim().toUpperCase();
          const n = String(c.numero || '').trim().replace(/^0+(?=\d)/, '') || '0';
          return s === serie && n === numNorm;
        });
        if (exactos.length) rows = exactos;
        this.comprobantes = rows;
        this.loadingComprobantes = false;
        if (rows.length === 1) {
          this.comprobanteSeleccionadoId = rows[0].idComprobanteElectronico;
        }
      },
      error: () => {
        this.loadingComprobantes = false;
        this.comprobantes = [];
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudo buscar el comprobante.' });
        }
      }
    });
  }

  seleccionarComprobanteBaja(c: ComprobanteParaBaja): void {
    this.comprobanteSeleccionadoId = c?.idComprobanteElectronico || null;
  }

  cargarMotivos(): void {
    this._facturacionService.listarMotivosBaja().subscribe({
      next: (res) => {
        this.motivos = res?.data ?? [];
        if (this.motivos.length > 0 && !this.motivoDefault) {
          this.motivoDefault = this.motivos[0].codigoSunat;
        }
      },
      error: () => {
        this.motivos = [];
      }
    });
  }

  cargarListado(): void {
    this._facturacionService.listarComunicacionesBaja({
      fechaDesde: this.fechaDesde || undefined,
      fechaHasta: this.fechaHasta || undefined,
      idEstadoSunat: this.idEstadoSunat ?? undefined,
      pagina: this.pagina,
      porPagina: this.porPagina
    }).subscribe({
      next: (res) => {
        this.listado = res?.data ?? [];
        this.totalListado = res?.total ?? 0;
      },
      error: () => {
        this.listado = [];
        this.totalListado = 0;
      }
    });
  }

  /** Filtros: vuelve a la primera página y recarga. */
  onFiltroHistorialChange(): void {
    this.pagina = 1;
    this.cargarListado();
  }

  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  /** Vista corta de la descripción SUNAT para la tabla. */
  previewDescripcion(text: string | null | undefined, max = 72): string {
    const t = (text ?? '').trim();
    if (!t) return '—';
    if (t.length <= max) return t;
    return t.slice(0, max) + '…';
  }

  puedeMostrarBotonEliminar(item: ComunicacionBajaHistorialItem): boolean {
    const f = item.puedeEliminarCorrelativoIncorrecto;
    return f === 1 || f === true;
  }

  eliminarDelHistorial(item: ComunicacionBajaHistorialItem, ev?: Event): void {
    ev?.stopPropagation();
    ev?.preventDefault();
    const id = item?.idComunicacionBaja;
    if (!id || !this.puedeMostrarBotonEliminar(item)) return;
    const ok = confirm(
      '¿Eliminar esta comunicación del historial? El correlativo del catálogo RA (Comprobantes) no se modificará.'
    );
    if (!ok) return;
    this.eliminandoId = id;
    this._facturacionService.eliminarComunicacionBaja(id).subscribe({
      next: (res) => {
        this.eliminandoId = null;
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Eliminado', message: res?.message ?? 'Registro eliminado.' });
        }
        this.cargarListado();
      },
      error: (err) => {
        this.eliminandoId = null;
        const msg = err?.error?.message || err?.message || 'No se pudo eliminar.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        }
      }
    });
  }

  abrirModalDescripcion(item: ComunicacionBajaHistorialItem): void {
    const raw = item?.descripcionRespuesta != null ? String(item.descripcionRespuesta).trim() : '';
    this.descripcionModalTexto = raw || 'Sin descripción';
    const el = document.getElementById('modalDescripcionBaja');
    if (el && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(el).show();
    }
  }

  get descripcionMotivoDefault(): string {
    return this.motivos.find(m => m.codigoSunat === this.motivoDefault)?.descripcion || 'Anulación de la operación';
  }

  /** Envía la baja de un único comprobante seleccionado en el modal. */
  enviarBajaUno(): void {
    const id = this.comprobanteSeleccionadoId;
    if (!id) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Selección', message: 'Seleccione un comprobante para dar de baja.' });
      }
      return;
    }
    this.enviando = true;
    this._facturacionService.enviarComunicacionBaja([{
      idComprobanteElectronico: id,
      motivoBaja: this.descripcionMotivoDefault
    }]).subscribe({
      next: (res) => {
        this.enviando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Enviado', message: res?.message ?? 'Comunicación de baja enviada. Consulte el estado.' });
        }
        this.cerrarModalBuscarBaja();
        this.pagina = 1;
        this.cargarListado();
      },
      error: (err) => {
        this.enviando = false;
        const msg = err?.error?.message || err?.message || 'Error al enviar.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        }
      }
    });
  }

  consultarEstado(item: any): void {
    const id = item?.idComunicacionBaja;
    if (!id) return;
    this.consultandoId = id;
    this._facturacionService.consultarEstadoComunicacionBaja(id).subscribe({
      next: (res) => {
        this.consultandoId = null;
        if (typeof iziToast !== 'undefined') {
          iziToast.info({ title: 'Estado', message: res?.mensaje ?? 'Consultado.' });
        }
        this.cargarListado();
      },
      error: (err) => {
        this.consultandoId = null;
        const msg = err?.error?.message || err?.message || 'Error al consultar.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        }
        this.cargarListado();
      }
    });
  }

  tipoDocLabel(tipo: string): string {
    if (tipo === '01') return 'Factura';
    if (tipo === '07') return 'NC';
    if (tipo === '08') return 'ND';
    return tipo;
  }

  descripcionEstado(item: any): string {
    if (item?.descripcionEstadoSunat) return item.descripcionEstadoSunat;
    if (item?.idEstadoSunat == null) return 'Pendiente de consulta';
    return 'Estado ' + item.idEstadoSunat;
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

  verXmlEnviado(item: any): void {
    const id = item?.idComunicacionBaja;
    if (!id) return;
    this.abriendoArchivoId = id + '-xml';
    this._facturacionService.obtenerXmlComunicacionBaja(id).subscribe({
      next: (res) => {
        this.abriendoArchivoId = null;
        const content = res?.data?.content ?? '';
        this.abrirContenidoXmlEnPestana(content, `ra-${id}.xml`);
      },
      error: (err) => {
        this.abriendoArchivoId = null;
        const msg = err?.error?.message || err?.message || 'No se pudo cargar el XML.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'XML', message: msg });
        }
      }
    });
  }

  verCdrSunat(item: any): void {
    const id = item?.idComunicacionBaja;
    if (!id) return;
    this.abriendoArchivoId = id + '-cdr';
    this._facturacionService.obtenerCdrComunicacionBaja(id).subscribe({
      next: (res) => {
        this.abriendoArchivoId = null;
        const content = res?.data?.content ?? '';
        this.abrirContenidoXmlEnPestana(content, `cdr-ra-${id}.xml`);
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

  tieneXmlEnviado(item: any): boolean {
    return item?.tieneXmlEnviado === 1 || item?.tieneXmlEnviado === true;
  }

  tieneCdr(item: any): boolean {
    return item?.tieneCdr === 1 || item?.tieneCdr === true;
  }

  /** Descarga el XML enviado a SUNAT como archivo. */
  descargarXmlEnviado(item: ComunicacionBajaHistorialItem): void {
    const id = item?.idComunicacionBaja;
    if (!id) return;
    this.abriendoArchivoId = id + '-xml-dl';
    this._facturacionService.obtenerXmlComunicacionBaja(id).subscribe({
      next: (res) => {
        this.abriendoArchivoId = null;
        const content = res?.data?.content ?? '';
        if (!content) return;
        this.descargarComoArchivo(content, `ra-${id}.xml`);
      },
      error: (err) => {
        this.abriendoArchivoId = null;
        const msg = err?.error?.message || err?.message || 'No se pudo descargar el XML.';
        if (typeof iziToast !== 'undefined') iziToast.error({ title: 'XML', message: msg });
      }
    });
  }

  /** Descarga el CDR (respuesta SUNAT) como archivo. */
  descargarCdr(item: ComunicacionBajaHistorialItem): void {
    const id = item?.idComunicacionBaja;
    if (!id) return;
    this.abriendoArchivoId = id + '-cdr-dl';
    this._facturacionService.obtenerCdrComunicacionBaja(id).subscribe({
      next: (res) => {
        this.abriendoArchivoId = null;
        const content = res?.data?.content ?? '';
        if (!content) return;
        this.descargarComoArchivo(content, `cdr-ra-${id}.xml`);
      },
      error: (err) => {
        this.abriendoArchivoId = null;
        const msg = err?.error?.message || err?.message || 'No se pudo descargar el CDR.';
        if (typeof iziToast !== 'undefined') iziToast.error({ title: 'CDR', message: msg });
      }
    });
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

  /** Genera y previsualiza un PDF resumen de la comunicación de baja. */
  generarPdfResumenBaja(item: ComunicacionBajaHistorialItem): void {
    if (!item?.idComunicacionBaja) return;
    this.generandoPdfBaja = true;
    const datos = this.armarDatosPdfResumenBaja(item);
    this._pdfService.generarPdfDinamico(datos, 'lista-ventas', 10).subscribe({
      next: (blob) => {
        this.generandoPdfBaja = false;
        this._pdfService.previsualizar(blob);
      },
      error: () => {
        this.generandoPdfBaja = false;
        if (typeof iziToast !== 'undefined') iziToast.error({ title: 'Error', message: 'No se pudo generar el PDF resumen.' });
      }
    });
  }

  private armarDatosPdfResumenBaja(item: ComunicacionBajaHistorialItem) {
    const emp = this.empresa;
    const empresaPdf = {
      logo: emp?.logo ?? '',
      nombre: emp?.nombre ?? '',
      ruc: emp?.ruc ?? '',
      direccion: emp?.direccion ?? '',
      telefono: emp?.telefono ?? ''
    };
    const fechaFmt = this.formatearFechaCorta(item.fechaComunicacion);
    const filas = [
      ['Correlativo RA', item.numeroCorrelativo || '—'],
      ['Fecha', fechaFmt],
      ['Ticket SUNAT', item.ticketSunat || '—'],
      ['Estado SUNAT', this.descripcionEstado(item)],
      ['Descripción', (item.descripcionRespuesta || '—').toString()]
    ];
    return {
      empresa: empresaPdf,
      titulo: 'Comunicación de baja (RA)',
      columnas: ['Campo', 'Valor'],
      filas
    };
  }

  private formatearFechaCorta(f: string | undefined | null): string {
    if (!f) return '—';
    const s = String(f).trim().slice(0, 19).replace('T', ' ');
    return s || '—';
  }

  /** Fecha legible en historial (evita ISO completo con Z). */
  formatearFechaHistorial(f: string | undefined | null): string {
    return this.formatearFechaCorta(f);
  }

  /** Abre el modal de envío por WhatsApp con el archivo seleccionado (PDF, XML o CDR). */
  abrirModalWhatsappBaja(item: ComunicacionBajaHistorialItem): void {
    this.bajaSeleccionadaWa = item;
    this.whatsappBajaTipo = 'pdf';
    this.whatsappBajaNumber = '';
    this.whatsappBajaCaption = `Comunicación de baja ${item.numeroCorrelativo || ''}`.trim();
    this.whatsappBajaMensaje = null;
    this.enviandoWhatsappBaja = false;
    setTimeout(() => {
      const el = document.getElementById('whatsappBajaModal');
      if (el && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        bootstrap.Modal.getOrCreateInstance(el).show();
      }
    }, 0);
  }

  enviarWhatsappBaja(): void {
    const item = this.bajaSeleccionadaWa;
    if (!item) return;
    if (!this.whatsappBajaNumber.trim()) {
      this.whatsappBajaMensaje = 'Ingrese el número de WhatsApp (ej. 51999999999).';
      return;
    }
    this.enviandoWhatsappBaja = true;
    this.whatsappBajaMensaje = null;
    if (this.whatsappBajaTipo === 'pdf') {
      this.enviarPdfBajaWhatsapp(item);
    } else if (this.whatsappBajaTipo === 'xml') {
      this.enviarArchivoBajaWhatsapp(item, 'xml');
    } else {
      this.enviarArchivoBajaWhatsapp(item, 'cdr');
    }
  }

  private enviarPdfBajaWhatsapp(item: ComunicacionBajaHistorialItem): void {
    const datos = this.armarDatosPdfResumenBaja(item);
    const nombreArchivo = `comunicacion-baja-${item.numeroCorrelativo || item.idComunicacionBaja}.pdf`;
    this._pdfService.generarPdfDinamico(datos, 'lista-ventas', 10).subscribe({
      next: (blob) => {
        this.enviarBlobPorWhatsapp(blob, nombreArchivo);
      },
      error: () => {
        this.enviandoWhatsappBaja = false;
        this.whatsappBajaMensaje = 'Error al generar el PDF.';
      }
    });
  }

  private enviarArchivoBajaWhatsapp(item: ComunicacionBajaHistorialItem, tipo: 'xml' | 'cdr'): void {
    const id = item.idComunicacionBaja;
    const obs = tipo === 'xml'
      ? this._facturacionService.obtenerXmlComunicacionBaja(id)
      : this._facturacionService.obtenerCdrComunicacionBaja(id);
    obs.subscribe({
      next: (res) => {
        const content = res?.data?.content ?? '';
        if (!content) {
          this.enviandoWhatsappBaja = false;
          this.whatsappBajaMensaje = `No hay contenido ${tipo.toUpperCase()} disponible.`;
          return;
        }
        const nombreArchivo = tipo === 'xml'
          ? `ra-${id}.xml`
          : `cdr-ra-${id}.xml`;
        const blob = new Blob([content], { type: 'application/xml;charset=utf-8' });
        this.enviarBlobPorWhatsapp(blob, nombreArchivo);
      },
      error: (err) => {
        this.enviandoWhatsappBaja = false;
        this.whatsappBajaMensaje = err?.error?.message || err?.message || `Error al obtener el ${tipo.toUpperCase()}.`;
      }
    });
  }

  private enviarBlobPorWhatsapp(blob: Blob, nombreArchivo: string): void {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : dataUrl;
      this._whatsappService
        .enviarArchivo(this.whatsappBajaNumber.trim(), base64, nombreArchivo, 'document', this.whatsappBajaCaption.trim() || undefined)
        .subscribe({
          next: (res) => {
            this.enviandoWhatsappBaja = false;
            this.whatsappBajaMensaje = res.message;
            if (res.success) {
              setTimeout(() => this.cerrarModalWhatsappBaja(), 2000);
            }
          },
          error: (err) => {
            this.enviandoWhatsappBaja = false;
            this.whatsappBajaMensaje = err?.error?.message || err?.message || 'Error al enviar por WhatsApp.';
          }
        });
    };
    reader.readAsDataURL(blob);
  }

  cerrarModalWhatsappBaja(): void {
    const el = document.getElementById('whatsappBajaModal');
    if (el && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(el).hide();
    }
    this.bajaSeleccionadaWa = null;
    this.whatsappBajaNumber = '';
    this.whatsappBajaCaption = '';
    this.whatsappBajaMensaje = null;
    this.enviandoWhatsappBaja = false;
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
