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

  // Crear nueva caja
  crearCaja(data: { idSucursal: string; nombre: string; descripcion?: string }): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url + 'caja/cajas', data, { headers, withCredentials: true });
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
    idTipoMovimientoCaja: number;
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
    idApertura?: string;
    idCaja?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    idTipoMovimientoCaja?: number;
    tipoMovimiento?: string;
    soloRecibos?: boolean;
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

  // Obtener tipos de movimiento de caja (TiposMovimientoCaja)
  obtenerTiposMovimiento(): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url + 'caja/tipos-movimiento', { headers, withCredentials: true });
  }

  // CRUD TiposMovimientoCaja (clasificación conceptos / tipos movimiento)
  crearTipoMovimientoCaja(data: { nombre: string; descripcion?: string; tipo: 'I' | 'E' }): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url + 'caja/tipos-movimiento', data, { headers, withCredentials: true });
  }

  actualizarTipoMovimientoCaja(id: number, data: { nombre: string; descripcion?: string; tipo: 'I' | 'E' }): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url + 'caja/tipos-movimiento/' + id, data, { headers, withCredentials: true });
  }

  eliminarTipoMovimientoCaja(id: number): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url + 'caja/tipos-movimiento/' + id, { headers, withCredentials: true });
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

  /** Arqueo dinámico: conceptos y formas de pago. Filtro por fecha única o por rango (fechaInicial, fechaFinal). */
  obtenerArqueoDinamico(filtros: { fecha?: string; fechaInicial?: string; fechaFinal?: string; idCaja?: string }): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    const q = new URLSearchParams();
    if (filtros.fecha) q.append('fecha', filtros.fecha);
    if (filtros.fechaInicial) q.append('fechaInicial', filtros.fechaInicial);
    if (filtros.fechaFinal) q.append('fechaFinal', filtros.fechaFinal);
    if (filtros.idCaja && filtros.idCaja !== 'TODAS') q.append('idCaja', filtros.idCaja);
    const params = q.toString() ? '?' + q.toString() : '';
    return this._http.get(this.url + 'caja/arqueo-dinamico' + params, {
      headers,
      withCredentials: true
    });
  }

  // Recibos de egreso (movimientos tipo E)
  getRecibosEgreso(filtros?: { fechaDesde?: string; fechaHasta?: string }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    let params = '';
    if (filtros) {
      const q = new URLSearchParams();
      if (filtros.fechaDesde) q.append('fechaDesde', filtros.fechaDesde);
      if (filtros.fechaHasta) q.append('fechaHasta', filtros.fechaHasta);
      params = '?' + q.toString();
    }
    return this._http.get(this.url + 'caja/recibos-egreso' + params, { headers, withCredentials: true });
  }

  // Recibos de ingreso (solo movimientos RI, sin ventas)
  getRecibosIngreso(filtros?: { fechaDesde?: string; fechaHasta?: string }): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    const q = new URLSearchParams();
    if (filtros?.fechaDesde) q.append('fechaDesde', filtros.fechaDesde);
    if (filtros?.fechaHasta) q.append('fechaHasta', filtros.fechaHasta);
    q.append('tipoMovimiento', 'I');
    q.append('soloRecibos', 'true');
    return this._http.get(this.url + 'caja/movimientos?' + q.toString(), { headers, withCredentials: true });
  }

  // Registrar movimiento (egreso): backend espera idApertura. fechaMovimiento = fecha del formulario (Fecha Emisión).
  registrarMovimientoEgreso(data: {
    idApertura: string;
    idTipoMovimientoCaja: number;
    fechaMovimiento?: string;
    concepto: string;
    idConcepto?: string;
    monto: number;
    idMediosPago?: number;
    documentoRelacionado?: string;
    observaciones?: string;
  }): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url + 'caja/movimiento', {
      idApertura: data.idApertura,
      idTipoMovimientoCaja: data.idTipoMovimientoCaja,
      fechaMovimiento: data.fechaMovimiento ?? null,
      concepto: data.concepto,
      idConcepto: data.idConcepto ?? null,
      monto: data.monto,
      idMediosPago: data.idMediosPago ?? null,
      idMoneda: 1,
      documentoRelacionado: data.documentoRelacionado ?? null,
      observaciones: data.observaciones ?? null
    }, { headers, withCredentials: true });
  }

  // Registrar movimiento (ingreso): mismo endpoint que egreso. fechaMovimiento = fecha del formulario (Fecha Emisión).
  registrarMovimientoIngreso(data: {
    idApertura: string;
    idTipoMovimientoCaja: number;
    fechaMovimiento?: string;
    concepto: string;
    idConcepto?: string;
    monto: number;
    idMediosPago?: number;
    documentoRelacionado?: string;
    observaciones?: string;
  }): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url + 'caja/movimiento', {
      idApertura: data.idApertura,
      idTipoMovimientoCaja: data.idTipoMovimientoCaja,
      fechaMovimiento: data.fechaMovimiento ?? null,
      concepto: data.concepto,
      idConcepto: data.idConcepto ?? null,
      monto: data.monto,
      idMediosPago: data.idMediosPago ?? null,
      idMoneda: 1,
      documentoRelacionado: data.documentoRelacionado ?? null,
      observaciones: data.observaciones ?? null
    }, { headers, withCredentials: true });
  }

  eliminarMovimiento(idMovimientoCaja: string): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url + 'caja/movimientos/' + idMovimientoCaja, {
      headers,
      withCredentials: true
    });
  }

  actualizarMovimiento(idMovimientoCaja: string, data: {
    concepto: string;
    idConcepto?: string;
    monto: number;
    idMediosPago?: number;
    documentoRelacionado?: string;
    observaciones?: string;
  }): Observable<any> {
    const headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url + 'caja/movimientos/' + idMovimientoCaja, data, {
      headers,
      withCredentials: true
    });
  }
}