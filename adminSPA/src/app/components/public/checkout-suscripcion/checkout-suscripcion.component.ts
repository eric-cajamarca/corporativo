import { Component, NgZone, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SaasPublicService } from '../../../services/saas-public.service';
import { DeploymentContextService } from '../../../services/deployment-context.service';
import { AuthService } from '../../../services/auth.service';
import { CheckoutIniciado } from '../../../models/saas-public.model';

type MedioPagoManual = 'yape' | 'plin' | 'bcp';
/** Canal principal: Culqi (tarjeta) o transferencia / Yape / Plin. */
type ViaPago = 'culqi' | 'manual';

const CULQI_SCRIPT_SRC = 'https://checkout.culqi.com/js/v4';
const CULQI_3DS_SCRIPT_SRC = 'https://3ds.culqi.com';
/** Respaldo si el usuario pierde la URL (p. ej. corte de luz); se limpia al registrar empresa. */
const LS_CHECKOUT_PENDIENTE = 'efaf_checkout_pendiente';

@Component({
  selector: 'app-checkout-suscripcion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './checkout-suscripcion.component.html',
  styleUrl: './checkout-suscripcion.component.css'
})
export class CheckoutSuscripcionComponent implements OnInit, OnDestroy {
  planCode = signal('');
  billingCycle = signal<string>('monthly');
  checkout = signal<CheckoutIniciado | null>(null);
  emailPago = '';
  /** Último token generado por Culqi Checkout (solo en memoria hasta enviar el cargo). */
  tokenCulqi = '';
  mensaje = signal<string | null>(null);
  errorMsg = signal<string | null>(null);
  procesando = signal(false);
  modoEnterprise = signal(false);
  /** Aceptación explícita de políticas legales (demo y planes de pago). */
  aceptoPoliticas = false;
  errorLegal = signal(false);
  /** Email inválido o vacío (requisito Culqi / pago manual). */
  errorEmail = signal(false);
  /** Culqi primero; el otro checkbox agrupa Yape / Plin / BCP. */
  viaPago: ViaPago = 'culqi';
  /** Medio elegido dentro del pago manual. */
  medioPagoManual: MedioPagoManual = 'yape';
  referenciaPago = '';
  /** Tras reportar pago manual: mostrar instrucciones WhatsApp. */
  pagoManualReportado = signal(false);
  /** Huella de dispositivo (Culqi3DS) enviada en antifraud_details al crear el cargo. */
  deviceFingerPrintId = '';
  /** Evita cargar el script dos veces. */
  private culqiScriptPromise: Promise<void> | null = null;
  private culqi3dsScriptPromise: Promise<void> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private saasPublic: SaasPublicService,
    private deployment: DeploymentContextService,
    private auth: AuthService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.deployment.cargarSiNecesario().subscribe((cfg) => {
      if (!cfg?.mostrarPlanesPublicos) {
        this.modoEnterprise.set(true);
        return;
      }
      const plan = (this.route.snapshot.paramMap.get('planCode') || '').toLowerCase();
      this.planCode.set(plan);
      const billing = (this.route.snapshot.queryParamMap.get('billing') || 'monthly').toLowerCase();
      this.billingCycle.set(billing === 'none' || billing === 'yearly' || billing === 'monthly' ? billing : 'monthly');
      this.iniciar();
    });
  }

  ngOnDestroy(): void {
    window.culqi = undefined;
    window.Culqi3DS?.reset?.();
  }

  iniciar(): void {
    this.procesando.set(true);
    this.errorMsg.set(null);
    this.mensaje.set(null);
    this.tokenCulqi = '';
    this.saasPublic
      .iniciarCheckout({
        planCode: this.planCode(),
        billingCycle: this.billingCycle(),
        emailContacto: (this.emailPago || '').trim() || undefined
      })
      .subscribe({
        next: (data) => {
          this.checkout.set(data);
          this.billingCycle.set(
            data.billingCycle === 'none' || data.billingCycle === 'yearly' || data.billingCycle === 'monthly'
              ? data.billingCycle
              : this.billingCycle()
          );
          // Culqi primero en la UI; si no hay clave, dejar seleccionado el pago manual.
          this.viaPago = data.culqiPublicKey || data.culqiDisponible ? 'culqi' : 'manual';
          this.procesando.set(false);
          if (data.esDemo) {
            this.mensaje.set('Checkout demo listo. Confirme para obtener el número de orden y registrar su empresa.');
          }
        },
        error: (err) => {
          this.procesando.set(false);
          this.errorMsg.set(err?.error?.message || 'No se pudo iniciar el pago.');
        }
      });
  }

  /** Cambia mensual/anual y recrea la orden (monto Culqi debe coincidir con el catálogo). */
  cambiarCiclo(ciclo: 'monthly' | 'yearly'): void {
    const c = this.checkout();
    if (c?.esDemo || this.procesando() || this.pagoManualReportado()) return;
    if (this.billingCycle() === ciclo) return;
    this.billingCycle.set(ciclo);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { billing: ciclo },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.checkout.set(null);
    this.pagoManualReportado.set(false);
    this.iniciar();
  }

  reportarPagoManual(): void {
    if (!this.validarAceptacionLegal()) return;
    if (!this.validarEmailPago()) return;
    const c = this.checkout();
    if (!c || c.esDemo) return;
    this.procesando.set(true);
    this.errorMsg.set(null);
    this.saasPublic
      .reportarPagoManual({
        orderNumber: c.orderNumber,
        medioPago: this.medioPagoManual,
        email: (this.emailPago || '').trim(),
        referencia: (this.referenciaPago || '').trim() || undefined
      })
      .subscribe({
        next: (data) => {
          this.procesando.set(false);
          this.pagoManualReportado.set(true);
          if (data?.pagoManual && this.checkout()) {
            this.checkout.set({ ...this.checkout()!, pagoManual: data.pagoManual });
          }
          this.mensaje.set(
            'Orden registrada. Abriremos WhatsApp para el voucher y lo llevaremos al siguiente paso.'
          );
          try {
            window.localStorage.setItem(
              LS_CHECKOUT_PENDIENTE,
              JSON.stringify({ orderNumber: c.orderNumber, savedAt: Date.now() })
            );
          } catch {
            /* ignore */
          }
          // Voucher primero; luego mismo destino que Culqi (sesión → Mi suscripción / sin sesión → crear empresa).
          this.abrirWhatsAppVoucher();
          window.setTimeout(() => {
            void this.redirigirPostCheckoutPagado();
          }, 450);
        },
        error: (err) => {
          this.procesando.set(false);
          this.errorMsg.set(err?.error?.message || 'No se pudo registrar el pago manual.');
        }
      });
  }

  /** Abre WhatsApp con el texto del voucher / orden. */
  abrirWhatsAppVoucher(): void {
    const c = this.checkout();
    if (!c) return;
    const pm = c.pagoManual;
    const wa = pm?.whatsappE164 || '';
    if (!wa) return;
    const ciclo = this.etiquetaCiclo(c.billingCycle);
    const medio =
      this.medioPagoManual === 'yape' ? 'Yape' : this.medioPagoManual === 'plin' ? 'Plin' : 'Depósito BCP';
    const texto = [
      'Hola, envié el voucher de pago de suscripción Business Soft.',
      `Orden: ${c.orderNumber}`,
      `Plan: ${c.planCode}`,
      `Ciclo: ${ciclo}`,
      `Monto: S/ ${Number(c.montoSoles).toFixed(2)}`,
      `Medio: ${medio}`,
      `Correo: ${(this.emailPago || '').trim()}`,
      this.referenciaPago.trim() ? `Referencia/N° operación: ${this.referenciaPago.trim()}` : null,
      '',
      'Adjunto el voucher para validación. Gracias.'
    ]
      .filter((x) => x !== null)
      .join('\n');
    const url = `https://wa.me/${wa}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank', 'noopener');
  }

  culqiDisponible(): boolean {
    const c = this.checkout();
    return Boolean(c?.culqiPublicKey || c?.culqiDisponible);
  }

  etiquetaCiclo(ciclo: string | null | undefined): string {
    if (ciclo === 'yearly' || ciclo === 'anual') return 'Anual';
    if (ciclo === 'none') return 'Demo';
    return 'Mensual';
  }

  /** Email con formato básico listo para Culqi (botón pagar). */
  emailListo(): boolean {
    return this.esEmailValido(this.emailPago);
  }

  private esEmailValido(valor: string): boolean {
    const email = (valor || '').trim();
    if (!email || email.length > 80) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  confirmarDemo(): void {
    if (!this.validarAceptacionLegal()) return;
    const c = this.checkout();
    if (!c?.orderNumber) return;
    this.procesando.set(true);
    this.saasPublic.confirmarDemo(c.orderNumber).subscribe({
      next: async () => {
        try {
          await this.redirigirPostCheckoutPagado();
        } catch {
          this.procesando.set(false);
        }
      },
      error: (err) => {
        this.procesando.set(false);
        this.errorMsg.set(err?.error?.message || 'Error al activar demo.');
      }
    });
  }

  /**
   * Carga Culqi Checkout v4 y abre el modal seguro para ingresar tarjeta.
   * El PAN no pasa por nuestro servidor; Culqi devuelve un token (`tkn_...`) en el callback global `culqi`.
   */
  async abrirCulqiCheckout(): Promise<void> {
    if (!this.validarAceptacionLegal()) return;
    if (!this.validarEmailPago()) {
      this.enfocarCorreoPagador();
      return;
    }
    const c = this.checkout();
    if (!c || c.esDemo) return;
    const pk = (c.culqiPublicKey || '').trim();
    if (!pk) {
      this.errorMsg.set(
        'El pago con tarjeta no está disponible en este momento. Use Yape o depósito, o intente más tarde.'
      );
      return;
    }
    const email = (this.emailPago || '').trim();
    this.errorMsg.set(null);
    try {
      await this.cargarScriptCulqi();
    } catch {
      this.errorMsg.set('No se pudo cargar el formulario de Culqi. Revise su conexión o el bloqueo del navegador.');
      return;
    }

    this.deviceFingerPrintId = '';
    try {
      await this.cargarScriptCulqi3ds();
      const C3 = window.Culqi3DS;
      if (C3) {
        C3.publicKey = pk;
        const devId = await C3.generateDevice();
        if (devId) {
          this.deviceFingerPrintId = devId;
        }
      }
    } catch {
      /* Sin device el cargo puede seguir; Culqi puede exigir 3DS adicional */
    }

    const Culqi = window.Culqi;
    if (!Culqi) {
      this.errorMsg.set('Culqi no está disponible en el navegador.');
      return;
    }

    const cicloLabel = this.etiquetaCiclo(c.billingCycle);
    Culqi.publicKey = pk;
    Culqi.settings({
      title: 'Suscripción Business Soft',
      currency: 'PEN',
      description: `Plan ${c.planCode} (${cicloLabel}) — ${c.orderNumber}`,
      amount: Math.max(0, Math.round(Number(c.montoCulqiCentimos) || 0))
    });
    Culqi.options({
      lang: 'es',
      installments: false,
      paymentMethods: {
        tarjeta: true,
        yape: false,
        bancaMovil: false,
        agente: false,
        billetera: false,
        cuotealo: false
      }
    });

    const self = this;
    window.culqi = () => {
      self.ngZone.run(() => {
        const Cq = window.Culqi;
        if (!Cq) return;
        if (Cq.token?.id) {
          self.tokenCulqi = Cq.token.id;
          Cq.close();
          self.confirmarCulqi();
        } else if (Cq.error) {
          Cq.close();
          const msg =
            Cq.error.user_message || Cq.error.merchant_message || 'No se pudo tokenizar la tarjeta.';
          self.errorMsg.set(msg);
        }
      });
    };

    Culqi.open();
  }

  private cargarScriptCulqi(): Promise<void> {
    if (window.Culqi) {
      return Promise.resolve();
    }
    if (!this.culqiScriptPromise) {
      this.culqiScriptPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${CULQI_SCRIPT_SRC}"]`);
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('script')), { once: true });
          return;
        }
        const s = document.createElement('script');
        s.src = CULQI_SCRIPT_SRC;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('script'));
        document.body.appendChild(s);
      });
    }
    return this.culqiScriptPromise;
  }

  private cargarScriptCulqi3ds(): Promise<void> {
    if (window.Culqi3DS) {
      return Promise.resolve();
    }
    if (!this.culqi3dsScriptPromise) {
      this.culqi3dsScriptPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${CULQI_3DS_SCRIPT_SRC}"]`);
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('script3ds')), { once: true });
          return;
        }
        const s = document.createElement('script');
        s.src = CULQI_3DS_SCRIPT_SRC;
        s.defer = true;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('script3ds'));
        document.body.appendChild(s);
      });
    }
    return this.culqi3dsScriptPromise;
  }

  confirmarCulqi(): void {
    void this.procesarConfirmacionCulqi();
  }

  /**
   * 1) Primer cargo en backend (token + antifraud).
   * 2) Si Culqi responde REQUIERE_3DS: Culqi3DS.settings + initAuthentication(token) y postMessage parameters3DS.
   * 3) Segundo cargo con authentication3DS (mismo token y device_finger_print_id).
   * @see https://github.com/culqi/culqi-php-demo-jsv4-culqi3ds/blob/master/js/main.js
   */
  private async procesarConfirmacionCulqi(): Promise<void> {
    const c = this.checkout();
    if (!c?.orderNumber || !this.tokenCulqi.trim()) {
      this.errorMsg.set('Complete el pago en el formulario de Culqi (token no recibido).');
      return;
    }
    if (!this.validarEmailPago()) return;
    const pk = (c.culqiPublicKey || '').trim();
    const email = (this.emailPago || '').trim();
    const tokenId = this.tokenCulqi.trim();
    const amountCentimos = Math.max(0, Math.round(Number(c.montoCulqiCentimos) || 0));

    this.procesando.set(true);
    this.errorMsg.set(null);

    const payloadBase = {
      orderNumber: c.orderNumber,
      tokenId,
      email,
      deviceFingerPrintId: this.deviceFingerPrintId || undefined
    };

    try {
      await firstValueFrom(this.saasPublic.confirmarCulqi(payloadBase));
      await this.redirigirPostCheckoutPagado();
    } catch (err: unknown) {
      if (!(err instanceof HttpErrorResponse) || err.status !== 409 || err.error?.code !== 'REQUIERE_3DS') {
        this.ngZone.run(() => {
          this.procesando.set(false);
          const msg =
            err instanceof HttpErrorResponse
              ? err.error?.message || err.message
              : 'Culqi rechazó el cargo.';
          this.errorMsg.set(msg || 'Culqi rechazó el cargo.');
        });
        return;
      }

      try {
        await this.cargarScriptCulqi3ds();
        const C3 = window.Culqi3DS;
        if (!C3 || !pk) {
          throw new Error('Culqi3DS no disponible');
        }
        C3.publicKey = pk;
        C3.options = {
          showModal: true,
          showLoading: true,
          showIcon: true,
          closeModalAction: () => {
            window.Culqi3DS?.reset?.();
          }
        };
        C3.settings = {
          charge: {
            totalAmount: amountCentimos,
            returnUrl: this.construirReturnUrl3ds()
          },
          card: { email }
        };

        const parameters3DS = await this.esperar3dsYAutenticar(C3, tokenId);

        await firstValueFrom(
          this.saasPublic.confirmarCulqi({
            ...payloadBase,
            authentication3DS: parameters3DS
          })
        );
        await this.redirigirPostCheckoutPagado();
      } catch (e2: unknown) {
        this.ngZone.run(() => {
          this.procesando.set(false);
          const m =
            e2 instanceof HttpErrorResponse
              ? e2.error?.message || e2.message
              : e2 instanceof Error
                ? e2.message
                : 'No se completó la autenticación 3D Secure.';
          this.errorMsg.set(m);
        });
        window.Culqi3DS?.reset?.();
      }
    }
  }

  /**
   * Tras Culqi, demo o pago manual reportado: sesión → Mi suscripción; si no → crear empresa.
   * El número de orden queda en BD y en query (?checkout=); localStorage como respaldo.
   */
  private async redirigirPostCheckoutPagado(): Promise<void> {
    const order = (this.checkout()?.orderNumber || '').trim();
    let autenticado = false;
    try {
      autenticado = await firstValueFrom(this.auth.verifyToken());
    } catch {
      autenticado = this.auth.isAuthenticated();
    }

    if (order) {
      try {
        window.localStorage.setItem(LS_CHECKOUT_PENDIENTE, JSON.stringify({ orderNumber: order, savedAt: Date.now() }));
      } catch {
        /* almacenamiento lleno o modo privado */
      }
    }

    this.ngZone.run(() => {
      this.procesando.set(false);
      this.tokenCulqi = '';
      this.deviceFingerPrintId = '';
      this.mensaje.set(null);
    });
    window.Culqi3DS?.reset?.();

    if (!order) {
      return;
    }

    if (autenticado) {
      await this.router.navigate(['/cuenta', 'suscripcion'], { queryParams: { checkout: order } });
    } else {
      await this.router.navigate(['/crear-empresa'], { queryParams: { checkout: order } });
    }
  }

  /** Continuar manualmente tras reportar pago (si el usuario se quedó en la pantalla). */
  continuarTrasPagoManual(): void {
    void this.redirigirPostCheckoutPagado();
  }

  private construirReturnUrl3ds(): string {
    const u = new URL(window.location.href);
    u.hash = '';
    return u.toString();
  }

  /**
   * Registra el listener postMessage (mismo origen que el demo oficial) y ejecuta initAuthentication.
   */
  private async esperar3dsYAutenticar(
    C3: NonNullable<typeof window.Culqi3DS>,
    tokenId: string
  ): Promise<Record<string, unknown>> {
    const TIMEOUT_MS = 10 * 60 * 1000;
    let onMsg: ((event: MessageEvent) => void) | null = null;
    let to: number | undefined;
    const cancel = () => {
      if (to !== undefined) {
        window.clearTimeout(to);
        to = undefined;
      }
      if (onMsg) {
        window.removeEventListener('message', onMsg);
        onMsg = null;
      }
    };

    const parametersPromise = new Promise<Record<string, unknown>>((resolve, reject) => {
      to = window.setTimeout(() => {
        cancel();
        reject(new Error('Tiempo agotado en la autenticación 3D Secure. Intente de nuevo.'));
      }, TIMEOUT_MS);

      onMsg = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return;
        }
        const data = event.data as { parameters3DS?: Record<string, unknown>; error?: unknown } | undefined;
        if (!data || typeof data !== 'object') {
          return;
        }
        if (data.error !== undefined && data.error !== null) {
          cancel();
          const errText =
            typeof data.error === 'string'
              ? data.error
              : (data.error as { user_message?: string })?.user_message || 'Error en 3D Secure';
          reject(new Error(errText));
          return;
        }
        if (data.parameters3DS && typeof data.parameters3DS === 'object' && !Array.isArray(data.parameters3DS)) {
          cancel();
          resolve(data.parameters3DS);
        }
      };
      window.addEventListener('message', onMsg);
    });

    try {
      await C3.initAuthentication(tokenId);
      return await parametersPromise;
    } catch (e) {
      cancel();
      throw e;
    }
  }

  irCrearEmpresa(): void {
    if (!this.validarAceptacionLegal()) return;
    const c = this.checkout();
    const q = c?.orderNumber ? { checkout: c.orderNumber } : {};
    void this.router.navigate(['/crear-empresa'], { queryParams: q });
  }

  volverPlanes(): void {
    void this.router.navigate(['/planes']);
  }

  /** Obligatorio para demo (sin Culqi) y para planes de pago. */
  private validarAceptacionLegal(): boolean {
    if (this.aceptoPoliticas) {
      this.errorLegal.set(false);
      return true;
    }
    this.errorLegal.set(true);
    this.errorMsg.set(null);
    return false;
  }

  /** Culqi exige email válido en el cargo (sin placeholders). */
  private validarEmailPago(): boolean {
    if (this.esEmailValido(this.emailPago)) {
      this.errorEmail.set(false);
      return true;
    }
    this.errorEmail.set(true);
    this.errorMsg.set('Ingrese un correo válido del pagador para continuar con Culqi.');
    return false;
  }

  private enfocarCorreoPagador(): void {
    queueMicrotask(() => {
      const el = document.getElementById('emailPagoCulqi') as HTMLInputElement | null;
      el?.focus();
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
}
