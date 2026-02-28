import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface Rubro {
  idRubro: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface ConfiguracionRubroItem {
  idConfiguracionRubro?: number;
  idRubro: number;
  clave: string;
  valor: string;
  descripcion?: string | null;
}

@Injectable({ providedIn: 'root' })
export class RubrosService {
  private url = environment.API_URL;

  constructor(private http: HttpClient) {}

  listar(params?: { buscar?: string; activo?: boolean }): Observable<{ data: Rubro[] }> {
    let query = '';
    if (params?.buscar) query += (query ? '&' : '?') + 'buscar=' + encodeURIComponent(params.buscar);
    if (params?.activo !== undefined) query += (query ? '&' : '?') + 'activo=' + (params.activo ? '1' : '0');
    return this.http.get<{ data: Rubro[] }>(this.url + 'rubros' + query, { withCredentials: true });
  }

  obtenerPorId(id: number): Observable<{ data: Rubro }> {
    return this.http.get<{ data: Rubro }>(this.url + 'rubros/' + id, { withCredentials: true });
  }

  crear(body: Partial<Rubro>): Observable<{ data: Rubro }> {
    return this.http.post<{ data: Rubro }>(this.url + 'rubros', body, { withCredentials: true });
  }

  actualizar(id: number, body: Partial<Rubro>): Observable<{ data: { ok: boolean } }> {
    return this.http.put<{ data: { ok: boolean } }>(this.url + 'rubros/' + id, body, { withCredentials: true });
  }

  eliminar(id: number): Observable<{ data: { ok: boolean } }> {
    return this.http.delete<{ data: { ok: boolean } }>(this.url + 'rubros/' + id, { withCredentials: true });
  }

  listarConfiguracion(idRubro: number): Observable<{ data: ConfiguracionRubroItem[] }> {
    return this.http.get<{ data: ConfiguracionRubroItem[] }>(this.url + 'rubros/' + idRubro + '/configuracion', { withCredentials: true });
  }

  guardarConfiguracion(idRubro: number, items: ConfiguracionRubroItem[]): Observable<{ data: { ok: boolean } }> {
    return this.http.put<{ data: { ok: boolean } }>(this.url + 'rubros/' + idRubro + '/configuracion', { items }, { withCredentials: true });
  }
}
