import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class EnviosService {
  public url: any;

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  // Obtener envíos por venta
  obtenerEnviosPorVenta(idVenta: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'envios/venta/' + idVenta, {
      headers: headers,
      withCredentials: true
    });
  }

  // Crear nuevo envío
  crearEnvio(data: {
    idVenta: string;
    idTipoEnvio: number;
    idTransportista?: string;
    fechaEntregaEstimada?: string;
    costoEnvio: number;
    direccionEntrega: string;
    contactoEntrega: string;
    telefonoContacto: string;
    observaciones?: string;
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'envios/', data, {
      headers: headers,
      withCredentials: true
    });
  }

  // Actualizar estado del envío
  actualizarEstadoEnvio(data: {
    idEnvio: string;
    idEstado: number;
    observaciones?: string;
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'envios/' + data.idEnvio + '/estado', data, {
      headers: headers,
      withCredentials: true
    });
  }

  // Asignar transportista
  asignarTransportista(data: {
    idEnvio: string;
    idTransportista: string;
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'envios/' + data.idEnvio + '/transportista', data, {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener transportistas
  obtenerTransportistas(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'envios/transportistas', {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener tipos de envío
  obtenerTiposEnvio(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'envios/tipos', {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener estados de envío
  obtenerEstadosEnvio(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'envios/estados', {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener envíos por estado
  obtenerEnviosPorEstado(idEstado: number): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'envios/por-estado?idEstado=' + idEstado, {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener envíos por transportista
  obtenerEnviosPorTransportista(idTransportista: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'envios/transportista/' + idTransportista, {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener datos de envíos (método legacy para compatibilidad)
  obtener_datos_envios(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'envios/', {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener envío por ID (método legacy para compatibilidad)
  obtener_datos_envios_id(id: any): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'envios/' + id, {
      headers: headers,
      withCredentials: true
    });
  }

  // Registro de envío (método legacy para compatibilidad)
  registro_compEnvio(data: any): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'envios', data, {
      headers: headers,
      withCredentials: true
    });
  }
}