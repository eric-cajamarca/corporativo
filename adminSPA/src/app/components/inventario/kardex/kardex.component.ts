import { Component, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  MovimientoInventarioService,
  KardexResponse,
  KardexCompletoResponse,
  KardexFila,
  MovimientoDetalle
} from '../../../services/movimiento-inventario.service';
import { ComprasService } from '../../../services/compras.service';
import { BuscadorProductosModalService } from '../../../services/buscador-productos-modal.service';
import { ProductoSeleccionado } from '../../shared/buscador-productos-modal/buscador-productos-modal.component';
import { VentasService, ComprobantePdfData } from '../../../services/ventas.service';
import { ExcelService, ExcelData } from '../../../services/excel.service';
import { PdfService } from '../../../services/pdf.service';
import { EmpresaService } from '../../../services/empresa.service';
import { formatFechaLocal } from '../../../utils/fecha-local.util';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { forkJoin, Observable } from 'rxjs';

declare var iziToast: any;
declare var bootstrap: any;

@Component({
  selector: 'app-kardex',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule],
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
  private pdfService = inject(PdfService);
  private empresaService = inject(EmpresaService);
  private fb = inject(FormBuilder);

  form: FormGroup;
  productoSeleccionado: { idProducto: string; codigo: string; descripcion: string } | null = null;
  data: KardexResponse | null = null;
  cargando = false;
  exportandoPdfProducto = false;
  exportandoExcelCompleto = false;
  exportandoPdfCompleto = false;
  filtroTexto = '';

  get exportandoCompleto(): boolean {
    return this.exportandoExcelCompleto || this.exportandoPdfCompleto;
  }

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

  private payloadEmpresaPdf(extra?: {
    razonSocial?: string;
    nombre?: string;
    ruc?: string;
    direccion?: string;
    telefono?: string;
    correo?: string;
    rubro?: string;
    establecimiento?: string;
  }): Record<string, string> {
    const emp = this.empresaService.getEmpresaActual();
    return {
      razonSocial: extra?.razonSocial || emp?.nombre || '',
      nombre: extra?.nombre || extra?.razonSocial || emp?.nombre || '',
      ruc: extra?.ruc || emp?.ruc || '',
      direccion: extra?.direccion || emp?.direccion || '',
      telefono: extra?.telefono || emp?.telefono || '',
      correo: extra?.correo || emp?.correo || '',
      rubro: extra?.rubro || emp?.rubro || '',
      establecimiento: extra?.establecimiento || 'ALMACEN GENERAL'
    };
  }

  /** PDF del kardex del producto (solo encabezado empresa + tabla, sin UI de la pantalla). */
  exportarPdf(): void {
    if (!this.data?.producto || !this.data?.filas) {
      iziToast.warning({ title: 'Sin datos', message: 'Busque un producto primero.', position: 'topRight' });
      return;
    }
    const fechaDesde = this.form.get('fechaDesde')?.value || '';
    const fechaHasta = this.form.get('fechaHasta')?.value || '';
    const filename = `kardex_${this.data.producto.codigo || 'producto'}_${this.formatearFecha(fechaDesde)}_${this.formatearFecha(fechaHasta)}.pdf`.replace(/\//g, '-');
    this.exportandoPdfProducto = true;
    this.pdfService.generarPdfKardexProducto({
      empresa: this.payloadEmpresaPdf(),
      producto: this.data.producto,
      saldoInicial: this.data.saldoInicial,
      filas: this.data.filas,
      totales: this.data.totales,
      fechaDesde,
      fechaHasta,
      nombreArchivo: filename
    }, filename).subscribe({
      next: (blob) => {
        this.exportandoPdfProducto = false;
        this.pdfService.descargar(blob, filename);
        iziToast.success({ title: 'PDF', message: 'Kardex exportado correctamente', position: 'topRight' });
      },
      error: (err) => {
        this.exportandoPdfProducto = false;
        iziToast.error({
          title: 'Error',
          message: err?.error?.message || 'No se pudo generar el PDF del kardex',
          position: 'topRight'
        });
      }
    });
  }

  exportarExcel(): void {
    if (!this.productoSeleccionado) {
      this.exportarExcelCompleto();
      return;
    }
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

  private nombreArchivoFormato131(fechaDesde: string, fechaHasta: string): string {
    return `formato_13.1_kardex_${this.formatearFecha(fechaDesde)}_${this.formatearFecha(fechaHasta)}`.replace(/\//g, '-');
  }

  private cargarKardexCompleto(): Observable<KardexCompletoResponse> | null {
    const fechaDesde = this.form.get('fechaDesde')?.value || '';
    const fechaHasta = this.form.get('fechaHasta')?.value || '';
    if (!fechaDesde || !fechaHasta) {
      iziToast.warning({ title: 'Periodo requerido', message: 'Seleccione fecha desde y hasta.', position: 'topRight' });
      return null;
    }
    return this.movimientoService.obtenerKardexCompleto(fechaDesde, fechaHasta);
  }

  /** Formato 13.1 Excel: todos los productos de la empresa logueada. */
  exportarExcelCompleto(): void {
    const fechaDesde = this.form.get('fechaDesde')?.value || '';
    const fechaHasta = this.form.get('fechaHasta')?.value || '';
    const req$ = this.cargarKardexCompleto();
    if (!req$) return;

    this.exportandoExcelCompleto = true;
    req$.subscribe({
      next: (resp) => {
        if (!resp?.productos?.length) {
          this.exportandoExcelCompleto = false;
          iziToast.warning({
            title: 'Sin datos',
            message: 'No hay productos con movimientos o saldo en el periodo.',
            position: 'topRight'
          });
          return;
        }
        const filename = this.nombreArchivoFormato131(fechaDesde, fechaHasta);
        this.excelService.generarExcelKardex131({
          empresa: resp.empresa,
          periodo: resp.periodo,
          productos: resp.productos,
          filename
        }).subscribe({
          next: (blob) => {
            this.exportandoExcelCompleto = false;
            this.excelService.descargar(blob, filename + '.xlsx');
            iziToast.success({
              title: 'Excel',
              message: `Formato 13.1 exportado (${resp.productos.length} productos)`,
              position: 'topRight'
            });
          },
          error: (err) => {
            this.exportandoExcelCompleto = false;
            iziToast.error({
              title: 'Error',
              message: err?.error?.message || 'No se pudo generar el Excel formato 13.1',
              position: 'topRight'
            });
          }
        });
      },
      error: (err) => {
        this.exportandoExcelCompleto = false;
        iziToast.error({
          title: 'Error',
          message: err?.error?.message || 'No se pudo obtener el kardex completo',
          position: 'topRight'
        });
      }
    });
  }

  /** Formato 13.1 PDF: todos los productos de la empresa logueada. */
  exportarPdfCompleto(): void {
    const fechaDesde = this.form.get('fechaDesde')?.value || '';
    const fechaHasta = this.form.get('fechaHasta')?.value || '';
    const req$ = this.cargarKardexCompleto();
    if (!req$) return;

    this.exportandoPdfCompleto = true;
    req$.subscribe({
      next: (resp) => {
        if (!resp?.productos?.length) {
          this.exportandoPdfCompleto = false;
          iziToast.warning({
            title: 'Sin datos',
            message: 'No hay productos con movimientos o saldo en el periodo.',
            position: 'topRight'
          });
          return;
        }
        const filename = this.nombreArchivoFormato131(fechaDesde, fechaHasta) + '.pdf';
        this.pdfService.generarPdfKardex131({
          empresa: this.payloadEmpresaPdf(resp.empresa),
          periodo: resp.periodo,
          productos: resp.productos,
          nombreArchivo: filename
        }, filename).subscribe({
          next: (blob) => {
            this.exportandoPdfCompleto = false;
            this.pdfService.descargar(blob, filename);
            iziToast.success({
              title: 'PDF',
              message: `Formato 13.1 exportado (${resp.productos.length} productos)`,
              position: 'topRight'
            });
          },
          error: (err) => {
            this.exportandoPdfCompleto = false;
            iziToast.error({
              title: 'Error',
              message: err?.error?.message || 'No se pudo generar el PDF formato 13.1',
              position: 'topRight'
            });
          }
        });
      },
      error: (err) => {
        this.exportandoPdfCompleto = false;
        iziToast.error({
          title: 'Error',
          message: err?.error?.message || 'No se pudo obtener el kardex completo',
          position: 'topRight'
        });
      }
    });
  }
}
