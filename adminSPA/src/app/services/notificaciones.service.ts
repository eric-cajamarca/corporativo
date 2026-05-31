import { Injectable, computed, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DashboardService } from './dashboard.service';
import { VehiculosService } from './vehiculos.service';
import { AuthService } from './auth.service';
import { NotificacionItem, NotificacionTipo } from '../models/notificacion.model';

const STORAGE_PREFIX = 'efaf_notif_leidas';
const LIMITE_DROPDOWN = 15;

@Injectable({
  providedIn: 'root'
})
export class NotificacionesService {
  private readonly _items = signal<NotificacionItem[]>([]);
  readonly items = this._items.asReadonly();
  readonly noLeidasCount = computed(() => this._items().filter((n) => !n.leido).length);

  private refrescando = false;

  constructor(
    private dashboardService: DashboardService,
    private vehiculosService: VehiculosService,
    private authService: AuthService
  ) {}

  refrescar(): void {
    const idEmpresa = this.authService.userData()?.idEmpresa;
    if (!idEmpresa || this.refrescando) {
      if (!idEmpresa) this._items.set([]);
      return;
    }

    this.refrescando = true;
    const leidas = this.cargarLeidas(String(idEmpresa));

    forkJoin({
      alertas: this.dashboardService.obtenerResumen('Este Mes').pipe(
        map((r) => (Array.isArray(r.data?.alertas) ? r.data!.alertas : [])),
        catchError(() => of([] as { titulo: string; mensaje: string; tipo: string; tiempo?: string }[]))
      ),
      soat: this.vehiculosService.listarVehiculosSoatVencido().pipe(
        map((r) => (Array.isArray(r?.data) ? r.data : [])),
        catchError(() => of([] as unknown[]))
      )
    }).subscribe({
      next: ({ alertas, soat }) => {
        this.refrescando = false;
        const list: NotificacionItem[] = [];

        alertas.forEach((a) => {
          const id = this.buildId('alerta', a.titulo, a.mensaje);
          list.push({
            id,
            titulo: a.titulo,
            mensaje: a.mensaje,
            tipo: this.mapTipo(a.tipo),
            fecha: this.parseFechaAlerta(a.tiempo),
            leido: leidas.has(id),
            ruta: this.rutaPorAlerta(a.titulo)
          });
        });

        if (soat.length > 0) {
          const id = 'soat-vencido';
          list.push({
            id,
            titulo: 'SOAT vencido',
            mensaje: `Tiene ${soat.length} vehículo(s) con SOAT vencido`,
            tipo: 'warning',
            fecha: new Date(),
            leido: leidas.has(id),
            ruta: undefined
          });
        }

        this._items.set(list.slice(0, LIMITE_DROPDOWN));
      },
      error: () => {
        this.refrescando = false;
      }
    });
  }

  marcarLeida(id: string): void {
    const idEmpresa = this.authService.userData()?.idEmpresa;
    if (!idEmpresa) return;

    const leidas = this.cargarLeidas(String(idEmpresa));
    leidas.add(id);
    this.guardarLeidas(String(idEmpresa), leidas);
    this._items.update((items) => items.map((n) => (n.id === id ? { ...n, leido: true } : n)));
  }

  marcarTodasLeidas(): void {
    const idEmpresa = this.authService.userData()?.idEmpresa;
    if (!idEmpresa) return;

    const leidas = this.cargarLeidas(String(idEmpresa));
    this._items().forEach((n) => leidas.add(n.id));
    this.guardarLeidas(String(idEmpresa), leidas);
    this._items.update((items) => items.map((n) => ({ ...n, leido: true })));
  }

  limpiar(): void {
    this._items.set([]);
  }

  private buildId(prefix: string, titulo: string, mensaje: string): string {
    return `${prefix}:${this.hashSimple(`${titulo}|${mensaje}`)}`;
  }

  private hashSimple(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  private mapTipo(tipo: string | undefined): NotificacionTipo {
    const t = String(tipo || 'info').toLowerCase();
    if (t === 'warning' || t === 'success' || t === 'error' || t === 'info' || t === 'danger') {
      return t;
    }
    return 'info';
  }

  private parseFechaAlerta(tiempo: string | undefined): Date {
    if (!tiempo || tiempo === 'Actual') return new Date();
    const parsed = Date.parse(tiempo);
    return Number.isNaN(parsed) ? new Date() : new Date(parsed);
  }

  private rutaPorAlerta(titulo: string): string {
    const t = String(titulo || '').toLowerCase();
    if (t.includes('stock')) return '/productos';
    if (t.includes('pago') || t.includes('crédito') || t.includes('credito')) return '/creditos';
    if (t.includes('vencer') || t.includes('venc')) return '/inventario/lotes';
    return '/home';
  }

  private storageKey(idEmpresa: string): string {
    return `${STORAGE_PREFIX}:${idEmpresa}`;
  }

  private cargarLeidas(idEmpresa: string): Set<string> {
    try {
      const raw = localStorage.getItem(this.storageKey(idEmpresa));
      if (!raw) return new Set<string>();
      const parsed = JSON.parse(raw) as unknown;
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      return new Set<string>();
    }
  }

  private guardarLeidas(idEmpresa: string, leidas: Set<string>): void {
    try {
      localStorage.setItem(this.storageKey(idEmpresa), JSON.stringify([...leidas]));
    } catch {
      /* quota / modo privado */
    }
  }
}
