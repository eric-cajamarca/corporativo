import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { catchError, take } from 'rxjs/operators';
import { SaasPublicService } from '../../../services/saas-public.service';
import { SaasSubscriptionService } from '../../../services/saas-subscription.service';
import { AuthService } from '../../../services/auth.service';
import { DeploymentContextService } from '../../../services/deployment-context.service';
import { PlanCatalogoItem } from '../../../models/saas-public.model';

type EdicionPlan = {
  descripcionCorta: string;
  precioMensualPen: number;
  precioAnualPen: number;
  maxUsuarios: number;
  maxSucursales: number;
};

@Component({
  selector: 'app-planes-public',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './planes-public.component.html',
  styleUrl: './planes-public.component.css'
})
export class PlanesPublicComponent implements OnInit {
  planes = signal<PlanCatalogoItem[]>([]);
  ciclo = signal<'monthly' | 'yearly'>('monthly');
  cargando = signal(true);
  errorMsg = signal<string | null>(null);
  modoEnterprise = signal(false);
  puedeEditar = signal(false);
  edicion = signal<Record<string, EdicionPlan>>({});
  guardandoPlan = signal<string | null>(null);

  constructor(
    private saasPublic: SaasPublicService,
    private saasSubscription: SaasSubscriptionService,
    private auth: AuthService,
    private deployment: DeploymentContextService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.deployment.cargarSiNecesario().subscribe((cfg) => {
      if (!cfg?.mostrarPlanesPublicos) {
        this.modoEnterprise.set(true);
        this.cargando.set(false);
        return;
      }
      this.cargarPlanesYPermisoEdicion();
    });
  }

  private cargarPlanesYPermisoEdicion(): void {
    this.cargando.set(true);
    this.errorMsg.set(null);
    /** Solo API pública aquí; el editor de catálogo exige sesión y no debe bloquear a visitantes anónimos. */
    this.saasPublic.listarPlanes().subscribe({
      next: (planes) => {
        this.planes.set(planes);
        this.auth.verifyToken().pipe(take(1)).subscribe({
          next: () => {
            if (this.auth.isAuthenticated()) {
              this.saasSubscription
                .getPlanesCatalogoEditor()
                .pipe(catchError(() => of({ puedeEditar: false })))
                .subscribe({
                  next: (editor) => {
                    this.puedeEditar.set(!!editor?.puedeEditar);
                    if (this.puedeEditar()) {
                      this.initEdicion(planes);
                    } else {
                      this.edicion.set({});
                    }
                    this.cargando.set(false);
                  },
                  error: () => {
                    this.puedeEditar.set(false);
                    this.edicion.set({});
                    this.cargando.set(false);
                  }
                });
            } else {
              this.puedeEditar.set(false);
              this.edicion.set({});
              this.cargando.set(false);
            }
          },
          error: () => {
            this.puedeEditar.set(false);
            this.edicion.set({});
            this.cargando.set(false);
          }
        });
      },
      error: () => {
        this.errorMsg.set('No se pudieron cargar los planes.');
        this.cargando.set(false);
      }
    });
  }

  private initEdicion(list: PlanCatalogoItem[]): void {
    const e: Record<string, EdicionPlan> = {};
    for (const p of list) {
      e[p.planCode] = {
        descripcionCorta: p.descripcionCorta,
        precioMensualPen: p.precioMensualPen,
        precioAnualPen: p.precioAnualPen,
        maxUsuarios: p.maxUsuarios,
        maxSucursales: p.maxSucursales
      };
    }
    this.edicion.set(e);
  }

  patchEdicion(planCode: string, field: keyof EdicionPlan, value: string | number): void {
    this.edicion.update((m) => {
      const prev = m[planCode];
      if (!prev) return m;
      let nextVal: string | number;
      if (field === 'descripcionCorta') {
        nextVal = String(value);
      } else {
        const n = Math.floor(Number(value));
        nextVal = Number.isFinite(n) ? n : prev[field] as number;
      }
      return { ...m, [planCode]: { ...prev, [field]: nextVal } as EdicionPlan };
    });
  }

  guardarPlan(planCode: string): void {
    const row = this.edicion()[planCode];
    if (!row) return;
    this.guardandoPlan.set(planCode);
    this.errorMsg.set(null);
    this.saasSubscription.actualizarPlanCatalogo(planCode, row).subscribe({
      next: () => {
        this.guardandoPlan.set(null);
        this.cargarPlanesYPermisoEdicion();
      },
      error: (err) => {
        this.guardandoPlan.set(null);
        const msg = err?.error?.message;
        this.errorMsg.set(typeof msg === 'string' ? msg : 'No se pudo guardar el plan.');
      }
    });
  }

  irLogin(): void {
    void this.router.navigate(['/login-empresa']);
  }

  irCrearEmpresa(): void {
    void this.router.navigate(['/crear-empresa']);
  }

  elegirPlan(planCode: string): void {
    void this.router.navigate(['/suscribirse', planCode], {
      queryParams: { billing: this.ciclo() }
    });
  }

  precio(plan: PlanCatalogoItem): number {
    return this.ciclo() === 'yearly' ? plan.precioAnualPen : plan.precioMensualPen;
  }

  etiquetaCiclo(): string {
    return this.ciclo() === 'yearly' ? 'año' : 'mes';
  }
}
