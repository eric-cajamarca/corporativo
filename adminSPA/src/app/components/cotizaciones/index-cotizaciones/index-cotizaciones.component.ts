import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { CotizacionesService, CotizacionListado } from '../../../services/cotizaciones.service';
import { PdfService } from '../../../services/pdf.service';
import { WhatsappService } from '../../../services/whatsapp.service';
import { numeroALetras } from '../../../utils/numeroALetras';
import { Empresa } from '../../../interfaces/pdf-interface';
import { getFechaHoyLocal } from '../../../utils/fecha-local.util';

declare var bootstrap: any;
declare var iziToast: any;

@Component({
  selector: 'app-index-cotizaciones',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule, SidebarComponent, TopnavComponent, NgbPagination],
  templateUrl: './index-cotizaciones.component.html',
  styleUrl: './index-cotizaciones.component.css'
})
export class IndexCotizacionesComponent implements OnInit {
  cotizaciones: CotizacionListado[] = [];
  cotizacionesConst: CotizacionListado[] = [];
  loading = true;
  cotizacionSeleccionada: CotizacionListado | null = null;
  generandoPdf = false;
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

  constructor(
    private cotizacionesService: CotizacionesService,
    private pdfService: PdfService,
    private whatsappService: WhatsappService,
    private router: Router,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargarCotizaciones();
  }

  cargarCotizaciones(): void {
    this.loading = true;
    this.cotizacionesService.listar().subscribe({
      next: (res) => {
        this.cotizacionesConst = res.data ?? [];
        this.cotizaciones = [...this.cotizacionesConst];
        this.aplicarFiltrosLocales();
        this.loading = false;
      },
      error: () => {
        this.cotizacionesConst = [];
        this.cotizaciones = [];
        this.loading = false;
      }
    });
  }

  aplicarFiltrosLocales(): void {
    let list = [...this.cotizacionesConst];
    if (this.filtroFecha === 'today') {
      const hoy = getFechaHoyLocal();
      list = list.filter((c) => (c.fEmision || '').toString().slice(0, 10) === hoy);
    } else if (this.filtroFecha === 'month') {
      const now = new Date();
      const mes = String(now.getMonth() + 1).padStart(2, '0');
      const anio = now.getFullYear();
      list = list.filter((c) => {
        const f = (c.fEmision || '').toString().slice(0, 10);
        return f.startsWith(`${anio}-${mes}`);
      });
    } else if (this.filtroFecha === 'range' && (this.fechaDesde || this.fechaHasta)) {
      if (this.fechaDesde) list = list.filter((c) => (c.fEmision || '').toString().slice(0, 10) >= this.fechaDesde);
      if (this.fechaHasta) list = list.filter((c) => (c.fEmision || '').toString().slice(0, 10) <= this.fechaHasta);
    }
    const ruc = (this.filtroRuc || '').toLowerCase().trim();
    if (ruc) list = list.filter((c) => (c.clienteRuc || '').toLowerCase().includes(ruc));
    const razon = (this.filtroRazon || '').toLowerCase().trim();
    if (razon) list = list.filter((c) => (c.clienteRazonSocial || '').toLowerCase().includes(razon));
    const num = (this.filtroNumero || '').trim();
    if (num) list = list.filter((c) => (c.serieNumero || '').toLowerCase().includes(num.toLowerCase()));
    this.cotizaciones = list;
  }

  aplicarFiltros(): void {
    this.page = 1;
    this.aplicarFiltrosLocales();
  }

  limpiarFiltros(): void {
    this.page = 1;
    this.filtroFecha = 'all';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.filtroRuc = '';
    this.filtroRazon = '';
    this.filtroNumero = '';
    this.cotizaciones = [...this.cotizacionesConst];
  }

  formatearMoneda(value: number | undefined): string {
    if (value == null) return 'S/ 0.00';
    return 'S/ ' + Number(value).toFixed(2);
  }

  formatearFecha(f: string | undefined): string {
    if (!f) return '—';
    return String(f).slice(0, 10);
  }

  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  verDetalle(c: CotizacionListado): void {
    this.router.navigate(['/cotizaciones', c.idCotizacion]);
  }

  editar(c: CotizacionListado): void {
    this.router.navigate(['/cotizaciones/editar', c.idCotizacion]);
  }

  abrirModalPdf(c: CotizacionListado): void {
    this.cotizacionSeleccionada = c;
    this.mostrarWhatsappForm = false;
    this.datosParaWhatsapp = null;
    this.whatsappMensaje = null;
    const el = document.getElementById('pdfModalCotizacion');
    if (el && typeof bootstrap !== 'undefined') {
      const modal = bootstrap.Modal.getOrCreateInstance(el);
      modal.show();
    }
  }

  abrirFormWhatsapp(): void {
    const c = this.cotizacionSeleccionada;
    if (!c || c.idCotizacion == null) return;
    this.generandoPdf = true;
    this.whatsappMensaje = null;
    this.cotizacionesService.getCotizacionParaPdf(c.idCotizacion).subscribe({
      next: (res) => {
        const d = res.data;
        this.generandoPdf = false;
        if (!d) return;
        const cantidadLetras = numeroALetras(Number(d.venta?.total ?? 0));
        const nombreArchivo = `cotizacion-${(d.venta?.compVenta || c.serieNumero || 'cotizacion').replace(/-/g, '_')}.pdf`;
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
          impuestos: Array.isArray(d.impuestos) ? d.impuestos : [],
          cantidadLetras,
          nombreArchivo,
          esCotizacion: true
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
    const c = this.cotizacionSeleccionada;
    if (!c || c.idCotizacion == null) return;
    this.generandoPdf = true;
    this.cotizacionesService.getCotizacionParaPdf(c.idCotizacion).subscribe({
      next: (res) => {
        const d = res.data;
        if (!d) {
          this.generandoPdf = false;
          return;
        }
        const cantidadLetras = numeroALetras(Number(d.venta?.total ?? 0));
        const nombreArchivo = `cotizacion-${(d.venta?.compVenta || c.serieNumero || 'cotizacion').replace(/-/g, '_')}.pdf`;
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
          impuestos: Array.isArray(d.impuestos) ? d.impuestos : [],
          cantidadLetras,
          nombreArchivo,
          esCotizacion: true
        };
        this.pdfService.generarPdfComprobanteVenta(datos, formato, nombreArchivo).subscribe({
          next: (blob) => {
            this.pdfService.previsualizar(blob);
            this.generandoPdf = false;
          },
          error: (err) => {
            this.generandoPdf = false;
            const msg = err?.error?.error || err?.message || 'Error al generar el PDF.';
            iziToast.error({ title: 'Error', message: msg });
          }
        });
      },
      error: (err) => {
        this.generandoPdf = false;
        const msg = err?.error?.error || err?.message || 'No se pudieron cargar los datos de la cotización.';
        iziToast.error({ title: 'Error', message: msg });
      }
    });
  }

  eliminar(c: CotizacionListado): void {
    if (!confirm('¿Está seguro de eliminar esta cotización?')) return;
    this.cotizacionesService.eliminar(c.idCotizacion).subscribe({
      next: () => {
        iziToast.success({ title: 'Éxito', message: 'Cotización eliminada.' });
        this.cargarCotizaciones();
      },
      error: (err) => {
        iziToast.error({
          title: 'Error',
          message: err?.error?.error || err?.message || 'Error al eliminar.'
        });
      }
    });
  }
}
