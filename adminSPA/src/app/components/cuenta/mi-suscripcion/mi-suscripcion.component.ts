import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { SaasSubscriptionService } from '../../../services/saas-subscription.service';
import { LimitesUsoSuscripcion, MiEstadoSuscripcionResponse } from '../../../models/saas-subscription.model';
import { SuscripcionEmpresaRow } from '../../../models/saas-public.model';

/** Días antes del vencimiento en que se ofrece pagar la renovación. */
const DIAS_AVISO_VENCIMIENTO = 5;

/** Códigos que no corresponden a un plan cobrable en el checkout. */
const PLANES_SIN_RENOVACION = new Set(['demo', 'enterprise', 'pendiente']);

@Component({
  selector: 'app-mi-suscripcion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './mi-suscripcion.component.html',
  styleUrl: './mi-suscripcion.component.css'
})
export class MiSuscripcionComponent implements OnInit {
  sidebarState = inject(SidebarStateService);
  estado = signal<MiEstadoSuscripcionResponse | null>(null);
  cargando = signal(true);
  errorMsg = signal<string | null>(null);
  vinculoMsg = signal<string | null>(null);
  /** true = mensaje de éxito (estilo verde). */
  vinculoOk = signal(false);
  orderNumber = '';
  vinculando = signal(false);
  cancelandoDowngrade = signal(false);
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

  maxProductos(lim: LimitesUsoSuscripcion | null | undefined): number {
    const n = Number(lim?.maxProductosActivos);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

  usadoProductos(lim: LimitesUsoSuscripcion | null | undefined): number {
    const n = Number(lim?.productosActivos);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

  claseBarraUso(actual: number, maximo: number): string {
    if (!maximo || maximo <= 0) return 'bg-primary';
    if (actual > maximo) return 'bg-danger';
    return 'bg-primary';
  }

  claseBarraSunat(actual: number, maximo: number): string {
    if (!maximo || maximo <= 0) return 'bg-primary';
    if (actual >= maximo) return 'bg-danger';
    if (actual / maximo >= 0.9) return 'bg-warning';
    return 'bg-primary';
  }

  avisoComprobantes90(lim: LimitesUsoSuscripcion | null | undefined): boolean {
    const max = this.maxComprobantesSunat(lim);
    const usado = this.usadoComprobantesSunat(lim);
    if (max <= 0) return false;
    return usado / max >= 0.9 && usado < max;
  }

  agotadosComprobantesSunat(lim: LimitesUsoSuscripcion | null | undefined): boolean {
    const max = this.maxComprobantesSunat(lim);
    return max > 0 && this.usadoComprobantesSunat(lim) >= max;
  }

  restantesComprobantesSunat(lim: LimitesUsoSuscripcion | null | undefined): number {
    return Math.max(0, this.maxComprobantesSunat(lim) - this.usadoComprobantesSunat(lim));
  }

  vincular(): void {
    const on = this.orderNumber.trim();
    if (!on) {
      this.vinculoOk.set(false);
      this.vinculoMsg.set('Ingrese el número de orden (CHK-…).');
      return;
    }
    this.vinculando.set(true);
    this.vinculoMsg.set(null);
    this.vinculoOk.set(false);
    this.saas.vincularCheckout(on).subscribe({
      next: () => {
        this.vinculando.set(false);
        this.orderNumber = '';
        this.vinculoOk.set(true);
        this.vinculoMsg.set('Suscripción vinculada correctamente.');
        void this.router.navigate(['/cuenta', 'suscripcion'], { replaceUrl: true });
        this.cargar(false);
      },
      error: (err) => {
        this.vinculando.set(false);
        this.vinculoOk.set(false);
        const code = err?.error?.message as string | undefined;
        const detail = (err?.error?.detail as string | undefined) || '';
        if (code === 'CHECKOUT_NO_PAGADO' && detail) {
          this.vinculoMsg.set(detail);
        } else if (code === 'CHECKOUT_YA_VINCULADO') {
          this.vinculoMsg.set(detail || 'Esa orden ya está vinculada a otra empresa.');
        } else if (code === 'CHECKOUT_NO_ENCONTRADO') {
          this.vinculoMsg.set(detail || 'No se encontró esa orden de pago.');
        } else {
          this.vinculoMsg.set(
            'No se pudo vincular. Si pagó con Yape/Plin/BCP y el estado es PENDIENTE_VALIDACION, la plataforma debe confirmar el voucher primero.'
          );
        }
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

  /** 'YYYY-MM-DD HH:mm:ss' del backend; el espacio rompe Date en algunos navegadores. */
  private aFecha(valor: string | null | undefined): Date | null {
    const v = String(valor || '').trim();
    if (!v) return null;
    const d = new Date(v.replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  fechaCorta(valor: string | null | undefined): string {
    const d = this.aFecha(valor);
    return d ? d.toLocaleDateString('es-PE') : '—';
  }

  /** Días hasta el fin de vigencia; negativo si ya venció. null si no hay fecha. */
  diasParaVencer(): number | null {
    const fin = this.aFecha(this.estado()?.suscripcion?.fechaFin);
    if (!fin) return null;
    const hoy = new Date();
    const finDia = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
    const hoyDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    return Math.round((finDia.getTime() - hoyDia.getTime()) / 86400000);
  }

  private esSaas(): boolean {
    return (this.estado()?.deploymentMode || '').trim().toLowerCase() === 'saas';
  }

  suscripcionVencida(): boolean {
    const s = this.estado()?.suscripcion;
    if (!s) return false;
    const st = (s.estado || '').trim().toUpperCase();
    if (st === 'VENCIDA') return true;
    const dias = this.diasParaVencer();
    return (st === 'ACTIVA' || st === 'DEMO') && dias != null && dias < 0;
  }

  private pendienteDePago(): boolean {
    return (this.estado()?.suscripcion?.estado || '').trim().toUpperCase() === 'PENDIENTE_PAGO';
  }

  private porVencerPronto(): boolean {
    if (this.suscripcionVencida()) return false;
    const dias = this.diasParaVencer();
    return dias != null && dias >= 0 && dias <= DIAS_AVISO_VENCIMIENTO;
  }

  /** Aviso de pago en el resumen: vencida, por vencer o pendiente de pago. */
  mostrarLlamadaPago(): boolean {
    if (!this.esSaas() || !this.estado()?.suscripcion) return false;
    return this.suscripcionVencida() || this.porVencerPronto() || this.pendienteDePago();
  }

  urgentePago(): boolean {
    return this.suscripcionVencida() || this.pendienteDePago();
  }

  /**
   * Demo, enterprise y el marcador 'pendiente' (empresa sin contrato) no son
   * planes cobrables: en esos casos el cliente debe elegir plan en el catálogo.
   */
  planRenovablePorCheckout(): boolean {
    const code = (this.estado()?.suscripcion?.planCode || '').trim().toLowerCase();
    if (!code || PLANES_SIN_RENOVACION.has(code)) return false;
    return this.esSaas();
  }

  /**
   * El pago recalcula la vigencia desde la fecha de pago, así que solo se ofrece
   * renovar dentro de la ventana de vencimiento: pagar muy anticipado perdería
   * los días restantes del período en curso.
   */
  mostrarBotonRenovar(): boolean {
    return this.planRenovablePorCheckout() && this.mostrarLlamadaPago();
  }

  tituloLlamadaPago(): string {
    if (this.pendienteDePago()) return 'Pago pendiente';
    if (this.suscripcionVencida()) return 'Su suscripción está vencida';
    const dias = this.diasParaVencer();
    if (dias === 0) return 'Su plan vence hoy';
    if (dias === 1) return 'Su plan vence mañana';
    return `Su plan vence en ${dias} días`;
  }

  detalleLlamadaPago(): string {
    const s = this.estado()?.suscripcion;
    if (this.pendienteDePago()) {
      return 'Complete el pago o vincule la orden que recibió al contratar.';
    }
    if (this.suscripcionVencida()) {
      return `Venció el ${this.fechaCorta(s?.fechaFin)}. Pague la renovación para restablecer el acceso completo.`;
    }
    return `Vence el ${this.fechaCorta(s?.fechaFin)}. Renueve para no interrumpir ventas ni facturación electrónica.`;
  }

  /** Precio del plan vigente según su ciclo; 0 si el catálogo no lo informa. */
  montoRenovacion(): number {
    const e = this.estado();
    const plan = e?.planCatalogo;
    if (!plan) return 0;
    const n = this.cicloParaPago() === 'yearly' ? plan.precioAnualPen : plan.precioMensualPen;
    return Number.isFinite(Number(n)) ? Number(n) : 0;
  }

  etiquetaBotonPago(): string {
    const monto = this.montoRenovacion();
    if (monto <= 0) return 'Pagar y renovar';
    const txt = Number.isInteger(monto) ? String(monto) : monto.toFixed(2);
    return `Pagar S/ ${txt}`;
  }

  private cicloParaPago(): 'monthly' | 'yearly' {
    const c = (this.estado()?.suscripcion?.billingCycle || '').trim().toLowerCase();
    return c === 'yearly' ? 'yearly' : 'monthly';
  }

  /**
   * Renovar el mismo plan sin pasar por el catálogo ni cambiar de plan.
   * Demo/enterprise no tienen renovación por checkout: van al catálogo.
   */
  irAPagarRenovacion(): void {
    const plan = (this.estado()?.suscripcion?.planCode || '').trim();
    if (!this.planRenovablePorCheckout() || !plan) {
      void this.router.navigate(['/planes']);
      return;
    }
    void this.router.navigate(['/suscribirse', plan], {
      queryParams: { billing: this.cicloParaPago() }
    });
  }

  cancelarDowngradeProgramado(): void {
    this.cancelandoDowngrade.set(true);
    this.errorMsg.set(null);
    this.saas.cancelarDowngrade().subscribe({
      next: () => {
        this.cancelandoDowngrade.set(false);
        this.vinculoOk.set(true);
        this.vinculoMsg.set('Cambio de plan programado cancelado.');
        this.cargar(false);
      },
      error: (err) => {
        this.cancelandoDowngrade.set(false);
        this.errorMsg.set(err?.error?.message || 'No se pudo cancelar el cambio programado.');
      }
    });
  }
}
