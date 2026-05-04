import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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
        let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'comprobantes/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  obtener_comprobantes(idSucursal?: string | null): Observable<{ data: any[] }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    let params = new HttpParams();
    if (idSucursal != null && String(idSucursal).trim() !== '') {
      params = params.set('idSucursal', String(idSucursal).trim());
    }
    return this._http.get<{ data: any[] }>(this.url + 'comprobantes', {
      headers,
      withCredentials: true,
      params
    });
  }

  /** Comprobantes habilitados para ventas (uso=venta). Opcional: sucursal operativa (series de esa sucursal). */
  obtenerComprobantesVenta(idSucursal?: string | null): Observable<{ data: any[] }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    let params = new HttpParams().set('uso', 'venta');
    if (idSucursal != null && String(idSucursal).trim() !== '') {
      params = params.set('idSucursal', String(idSucursal).trim());
    }
    return this._http.get<{ data: any[] }>(this.url + 'comprobantes', {
      headers,
      withCredentials: true,
      params
    });
  }

  /** Comprobantes habilitados para compras (uso=compra). */
  obtenerComprobantesCompra(idSucursal?: string | null): Observable<{ data: any[] }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    let params = new HttpParams().set('uso', 'compra');
    if (idSucursal != null && String(idSucursal).trim() !== '') {
      params = params.set('idSucursal', String(idSucursal).trim());
    }
    return this._http.get<{ data: any[] }>(this.url + 'comprobantes', {
      headers,
      withCredentials: true,
      params
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

  /** Crea comprobante: codigo, nombre, serie, numero (default 1), usarEnVenta/usarEnCompra (default true). idSucursal opcional (si no, el backend usa sucursal principal). */
  crear(payload: { codigo: string; nombre: string; serie: string; numero?: number; usarEnVenta?: boolean; usarEnCompra?: boolean; idSucursal?: string }): Observable<{ data: { idComprobante: number } }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.post<{ data: { idComprobante: number } }>(this.url + 'comprobantes', payload, {
      headers,
      withCredentials: true
    });
  }
}
