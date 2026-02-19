import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EmpresaServicioItem {
  idEmpresa: string;
  razonSocial: string;
  ruc: string;
}

export interface EmpresasServiciosData {
  empresas: EmpresaServicioItem[];
  servicios: string[];
  asignaciones: Record<string, Record<string, boolean>>;
}

@Injectable({
  providedIn: 'root'
})
export class EmpresaFactilizaService {
  private readonly baseUrl = environment.API_URL + 'factiliza';

  constructor(private http: HttpClient) {}

  getServicios(): Observable<{ data: string[] }> {
    return this.http.get<{ data: string[] }>(`${this.baseUrl}/servicios`, { withCredentials: true });
  }

  getEmpresasServicios(): Observable<{ data: EmpresasServiciosData }> {
    return this.http.get<{ data: EmpresasServiciosData }>(`${this.baseUrl}/empresas-servicios`, { withCredentials: true });
  }

  guardarEmpresasServicios(asignaciones: Array<{ idEmpresa: string; nombreServicio: string; puedeUsar: boolean }>): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.baseUrl}/empresas-servicios`,
      { asignaciones },
      { withCredentials: true }
    );
  }
}
