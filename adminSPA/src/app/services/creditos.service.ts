import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class CreditosService {
  public url: any;

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  // Obtener créditos por cliente
  obtenerCreditosCliente(idCliente: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'creditos/cliente/' + idCliente, {
      headers: headers,
      withCredentials: true
    });
  }

  // Crear nuevo crédito
  crearCredito(data: {
    idCliente: string;
    idVenta: string;
    montoTotal: number;
    interes: number;
    numeroCuotas: number;
    cuotaInicial?: number;
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'creditos/', data, {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener cuotas de un crédito
  obtenerCuotasCredito(idCredito: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'creditos/' + idCredito + '/cuotas', {
      headers: headers,
      withCredentials: true
    });
  }

  // Pagar cuota
  pagarCuota(data: {
    idCuota: string;
    montoPagado: number;
    formaPago: string;
    referencia?: string;
    observaciones?: string;
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'creditos/cuotas/' + data.idCuota + '/pagar', data, {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener resumen de créditos
  obtenerResumenCreditos(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'creditos/resumen', {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener cuotas pendientes
  obtenerCuotasPendientes(filtros?: {
    idCliente?: string;
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
    return this._http.get(this.url+'creditos/cuotas/pendientes' + params, {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener eficiencia de cobros por usuario
  obtenerEficienciaCobros(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'creditos/eficiencia-cobros', {
      headers: headers,
      withCredentials: true
    });
  }
}