import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class FacturacionService {
  public url: any;

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  // Configuración de facturación
  obtenerConfiguracion(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'facturacion/configuracion', {
      headers: headers,
      withCredentials: true
    });
  }

  actualizarConfiguracion(data: {
    certificadoDigital?: string;
    claveCertificado?: string;
    usuarioSunat?: string;
    claveSunat?: string;
    modoPrueba: boolean;
    serieFactura: string;
    serieBoleta: string;
    serieNotaCredito: string;
    serieNotaDebito: string;
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'facturacion/configuracion', data, {
      headers: headers,
      withCredentials: true
    });
  }

  // Comprobantes electrónicos
  obtenerComprobantes(filtros?: {
    tipoComprobante?: string;
    estadoSunat?: string;
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
    return this._http.get(this.url+'facturacion/comprobantes' + params, {
      headers: headers,
      withCredentials: true
    });
  }

  generarComprobante(data: {
    idVenta: string;
    tipoComprobante: 'FACTURA' | 'BOLETA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'facturacion/comprobantes', data, {
      headers: headers,
      withCredentials: true
    });
  }

  enviarComprobanteSunat(idComprobante: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'facturacion/comprobantes/' + idComprobante + '/enviar', {}, {
      headers: headers,
      withCredentials: true
    });
  }

  consultarEstadoSunat(idComprobante: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'facturacion/comprobantes/' + idComprobante + '/estado', {
      headers: headers,
      withCredentials: true
    });
  }

  // Estadísticas de facturación
  obtenerEstadisticas(periodo?: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    let params = periodo ? `?periodo=${periodo}` : '';
    return this._http.get(this.url+'facturacion/estadisticas' + params, {
      headers: headers,
      withCredentials: true
    });
  }

  // Estados SUNAT
  obtenerEstadosSunat(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'facturacion/estados-sunat', {
      headers: headers,
      withCredentials: true
    });
  }
}