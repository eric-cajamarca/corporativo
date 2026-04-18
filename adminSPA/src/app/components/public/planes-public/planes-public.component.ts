import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SaasPublicService } from '../../../services/saas-public.service';
import { DeploymentContextService } from '../../../services/deployment-context.service';
import { PlanCatalogoItem } from '../../../models/saas-public.model';

@Component({
  selector: 'app-planes-public',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './planes-public.component.html',
  styleUrl: './planes-public.component.css'
})
export class PlanesPublicComponent implements OnInit {
  planes = signal<PlanCatalogoItem[]>([]);
  ciclo = signal<'monthly' | 'yearly'>('monthly');
  cargando = signal(true);
  errorMsg = signal<string | null>(null);
  modoEnterprise = signal(false);

  constructor(
    private saasPublic: SaasPublicService,
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
      this.saasPublic.listarPlanes().subscribe({
        next: (list) => {
          this.planes.set(list);
          this.cargando.set(false);
        },
        error: () => {
          this.errorMsg.set('No se pudieron cargar los planes.');
          this.cargando.set(false);
        }
      });
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
