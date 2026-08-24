import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of, take } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AppBannerItem } from '../models/app-banner.model';
import { PermisosService } from './permisos.service';
import { SaasSubscriptionService } from './saas-subscription.service';
import { MiEstadoSuscripcionResponse } from '../models/saas-subscription.model';

const STORAGE_PREFIX = 'app_banner_dismiss:';

@Injectable({ providedIn: 'root' })
export class AppBannerService {
  private readonly _avisos = signal<AppBannerItem[]>([]);
  /** Avisos visibles (ya filtrados por cierres de sesión). */
  readonly avisos = this._avisos.asReadonly();

  /** Avisos puestos por código (pantallas, interceptores); se fusionan al refrescar. */
  private manuales: AppBannerItem[] = [];

  constructor(
    private http: HttpClient,
    private permisos: PermisosService,
    private saas: SaasSubscriptionService
  ) {}

  /**
   * Recalcula avisos desde permisos, suscripción y (opcional) API.
   * Convocado al iniciar sesión y al navegar (desde el topnav).
   */
  refrescar(): void {
    const manuales = [...this.manuales];
    forkJoin({
      estado: this.saas.getMiEstado().pipe(
        take(1),
        catchError(() => of(null as MiEstadoSuscripcionResponse | null))
      ),
      remoto: this.http
        .get<{ items?: AppBannerItem[] }>(`${environment.API_URL}avisos/cinta`, { withCredentials: true })
        .pipe(
          take(1),
          map((r) => (Array.isArray(r?.items) ? r.items! : [])),
          catchError(() => of([] as AppBannerItem[]))
        )
    }).subscribe(({ estado, remoto }) => {
      const auto: AppBannerItem[] = [];

      const dm = this.permisos.deploymentMode();
      const plan = (this.permisos.planCodeEfectivo() || '').toLowerCase();
      if (dm === 'saas' && plan === 'demo') {
        auto.push({
          id: 'saas-plan-demo',
          severity: 'info',
          message:
            'Está en plan demo: algunas funciones están limitadas. Puede actualizar su plan cuando lo necesite.',
          link: '/cuenta/suscripcion',
          linkLabel: 'Ver suscripción',
          dismissible: true,
          dismissKey: 'saas-plan-demo'
        });
      }

      if (estado?.limitesUso?.excedeComprobantesSunat) {
        auto.push({
          id: 'tope-sunat-plan',
          severity: 'warning',
          message:
            'Ha alcanzado el tope de comprobantes SUNAT de su plan. Revise ventas no enviadas o considere ampliar el plan.',
          link: '/cuenta/suscripcion',
          linkLabel: 'Revisar plan',
          dismissible: true,
          dismissKey: 'tope-sunat-plan'
        });
      }

      const alertas = (estado?.limitesUso?.alertasPlan ?? []).filter((a) => a.clave === 'sunat');
      for (const a of alertas) {
        if (a.nivel !== 'aviso') continue;
        auto.push({
          id: `plan-aviso-${a.clave}`,
          severity: 'warning',
          message: `Ha usado el ${a.porcentaje}% de comprobantes SUNAT (${a.usado}/${a.maximo}). Considere renovar o ampliar el plan.`,
          link: '/cuenta/suscripcion',
          linkLabel: 'Ver uso',
          dismissible: true,
          dismissKey: `plan-aviso-${a.clave}`
        });
      }
      for (const a of alertas) {
        if (a.nivel !== 'critico') continue;
        if (a.clave === 'sunat' && estado?.limitesUso?.excedeComprobantesSunat) continue;
        auto.push({
          id: `plan-critico-${a.clave}`,
          severity: 'danger',
          message: `Límite alcanzado: ${a.etiqueta} (${a.usado}/${a.maximo}). Actualice su plan para continuar.`,
          link: '/cuenta/suscripcion',
          linkLabel: 'Actualizar plan',
          dismissible: true,
          dismissKey: `plan-critico-${a.clave}`
        });
      }

      const ordenPendiente = estado?.checkoutsOrden?.find(
        (o) => String(o?.estado || '').toLowerCase() === 'pendiente'
      );
      if (ordenPendiente) {
        auto.push({
          id: 'checkout-plan-pendiente',
          severity: 'warning',
          message: 'Tiene un pago de suscripción pendiente de confirmación.',
          link: '/cuenta/suscripcion',
          linkLabel: 'Ver estado',
          dismissible: true,
          dismissKey: `checkout-${ordenPendiente.orderNumber}`
        });
      }

      const fin = estado?.suscripcion?.fechaFin;
      if (fin && dm === 'saas') {
        const d = new Date(fin);
        if (!Number.isNaN(d.getTime())) {
          const dias = Math.ceil((d.getTime() - Date.now()) / (86400 * 1000));
          if (dias <= 14 && dias > 0) {
            auto.push({
              id: 'suscripcion-por-vencer',
              severity: 'warning',
              message: `Su suscripción vence en ${dias} día(s) (${this.formatoCorto(fin)}). Renueve para no perder servicio.`,
              link: '/cuenta/suscripcion',
              linkLabel: 'Renovar',
              dismissible: true,
              dismissKey: 'suscripcion-por-vencer'
            });
          }
        }
      }

      const merged = this.unirPorId([...auto, ...remoto, ...manuales]);
      this._avisos.set(merged.filter((a) => !this.estaDescartado(a)));
    });
  }

  /** Aviso puntual (ej. tras error de envío SUNAT). Se pierde al llamar `refrescar()` salvo que vuelva a agregarse. */
  agregarManual(item: AppBannerItem): void {
    this.manuales = this.unirPorId([item, ...this.manuales.filter((x) => x.id !== item.id)]);
    this._avisos.set(this.unirPorId([...this._avisos(), item]).filter((a) => !this.estaDescartado(a)));
  }

  quitarManual(id: string): void {
    this.manuales = this.manuales.filter((x) => x.id !== id);
    this._avisos.update((list) => list.filter((x) => x.id !== id));
  }

  /** Limpia avisos (p. ej. al cerrar sesión). */
  limpiar(): void {
    this.manuales = [];
    this._avisos.set([]);
  }

  descartar(item: AppBannerItem): void {
    const key = item.dismissKey || item.id;
    try {
      sessionStorage.setItem(STORAGE_PREFIX + key, '1');
    } catch {
      /* ignore */
    }
    this._avisos.update((list) => list.filter((x) => x.id !== item.id));
  }

  private estaDescartado(item: AppBannerItem): boolean {
    const key = item.dismissKey || item.id;
    try {
      return sessionStorage.getItem(STORAGE_PREFIX + key) === '1';
    } catch {
      return false;
    }
  }

  private unirPorId(items: AppBannerItem[]): AppBannerItem[] {
    const map = new Map<string, AppBannerItem>();
    for (const it of items) {
      map.set(it.id, it);
    }
    return [...map.values()];
  }

  private formatoCorto(iso: string): string {
    const s = String(iso).trim().substring(0, 10);
    const p = s.split('-');
    if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    return s;
  }
}
