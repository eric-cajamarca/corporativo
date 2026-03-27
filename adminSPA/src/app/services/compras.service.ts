import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs/internal/Observable';

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

  obtener_correlativo_empresa(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'correlativos', { 
      headers:headers,
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

}
