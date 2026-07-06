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
    this.saasPublic
      .iniciarCheckout({
        planCode: this.planCode(),
        billingCycle: this.billingCycle(),
        emailContacto: this.emailPago || undefined
      })
      .subscribe({
        next: (data) => {
          this.checkout.set(data);
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
    const c = this.checkout();
    if (!c || c.esDemo) return;
    const pk = (c.culqiPublicKey || '').trim();
    if (!pk) {
      this.errorMsg.set(
        'No hay clave pública Culqi. Configure Culqi en la empresa principal (integraciones) y vuelva a intentar.'
      );
      return;
    }
    const email = (this.emailPago || '').trim();
    if (!email) {
      this.errorMsg.set('Ingrese su correo electrónico antes de abrir el pago.');
      return;
    }
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

    Culqi.publicKey = pk;
    Culqi.settings({
      title: 'Suscripción',
      currency: 'PEN',
      description: `Plan ${c.planCode} — ${c.orderNumber}`,
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
    const pk = (c.culqiPublicKey || '').trim();
    const email = (this.emailPago || 'cliente@empresa.com').trim();
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
   * Tras Culqi o demo confirmados en servidor: sesión iniciada → vincular en cuenta; si no → crear empresa.
   * El número de orden queda en BD; además guardamos respaldo en localStorage por si pierde la URL.
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
}
