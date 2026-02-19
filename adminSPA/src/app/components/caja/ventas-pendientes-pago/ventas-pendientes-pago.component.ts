import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { VentasService, VentaPendientePago } from '../../../services/ventas.service';
import { CajaService } from '../../../services/caja.service';
import { DocumentoService } from '../../../services/documento.service';
import { FormaPago } from '../../../interfaces/formasPago-interface';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var bootstrap: any;
declare var iziToast: any;

@Component({
  selector: 'app-ventas-pendientes-pago',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent],
  templateUrl: './ventas-pendientes-pago.component.html',
  styleUrl: './ventas-pendientes-pago.component.css'
})
export class VentasPendientesPagoComponent implements OnInit {
  list: VentaPendientePago[] = [];
  loading = false;
  /** Filtro: idVenta (incluye escaneo código de barras) o nombre/RUC cliente */
  filtroIdVenta = '';
  filtroCliente = '';

  /** Modal Cobrar */
  ventaSeleccionada: VentaPendientePago | null = null;
  formasPago: FormaPago[] = [];
  /** ID forma de pago seleccionada en el modal (para el select). */
  selectedIdFormaPago: number = 0;
  detallePago: Array<{ item: number; idFormaPago: number; descripcion: string; monto: number; referencia: string }> = [];
  detailForm = { monto: 0, referencia: '' };
  guardandoPago = false;
  cajas: Array<{ idCaja: string; idSucursal: string; idApertura: string; nombre: string }> = [];

  constructor(
    private ventasService: VentasService,
    private cajaService: CajaService,
    private documentoService: DocumentoService,
    private router: Router,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargarFormasPago();
    this.cargarCajasAbiertas();
    this.cargar();
  }

  cargarFormasPago(): void {
    this.documentoService.getFormasPago().subscribe({
      next: (res) => {
        this.formasPago = res.data || [];
        const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
        if (efectivo) this.selectedIdFormaPago = efectivo.idFormaPago;
        else if (this.formasPago.length) this.selectedIdFormaPago = this.formasPago[0].idFormaPago;
      },
      error: () => { this.formasPago = []; }
    });
  }

  cargarCajasAbiertas(): void {
    this.cajaService.obtenerCajas().subscribe({
      next: (r) => {
        this.cajas = (r.data || []).filter((c: any) => c.cajaAbierta && c.idApertura);
      },
      error: () => { this.cajas = []; }
    });
  }

  cargar(): void {
    this.loading = true;
    const params: { idVenta?: string; cliente?: string } = {};
    const idV = (this.filtroIdVenta || '').trim();
    const cli = (this.filtroCliente || '').trim();
    if (idV) params.idVenta = idV;
    if (cli) params.cliente = cli;
    this.ventasService.getPendientesPago(params).subscribe({
      next: (res) => {
        this.list = res.data || [];
        this.loading = false;
      },
      error: () => {
        this.list = [];
        this.loading = false;
      }
    });
  }

  buscar(): void {
    this.cargar();
  }

  /** Para escaneo: el input puede recibir idVenta por código de barras; al soltar Enter buscar. */
  onFiltroKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.cargar();
  }

  abrirModalCobrar(venta: VentaPendientePago): void {
    this.ventaSeleccionada = venta;
    this.detallePago = [];
    this.detailForm = { monto: Number(venta.total) || 0, referencia: '' };
    const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
    this.selectedIdFormaPago = efectivo ? efectivo.idFormaPago : (this.formasPago[0]?.idFormaPago ?? 0);
    const el = document.getElementById('modalCobrarPendiente');
    if (el) bootstrap.Modal.getOrCreateInstance(el).show();
  }

  cerrarModalCobrar(): void {
    const el = document.getElementById('modalCobrarPendiente');
    if (el) bootstrap.Modal.getInstance(el)?.hide();
    this.ventaSeleccionada = null;
    this.detallePago = [];
  }

  totalDetallePago(): number {
    return this.detallePago.reduce((s, d) => s + (Number(d.monto) || 0), 0);
  }

  saldoPendiente(): number {
    const total = this.ventaSeleccionada ? Number(this.ventaSeleccionada.total) || 0 : 0;
    return Math.max(0, total - this.totalDetallePago());
  }

  agregarDetalle(): void {
    const monto = Math.round((Number(this.detailForm.monto) || 0) * 100) / 100;
    const idForma = Number(this.selectedIdFormaPago) || 0;
    if (monto <= 0 || !idForma) return;
    const desc = this.formasPago.find((f: FormaPago) => f.idFormaPago === idForma)?.descripcion || 'Pago';
    this.detallePago.push({
      item: this.detallePago.length + 1,
      idFormaPago: idForma,
      descripcion: desc,
      monto,
      referencia: this.detailForm.referencia || 'N/A'
    });
    this.detailForm.referencia = '';
    this.detailForm.monto = this.saldoPendiente();
  }

  eliminarDetalle(index: number): void {
    this.detallePago.splice(index, 1);
    this.detallePago.forEach((item, idx) => item.item = idx + 1);
    this.detailForm.monto = this.saldoPendiente();
  }

  guardarPago(): void {
    if (!this.ventaSeleccionada) return;
    const totalVenta = Number(this.ventaSeleccionada.total) || 0;
    const totalPago = this.totalDetallePago();
    if (totalPago <= 0) {
      if (typeof iziToast !== 'undefined') iziToast.warning({ title: 'Advertencia', message: 'Agregue al menos un pago.', position: 'topRight' });
      return;
    }
    if (Math.abs(totalPago - totalVenta) > 0.01) {
      if (typeof iziToast !== 'undefined') iziToast.warning({ title: 'Advertencia', message: 'El total del pago no coincide con el total de la venta.', position: 'topRight' });
      return;
    }
    const detallePago = this.detallePago.map(d => ({ idMediosPago: d.idFormaPago, monto: d.monto }));
    const idApertura = this.cajas.length > 0 ? this.cajas[0].idApertura : undefined;
    this.guardandoPago = true;
    this.ventasService.cobrarVenta(this.ventaSeleccionada.idVenta, { detallePago, idApertura }).subscribe({
      next: () => {
        this.guardandoPago = false;
        this.cerrarModalCobrar();
        if (typeof iziToast !== 'undefined') iziToast.success({ title: 'Éxito', message: 'Cobro registrado correctamente.', position: 'topRight' });
        this.cargar();
      },
      error: () => {
        this.guardandoPago = false;
      }
    });
  }

  editarVenta(idVenta: number): void {
    this.router.navigate(['/ventas/editar', idVenta]);
  }

  formatNumber(value: number): string {
    return (value ?? 0).toFixed(2);
  }
}
