import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs';

export interface GraficoVentasVista {
  etiquetas: string[];
  datos: number[];
  leyenda: string;
}

export interface GraficoVentas {
  porDiaHora: GraficoVentasVista;
  mesPorDia: GraficoVentasVista;
  seisMeses: GraficoVentasVista;
  doceMeses: GraficoVentasVista;
}

export interface ResumenDashboard {
  ventasTotales: number;
  ventasVariacion: number;
  utilidadNeta: number;
  utilidadVariacion: number;
  clientesActivos: number;
  clientesVariacion: number;
  roi: number;
  ingresos: number;
  costos: number;
  utilidadBruta: number;
  gastosOperativos: number;
  productosMasVendidos: { nombre: string; categoria: string; ventas: number; monto: number }[];
  ventasMensuales: number[];
  ventasMensualesLabels?: string[];
  graficoVentas?: GraficoVentas;
  alertas: { titulo: string; mensaje: string; icono: string; tipo: string; tiempo: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  public url: string;

  constructor(private _http: HttpClient) {
    this.url = global.url;
  }

  /**
   * Obtiene el resumen del dashboard con datos reales de la empresa.
   * @param periodo - 'Hoy' | 'Esta Semana' | 'Este Mes' | 'Este Año'
   */
  obtenerResumen(periodo?: string): Observable<{ data: ResumenDashboard }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    const params = periodo ? `?periodo=${encodeURIComponent(periodo)}` : '';
    return this._http.get<{ data: ResumenDashboard }>(this.url + 'dashboard/resumen' + params, {
      headers,
      withCredentials: true
    });
  }

  /** Consolidado gestora + empresas gestionadas (403 si no es gestora). */
  obtenerResumenConsolidado(periodo?: string): Observable<{
    data: { consolidado: ResumenDashboard; porEmpresa: { idEmpresa: string; razonSocial: string; resumen: ResumenDashboard }[] };
  }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    const params = periodo ? `?periodo=${encodeURIComponent(periodo)}` : '';
    return this._http.get(this.url + 'dashboard/resumen-consolidado' + params, {
      headers,
      withCredentials: true
    }) as Observable<{
      data: { consolidado: ResumenDashboard; porEmpresa: { idEmpresa: string; razonSocial: string; resumen: ResumenDashboard }[] };
    }>;
  }
}
