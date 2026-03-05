import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FilaUtilidad {
  periodo: string;
  ingresos: number;
  costos: number;
  utilidadBruta: number;
}

/** Una fila del reporte detallado (por línea de venta). */
export interface FilaUtilidadDetalle {
  idVenta: number;
  comprobante: string;
  fechaVenta: string;
  nombreProducto: string;
  precioVenta: number;
  costo: number;
  utilidadBruta: number;
}

export interface UtilidadesResponse {
  message: string;
  data: FilaUtilidad[];
}

@Injectable({
  providedIn: 'root',
})
export class UtilidadesService {
  private readonly url = environment.API_URL + 'utilidades';

  constructor(private http: HttpClient) {}

  getUtilidades(
    tipo: 'dia' | 'mes' | 'anio' | 'rango',
    fechaInicio: string,
    fechaFin: string
  ): Observable<UtilidadesResponse> {
    const params = { tipo, fechaInicio, fechaFin };
    return this.http.get<UtilidadesResponse>(this.url, {
      params,
      withCredentials: true,
    });
  }

  /** Detalle por línea de venta (producto, fecha, comprobante, precio, costo, utilidad, idVenta). */
  getUtilidadesDetalle(fechaInicio: string, fechaFin: string): Observable<{ message: string; data: FilaUtilidadDetalle[] }> {
    const requestUrl = this.url + '/detalle';
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '486b2c' }, body: JSON.stringify({ sessionId: '486b2c', location: 'utilidades.service.ts:getUtilidadesDetalle', message: 'request URL', data: { requestUrl, baseUrl: this.url }, timestamp: Date.now(), hypothesisId: 'H3' }) }).catch(() => {});
    // #endregion
    return this.http.get<{ message: string; data: FilaUtilidadDetalle[] }>(requestUrl, {
      params: { fechaInicio, fechaFin },
      withCredentials: true,
    });
  }
}
