import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { CheckoutIniciado, PlanCatalogoItem } from '../models/saas-public.model';

@Injectable({ providedIn: 'root' })
export class SaasPublicService {
  private readonly baseUrl = environment.API_URL;
  private readonly headers = new HttpHeaders({ 'Content-Type': 'application/json' });

  constructor(private http: HttpClient) {}

  listarPlanes(): Observable<PlanCatalogoItem[]> {
    return this.http
      .get<{ data: PlanCatalogoItem[] }>(`${this.baseUrl}public/planes`, {
        headers: this.headers,
        withCredentials: false
      })
      .pipe(map((r) => r.data || []));
  }

  iniciarCheckout(body: {
    planCode: string;
    billingCycle: string;
    emailContacto?: string;
  }): Observable<CheckoutIniciado> {
    return this.http
      .post<{ data: CheckoutIniciado }>(`${this.baseUrl}public/suscripcion/iniciar-checkout`, JSON.stringify(body), {
        headers: this.headers,
        withCredentials: false
      })
      .pipe(map((r) => r.data));
  }

  confirmarDemo(orderNumber: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}public/suscripcion/confirmar-demo`, JSON.stringify({ orderNumber }), {
      headers: this.headers,
      withCredentials: false
    });
  }

  confirmarCulqi(payload: { orderNumber: string; tokenId: string; email: string }): Observable<unknown> {
    return this.http.post(`${this.baseUrl}public/suscripcion/confirmar-culqi`, JSON.stringify(payload), {
      headers: this.headers,
      withCredentials: false
    });
  }

  estadoCheckout(orderNumber: string): Observable<{ estado: string; planCode: string; billingCycle: string; monto: number }> {
    return this.http
      .get<{ data: { estado: string; planCode: string; billingCycle: string; monto: number } }>(
        `${this.baseUrl}public/suscripcion/checkout/${encodeURIComponent(orderNumber)}/estado`,
        { withCredentials: false }
      )
      .pipe(map((r) => r.data));
  }
}
