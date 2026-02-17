import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API_CATALOGOS = environment.API_URL + 'catalogos/';

@Injectable({
  providedIn: 'root'
})
export class CatalogosService {
  private headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });

  constructor(private http: HttpClient) {}

  private get<T>(path: string, params?: { [key: string]: string }): Observable<T> {
    return this.http.get<T>(API_CATALOGOS + path, { headers: this.headers, withCredentials: true, params: params || {} });
  }
  private post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(API_CATALOGOS + path, body, { headers: this.headers, withCredentials: true });
  }
  private put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(API_CATALOGOS + path, body, { headers: this.headers, withCredentials: true });
  }
  private delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(API_CATALOGOS + path, { headers: this.headers, withCredentials: true });
  }

  // Forma Pago
  listarFormaPago(buscar?: string, pagina?: number, porPagina?: number): Observable<{ data: any[]; total: number }> {
    const params: any = {};
    if (buscar != null) params.buscar = buscar;
    if (pagina != null) params.pagina = String(pagina);
    if (porPagina != null) params.porPagina = String(porPagina);
    return this.get<{ data: any[]; total: number }>('forma-pago', params);
  }
  obtenerFormaPago(id: string): Observable<{ data: any }> {
    return this.get<{ data: any }>('forma-pago/' + id);
  }
  crearFormaPago(body: { descripcion: string; tipo?: string; requiereReferencia?: boolean; activo?: boolean }): Observable<{ data: any }> {
    return this.post<{ data: any }>('forma-pago', body);
  }
  actualizarFormaPago(id: string, body: { descripcion: string; tipo?: string; requiereReferencia?: boolean; activo?: boolean }): Observable<{ data: any }> {
    return this.put<{ data: any }>('forma-pago/' + id, body);
  }
  eliminarFormaPago(id: string | number): Observable<{ data: any }> {
    return this.delete<{ data: any }>('forma-pago/' + id);
  }

  // Tipo Movimientos
  listarTipoMovimientos(buscar?: string, pagina?: number, porPagina?: number): Observable<{ data: any[]; total: number }> {
    const params: any = {};
    if (buscar != null) params.buscar = buscar;
    if (pagina != null) params.pagina = String(pagina);
    if (porPagina != null) params.porPagina = String(porPagina);
    return this.get<{ data: any[]; total: number }>('tipo-movimientos', params);
  }
  obtenerTipoMovimiento(id: string): Observable<{ data: any }> {
    return this.get<{ data: any }>('tipo-movimientos/' + id);
  }
  crearTipoMovimiento(body: { descripcion: string; tipo: string; descripcionCorta?: string }): Observable<{ data: any }> {
    return this.post<{ data: any }>('tipo-movimientos', body);
  }
  actualizarTipoMovimiento(id: string, body: { descripcion: string; tipo: string; descripcionCorta?: string }): Observable<{ data: any }> {
    return this.put<{ data: any }>('tipo-movimientos/' + id, body);
  }
  eliminarTipoMovimiento(id: string): Observable<{ data: any }> {
    return this.delete<{ data: any }>('tipo-movimientos/' + id);
  }

  // Clasificación Conceptos
  listarClasificacionConceptos(buscar?: string, pagina?: number, porPagina?: number): Observable<{ data: any[]; total: number }> {
    const params: any = {};
    if (buscar != null) params.buscar = buscar;
    if (pagina != null) params.pagina = String(pagina);
    if (porPagina != null) params.porPagina = String(porPagina);
    return this.get<{ data: any[]; total: number }>('clasificacion-conceptos', params);
  }
  obtenerClasificacionConcepto(id: string): Observable<{ data: any }> {
    return this.get<{ data: any }>('clasificacion-conceptos/' + id);
  }
  crearClasificacionConcepto(body: { descripcion: string }): Observable<{ data: any }> {
    return this.post<{ data: any }>('clasificacion-conceptos', body);
  }
  actualizarClasificacionConcepto(id: string, body: { descripcion: string }): Observable<{ data: any }> {
    return this.put<{ data: any }>('clasificacion-conceptos/' + id, body);
  }
  eliminarClasificacionConcepto(id: string): Observable<{ data: any }> {
    return this.delete<{ data: any }>('clasificacion-conceptos/' + id);
  }

  // Conceptos
  listarConceptos(buscar?: string, pagina?: number, porPagina?: number, extras?: { tipo?: string }): Observable<{ data: any[]; total: number }> {
    const params: any = {};
    if (buscar != null) params.buscar = buscar;
    if (pagina != null) params.pagina = String(pagina);
    if (porPagina != null) params.porPagina = String(porPagina);
    if (extras?.tipo) params.tipo = extras.tipo;
    return this.get<{ data: any[]; total: number }>('conceptos', params);
  }
  listarConceptosPorTipo(tipo: 'INGRESO' | 'EGRESO'): Observable<{ data: any[]; total: number }> {
    return this.listarConceptos(undefined, 1, 500, { tipo });
  }
  obtenerConcepto(id: string): Observable<{ data: any }> {
    return this.get<{ data: any }>('conceptos/' + id);
  }
  crearConcepto(body: { descripcion: string; tipo: string; idClasificacionConcepto?: string | null }): Observable<{ data: any }> {
    return this.post<{ data: any }>('conceptos', body);
  }
  actualizarConcepto(id: string, body: { descripcion: string; tipo: string; idClasificacionConcepto?: string | null }): Observable<{ data: any }> {
    return this.put<{ data: any }>('conceptos/' + id, body);
  }
  eliminarConcepto(id: string): Observable<{ data: any }> {
    return this.delete<{ data: any }>('conceptos/' + id);
  }

  // Motivo Traslado
  listarMotivoTraslado(buscar?: string, pagina?: number, porPagina?: number): Observable<{ data: any[]; total: number }> {
    const params: any = {};
    if (buscar != null) params.buscar = buscar;
    if (pagina != null) params.pagina = String(pagina);
    if (porPagina != null) params.porPagina = String(porPagina);
    return this.get<{ data: any[]; total: number }>('motivo-traslado', params);
  }
  obtenerMotivoTraslado(id: string): Observable<{ data: any }> {
    return this.get<{ data: any }>('motivo-traslado/' + id);
  }
  crearMotivoTraslado(body: { descripcion: string }): Observable<{ data: any }> {
    return this.post<{ data: any }>('motivo-traslado', body);
  }
  actualizarMotivoTraslado(id: string, body: { descripcion: string }): Observable<{ data: any }> {
    return this.put<{ data: any }>('motivo-traslado/' + id, body);
  }
  eliminarMotivoTraslado(id: string): Observable<{ data: any }> {
    return this.delete<{ data: any }>('motivo-traslado/' + id);
  }

  // Motivo Nota Crédito
  listarMotivoNotaCredito(buscar?: string, pagina?: number, porPagina?: number): Observable<{ data: any[]; total: number }> {
    const params: any = {};
    if (buscar != null) params.buscar = buscar;
    if (pagina != null) params.pagina = String(pagina);
    if (porPagina != null) params.porPagina = String(porPagina);
    return this.get<{ data: any[]; total: number }>('motivo-nota-credito', params);
  }
  obtenerMotivoNotaCredito(id: string): Observable<{ data: any }> {
    return this.get<{ data: any }>('motivo-nota-credito/' + id);
  }
  codigosSunatMotivoNotaCredito(): Observable<{ data: string[] }> {
    return this.get<{ data: string[] }>('motivo-nota-credito/codigos-sunat');
  }
  crearMotivoNotaCredito(body: { codigoSunat: string; descripcion: string }): Observable<{ data: any }> {
    return this.post<{ data: any }>('motivo-nota-credito', body);
  }
  actualizarMotivoNotaCredito(id: string, body: { codigoSunat: string; descripcion: string }): Observable<{ data: any }> {
    return this.put<{ data: any }>('motivo-nota-credito/' + id, body);
  }
  eliminarMotivoNotaCredito(id: string): Observable<{ data: any }> {
    return this.delete<{ data: any }>('motivo-nota-credito/' + id);
  }
}
