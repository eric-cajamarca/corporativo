import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface ValeDespachoListItem {
  idValeDespacho: string;
  idEmpresa: string;
  idSucursal: string;
  idCliente: number;
  idComprobante: number;
  serie: string;
  numero: string;
  compVale: string;
  fEmision: string;
  estado: string;
  idVentaLiquidacion?: number | null;
  observaciones?: string | null;
  nombreCliente?: string;
  clienteRazonSocial?: string;
}

export interface ValeDespachoDetalle extends ValeDespachoListItem {
  detalle?: { idProducto: string; nombreProducto?: string; cantidad: number; pUnitario: number; total: number; codigoPresentacion?: string }[];
}

@Injectable({ providedIn: 'root' })
export class ValesDespachoService {
  private url = environment.API_URL;

  constructor(private http: HttpClient) {}

  listar(filtros?: { idCliente?: number; fechaDesde?: string; fechaHasta?: string; estado?: string }): Observable<{ data: ValeDespachoListItem[] }> {
    let params: string[] = [];
    if (filtros?.idCliente != null) params.push('idCliente=' + filtros.idCliente);
    if (filtros?.fechaDesde) params.push('fechaDesde=' + filtros.fechaDesde);
    if (filtros?.fechaHasta) params.push('fechaHasta=' + filtros.fechaHasta);
    if (filtros?.estado) params.push('estado=' + filtros.estado);
    const q = params.length ? '?' + params.join('&') : '';
    return this.http.get<{ data: ValeDespachoListItem[] }>(this.url + 'vales-despacho' + q, { withCredentials: true });
  }

  obtenerPorId(id: string): Observable<{ data: ValeDespachoDetalle }> {
    return this.http.get<{ data: ValeDespachoDetalle }>(this.url + 'vales-despacho/' + id, { withCredentials: true });
  }

  crear(body: { idSucursal: string; idCliente: number; observaciones?: string; detalle: { idProducto: string; idPresentacion: number; cantidad: number; pUnitario: number; total: number }[] }): Observable<{ data: { idValeDespacho: string; serie: string; numero: string; compVale: string } }> {
    return this.http.post<{ data: { idValeDespacho: string; serie: string; numero: string; compVale: string } }>(this.url + 'vales-despacho', body, { withCredentials: true });
  }

  anular(id: string): Observable<{ data: { ok: boolean } }> {
    return this.http.put<{ data: { ok: boolean } }>(this.url + 'vales-despacho/' + id + '/anular', {}, { withCredentials: true });
  }
}
