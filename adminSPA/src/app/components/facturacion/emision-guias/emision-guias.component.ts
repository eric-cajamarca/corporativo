import { Component, OnInit, inject, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FacturacionService, GuiaEmitidaListItem, GuiaDetalle } from '../../../services/facturacion.service';
import { htmlBloqueQrSunatGre, qrDataUrlParaPdfGuia } from '../../../utils/guia-representacion-impresa-qr.util';
import {
  estilosGrePdfInline,
  greItemsTablaHtml,
  htmlFirmasGreTransportista,
  type GrePdfFormato
} from '../../../utils/guia-pdf-html.util';
import { NgbModal, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { EmpresaService } from '../../../services/empresa.service';
import { PdfService } from '../../../services/pdf.service';
import { WhatsappService } from '../../../services/whatsapp.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';

declare const iziToast: any;

@Component({
  selector: 'app-emision-guias',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, TopnavComponent, NgbPagination],
  templateUrl: './emision-guias.component.html',
  styleUrl: './emision-guias.component.css'
})
export class EmisionGuiasComponent implements OnInit {
  sidebarState = inject(SidebarStateService);
  private facturacionService = inject(FacturacionService);
  private empresaService     = inject(EmpresaService);
  private pdfService         = inject(PdfService);
  private whatsappService    = inject(WhatsappService);
  private modalService       = inject(NgbModal);

  @ViewChild('modalFormatoGrePdf') modalFormatoGrePdfTpl!: TemplateRef<unknown>;

  /** Fila elegida en el modal A4 / Ticket antes de generar el PDF. */
  private guiaImpresionPendiente: GuiaEmitidaListItem | null = null;

  autorizado = true;
  loading    = false;
  items: GuiaEmitidaListItem[] = [];
  total    = 0;
  page     = 1;
  readonly pageSize = 10;
  readonly maxSize  = 5;

  // Modal "Ver detalle"
  guiaSeleccionada: GuiaDetalle | null = null;
  cargandoDetalle = false;

  // Estado de acciones en proceso por fila
  enviandoId: string | null = null;
  eliminandoId: string | null = null;
  imprimiendoId: string | null = null;
  consultandoTicketId: string | null = null;

  ngOnInit(): void {
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (res: { data?: { habilitarGuiasElectronicas?: boolean } }) => {
        this.autorizado = res?.data?.habilitarGuiasElectronicas === true;
        if (!this.autorizado) {
          iziToast.warning({ title: 'Guías', message: 'Active la emisión de guías en Configuración → Facturación.', position: 'topRight' });
        }
        if (this.autorizado) this.cargar();
      },
      error: () => { this.autorizado = false; }
    });
  }

  cargar(): void {
    this.loading = true;
    this.facturacionService.listarGuiasEmitidas({ pagina: this.page, porPagina: this.pageSize }).subscribe({
      next: (res) => {
        this.items  = res?.data ?? [];
        this.total  = res?.total ?? 0;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.items = [];
        this.total = 0;
        const msg = err?.error?.message || 'No se pudo cargar el listado de guías.';
        iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
      }
    });
  }

  onPageChange(p: number): void {
    this.page = p;
    this.cargar();
  }

  // ─── Helpers de vista ────────────────────────────────────────────────────────

  esPendiente(row: GuiaEmitidaListItem): boolean {
    return row.idEstadoSunat == null || row.idEstadoSunat === 98;
  }

  esEnProceso(row: GuiaEmitidaListItem): boolean {
    return row.idEstadoSunat === 2;
  }

  /** Editar solo pendiente o error SUNAT (no aceptada ni en proceso). */
  esEditable(row: GuiaEmitidaListItem): boolean {
    return row.idEstadoSunat == null || row.idEstadoSunat === 98;
  }

  etiquetaTipoDocumento(cod: string): string {
    const c = (cod || '').trim();
    if (c === '09') return 'GRE Remitente';
    if (c === '31') return 'Guía transportista';
    return c || '—';
  }

  etiquetaEstado(row: GuiaEmitidaListItem): string {
    if (row.idEstadoSunat === 1)  return 'Aceptada';
    if (row.idEstadoSunat === 2)  return 'En proceso';
    if (row.idEstadoSunat === 98) return 'Error';
    if (row.idEstadoSunat == null) return 'Pendiente';
    return String(row.idEstadoSunat);
  }

  claseEstado(row: GuiaEmitidaListItem): string {
    if (row.idEstadoSunat === 1)  return 'badge bg-success';
    if (row.idEstadoSunat === 2)  return 'badge bg-warning text-dark';
    if (row.idEstadoSunat === 98) return 'badge bg-danger';
    return 'badge bg-secondary';
  }

  docOrigen(row: GuiaEmitidaListItem): string {
    const s = (row.comprobanteOrigenSerie  || '').trim();
    const n = (row.comprobanteOrigenNumero || '').trim();
    if (s && n) return `${s}-${n}`;
    if (s) return s;
    if (n) return n;
    return '—';
  }

  // ─── Acción: Enviar ──────────────────────────────────────────────────────────

  enviar(row: GuiaEmitidaListItem): void {
    if (!confirm(`¿Enviar la guía ${row.serie}-${row.numero} a SUNAT?`)) return;
    this.enviandoId = row.idGuiaElectronica;
    this.facturacionService.reenviarGuia(row.idGuiaElectronica).subscribe({
      next: (res) => {
        this.enviandoId = null;
        iziToast.success({ title: 'OK', message: res.message || 'Enviado.', position: 'topRight' });
        this.cargar();
      },
      error: (err) => {
        this.enviandoId = null;
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo enviar.', position: 'topRight' });
      }
    });
  }

  // ─── Acción: Consultar ticket EN_PROCESO ─────────────────────────────────────

  consultarTicket(row: GuiaEmitidaListItem): void {
    this.consultandoTicketId = row.idGuiaElectronica;
    this.facturacionService.consultarTicketGuia(row.idGuiaElectronica).subscribe({
      next: (res) => {
        this.consultandoTicketId = null;
        if (res.enProceso) {
          iziToast.info({ title: 'En proceso', message: res.mensaje || 'SUNAT aún está procesando. Intente en unos segundos.', position: 'topRight' });
        } else if (res.aceptado) {
          iziToast.success({ title: 'Aceptada', message: res.mensaje || 'Guía aceptada por SUNAT.', position: 'topRight' });
          this.cargar();
        } else {
          iziToast.error({ title: 'Error SUNAT', message: res.mensaje || 'Error al procesar la guía.', position: 'topRight' });
          this.cargar();
        }
      },
      error: (err) => {
        this.consultandoTicketId = null;
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo consultar el ticket.', position: 'topRight' });
      }
    });
  }

  // ─── Acción: Ver ─────────────────────────────────────────────────────────────

  verDetalle(row: GuiaEmitidaListItem): void {
    if (this.guiaSeleccionada?.idGuiaElectronica === row.idGuiaElectronica) {
      this.guiaSeleccionada = null;
      return;
    }
    this.cargandoDetalle = true;
    this.guiaSeleccionada = null;
    this.facturacionService.obtenerGuia(row.idGuiaElectronica).subscribe({
      next: (res) => {
        this.guiaSeleccionada = res.data;
        this.cargandoDetalle = false;
      },
      error: () => {
        this.cargandoDetalle = false;
        iziToast.error({ title: 'Error', message: 'No se pudo obtener el detalle.', position: 'topRight' });
      }
    });
  }

  cerrarDetalle(): void {
    this.guiaSeleccionada = null;
  }

  // ─── Acción: Imprimir PDF (modal A4 / Ticket) ───────────────────────────────

  abrirModalFormatoImpresion(row: GuiaEmitidaListItem): void {
    this.guiaImpresionPendiente = row;
    this.modalService.open(this.modalFormatoGrePdfTpl, { centered: true, backdrop: true });
  }

  confirmarImpresionGre(formato: GrePdfFormato, modal: NgbActiveModal): void {
    modal.close();
    const row = this.guiaImpresionPendiente;
    this.guiaImpresionPendiente = null;
    if (!row) return;
    this.ejecutarImpresionPdf(row, formato);
  }

  private ejecutarImpresionPdf(row: GuiaEmitidaListItem, formato: GrePdfFormato): void {
    this.imprimiendoId = row.idGuiaElectronica;
    const fontSize = formato === 'ticket' ? 7 : 10;
    this.facturacionService.obtenerGuia(row.idGuiaElectronica).subscribe({
      next: (res) => {
        void (async () => {
          const guia = res.data;
          const qrUrl = await qrDataUrlParaPdfGuia(guia);
          const html = this.generarHtmlGuia(guia, qrUrl, formato);
          this.pdfService.generarPdfDinamico({ html }, 'guia-remision', fontSize, formato).subscribe({
            next: (blob) => {
              this.imprimiendoId = null;
              this.pdfService.previsualizar(blob);
            },
            error: () => {
              this.imprimiendoId = null;
              iziToast.error({ title: 'Error', message: 'No se pudo generar el PDF.', position: 'topRight' });
            }
          });
        })();
      },
      error: () => {
        this.imprimiendoId = null;
        iziToast.error({ title: 'Error', message: 'No se pudo obtener la guía.', position: 'topRight' });
      }
    });
  }

  // ─── Acción: Enviar por WhatsApp ─────────────────────────────────────────────

  enviarWhatsapp(row: GuiaEmitidaListItem): void {
    const tel = prompt('Número WhatsApp del destinatario (con código país, ej: 51987654321):');
    if (!tel || !tel.trim()) return;
    this.facturacionService.obtenerGuia(row.idGuiaElectronica).subscribe({
      next: (res) => {
        void (async () => {
          const guia = res.data;
          const qrUrl = await qrDataUrlParaPdfGuia(guia);
          const html = this.generarHtmlGuia(guia, qrUrl, 'A4');
          this.pdfService.generarPdfDinamico({ html }, 'guia-remision', 10, 'A4').subscribe({
            next: (blob) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              const filename = `GRE-${row.serie}-${row.numero}.pdf`;
              const texto = `Guía de Remisión Electrónica\n${row.serie}-${row.numero}\nFecha: ${row.fechaEmision?.slice(0, 10) ?? ''}`;
              this.whatsappService.enviarArchivo(tel.trim(), base64, filename, 'document', texto).subscribe({
                next: () => iziToast.success({ title: 'WhatsApp', message: 'Guía enviada por WhatsApp.', position: 'topRight' }),
                error: () => iziToast.error({ title: 'Error', message: 'No se pudo enviar por WhatsApp.', position: 'topRight' })
              });
            };
            reader.readAsDataURL(blob);
          },
          error: () => iziToast.error({ title: 'Error PDF', message: 'No se pudo generar el PDF para WhatsApp.', position: 'topRight' })
        });
        })();
      },
      error: () => iziToast.error({ title: 'Error', message: 'No se pudo obtener la guía.', position: 'topRight' })
    });
  }

  // ─── Acción: Eliminar ─────────────────────────────────────────────────────────

  eliminar(row: GuiaEmitidaListItem): void {
    if (!confirm(`¿Eliminar la guía ${row.serie}-${row.numero}? Solo se puede eliminar si no está aceptada por SUNAT.`)) return;
    this.eliminandoId = row.idGuiaElectronica;
    this.facturacionService.eliminarGuia(row.idGuiaElectronica).subscribe({
      next: () => {
        this.eliminandoId = null;
        iziToast.success({ title: 'Eliminada', message: `Guía ${row.serie}-${row.numero} eliminada.`, position: 'topRight' });
        if (this.guiaSeleccionada?.idGuiaElectronica === row.idGuiaElectronica) this.guiaSeleccionada = null;
        this.cargar();
      },
      error: (err) => {
        this.eliminandoId = null;
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo eliminar.', position: 'topRight' });
      }
    });
  }

  // ─── Generación HTML para PDF ────────────────────────────────────────────────

  /**
   * Vista unificada para PDF/WhatsApp: datosGuia + columnas de listado (motivo, comprobante origen).
   * El backend también fusiona empresa y columnas en GET /guias/:id.
   */
  private vistaDatosGuiaParaPdf(guia: GuiaDetalle): NonNullable<GuiaDetalle['datosGuia']> {
    const raw = guia.datosGuia ?? {};
    return {
      ...raw,
      motivoTraslado: raw.motivoTraslado ?? guia.motivoTraslado ?? undefined,
      comprobanteOrigenSerie: raw.comprobanteOrigenSerie ?? guia.comprobanteOrigenSerie ?? undefined,
      comprobanteOrigenNumero: raw.comprobanteOrigenNumero ?? guia.comprobanteOrigenNumero ?? undefined
    };
  }

  generarHtmlGuia(guia: GuiaDetalle, qrDataUrl: string | null = null, formato: GrePdfFormato = 'A4'): string {
    const d = this.vistaDatosGuiaParaPdf(guia);
    const serie = guia.serie ?? '';
    const numero = guia.numero ?? '';
    const es31 = guia.tipoDocumento === '31';
    const tipoDoc = es31 ? 'GUÍA DE REMISIÓN TRANSPORTISTA' : 'GUÍA DE REMISIÓN REMITENTE';
    const codSunat = es31 ? '31' : '09';
    const fecha = (guia.fechaEmision ?? '').slice(0, 10);
    const motivoMap: Record<string, string> = {
      '01': 'Venta',
      '02': 'Compra',
      '04': 'Traslado entre establecimientos',
      '08': 'Importación',
      '09': 'Exportación',
      '13': 'Otros'
    };
    const motivo = motivoMap[d.motivoTraslado ?? ''] || d.motivoTraslado || '—';
    const modalidad = d.modalidadTransporte === '01' ? 'Público' : 'Privado';
    const peso = d.cantidadPeso != null ? `${d.cantidadPeso} ${d.unidadMedidaPeso ?? 'KGM'}` : '—';

    const mostrarConductorPdf = !d.vehiculoM1L && (es31 ? true : d.modalidadTransporte === '02');
    const conductorBloque = mostrarConductorPdf
      ? `
      <tr><td style="font-weight:600">Conductor</td><td>${d.nombreConductor ?? '—'}</td><td style="font-weight:600">Doc. conductor</td><td>${d.tipoDocConductor === '1' ? 'DNI' : 'PASAPORTE'}: ${d.numeroDocConductor ?? '—'}</td></tr>
      <tr><td style="font-weight:600">Licencia</td><td>${d.licenciaConductor ?? '—'}</td><td style="font-weight:600">Placa vehículo</td><td>${d.placaVehiculo ?? '—'}${d.placaSecundaria ? ' / ' + d.placaSecundaria : ''}</td></tr>`
      : d.vehiculoM1L
        ? `<tr><td colspan="4" style="font-style:italic;color:#666">Vehículo M1/L — sin conductor/placa obligatorios en SUNAT</td></tr>`
        : '';
    const transportistaBloque =
      !es31 && d.modalidadTransporte === '01'
        ? `
      <tr><td style="font-weight:600">Transportista</td><td>${d.razonSocialTransportista ?? '—'}</td><td style="font-weight:600">RUC transportista</td><td>${d.rucTransportista ?? '—'}</td></tr>`
        : '';

    const remitenteBloque =
      es31 && (d.nomRemitente || d.numDocRemitente)
        ? `<div class="sec">REMITENTE DE LA CARGA</div>
<table class="info">
  <tr><td>Nombre</td><td colspan="3">${d.nomRemitente ?? '—'}</td></tr>
  <tr><td>Tipo doc.</td><td>${d.tipoDocRemitente === '6' ? 'RUC' : d.tipoDocRemitente === '1' ? 'DNI' : d.tipoDocRemitente ?? '—'}</td><td>Nº</td><td>${d.numDocRemitente ?? '—'}</td></tr>
</table>`
        : '';

    const estadoBadge =
      guia.idEstadoSunat === 1
        ? `<span style="color:#15803d;font-weight:700">ACEPTADA</span>`
        : guia.idEstadoSunat === 2
          ? `<span style="color:#b45309;font-weight:700">EN PROCESO</span>`
          : guia.idEstadoSunat === 98
            ? `<span style="color:#b91c1c;font-weight:700">ERROR SUNAT</span>`
            : `<span style="color:#78716c;font-weight:700">PENDIENTE</span>`;

    const mostrarFirmas = es31;
    const tamQr = formato === 'ticket' ? '2.4cm' : '2.6cm';
    const itemsHtml = greItemsTablaHtml(d.items, formato);

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>${estilosGrePdfInline(formato)}</style>
</head>
<body>
<div class="header">
  <div class="empresa">
    <h2>${d.emisorNombre ?? 'Empresa'}</h2>
    <p>RUC: ${d.emisorRuc ?? '—'}</p>
    <p>${d.dirOrigen ?? ''}</p>
  </div>
  <div class="doc-box">
    <div class="tipo">${tipoDoc}</div>
    <div class="cod">Tipo doc.: ${codSunat}</div>
    <div class="serie">${serie}-${numero}</div>
    <div class="estado">${estadoBadge}</div>
  </div>
</div>

<div class="sec">DATOS DEL TRASLADO</div>
<table class="info">
  <tr>
    <td>Fecha emisión</td><td>${fecha}</td>
    <td>Hora inicio</td><td>${d.horaInicioTraslado ?? '—'}</td>
  </tr>
  <tr>
    <td>Motivo traslado</td><td>${motivo}${d.descripcionMotivo ? ' — ' + d.descripcionMotivo : ''}</td>
    <td>Modalidad</td><td>${modalidad}</td>
  </tr>
  <tr>
    <td>Peso bruto</td><td>${peso}</td>
    <td>Doc. origen</td><td>${d.comprobanteOrigenSerie && d.comprobanteOrigenNumero ? d.comprobanteOrigenSerie + '-' + d.comprobanteOrigenNumero : '—'}</td>
  </tr>
</table>

<div class="sec">DESTINATARIO</div>
<table class="info">
  <tr>
    <td>Nombre / Razón social</td><td colspan="3">${d.nomDestinatario ?? '—'}</td>
  </tr>
  <tr>
    <td>Tipo doc.</td><td>${d.tipoDocDestinatario === '6' ? 'RUC' : d.tipoDocDestinatario === '1' ? 'DNI' : d.tipoDocDestinatario ?? '—'}</td>
    <td>Nº documento</td><td>${d.numDocDestinatario ?? '—'}</td>
  </tr>
</table>
${remitenteBloque}
<div class="sec">DIRECCIONES</div>
<table class="info">
  <tr><td>Punto de partida</td><td colspan="3">${d.dirOrigen ?? '—'}</td></tr>
  <tr><td>Punto de llegada</td><td colspan="3">${d.dirDestino ?? '—'}</td></tr>
</table>

<div class="sec">TRANSPORTE</div>
<table class="info">
  ${conductorBloque}
  ${transportistaBloque}
</table>

<div class="sec">BIENES TRASLADADOS</div>
${itemsHtml}
${mostrarFirmas ? htmlFirmasGreTransportista() : ''}
${htmlBloqueQrSunatGre(qrDataUrl, { soloDatoQr: true, tamanoQr: tamQr })}
</body>
</html>`;
  }
}
