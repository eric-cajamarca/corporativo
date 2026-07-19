import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SaasSubscriptionService } from '../../../services/saas-subscription.service';

declare var iziToast: {
  success: (o: object) => void;
  error: (o: object) => void;
};

interface PagoManualRow {
  orderNumber: string;
  planCode: string;
  billingCycle: string;
  monto: number;
  moneda: string;
  estado: string;
  idTransaccionPasarela: string | null;
  fCreacion: string;
  fConfirmacion: string | null;
  emailContacto: string | null;
  idEmpresaCliente: string | null;
  razonSocialCliente: string | null;
  rucCliente: string | null;
}

@Component({
  selector: 'app-pagos-suscripcion-manual',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './pagos-suscripcion-manual.component.html',
  styleUrl: './pagos-suscripcion-manual.component.css'
})
export class PagosSuscripcionManualComponent implements OnInit {
  loading = signal(true);
  items = signal<PagoManualRow[]>([]);
  filtroEstado = 'PENDIENTE_VALIDACION';
  confirmando = signal<string | null>(null);

  constructor(private saas: SaasSubscriptionService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.saas.listarPagosManuales({ estado: this.filtroEstado || undefined }).subscribe({
      next: (data) => {
        this.items.set((data || []) as PagoManualRow[]);
        this.loading.set(false);
      },
      error: (err) => {
        this.items.set([]);
        this.loading.set(false);
        if (typeof iziToast !== 'undefined') {
          iziToast.error({
            title: 'Error',
            message: err?.error?.message || 'No se pudieron cargar los pagos',
            position: 'topRight'
          });
        }
      }
    });
  }

  confirmar(row: PagoManualRow): void {
    if (!row?.orderNumber) return;
    if (
      !window.confirm(
        `¿Confirmar pago de ${row.orderNumber}?\nPlan ${row.planCode} · S/ ${Number(row.monto).toFixed(2)}\nSe marcará PAGADO y se habilitará el plan si hay empresa vinculada.`
      )
    ) {
      return;
    }
    this.confirmando.set(row.orderNumber);
    this.saas.confirmarPagoManual(row.orderNumber).subscribe({
      next: () => {
        this.confirmando.set(null);
        if (typeof iziToast !== 'undefined') {
          iziToast.success({
            title: 'OK',
            message: 'Pago marcado como PAGADO. Plan habilitado si corresponde.',
            position: 'topRight'
          });
        }
        this.cargar();
      },
      error: (err) => {
        this.confirmando.set(null);
        if (typeof iziToast !== 'undefined') {
          iziToast.error({
            title: 'Error',
            message: err?.error?.message || 'No se pudo confirmar el pago',
            position: 'topRight'
          });
        }
      }
    });
  }

  etiquetaCiclo(c: string): string {
    if (c === 'yearly' || c === 'anual') return 'Anual';
    if (c === 'none') return 'Demo';
    return 'Mensual';
  }
}
