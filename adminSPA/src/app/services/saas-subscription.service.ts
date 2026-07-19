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

  getPlanesCatalogoEditor(): Observable<{ puedeEditar: boolean }> {
    return this.http
      .get<{ data: { puedeEditar: boolean } }>(`${this.baseUrl}suscripcion/planes-catalogo-editor`, {
        withCredentials: true
      })
      .pipe(map((r) => r.data));
  }

  actualizarPlanCatalogo(
    planCode: string,
    body: {
      descripcionCorta: string;
      precioMensualPen: number;
      precioAnualPen: number;
      maxUsuarios: number;
      maxSucursales: number;
    }
  ): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.baseUrl}suscripcion/planes-catalogo/${encodeURIComponent(planCode)}`,
      JSON.stringify(body),
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

  listarPagosManuales(filtros?: {
    estado?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }): Observable<
    Array<{
      orderNumber: string;
      planCode: string;
      billingCycle: string;
      monto: number;
      moneda: string;
      estado: string;
      idTransaccionPasarela: string | null;
      fCreacion: string;
      fConfirmacion: string | null;
      emailContacto: string | null;
      idEmpresaCliente: string | null;
      razonSocialCliente: string | null;
      rucCliente: string | null;
    }>
  > {
    const params: Record<string, string> = {};
    if (filtros?.estado) params['estado'] = filtros.estado;
    if (filtros?.fechaDesde) params['fechaDesde'] = filtros.fechaDesde;
    if (filtros?.fechaHasta) params['fechaHasta'] = filtros.fechaHasta;
    return this.http
      .get<{ data: Array<Record<string, unknown>> }>(`${this.baseUrl}suscripcion/pagos-manuales`, {
        params,
        withCredentials: true
      })
      .pipe(map((r) => (r.data || []) as never));
  }

  confirmarPagoManual(orderNumber: string): Observable<unknown> {
    return this.http.post(
      `${this.baseUrl}suscripcion/pagos-manuales/confirmar`,
      JSON.stringify({ orderNumber }),
      { headers: this.headers, withCredentials: true }
    );
  }
}
