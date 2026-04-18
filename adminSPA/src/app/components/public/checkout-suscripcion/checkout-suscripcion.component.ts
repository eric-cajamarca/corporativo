import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SaasPublicService } from '../../../services/saas-public.service';
import { DeploymentContextService } from '../../../services/deployment-context.service';
import { CheckoutIniciado } from '../../../models/saas-public.model';

@Component({
  selector: 'app-checkout-suscripcion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './checkout-suscripcion.component.html',
  styleUrl: './checkout-suscripcion.component.css'
})
export class CheckoutSuscripcionComponent implements OnInit {
  planCode = signal('');
  billingCycle = signal<string>('monthly');
  checkout = signal<CheckoutIniciado | null>(null);
  emailPago = '';
  tokenCulqi = '';
  mensaje = signal<string | null>(null);
  errorMsg = signal<string | null>(null);
  procesando = signal(false);
  modoEnterprise = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private saasPublic: SaasPublicService,
    private deployment: DeploymentContextService
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
    const c = this.checkout();
    if (!c?.orderNumber) return;
    this.procesando.set(true);
    this.saasPublic.confirmarDemo(c.orderNumber).subscribe({
      next: () => {
        this.procesando.set(false);
        this.mensaje.set('Demo activada. Guarde su número de orden y use “Crear empresa” con ese dato, o pague un plan cuando quiera.');
      },
      error: (err) => {
        this.procesando.set(false);
        this.errorMsg.set(err?.error?.message || 'Error al activar demo.');
      }
    });
  }

  confirmarCulqi(): void {
    const c = this.checkout();
    if (!c?.orderNumber || !this.tokenCulqi.trim()) {
      this.errorMsg.set('Ingrese el token de tarjeta (Culqi.js) y el correo.');
      return;
    }
    this.procesando.set(true);
    this.errorMsg.set(null);
    this.saasPublic
      .confirmarCulqi({
        orderNumber: c.orderNumber,
        tokenId: this.tokenCulqi.trim(),
        email: (this.emailPago || 'cliente@empresa.com').trim()
      })
      .subscribe({
        next: () => {
          this.procesando.set(false);
          this.mensaje.set('Pago registrado. Cree su empresa o vincule este pago desde su cuenta (orderNumber guardado).');
        },
        error: (err) => {
          this.procesando.set(false);
          this.errorMsg.set(err?.error?.message || 'Culqi rechazó el cargo.');
        }
      });
  }

  irCrearEmpresa(): void {
    const c = this.checkout();
    const q = c?.orderNumber ? { checkout: c.orderNumber } : {};
    void this.router.navigate(['/crear-empresa'], { queryParams: q });
  }

  volverPlanes(): void {
    void this.router.navigate(['/planes']);
  }
}
