import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MovimientoInventarioService } from '../../../services/movimiento-inventario.service';
import { ComprobanteService } from '../../../services/comprobante.service';
import { ExcelService, ExcelData } from '../../../services/excel.service';
import { PdfService } from '../../../services/pdf.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { BuscadorProductosModalService } from '../../../services/buscador-productos-modal.service';
import { CategoriaService } from '../../../services/categoria.service';
import { IndexProveedorComponent } from '../../proveedores/index-proveedor/index-proveedor.component';
import { ProductoCompradoFila, ProductosCompradosTotales } from '../../../models/productos-comprados.model';
import { getFechaHoyLocal } from '../../../utils/fecha-local.util';

declare const iziToast: { success: (o: object) => void; error: (o: object) => void };

interface ComprobanteCompraOpcion {
  idComprobante: number;
  nombre: string;
  codigo?: string;
}

interface CategoriaOpcion {
  idCategoria: string | number;
  nombre: string;
}

@Component({
  selector: 'app-productos-comprados',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IndexProveedorComponent],
  templateUrl: './productos-comprados.component.html',
  styleUrl: './productos-comprados.component.css'
})
export class ProductosCompradosComponent implements OnInit {
  sidebarState = inject(SidebarStateService);
  private inventarioService = inject(MovimientoInventarioService);
  private comprobanteService = inject(ComprobanteService);
  private excelService = inject(ExcelService);
  private pdfService = inject(PdfService);
  private buscadorProductosModal = inject(BuscadorProductosModalService);
  private categoriaService = inject(CategoriaService);

  fechaDesde = '';
  fechaHasta = '';
  idProveedor = '';
  proveedorRuc = '';
  proveedorRazon = '';
  idComprobante = '';
  filtroCategoria = '';
  filtroProducto = '';
  agrupar = false;
  buscar = '';

  tiposComprobanteCompra: ComprobanteCompraOpcion[] = [];

  items: ProductoCompradoFila[] = [];
  totales: ProductosCompradosTotales = { cantidad: 0, importe: 0 };
  cargando = false;
  mostrarColumnaEmpresa = false;

  mostrarModalProveedor = false;
  mostrarModalCategoria = false;
  categorias: CategoriaOpcion[] = [];
  categoriasFiltradas: CategoriaOpcion[] = [];
  buscarCategoriaModal = '';
  cargandoCategorias = false;

  private buscarSubject = new Subject<string>();

  ngOnInit(): void {
    const s = getFechaHoyLocal();
    this.fechaDesde = s;
    this.fechaHasta = s;
    this.buscarSubject.pipe(debounceTime(400), distinctUntilChanged()).subscribe(() => this.cargar());
    this.comprobanteService.obtenerComprobantesCompra().subscribe({
      next: (res) => {
        const raw = res.data || [];
        this.tiposComprobanteCompra = raw.map((c) => ({
          idComprobante: Number(c.idComprobante),
          nombre: String(c.nombre || ''),
          codigo: c.codigo != null ? String(c.codigo) : undefined
        }));
      },
      error: () => {
        this.tiposComprobanteCompra = [];
      }
    });
    this.cargar();
  }

  onBuscarInput(): void {
    this.buscarSubject.next(this.buscar);
  }

  cargar(): void {
    if (!this.fechaDesde || !this.fechaHasta) {
      iziToast.error({ title: 'Fechas', message: 'Indique periodo desde y hasta', position: 'topRight' });
      return;
    }
    this.cargando = true;
    this.inventarioService
      .obtenerProductosComprados({
        fechaDesde: this.fechaDesde,
        fechaHasta: this.fechaHasta,
        idProveedor: this.idProveedor || null,
        proveedorRuc: this.proveedorRuc || null,
        proveedorRazon: this.proveedorRazon || null,
        idComprobante: this.idComprobante || null,
        categoria: this.filtroCategoria || null,
        producto: this.filtroProducto || null,
        agrupar: this.agrupar,
        buscar: this.buscar || null
      })
      .subscribe({
        next: (res) => {
          this.items = res.items || [];
          this.totales = res.totales || { cantidad: 0, importe: 0 };
          const empresas = new Set(this.items.map((i) => i.idEmpresa));
          this.mostrarColumnaEmpresa = empresas.size > 1;
          this.cargando = false;
        },
        error: (err) => {
          this.cargando = false;
          const msg = err?.error?.message || 'No se pudo cargar el reporte';
          iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
          this.items = [];
          this.totales = { cantidad: 0, importe: 0 };
        }
      });
  }

  refrescar(): void {
    this.cargar();
  }

  onProveedorManual(): void {
    this.idProveedor = '';
    this.cargar();
  }

  todosProveedor(): void {
    this.idProveedor = '';
    this.proveedorRuc = '';
    this.proveedorRazon = '';
    this.cargar();
  }

  todosCategoria(): void {
    this.filtroCategoria = '';
    this.cargar();
  }

  setAgrupar(v: boolean): void {
    this.agrupar = v;
    this.cargar();
  }

  limpiarFiltros(): void {
    const hoy = getFechaHoyLocal();
    this.fechaDesde = hoy;
    this.fechaHasta = hoy;
    this.idProveedor = '';
    this.proveedorRuc = '';
    this.proveedorRazon = '';
    this.idComprobante = '';
    this.filtroCategoria = '';
    this.filtroProducto = '';
    this.agrupar = false;
    this.buscar = '';
    this.cargar();
  }

  abrirModalProveedor(): void {
    this.mostrarModalProveedor = true;
  }

  cerrarModalProveedor(): void {
    this.mostrarModalProveedor = false;
  }

  seleccionarProveedor(proveedor: Record<string, unknown>): void {
    this.idProveedor = String(proveedor?.['idProveedor'] ?? proveedor?.['id'] ?? '').trim();
    this.proveedorRuc = String(proveedor?.['ruc'] ?? '').trim();
    this.proveedorRazon = String(
      proveedor?.['rSocial'] ?? proveedor?.['r_Social'] ?? proveedor?.['razonSocial'] ?? ''
    ).trim();
    this.cerrarModalProveedor();
    this.cargar();
  }

  abrirModalCategoria(): void {
    this.mostrarModalCategoria = true;
    this.buscarCategoriaModal = '';
    if (!this.categorias.length) {
      this.cargarCategorias();
    } else {
      this.filtrarCategoriasModal();
    }
  }

  cerrarModalCategoria(): void {
    this.mostrarModalCategoria = false;
  }

  private cargarCategorias(): void {
    this.cargandoCategorias = true;
    this.categoriaService.obtener_categorias().subscribe({
      next: (res) => {
        const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        this.categorias = raw
          .map((c: { idCategoria?: string | number; nombre?: string }) => ({
            idCategoria: c.idCategoria ?? '',
            nombre: String(c.nombre || '').trim()
          }))
          .filter((c: CategoriaOpcion) => !!c.nombre)
          .sort((a: CategoriaOpcion, b: CategoriaOpcion) => a.nombre.localeCompare(b.nombre, 'es'));
        this.filtrarCategoriasModal();
        this.cargandoCategorias = false;
      },
      error: () => {
        this.categorias = [];
        this.categoriasFiltradas = [];
        this.cargandoCategorias = false;
        iziToast.error({ title: 'Error', message: 'No se pudieron cargar las categorías', position: 'topRight' });
      }
    });
  }

  filtrarCategoriasModal(): void {
    const q = this.buscarCategoriaModal.trim().toLowerCase();
    this.categoriasFiltradas = !q
      ? [...this.categorias]
      : this.categorias.filter((c) => c.nombre.toLowerCase().includes(q));
  }

  seleccionarCategoria(cat: CategoriaOpcion): void {
    this.filtroCategoria = cat.nombre;
    this.cerrarModalCategoria();
    this.cargar();
  }

  async abrirBuscadorProducto(): Promise<void> {
    const p = await this.buscadorProductosModal.abrir({ modo: 'catalogo' });
    if (!p) return;
    this.filtroProducto = String(p.codigo || p.descripcion || '').trim();
    this.cargar();
  }

  exportarExcel(): void {
    const cols = this.mostrarColumnaEmpresa
      ? ['#', 'Fecha', 'Producto', 'Empresa', 'Proveedor', 'Cantidad', 'Precio', 'Importe']
      : ['#', 'Fecha', 'Producto', 'Proveedor', 'Cantidad', 'Precio', 'Importe'];
    const rows = this.items.map((r, i) => {
      const base: (string | number)[] = [i + 1, r.fecha || '', r.producto];
      if (this.mostrarColumnaEmpresa) {
        base.push(r.aliasEmpresa);
      }
      base.push(r.proveedor, r.cantidad, r.precio, r.importe);
      return base;
    });
    rows.push([]);
    const totalRow: (string | number)[] = ['Totales', '', '', ''];
    if (this.mostrarColumnaEmpresa) {
      totalRow.push('');
    }
    totalRow.push(this.totales.cantidad, '', this.totales.importe);
    rows.push(totalRow);
    const excelData: ExcelData = {
      title: 'Productos comprados',
      filename: `productos_comprados_${Date.now()}`,
      worksheetName: 'Comprados',
      columns: cols,
      rows
    };
    this.excelService.generarExcel(excelData).subscribe({
      next: (blob) => {
        this.excelService.descargar(blob, excelData.filename + '.xlsx');
        iziToast.success({ title: 'Excel', message: 'Exportado correctamente', position: 'topRight' });
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo generar el Excel', position: 'topRight' });
      }
    });
  }

  exportarPdf(): void {
    const columnas = this.mostrarColumnaEmpresa
      ? ['#', 'Fecha', 'Producto', 'Empresa', 'Proveedor', 'Cantidad', 'Precio', 'Importe']
      : ['#', 'Fecha', 'Producto', 'Proveedor', 'Cantidad', 'Precio', 'Importe'];
    const filas = this.items.map((r, i) => {
      const row: (string | number)[] = [i + 1, r.fecha || '', r.producto];
      if (this.mostrarColumnaEmpresa) {
        row.push(r.aliasEmpresa);
      }
      row.push(r.proveedor, r.cantidad, r.precio, r.importe);
      return row;
    });
    const totalFila: (string | number)[] = ['Totales', '', '', ''];
    if (this.mostrarColumnaEmpresa) {
      totalFila.push('');
    }
    totalFila.push(this.totales.cantidad, '', this.totales.importe);
    filas.push(totalFila);
    this.pdfService
      .generarPdfDinamico({ titulo: 'Productos comprados', columnas, filas }, 'lista-compras', 8)
      .subscribe({
        next: (blob) => {
          this.pdfService.descargar(blob, `productos_comprados_${Date.now()}.pdf`);
          iziToast.success({ title: 'PDF', message: 'Generado correctamente', position: 'topRight' });
        },
        error: () => {
          iziToast.error({ title: 'Error', message: 'No se pudo generar el PDF', position: 'topRight' });
        }
      });
  }

  trackFila(_i: number, r: ProductoCompradoFila): string {
    if (r.idDetalleCompra != null && r.idCompra != null) {
      return `${r.idCompra}-${r.idDetalleCompra}`;
    }
    return `${r.idEmpresa}-${r.idProducto}`;
  }
}
