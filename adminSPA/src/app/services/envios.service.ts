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

  // Obtener envíos programados (listado para pantalla Envios programados)
  obtenerEnviosProgramados(filtros?: { idEstadoEnvio?: number; fechaDesde?: string; fechaHasta?: string; ruc?: string; cliente?: string }): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    let params: Record<string, string> = {};
    if (filtros) {
      if (filtros.idEstadoEnvio != null) params['idEstadoEnvio'] = String(filtros.idEstadoEnvio);
      if (filtros.fechaDesde) params['fechaDesde'] = filtros.fechaDesde;
      if (filtros.fechaHasta) params['fechaHasta'] = filtros.fechaHasta;
      if (filtros.ruc) params['ruc'] = filtros.ruc;
      if (filtros.cliente) params['cliente'] = filtros.cliente;
    }
    return this._http.get(this.url + 'envios/', {
      headers,
      params,
      withCredentials: true
    });
  }

  // Actualizar envío
  actualizarEnvio(idEnvio: string, data: {
    fechaProgramada?: string;
    direccionEntrega?: string;
    idChofer?: string | null;
    idTransportista?: string | null;
    contactoDestinatario?: string | null;
    telefonoDestinatario?: string | null;
    observaciones?: string | null;
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'envios/' + idEnvio, data, {
      headers: headers,
      withCredentials: true
    });
  }

  // Eliminar envío
  eliminarEnvio(idEnvio: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'envios/' + idEnvio, {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener detalle de un envío (productos desde DetalleDespachos)
  obtenerDetalleEnvio(idEnvio: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'envios/' + idEnvio + '/detalle', {
      headers: headers,
      withCredentials: true
    });
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
    idDespacho?: string;
    idTipoEnvio: number;
    idTransportista?: string;
    idChofer?: string;
    idVehiculoEntrega?: string;
    idEstadoEnvioInicial?: number;
    fechaEntregaEstimada?: string;
    costoEnvio: number;
    direccionEntrega: string;
    contactoDestinatario?: string;
    telefonoDestinatario?: string;
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
    idEstadoEnvio: number;
    observaciones?: string;
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'envios/' + data.idEnvio + '/estado', {
      idEstadoEnvio: data.idEstadoEnvio,
      observaciones: data.observaciones
    }, {
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

  // Crear transportista (delivery externo)
  crearTransportista(data: {
    nombres: string;
    apellidos: string;
    documento: string;
    licencia?: string | null;
    celular: string;
    email?: string | null;
    vehiculo?: string | null;
    placa?: string | null;
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'envios/transportistas', data, {
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

  // Mis envíos (rol Chofer)
  obtenerMisEnvios(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'envios/mis-envios', {
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