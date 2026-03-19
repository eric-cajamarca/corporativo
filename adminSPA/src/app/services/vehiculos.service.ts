import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { global } from './global';

export interface VehiculoRegistro {
  idVehiculo: string;
  placa: string;
  marca?: string;
  modelo?: string;
  color?: string;
  serie?: string;
  motor?: string;
  vin?: string;
  fRegistro?: string;
  soatEstado?: string;
  soatFechaFin?: string;
  soatCompania?: string;
}

@Injectable({ providedIn: 'root' })
export class VehiculosService {
  private url = global.url;

  constructor(private http: HttpClient) {}

  guardarVehiculoYSoat(vehiculo: any, soat: any): Observable<{ message: string; data: any }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<{ message: string; data: any }>(
      `${this.url}vehiculos/guardar`,
      { vehiculo, soat },
      { headers, withCredentials: true }
    );
  }

  listarVehiculos(): Observable<{ data: VehiculoRegistro[] }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.get<{ data: VehiculoRegistro[] }>(`${this.url}vehiculos`, {
      headers,
      withCredentials: true
    });
  }

  listarVehiculosSoatVencido(): Observable<{ data: VehiculoRegistro[] }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.get<{ data: VehiculoRegistro[] }>(`${this.url}vehiculos/soat-vencido`, {
      headers,
      withCredentials: true
    });
  }

  eliminarVehiculo(idVehiculo: string): Observable<{ message: string }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.delete<{ message: string }>(`${this.url}vehiculos/${idVehiculo}`, {
      headers,
      withCredentials: true
    });
  }
}
