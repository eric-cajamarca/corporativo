import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { FormsModule } from '@angular/forms';
import { CotizacionesService, CotizacionDetalleResponse } from '../../../services/cotizaciones.service';
import { PdfService } from '../../../services/pdf.service';
import { WhatsappService } from '../../../services/whatsapp.service';
import { numeroALetras } from '../../../utils/numeroALetras';
import { Empresa } from '../../../interfaces/pdf-interface';

declare var bootstrap: any;
declare var iziToast: any;

@Component({
  selector: 'app-detalle-cotizacion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent],
  templateUrl: './detalle-cotizacion.component.html',
  styleUrl: './detalle-cotizacion.component.css'
})
export class DetalleCotizacionComponent implements OnInit {
  data: CotizacionDetalleResponse | null = null;
  loading = true;
  idCotizacion: number | null = null;
  generandoPdf = false;
  mostrarWhatsappForm = false;
  whatsappNumber = '';
  whatsappCaption = '';
  whatsappFormato: 'A4' | 'A5' | 'ticket' = 'A4';
  enviandoWhatsapp = false;
  whatsappMensaje: string | null = null;
  datosParaWhatsapp: { datos: unknown; nombreArchivo: string } | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cotizacionesService: CotizacionesService,
    private pdfService: PdfService,
    private whatsappService: WhatsappService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.idCotizacion = id ? parseInt(id, 10) : null;
    if (this.idCotizacion == null || isNaN(this.idCotizacion)) {
      this.loading = false;
      return;
    }
    this.cotizacionesService.obtenerPorId(this.idCotizacion).subscribe({
      next: (res) => {
        this.data = res.data ?? null;
        this.loading = false;
      },
      error: () => {
        this.data = null;
        this.loading = false;
      }
    });
  }

  formatearMoneda(value: number | undefined): string {
    if (value == null) return 'S/ 0.00';
    return 'S/ ' + Number(value).toFixed(2);
  }

  formatearFecha(f: string | undefined): string {
    if (!f) return '—';
    return String(f).slice(0, 10);
  }

  editar(): void {
    if (this.idCotizacion) this.router.navigate(['/cotizaciones/editar', this.idCotizacion]);
  }

  volver(): void {
    this.router.navigate(['/cotizaciones']);
  }

  abrirModalPdf(): void {
    this.mostrarWhatsappForm = false;
    this.datosParaWhatsapp = null;
    this.whatsappMensaje = null;
    const el = document.getElementById('pdfModalDetalleCotizacion');
    if (el && typeof bootstrap !== 'undefined') {
      bootstrap.Modal.getOrCreateInstance(el).show();
    }
  }

  abrirFormWhatsapp(): void {
    if (this.idCotizacion == null) return;
    this.generandoPdf = true;
    this.whatsappMensaje = null;
    this.cotizacionesService.getCotizacionParaPdf(this.idCotizacion).subscribe({
      next: (res) => {
        const d = res.data;
        this.generandoPdf = false;
        if (!d) return;
        const cantidadLetras = numeroALetras(Number(d.venta?.total ?? 0));
        const nombreArchivo = `cotizacion-${(d.venta?.compVenta || 'cotizacion').replace(/-/g, '_')}.pdf`;
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
    if (this.idCotizacion == null) return;
    this.generandoPdf = true;
    this.cotizacionesService.getCotizacionParaPdf(this.idCotizacion).subscribe({
      next: (res) => {
        const d = res.data;
        if (!d) {
          this.generandoPdf = false;
          return;
        }
        const cantidadLetras = numeroALetras(Number(d.venta?.total ?? 0));
        const nombreArchivo = `cotizacion-${(d.venta?.compVenta || 'cotizacion').replace(/-/g, '_')}.pdf`;
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
            iziToast.error({ title: 'Error', message: err?.error?.error || err?.message || 'Error al generar PDF.' });
          }
        });
      },
      error: () => {
        this.generandoPdf = false;
      }
    });
  }
}
