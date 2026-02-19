import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuditoriaFiltros {
  idUsuario?: string;
  accion?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  pagina?: number;
  porPagina?: number;
}

export interface AuditoriaItem {
  idAuditoria: string;
  idUsuario: string;
  idEmpresa: string;
  accion: string;
  tablaAfectada: string | null;
  idRegistroAfectado: string | null;
  fechaAccion: string;
  ipAddress: string | null;
  userAgent: string | null;
  usuarioNombre: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuditoriaService {
  private readonly url = environment.API_URL + 'auditoria/';
  private headers = new HttpHeaders({ 'Content-Type': 'application/json' });

  constructor(private http: HttpClient) {}

  listar(filtros: AuditoriaFiltros): Observable<{ data: AuditoriaItem[]; total: number }> {
    const params: Record<string, string> = {};
    if (filtros['idUsuario']) params['idUsuario'] = filtros['idUsuario'];
    if (filtros['accion']) params['accion'] = filtros['accion'];
    if (filtros['fechaDesde']) params['fechaDesde'] = filtros['fechaDesde'];
    if (filtros['fechaHasta']) params['fechaHasta'] = filtros['fechaHasta'];
    if (filtros['pagina'] != null) params['pagina'] = String(filtros['pagina']);
    if (filtros['porPagina'] != null) params['porPagina'] = String(filtros['porPagina']);
    return this.http.get<{ message: string; data: AuditoriaItem[]; total: number }>(
      this.url,
      { headers: this.headers, withCredentials: true, params }
    );
  }
}
