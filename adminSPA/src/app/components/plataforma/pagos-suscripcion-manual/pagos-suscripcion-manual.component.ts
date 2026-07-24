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
  eliminando = signal<string | null>(null);

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
    this.ejecutarConfirmar(row, 'Pago marcado como PAGADO. Plan habilitado si corresponde.');
  }

  /** Reaplica plan a empresa vinculada (órdenes ya PAGADO que quedaron en demo por bug previo). */
  aplicarPlan(row: PagoManualRow): void {
    if (!row?.orderNumber || row.estado !== 'PAGADO') return;
    if (!row.idEmpresaCliente) {
      if (typeof iziToast !== 'undefined') {
        iziToast.error({
          title: 'Sin empresa',
          message: 'Esta orden no tiene empresa vinculada.',
          position: 'topRight'
        });
      }
      return;
    }
    if (
      !window.confirm(
        `¿Aplicar plan ${row.planCode} a la empresa vinculada?\nOrden ${row.orderNumber}`
      )
    ) {
      return;
    }
    this.ejecutarConfirmar(row, 'Plan aplicado a la empresa. Pida al cliente recargar Mi suscripción.');
  }

  private ejecutarConfirmar(row: PagoManualRow, okMsg: string): void {
    this.confirmando.set(row.orderNumber);
    this.saas.confirmarPagoManual(row.orderNumber).subscribe({
      next: () => {
        this.confirmando.set(null);
        if (typeof iziToast !== 'undefined') {
          iziToast.success({
            title: 'OK',
            message: okMsg,
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
            message: this.mensajeErrorHttp(err, 'No se pudo confirmar / aplicar el plan'),
            position: 'topRight'
          });
        }
      }
    });
  }

  puedeEliminar(row: PagoManualRow): boolean {
    const e = (row?.estado || '').toUpperCase();
    return e !== 'PAGADO';
  }

  eliminar(row: PagoManualRow): void {
    if (!row?.orderNumber || !this.puedeEliminar(row)) return;
    const sinEmpresa = !row.idEmpresaCliente;
    const sinCorreo = !(row.emailContacto || '').trim();
    const avisoExtra =
      sinEmpresa || sinCorreo
        ? '\n(Orden sin empresa vinculada y/o sin correo: típica de checkout abandonado.)'
        : '';
    if (
      !window.confirm(
        `¿Eliminar la solicitud ${row.orderNumber}?\nPlan ${row.planCode} · ${row.estado}${avisoExtra}\nEsta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    this.eliminando.set(row.orderNumber);
    this.saas.eliminarPagoManual(row.orderNumber).subscribe({
      next: () => {
        this.eliminando.set(null);
        if (typeof iziToast !== 'undefined') {
          iziToast.success({
            title: 'Eliminada',
            message: 'Solicitud de pago eliminada.',
            position: 'topRight'
          });
        }
        this.cargar();
      },
      error: (err) => {
        this.eliminando.set(null);
        if (typeof iziToast !== 'undefined') {
          iziToast.error({
            title: 'Error',
            message: this.mensajeErrorHttp(err, 'No se pudo eliminar la orden. Reinicie el backend si acaba de agregar esta función.'),
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

  badgeEstadoClass(estado: string): string {
    const e = (estado || '').toUpperCase();
    if (e === 'PAGADO') return 'text-bg-success';
    if (e === 'FALLIDO') return 'text-bg-danger';
    if (e === 'ANULADO') return 'text-bg-secondary';
    if (e === 'PENDIENTE_VALIDACION' || e === 'PENDIENTE') return 'text-bg-warning';
    return 'text-bg-secondary';
  }

  private mensajeErrorHttp(err: unknown, fallback: string): string {
    const e = err as { status?: number; error?: unknown; message?: string };
    const body = e?.error;
    if (body && typeof body === 'object') {
      const o = body as { detail?: string; message?: string };
      if (o.detail) return String(o.detail);
      if (o.message) return String(o.message);
    }
    if (typeof body === 'string' && body.trim() && !body.trim().startsWith('<')) {
      return body.trim().slice(0, 200);
    }
    if (e?.status === 404) {
      return 'Ruta no encontrada (404). Reinicie el servidor backend para cargar /pagos-manuales/eliminar.';
    }
    if (e?.status === 402) {
      return 'Suscripción bloqueada para esta operación.';
    }
    if (e?.status === 403) {
      return 'No autorizado para esta operación.';
    }
    return fallback;
  }
}
