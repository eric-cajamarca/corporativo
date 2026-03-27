import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { global } from './global';

const STORAGE_KEY = 'caja_idEmpresaOperacion_seleccion';

export interface EmpresaCajaOperacion {
  idEmpresa: string;
  razonSocial: string;
  ruc?: string;
}

export interface CajaOperacionContextoResponse {
  empresas: EmpresaCajaOperacion[];
  idEmpresaOperacionPorDefecto: string;
}

@Injectable({
  providedIn: 'root'
})
export class CajaOperacionContextService {
  private empresas: EmpresaCajaOperacion[] = [];
  private idSeleccionado: string | null = null;

  constructor(private http: HttpClient) {}

  /** UUID de empresa sobre la que opera caja / créditos / compras (gestora o gestionada). */
  get idEmpresaOperacion(): string | null {
    return this.idSeleccionado;
  }

  get empresasOperacion(): EmpresaCajaOperacion[] {
    return [...this.empresas];
  }

  cargarContexto(): Observable<CajaOperacionContextoResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this.http
      .get<{ data: CajaOperacionContextoResponse }>(global.url + 'caja/contexto-operacion', {
        headers,
        withCredentials: true
      })
      .pipe(
        map((r) => r.data),
        tap((ctx) => {
          this.empresas = ctx.empresas || [];
          const permitidas = new Set(this.empresas.map((e) => e.idEmpresa.toLowerCase()));
          let next = (ctx.idEmpresaOperacionPorDefecto || '').trim();
          const stored = sessionStorage.getItem(STORAGE_KEY);
          if (stored && permitidas.has(stored.toLowerCase())) {
            next = stored;
          }
          this.idSeleccionado = next || null;
        })
      );
  }

  setEmpresaOperacion(idEmpresa: string): void {
    sessionStorage.setItem(STORAGE_KEY, idEmpresa);
    this.idSeleccionado = idEmpresa;
  }

  /** Solo gestora: guarda empresa por defecto en configuración (backend valida). */
  guardarPorDefectoGestora(idEmpresaOperacion: string | null): Observable<unknown> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this.http.put(global.url + 'caja/config/empresa-operacion-default', { idEmpresaOperacion }, {
      headers,
      withCredentials: true
    });
  }
}
