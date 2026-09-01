import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LeadComercialService } from '../../../services/lead-comercial.service';
import {
  LeadComercialChatMsg,
  LeadComercialEstado,
  LeadComercialMetricas,
  LeadComercialRow
} from '../../../models/lead-comercial.model';

declare var iziToast: {
  success: (o: object) => void;
  error: (o: object) => void;
};

@Component({
  selector: 'app-index-leads-comercial',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './index-leads-comercial.component.html',
  styleUrl: './index-leads-comercial.component.css'
})
export class IndexLeadsComercialComponent implements OnInit {
  readonly estados: { value: string; label: string }[] = [
    { value: '', label: 'Todos' },
    { value: 'nuevo', label: 'Nuevo' },
    { value: 'interesado', label: 'Interesado' },
    { value: 'llamada_pendiente', label: 'Llamada pendiente' },
    { value: 'contactado', label: 'Contactado' },
    { value: 'ganado', label: 'Ganado' },
    { value: 'perdido', label: 'Perdido' }
  ];

  readonly rangos: { dias: number; label: string }[] = [
    { dias: 7, label: '7 días' },
    { dias: 30, label: '30 días' },
    { dias: 90, label: '90 días' }
  ];

  loading = signal(true);
  items = signal<LeadComercialRow[]>([]);
  cola = signal<LeadComercialRow[]>([]);
  metricas = signal<LeadComercialMetricas | null>(null);
  filtroEstado = '';
  rangoDias = 7;
  actualizando = signal<string | null>(null);

  modalAbierto = signal(false);
  chatLoading = signal(false);
  leadChat = signal<LeadComercialRow | null>(null);
  mensajes = signal<LeadComercialChatMsg[]>([]);
  notaRevision = '';

  constructor(private api: LeadComercialService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.api.listar(this.filtroEstado || undefined).subscribe({
      next: (data) => {
        this.items.set(data);
        this.loading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.items.set([]);
        this.loading.set(false);
        this.toastError(err?.error?.message || 'No se pudieron cargar los leads');
      }
    });
    this.cargarMetricas();
    this.cargarCola();
  }

  cargarMetricas(): void {
    const { desde, hasta } = this.rangoFechas(this.rangoDias);
    this.api.metricas(desde, hasta).subscribe({
      next: (data) => this.metricas.set(data),
      error: () => this.metricas.set(null)
    });
  }

  cargarCola(): void {
    this.api.revision().subscribe({
      next: (data) => this.cola.set(data),
      error: () => this.cola.set([])
    });
  }

  cambiarRango(dias: number): void {
    this.rangoDias = dias;
    this.cargarMetricas();
  }

  esWeb(row: LeadComercialRow): boolean {
    return String(row.telefonoLog || '').startsWith('web:');
  }

  celularVisible(row: LeadComercialRow): string {
    const d = String(row.digitosCelular || '').replace(/\D/g, '');
    if (d.length >= 9) return d.length === 11 && d.startsWith('51') ? d.slice(2) : d.slice(-9);
    return '—';
  }

  whatsappUrl(row: LeadComercialRow): string | null {
    const d = String(row.digitosCelular || '').replace(/\D/g, '');
    if (d.length === 9 && d.startsWith('9')) return `https://wa.me/51${d}`;
    if (d.length >= 11 && d.startsWith('51')) return `https://wa.me/${d}`;
    return null;
  }

  etiquetaEstado(estado: string): string {
    const found = this.estados.find((e) => e.value === estado);
    return found?.label || estado;
  }

  badgeClass(estado: string): string {
    if (estado === 'ganado') return 'text-bg-success';
    if (estado === 'perdido') return 'text-bg-secondary';
    if (estado === 'llamada_pendiente') return 'text-bg-danger';
    if (estado === 'contactado') return 'text-bg-primary';
    if (estado === 'interesado') return 'text-bg-warning';
    return 'text-bg-light text-dark';
  }

  rubroVisible(row: LeadComercialRow): string {
    return row.rubro || row.rubroLibre || '—';
  }

  abrirChat(row: LeadComercialRow): void {
    this.leadChat.set(row);
    this.mensajes.set([]);
    this.notaRevision = row.notaRevision || '';
    this.modalAbierto.set(true);
    this.chatLoading.set(true);
    this.api.chat(row.idLead).subscribe({
      next: (data) => {
        this.leadChat.set(data.lead);
        this.mensajes.set(data.mensajes || []);
        this.notaRevision = data.lead?.notaRevision || this.notaRevision;
        this.chatLoading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.chatLoading.set(false);
        this.toastError(err?.error?.message || 'No se pudo cargar el chat');
      }
    });
  }

  cerrarChat(): void {
    this.modalAbierto.set(false);
    this.leadChat.set(null);
    this.mensajes.set([]);
    this.notaRevision = '';
  }

  guardarRevision(estado?: LeadComercialEstado): void {
    const row = this.leadChat();
    if (!row?.idLead) return;
    this.actualizando.set(row.idLead);
    this.api
      .guardarRevision(row.idLead, {
        notaRevision: this.notaRevision,
        estado
      })
      .subscribe({
        next: (updated) => {
          this.actualizando.set(null);
          this.aplicarLead(updated);
          this.leadChat.set(updated);
          this.cargarCola();
          this.cargarMetricas();
          this.toastOk(
            estado
              ? `Revisado y marcado como ${this.etiquetaEstado(updated.estado)}.`
              : 'Revisión guardada.'
          );
          if (estado) this.cerrarChat();
        },
        error: (err: { error?: { message?: string } }) => {
          this.actualizando.set(null);
          this.toastError(err?.error?.message || 'No se pudo guardar la revisión');
        }
      });
  }

  cambiarEstado(row: LeadComercialRow, estado: string): void {
    if (!row?.idLead || row.estado === estado) return;
    this.actualizando.set(row.idLead);
    this.api.actualizarEstado(row.idLead, estado as LeadComercialEstado).subscribe({
      next: (updated) => {
        this.actualizando.set(null);
        this.aplicarLead(updated);
        this.toastOk(`Lead marcado como ${this.etiquetaEstado(updated.estado)}.`);
      },
      error: (err: { error?: { message?: string } }) => {
        this.actualizando.set(null);
        this.toastError(err?.error?.message || 'No se pudo actualizar el estado');
      }
    });
  }

  private aplicarLead(updated: LeadComercialRow): void {
    this.items.update((list) => list.map((x) => (x.idLead === updated.idLead ? updated : x)));
    this.cola.update((list) => {
      if (updated.fRevision || updated.idEmpresaRegistrada) {
        return list.filter((x) => x.idLead !== updated.idLead);
      }
      return list.map((x) => (x.idLead === updated.idLead ? updated : x));
    });
  }

  private rangoFechas(dias: number): { desde: string; hasta: string } {
    const hasta = new Date();
    const desde = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() - (dias - 1));
    return { desde: this.iso(desde), hasta: this.iso(hasta) };
  }

  private iso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toastOk(message: string): void {
    if (typeof iziToast !== 'undefined') {
      iziToast.success({ title: 'OK', message, position: 'topRight' });
    }
  }

  private toastError(message: string): void {
    if (typeof iziToast !== 'undefined') {
      iziToast.error({ title: 'Error', message, position: 'topRight' });
    }
  }
}
