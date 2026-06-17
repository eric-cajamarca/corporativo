import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs/internal/Observable';
import type { ComprobanteCompraSunatListaItem } from '../models/comprobante-compra-sunat.model';
import type { ReporteComprasDetalladoData } from '../models/reporte-compras-detallado.model';

@Injectable({
  providedIn: 'root'
})
export class ComprasService {

  public url: any;
  private _router: any;
  public idUser: any;


  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  //   api.get('/compras',auth.auth, comprasController.obtener_compras_todos);
  // api.get('/compras/:id',auth.auth, comprasController.obtener_compras_id);

  // api.get('/comprasempresa/:id',auth.auth, comprasController.obtener_compras_idCompra_idEmpresa);
  // api.get('/comprasempresa',auth.auth, comprasController.obtener_compras_todos_idEmpresa);

  // api.post('/compras', auth.auth, comprasController.crear_compra);
  // api.put('/compras/:id',auth.auth, comprasController.actualizar_compra);


  // ////////////////////////////////////////////////////////////////////////////////////////////////////////
  // api.get('/borradorcompras',auth.auth, comprasController.obtener_borrador_compras_empresa);
  // api.post('/borradorcompras', auth.auth, comprasController.crear_borrador_compras_empresa);
  // api.put('/borradorcompras/:id',auth.auth, comprasController.editar_borrador_compras_empresa);
  //api.delete('/borradorcompras/:id',auth.auth, comprasController.eliminar_borrador_compras_empresa);


  obtener_compras_todos(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'compras', { 
      headers:headers,
      withCredentials: true
    });

  }

  obtener_compras_id(id: any): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'compras/' + id, { 
      headers:headers,
      withCredentials: true
    });
  }

  obtener_compras_idCompra_idEmpresa(id: any): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'comprasempresa/' + id, { 
      headers:headers,
      withCredentials: true
    });
  }

  /** Lista compras de la empresa de operación (gestora/gestionada vía query idEmpresaOperacion). */
  obtener_compras_todos_idEmpresa(idEmpresaOperacion?: string | null): Observable<any> {
    const url = environment.API_URL + 'compras-por-empresa';
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    let params = new HttpParams();
    if (idEmpresaOperacion) {
      params = params.set('idEmpresaOperacion', idEmpresaOperacion);
    }
    return this._http.get(url, {
      headers,
      withCredentials: true,
      params
    });
  }

  /** Listado paginado de compras (servidor). */
  obtenerComprasPaginado(params: {
    pagina?: number;
    porPagina?: number;
    buscar?: string;
    ruc?: string;
    proveedor?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    idEmpresaOperacion?: string;
  }): Observable<{ data: unknown[]; total: number; pagina?: number; porPagina?: number }> {
    const url = environment.API_URL + 'compras-por-empresa';
    let q = new HttpParams();
    if (params.pagina != null) q = q.set('pagina', String(params.pagina));
    if (params.porPagina != null) q = q.set('porPagina', String(params.porPagina));
    if (params.buscar) q = q.set('buscar', params.buscar);
    if (params.ruc) q = q.set('ruc', params.ruc);
    if (params.proveedor) q = q.set('proveedor', params.proveedor);
    if (params.fechaDesde) q = q.set('fechaDesde', params.fechaDesde);
    if (params.fechaHasta) q = q.set('fechaHasta', params.fechaHasta);
    if (params.idEmpresaOperacion) q = q.set('idEmpresaOperacion', params.idEmpresaOperacion);
    return this._http.get<{ data: unknown[]; total: number }>(url, { withCredentials: true, params: q });
  }

  getBootstrapCompra(): Observable<{ data: Record<string, unknown> }> {
    return this._http.get<{ data: Record<string, unknown> }>(this.url + 'compras/bootstrap', { withCredentials: true });
  }

  crear_compra_completa(payload: { compra: unknown; detalles: unknown[]; comprobanteSunat?: unknown }): Observable<{
    data: { idCompra: string; detalles?: Array<{ idLote?: string; numeroLote?: string }> };
  }> {
    return this._http.post(this.url + 'compras/completa', payload, { withCredentials: true });
  }

  crear_compra(compra: any): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.post(this.url + 'compras', compra, { 
      headers:headers,
      withCredentials: true
    });
  }

  editar_compra(id: any, compra: any): Observable<any> {
        
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.put(this.url + 'compras/' + id, compra, { 
      headers:headers,
      withCredentials: true
    });
  }

  //api.delete('/compras/:id',auth.auth, comprasController.eliminar_compra);

  eliminar_idcompra_empresa(id: any): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.delete(this.url + 'compras/' + id, { 
      headers:headers,
      withCredentials: true
    });
  }

  // ////////////////////////////////////////////////////////////////////////////////////////////////////////
  obtener_borrador_compras_empresa(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'borradorcompras', { 
      headers:headers,
      withCredentials: true
    });
  }

  crear_borrador_compras_empresa( compra: any): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.post(this.url + 'borradorcompras', compra, { 
      headers:headers,
      withCredentials: true
    });
  }

  editar_borrador_compras_empresa( id: any, compra: any): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.put(this.url + 'borradorcompras/' + id, compra, { 
      headers:headers,
      withCredentials: true
    });
  }

  eliminar_borrador_compras_empresa( id: any): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.delete(this.url + 'borradorcompras/' + id, { 
      headers:headers,
      withCredentials: true
    });
  }

  /////////////////////////////////////////////////////////////////////////////
  // api.get('/dcompras/:id',auth.auth, dcomprasController.obtener_detalle_compras_idcompra);
  // api.post('/dcompras', auth.auth, dcomprasController.crear_detalle_compras_idcompra);
  // api.put('/dcompras/:id',auth.auth, dcomprasController.editar_detalle_compras_idcompra);

  obtener_detalle_compras_idcompra(id: any): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'dcompras/' + id, { 
      headers:headers,
      withCredentials: true
    });
  }

  crear_detalle_compras_idcompra(dcompra: any): Observable<any> {
    
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.post(this.url + 'dcompras', dcompra, { 
      headers:headers,
      withCredentials: true
    });
  }

  editar_detalle_compras_idcompra( id: any, dcompra: any): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.put(this.url + 'dcompras/' + id, dcompra, { 
      headers:headers,
      withCredentials: true
    });
  }

  /////////////////////////////////////////////////////////////////////////////
  // api.get('/correlativos',auth.auth, comprasController.obtener_correlativos_empresa);
  // api.put('/correlativos/:id',auth.auth, comprasController.editar_correlativos_empresa);

  obtener_correlativo_empresa(idEmpresaDestino?: string): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    let params = new HttpParams();
    if (idEmpresaDestino?.trim()) {
      params = params.set('idEmpresaDestino', idEmpresaDestino.trim());
    }
    return this._http.get(this.url + 'correlativos', { 
      headers:headers,
      params,
      withCredentials: true
    });
  }

  editar_correlativos_empresa(id: any, correlativo: any): Observable<any> {
   
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.put(this.url + 'correlativos/' + id, correlativo, { 
      headers:headers,
      withCredentials: true
    });
  }

  /////////////////////////////////////////////////////////////////////////////
  //api.get('/comprasCliente/:id',auth.auth, comprasController.buscar_comprobante_idCliente);

  buscar_comprobante_idCliente(id: any): Observable<any> {
        let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'comprasCliente/' + id, { 
      headers:headers,
      withCredentials: true
    });
  }

  /** Listado ComprobantesCompraSunat (CPE reales) con filtros opcionales en query. */
  obtenerReporteDetallado(params: {
    fechaInicio: string;
    fechaFin: string;
    proveedorRuc?: string;
    proveedorRazon?: string;
  }): Observable<{ message: string; data: ReporteComprasDetalladoData }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    let httpParams = new HttpParams()
      .set('fechaInicio', params.fechaInicio)
      .set('fechaFin', params.fechaFin);
    if (params.proveedorRuc?.trim()) {
      httpParams = httpParams.set('proveedorRuc', params.proveedorRuc.trim());
    }
    if (params.proveedorRazon?.trim()) {
      httpParams = httpParams.set('proveedorRazon', params.proveedorRazon.trim());
    }
    return this._http.get<{ message: string; data: ReporteComprasDetalladoData }>(
      environment.API_URL + 'compras/reporte-detallado',
      { headers, withCredentials: true, params: httpParams }
    );
  }

  listarComprobantesCompraSunat(params?: Record<string, string>): Observable<{ data: ComprobanteCompraSunatListaItem[] }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    let httpParams = new HttpParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v != null && String(v).trim() !== '') {
          httpParams = httpParams.set(k, String(v).trim());
        }
      }
    }
    return this._http.get<{ data: ComprobanteCompraSunatListaItem[] }>(this.url + 'comprobantes-compra-sunat', {
      headers,
      withCredentials: true,
      params: httpParams
    });
  }

}
