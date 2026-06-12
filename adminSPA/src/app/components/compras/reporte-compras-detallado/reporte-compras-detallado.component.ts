import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ComprasService } from '../../../services/compras.service';
import { EmpresaService } from '../../../services/empresa.service';
import { ExcelService } from '../../../services/excel.service';
import { PdfService } from '../../../services/pdf.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { Empresa } from '../../../models/empresa.model';
import {
  ComprobanteCompraDetalleReporte,
  ReporteComprasDetalladoData,
  TotalesCompraDetalleReporte,
} from '../../../models/reporte-compras-detallado.model';

declare const iziToast: {
  success: (o: object) => void;
  error: (o: object) => void;
};

@Component({
  selector: 'app-reporte-compras-detallado',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TopnavComponent, SidebarComponent],
  templateUrl: './reporte-compras-detallado.component.html',
  styleUrl: './reporte-compras-detallado.component.css',
})
export class ReporteComprasDetalladoComponent implements OnInit {
  sidebarState = inject(SidebarStateService);
  private comprasService = inject(ComprasService);
  private empresaService = inject(EmpresaService);
  private excelService = inject(ExcelService);
  private pdfService = inject(PdfService);

  empresa: Empresa | null = null;
  fechaInicio = '';
  fechaFin = '';
  proveedorRuc = '';
  proveedorRazon = '';
  busqueda = '';

  comprobantes: ComprobanteCompraDetalleReporte[] = [];
  totales: TotalesCompraDetalleReporte = {
    subTotal: 0,
    igv: 0,
    descuentos: 0,
    total: 0,
    cantidadComprobantes: 0,
  };

  cargando = false;
  exportandoPdf = false;
  exportandoExcel = false;
  error = '';

  ngOnInit(): void {
    this.inicializarFechas();
    this.empresaService.getEmpresa$().subscribe((emp) => {
      this.empresa = emp;
    });
    this.cargar();
  }

  private inicializarFechas(): void {
    const hoy = new Date();
    const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.fechaInicio = fmt(inicioAnio);
    this.fechaFin = fmt(hoy);
  }

  get comprobantesFiltrados(): ComprobanteCompraDetalleReporte[] {
    const q = this.busqueda.trim().toLowerCase();
    if (!q) return this.comprobantes;
    return this.comprobantes.filter((c) => {
      const hay = [
        c.proveedor,
        c.ruc,
        c.documento,
        c.fecha,
        c.estado,
        ...(c.lineas || []).map((l) => `${l.codigo} ${l.producto}`),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  cargar(): void {
    this.error = '';
    if (!this.fechaInicio || !this.fechaFin) {
      this.error = 'Seleccione fecha inicio y fin';
      return;
    }
    this.cargando = true;
    this.comprasService
      .obtenerReporteDetallado({
        fechaInicio: this.fechaInicio,
        fechaFin: this.fechaFin,
        proveedorRuc: this.proveedorRuc,
        proveedorRazon: this.proveedorRazon,
      })
      .subscribe({
        next: (res) => {
          const data: ReporteComprasDetalladoData = res.data;
          this.comprobantes = data?.comprobantes || [];
          this.totales = data?.totales || {
            subTotal: 0,
            igv: 0,
            descuentos: 0,
            total: 0,
            cantidadComprobantes: 0,
          };
          this.cargando = false;
        },
        error: (err) => {
          this.cargando = false;
          this.comprobantes = [];
          this.totales = {
            subTotal: 0,
            igv: 0,
            descuentos: 0,
            total: 0,
            cantidadComprobantes: 0,
          };
          this.error = err?.error?.message || 'No se pudo cargar el reporte';
        },
      });
  }

  limpiarFiltros(): void {
    this.proveedorRuc = '';
    this.proveedorRazon = '';
    this.busqueda = '';
    this.inicializarFechas();
    this.cargar();
  }

  private payloadExportacion(): Record<string, unknown> {
    return {
      empresa: this.empresa
        ? {
            nombre: this.empresa.nombre,
            ruc: this.empresa.ruc,
            direccion: this.empresa.direccion,
            telefono: this.empresa.telefono,
            correo: this.empresa.correo,
          }
        : {},
      fechaInicio: this.fechaInicio,
      fechaFin: this.fechaFin,
      comprobantes: this.comprobantes,
      totales: this.totales,
    };
  }

  private nombreArchivoBase(): string {
    return `Compras_Desde_${this.fechaInicio}_Hasta_${this.fechaFin}`;
  }

  exportarExcel(): void {
    if (this.comprobantes.length === 0) return;
    this.exportandoExcel = true;
    this.excelService.generarExcelComprasDetallado(this.payloadExportacion()).subscribe({
      next: (blob) => {
        this.excelService.descargar(blob, `${this.nombreArchivoBase()}.xlsx`);
        this.exportandoExcel = false;
        iziToast.success({ title: 'Excel', message: 'Reporte exportado', position: 'topRight' });
      },
      error: () => {
        this.exportandoExcel = false;
        iziToast.error({ title: 'Error', message: 'No se pudo generar el Excel', position: 'topRight' });
      },
    });
  }

  exportarPdf(): void {
    if (this.comprobantes.length === 0) return;
    this.exportandoPdf = true;
    this.pdfService.generarPdfComprasDetallado(this.payloadExportacion(), `${this.nombreArchivoBase()}.pdf`).subscribe({
      next: (blob) => {
        this.pdfService.descargar(blob, `${this.nombreArchivoBase()}.pdf`);
        this.exportandoPdf = false;
        iziToast.success({ title: 'PDF', message: 'Reporte generado', position: 'topRight' });
      },
      error: () => {
        this.exportandoPdf = false;
        iziToast.error({ title: 'Error', message: 'No se pudo generar el PDF', position: 'topRight' });
      },
    });
  }

  trackComprobante(_i: number, c: ComprobanteCompraDetalleReporte): string {
    return c.idCompra;
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
