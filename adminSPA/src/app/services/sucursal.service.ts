import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';
import { ApiResponse } from '../interfaces/ApiResponse-interface';
import { Sucursal } from '../interfaces/sucursal-interface';

@Injectable({
  providedIn: 'root'
})
export class SucursalService {
  public url: any;
  private _router: any;
  public idUser:any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  // api.get('/sucursal',auth.auth, sucursalController.obtener_sucursal_todos);
  // api.get('/sucursal/:id',auth.auth, sucursalController.obtener_sucursal_idempresa);
  // api.post('/sucursal', auth.auth, sucursalController.crear_sucursal_idEmpresa);
  // api.put('/sucursal/:id',auth.auth, sucursalController.editar_sucursal_idEmpresa);
  // api.delete('/sucursal/:id',auth.auth, sucursalController.eliminar_sucursal_idempresa);

  // //////////////////////////////////////////////////////////////////////////////////////////
  // api.get('/stocksucursal',auth.auth, sucursalController.obtener_stock_sucursal_idProducto);

  /** Por defecto solo sucursales activas. Usar incluirInactivas en administración de sucursales o edición de una inactiva. */
  obtener_sucursal_todos(incluirInactivas = false): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    let params = new HttpParams();
    if (incluirInactivas) {
      params = params.set('incluirInactivas', 'true');
    }
    return this._http.get(this.url + 'sucursal', {
      headers,
      params,
      withCredentials: true
    });
  }

  obtener_sucursal_idempresa(incluirInactivas = false): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    let params = new HttpParams();
    if (incluirInactivas) {
      params = params.set('incluirInactivas', 'true');
    }
    return this._http.get(this.url + 'sucursalempresa', {
      headers,
      params,
      withCredentials: true
    });
  }

  /** Empresa gestora: sucursales de la empresa gestionada indicada. */
  obtener_sucursales_por_empresa(idEmpresa: string, incluirInactivas = false): Observable<ApiResponse<Sucursal[]>> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    let params = new HttpParams();
    if (incluirInactivas) {
      params = params.set('incluirInactivas', 'true');
    }
    return this._http.get<ApiResponse<Sucursal[]>>(
      this.url + 'sucursalempresa/' + encodeURIComponent(idEmpresa),
      { headers, params, withCredentials: true }
    );
  }

  obtener_sucursal_idempresa1(incluirInactivas = false): Observable<ApiResponse<Sucursal[]>> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    let params = new HttpParams();
    if (incluirInactivas) {
      params = params.set('incluirInactivas', 'true');
    }
    return this._http.get<ApiResponse<Sucursal[]>>(this.url + 'sucursalempresa', {
      headers,
      params,
      withCredentials: true
    });
  }

  crear_sucursal_idEmpresa(sucursal:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'sucursal',sucursal,{
      headers:headers,
      withCredentials: true
    });
  }

  editar_sucursal_idEmpresa(sucursal:any):Observable<any>{
    const id = sucursal.idSucursal || sucursal.id;
    let params = JSON.stringify(sucursal);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'sucursal/'+id,params,{
      headers:headers,
      withCredentials: true
    });
  }

  eliminar_sucursal_idempresa(token:any,id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'sucursal/'+id,{
      headers:headers,
      withCredentials: true
    });
  }

  //api.put('/sucursalestado/:id',auth.auth, sucursalController.editar_estado_idsucursal);
  editar_estado_idsucursal(id: string, estado: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.put(this.url + 'sucursalestado/' + id, estado, {
      headers,
      withCredentials: true
    });
  }

  establecer_sucursal_principal(id: string): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.put(this.url + 'sucursal/' + id + '/principal', {}, {
      headers,
      withCredentials: true
    });
  }

  //////////////////////////////////////////////////////////////////////////////////////////
// api.get('/stocksucursal',auth.auth, sucursalController.obtener_stock_sucursal_idProducto);
// api.get('/stocksucursales/',auth.auth, sucursalController.obtener_stock_sucursales_idempresa);
// api.post('/stocksucursal', auth.auth, sucursalController.crear_stock_sucursal_idEmpresa);
// api.put('/stocksucursal/:id',auth.auth, sucursalController.editar_stock_sucursal);
// api.delete('/stocksucursal/:id',auth.auth, sucursalController.eliminar_stock_sucursal);

  obtener_stock_sucursal_idProducto(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'stocksucursal/'+id,{
      headers:headers,
      withCredentials: true
    });
  }

  obtener_stock_sucursales_idempresa():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'stocksucursales/',{
      headers:headers,
      withCredentials: true
    });
  }

  crear_stock_sucursal_idEmpresa(stock:any):Observable<any>{
   
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'stocksucursal',stock,{
      headers:headers,
      withCredentials: true
    });
  }

  editar_stock_sucursal(id:any,stock:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'stocksucursal/'+id,stock,{
      headers:headers,
      withCredentials: true
    });
  }

  eliminar_stock_sucursal(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'stocksucursal/'+id,{
      headers:headers,
      withCredentials: true
    });
  }

}
