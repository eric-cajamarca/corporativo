import { Component, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  MovimientoInventarioService,
  KardexResponse,
  KardexFila,
  MovimientoDetalle
} from '../../../services/movimiento-inventario.service';
import { ComprasService } from '../../../services/compras.service';
import { BuscadorProductosModalService } from '../../../services/buscador-productos-modal.service';
import { ProductoSeleccionado } from '../../shared/buscador-productos-modal/buscador-productos-modal.component';
import { VentasService, ComprobantePdfData } from '../../../services/ventas.service';
import { ExcelService, ExcelData } from '../../../services/excel.service';
import { formatFechaLocal } from '../../../utils/fecha-local.util';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { forkJoin } from 'rxjs';

declare var iziToast: any;
declare var bootstrap: any;

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
export class KardexComponent implements AfterViewInit {
  @ViewChild('modalDetalle') modalDetalleRef!: ElementRef<HTMLDivElement>;

  sidebarState = inject(SidebarStateService);
  private movimientoService = inject(MovimientoInventarioService);
  private buscadorProductosModal = inject(BuscadorProductosModalService);
  private comprasService = inject(ComprasService);
  private ventasService = inject(VentasService);
  private excelService = inject(ExcelService);
  private fb = inject(FormBuilder);

  form: FormGroup;
  productoSeleccionado: { idProducto: string; codigo: string; descripcion: string } | null = null;
  data: KardexResponse | null = null;
  cargando = false;
  filtroTexto = '';

  modalTipo: 'COMPRA' | 'VENTA' | 'MOVIMIENTO' | null = null;
  modalCargando = false;
  modalDataCompra: { compra: any; detalle: any[] } | null = null;
  modalDataVenta: ComprobantePdfData | null = null;
  modalDataMovimiento: MovimientoDetalle | null = null;
  modalError = '';

  private modalInstance: any = null;

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
    return formatFechaLocal(d);
  }

  ngAfterViewInit(): void {
    if (this.modalDetalleRef?.nativeElement) {
      this.modalInstance = bootstrap.Modal.getOrCreateInstance(this.modalDetalleRef.nativeElement);
    }
  }

  abrirBuscadorProductos(): void {
    this.buscadorProductosModal.abrir().then((p: ProductoSeleccionado | null) => {
      if (!p?.idProducto) return;
      this.productoSeleccionado = {
        idProducto: String(p.idProducto),
        codigo: String(p.codigo ?? ''),
        descripcion: String(p.descripcion ?? p['nombre'] ?? '')
      };
      this.form.patchValue({ idProducto: this.productoSeleccionado.idProducto });
      this.data = null;
    });
  }

  limpiarProducto(): void {
    this.productoSeleccionado = null;
    this.form.patchValue({ idProducto: '' });
    this.data = null;
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

  esFilaExcluida(fila: KardexFila): boolean {
    return fila.excluidoDeTotales === true;
  }

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

  verDetalle(fila: KardexFila): void {
    const id = fila.idRef != null ? String(fila.idRef) : '';
    this.modalTipo = fila.tipoRef;
    this.modalDataCompra = null;
    this.modalDataVenta = null;
    this.modalDataMovimiento = null;
    this.modalError = '';
    this.modalCargando = true;
    if (this.modalInstance) this.modalInstance.show();

    if (fila.tipoRef === 'COMPRA') {
      forkJoin({
        compra: this.comprasService.obtener_compras_id(id),
        detalle: this.comprasService.obtener_detalle_compras_idcompra(id)
      }).subscribe({
        next: (res) => {
          const detalle = Array.isArray(res.detalle) ? res.detalle : (res.detalle?.data ? (Array.isArray(res.detalle.data) ? res.detalle.data : []) : []);
          this.modalDataCompra = { compra: res.compra, detalle };
          this.modalCargando = false;
        },
        error: () => {
          this.modalError = 'No se pudo cargar el detalle de la compra.';
          this.modalCargando = false;
        }
      });
    } else if (fila.tipoRef === 'VENTA') {
      const idVenta = parseInt(id, 10);
      this.ventasService.getComprobanteParaPdf(idVenta).subscribe({
        next: (res) => {
          this.modalDataVenta = res.data ?? null;
          this.modalCargando = false;
        },
        error: () => {
          this.modalError = 'No se pudo cargar el detalle de la venta.';
          this.modalCargando = false;
        }
      });
    } else {
      const idMov = parseInt(id, 10);
      this.movimientoService.obtenerMovimientoPorId(idMov).subscribe({
        next: (mov) => {
          this.modalDataMovimiento = mov;
          this.modalCargando = false;
        },
        error: () => {
          this.modalError = 'No se pudo cargar el detalle del movimiento.';
          this.modalCargando = false;
        }
      });
    }
  }

  cerrarModal(): void {
    if (this.modalInstance) this.modalInstance.hide();
  }

  formatearFecha(iso: string | undefined): string {
    if (iso == null || iso === '') return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  formatearMoneda(n: number | undefined): string {
    if (n == null || (typeof n === 'number' && isNaN(n))) return '—';
    return Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  imprimir(): void {
    window.print();
  }

  exportarPdf(): void {
    window.print();
  }

  exportarExcel(): void {
    if (!this.data?.producto || !this.data?.filas) {
      iziToast.warning({ title: 'Sin datos', message: 'Busque un producto primero.', position: 'topRight' });
      return;
    }
    const cols = ['Fecha', 'TipoMov', 'NroDocum', 'Estado', 'Entrada Cant', 'Entrada P.Unit', 'Entrada Importe', 'Salida Cant', 'Salida P.Unit', 'Salida Importe', 'Saldo Cant', 'Saldo P.Unit', 'Saldo Importe'];
    const rows: any[][] = [];
    rows.push(['***SALDO INICIAL***', '', '', '', '', '', '', '', '', '', this.data.saldoInicial?.cantidad ?? 0, this.data.saldoInicial?.pUnitario ?? 0, this.data.saldoInicial?.importe ?? 0]);
    for (const f of this.data.filas) {
      rows.push([
        this.formatearFecha(f.fecha),
        f.tipoMov,
        f.nroDocum,
        f.estadoComprobante || '',
        f.cantidadEntrada || '',
        f.pUnitarioEntrada || '',
        f.importeEntrada || '',
        f.cantidadSalida || '',
        f.pUnitarioSalida || '',
        f.importeSalida || '',
        f.saldoCantidad,
        f.saldoPUnitario,
        f.saldoImporte
      ]);
    }
    if (this.data.totales) {
      rows.push([
        'TOTALES', '', '', '',
        this.data.totales.totalEntradaCantidad, '', this.data.totales.totalEntradaImporte,
        this.data.totales.totalSalidaCantidad, '', this.data.totales.totalSalidaImporte,
        this.data.totales.saldoFinalCantidad,
        this.data.totales.saldoFinalPUnitario ?? '',
        this.data.totales.saldoFinalImporte
      ]);
    }
    const excelData: ExcelData = {
      title: `Kardex ${this.data.producto?.codigo ?? ''}`,
      filename: `kardex_${this.data.producto?.codigo ?? 'producto'}_${this.formatearFecha(this.form.get('fechaDesde')?.value) || ''}_${this.formatearFecha(this.form.get('fechaHasta')?.value) || ''}`.replace(/\//g, '-'),
      columns: cols,
      rows,
      worksheetName: 'Kardex'
    };
    this.excelService.generarExcel(excelData).subscribe({
      next: (blob) => {
        this.excelService.descargar(blob, excelData.filename + '.xlsx');
        iziToast.success({ title: 'Excel', message: 'Exportado correctamente', position: 'topRight' });
      },
      error: (err) => {
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo generar el Excel', position: 'topRight' });
      }
    });
  }
}
