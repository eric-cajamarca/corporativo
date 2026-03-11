import { HttpClient, HttpHeaders } from '@angular/common/http';
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
  listarComprobantesParaBaja(): Observable<{ data: ComprobanteParaBaja[] }> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get<{ data: ComprobanteParaBaja[] }>(
      this.url + 'facturacion/comunicacion-baja/comprobantes',
      { headers, withCredentials: true }
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

  /** Lista comunicaciones de baja enviadas. */
  listarComunicacionesBaja(params?: { fechaDesde?: string; fechaHasta?: string; idEstadoSunat?: number; pagina?: number; porPagina?: number }): Observable<{ data: any[]; total: number }> {
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
    return this._http.get<{ data: any[]; total: number }>(
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

  crearNotaCreditoDebito(body: {
    idComprobanteElectronicoOrigen: string;
    tipoNota: '07' | '08';
    codigoMotivoNotaCredito?: string;
    items: { idProducto: string; cantidad: number; pVenta: number; subtotal: number; total: number }[];
  }): Observable<{ data: { idVenta: string; idComprobanteElectronico: string } }> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post<{ data: { idVenta: string; idComprobanteElectronico: string } }>(
      this.url + 'facturacion/notas-crecimiento',
      body,
      { headers, withCredentials: true }
    );
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

/** Respuesta de GET origen-para-nota. */
export interface OrigenParaNota {
  comprobanteOrigen: { idComprobanteElectronico: string; serie: string; numero: string; tipoComprobante: string };
  venta: any;
  empresa: any;
  cliente: any;
  items: { idProducto: string; descripcion?: string; cantidad: number; pVenta: number; subtotal: number; total: number }[];
  impuestos?: any;
}