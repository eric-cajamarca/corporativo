import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ComprobanteService {
  public url: any;
  private _router: any;
  public idUser:any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  // api.get('/comprobantes', auth.auth,comprobantesController.obtener_comprobantes);
  // api.get('/comprobantes/:id', auth.auth,comprobantesController.obtenerComprobantes_alias);

  obtener_comprobantes_alias(id:any):Observable<any>{
    console.log('id',id);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'comprobantes/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  obtener_comprobantes(): Observable<{ data: any[] }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get<{ data: any[] }>(this.url + 'comprobantes', {
      headers,
      withCredentials: true
    });
  }

  /** Comprobantes habilitados para ventas (uso=venta). */
  obtenerComprobantesVenta(): Observable<{ data: any[] }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get<{ data: any[] }>(this.url + 'comprobantes?uso=venta', {
      headers,
      withCredentials: true
    });
  }

  /** Comprobantes habilitados para compras (uso=compra). */
  obtenerComprobantesCompra(): Observable<{ data: any[] }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get<{ data: any[] }>(this.url + 'comprobantes?uso=compra', {
      headers,
      withCredentials: true
    });
  }

  /** Actualiza serie, número y flags. No modifica codigo (SUNAT). */
  actualizar(idComprobante: number, payload: { serie?: string; numero?: number; usarEnVenta?: boolean; usarEnCompra?: boolean }): Observable<{ data: { rowsAffected: number } }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.put<{ data: { rowsAffected: number } }>(this.url + 'comprobantes/' + idComprobante, payload, {
      headers,
      withCredentials: true
    });
  }

  /** Crea comprobante: codigo, nombre, serie, numero (default 1), usarEnVenta/usarEnCompra (default true). */
  crear(payload: { codigo: string; nombre: string; serie: string; numero?: number; usarEnVenta?: boolean; usarEnCompra?: boolean }): Observable<{ data: { idComprobante: number } }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.post<{ data: { idComprobante: number } }>(this.url + 'comprobantes', payload, {
      headers,
      withCredentials: true
    });
  }
}
