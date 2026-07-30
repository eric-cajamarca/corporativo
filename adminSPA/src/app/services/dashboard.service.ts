import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs';
import { getFechaHoyLocal } from '../utils/fecha-local.util';

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

export interface VentaMedioPagoResumen {
  medio: string;
  monto: number;
}

export interface EnvioMananaResumen {
  idEnvio: string | number;
  cliente: string;
  direccion: string;
  fechaProgramada: string;
  estado: string;
}

export interface ResumenDiario {
  fecha: string;
  ventasTotales: number;
  ventasAyer: number;
  ventasVariacionPct: number;
  ventasPorMedioPago: VentaMedioPagoResumen[];
  ventasAlCredito: number;
  cobranzasDia: number;
  porCobrarTotal: number;
  comprasDia: number;
  utilidadDia: number;
  ingresosDia: number;
  enviosManana: EnvioMananaResumen[];
  mensajeResumen: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  public url: string;

  constructor(private _http: HttpClient) {
    this.url = global.url;
  }

  private queryDashboard(periodo?: string): string {
    const params = new URLSearchParams();
    if (periodo) params.set('periodo', periodo);
    params.set('fechaReferencia', getFechaHoyLocal());
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  /**
   * Obtiene el resumen del dashboard con datos reales de la empresa.
   * @param periodo - 'Hoy' | 'Esta Semana' | 'Este Mes' | 'Este Año'
   */
  obtenerResumen(periodo?: string): Observable<{ data: ResumenDashboard }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get<{ data: ResumenDashboard }>(this.url + 'dashboard/resumen' + this.queryDashboard(periodo), {
      headers,
      withCredentials: true
    });
  }

  /** Consolidado gestora + empresas gestionadas (403 si no es gestora). */
  obtenerResumenConsolidado(periodo?: string): Observable<{
    data: { consolidado: ResumenDashboard; porEmpresa: { idEmpresa: string; razonSocial: string; resumen: ResumenDashboard }[] };
  }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'dashboard/resumen-consolidado' + this.queryDashboard(periodo), {
      headers,
      withCredentials: true
    }) as Observable<{
      data: { consolidado: ResumenDashboard; porEmpresa: { idEmpresa: string; razonSocial: string; resumen: ResumenDashboard }[] };
    }>;
  }

  /** Resumen operativo del día (ventas por medio de pago, cobranzas, envíos mañana). */
  obtenerResumenDiario(): Observable<{ data: ResumenDiario }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    const params = new URLSearchParams();
    params.set('fechaReferencia', getFechaHoyLocal());
    return this._http.get<{ data: ResumenDiario }>(this.url + 'dashboard/resumen-diario?' + params.toString(), {
      headers,
      withCredentials: true
    });
  }
}
