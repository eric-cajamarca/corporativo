import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  MovimientoInventarioService,
  KardexResponse,
  KardexFila
} from '../../../services/movimiento-inventario.service';
import { ProductoService } from '../../../services/producto.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare var iziToast: any;

@Component({
  selector: 'app-kardex',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    TopnavComponent,
    SidebarComponent
  ],
  templateUrl: './kardex.component.html',
  styleUrl: './kardex.component.css'
})
export class KardexComponent {
  sidebarState = inject(SidebarStateService);
  private movimientoService = inject(MovimientoInventarioService);
  private productoService = inject(ProductoService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  //sidebarState = inject(SidebarStateService);

  form: FormGroup;
  productos: Array<{ idProducto: string; codigo?: string; descripcion?: string; nombre?: string }> = [];
  data: KardexResponse | null = null;
  cargando = false;
  filtroTexto = '';

  constructor() {
    const hoy = new Date();
    const mesInicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.form = this.fb.group({
      fechaDesde: [this.formatDate(mesInicio)],
      fechaHasta: [this.formatDate(hoy)],
      idProducto: ['']
    });
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  ngOnInit(): void {
    this.cargarProductos();
  }

  cargarProductos(): void {
    this.productoService.obtenerProductosTodos().subscribe({
      next: (res) => {
        const raw = res?.data;
        this.productos = Array.isArray(raw) ? raw : (raw ? [raw] : []);
      },
      error: () => iziToast.error({ title: 'Error', message: 'No se pudieron cargar productos', position: 'topRight' })
    });
  }

  buscar(): void {
    const idProducto = this.form.get('idProducto')?.value;
    if (!idProducto) {
      iziToast.warning({ title: 'Producto requerido', message: 'Seleccione un producto', position: 'topRight' });
      return;
    }
    const fechaDesde = this.form.get('fechaDesde')?.value || null;
    const fechaHasta = this.form.get('fechaHasta')?.value || null;
    this.cargando = true;
    this.movimientoService.obtenerKardex(idProducto, fechaDesde, fechaHasta).subscribe({
      next: (resp) => {
        this.cargando = false;
        this.data = resp;
      },
      error: (err) => {
        this.cargando = false;
        const msg = err?.error?.message || 'Error al obtener kardex';
        iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
      }
    });
  }

  /** Filas visibles (filtradas por texto en NroDocum/TipoMov si hay filtroTexto) */
  get filasVisibles(): KardexFila[] {
    if (!this.data?.filas) return [];
    const t = (this.filtroTexto || '').trim().toLowerCase();
    if (!t) return this.data.filas;
    return this.data.filas.filter(
      f =>
        (f.nroDocum && f.nroDocum.toLowerCase().includes(t)) ||
        (f.tipoMov && f.tipoMov.toLowerCase().includes(t))
    );
  }

  /** Abre el detalle del comprobante según tipoRef */
  verDetalle(fila: KardexFila): void {
    const id = fila.idRef != null ? String(fila.idRef) : '';
    if (fila.tipoRef === 'COMPRA') {
      this.router.navigate(['/compras', id]);
    } else if (fila.tipoRef === 'VENTA') {
      this.router.navigate(['/ventas/detalle', id]);
    } else {
      iziToast.info({
        title: 'Movimiento de inventario',
        message: 'Documento: ' + (fila.nroDocum || id),
        position: 'topRight'
      });
    }
  }

  formatearFecha(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  nombreProducto(): string {
    if (!this.data?.producto) return '';
    return this.data.producto.descripcion || this.data.producto.codigo || '';
  }
}
