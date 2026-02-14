import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { VentasService, VentaListado } from '../../../services/ventas.service';
import { PdfService } from '../../../services/pdf.service';
import { numeroALetras } from '../../../utils/numeroALetras';

@Component({
  selector: 'app-index-ventas',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule, SidebarComponent, TopnavComponent, NgbPagination],
  templateUrl: './index-ventas.component.html',
  styleUrl: './index-ventas.component.css'
})
export class IndexVentasComponent implements OnInit {
  sidebarCollapsed = signal<boolean>(false);

  ventas: VentaListado[] = [];
  ventasConst: VentaListado[] = [];
  loading = true;
  ventaSeleccionada: VentaListado | null = null;
  generandoPdf = false;

  page = 1;
  pageSize = 10;

  filtroFecha = 'all';
  fechaDesde = '';
  fechaHasta = '';
  filtroRuc = '';
  filtroRazon = '';
  filtroNumero = '';
  filtroTipoComprobante = '';

  constructor(
    private ventasService: VentasService,
    private pdfService: PdfService
  ) {}

  ngOnInit(): void {
    this.cargarVentas();
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
  }

  cargarVentas(): void {
    this.loading = true;
    this.ventasService.listarVentasEmpresa().subscribe({
      next: (res) => {
        this.ventasConst = res.data ?? [];
        this.ventas = [...this.ventasConst];
        this.loading = false;
      },
      error: () => {
        this.ventasConst = [];
        this.ventas = [];
        this.loading = false;
      }
    });
  }

  aplicarFiltros(): void {
    this.page = 1;
    let list = [...this.ventasConst];

    if (this.filtroFecha === 'today') {
      const hoy = new Date().toISOString().slice(0, 10);
      list = list.filter((v) => (v.fEmision || '').slice(0, 10) === hoy);
    } else if (this.filtroFecha === 'month') {
      const now = new Date();
      const mes = String(now.getMonth() + 1).padStart(2, '0');
      const anio = now.getFullYear();
      list = list.filter((v) => {
        const f = (v.fEmision || '').slice(0, 10);
        return f.startsWith(`${anio}-${mes}`);
      });
    } else if (this.filtroFecha === 'range' && (this.fechaDesde || this.fechaHasta)) {
      if (this.fechaDesde) list = list.filter((v) => (v.fEmision || '').slice(0, 10) >= this.fechaDesde);
      if (this.fechaHasta) list = list.filter((v) => (v.fEmision || '').slice(0, 10) <= this.fechaHasta);
    }

    const ruc = (this.filtroRuc || '').toLowerCase().trim();
    if (ruc) list = list.filter((v) => (v.clienteRuc || '').toLowerCase().includes(ruc));

    const razon = (this.filtroRazon || '').toLowerCase().trim();
    if (razon) list = list.filter((v) => (v.clienteRazonSocial || '').toLowerCase().includes(razon));

    const num = (this.filtroNumero || '').trim();
    if (num) list = list.filter((v) => (v.compVenta || '').toLowerCase().includes(num.toLowerCase()));

    const tipo = (this.filtroTipoComprobante || '').trim();
    if (tipo) list = list.filter((v) => (v.nombreComprobante || '').toLowerCase().includes(tipo.toLowerCase()));

    this.ventas = list;
  }

  limpiarFiltros(): void {
    this.page = 1;
    this.filtroFecha = 'all';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.filtroRuc = '';
    this.filtroRazon = '';
    this.filtroNumero = '';
    this.filtroTipoComprobante = '';
    this.ventas = [...this.ventasConst];
  }

  estadoSunatLabel(idEstadoSunat: number | undefined): string {
    if (idEstadoSunat == null) return 'Pendiente';
    if (idEstadoSunat === 1 || idEstadoSunat === 2) return 'Aceptado';
    return 'Rechazado';
  }

  estadoSunatClass(idEstadoSunat: number | undefined): string {
    if (idEstadoSunat == null) return 'bg-secondary';
    if (idEstadoSunat === 1 || idEstadoSunat === 2) return 'bg-info';
    return 'bg-danger';
  }

  formatearMoneda(value: number | undefined): string {
    if (value == null) return 'S/ 0.00';
    return 'S/ ' + Number(value).toFixed(2);
  }

  formatearFecha(fEmision: string | undefined): string {
    if (!fEmision) return '—';
    return fEmision.slice(0, 19).replace('T', ' ');
  }

  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  abrirModalPdf(v: VentaListado): void {
    this.ventaSeleccionada = v;
  }

  generarPdf(formato: 'A4' | 'A5' | 'ticket'): void {
    const v = this.ventaSeleccionada;
    if (!v || v.idVenta == null) return;
    this.generandoPdf = true;
    this.ventasService.getComprobanteParaPdf(v.idVenta).subscribe({
      next: (res) => {
        const d = res.data;
        if (!d) {
          this.generandoPdf = false;
          return;
        }
        const cantidadLetras = numeroALetras(Number(d.venta?.total ?? 0));
        const datos = {
          empresa: d.empresa,
          venta: d.venta,
          cliente: d.cliente,
          items: d.items,
          cantidadLetras,
          nombreArchivo: `comprobante-${(d.venta?.compVenta || v.compVenta || 'venta').replace(/-/g, '_')}.pdf`
        };
        this.pdfService.generarPdfComprobanteVenta(datos, formato, datos.nombreArchivo).subscribe({
          next: (blob) => {
            this.pdfService.descargar(blob, datos.nombreArchivo);
            this.generandoPdf = false;
          },
          error: () => { this.generandoPdf = false; }
        });
      },
      error: () => { this.generandoPdf = false; }
    });
  }
}
