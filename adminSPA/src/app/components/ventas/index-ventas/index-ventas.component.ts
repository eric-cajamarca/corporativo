import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { VentasService, VentaListado } from '../../../services/ventas.service';
import { PdfService } from '../../../services/pdf.service';
import { ExcelService } from '../../../services/excel.service';
import { EmpresaService } from '../../../services/empresa.service';
import { numeroALetras } from '../../../utils/numeroALetras';
import { Empresa } from '../../../interfaces/pdf-interface';
import { Empresa as EmpresaModel } from '../../../models/empresa.model';

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
  exportandoLista = false;
  empresa: EmpresaModel | null = null;

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
    private pdfService: PdfService,
    private excelService: ExcelService,
    private empresaService: EmpresaService
  ) {}

  ngOnInit(): void {
    this.empresaService.getEmpresa$().subscribe((emp) => {
      this.empresa = emp;
    });
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
        const nombreArchivo = `comprobante-${(d.venta?.compVenta || v.compVenta || 'venta').replace(/-/g, '_')}.pdf`;
        const emp = d.empresa ?? {};
        const empAny = emp as Record<string, unknown>;
        const logoStr = String(empAny['logo'] ?? empAny['Logo'] ?? '');
        const empresa: Empresa = {
          logo: logoStr,
          nombre: emp.nombre ?? '',
          ruc: emp.ruc ?? '',
          direccion: emp.direccion ?? '',
          telefono: emp.telefono ?? ''
        };
        const datos = {
          empresa: { ...empresa, ...emp, logo: logoStr },
          venta: d.venta,
          cliente: d.cliente,
          items: d.items,
          cantidadLetras,
          nombreArchivo
        };
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index-ventas.component.ts:generarPdf',message:'Frontend datos empresa logo',data:{logoStr,empresaLogo:datos.empresa?.logo,rawEmpresaKeys:d.empresa?Object.keys(d.empresa):[]},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        this.pdfService.generarPdfComprobanteVenta(datos, formato, nombreArchivo).subscribe({
          next: (blob) => {
            this.pdfService.previsualizar(blob);
            this.generandoPdf = false;
          },
          error: (err) => {
            this.generandoPdf = false;
            const msg = err?.error?.error || err?.message || 'Error al generar el PDF.';
            console.error('Error generar PDF:', err);
            alert(msg);
          }
        });
      },
      error: (err) => {
        this.generandoPdf = false;
        const msg = err?.error?.error || err?.message || 'No se pudieron cargar los datos del comprobante.';
        console.error('Error comprobante PDF:', err);
        alert(msg);
      }
    });
  }

  /** Exporta la lista actual (filtrada) de ventas a PDF (vista previa). */
  exportarListaPdf(): void {
    if (this.ventas.length === 0) return;
    const emp = this.empresa;
    const empresaPdf: Empresa = {
      logo: emp?.logo ?? '',
      nombre: emp?.nombre ?? '',
      ruc: emp?.ruc ?? '',
      direccion: emp?.direccion ?? '',
      telefono: emp?.telefono ?? ''
    };
    const datos = {
      empresa: empresaPdf,
      titulo: 'Lista de Ventas',
      columnas: ['#', 'Fecha', 'Comprobante', 'RUC', 'Cliente', 'Total (S/)', 'Estado SUNAT'],
      filas: this.ventas.map((v, i) => [
        i + 1,
        this.formatearFecha(v.fEmision),
        v.compVenta || '—',
        v.clienteRuc || '—',
        v.clienteRazonSocial || '—',
        `S/ ${Number(v.total).toFixed(2)}`,
        this.estadoSunatLabel(v.idEstadoSunat)
      ])
    };
    this.exportandoLista = true;
    this.pdfService.generarPdfDinamico(datos, 'lista-ventas', 9).subscribe({
      next: (blob) => {
        this.pdfService.previsualizar(blob);
        this.exportandoLista = false;
      },
      error: (err) => {
        this.exportandoLista = false;
        const msg = err?.error?.error || err?.message || 'Error al generar el PDF.';
        console.error('Error exportar lista PDF:', err);
        alert(msg);
      }
    });
  }

  /** Descarga la lista actual (filtrada) de ventas en Excel. */
  exportarListaExcel(): void {
    if (this.ventas.length === 0) return;
    const datosExcel = {
      title: 'Lista de Ventas',
      filename: `ventas_${new Date().getTime()}`,
      worksheetName: 'Ventas',
      columns: ['#', 'Fecha', 'Comprobante', 'RUC', 'Cliente', 'Total (S/)', 'Estado SUNAT'],
      rows: this.ventas.map((v, i) => [
        i + 1,
        this.formatearFecha(v.fEmision),
        v.compVenta || '—',
        v.clienteRuc || '—',
        v.clienteRazonSocial || '—',
        Number(v.total),
        this.estadoSunatLabel(v.idEstadoSunat)
      ])
    };
    this.exportandoLista = true;
    this.excelService.generarExcel(datosExcel).subscribe({
      next: (blob) => {
        this.excelService.descargar(blob, `${datosExcel.filename}.xlsx`);
        this.exportandoLista = false;
      },
      error: (err) => {
        this.exportandoLista = false;
        const msg = err?.error?.error || err?.message || 'Error al generar el Excel.';
        console.error('Error exportar lista Excel:', err);
        alert(msg);
      }
    });
  }
}
