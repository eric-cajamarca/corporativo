import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class AnalisisService {
  public url: any;

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  // Dashboard Ejecutivo
  obtenerDashboardEjecutivo(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'analisis/dashboard', {
      headers: headers,
      withCredentials: true
    });
  }

  // Balance General
  obtenerBalanceGeneral(periodo?: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    let params = periodo ? `?periodo=${periodo}` : '';
    return this._http.get(this.url+'analisis/balance-general' + params, {
      headers: headers,
      withCredentials: true
    });
  }

  // Estado de Resultados
  obtenerEstadoResultados(filtros?: {
    fechaDesde?: string;
    fechaHasta?: string;
    agruparPor?: 'MES' | 'TRIMESTRE' | 'ANO';
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
    return this._http.get(this.url+'analisis/estado-resultados' + params, {
      headers: headers,
      withCredentials: true
    });
  }

  // Ratios Financieros
  obtenerRatiosFinancieros(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'analisis/ratios', {
      headers: headers,
      withCredentials: true
    });
  }

  // Análisis de Rentabilidad
  obtenerAnalisisRentabilidad(tipo: 'PRODUCTO' | 'CATEGORIA' | 'CLIENTE' | 'VENDEDOR', filtros?: {
    fechaDesde?: string;
    fechaHasta?: string;
    limite?: number;
  }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    let params = `?tipo=${tipo}`;
    if (filtros) {
      const queryParams = new URLSearchParams();
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
      params += '&' + queryParams.toString();
    }
    return this._http.get(this.url+'analisis/rentabilidad' + params, {
      headers: headers,
      withCredentials: true
    });
  }

  // Flujo de Efectivo
  obtenerFlujoEfectivo(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'analisis/flujo-efectivo', {
      headers: headers,
      withCredentials: true
    });
  }

  // Eficiencia Operativa
  obtenerEficienciaOperativa(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'analisis/eficiencia-operativa', {
      headers: headers,
      withCredentials: true
    });
  }

  // Proyección de Ventas
  obtenerProyeccionVentas(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'analisis/proyeccion-ventas', {
      headers: headers,
      withCredentials: true
    });
  }

  // Punto de Equilibrio
  obtenerPuntoEquilibrio(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'analisis/punto-equilibrio', {
      headers: headers,
      withCredentials: true
    });
  }

  // Diagnóstico Financiero
  obtenerDiagnosticoFinanciero(): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'analisis/diagnostico-financiero', {
      headers: headers,
      withCredentials: true
    });
  }

  // Gastos operativos (para estado de resultados)
  listarGastos(fechaDesde?: string, fechaHasta?: string): Observable<any> {
    let params = '';
    if (fechaDesde || fechaHasta) {
      const q = new URLSearchParams();
      if (fechaDesde) q.append('fechaDesde', fechaDesde);
      if (fechaHasta) q.append('fechaHasta', fechaHasta);
      params = '?' + q.toString();
    }
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url + 'analisis/gastos' + params, { headers, withCredentials: true });
  }
  crearGasto(datos: { fecha: string; tipo: string; monto: number; descripcion?: string }): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url + 'analisis/gastos', datos, { headers, withCredentials: true });
  }
  eliminarGasto(idGasto: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url + 'analisis/gastos/' + encodeURIComponent(idGasto), { headers, withCredentials: true });
  }
}