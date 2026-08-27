import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  CheckoutIniciado,
  CheckoutPagoManualReportado,
  CheckoutResumen,
  PlanCatalogoItem
} from '../models/saas-public.model';

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

  /** Monto y medios de pago sin crear la orden (la orden se crea al confirmar el pago). */
  resumenCheckout(body: { planCode: string; billingCycle: string }): Observable<CheckoutResumen> {
    return this.http
      .post<{ data: CheckoutResumen }>(`${this.baseUrl}public/suscripcion/resumen-checkout`, JSON.stringify(body), {
        headers: this.headers,
        /** Cookie de sesión: el backend valida downgrade contra la suscripción vigente. */
        withCredentials: true
      })
      .pipe(map((r) => r.data));
  }

  iniciarCheckout(body: {
    planCode: string;
    billingCycle: string;
    emailContacto?: string;
  }): Observable<CheckoutIniciado> {
    return this.http
      .post<{ data: CheckoutIniciado }>(`${this.baseUrl}public/suscripcion/iniciar-checkout`, JSON.stringify(body), {
        headers: this.headers,
        /** Cookie de sesión: asocia el CHK a la empresa para vincular al pagar (demo/Culqi) o por webhook. */
        withCredentials: true
      })
      .pipe(map((r) => r.data));
  }

  confirmarDemo(orderNumber: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}public/suscripcion/confirmar-demo`, JSON.stringify({ orderNumber }), {
      headers: this.headers,
      withCredentials: true
    });
  }

  confirmarCulqi(payload: {
    orderNumber: string;
    tokenId: string;
    email: string;
    /** De Culqi3DS.generateDevice() — recomendado para cargos con tarjeta. */
    deviceFingerPrintId?: string;
    clientFirstName?: string;
    clientLastName?: string;
    clientPhone?: string;
    /** Tras Culqi3DS: mismo token y device que el primer intento; cuerpo del postMessage.parameters3DS. */
    authentication3DS?: Record<string, unknown>;
  }): Observable<unknown> {
    return this.http.post(`${this.baseUrl}public/suscripcion/confirmar-culqi`, JSON.stringify(payload), {
      headers: this.headers,
      withCredentials: true
    });
  }

  reportarPagoManual(payload: {
    orderNumber: string;
    medioPago: 'yape' | 'plin' | 'bcp';
    email: string;
    referencia?: string;
  }): Observable<CheckoutPagoManualReportado> {
    return this.http
      .post<{ data: CheckoutPagoManualReportado }>(
        `${this.baseUrl}public/suscripcion/reportar-pago-manual`,
        JSON.stringify(payload),
        { headers: this.headers, withCredentials: true }
      )
      .pipe(map((r) => r.data));
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
