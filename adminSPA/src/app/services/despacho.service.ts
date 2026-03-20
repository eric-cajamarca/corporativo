import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';
import {
  CrearDevolucionDespachoRequest,
  DevolucionDespachoDetalle,
  DevolucionDespachoResumen
} from '../models/devolucion-despacho.model';

@Injectable({
  providedIn: 'root'
})
export class DespachoService {
  public url: any;

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  // Obtener despachos por venta
  obtenerDespachosPorVenta(idVenta: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'despachos/venta/' + idVenta, {
      headers: headers,
      withCredentials: true
    });
  }

  // Crear nuevo despacho. Opcional: detalles con cantidad a despachar por línea.
  crearDespacho(data: {
    idVenta: string;
    idTipoDespacho: number;
    observaciones?: string;
    detalles?: Array<{ idDetalle: number; idProducto: string; cantidadADespachar: number }>;
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'despachos/', data, {
      headers: headers,
      withCredentials: true
    });
  }

  // Actualizar cantidad despachada en detalle
  actualizarCantidadDetalle(data: {
    idDetalle: string;
    cantidadDespachada: number;
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'despachos/detalle/' + data.idDetalle + '/cantidad', {
      cantidadDespachada: data.cantidadDespachada
    }, {
      headers: headers,
      withCredentials: true
    });
  }

  // Finalizar despacho
  finalizarDespacho(idDespacho: string, observaciones?: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'despachos/' + idDespacho + '/finalizar', {
      observaciones: observaciones
    }, {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener tipos de despacho
  obtenerTiposDespacho(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'despachos/tipos', {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener estado de despachos
  obtenerEstadoDespachos(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'despachos/estado', {
      headers: headers,
      withCredentials: true
    });
  }

  /** Buscar venta por número de comprobante o idVenta. Devuelve venta + despachos + entregadoMismoDia */
  buscarVentaDespachos(params: { compVenta?: string; idVenta?: string | number }): Observable<any> {
    const q = new URLSearchParams();
    if (params.compVenta) q.set('compVenta', params.compVenta);
    if (params.idVenta != null && params.idVenta !== '') q.set('idVenta', String(params.idVenta));
    const query = q.toString();
    const url = this.url + 'despachos/buscar' + (query ? '?' + query : '');
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(url, { headers, withCredentials: true });
  }

  /** Obtener detalle de un despacho (líneas DetalleDespachos) */
  obtenerDetalleDespacho(idDespacho: string): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'despachos/' + encodeURIComponent(idDespacho) + '/detalle', {
      headers,
      withCredentials: true
    });
  }

  /** Registrar devolución de despacho */
  crearDevolucionDespacho(idDespacho: string, data: CrearDevolucionDespachoRequest): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.post(this.url + 'despachos/' + encodeURIComponent(idDespacho) + '/devoluciones', data, {
      headers,
      withCredentials: true
    });
  }

  /** Listar devoluciones por despacho */
  listarDevolucionesDespacho(idDespacho: string): Observable<{ data: DevolucionDespachoResumen[] }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get<{ data: DevolucionDespachoResumen[] }>(
      this.url + 'despachos/' + encodeURIComponent(idDespacho) + '/devoluciones',
      { headers, withCredentials: true }
    );
  }

  /** Obtener detalle de una devolución */
  obtenerDetalleDevolucion(idDevolucionDespacho: string): Observable<{ data: DevolucionDespachoDetalle[] }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get<{ data: DevolucionDespachoDetalle[] }>(
      this.url + 'despachos/devoluciones/' + encodeURIComponent(idDevolucionDespacho) + '/detalle',
      { headers, withCredentials: true }
    );
  }
}