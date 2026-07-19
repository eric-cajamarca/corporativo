import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MovimientoInventarioService } from '../../../services/movimiento-inventario.service';
import { SucursalService } from '../../../services/sucursal.service';
import { ExcelService, ExcelData } from '../../../services/excel.service';
import { PdfService } from '../../../services/pdf.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { StockActualItem } from '../../../models/stock-actual.model';
import { Sucursal } from '../../../interfaces/sucursal-interface';

declare const iziToast: { success: (o: object) => void; error: (o: object) => void };

@Component({
  selector: 'app-stock-actual',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './stock-actual.component.html',
  styleUrl: './stock-actual.component.css'
})
export class StockActualComponent implements OnInit {
  sidebarState = inject(SidebarStateService);
  private inventarioService = inject(MovimientoInventarioService);
  private sucursalService = inject(SucursalService);
  private excelService = inject(ExcelService);
  private pdfService = inject(PdfService);

  sucursales: Sucursal[] = [];
  idSucursal = '';
  filtroCategoria = '';
  filtroMarca = '';
  filtroStock: 'todos' | 'cero' | 'minimo' = 'todos';
  buscar = '';

  items: StockActualItem[] = [];
  totalProductos = 0;
  totalValorizado = 0;
  cargando = false;
  mostrarColumnaEmpresa = false;

  private buscarSubject = new Subject<string>();

  ngOnInit(): void {
    this.buscarSubject.pipe(debounceTime(400), distinctUntilChanged()).subscribe(() => this.cargar());
    this.cargarSucursales();
    this.cargar();
  }

  private cargarSucursales(): void {
    this.sucursalService.obtener_sucursal_idempresa1().subscribe({
      next: (res) => {
        const d = res?.data;
        this.sucursales = Array.isArray(d) ? d : [];
      },
      error: () => {
        this.sucursales = [];
      }
    });
  }

  onBuscarInput(): void {
    this.buscarSubject.next(this.buscar);
  }

  cargar(): void {
    this.cargando = true;
    this.inventarioService
      .obtenerStockActual({
        idSucursal: this.idSucursal?.trim() ? this.idSucursal.trim() : null,
        categoria: this.filtroCategoria || null,
        marca: this.filtroMarca || null,
        filtroStock: this.filtroStock,
        buscar: this.buscar || null
      })
      .subscribe({
        next: (res) => {
          this.items = res.items || [];
          this.totalProductos = res.totalProductos ?? this.items.length;
          this.totalValorizado = Number(res.totalValorizado) || 0;
          const empresas = new Set(this.items.map((i) => i.idEmpresa));
          this.mostrarColumnaEmpresa = empresas.size > 1;
          this.cargando = false;
        },
        error: (err) => {
          this.cargando = false;
          const msg = err?.error?.message || 'No se pudo cargar el stock actual';
          iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
          this.items = [];
          this.totalProductos = 0;
          this.totalValorizado = 0;
        }
      });
  }

  refrescar(): void {
    this.cargar();
  }

  sincronizar(): void {
    this.cargar();
    iziToast.success({ title: 'Actualizado', message: 'Datos recargados', position: 'topRight' });
  }

  limpiarFiltros(): void {
    this.filtroCategoria = '';
    this.filtroMarca = '';
    this.filtroStock = 'todos';
    this.buscar = '';
    this.idSucursal = '';
    this.cargar();
  }

  todosCategoria(): void {
    this.filtroCategoria = '';
    this.cargar();
  }

  todosMarca(): void {
    this.filtroMarca = '';
    this.cargar();
  }

  setFiltroStock(v: 'todos' | 'cero' | 'minimo'): void {
    this.filtroStock = v;
    this.cargar();
  }

  onSucursalChange(): void {
    this.cargar();
  }

  exportarExcel(): void {
    const cols = this.mostrarColumnaEmpresa
      ? ['#', 'Código', 'Producto', 'Categoría', 'Marca', 'Empresa', 'Stock', 'Und.', 'Valorizado']
      : ['#', 'Código', 'Producto', 'Categoría', 'Marca', 'Stock', 'Und.', 'Valorizado'];
    const rows = this.items.map((r, i) => {
      const base = [
        i + 1,
        r.codigo,
        r.descripcion,
        r.categoria,
        r.marca
      ];
      if (this.mostrarColumnaEmpresa) {
        base.push(r.aliasEmpresa);
      }
      base.push(Number(r.stock), r.unidad || 'UND', Number(r.valorizado) || 0);
      return base;
    });
    const excelData: ExcelData = {
      title: 'Stock actual',
      filename: `stock_actual_${Date.now()}`,
      worksheetName: 'Stock',
      columns: cols,
      rows
    };
    this.excelService.generarExcel(excelData).subscribe({
      next: (blob) => {
        this.excelService.descargar(blob, excelData.filename + '.xlsx');
        iziToast.success({ title: 'Excel', message: 'Exportado correctamente', position: 'topRight' });
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo generar el Excel (¿pdf-backend en 3002?)', position: 'topRight' });
      }
    });
  }

  exportarPdf(): void {
    const columnas = this.mostrarColumnaEmpresa
      ? ['#', 'Código', 'Producto', 'Categoría', 'Marca', 'Empresa', 'Stock', 'Und.']
      : ['#', 'Código', 'Producto', 'Categoría', 'Marca', 'Stock', 'Und.'];
    const filas = this.items.map((r, i) => {
      const row: (string | number)[] = [i + 1, r.codigo, r.descripcion, r.categoria, r.marca];
      if (this.mostrarColumnaEmpresa) {
        row.push(r.aliasEmpresa);
      }
      row.push(Number(r.stock), r.unidad || 'UND');
      return row;
    });
    const datos = {
      titulo: 'Stock actual',
      columnas,
      filas
    };
    this.pdfService.generarPdfDinamico(datos, 'lista-compras', 9).subscribe({
      next: (blob) => {
        this.pdfService.descargar(blob, `stock_actual_${Date.now()}.pdf`);
        iziToast.success({ title: 'PDF', message: 'Generado correctamente', position: 'topRight' });
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo generar el PDF (¿pdf-backend en 3002?)', position: 'topRight' });
      }
    });
  }
  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
