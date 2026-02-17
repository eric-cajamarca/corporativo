import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { global } from './global';
import { Impuesto, ImpuestoCreate, CodigoSunatImpuesto } from '../interfaces/impuesto.interface';

@Injectable({
  providedIn: 'root'
})
export class ImpuestoService {
  private url: string;

  constructor(private http: HttpClient) {
    this.url = global.url;
  }

  private getOptions(): { headers: HttpHeaders; withCredentials: boolean } {
    return {
      headers: new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' }),
      withCredentials: true
    };
  }

  obtenerTodos(): Observable<{ data: Impuesto[] }> {
    return this.http.get<{ data: Impuesto[] }>(this.url + 'impuestos', this.getOptions());
  }

  obtenerPorId(id: number): Observable<{ data: Impuesto }> {
    return this.http.get<{ data: Impuesto }>(this.url + 'impuestos/' + id, this.getOptions());
  }

  crear(payload: ImpuestoCreate): Observable<{ data: unknown }> {
    return this.http.post<{ data: unknown }>(this.url + 'impuestos', payload, this.getOptions());
  }

  actualizar(id: number, payload: ImpuestoCreate): Observable<{ data: { rowsAffected: number } }> {
    return this.http.put<{ data: { rowsAffected: number } }>(this.url + 'impuestos/' + id, payload, this.getOptions());
  }

  actualizarEstado(id: number, estado: boolean): Observable<{ data: { rowsAffected: number } }> {
    return this.http.put<{ data: { rowsAffected: number } }>(
      this.url + 'impuestosestado/' + id,
      { estado },
      this.getOptions()
    );
  }

  /** Catálogo 05 SUNAT - Códigos de tipos de tributos (para selector en formulario) */
  getCodigosSunat(): Observable<{ data: CodigoSunatImpuesto[] }> {
    return this.http.get<{ data: CodigoSunatImpuesto[] }>(this.url + 'impuestos/codigos-sunat', this.getOptions());
  }
}
