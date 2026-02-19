import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { VentasService, VentaListado } from '../../../services/ventas.service';
import { FacturacionService } from '../../../services/facturacion.service';
import { PdfService } from '../../../services/pdf.service';
import { ExcelService } from '../../../services/excel.service';
import { EmpresaService } from '../../../services/empresa.service';
import { WhatsappService } from '../../../services/whatsapp.service';
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
  ventas: VentaListado[] = [];
  ventasConst: VentaListado[] = [];
  loading = true;
  ventaSeleccionada: VentaListado | null = null;
  generandoPdf = false;
  exportandoLista = false;
  enviandoSunatId: string | null = null;
  empresa: EmpresaModel | null = null;

  archivoModalId: string | null = null;
  archivoModalTipo: 'xml' | 'cdr' | null = null;
  contenidoArchivo: string | null = null;
  loadingArchivo = false;
  archivoError: string | null = null;

  mostrarWhatsappForm = false;
  whatsappNumber = '';
  whatsappCaption = '';
  whatsappFormato: 'A4' | 'A5' | 'ticket' = 'A4';
  enviandoWhatsapp = false;
  whatsappMensaje: string | null = null;
  datosParaWhatsapp: { datos: unknown; nombreArchivo: string } | null = null;

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
    private facturacionService: FacturacionService,
    private pdfService: PdfService,
    private excelService: ExcelService,
    private empresaService: EmpresaService,
    private whatsappService: WhatsappService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.empresaService.getEmpresa$().subscribe((emp) => {
      this.empresa = emp;
    });
    this.cargarVentas();
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
      const hoy = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })();
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

  /** 7 = Pendiente de envío; 1 = Aceptado; 3 = Aceptado con obs.; 4 = Rechazado; 6 = Error envío. */
  estadoSunatLabel(idEstadoSunat: number | undefined): string {
    if (idEstadoSunat == null) return 'Pendiente';
    if (idEstadoSunat === 7) return 'Pend. envío';
    if (idEstadoSunat === 1 || idEstadoSunat === 2) return 'Aceptado';
    if (idEstadoSunat === 3) return 'Aceptado con obs.';
    if (idEstadoSunat === 6) return 'Error envío';
    return 'Rechazado';
  }

  /** Id del comprobante electrónico como string (para comparaciones y API). */
  idComprobanteStr(v: VentaListado): string {
    const id = v?.idComprobanteElectronico;
    return id != null ? String(id).trim() : '';
  }

  /** True si la venta tiene comprobante electrónico (muestra botón Enviar a SUNAT). */
  puedeEnviarSunat(v: VentaListado): boolean {
    return this.idComprobanteStr(v) !== '';
  }

  /** True si la venta se puede editar (comprobante no enviado ni aceptado en SUNAT). */
  puedeEditarVenta(v: VentaListado): boolean {
    const id = v?.idEstadoSunat;
    return id !== 1 && id !== 2 && id !== 3;
  }

  enviarASunat(v: VentaListado): void {
    const id = v?.idComprobanteElectronico != null ? String(v.idComprobanteElectronico).trim() : '';
    if (!id) return;
    this.enviandoSunatId = id;
    this.facturacionService.enviarComprobanteSunat(id).subscribe({
      next: (res) => {
        this.enviandoSunatId = null;
        const msg = res?.message || (res?.data?.ok ? 'Enviado a SUNAT' : res?.data?.mensaje || '');
        if (res?.data?.ok !== false) {
          this.cargarVentas();
        }
        alert(msg);
      },
      error: (err) => {
        this.enviandoSunatId = null;
        const msg = err?.error?.message || err?.message || 'Error al enviar a SUNAT';
        alert(msg);
      }
    });
  }

  estadoSunatClass(idEstadoSunat: number | undefined): string {
    if (idEstadoSunat == null) return 'bg-secondary';
    if (idEstadoSunat === 7) return 'bg-warning text-dark';
    if (idEstadoSunat === 1 || idEstadoSunat === 2 || idEstadoSunat === 3) return 'bg-info';
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

  /** Comprobantes válidos SUNAT (aceptados: idEstadoSunat 1, 2, 3) según la lista filtrada actual (ventas). */
  get resumenValidosSunat(): { cantidad: number; total: number } {
    const list = this.ventas.filter((v) => v.idEstadoSunat === 1 || v.idEstadoSunat === 2 || v.idEstadoSunat === 3);
    const total = list.reduce((sum, v) => sum + (Number(v.total) || 0), 0);
    return { cantidad: list.length, total };
  }

  /** Comprobantes no válidos SUNAT (pendientes, rechazados, error) según la lista filtrada actual (ventas). */
  get resumenNoValidosSunat(): { cantidad: number; total: number } {
    const list = this.ventas.filter((v) => v.idEstadoSunat !== 1 && v.idEstadoSunat !== 2 && v.idEstadoSunat !== 3);
    const total = list.reduce((sum, v) => sum + (Number(v.total) || 0), 0);
    return { cantidad: list.length, total };
  }

  abrirModalArchivo(v: VentaListado, tipo: 'xml' | 'cdr'): void {
    const id = this.idComprobanteStr(v);
    if (!id) return;
    this.archivoModalId = id;
    this.archivoModalTipo = tipo;
    this.contenidoArchivo = null;
    this.archivoError = null;
    setTimeout(() => {
      const el = document.getElementById('archivoModal');
      if (el && (window as unknown as { bootstrap?: { Modal: { getOrCreateInstance: (e: Element) => { show: () => void } } } }).bootstrap) {
        (window as unknown as { bootstrap: { Modal: { getOrCreateInstance: (e: Element) => { show: () => void } } } }).bootstrap.Modal.getOrCreateInstance(el).show();
      }
    }, 0);
  }

  cerrarModalArchivo(): void {
    this.archivoModalId = null;
    this.archivoModalTipo = null;
    this.contenidoArchivo = null;
    this.archivoError = null;
    const el = document.getElementById('archivoModal');
    if (el && (window as unknown as { bootstrap?: { Modal: { getOrCreateInstance: (e: Element) => { hide: () => void } } } }).bootstrap) {
      (window as unknown as { bootstrap: { Modal: { getOrCreateInstance: (e: Element) => { hide: () => void } } } }).bootstrap.Modal.getOrCreateInstance(el).hide();
    }
  }

  verArchivo(): void {
    if (!this.archivoModalId || !this.archivoModalTipo) return;
    this.loadingArchivo = true;
    this.archivoError = null;
    const obs = this.archivoModalTipo === 'xml'
      ? this.facturacionService.obtenerXmlComprobante(this.archivoModalId)
      : this.facturacionService.obtenerCdrComprobante(this.archivoModalId);
    obs.subscribe({
      next: (res) => {
        this.contenidoArchivo = res?.data?.content ?? '';
        this.loadingArchivo = false;
      },
      error: (err) => {
        this.archivoError = err?.error?.message || err?.message || 'Error al cargar el archivo';
        this.loadingArchivo = false;
      }
    });
  }

  descargarArchivo(): void {
    if (!this.archivoModalId || !this.archivoModalTipo) return;
    this.loadingArchivo = true;
    this.archivoError = null;
    const obs = this.archivoModalTipo === 'xml'
      ? this.facturacionService.obtenerXmlComprobante(this.archivoModalId)
      : this.facturacionService.obtenerCdrComprobante(this.archivoModalId);
    const ext = this.archivoModalTipo === 'xml' ? 'xml' : 'xml';
    const nombre = `comprobante-${this.archivoModalTipo}.${ext}`;
    obs.subscribe({
      next: (res) => {
        const content = res?.data?.content ?? '';
        this.loadingArchivo = false;
        if (!content) return;
        const blob = new Blob([content], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.archivoError = err?.error?.message || err?.message || 'Error al descargar el archivo';
        this.loadingArchivo = false;
      }
    });
  }

  abrirModalPdf(v: VentaListado): void {
    this.ventaSeleccionada = v;
    this.mostrarWhatsappForm = false;
    this.datosParaWhatsapp = null;
    this.whatsappMensaje = null;
  }

  abrirFormWhatsapp(): void {
    const v = this.ventaSeleccionada;
    if (!v || v.idVenta == null) return;
    this.generandoPdf = true;
    this.whatsappMensaje = null;
    this.ventasService.getComprobanteParaPdf(v.idVenta).subscribe({
      next: (res) => {
        const d = res.data;
        this.generandoPdf = false;
        if (!d) return;
        const cantidadLetras = numeroALetras(Number(d.venta?.total ?? 0));
        const nombreArchivo = `comprobante-${(d.venta?.compVenta || v.compVenta || 'venta').replace(/-/g, '_')}.pdf`;
        const emp = d.empresa ?? {};
        const empAny = emp as Record<string, unknown>;
        const logoStr = String(empAny['logo'] ?? empAny['Logo'] ?? '');
        const empresa: Empresa = {
          logo: logoStr,
          nombre: (emp as { nombre?: string }).nombre ?? '',
          ruc: (emp as { ruc?: string }).ruc ?? '',
          direccion: (emp as { direccion?: string }).direccion ?? '',
          telefono: (emp as { telefono?: string }).telefono ?? ''
        };
        const datos = {
          empresa: { ...empresa, ...emp, logo: logoStr },
          venta: d.venta,
          cliente: d.cliente,
          items: d.items,
          cantidadLetras,
          nombreArchivo
        };
        this.datosParaWhatsapp = { datos, nombreArchivo };
        this.whatsappNumber = (d.cliente as { celular?: string })?.celular ?? '';
        this.mostrarWhatsappForm = true;
      },
      error: (err) => {
        this.generandoPdf = false;
        this.whatsappMensaje = err?.error?.error || err?.message || 'No se pudieron cargar los datos.';
      }
    });
  }

  cerrarFormWhatsapp(): void {
    this.mostrarWhatsappForm = false;
    this.datosParaWhatsapp = null;
    this.whatsappNumber = '';
    this.whatsappCaption = '';
    this.whatsappFormato = 'A4';
    this.whatsappMensaje = null;
  }

  enviarPdfPorWhatsapp(): void {
    if (!this.datosParaWhatsapp || !this.whatsappNumber.trim()) {
      this.whatsappMensaje = 'Ingrese el número de WhatsApp (ej. 51999999999).';
      return;
    }
    this.enviandoWhatsapp = true;
    this.whatsappMensaje = null;
    const { datos, nombreArchivo } = this.datosParaWhatsapp;
    const formato = this.whatsappFormato;
    this.pdfService.generarPdfComprobanteVenta(datos as any, formato, nombreArchivo).subscribe({
      next: (blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : dataUrl;
          this.whatsappService.enviarArchivo(this.whatsappNumber.trim(), base64, nombreArchivo, 'document', this.whatsappCaption.trim() || undefined).subscribe({
            next: (res) => {
              this.enviandoWhatsapp = false;
              this.whatsappMensaje = res.message;
              if (res.success) setTimeout(() => this.cerrarFormWhatsapp(), 2000);
            },
            error: (err) => {
              this.enviandoWhatsapp = false;
              this.whatsappMensaje = err?.error?.message || err?.message || 'Error al enviar por WhatsApp.';
            }
          });
        };
        reader.readAsDataURL(blob);
      },
      error: (err) => {
        this.enviandoWhatsapp = false;
        this.whatsappMensaje = err?.error?.error || err?.message || 'Error al generar el PDF.';
      }
    });
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
      columnas: ['#', 'Fecha', 'Comprobante', 'RUC Cliente', 'Cliente', 'Total (S/)', 'Estado SUNAT'],
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
      columns: ['#', 'Fecha', 'Comprobante', 'RUC Cliente', 'Cliente', 'Total (S/)', 'Estado SUNAT'],
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
