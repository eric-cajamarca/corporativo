import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  LibroReclamacionDetalle,
  LibroReclamacionListItem,
  LibroReclamacionRegistroRequest,
  LibroReclamacionRegistroResponse,
  ProveedorLibroReclamaciones
} from '../models/libro-reclamaciones.models';

@Injectable({ providedIn: 'root' })
export class LibroReclamacionesService {
  private readonly baseUrl = environment.API_URL;
  private readonly headers = new HttpHeaders({ 'Content-Type': 'application/json' });

  constructor(private http: HttpClient) {}

  obtenerProveedor(): Observable<ProveedorLibroReclamaciones> {
    return this.http
      .get<{ data: ProveedorLibroReclamaciones }>(`${this.baseUrl}public/libro-reclamaciones/proveedor`, {
        withCredentials: false
      })
      .pipe(map((r) => r.data));
  }

  registrar(body: LibroReclamacionRegistroRequest): Observable<LibroReclamacionRegistroResponse> {
    return this.http
      .post<{ data: LibroReclamacionRegistroResponse }>(
        `${this.baseUrl}public/libro-reclamaciones`,
        JSON.stringify(body),
        { headers: this.headers, withCredentials: false }
      )
      .pipe(map((r) => r.data));
  }

  listar(estado?: string): Observable<LibroReclamacionListItem[]> {
    let params = new HttpParams();
    if (estado) params = params.set('estado', estado);
    return this.http
      .get<{ data: LibroReclamacionListItem[] }>(`${this.baseUrl}libro-reclamaciones`, {
        params,
        withCredentials: true
      })
      .pipe(map((r) => r.data || []));
  }

  obtener(idReclamacion: string): Observable<LibroReclamacionDetalle> {
    return this.http
      .get<{ data: LibroReclamacionDetalle }>(`${this.baseUrl}libro-reclamaciones/${idReclamacion}`, {
        withCredentials: true
      })
      .pipe(map((r) => r.data));
  }

  responder(
    idReclamacion: string,
    body: { respuestaProveedor: string; estado?: string }
  ): Observable<LibroReclamacionDetalle> {
    return this.http
      .patch<{ data: LibroReclamacionDetalle }>(
        `${this.baseUrl}libro-reclamaciones/${idReclamacion}/respuesta`,
        JSON.stringify(body),
        { headers: this.headers, withCredentials: true }
      )
      .pipe(map((r) => r.data));
  }
}
