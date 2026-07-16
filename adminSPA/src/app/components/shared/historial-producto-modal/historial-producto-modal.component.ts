import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  HistorialCompraProductoItem,
  HistorialVentaProductoItem
} from '../../../models/producto-historial.model';
import { ProductoService } from '../../../services/producto.service';

type TabHistorial = 'ventas' | 'compras';

@Component({
  selector: 'app-historial-producto-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historial-producto-modal.component.html',
  styleUrl: './historial-producto-modal.component.css'
})
export class HistorialProductoModalComponent implements OnInit {
  @Input() idProducto = '';
  @Input() codigo = '';
  @Input() descripcion = '';
  /** Solo Administrador: muestra pestaña e intenta cargar compras. */
  @Input() puedeVerCompras = false;
  @Input() idCliente: number | string | null = null;
  @Input() precioActual = 0;

  tab: TabHistorial = 'ventas';
  soloEsteCliente = false;

  ventas: HistorialVentaProductoItem[] = [];
  compras: HistorialCompraProductoItem[] = [];

  loadingVentas = false;
  loadingCompras = false;
  errorVentas = '';
  errorCompras = '';
  comprasCargadas = false;

  constructor(
    public activeModal: NgbActiveModal,
    private productoService: ProductoService
  ) {}

  ngOnInit(): void {
    this.cargarVentas();
  }

  get tituloProducto(): string {
    const cod = (this.codigo || '').trim();
    const desc = (this.descripcion || '').trim();
    if (cod && desc) return `${cod} — ${desc}`;
    return cod || desc || 'Producto';
  }

  seleccionarTab(tab: TabHistorial): void {
    this.tab = tab;
    if (tab === 'compras' && this.puedeVerCompras && !this.comprasCargadas && !this.loadingCompras) {
      this.cargarCompras();
    }
  }

  toggleSoloCliente(): void {
    this.soloEsteCliente = !this.soloEsteCliente;
    this.cargarVentas();
  }

  cargarVentas(): void {
    if (!this.idProducto) {
      this.errorVentas = 'Producto no válido';
      return;
    }
    this.loadingVentas = true;
    this.errorVentas = '';
    const opts: { limite: number; idCliente?: number | string } = { limite: 40 };
    if (this.soloEsteCliente && this.idCliente != null && this.idCliente !== '' && this.idCliente !== 0) {
      opts.idCliente = this.idCliente;
    }
    this.productoService.obtenerHistorialVentasProducto(this.idProducto, opts).subscribe({
      next: (res) => {
        this.ventas = Array.isArray(res?.data) ? res.data : [];
        this.loadingVentas = false;
      },
      error: (err) => {
        this.ventas = [];
        this.loadingVentas = false;
        this.errorVentas = err?.error?.message || 'Error al cargar historial de ventas';
      }
    });
  }

  cargarCompras(): void {
    if (!this.puedeVerCompras || !this.idProducto) return;
    this.loadingCompras = true;
    this.errorCompras = '';
    this.productoService.obtenerHistorialComprasProducto(this.idProducto, { limite: 40 }).subscribe({
      next: (res) => {
        this.compras = Array.isArray(res?.data) ? res.data : [];
        this.comprasCargadas = true;
        this.loadingCompras = false;
      },
      error: (err) => {
        this.compras = [];
        this.loadingCompras = false;
        this.comprasCargadas = true;
        const status = err?.status;
        this.errorCompras =
          status === 403
            ? 'Solo el administrador puede ver el historial de compras'
            : err?.error?.message || 'Error al cargar historial de compras';
      }
    });
  }

  cancelar(): void {
    this.activeModal.dismiss();
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '—';
    // API: yyyy-MM-dd HH:mm:ss o ya dd/MM/yyyy
    if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
      const d = fecha.slice(0, 10);
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    }
    return fecha;
  }
}
