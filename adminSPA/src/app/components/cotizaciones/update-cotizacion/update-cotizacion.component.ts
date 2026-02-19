import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { CotizacionesService } from '../../../services/cotizaciones.service';
import { BuscadorProductosModalService } from '../../../services/buscador-productos-modal.service';
import { ProductoSeleccionado } from '../../shared/buscador-productos-modal/buscador-productos-modal.component';

declare var iziToast: any;

interface DetalleEdicion {
  idDetalleCotizacion?: number;
  cantidad: number;
  codigo: string;
  descripcion: string;
  idPresentacion: number;
  pVenta: number;
  descuentos: number;
  igv: number;
  ISC: number;
  total: number;
  idSucursal: number;
}

@Component({
  selector: 'app-update-cotizacion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent],
  templateUrl: './update-cotizacion.component.html',
  styleUrl: './update-cotizacion.component.css'
})
export class UpdateCotizacionComponent implements OnInit {
  idCotizacion: number | null = null;
  loading = true;
  saving = false;
  idComprobante = 0;
  serieNumero = '';
  serie = '';
  numero = '';
  fEmision = '';
  fVencimiento = '';
  idDocumento = '1';
  idCliente = 0;
  clienteRazonSocial = '';
  clienteRuc = '';
  total = 0;
  detalles: DetalleEdicion[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cotizacionesService: CotizacionesService,
    private buscadorProductosModal: BuscadorProductosModalService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.idCotizacion = id ? parseInt(id, 10) : null;
    if (this.idCotizacion == null || isNaN(this.idCotizacion)) {
      this.loading = false;
      return;
    }
    this.cotizacionesService.obtenerPorId(this.idCotizacion).subscribe({
      next: (res) => {
        const data = res.data;
        if (data?.cabecera) {
          const c = data.cabecera;
          this.idComprobante = c.idComprobante ?? 0;
          this.serieNumero = c.serieNumero || '';
          this.serie = c.serie || '';
          this.numero = c.numero || '';
          this.fEmision = (c.fEmision || '').toString().slice(0, 10);
          this.fVencimiento = (c.fVencimiento || '').toString().slice(0, 10);
          this.idDocumento = (c.idDocumento != null ? String(c.idDocumento) : '1').slice(0, 1);
          this.idCliente = c.idCliente ?? 0;
          this.clienteRazonSocial = c.clienteRazonSocial || '';
          this.clienteRuc = c.clienteRuc || '';
          this.total = Number(c.total) || 0;
        }
        if (data?.detalles?.length) {
          this.detalles = data.detalles.map((d: any) => ({
            idDetalleCotizacion: d.idDetalleCotizacion,
            cantidad: Number(d.cantidad) || 0,
            codigo: d.codigo || '',
            descripcion: d.descripcion || '',
            idPresentacion: d.idPresentacion ?? 1,
            pVenta: Number(d.pVenta) || 0,
            descuentos: Number(d.descuentos) || 0,
            igv: Number(d.igv) || 0,
            ISC: Number(d.ISC) || 0,
            total: Number(d.total) || 0,
            idSucursal: d.idSucursal ?? 1
          }));
        } else {
          this.detalles = [];
        }
        this.recalcularTotal();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  recalcularTotal(): void {
    let sum = 0;
    this.detalles.forEach((d) => {
      d.total = Math.round((d.cantidad * d.pVenta) * 100) / 100;
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
    const idSucursal = this.detalles.length > 0 && this.detalles[0].idSucursal != null
      ? String(this.detalles[0].idSucursal)
      : undefined;
    this.buscadorProductosModal.abrir(idSucursal).then((producto: ProductoSeleccionado | null) => {
      if (producto == null) return;
      const idSucursalDetalle = this.detalles.length > 0
        ? this.detalles[0].idSucursal
        : 1;
      const pVenta = Number(producto.pVenta) || 0;
      const nuevoDetalle: DetalleEdicion = {
        cantidad: 1,
        codigo: producto.codigo ?? '',
        descripcion: producto.descripcion ?? '',
        idPresentacion: producto.idPresentacion ?? 1,
        pVenta,
        descuentos: 0,
        igv: 0,
        ISC: 0,
        total: pVenta,
        idSucursal: idSucursalDetalle
      };
      this.detalles.push(nuevoDetalle);
      this.recalcularTotal();
    });
  }

  volver(): void {
    this.router.navigate(['/cotizaciones']);
  }

  guardar(): void {
    if (this.idCotizacion == null) return;
    if (this.detalles.length === 0) {
      iziToast.warning({ title: 'Advertencia', message: 'Agregue al menos un ítem.' });
      return;
    }
    this.saving = true;
    const payload = {
      cotizacion: {
        idComprobante: this.idComprobante,
        serie: this.serie,
        numero: this.numero,
        serieNumero: this.serieNumero,
        fEmision: this.fEmision,
        fVencimiento: this.fVencimiento,
        idDocumento: this.idDocumento,
        idCliente: this.idCliente,
        moneda: undefined,
        idCondicionPago: undefined,
        total: this.total
      },
      detalles: this.detalles.map((d) => ({
        cantidad: d.cantidad,
        pVenta: d.pVenta,
        subtotal: d.cantidad * d.pVenta,
        total: d.total,
        descuento: d.descuentos,
        igv: d.igv,
        isc: d.ISC,
        codigo: d.codigo,
        descripcion: d.descripcion,
        idPresentacion: d.idPresentacion,
        idSucursal: d.idSucursal
      }))
    };
    this.cotizacionesService.actualizar(this.idCotizacion, payload).subscribe({
      next: () => {
        this.saving = false;
        iziToast.success({ title: 'Éxito', message: 'Cotización actualizada.' });
        this.router.navigate(['/cotizaciones', this.idCotizacion]);
      },
      error: (err) => {
        this.saving = false;
        iziToast.error({
          title: 'Error',
          message: err?.error?.error || err?.message || 'Error al actualizar.'
        });
      }
    });
  }
}
