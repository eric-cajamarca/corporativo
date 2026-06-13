import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { IndexVentasComponent } from '../index-ventas/index-ventas.component';
import { IndexClientesComponent } from '../../clientes/index-clientes/index-clientes.component';
import { HotelService, type Reserva, type ProductoHabitacion, type ConsumoHabitacionLinea } from '../../../services/hotel.service';
import { HotelPreloadVentaService } from '../../../services/hotel-preload-venta.service';
import { BuscadorProductosModalService } from '../../../services/buscador-productos-modal.service';
import { ProductoService } from '../../../services/producto.service';
import { Router } from '@angular/router';
import { productoActivoParaVenta } from '../../../utils/producto-busqueda.util';
import { descripcionUnidadMedidaProducto } from '../../../utils/producto-presentacion.util';

type EstadoReserva = 'vigente' | 'sin_efecto';

export interface ProductoParaConsumo {
  idProducto: string;
  codigo: string;
  descripcion: string;
  pVenta?: number;
  codigoPresentacion?: string;
  descripcionPres?: string;
  categoria?: string;
  sucursal?: string;
  stock?: number;
}

@Component({
  selector: 'app-ventas-hoteles',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    SidebarComponent,
    TopnavComponent,
    IndexVentasComponent,
    IndexClientesComponent
  ],
  templateUrl: './ventas-hoteles.component.html',
  styleUrl: './ventas-hoteles.component.css'
})
export class VentasHotelesComponent implements OnInit {
  private hotelService = inject(HotelService);
  private preloadVenta = inject(HotelPreloadVentaService);
  private buscadorProductosModal = inject(BuscadorProductosModalService);
  private productoService = inject(ProductoService);
  private router = inject(Router);
  sidebarState = inject(SidebarStateService);
  activeTab = signal<'reservas' | 'habitaciones' | 'consumo'>('reservas');

  reservas: Reserva[] = [];
  productosHabitacion: ProductoHabitacion[] = [];
  /** Consumo agrupado por idProductoHabitacion */
  consumoPorHabitacion: Record<string, ConsumoHabitacionLinea[]> = {};
  /** Productos con datos completos (presentación, precio, etc.) para consumo y buscador. */
  productosParaConsumo: ProductoParaConsumo[] = [];
  /** Producto elegido en el modal de búsqueda (para mostrar descripción y precio en el form). */
  productoSeleccionadoConsumo: ProductoParaConsumo | null = null;

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  showModalReserva = signal(false);
  reservaEditando: Reserva | null = null;
  formReserva = {
    idProductoHabitacion: '',
    idCliente: null as number | null,
    nombreHuesped: '',
    fechaEntrada: '',
    fechaSalida: '',
    total: 0,
    codigo: ''
  };
  guardandoReserva = false;

  showModalCliente = signal(false);

  showModalConsumo = signal(false);
  habitacionConsumoSeleccionada: ProductoHabitacion | null = null;
  formConsumo = { idProducto: '', cantidad: 1, pUnitario: 0 };
  guardandoConsumo = false;

  showModalDetalle = signal(false);
  habitacionDetalleSeleccionada: ProductoHabitacion | null = null;
  editandoConsumo: ConsumoHabitacionLinea | null = null;
  formEditConsumo = { cantidad: 0, pUnitario: 0 };
  guardandoEditConsumo = false;

  ngOnInit(): void {
    this.cargarDatos();
    this.cargarProductosHabitacion();
  }

  cargarDatos(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.hotelService.listarReservas().subscribe({
      next: (res) => {
        this.reservas = res.data ?? [];
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al cargar reservas');
        this.loading.set(false);
      }
    });
  }

  cargarProductosHabitacion(): void {
    this.hotelService.getProductosHabitacion().subscribe({
      next: (res) => { this.productosHabitacion = res.data ?? []; },
      error: () => { this.productosHabitacion = []; }
    });
  }

  setTab(tab: 'reservas' | 'habitaciones' | 'consumo'): void {
    this.activeTab.set(tab);
    if (tab === 'habitaciones') this.cargarConsumo();
  }

  cargarConsumo(): void {
    this.hotelService.listarConsumo().subscribe({
      next: (res) => {
        const list = res.data ?? [];
        const map: Record<string, ConsumoHabitacionLinea[]> = {};
        for (const linea of list) {
          const id = linea.idProductoHabitacion;
          if (!map[id]) map[id] = [];
          map[id].push(linea);
        }
        this.consumoPorHabitacion = map;
      },
      error: () => { this.consumoPorHabitacion = {}; }
    });
  }

  getConsumoDeHabitacion(idProductoHabitacion: string): ConsumoHabitacionLinea[] {
    return this.consumoPorHabitacion[idProductoHabitacion] ?? [];
  }

  /** Reserva vigente para esta habitación (la más reciente por fecha entrada si hay varias). */
  getReservaVigentePorHabitacion(idProductoHabitacion: string): Reserva | null {
    const vigentes = this.reservas.filter(
      (r) => r.estado === 'vigente' && r.idProductoHabitacion === idProductoHabitacion
    );
    if (vigentes.length === 0) return null;
    return vigentes.sort((a, b) => (b.fechaEntrada > a.fechaEntrada ? 1 : -1))[0];
  }

  /** Estado tarjeta: ocupada (rojo), reservada (amarillo), disponible (verde). */
  getEstadoHabitacion(hab: ProductoHabitacion): 'ocupada' | 'reservada' | 'disponible' {
    const reserva = this.getReservaVigentePorHabitacion(hab.idProducto);
    if (!reserva) return 'disponible';
    const hoy = new Date().toISOString().slice(0, 10);
    if (reserva.fechaEntrada <= hoy && reserva.fechaSalida >= hoy) return 'ocupada';
    if (reserva.fechaEntrada > hoy) return 'reservada';
    return 'disponible';
  }

  /** Total habitación: total reserva + sum(consumo). */
  getTotalHabitacion(hab: ProductoHabitacion): number {
    const reserva = this.getReservaVigentePorHabitacion(hab.idProducto);
    const totalReserva = reserva?.total ?? 0;
    const lineas = this.getConsumoDeHabitacion(hab.idProducto);
    const totalConsumo = lineas.reduce((s, l) => s + l.cantidad * l.pUnitario, 0);
    return totalReserva + totalConsumo;
  }

  abrirModalAgregarConsumo(habitacion: ProductoHabitacion): void {
    this.habitacionConsumoSeleccionada = habitacion;
    this.formConsumo = { idProducto: '', cantidad: 1, pUnitario: 0 };
    this.productoSeleccionadoConsumo = null;
    this.errorMessage.set(null);
    this.productoService.obtenerProductosTodos().subscribe({
      next: (r) => {
        const data = (r as { data?: unknown[] }).data ?? [];
        this.productosParaConsumo = data
          .filter((p: unknown) => productoActivoParaVenta(p as Record<string, unknown>))
          .map((p: unknown) => this.mapearProductoParaConsumo(p));
        this.showModalConsumo.set(true);
      },
      error: () => { this.productosParaConsumo = []; this.showModalConsumo.set(true); }
    });
  }

  private mapearProductoParaConsumo(p: unknown): ProductoParaConsumo {
    const x = p as Record<string, unknown>;
    return {
      idProducto: (x['idProducto'] ?? '') as string,
      codigo: (x['codigo'] ?? '') as string,
      descripcion: (x['descripcion'] ?? '') as string,
      pVenta: (x['pVenta'] != null ? Number(x['pVenta']) : 0),
      codigoPresentacion: (x['codigoPresentacion'] ?? '') as string,
      descripcionPres: (x['descripcionPres'] ?? '') as string,
      categoria: (x['categoria'] ?? '') as string,
      sucursal: (x['sucursal'] ?? '') as string,
      stock: (x['stock'] != null ? Number(x['stock']) : undefined)
    };
  }

  cerrarModalConsumo(): void {
    this.showModalConsumo.set(false);
    this.habitacionConsumoSeleccionada = null;
    this.productoSeleccionadoConsumo = null;
  }

  abrirModalBuscarProductoConsumo(): void {
    this.buscadorProductosModal.abrir({ modo: 'catalogo', etiquetaPrecio: 'P. venta' }).then((p) => {
      if (!p) return;
      this.seleccionarProductoConsumo(this.mapearProductoParaConsumo(p as unknown as Record<string, unknown>));
    });
  }

  uMedidaColumnaConsumo(p: ProductoParaConsumo): string {
    return descripcionUnidadMedidaProducto(p as unknown as Record<string, unknown>);
  }

  /** Recarga catálogo desde BD (p. ej. producto recién creado desde el buscador compartido). */
  recargarProductosConsumoDesdeServidor(): void {
    this.productoService.obtenerProductosTodos({ evitarCache: true }).subscribe({
      next: (r) => {
        const data = (r as { data?: unknown[] }).data ?? [];
        this.productosParaConsumo = data
          .filter((p: unknown) => productoActivoParaVenta(p as Record<string, unknown>))
          .map((p: unknown) => this.mapearProductoParaConsumo(p));
      },
      error: () => {}
    });
  }

  seleccionarProductoConsumo(p: ProductoParaConsumo): void {
    this.formConsumo.idProducto = p.idProducto;
    this.formConsumo.pUnitario = p.pVenta ?? 0;
    this.formConsumo.cantidad = 1;
    this.productoSeleccionadoConsumo = p;
  }

  guardarConsumo(): void {
    if (!this.habitacionConsumoSeleccionada || !this.formConsumo.idProducto || this.formConsumo.cantidad <= 0) {
      this.errorMessage.set('Seleccione producto y cantidad.');
      return;
    }
    this.guardandoConsumo = true;
    this.errorMessage.set(null);
    const prod = this.productosParaConsumo.find(p => p.idProducto === this.formConsumo.idProducto);
    const pUnitario = this.formConsumo.pUnitario > 0 ? this.formConsumo.pUnitario : (prod?.pVenta ?? 0);
    this.hotelService.agregarConsumo({
      idProductoHabitacion: this.habitacionConsumoSeleccionada.idProducto,
      idProducto: this.formConsumo.idProducto,
      cantidad: this.formConsumo.cantidad,
      pUnitario
    }).subscribe({
      next: () => {
        this.cargarConsumo();
        this.cerrarModalConsumo();
        this.guardandoConsumo = false;
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al agregar consumo');
        this.guardandoConsumo = false;
      }
    });
  }

  eliminarConsumoLinea(idConsumo: string): void {
    this.hotelService.eliminarConsumo(idConsumo).subscribe({
      next: () => this.cargarConsumo(),
      error: (err) => this.errorMessage.set(err?.error?.message || 'Error al eliminar')
    });
  }

  abrirModalDetalle(hab: ProductoHabitacion): void {
    this.habitacionDetalleSeleccionada = hab;
    this.editandoConsumo = null;
    this.errorMessage.set(null);
    this.cargarProductosParaConsumoSiFalta();
    this.showModalDetalle.set(true);
  }

  cerrarModalDetalle(): void {
    this.showModalDetalle.set(false);
    this.habitacionDetalleSeleccionada = null;
    this.editandoConsumo = null;
  }

  private cargarProductosParaConsumoSiFalta(): void {
    if (this.productosParaConsumo.length > 0) return;
    this.productoService.obtenerProductosTodos().subscribe({
      next: (r) => {
        const data = (r as { data?: unknown[] }).data ?? [];
        this.productosParaConsumo = data
          .filter((p: unknown) => productoActivoParaVenta(p as Record<string, unknown>))
          .map((p: unknown) => this.mapearProductoParaConsumo(p));
      },
      error: () => {}
    });
  }

  limpiarTarjeta(hab: ProductoHabitacion): void {
    if (!confirm('¿Limpiar todo el consumo de esta habitación?')) return;
    this.hotelService.limpiarConsumoHabitacion(hab.idProducto).subscribe({
      next: () => { this.cargarConsumo(); this.cerrarModalDetalle(); },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Error al limpiar')
    });
  }

  anularHuesped(reserva: Reserva): void {
    if (!confirm('¿Anular huésped (reserva sin efecto)?')) return;
    this.hotelService.actualizarReserva(reserva.idReserva, {
      idProductoHabitacion: reserva.idProductoHabitacion,
      idCliente: reserva.idCliente ?? 0,
      codigo: reserva.codigo,
      nombreHuesped: reserva.nombreHuesped,
      fechaEntrada: reserva.fechaEntrada,
      fechaSalida: reserva.fechaSalida,
      estado: 'sin_efecto',
      total: reserva.total
    }).subscribe({
      next: () => { this.cargarDatos(); this.cerrarModalDetalle(); },
      error: (err) => this.errorMessage.set(err?.error?.message || 'Error al anular')
    });
  }

  iniciarEditarConsumo(lin: ConsumoHabitacionLinea): void {
    this.editandoConsumo = lin;
    this.formEditConsumo = { cantidad: lin.cantidad, pUnitario: lin.pUnitario };
  }

  cancelarEditarConsumo(): void {
    this.editandoConsumo = null;
  }

  guardarEditarConsumo(): void {
    if (!this.editandoConsumo || this.formEditConsumo.cantidad <= 0) return;
    this.guardandoEditConsumo = true;
    this.hotelService.actualizarConsumo(this.editandoConsumo.idConsumo, {
      cantidad: this.formEditConsumo.cantidad,
      pUnitario: this.formEditConsumo.pUnitario
    }).subscribe({
      next: () => { this.cargarConsumo(); this.cancelarEditarConsumo(); this.guardandoEditConsumo = false; },
      error: (err) => { this.errorMessage.set(err?.error?.message || 'Error'); this.guardandoEditConsumo = false; }
    });
  }

  agregarConsumoDesdeDetalle(): void {
    if (!this.habitacionDetalleSeleccionada) return;
    this.habitacionConsumoSeleccionada = this.habitacionDetalleSeleccionada;
    this.formConsumo = { idProducto: '', cantidad: 1, pUnitario: 0 };
    this.productoSeleccionadoConsumo = null;
    this.showModalConsumo.set(true);
  }

  cerrarModalConsumoYRecargarDetalle(): void {
    this.cerrarModalConsumo();
    this.cargarConsumo();
  }

  generarVenta(habitacion: ProductoHabitacion): void {
    const reserva = this.getReservaVigentePorHabitacion(habitacion.idProducto);
    const lineasConsumo = this.getConsumoDeHabitacion(habitacion.idProducto);
    const precioHabitacion = reserva?.total ?? 0;
    const lineas: { idProducto: string; codigo: string; descripcion: string; cantidad: number; pVenta: number }[] = [];
    lineas.push({
      idProducto: habitacion.idProducto,
      codigo: habitacion.codigo,
      descripcion: habitacion.descripcion,
      cantidad: 1,
      pVenta: precioHabitacion
    });
    for (const c of lineasConsumo) {
      lineas.push({
        idProducto: c.idProducto,
        codigo: c.productoCodigo,
        descripcion: c.productoDescripcion,
        cantidad: c.cantidad,
        pVenta: c.pUnitario
      });
    }
    this.preloadVenta.setPreload({
      idProductoHabitacion: habitacion.idProducto,
      habitacionCodigo: habitacion.codigo,
      habitacionDescripcion: habitacion.descripcion,
      idCliente: reserva?.idCliente ?? null,
      idReserva: reserva?.idReserva ?? null,
      lineas
    });
    this.router.navigate(['/ventas/create']);
  }

  abrirModalNuevaReserva(): void {
    this.reservaEditando = null;
    this.errorMessage.set(null);
    this.formReserva = {
      idProductoHabitacion: '',
      idCliente: null,
      nombreHuesped: '',
      fechaEntrada: '',
      fechaSalida: '',
      total: 0,
      codigo: ''
    };
    this.hotelService.siguienteCodigoReserva().subscribe({
      next: (res) => { this.formReserva.codigo = res.data?.codigo ?? ''; }
    });
    this.showModalReserva.set(true);
  }

  cerrarModalReserva(): void {
    this.showModalReserva.set(false);
    this.reservaEditando = null;
  }

  abrirModalEditarReserva(reserva: Reserva): void {
    this.reservaEditando = reserva;
    this.errorMessage.set(null);
    this.formReserva = {
      idProductoHabitacion: reserva.idProductoHabitacion,
      idCliente: reserva.idCliente,
      nombreHuesped: reserva.nombreHuesped,
      fechaEntrada: reserva.fechaEntrada,
      fechaSalida: reserva.fechaSalida,
      total: reserva.total ?? 0,
      codigo: reserva.codigo
    };
    this.showModalReserva.set(true);
  }

  eliminarReserva(reserva: Reserva): void {
    if (!confirm(`¿Eliminar la reserva ${reserva.codigo}?`)) return;
    this.hotelService.eliminarReserva(reserva.idReserva).subscribe({
      next: () => this.cargarDatos(),
      error: (err) => this.errorMessage.set(err?.error?.message || 'Error al eliminar reserva')
    });
  }

  anularReserva(reserva: Reserva): void {
    if (!confirm('¿Anular esta reserva (sin efecto)?')) return;
    this.hotelService.actualizarReserva(reserva.idReserva, {
      idProductoHabitacion: reserva.idProductoHabitacion,
      idCliente: reserva.idCliente ?? 0,
      codigo: reserva.codigo,
      nombreHuesped: reserva.nombreHuesped,
      fechaEntrada: reserva.fechaEntrada,
      fechaSalida: reserva.fechaSalida,
      estado: 'sin_efecto',
      total: reserva.total
    }).subscribe({
      next: () => this.cargarDatos(),
      error: (err) => this.errorMessage.set(err?.error?.message || 'Error al anular reserva')
    });
  }

  abrirModalCliente(): void {
    this.showModalCliente.set(true);
  }

  cerrarModalCliente(): void {
    this.showModalCliente.set(false);
  }

  /** Llamado al elegir cliente en el modal (mismo flujo que crear nueva venta). */
  onClienteElegidoReserva(event: { idCliente?: number; rSocial?: string; ruc?: string; [key: string]: unknown }): void {
    const e = event || {};
    const nombre = (e['rSocial'] ?? e['r_Social'] ?? e['rsocial'] ?? e['razonSocial'] ?? e['RazonSocial'] ?? '').toString().trim();
    this.formReserva.idCliente = e.idCliente != null ? Number(e.idCliente) : null;
    this.formReserva.nombreHuesped = nombre || '';
    this.cerrarModalCliente();
  }

  guardarReserva(): void {
    if (!this.formReserva.idProductoHabitacion || !this.formReserva.nombreHuesped?.trim() || !this.formReserva.fechaEntrada || !this.formReserva.fechaSalida) {
      this.errorMessage.set('Complete habitación, huésped y fechas.');
      return;
    }
    this.guardandoReserva = true;
    this.errorMessage.set(null);
    const payload = {
      idProductoHabitacion: this.formReserva.idProductoHabitacion,
      idCliente: this.formReserva.idCliente ?? undefined,
      nombreHuesped: this.formReserva.nombreHuesped.trim(),
      fechaEntrada: this.formReserva.fechaEntrada,
      fechaSalida: this.formReserva.fechaSalida,
      codigo: this.formReserva.codigo || this.reservaEditando?.codigo || '',
      total: this.formReserva.total ?? 0,
      estado: 'vigente'
    };
    if (this.reservaEditando) {
      this.hotelService.actualizarReserva(this.reservaEditando.idReserva, payload).subscribe({
        next: () => {
          this.cerrarModalReserva();
          this.cargarDatos();
          this.guardandoReserva = false;
        },
        error: (err: { error?: { message?: string } }) => {
          this.errorMessage.set(err?.error?.message || 'Error al guardar reserva');
          this.guardandoReserva = false;
        }
      });
      return;
    }
    this.hotelService.crearReserva(payload).subscribe({
      next: () => {
        this.cerrarModalReserva();
        this.cargarDatos();
        this.guardandoReserva = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.errorMessage.set(err?.error?.message || 'Error al guardar reserva');
        this.guardandoReserva = false;
      }
    });
  }

  estadoReservaClass(estado: EstadoReserva): string {
    return estado === 'vigente' ? 'hotel-badge-en-curso' : 'hotel-badge-completada';
  }

  estadoReservaLabels: Record<EstadoReserva, string> = {
    vigente: 'Vigente',
    sin_efecto: 'Sin efecto'
  };

  formatearMoneda(value: number): string {
    return 'S/ ' + Number(value).toFixed(2);
  }

  get vigentesCount(): number {
    return this.reservas.filter((r) => r.estado === 'vigente').length;
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
