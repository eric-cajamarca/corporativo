import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { SaasSubscriptionService } from '../../../services/saas-subscription.service';
import { LimitesUsoSuscripcion, MiEstadoSuscripcionResponse } from '../../../models/saas-subscription.model';
import { SuscripcionEmpresaRow } from '../../../models/saas-public.model';

@Component({
  selector: 'app-mi-suscripcion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TopnavComponent, SidebarComponent],
  templateUrl: './mi-suscripcion.component.html',
  styleUrl: './mi-suscripcion.component.css'
})
export class MiSuscripcionComponent implements OnInit {
  sidebarState = inject(SidebarStateService);
  estado = signal<MiEstadoSuscripcionResponse | null>(null);
  cargando = signal(true);
  errorMsg = signal<string | null>(null);
  vinculoMsg = signal<string | null>(null);
  orderNumber = '';
  vinculando = signal(false);
  /** Evita doble auto-vinculación al recargar tras éxito. */
  private autoVinculoEjecutado = false;

  constructor(
    private readonly saas: SaasSubscriptionService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const ch = (this.route.snapshot.queryParamMap.get('checkout') || '').trim();
    if (ch) {
      this.orderNumber = ch;
    }
    this.cargar(!!ch);
  }

  /**
   * @param intentarVinculoCheckoutTrasCarga Si viene ?checkout=CHK-… tras Culqi (p. ej. desde demo → plan de pago), vincular solo en servidor.
   */
  cargar(intentarVinculoCheckoutTrasCarga = false): void {
    this.cargando.set(true);
    this.errorMsg.set(null);
    this.saas.getMiEstado().subscribe({
      next: (r) => {
        this.estado.set(r);
        this.cargando.set(false);
        if (
          intentarVinculoCheckoutTrasCarga &&
          !this.autoVinculoEjecutado &&
          r.deploymentMode === 'saas' &&
          this.orderNumber.trim()
        ) {
          this.intentarVinculoAutomatico();
        }
      },
      error: () => {
        this.cargando.set(false);
        this.errorMsg.set('No se pudo cargar el estado de la suscripción.');
      }
    });
  }

  /**
   * Tras pagar en Culqi el backend solo marca SuscripcionCheckoutPendiente como PAGADO;
   * EmpresaSuscripcion se actualiza aquí. Antes el formulario "Vincular" solo se mostraba en PENDIENTE_PAGO,
   * no en DEMO: las cuentas demo nunca vinculaban y el plan quedaba en demo.
   */
  private intentarVinculoAutomatico(): void {
    this.autoVinculoEjecutado = true;
    const on = this.orderNumber.trim();
    this.vinculando.set(true);
    this.vinculoMsg.set(null);
    this.saas.vincularCheckout(on).subscribe({
      next: () => {
        this.vinculando.set(false);
        this.orderNumber = '';
        this.vinculoMsg.set('Plan actualizado correctamente con su pago.');
        void this.router.navigate(['/cuenta', 'suscripcion'], { replaceUrl: true });
        this.cargar(false);
      },
      error: () => {
        this.vinculando.set(false);
        this.autoVinculoEjecutado = false;
        this.vinculoMsg.set(
          'No se pudo aplicar el pago automáticamente. Verifique que el número de orden sea el correcto y use «Vincular pago».'
        );
      }
    });
  }

  pctUso(actual: number, maximo: number): number {
    if (!maximo || maximo <= 0) return 0;
    return Math.min(100, Math.round((100 * actual) / maximo));
  }

  maxComprobantesSunat(lim: LimitesUsoSuscripcion | null | undefined): number {
    const n = Number(lim?.maxComprobantesSunatAceptados);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

  usadoComprobantesSunat(lim: LimitesUsoSuscripcion | null | undefined): number {
    const n = Number(lim?.comprobantesSunatAceptados);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

  vincular(): void {
    const on = this.orderNumber.trim();
    if (!on) {
      this.vinculoMsg.set('Ingrese el número de orden (CHK-…).');
      return;
    }
    this.vinculando.set(true);
    this.vinculoMsg.set(null);
    this.saas.vincularCheckout(on).subscribe({
      next: () => {
        this.vinculando.set(false);
        this.orderNumber = '';
        this.vinculoMsg.set('Suscripción vinculada correctamente.');
        void this.router.navigate(['/cuenta', 'suscripcion'], { replaceUrl: true });
        this.cargar(false);
      },
      error: () => {
        this.vinculando.set(false);
        this.vinculoMsg.set('No se pudo vincular. Verifique el número de orden o que el pago esté confirmado.');
      }
    });
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }

  etiquetaCiclo(ciclo: string | null | undefined): string {
    const c = (ciclo || '').trim().toLowerCase();
    if (!c || c === 'none') return '—';
    if (c === 'monthly') return 'Mensual';
    if (c === 'yearly') return 'Anual';
    return ciclo || '—';
  }

  /** "Ver planes" solo cuando aún no hay contrato (pendiente de pago); si ya hay plan (demo, activa, etc.) → actualizar. */
  etiquetaBotonPlanes(s: SuscripcionEmpresaRow | null | undefined): string {
    const st = (s?.estado || '').trim().toUpperCase();
    if (!s || st === 'PENDIENTE_PAGO') {
      return 'Ver planes';
    }
    return 'Actualizar plan';
  }
}
