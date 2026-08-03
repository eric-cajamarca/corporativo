import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MovimientoInventarioService } from '../../../services/movimiento-inventario.service';
import { ExcelService, ExcelData } from '../../../services/excel.service';
import { PdfService } from '../../../services/pdf.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { BuscadorProductosModalService } from '../../../services/buscador-productos-modal.service';
import { CategoriaService } from '../../../services/categoria.service';
import { IndexClientesComponent } from '../../clientes/index-clientes/index-clientes.component';
import { ProductoVendidoFila, ProductosVendidosTotales } from '../../../models/productos-vendidos.model';
import { getFechaHoyLocal } from '../../../utils/fecha-local.util';

declare const iziToast: { success: (o: object) => void; error: (o: object) => void };

interface CategoriaOpcion {
  idCategoria: string | number;
  nombre: string;
}

@Component({
  selector: 'app-productos-vendidos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IndexClientesComponent],
  templateUrl: './productos-vendidos.component.html',
  styleUrl: './productos-vendidos.component.css'
})
export class ProductosVendidosComponent implements OnInit {
  sidebarState = inject(SidebarStateService);
  private inventarioService = inject(MovimientoInventarioService);
  private excelService = inject(ExcelService);
  private pdfService = inject(PdfService);
  private buscadorProductosModal = inject(BuscadorProductosModalService);
  private categoriaService = inject(CategoriaService);

  fechaDesde = '';
  fechaHasta = '';
  idCliente = '';
  clienteRuc = '';
  clienteRazon = '';
  filtroCategoria = '';
  filtroProducto = '';
  agrupar = false;
  /** false = vendidos, true = no vendidos en el período */
  soloNoVendidos = false;
  buscar = '';

  items: ProductoVendidoFila[] = [];
  totales: ProductosVendidosTotales = { cantidad: 0, costo: 0, venta: 0, utilidad: 0 };
  cargando = false;
  mostrarColumnaEmpresa = false;

  mostrarModalCliente = false;
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
      .obtenerProductosVendidos({
        fechaDesde: this.fechaDesde,
        fechaHasta: this.fechaHasta,
        idCliente: this.idCliente || null,
        clienteRuc: this.clienteRuc || null,
        clienteRazon: this.clienteRazon || null,
        categoria: this.filtroCategoria || null,
        producto: this.filtroProducto || null,
        agrupar: this.soloNoVendidos ? true : this.agrupar,
        buscar: this.buscar || null,
        soloNoVendidos: this.soloNoVendidos
      })
      .subscribe({
        next: (res) => {
          this.items = res.items || [];
          this.totales = res.totales || { cantidad: 0, costo: 0, venta: 0, utilidad: 0 };
          const empresas = new Set(this.items.map((i) => i.idEmpresa));
          this.mostrarColumnaEmpresa = empresas.size > 1;
          this.cargando = false;
        },
        error: (err) => {
          this.cargando = false;
          const msg = err?.error?.message || 'No se pudo cargar el reporte';
          iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
          this.items = [];
          this.totales = { cantidad: 0, costo: 0, venta: 0, utilidad: 0 };
        }
      });
  }

  refrescar(): void {
    this.cargar();
  }

  setModoVendidos(noVendidos: boolean): void {
    this.soloNoVendidos = noVendidos;
    this.cargar();
  }

  onClienteManual(): void {
    this.idCliente = '';
    this.cargar();
  }

  todosCliente(): void {
    this.idCliente = '';
    this.clienteRuc = '';
    this.clienteRazon = '';
    this.cargar();
  }

  todosCategoria(): void {
    this.filtroCategoria = '';
    this.cargar();
  }

  setAgrupar(v: boolean): void {
    if (this.soloNoVendidos) return;
    this.agrupar = v;
    this.cargar();
  }

  limpiarFiltros(): void {
    const hoy = getFechaHoyLocal();
    this.fechaDesde = hoy;
    this.fechaHasta = hoy;
    this.idCliente = '';
    this.clienteRuc = '';
    this.clienteRazon = '';
    this.filtroCategoria = '';
    this.filtroProducto = '';
    this.agrupar = false;
    this.soloNoVendidos = false;
    this.buscar = '';
    this.cargar();
  }

  abrirModalCliente(): void {
    this.mostrarModalCliente = true;
  }

  cerrarModalCliente(): void {
    this.mostrarModalCliente = false;
  }

  seleccionarCliente(cliente: {
    idCliente?: string | number;
    id?: string | number;
    ruc?: string;
    rSocial?: string;
    r_Social?: string;
    nombre?: string;
  }): void {
    this.idCliente = String(cliente?.idCliente ?? cliente?.id ?? '').trim();
    this.clienteRuc = String(cliente?.ruc ?? '').trim();
    this.clienteRazon = String(cliente?.rSocial ?? cliente?.r_Social ?? cliente?.nombre ?? '').trim();
    this.cerrarModalCliente();
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
    const titulo = this.soloNoVendidos ? 'Productos no vendidos' : 'Productos vendidos';
    const cols = this.mostrarColumnaEmpresa
      ? ['#', 'Fecha', 'Producto', 'Empresa', 'Cantidad', 'Costo', 'Venta', 'Utilidad']
      : ['#', 'Fecha', 'Producto', 'Cantidad', 'Costo', 'Venta', 'Utilidad'];
    const rows = this.items.map((r, i) => {
      const base: (string | number)[] = [i + 1, r.fecha || '', r.producto];
      if (this.mostrarColumnaEmpresa) {
        base.push(r.aliasEmpresa);
      }
      base.push(r.cantidad, r.costo, r.venta, r.utilidad);
      return base;
    });
    rows.push([]);
    rows.push([
      'Total',
      '',
      '',
      ...(this.mostrarColumnaEmpresa ? [''] : []),
      this.totales.cantidad,
      this.totales.costo,
      this.totales.venta,
      this.totales.utilidad
    ]);
    const excelData: ExcelData = {
      title: titulo,
      filename: `${this.soloNoVendidos ? 'productos_no_vendidos' : 'productos_vendidos'}_${Date.now()}`,
      worksheetName: this.soloNoVendidos ? 'No vendidos' : 'Vendidos',
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
    const titulo = this.soloNoVendidos ? 'Productos no vendidos' : 'Productos vendidos';
    const columnas = this.mostrarColumnaEmpresa
      ? ['#', 'Fecha', 'Producto', 'Empresa', 'Cantidad', 'Costo', 'Venta', 'Utilidad']
      : ['#', 'Fecha', 'Producto', 'Cantidad', 'Costo', 'Venta', 'Utilidad'];
    const filas = this.items.map((r, i) => {
      const row: (string | number)[] = [i + 1, r.fecha || '', r.producto];
      if (this.mostrarColumnaEmpresa) {
        row.push(r.aliasEmpresa);
      }
      row.push(r.cantidad, r.costo, r.venta, r.utilidad);
      return row;
    });
    filas.push(['Total', '', '', ...(this.mostrarColumnaEmpresa ? [''] : []), this.totales.cantidad, this.totales.costo, this.totales.venta, this.totales.utilidad]);
    this.pdfService
      .generarPdfDinamico({ titulo, columnas, filas }, 'lista-compras', 8)
      .subscribe({
        next: (blob) => {
          this.pdfService.descargar(
            blob,
            `${this.soloNoVendidos ? 'productos_no_vendidos' : 'productos_vendidos'}_${Date.now()}.pdf`
          );
          iziToast.success({ title: 'PDF', message: 'Generado correctamente', position: 'topRight' });
        },
        error: () => {
          iziToast.error({ title: 'Error', message: 'No se pudo generar el PDF', position: 'topRight' });
        }
      });
  }

  trackFila(_i: number, r: ProductoVendidoFila): string {
    if (r.idDetalle != null && r.idVenta != null) {
      return `${r.idVenta}-${r.idDetalle}`;
    }
    return `${r.idEmpresa}-${r.idProducto}`;
  }
}
