import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MovimientoInventarioService } from '../../../services/movimiento-inventario.service';
import { ExcelService, ExcelData } from '../../../services/excel.service';
import { PdfService } from '../../../services/pdf.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { ProductoVendidoFila, ProductosVendidosTotales } from '../../../models/productos-vendidos.model';

declare const iziToast: { success: (o: object) => void; error: (o: object) => void };

@Component({
  selector: 'app-productos-vendidos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TopnavComponent, SidebarComponent],
  templateUrl: './productos-vendidos.component.html',
  styleUrl: './productos-vendidos.component.css'
})
export class ProductosVendidosComponent implements OnInit {
  sidebarState = inject(SidebarStateService);
  private inventarioService = inject(MovimientoInventarioService);
  private excelService = inject(ExcelService);
  private pdfService = inject(PdfService);

  fechaDesde = '';
  fechaHasta = '';
  clienteRuc = '';
  clienteRazon = '';
  filtroCategoria = '';
  filtroProducto = '';
  agrupar = false;
  buscar = '';

  items: ProductoVendidoFila[] = [];
  totales: ProductosVendidosTotales = { cantidad: 0, costo: 0, venta: 0, utilidad: 0 };
  cargando = false;
  mostrarColumnaEmpresa = false;

  private buscarSubject = new Subject<string>();

  ngOnInit(): void {
    const hoy = new Date();
    const s = hoy.toISOString().slice(0, 10);
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
        clienteRuc: this.clienteRuc || null,
        clienteRazon: this.clienteRazon || null,
        categoria: this.filtroCategoria || null,
        producto: this.filtroProducto || null,
        agrupar: this.agrupar,
        buscar: this.buscar || null
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

  todosCliente(): void {
    this.clienteRuc = '';
    this.clienteRazon = '';
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
    const hoy = new Date().toISOString().slice(0, 10);
    this.fechaDesde = hoy;
    this.fechaHasta = hoy;
    this.clienteRuc = '';
    this.clienteRazon = '';
    this.filtroCategoria = '';
    this.filtroProducto = '';
    this.agrupar = false;
    this.buscar = '';
    this.cargar();
  }

  exportarExcel(): void {
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
      title: 'Productos vendidos',
      filename: `productos_vendidos_${Date.now()}`,
      worksheetName: 'Vendidos',
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
      .generarPdfDinamico({ titulo: 'Productos vendidos', columnas, filas }, 'lista-compras', 8)
      .subscribe({
        next: (blob) => {
          this.pdfService.descargar(blob, `productos_vendidos_${Date.now()}.pdf`);
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
