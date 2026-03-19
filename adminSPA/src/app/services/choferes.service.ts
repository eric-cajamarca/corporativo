import { HttpClient, HttpHeaders } from '@angular/common/http';
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
}

export interface UsuarioChoferRol {
  idUsuario: string;
  nombres: string;
  apellidos: string;
  email: string;
  estado: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChoferesService {
  private url = global.url;

  constructor(private http: HttpClient) {}

  listarChoferes(): Observable<{ data: ChoferInterno[] }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this.http.get<{ data: ChoferInterno[] }>(`${this.url}choferes/`, { headers, withCredentials: true });
  }

  listarUsuariosChoferRol(): Observable<{ data: UsuarioChoferRol[] }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this.http.get<{ data: UsuarioChoferRol[] }>(`${this.url}choferes/usuarios`, { headers, withCredentials: true });
  }

  guardarChoferInterno(data: { idUsuarioChofer: string; idVehiculo?: string | null }): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    return this.http.post(
      `${this.url}choferes/`,
      { idUsuarioChofer: data.idUsuarioChofer, idVehiculo: data.idVehiculo ?? null },
      { headers, withCredentials: true }
    );
  }
}

