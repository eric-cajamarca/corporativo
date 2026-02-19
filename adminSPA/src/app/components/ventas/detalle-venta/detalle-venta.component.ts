import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { VentasService, ComprobantePdfData, EntregaItem } from '../../../services/ventas.service';

@Component({
  selector: 'app-detalle-venta',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SidebarComponent, TopnavComponent],
  templateUrl: './detalle-venta.component.html',
  styleUrl: './detalle-venta.component.css'
})
export class DetalleVentaComponent implements OnInit {
  data: ComprobantePdfData | null = null;
  entregas: EntregaItem[] = [];
  loading = true;
  idVenta: number | null = null;
  entregaForm = { idDetalle: 0 as number, cantidad: 0 as number, notas: '' as string };
  guardandoEntrega = false;
  errorEntrega = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ventasService: VentasService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.idVenta = id ? parseInt(id, 10) : null;
    if (this.idVenta == null || isNaN(this.idVenta)) {
      this.loading = false;
      return;
    }
    this.ventasService.getComprobanteParaPdf(this.idVenta).subscribe({
      next: (res) => {
        this.data = res.data ?? null;
        this.loading = false;
        if (this.idVenta) this.cargarEntregas();
      },
      error: () => {
        this.data = null;
        this.loading = false;
      }
    });
  }

  cargarEntregas(): void {
    if (!this.idVenta) return;
    this.ventasService.getEntregas(this.idVenta).subscribe({
      next: (res) => {
        this.entregas = res.data ?? [];
      }
    });
  }

  /** Ítems del detalle con pendiente > 0 para el selector de entregas */
  itemsConPendiente(): Array<{ idDetalle: number; label: string; pendiente: number }> {
    if (!this.data?.items) return [];
    return this.data.items
      .filter((d) => (d.idDetalle != null) && (Number(d.cantidad) - Number(d.cantEntregada || 0) > 0))
      .map((d) => ({
        idDetalle: Number(d.idDetalle),
        label: (d.codigo || '') + ' - ' + (d.descripcion || '') + ' (pend: ' + (Number(d.cantidad) - Number(d.cantEntregada || 0)) + ')',
        pendiente: Number(d.cantidad) - Number(d.cantEntregada || 0)
      }));
  }

  registrarEntrega(): void {
    this.errorEntrega = '';
    if (!this.idVenta || !this.entregaForm.idDetalle || this.entregaForm.cantidad <= 0) {
      this.errorEntrega = 'Seleccione ítem y cantidad mayor a 0.';
      return;
    }
    const item = this.itemsConPendiente().find((i) => i.idDetalle === this.entregaForm.idDetalle);
    if (!item || this.entregaForm.cantidad > item.pendiente) {
      this.errorEntrega = 'Cantidad no puede superar el pendiente.';
      return;
    }
    this.guardandoEntrega = true;
    this.ventasService.crearEntrega({
      idVenta: this.idVenta,
      idDetalle: this.entregaForm.idDetalle,
      cantidad: this.entregaForm.cantidad,
      notas: this.entregaForm.notas?.trim() || undefined
    }).subscribe({
      next: () => {
        this.guardandoEntrega = false;
        this.entregaForm = { idDetalle: 0, cantidad: 0, notas: '' };
        this.cargarEntregas();
        this.ventasService.getComprobanteParaPdf(this.idVenta!).subscribe({
          next: (r) => { this.data = r.data ?? null; }
        });
      },
      error: (err) => {
        this.guardandoEntrega = false;
        this.errorEntrega = err.error?.message || 'Error al registrar entrega.';
      }
    });
  }

  formatearMoneda(value: number | undefined): string {
    if (value == null) return 'S/ 0.00';
    return 'S/ ' + Number(value).toFixed(2);
  }

  formatearFecha(f: string | undefined): string {
    if (!f) return '—';
    return String(f).slice(0, 19).replace('T', ' ');
  }

  pendiente(item: { cantidad?: number; cantEntregada?: number }): number {
    const c = Number(item.cantidad ?? 0);
    const e = Number(item.cantEntregada ?? 0);
    return Math.max(0, c - e);
  }

  puedeEditar(): boolean {
    const id = this.data?.venta?.idEstadoSunat;
    return id !== 1 && id !== 2 && id !== 3;
  }

  editar(): void {
    if (this.idVenta && this.puedeEditar()) {
      this.router.navigate(['/ventas/editar', this.idVenta]);
    }
  }

  volver(): void {
    this.router.navigate(['/ventas']);
  }
}
