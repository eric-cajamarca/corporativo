import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { CheckoutIniciado } from '../models/saas-public.model';
import { MiEstadoSuscripcionResponse } from '../models/saas-subscription.model';

@Injectable({ providedIn: 'root' })
export class SaasSubscriptionService {
  private readonly baseUrl = environment.API_URL;
  private readonly headers = new HttpHeaders({ 'Content-Type': 'application/json' });

  constructor(private http: HttpClient) {}

  getMiEstado(): Observable<MiEstadoSuscripcionResponse> {
    return this.http
      .get<{ data: MiEstadoSuscripcionResponse }>(`${this.baseUrl}suscripcion/mi-estado`, {
        withCredentials: true
      })
      .pipe(map((r) => r.data));
  }

  vincularCheckout(orderNumber: string): Observable<unknown> {
    return this.http.post(
      `${this.baseUrl}suscripcion/vincular-checkout`,
      JSON.stringify({ orderNumber }),
      { headers: this.headers, withCredentials: true }
    );
  }

  solicitarUpgrade(body: { planCode: string; billingCycle: string; emailContacto?: string }): Observable<CheckoutIniciado> {
    return this.http
      .post<{ data: CheckoutIniciado }>(`${this.baseUrl}suscripcion/solicitar-upgrade`, JSON.stringify(body), {
        headers: this.headers,
        withCredentials: true
      })
      .pipe(map((r) => r.data));
  }
}
