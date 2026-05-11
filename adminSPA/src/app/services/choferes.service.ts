import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { global } from './global';

export interface ChoferInterno {
  idChofer: string;
  idUsuarioChofer: string;
  nombres: string;
  apellidos: string;
  email: string;
  idVehiculo?: string;
  placa?: string;
  marca?: string;
  modelo?: string;
  estado: boolean;
  /** Presente en listado consolidado (empresa gestora). */
  idEmpresa?: string;
  razonSocialEmpresa?: string;
}

export interface UsuarioChoferRol {
  idUsuario: string;
  nombres: string;
  apellidos: string;
  email: string;
  estado: boolean;
  /** Presente en listado consolidado (empresa gestora). */
  idEmpresa?: string;
  razonSocialEmpresa?: string;
}

@Injectable({ providedIn: 'root' })
export class ChoferesService {
  private url = global.url;

  constructor(private http: HttpClient) {}

  listarChoferes(
    idEmpresa?: string,
    opts?: { alcanceGestora?: boolean }
  ): Observable<{ data: ChoferInterno[] }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    let params = new HttpParams();
    if (opts?.alcanceGestora) {
      params = params.set('alcance', 'gestora');
    } else if (idEmpresa) {
      params = params.set('idEmpresa', idEmpresa);
    }
    return this.http.get<{ data: ChoferInterno[] }>(`${this.url}choferes/`, {
      headers,
      params,
      withCredentials: true
    });
  }

  listarUsuariosChoferRol(
    idEmpresa?: string,
    opts?: { alcanceGestora?: boolean }
  ): Observable<{ data: UsuarioChoferRol[] }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    let params = new HttpParams();
    if (opts?.alcanceGestora) {
      params = params.set('alcance', 'gestora');
    } else if (idEmpresa) {
      params = params.set('idEmpresa', idEmpresa);
    }
    return this.http.get<{ data: UsuarioChoferRol[] }>(`${this.url}choferes/usuarios`, {
      headers,
      params,
      withCredentials: true
    });
  }

  guardarChoferInterno(data: {
    idUsuarioChofer: string;
    idVehiculo?: string | null;
    idEmpresa?: string | null;
  }): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this.http.post(
      `${this.url}choferes/`,
      {
        idUsuarioChofer: data.idUsuarioChofer,
        idVehiculo: data.idVehiculo ?? null,
        ...(data.idEmpresa != null && String(data.idEmpresa).trim() !== ''
          ? { idEmpresa: String(data.idEmpresa).trim() }
          : {})
      },
      { headers, withCredentials: true }
    );
  }
}

