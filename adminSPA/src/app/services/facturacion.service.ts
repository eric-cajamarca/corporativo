import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class FacturacionService {
  public url: any;

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  // Configuración de facturación
  obtenerConfiguracion(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'facturacion/configuracion', {
      headers: headers,
      withCredentials: true
    });
  }

  /** Sube el certificado digital (.pfx) y su clave para firma de XML. No enviar Content-Type para que el browser envíe multipart. */
  subirCertificado(certificado: File, claveCertificado: string): Observable<any> {
    const form = new FormData();
    form.append('certificado', certificado);
    form.append('claveCertificado', claveCertificado ?? '');
    return this._http.post(this.url + 'facturacion/configuracion/certificado', form, {
      withCredentials: true
    });
  }

  actualizarConfiguracion(data: {
    certificadoDigital?: string;
    claveCertificado?: string;
    usuarioSunat?: string;
    claveSunat?: string;
    urlEnvio?: string;
    envioDirectoSunat?: boolean;
    useResumenDiarioBoletas?: boolean;
    usaGuiasElectronicas?: boolean;
    urlBaseApiGuias?: string;
    idApiGuias?: string;
    claveApiGuias?: string;
    modoPrueba: boolean;
    serieFactura: string;
    serieBoleta: string;
    serieNotaCredito: string;
    serieNotaDebito: string;
    rutaCarpetaFacturadorSunat?: string;
    urlFacturadorSunat?: string;
    envioAutomatico?: boolean;
    minutosEnvioAutomatico?: number;
    envioPorLotes?: boolean;
    programacionEnvioLotes?: string;
    /** 1 inmediato al cobrar, 2 diferido N min, 3 hora fija diaria (Lima) */
    modoEnvioSunat?: number;
    /** HH:mm para modo 3 */
    horaEnvioSunat?: string | null;
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'facturacion/configuracion', data, {
      headers: headers,
      withCredentials: true
    });
  }

  // Comprobantes electrónicos
  obtenerComprobantes(filtros?: {
    tipoComprobante?: string;
    estadoSunat?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    let params = '';
    if (filtros) {
      const queryParams = new URLSearchParams();
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
      params = '?' + queryParams.toString();
    }
    return this._http.get(this.url+'facturacion/comprobantes' + params, {
      headers: headers,
      withCredentials: true
    });
  }

  generarComprobante(data: {
    idVenta: string;
    tipoComprobante: 'FACTURA' | 'BOLETA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'facturacion/comprobantes', data, {
      headers: headers,
      withCredentials: true
    });
  }

  enviarComprobanteSunat(idComprobante: string): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this._http.post(this.url+'facturacion/comprobantes/' + idComprobante + '/enviar', {}, {
      headers,
      withCredentials: true
    });
  }

  /**
   * Firma el XML si falta hash (DigestValue) para PDF/QR. No envía a SUNAT.
   * Notas de venta u otros no electrónicos → data.skipped = true.
   */
  asegurarHashPorVenta(idVenta: number): Observable<{
    data?: {
      ok?: boolean;
      skipped?: boolean;
      reason?: string;
      firmadoAhora?: boolean;
      hash?: string;
      idComprobanteElectronico?: string;
    };
    message?: string;
  }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this._http.post<{
      data?: {
        ok?: boolean;
        skipped?: boolean;
        reason?: string;
        firmadoAhora?: boolean;
        hash?: string;
        idComprobanteElectronico?: string;
      };
      message?: string;
    }>(this.url + 'facturacion/comprobantes/por-venta/' + idVenta + '/asegurar-hash', {}, {
      headers,
      withCredentials: true
    });
  }

  /** Envío por lotes: envía todos los comprobantes pendientes de la empresa. */
  enviarLoteSunat(): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url + 'facturacion/enviar-lote', {}, {
      headers,
      withCredentials: true
    });
  }

  /** Consulta estado del comprobante en SUNAT (y obtiene CDR si ya está disponible). Actualiza el comprobante en BD. */
  consultarEstadoSunat(idComprobante: string): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url + 'facturacion/comprobantes/' + idComprobante + '/estado', {
      headers,
      withCredentials: true
    });
  }

  /**
   * Consulta validez del comprobante en SUNAT (billValidService).
   * Parámetros: idComprobanteElectronico O (ruc, tipoComprobante, serie, numero).
   */
  consultarValidezComprobante(params: {
    idComprobanteElectronico?: string;
    ruc?: string;
    tipoComprobante?: string;
    serie?: string;
    numero?: string;
  }): Observable<{ message?: string; data?: { valido: boolean; mensaje?: string; statusCode?: string; error?: string } }> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    const q = new URLSearchParams();
    if (params.idComprobanteElectronico) q.set('idComprobanteElectronico', params.idComprobanteElectronico);
    if (params.ruc) q.set('ruc', params.ruc);
    if (params.tipoComprobante) q.set('tipoComprobante', params.tipoComprobante);
    if (params.serie) q.set('serie', params.serie);
    if (params.numero != null && params.numero !== '') q.set('numero', String(params.numero));
    return this._http.get(this.url + 'facturacion/comprobantes/validez?' + q.toString(), {
      headers,
      withCredentials: true
    });
  }

  /** Obtener contenido XML del comprobante (para ver o descargar). */
  obtenerXmlComprobante(idComprobanteElectronico: string): Observable<{ data: { content: string } }> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get<{ data: { content: string } }>(
      this.url + 'facturacion/comprobantes/' + idComprobanteElectronico + '/xml',
      { headers, withCredentials: true }
    );
  }

  /** Obtener contenido CDR del comprobante (para ver o descargar). */
  obtenerCdrComprobante(idComprobanteElectronico: string): Observable<{ data: { content: string } }> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get<{ data: { content: string } }>(
      this.url + 'facturacion/comprobantes/' + idComprobanteElectronico + '/cdr',
      { headers, withCredentials: true }
    );
  }

  // Estadísticas de facturación
  obtenerEstadisticas(periodo?: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    let params = periodo ? `?periodo=${periodo}` : '';
    return this._http.get(this.url+'facturacion/estadisticas' + params, {
      headers: headers,
      withCredentials: true
    });
  }

  // Estados SUNAT
  obtenerEstadosSunat(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'facturacion/estados-sunat', {
      headers: headers,
      withCredentials: true
    });
  }

  /**
   * Busca comprobante por serie y número para origen de guía. Incluye cliente e items.
   * No exige que el comprobante esté aceptado en SUNAT (busca en CE o en Ventas).
   */
  buscarComprobanteOrigenParaGuia(params: { serie: string; numero: string }): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    const q = new URLSearchParams();
    if (params.serie) q.append('serie', params.serie);
    if (params.numero) q.append('numero', params.numero);
    return this._http.get(this.url + 'facturacion/comprobantes/origen-para-guia?' + q.toString(), {
      headers,
      withCredentials: true
    });
  }

  /** Guías electrónicas emitidas (paginación servidor, por defecto 10 por página). */
  listarGuiasEmitidas(params?: { pagina?: number; porPagina?: number }): Observable<{ data: GuiaEmitidaListItem[]; total: number }> {
    const p = new URLSearchParams();
    if (params?.pagina != null) p.append('pagina', String(params.pagina));
    if (params?.porPagina != null) p.append('porPagina', String(params.porPagina));
    const query = p.toString() ? '?' + p.toString() : '';
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this._http.get<{ data: GuiaEmitidaListItem[]; total: number }>(
      this.url + 'facturacion/guias/emitidas' + query,
      { headers, withCredentials: true }
    );
  }

  // Resúmenes diarios (RC)
  /** Boletas/notas pendientes de envío por fecha en el rango (para aviso en resúmenes diarios). */
  listarBoletasPendientesPorFecha(fechaDesde: string, fechaHasta: string): Observable<{ data: { fechaResumen: string; cantidad: number }[] }> {
    const params = new URLSearchParams({ fechaDesde, fechaHasta });
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get<{ data: { fechaResumen: string; cantidad: number }[] }>(
      this.url + 'facturacion/resumenes-diarios/boletas-pendientes?' + params.toString(),
      { headers, withCredentials: true }
    );
  }

  listarResumenesDiarios(params?: { fechaDesde?: string; fechaHasta?: string; idEstadoSunat?: number; pagina?: number; porPagina?: number }): Observable<{ data: any[]; total: number }> {
    let query = '';
    if (params) {
      const p = new URLSearchParams();
      if (params.fechaDesde != null) p.append('fechaDesde', params.fechaDesde);
      if (params.fechaHasta != null) p.append('fechaHasta', params.fechaHasta);
      if (params.idEstadoSunat != null) p.append('idEstadoSunat', String(params.idEstadoSunat));
      if (params.pagina != null) p.append('pagina', String(params.pagina));
      if (params.porPagina != null) p.append('porPagina', String(params.porPagina));
      query = '?' + p.toString();
    }
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get<{ data: any[]; total: number }>(this.url + 'facturacion/resumenes-diarios' + query, {
      headers,
      withCredentials: true
    });
  }

  enviarResumenDiario(fechaResumen: string): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url + 'facturacion/resumenes-diarios/enviar', { fechaResumen }, {
      headers,
      withCredentials: true
    });
  }

  consultarEstadoResumenDiario(idResumenDiarioSunat: string): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(
      this.url + 'facturacion/resumenes-diarios/' + encodeURIComponent(idResumenDiarioSunat) + '/consultar-estado',
      {},
      { headers, withCredentials: true }
    );
  }

  /** Lista comprobantes Factura/Boleta aceptados por RUC o razón social del cliente (elegir uno). */
  listarComprobantesOrigenPorCliente(params: {
    rucCliente?: string;
    razonSocial?: string;
    tipoComprobante?: string;
  }): Observable<{ data: ComprobanteOrigenItem[] }> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    const q = new URLSearchParams();
    if (params.rucCliente != null) q.append('rucCliente', params.rucCliente);
    if (params.razonSocial != null) q.append('razonSocial', params.razonSocial);
    if (params.tipoComprobante != null) q.append('tipoComprobante', params.tipoComprobante);
    return this._http.get<{ data: ComprobanteOrigenItem[] }>(
      this.url + 'facturacion/comprobantes/buscar-origen?' + q.toString(),
      { headers, withCredentials: true }
    );
  }

  /** Origen para NC/ND: por id de comprobante o por serie, numero y tipoComprobante (01 factura, 03 boleta). */
  obtenerOrigenParaNota(params: {
    idComprobanteElectronico?: string;
    serie?: string;
    numero?: string;
    tipoComprobante?: string;
  }): Observable<{ data: OrigenParaNota }> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    if (params.idComprobanteElectronico) {
      return this._http.get<{ data: OrigenParaNota }>(
        this.url + 'facturacion/comprobantes/' + params.idComprobanteElectronico + '/origen-para-nota',
        { headers, withCredentials: true }
      );
    }
    const q = new URLSearchParams();
    if (params.serie != null) q.append('serie', params.serie);
    if (params.numero != null) q.append('numero', params.numero);
    if (params.tipoComprobante != null) q.append('tipoComprobante', params.tipoComprobante);
    return this._http.get<{ data: OrigenParaNota }>(
      this.url + 'facturacion/comprobantes/origen-para-nota?' + q.toString(),
      { headers, withCredentials: true }
    );
  }

  /** Crear nota de crédito (07) o débito (08). codigoMotivoNotaCredito solo para 07 (catálogo 09). */
  /** Comunicación de baja (RA): listar comprobantes aceptados (01/07/08) para dar de baja. */
  listarComprobantesParaBaja(params?: {
    pagina?: number;
    porPagina?: number;
    buscar?: string;
  }): Observable<{ data: ComprobanteParaBaja[]; total: number }> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    let httpParams = new HttpParams();
    if (params?.pagina != null) {
      httpParams = httpParams.set('pagina', String(params.pagina));
    }
    if (params?.porPagina != null) {
      httpParams = httpParams.set('porPagina', String(params.porPagina));
    }
    const buscar = (params?.buscar ?? '').trim();
    if (buscar) {
      httpParams = httpParams.set('buscar', buscar);
    }
    return this._http.get<{ data: ComprobanteParaBaja[]; total: number }>(
      this.url + 'facturacion/comunicacion-baja/comprobantes',
      { headers, params: httpParams, withCredentials: true }
    );
  }

  /** Catálogo global de motivos de baja. */
  listarMotivosBaja(): Observable<{ data: MotivoBaja[] }> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get<{ data: MotivoBaja[] }>(
      this.url + 'facturacion/comunicacion-baja/motivos',
      { headers, withCredentials: true }
    );
  }

  /** Elimina una comunicación del historial si el correlativo no coincide con catálogo RA o está rechazada; no altera Comprobantes.numero. */
  eliminarComunicacionBaja(idComunicacionBaja: string): Observable<{ message: string }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this._http.delete<{ message: string }>(
      this.url + 'facturacion/comunicacion-baja/' + encodeURIComponent(idComunicacionBaja),
      { headers, withCredentials: true }
    );
  }

  /** Lista comunicaciones de baja enviadas. */
  listarComunicacionesBaja(params?: { fechaDesde?: string; fechaHasta?: string; idEstadoSunat?: number; pagina?: number; porPagina?: number }): Observable<{ data: ComunicacionBajaHistorialItem[]; total: number }> {
    let query = '';
    if (params) {
      const p = new URLSearchParams();
      if (params.fechaDesde != null) p.append('fechaDesde', params.fechaDesde);
      if (params.fechaHasta != null) p.append('fechaHasta', params.fechaHasta);
      if (params.idEstadoSunat != null) p.append('idEstadoSunat', String(params.idEstadoSunat));
      if (params.pagina != null) p.append('pagina', String(params.pagina));
      if (params.porPagina != null) p.append('porPagina', String(params.porPagina));
      query = '?' + p.toString();
    }
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get<{ data: ComunicacionBajaHistorialItem[]; total: number }>(
      this.url + 'facturacion/comunicacion-baja' + query,
      { headers, withCredentials: true }
    );
  }

  /** Envía comunicación de baja (RA) con los comprobantes seleccionados. */
  enviarComunicacionBaja(comprobantes: { idComprobanteElectronico: string; motivoBaja: string }[]): Observable<{ data: { idComunicacionBaja: string; ticket: string }; message: string }> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post<{ data: { idComunicacionBaja: string; ticket: string }; message: string }>(
      this.url + 'facturacion/comunicacion-baja/enviar',
      { comprobantes },
      { headers, withCredentials: true }
    );
  }

  /** Consulta estado de una comunicación de baja en SUNAT (getStatus). */
  consultarEstadoComunicacionBaja(idComunicacionBaja: string): Observable<{ mensaje: string; statusCode?: number; idEstadoSunat?: number }> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post<{ mensaje: string; statusCode?: number; idEstadoSunat?: number }>(
      this.url + 'facturacion/comunicacion-baja/' + encodeURIComponent(idComunicacionBaja) + '/consultar-estado',
      {},
      { headers, withCredentials: true }
    );
  }

  /** XML firmado de la RA enviada (tras migración y nuevo envío). */
  obtenerXmlComunicacionBaja(idComunicacionBaja: string): Observable<{ data: { content: string } }> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get<{ data: { content: string } }>(
      this.url + 'facturacion/comunicacion-baja/' + encodeURIComponent(idComunicacionBaja) + '/xml',
      { headers, withCredentials: true }
    );
  }

  /** CDR devuelto por getStatus (aceptación o rechazo). */
  obtenerCdrComunicacionBaja(idComunicacionBaja: string): Observable<{ data: { content: string } }> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get<{ data: { content: string } }>(
      this.url + 'facturacion/comunicacion-baja/' + encodeURIComponent(idComunicacionBaja) + '/cdr',
      { headers, withCredentials: true }
    );
  }

  crearNotaCreditoDebito(body: {
    idComprobanteElectronicoOrigen: string;
    tipoNota: '07' | '08';
    codigoMotivoNotaCredito?: string;
    codigoMotivoNotaDebito?: string;
    items: { idProducto: string; cantidad: number; pVenta: number; subtotal: number; total: number; igv?: number }[];
  }): Observable<{ data: { idVenta: string; idComprobanteElectronico: string } }> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post<{ data: { idVenta: string; idComprobanteElectronico: string } }>(
      this.url + 'facturacion/notas-crecimiento',
      body,
      { headers, withCredentials: true }
    );
  }

  /** Registra la GRE en BD y la envía a SUNAT si las credenciales API GRE están configuradas. */
  registrarGuia(datos: RegistrarGuiaPayload): Observable<RegistrarGuiaResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this._http.post<RegistrarGuiaResponse>(
      this.url + 'facturacion/guias/registrar',
      datos,
      { headers, withCredentials: true }
    );
  }

  /** Actualiza una guía pendiente o con error SUNAT (mismo cuerpo que registrar, sin nuevo correlativo). */
  actualizarGuia(id: string, datos: RegistrarGuiaPayload): Observable<ActualizarGuiaResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this._http.put<ActualizarGuiaResponse>(
      this.url + 'facturacion/guias/' + encodeURIComponent(id),
      datos,
      { headers, withCredentials: true }
    );
  }

  /** Detalle de una guía electrónica (incluye datosGuia JSON si existe la columna). */
  obtenerGuia(id: string): Observable<{ data: GuiaDetalle }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this._http.get<{ data: GuiaDetalle }>(
      this.url + 'facturacion/guias/' + encodeURIComponent(id),
      { headers, withCredentials: true }
    );
  }

  /** Reenvía una guía pendiente/con error a SUNAT. */
  reenviarGuia(id: string): Observable<{ message: string; data: any }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this._http.post<{ message: string; data: any }>(
      this.url + 'facturacion/guias/' + encodeURIComponent(id) + '/enviar',
      {},
      { headers, withCredentials: true }
    );
  }

  /** Elimina una guía que no esté aceptada. */
  eliminarGuia(id: string): Observable<{ message: string }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this._http.delete<{ message: string }>(
      this.url + 'facturacion/guias/' + encodeURIComponent(id),
      { headers, withCredentials: true }
    );
  }

  /** Consulta el ticket pendiente de una guía EN_PROCESO. */
  consultarTicketGuia(id: string): Observable<{ ok: boolean; aceptado?: boolean; enProceso?: boolean; error?: boolean; mensaje: string }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this._http.get<{ ok: boolean; aceptado?: boolean; enProceso?: boolean; error?: boolean; mensaje: string }>(
      this.url + 'facturacion/guias/' + encodeURIComponent(id) + '/ticket',
      { headers, withCredentials: true }
    );
  }

  /**
   * Consulta estado actual en SUNAT con CLAVE SOL (getStatusCdr / validez) y sincroniza BD.
   * Útil si la guía se dio de baja en el portal y aquí sigue como aceptada.
   */
  consultarEstadoGuiaSol(id: string): Observable<{
    ok: boolean;
    actualizado?: boolean;
    idEstadoSunat?: number;
    mensaje: string;
    fuente?: string;
  }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this._http.post<{
      ok: boolean;
      actualizado?: boolean;
      idEstadoSunat?: number;
      mensaje: string;
      fuente?: string;
    }>(
      this.url + 'facturacion/guias/' + encodeURIComponent(id) + '/consultar-estado-sol',
      {},
      { headers, withCredentials: true }
    );
  }

  /** GET último XML firmado almacenado en BD (mismo que se envió en ZIP a SUNAT). */
  descargarXmlFirmadoGuia(id: string): Observable<Blob> {
    const headers = new HttpHeaders({ Authorization: '' });
    return this._http.get(this.url + 'facturacion/guias/' + encodeURIComponent(id) + '/xml-firmado', {
      headers,
      withCredentials: true,
      responseType: 'blob'
    });
  }
}

/** Comprobante aceptado listado para comunicación de baja. */
export interface ComprobanteParaBaja {
  idComprobanteElectronico: string;
  tipoComprobante: string;
  serie: string;
  numero: string;
  fechaEmision: string;
}

/** Motivo de baja (catálogo global). */
export interface MotivoBaja {
  idMotivoBaja: string;
  codigoSunat: string;
  descripcion: string;
}

/** Fila del historial de comunicaciones de baja (RA). */
export interface ComunicacionBajaHistorialItem {
  idComunicacionBaja: string;
  fechaComunicacion: string;
  numeroCorrelativo: string;
  ticketSunat?: string | null;
  idEstadoSunat: number | null;
  codigoEstadoSunat?: string | null;
  descripcionEstadoSunat?: string | null;
  descripcionRespuesta?: string | null;
  tieneXmlEnviado?: number | boolean;
  tieneCdr?: number | boolean;
  /** 1 = se puede usar eliminar (rechazada, correlativo ≠ catálogo RA o inválido); nunca si baja aceptada (8). */
  puedeEliminarCorrelativoIncorrecto?: number | boolean;
}

/** Item de listado GET buscar-origen. */
export interface ComprobanteOrigenItem {
  idComprobanteElectronico: string;
  serie: string;
  numero: string;
  tipoComprobante: string;
  fechaEmision: string;
  clienteRuc: string;
  clienteRazonSocial: string;
}

/** Detalle completo de una guía (incluye datosGuia JSON). */
export interface GuiaDetalle extends GuiaEmitidaListItem {
  /** Indica si existe XML firmado guardado (el cuerpo no se envía en JSON; use descargarXmlFirmadoGuia). */
  tieneXmlFirmado?: boolean;
  /** DigestValue (Base64) del XML firmado — noveno campo del QR representación impresa. */
  codigoHashSunat?: string;
  /** Cadena del QR PDF: RUC|tipo|serie|numero|fecha|tipoDocDest|nroDocDest|hash. */
  cadenaQrSunat?: string;
  datosGuia?: {
    tipoGuia?: string;
    tipoDocumento?: string;
    serie?: string;
    fechaEmision?: string;
    horaInicioTraslado?: string;
    motivoTraslado?: string;
    descripcionMotivo?: string;
    modalidadTransporte?: string;
    cantidadPeso?: number | null;
    unidadMedidaPeso?: string;
    emisorRuc?: string;
    emisorNombre?: string;
    dirOrigen?: string;
    ubigeoOrigen?: string;
    codLocalOrigen?: string;
    departamentoOrigen?: string;
    provinciaOrigen?: string;
    distritoOrigen?: string;
    dirDestino?: string;
    ubigeoDestino?: string;
    codLocalDestino?: string;
    departamentoDestino?: string;
    provinciaDestino?: string;
    distritoDestino?: string;
    tipoDocDestinatario?: string;
    numDocDestinatario?: string;
    nomDestinatario?: string;
    telefonoDestinatario?: string;
    placaVehiculo?: string;
    placaSecundaria?: string;
    tipoDocConductor?: string;
    numeroDocConductor?: string;
    nombreConductor?: string;
    licenciaConductor?: string;
    rucTransportista?: string;
    razonSocialTransportista?: string;
    vehiculoM1L?: boolean;
    tipoDocRemitente?: string;
    numDocRemitente?: string;
    nomRemitente?: string;
    idVehiculoEmpresa?: string;
    items?: { codigo?: string; descripcion?: string; cantidad: number; unidad?: string }[];
    observaciones?: string;
    comprobanteOrigenSerie?: string;
    comprobanteOrigenNumero?: string;
    tipoComprobanteOrigen?: string;
    rucEmisorDocumentoRelacionado?: string;
    indicadorPagadorFlete?: string;
    registroMtcVehiculo?: string;
    nroMtcTransportista?: string;
  } | null;
}

/** Payload para POST /facturacion/guias/registrar. */
export interface RegistrarGuiaPayload {
  tipoGuia: 'REMITENTE' | 'TRANSPORTISTA';
  motivoTraslado: string;
  descripcionMotivo?: string;
  fechaEmision: string;
  horaInicioTraslado?: string;
  cantidadPeso?: number | null;
  unidadMedidaPeso?: string;
  modalidadTransporte: string;
  /** GRE transportista (31): vehículo categoría M1/L exime conductor y placa en validación SUNAT. */
  vehiculoM1L?: boolean;
  /** Remitente de la carga (DespatchParty) — obligatorio en tipo 31. */
  tipoDocRemitente?: string;
  numDocRemitente?: string;
  nomRemitente?: string;
  /** Vehículo del catálogo empresa (opcional; referencia para placa). */
  idVehiculoEmpresa?: string;
  // Transporte privado
  placaVehiculo?: string;
  placaSecundaria?: string;
  tipoDocConductor?: string;
  numeroDocConductor?: string;
  nombreConductor?: string;
  licenciaConductor?: string;
  // Transporte público
  rucTransportista?: string;
  razonSocialTransportista?: string;
  /** Inscripción MTC del transportista (GRE 31: CarrierParty/CompanyID). */
  nroMtcTransportista?: string;
  /** Inscripción/registro MTC del vehículo (ApplicableTransportMeans/RegistrationNationalityID). */
  registroMtcVehiculo?: string;
  /** REMITENTE | DESTINATARIO | TRANSPORTISTA → SpecialInstructions SUNAT pagador de flete. */
  indicadorPagadorFlete?: string;
  // Origen / Destino
  dirOrigen?: string;
  ubigeoOrigen?: string;
  /** Código de establecimiento SUNAT (4 dígitos) — AddressTypeCode en OriginAddress / RegistrationAddress */
  codLocalOrigen?: string;
  /** Departamento (o region de DireccionEmpresa) para XML partida */
  departamentoOrigen?: string;
  provinciaOrigen?: string;
  distritoOrigen?: string;
  dirDestino?: string;
  ubigeoDestino?: string;
  codLocalDestino?: string;
  /** Departamento (o region de DireccionClientes) para XML llegada */
  departamentoDestino?: string;
  provinciaDestino?: string;
  distritoDestino?: string;
  // Destinatario
  tipoDocDestinatario?: string;
  numDocDestinatario?: string;
  nomDestinatario?: string;
  // Comprobante origen
  comprobanteOrigenSerie?: string;
  comprobanteOrigenNumero?: string;
  tipoComprobanteOrigen?: string;
  /** RUC de quien emitió el comprobante relacionado (SUNAT 3380). Por defecto el backend usa el RUC de la empresa. */
  rucEmisorDocumentoRelacionado?: string;
  items?: { codigo?: string; descripcion?: string; cantidad: number; unidad?: string }[];
  observaciones?: string;
}

/** Respuesta de POST /facturacion/guias/registrar. */
export interface RegistrarGuiaResponse {
  message: string;
  advertencia?: string;
  enviado?: boolean;
  aceptado?: boolean;
  data: {
    idGuiaElectronica: string;
    serie: string;
    numero: string;
    tipoDocumento: string;
    tipoRol: string;
    idEstadoSunat?: number | null;
    descripcionEstado?: string;
  };
}

/** Respuesta de PUT /facturacion/guias/:id. */
export interface ActualizarGuiaResponse {
  message: string;
  data: RegistrarGuiaResponse['data'];
}

/** Fila de listado GET guias/emitidas. */
export interface GuiaEmitidaListItem {
  idGuiaElectronica: string;
  tipoDocumento: string;
  tipoRol: string;
  serie: string;
  numero: string;
  fechaEmision: string;
  idEstadoSunat: number | null;
  descripcionEstado: string | null;
  ticketSunat: string | null;
  comprobanteOrigenSerie: string | null;
  comprobanteOrigenNumero: string | null;
  motivoTraslado: string | null;
  fechaCreacion: string;
}

/** Respuesta de GET origen-para-nota. */
export interface OrigenParaNota {
  comprobanteOrigen: { idComprobanteElectronico: string; serie: string; numero: string; tipoComprobante: string };
  venta: any;
  empresa: any;
  cliente: any;
  items: { idProducto: string; descripcion?: string; cantidad: number; pVenta: number; subtotal: number; total: number }[];
  impuestos?: any;
}