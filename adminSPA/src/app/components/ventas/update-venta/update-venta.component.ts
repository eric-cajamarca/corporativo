import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { VentasService, ComprobantePdfData, DetalleVentaEdicionPayload } from '../../../services/ventas.service';
import { BuscadorProductosModalService } from '../../../services/buscador-productos-modal.service';
import { ClienteService } from '../../../services/cliente.service';
import { ProductoSeleccionado } from '../../shared/buscador-productos-modal/buscador-productos-modal.component';

export interface ClienteOption {
  idCliente: number;
  rSocial: string;
  ruc: string;
}

declare var iziToast: any;

interface DetalleEdicion {
  idDetalle?: number;
  idProducto: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  pVenta: number;
  descuento: number;
  total: number;
}

@Component({
  selector: 'app-update-venta',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent],
  templateUrl: './update-venta.component.html',
  styleUrl: './update-venta.component.css'
})
export class UpdateVentaComponent implements OnInit {
  sidebarCollapsed = signal<boolean>(false);
  idVenta: number | null = null;
  loading = true;
  saving = false;
  noEditable = false;
  compVenta = '';
  fEmision = '';
  idCliente: number | null = null;
  clienteRazonSocial = '';
  clienteRuc = '';
  clientes: ClienteOption[] = [];
  total = 0;
  idSucursal: string | null = null;
  detalles: DetalleEdicion[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ventasService: VentasService,
    private buscadorProductosModal: BuscadorProductosModalService,
    private clienteService: ClienteService
  ) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved === 'true') this.sidebarCollapsed.set(true);
    const id = this.route.snapshot.paramMap.get('id');
    this.idVenta = id ? parseInt(id, 10) : null;
    if (this.idVenta == null || isNaN(this.idVenta)) {
      this.loading = false;
      return;
    }
    this.ventasService.getComprobanteParaPdf(this.idVenta).subscribe({
      next: (res) => {
        const data: ComprobantePdfData | null = res.data ?? null;
        if (!data) {
          this.loading = false;
          return;
        }
        const v = data.venta;
        const idEstadoSunat = v.idEstadoSunat;
        this.noEditable = idEstadoSunat === 1 || idEstadoSunat === 2 || idEstadoSunat === 3;
        this.compVenta = v.compVenta || '';
        this.fEmision = (v.fEmision || '').toString().slice(0, 10);
        this.idCliente = v.idCliente != null ? Number(v.idCliente) : null;
        this.clienteRazonSocial = (data.cliente?.razonSocial || data.cliente?.rSocial || '').toString();
        this.clienteRuc = (data.cliente?.ruc || '').toString();
        this.total = Number(v.total) || 0;
        this.cargarClientes();
        this.idSucursal = v.idSucursal != null ? String(v.idSucursal) : null;
        this.detalles = (data.items || []).map((d: any) => ({
          idDetalle: d.idDetalle,
          idProducto: d.idProducto != null ? String(d.idProducto) : '',
          codigo: d.codigo || '',
          descripcion: d.descripcion || '',
          cantidad: Number(d.cantidad) || 0,
          pVenta: Number(d.pVenta) || 0,
          descuento: 0,
          total: Number(d.total) || 0
        }));
        this.recalcularTotal();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  cargarClientes(): void {
    this.clienteService.obtener_clientes().subscribe({
      next: (res) => {
        const data = res?.data ?? res?.clientes ?? [];
        this.clientes = Array.isArray(data) ? data.map((c: any) => ({
          idCliente: Number(c.idCliente),
          rSocial: (c.rSocial ?? c.r_Social ?? '').toString().trim(),
          ruc: (c.ruc ?? '').toString().trim()
        })) : [];
        if (this.idCliente != null && this.idCliente > 0 && !this.clientes.some((x) => x.idCliente === this.idCliente)) {
          this.clientes = [
            { idCliente: this.idCliente, rSocial: this.clienteRazonSocial || '(Cliente actual)', ruc: this.clienteRuc || '' },
            ...this.clientes
          ];
        }
      },
      error: () => {
        this.clientes = [];
      }
    });
  }

  onClienteChange(): void {
    const c = this.clientes.find((x) => x.idCliente === this.idCliente);
    if (c) {
      this.clienteRazonSocial = c.rSocial;
      this.clienteRuc = c.ruc;
    }
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
  }

  recalcularTotal(): void {
    let sum = 0;
    this.detalles.forEach((d) => {
      d.total = Math.round(d.cantidad * d.pVenta * 100) / 100;
      sum += d.total;
    });
    this.total = Math.round(sum * 100) / 100;
  }

  formatearMoneda(value: number): string {
    return 'S/ ' + Number(value).toFixed(2);
  }

  eliminarDetalle(index: number): void {
    if (index >= 0 && index < this.detalles.length) {
      this.detalles.splice(index, 1);
      this.recalcularTotal();
    }
  }

  agregarProductos(): void {
    const idSucursal = this.idSucursal || undefined;
    this.buscadorProductosModal.abrir(idSucursal).then((producto: ProductoSeleccionado | null) => {
      if (producto == null) return;
      const pVenta = Number(producto.pVenta) || 0;
      this.detalles.push({
        idProducto: producto.idProducto ?? '',
        codigo: producto.codigo ?? '',
        descripcion: producto.descripcion ?? '',
        cantidad: 1,
        pVenta,
        descuento: 0,
        total: pVenta
      });
      this.recalcularTotal();
    });
  }

  volver(): void {
    this.router.navigate(['/ventas']);
  }

  guardar(): void {
    if (this.idVenta == null || this.noEditable) return;
    if (this.detalles.length === 0) {
      iziToast.warning({ title: 'Advertencia', message: 'Agregue al menos un ítem.' });
      return;
    }
    this.saving = true;
    const ventaPayload = {
      fEmision: this.fEmision ? this.fEmision + 'T00:00:00' : (() => { const n = new Date(); const y = n.getFullYear(), m = String(n.getMonth() + 1).padStart(2, '0'), d = String(n.getDate()).padStart(2, '0'); return `${y}-${m}-${d}T00:00:00`; })(),
      idCliente: this.idCliente != null && this.idCliente > 0 ? this.idCliente : undefined,
      subtotal: this.total / 1.18,
      igv: this.total - this.total / 1.18,
      descuentos: 0,
      total: this.total
    };
    const detallesPayload: DetalleVentaEdicionPayload[] = this.detalles.map((d) => ({
      idProducto: d.idProducto,
      cantidad: d.cantidad,
      pVenta: d.pVenta,
      descuento: d.descuento,
      total: d.total
    }));
    this.ventasService.actualizarVenta(this.idVenta, { venta: ventaPayload, detalles: detallesPayload }).subscribe({
      next: () => {
        this.saving = false;
        iziToast.success({ title: 'Éxito', message: 'Venta actualizada.' });
        this.router.navigate(['/ventas']);
      },
      error: (err) => {
        this.saving = false;
        const msg = err?.error?.error || err?.message || 'Error al actualizar.';
        iziToast.error({ title: 'Error', message: msg });
      }
    });
  }
}
