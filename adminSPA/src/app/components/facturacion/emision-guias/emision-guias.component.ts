import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FacturacionService, GuiaEmitidaListItem, GuiaDetalle } from '../../../services/facturacion.service';
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

  // ─── Acción: Imprimir PDF A4 ─────────────────────────────────────────────────

  imprimirPdf(row: GuiaEmitidaListItem): void {
    this.imprimiendoId = row.idGuiaElectronica;
    this.facturacionService.obtenerGuia(row.idGuiaElectronica).subscribe({
      next: (res) => {
        const guia = res.data;
        const html = this.generarHtmlGuia(guia);
        this.pdfService.generarPdfDinamico({ html }, 'guia-remision', 10, 'A4').subscribe({
          next: (blob) => {
            this.imprimiendoId = null;
            this.pdfService.previsualizar(blob);
          },
          error: () => {
            this.imprimiendoId = null;
            iziToast.error({ title: 'Error', message: 'No se pudo generar el PDF.', position: 'topRight' });
          }
        });
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
        const guia = res.data;
        const html = this.generarHtmlGuia(guia);
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

  generarHtmlGuia(guia: GuiaDetalle): string {
    const d = this.vistaDatosGuiaParaPdf(guia);
    const serie  = guia.serie  ?? '';
    const numero = guia.numero ?? '';
    const tipoDoc = guia.tipoDocumento === '31' ? 'GUÍA DE REMISIÓN TRANSPORTISTA' : 'GUÍA DE REMISIÓN REMITENTE';
    const codSunat = guia.tipoDocumento === '31' ? '31' : '09';
    const fecha = (guia.fechaEmision ?? '').slice(0, 10);
    const motivoMap: Record<string, string> = {
      '01': 'Venta', '02': 'Compra', '04': 'Traslado entre establecimientos',
      '08': 'Importación', '09': 'Exportación', '13': 'Otros'
    };
    const motivo = motivoMap[d.motivoTraslado ?? ''] || d.motivoTraslado || '—';
    const modalidad = d.modalidadTransporte === '01' ? 'Público' : 'Privado';
    const peso = d.cantidadPeso != null ? `${d.cantidadPeso} ${d.unidadMedidaPeso ?? 'KGM'}` : '—';

    const itemsRows = (d.items ?? []).map((it, i) =>
      `<tr>
        <td>${i + 1}</td>
        <td>${it.codigo ?? ''}</td>
        <td>${it.descripcion ?? ''}</td>
        <td>${it.cantidad ?? ''}</td>
        <td>${it.unidad ?? 'NIU'}</td>
      </tr>`
    ).join('') || `<tr><td colspan="5" style="text-align:center;color:#888">Sin detalle de bienes</td></tr>`;

    const conductorBloque = d.modalidadTransporte === '02' ? `
      <tr><td style="font-weight:600">Conductor</td><td>${d.nombreConductor ?? '—'}</td><td style="font-weight:600">Doc. conductor</td><td>${d.tipoDocConductor === '1' ? 'DNI' : 'PASAPORTE'}: ${d.numeroDocConductor ?? '—'}</td></tr>
      <tr><td style="font-weight:600">Licencia</td><td>${d.licenciaConductor ?? '—'}</td><td style="font-weight:600">Placa vehículo</td><td>${d.placaVehiculo ?? '—'}${d.placaSecundaria ? ' / ' + d.placaSecundaria : ''}</td></tr>
    ` : '';
    const transportistaBloque = d.modalidadTransporte === '01' ? `
      <tr><td style="font-weight:600">Transportista</td><td>${d.razonSocialTransportista ?? '—'}</td><td style="font-weight:600">RUC transportista</td><td>${d.rucTransportista ?? '—'}</td></tr>
    ` : '';

    const estadoBadge = guia.idEstadoSunat === 1
      ? `<span style="color:#15803d;font-weight:700">ACEPTADA</span>`
      : guia.idEstadoSunat === 2
        ? `<span style="color:#b45309;font-weight:700">EN PROCESO</span>`
        : guia.idEstadoSunat === 98
          ? `<span style="color:#b91c1c;font-weight:700">ERROR SUNAT</span>`
          : `<span style="color:#78716c;font-weight:700">PENDIENTE</span>`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:10px;color:#1a1a1a;padding:16px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d4ed8;padding-bottom:10px;margin-bottom:12px}
  .empresa h2{font-size:13px;color:#1d4ed8;margin-bottom:4px}
  .empresa p{font-size:9px;color:#555;line-height:1.5}
  .doc-box{border:2px solid #1d4ed8;border-radius:6px;padding:8px 14px;text-align:center;min-width:160px}
  .doc-box .tipo{font-size:9px;font-weight:700;color:#1d4ed8;letter-spacing:0.5px}
  .doc-box .cod{font-size:7px;color:#666;margin:2px 0}
  .doc-box .serie{font-size:16px;font-weight:900;color:#1a1a1a;letter-spacing:1px}
  .doc-box .estado{margin-top:4px;font-size:9px}
  table.info{width:100%;border-collapse:collapse;margin-bottom:10px}
  table.info td{padding:3px 6px;border:1px solid #e5e7eb;vertical-align:top;font-size:9px}
  table.info td:first-child,table.info td:nth-child(3){width:18%;background:#f1f5f9;font-weight:600;color:#374151}
  .section-title{background:#1d4ed8;color:#fff;font-size:9px;font-weight:700;padding:3px 8px;margin:8px 0 4px;border-radius:3px}
  table.items{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:8px}
  table.items th{background:#1d4ed8;color:#fff;padding:4px 6px;text-align:left}
  table.items td{padding:3px 6px;border-bottom:1px solid #e5e7eb}
  table.items tr:nth-child(even) td{background:#f8fafc}
  .obs{font-size:9px;color:#555;margin-top:6px;padding:6px 8px;background:#fafafa;border:1px solid #e5e7eb;border-radius:3px}
  .footer{margin-top:14px;text-align:center;font-size:8px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:6px}
  .firma-box{margin-top:28px;display:flex;justify-content:space-around;text-align:center;font-size:9px}
  .firma-box div{border-top:1px solid #374151;padding-top:4px;min-width:140px}
</style>
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

<div class="section-title">DATOS DEL TRASLADO</div>
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

<div class="section-title">DESTINATARIO</div>
<table class="info">
  <tr>
    <td>Nombre / Razón social</td><td colspan="3">${d.nomDestinatario ?? '—'}</td>
  </tr>
  <tr>
    <td>Tipo doc.</td><td>${d.tipoDocDestinatario === '6' ? 'RUC' : d.tipoDocDestinatario === '1' ? 'DNI' : d.tipoDocDestinatario ?? '—'}</td>
    <td>Nº documento</td><td>${d.numDocDestinatario ?? '—'}</td>
  </tr>
</table>

<div class="section-title">DIRECCIONES</div>
<table class="info">
  <tr><td>Punto de partida</td><td colspan="3">${d.dirOrigen ?? '—'}</td></tr>
  <tr><td>Punto de llegada</td><td colspan="3">${d.dirDestino ?? '—'}</td></tr>
</table>

<div class="section-title">TRANSPORTE</div>
<table class="info">
  ${conductorBloque}
  ${transportistaBloque}
</table>

<div class="section-title">BIENES TRASLADADOS</div>
<table class="items">
  <thead>
    <tr><th>#</th><th>Código</th><th>Descripción</th><th>Cantidad</th><th>Unidad</th></tr>
  </thead>
  <tbody>${itemsRows}</tbody>
</table>

${d.observaciones ? `<div class="obs"><strong>Observaciones:</strong> ${d.observaciones}</div>` : ''}

<div class="firma-box">
  <div>Firma y sello emisor</div>
  <div>Firma receptor conforme</div>
</div>

<div class="footer">
  Documento generado electrónicamente. ${guia.idEstadoSunat === 1 ? 'Comprobante aceptado por SUNAT.' : 'Estado: ' + this.etiquetaEstado(guia)}
</div>
</body>
</html>`;
  }
}
