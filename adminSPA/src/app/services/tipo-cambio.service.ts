import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface TipoCambioData {
  fecha: string;
  compra: number;
  venta: number;
}

@Injectable({
  providedIn: 'root'
})
export class TipoCambioService {
  private readonly baseUrl = environment.API_URL + 'factiliza/tipo-cambio';

  constructor(private http: HttpClient) {}

  getTipoCambioDia(): Observable<TipoCambioData | null> {
    return this.http.get<{ data: TipoCambioData }>(this.baseUrl, { withCredentials: true }).pipe(
      map(res => res.data ?? null),
      catchError(() => of(null))
    );
  }

  getTipoCambioMes(anio: number, mes: number): Observable<TipoCambioData[]> {
    const url = `${this.baseUrl}/mes?anio=${anio}&mes=${mes}`;
    return this.http.get<{ data: TipoCambioData[] }>(url, { withCredentials: true }).pipe(
      map(res => res.data ?? []),
      catchError(() => of([]))
    );
  }
}
