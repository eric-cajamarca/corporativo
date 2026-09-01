import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  LeadComercialChat,
  LeadComercialEstado,
  LeadComercialMetricas,
  LeadComercialRow
} from '../models/lead-comercial.model';

@Injectable({ providedIn: 'root' })
export class LeadComercialService {
  private readonly baseUrl = environment.API_URL;
  private readonly headers = new HttpHeaders({ 'Content-Type': 'application/json' });

  constructor(private http: HttpClient) {}

  listar(estado?: string): Observable<LeadComercialRow[]> {
    let params = new HttpParams();
    if (estado) params = params.set('estado', estado);
    return this.http
      .get<{ data: LeadComercialRow[] }>(`${this.baseUrl}leads-comercial`, {
        params,
        withCredentials: true
      })
      .pipe(map((r) => r.data || []));
  }

  metricas(desde: string, hasta: string): Observable<LeadComercialMetricas> {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.http
      .get<{ data: LeadComercialMetricas }>(`${this.baseUrl}leads-comercial/metricas`, {
        params,
        withCredentials: true
      })
      .pipe(map((r) => r.data));
  }

  revision(): Observable<LeadComercialRow[]> {
    return this.http
      .get<{ data: LeadComercialRow[] }>(`${this.baseUrl}leads-comercial/revision`, {
        withCredentials: true
      })
      .pipe(map((r) => r.data || []));
  }

  chat(idLead: string): Observable<LeadComercialChat> {
    return this.http
      .get<{ data: LeadComercialChat }>(
        `${this.baseUrl}leads-comercial/${encodeURIComponent(idLead)}/chat`,
        { withCredentials: true }
      )
      .pipe(map((r) => r.data));
  }

  actualizarEstado(idLead: string, estado: LeadComercialEstado): Observable<LeadComercialRow> {
    return this.http
      .patch<{ data: LeadComercialRow }>(
        `${this.baseUrl}leads-comercial/${encodeURIComponent(idLead)}/estado`,
        JSON.stringify({ estado }),
        { headers: this.headers, withCredentials: true }
      )
      .pipe(map((r) => r.data));
  }

  guardarRevision(
    idLead: string,
    body: { notaRevision?: string; estado?: LeadComercialEstado }
  ): Observable<LeadComercialRow> {
    return this.http
      .patch<{ data: LeadComercialRow }>(
        `${this.baseUrl}leads-comercial/${encodeURIComponent(idLead)}/revision`,
        JSON.stringify(body),
        { headers: this.headers, withCredentials: true }
      )
      .pipe(map((r) => r.data));
  }
}
