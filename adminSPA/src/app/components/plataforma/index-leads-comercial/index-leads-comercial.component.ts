import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LeadComercialService } from '../../../services/lead-comercial.service';
import { LeadComercialEstado, LeadComercialRow } from '../../../models/lead-comercial.model';

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

  loading = signal(true);
  items = signal<LeadComercialRow[]>([]);
  filtroEstado = '';
  actualizando = signal<string | null>(null);

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
        if (typeof iziToast !== 'undefined') {
          iziToast.error({
            title: 'Error',
            message: err?.error?.message || 'No se pudieron cargar los leads',
            position: 'topRight'
          });
        }
      }
    });
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

  cambiarEstado(row: LeadComercialRow, estado: string): void {
    if (!row?.idLead || row.estado === estado) return;
    this.actualizando.set(row.idLead);
    this.api.actualizarEstado(row.idLead, estado as LeadComercialEstado).subscribe({
      next: (updated) => {
        this.actualizando.set(null);
        this.items.update((list) => list.map((x) => (x.idLead === updated.idLead ? updated : x)));
        if (typeof iziToast !== 'undefined') {
          iziToast.success({
            title: 'OK',
            message: `Lead marcado como ${this.etiquetaEstado(updated.estado)}.`,
            position: 'topRight'
          });
        }
      },
      error: (err: { error?: { message?: string } }) => {
        this.actualizando.set(null);
        if (typeof iziToast !== 'undefined') {
          iziToast.error({
            title: 'Error',
            message: err?.error?.message || 'No se pudo actualizar el estado',
            position: 'topRight'
          });
        }
      }
    });
  }
}
