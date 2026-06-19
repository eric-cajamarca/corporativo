import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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

  private paramsConEmpresaOp(idEmpresaOperacion?: string | null, base?: HttpParams): HttpParams {
    let p = base ?? new HttpParams();
    if (idEmpresaOperacion) {
      p = p.set('idEmpresaOperacion', idEmpresaOperacion);
    }
    return p;
  }

  obtenerCreditosTodos(idEmpresaOperacion?: string | null): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url + 'creditos/todos', {
      headers,
      withCredentials: true,
      params: this.paramsConEmpresaOp(idEmpresaOperacion)
    });
  }

  obtenerCreditosCliente(idCliente: string, idEmpresaOperacion?: string | null): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    if (idCliente == null || String(idCliente).trim() === '') {
      return this.obtenerCreditosTodos(idEmpresaOperacion);
    }
    return this._http.get(this.url + 'creditos/cliente/' + encodeURIComponent(String(idCliente).trim()), {
      headers,
      withCredentials: true,
      params: this.paramsConEmpresaOp(idEmpresaOperacion)
    });
  }

  crearCredito(data: {
    idCliente: string;
    idVenta: string;
    montoTotal: number;
    interes: number;
    numeroCuotas: number;
    cuotaInicial?: number;
    fechaCredito?: string;
  }): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'creditos/', data, {
      headers: headers,
      withCredentials: true
    });
  }

  obtenerCuotasCredito(idCredito: string, idEmpresaOperacion?: string | null): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'creditos/' + idCredito + '/cuotas', {
      headers: headers,
      withCredentials: true,
      params: this.paramsConEmpresaOp(idEmpresaOperacion)
    });
  }

  pagarCuota(data: {
    idCuota: string;
    montoPagado: number;
    formaPago?: string;
    idMediosPago?: number | null;
    idApertura?: string;
    referencia?: string;
    observaciones?: string;
    idEmpresaOperacion?: string | null;
    fechaPago?: string;
  }): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'creditos/cuotas/' + data.idCuota + '/pagar', data, {
      headers: headers,
      withCredentials: true
    });
  }

  pagarCuotasMasivo(payload: {
    pagos: Array<{ idCuota: string; montoPagado: number; idEmpresaOperacion?: string }>;
    idMediosPago?: number | null;
    idApertura?: string;
    observaciones?: string;
    idEmpresaOperacion?: string | null;
    fechaPago?: string;
  }): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this._http.post(this.url + 'creditos/cobranza-masiva', payload, {
      headers,
      withCredentials: true
    });
  }

  obtenerResumenCreditos(idEmpresaOperacion?: string | null): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'creditos/resumen', {
      headers: headers,
      withCredentials: true,
      params: this.paramsConEmpresaOp(idEmpresaOperacion)
    });
  }

  obtenerCuotasPendientes(filtros?: {
    idCliente?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }, idEmpresaOperacion?: string | null): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    let params = new HttpParams();
    if (filtros) {
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      });
    }
    params = this.paramsConEmpresaOp(idEmpresaOperacion, params);
    return this._http.get(this.url+'creditos/cuotas/pendientes', {
      headers: headers,
      withCredentials: true,
      params
    });
  }

  obtenerEficienciaCobros(idEmpresaOperacion?: string | null): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'creditos/eficiencia-cobros', {
      headers: headers,
      withCredentials: true,
      params: this.paramsConEmpresaOp(idEmpresaOperacion)
    });
  }
}
