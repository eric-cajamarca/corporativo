import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';

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

  // Crear nuevo despacho
  crearDespacho(data: {
    idVenta: string;
    idTipoDespacho: number;
    observaciones?: string;
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
}