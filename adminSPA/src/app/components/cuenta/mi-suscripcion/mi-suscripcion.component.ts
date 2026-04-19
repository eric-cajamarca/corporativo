import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { SaasSubscriptionService } from '../../../services/saas-subscription.service';
import { MiEstadoSuscripcionResponse } from '../../../models/saas-subscription.model';

@Component({
  selector: 'app-mi-suscripcion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TopnavComponent, SidebarComponent],
  templateUrl: './mi-suscripcion.component.html',
  styleUrl: './mi-suscripcion.component.css'
})
export class MiSuscripcionComponent implements OnInit {
  estado = signal<MiEstadoSuscripcionResponse | null>(null);
  cargando = signal(true);
  errorMsg = signal<string | null>(null);
  vinculoMsg = signal<string | null>(null);
  orderNumber = '';
  vinculando = signal(false);

  constructor(
    private readonly saas: SaasSubscriptionService,
    public readonly sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorMsg.set(null);
    this.saas.getMiEstado().subscribe({
      next: (r) => {
        this.estado.set(r);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.errorMsg.set('No se pudo cargar el estado de la suscripción.');
      }
    });
  }

  pctUso(actual: number, maximo: number): number {
    if (!maximo || maximo <= 0) return 0;
    return Math.min(100, Math.round((100 * actual) / maximo));
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
        this.cargar();
      },
      error: () => {
        this.vinculando.set(false);
        this.vinculoMsg.set('No se pudo vincular. Verifique el número de orden o que el pago esté confirmado.');
      }
    });
  }
}
