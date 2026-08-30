import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LeadComercialEstado, LeadComercialRow } from '../models/lead-comercial.model';

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

  actualizarEstado(idLead: string, estado: LeadComercialEstado): Observable<LeadComercialRow> {
    return this.http
      .patch<{ data: LeadComercialRow }>(
        `${this.baseUrl}leads-comercial/${encodeURIComponent(idLead)}/estado`,
        JSON.stringify({ estado }),
        { headers: this.headers, withCredentials: true }
      )
      .pipe(map((r) => r.data));
  }
}
