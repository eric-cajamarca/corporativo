import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  CuentaBancaria,
  CuentaBancariaPayload,
  CuentasBancariasListResponse
} from '../models/cuenta-bancaria.model';

@Injectable({ providedIn: 'root' })
export class CuentasBancariasService {
  private readonly baseUrl = environment.API_URL + 'cuentas-bancarias';
  private readonly headers = new HttpHeaders({ 'Content-Type': 'application/json' });

  constructor(private http: HttpClient) {}

  listar(): Observable<CuentasBancariasListResponse> {
    return this.http
      .get<{ data: CuentasBancariasListResponse }>(this.baseUrl, { withCredentials: true })
      .pipe(map((r) => r.data || { esEmpresaPrincipal: false, items: [] }));
  }

  crear(payload: CuentaBancariaPayload): Observable<CuentaBancaria> {
    return this.http
      .post<{ data: CuentaBancaria }>(this.baseUrl, JSON.stringify(payload), {
        headers: this.headers,
        withCredentials: true
      })
      .pipe(map((r) => r.data));
  }

  actualizar(id: string, payload: CuentaBancariaPayload): Observable<CuentaBancaria> {
    return this.http
      .put<{ data: CuentaBancaria }>(`${this.baseUrl}/${encodeURIComponent(id)}`, JSON.stringify(payload), {
        headers: this.headers,
        withCredentials: true
      })
      .pipe(map((r) => r.data));
  }

  eliminar(id: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${encodeURIComponent(id)}`, { withCredentials: true });
  }
}
