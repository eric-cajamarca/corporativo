import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';
import { Caja, AperturaCaja, MovimientoCaja, TipoMovimientoCaja, ResumenCajaDiario } from '../interfaces/caja-interface';

@Injectable({
  providedIn: 'root'
})
export class CajaService {
  public url: any;

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  // Obtener todas las cajas disponibles
  obtenerCajas(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'caja/cajas', {
      headers: headers,
      withCredentials: true
    });
  }

  // Abrir caja
  abrirCaja(data: { idCaja: string; montoInicial: number }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'caja/abrir', data, {
      headers: headers,
      withCredentials: true
    });
  }

  // Cerrar caja
  cerrarCaja(data: { idCaja: string; observaciones?: string }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'caja/cerrar', data, {
      headers: headers,
      withCredentials: true
    });
  }

  // Registrar movimiento de caja
  registrarMovimiento(data: {
    idCaja: string;
    idTipoMovimiento: number;
    descripcion: string;
    monto: number;
    idMedioPago?: string;
    referencia?: string;
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'caja/movimiento', data, {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener movimientos de caja
  obtenerMovimientos(filtros?: {
    idCaja?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    idTipoMovimiento?: number;
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
    return this._http.get(this.url+'caja/movimientos' + params, {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener tipos de movimiento de caja
  obtenerTiposMovimiento(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'caja/tipos-movimiento', {
      headers: headers,
      withCredentials: true
    });
  }

  // Obtener resumen diario de caja
  obtenerResumenDiario(fecha?: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    let params = fecha ? `?fecha=${fecha}` : '';
    return this._http.get(this.url+'caja/resumen-diario' + params, {
      headers: headers,
      withCredentials: true
    });
  }
}