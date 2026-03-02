import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface TanqueGrifo {
  idTanque: string;
  idEmpresa: string;
  idProducto: string;
  idSucursal: string | null;
  capacidad: number;
  cantidadActual: number;
  unidad: string;
  codigoProducto: string;
  nombreProducto: string;
  categoria: string;
  nombreSucursal: string | null;
}

export interface ResumenGrifo {
  totalVales: number;
  cantidadVales: number;
  totalAnticipos: number;
  totalFacturado: number;
}

export interface ProductoCombustible {
  idProducto: string;
  codigo: string;
  descripcion: string;
  categoria: string;
}

@Injectable({ providedIn: 'root' })
export class GrifoService {
  private readonly url = environment.API_URL;

  constructor(private http: HttpClient) {}

  listarTanques(): Observable<{ data: TanqueGrifo[] }> {
    return this.http.get<{ data: TanqueGrifo[] }>(this.url + 'grifo/tanques', { withCredentials: true });
  }

  actualizarTanque(idTanque: string, datos: { cantidadActual?: number; capacidad?: number }): Observable<{ data: { ok: boolean } }> {
    return this.http.put<{ data: { ok: boolean } }>(this.url + 'grifo/tanques/' + idTanque, datos, { withCredentials: true });
  }

  crearTanque(body: { idProducto: string; idSucursal?: string; capacidad?: number; cantidadActual?: number }): Observable<{ data: { ok: boolean } }> {
    return this.http.post<{ data: { ok: boolean } }>(this.url + 'grifo/tanques', body, { withCredentials: true });
  }

  resumen(fechaDesde?: string, fechaHasta?: string): Observable<{ data: ResumenGrifo }> {
    let params = '';
    if (fechaDesde) params += (params ? '&' : '?') + 'fechaDesde=' + encodeURIComponent(fechaDesde);
    if (fechaHasta) params += (params ? '&' : '?') + 'fechaHasta=' + encodeURIComponent(fechaHasta);
    return this.http.get<{ data: ResumenGrifo }>(this.url + 'grifo/resumen' + params, { withCredentials: true });
  }

  productosCombustibles(): Observable<{ data: ProductoCombustible[] }> {
    return this.http.get<{ data: ProductoCombustible[] }>(this.url + 'grifo/productos-combustibles', { withCredentials: true });
  }
}
