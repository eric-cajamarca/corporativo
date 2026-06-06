import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import {
  UtilidadesService,
  FilaUtilidadDetalle,
} from '../../../services/utilidades.service';
import { VentasService, ComprobantePdfData } from '../../../services/ventas.service';
import { PdfService } from '../../../services/pdf.service';
import { ExcelService } from '../../../services/excel.service';
import { WhatsappService } from '../../../services/whatsapp.service';

type TipoPeriodo = 'dia' | 'mes' | 'anio' | 'rango';

@Component({
  selector: 'app-index-utilidades',
  standalone: true,
  imports: [FormsModule, CommonModule, TopnavComponent, SidebarComponent],
  templateUrl: './index-utilidades.component.html',
  styleUrl: './index-utilidades.component.css',
})
export class IndexUtilidadesComponent implements OnInit {
  sidebarState = inject(SidebarStateService);
  private utilidadesService = inject(UtilidadesService);
  private ventasService = inject(VentasService);
  private pdfService = inject(PdfService);
  private excelService = inject(ExcelService);
  private whatsappService = inject(WhatsappService);

  tipoPeriodo: TipoPeriodo = 'mes';
  fechaInicio = '';
  fechaFin = '';
  datos: FilaUtilidadDetalle[] = [];
  busquedaTabla = '';
  cargando = false;
  error = '';
  private readonly hoy = new Date();

  // Totales (calculados al cargar)
  totalPrecioVenta = 0;
  totalCosto = 0;
  totalUtilidadBruta = 0;

  // Modal WhatsApp
  mostrarModalWhatsapp = false;
  whatsappNumero = '';
  whatsappMensaje: string | null = null;
  enviandoWhatsapp = false;

  // Modal detalle comprobante
  mostrarModalComprobante = false;
  comprobanteData: ComprobantePdfData | null = null;
  cargandoComprobante = false;

  ngOnInit(): void {
    this.inicializarFechas();
    this.cargar();
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }

  inicializarFechas(): void {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.fechaFin = fmt(hoy);
    this.fechaInicio = fmt(primerDiaMes);
  }

  aplicarPeriodo(): void {
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const h = this.hoy;
    switch (this.tipoPeriodo) {
      case 'dia':
        this.fechaInicio = fmt(h);
        this.fechaFin = fmt(h);
        break;
      case 'mes':
        this.fechaInicio = fmt(new Date(h.getFullYear(), h.getMonth(), 1));
        this.fechaFin = fmt(h);
        break;
      case 'anio':
        this.fechaInicio = fmt(new Date(h.getFullYear(), 0, 1));
        this.fechaFin = fmt(h);
        break;
      case 'rango':
        this.fechaInicio = fmt(new Date(h.getFullYear(), h.getMonth(), 1));
        this.fechaFin = fmt(h);
        break;
    }
    this.cargar();
  }

  cargar(): void {
    this.error = '';
    if (!this.fechaInicio || !this.fechaFin) {
      this.error = 'Seleccione fecha inicio y fin';
      return;
    }
    this.cargando = true;
    this.busquedaTabla = '';
    this.utilidadesService
      .getUtilidadesDetalle(this.fechaInicio, this.fechaFin)
      .subscribe({
        next: (res) => {
          this.datos = res.data || [];
          this.recalcularTotales();
          this.cargando = false;
        },
        error: (err) => {
          this.error = err?.error?.message || err?.message || 'Error al cargar utilidades';
          this.datos = [];
          this.recalcularTotales();
          this.cargando = false;
        },
      });
  }

  get datosVisibles(): FilaUtilidadDetalle[] {
    const term = this.busquedaTabla.trim().toLowerCase();
    if (!term) return this.datos;
    return this.datos.filter(
      (r) =>
        (r.nombreProducto || '').toLowerCase().includes(term) ||
        (r.comprobante || '').toLowerCase().includes(term)
    );
  }

  esFilaExcluida(fila: FilaUtilidadDetalle): boolean {
    if (fila.excluirDeTotales === true) return true;
    if (fila.eliminado) return true;
    const id = fila.idEstadoSunat;
    return id === 4 || id === 8;
  }

  etiquetaEstadoFila(fila: FilaUtilidadDetalle): string | null {
    if (fila.estadoComprobante) return fila.estadoComprobante;
    if (fila.eliminado) return 'Anulado';
    if (fila.idEstadoSunat === 4) return 'Rechazado SUNAT';
    if (fila.idEstadoSunat === 8) return 'Baja aceptada';
    return null;
  }

  private recalcularTotales(): void {
    const validas = this.datos.filter((r) => !this.esFilaExcluida(r));
    this.totalPrecioVenta = validas.reduce((s, r) => s + Number(r.precioVenta || 0), 0);
    this.totalCosto = validas.reduce((s, r) => s + Number(r.costo || 0), 0);
    this.totalUtilidadBruta = validas.reduce((s, r) => s + Number(r.utilidadBruta || 0), 0);
  }

  exportarPdf(): void {
    const { columnas, filas } = this.construirDatosExport();
    this.pdfService
      .generarPdfDinamico(
        {
          titulo: `Reporte de Utilidades (detalle) - ${this.fechaInicio} a ${this.fechaFin}`,
          columnas,
          filas,
        },
        'reporte',
        10,
        'A4'
      )
      .subscribe({
        next: (blob) => {
          const nombre = `utilidades-detalle-${this.fechaInicio}-${this.fechaFin}.pdf`;
          this.pdfService.descargar(blob, nombre);
        },
        error: (err) => {
          this.error = err?.error?.message || err?.message || 'Error al generar PDF';
        },
      });
  }

  exportarExcel(): void {
    const { columnas, filas } = this.construirDatosExport();
    this.excelService
      .generarExcel({
        title: `Utilidades (detalle) - ${this.fechaInicio} a ${this.fechaFin}`,
        filename: `utilidades-detalle-${this.fechaInicio}-${this.fechaFin}`,
        columns: columnas,
        rows: filas,
        worksheetName: 'Utilidades',
      })
      .subscribe({
        next: (blob) => {
          this.excelService.descargar(
            blob,
            `utilidades-detalle-${this.fechaInicio}-${this.fechaFin}.xlsx`
          );
        },
        error: (err) => {
          this.error = err?.error?.message || err?.message || 'Error al generar Excel';
        },
      });
  }

  abrirModalWhatsapp(): void {
    this.whatsappNumero = '';
    this.whatsappMensaje = null;
    this.mostrarModalWhatsapp = true;
  }

  cerrarModalWhatsapp(): void {
    this.mostrarModalWhatsapp = false;
    this.whatsappNumero = '';
    this.whatsappMensaje = null;
    this.enviandoWhatsapp = false;
  }

  enviarPorWhatsapp(): void {
    const numero = this.whatsappNumero.trim().replace(/\D/g, '');
    if (!numero) {
      this.whatsappMensaje = 'Ingrese un número (ej. 51999999999).';
      return;
    }
    this.whatsappMensaje = null;
    this.enviandoWhatsapp = true;
    const { columnas, filas } = this.construirDatosExport();
    this.pdfService
      .generarPdfDinamico(
        {
          titulo: `Reporte de Utilidades (detalle) - ${this.fechaInicio} a ${this.fechaFin}`,
          columnas,
          filas,
        },
        'reporte',
        10,
        'A4'
      )
      .subscribe({
        next: (blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string)?.split(',')[1] || '';
            const nombre = `utilidades-detalle-${this.fechaInicio}-${this.fechaFin}.pdf`;
            this.whatsappService
              .enviarArchivo(
                numero,
                base64,
                nombre,
                'document',
                `Utilidades ${this.fechaInicio} a ${this.fechaFin}`
              )
              .subscribe({
                next: (res) => {
                  this.whatsappMensaje = res.message || 'Enviado correctamente';
                  this.enviandoWhatsapp = false;
                },
                error: (err) => {
                  this.whatsappMensaje =
                    err?.error?.message || err?.message || 'Error al enviar por WhatsApp';
                  this.enviandoWhatsapp = false;
                },
              });
          };
          reader.readAsDataURL(blob);
        },
        error: (err) => {
          this.whatsappMensaje = err?.error?.message || err?.message || 'Error al generar PDF';
          this.enviandoWhatsapp = false;
        },
      });
  }

  verDetalleComprobante(fila: FilaUtilidadDetalle): void {
    this.comprobanteData = null;
    this.mostrarModalComprobante = true;
    this.cargandoComprobante = true;
    this.ventasService.getComprobanteParaPdf(fila.idVenta).subscribe({
      next: (res) => {
        this.comprobanteData = res.data ?? null;
        this.cargandoComprobante = false;
      },
      error: () => {
        this.comprobanteData = null;
        this.cargandoComprobante = false;
      },
    });
  }

  cerrarModalComprobante(): void {
    this.mostrarModalComprobante = false;
    this.comprobanteData = null;
  }

  private construirDatosExport(): { columnas: string[]; filas: (string | number)[][] } {
    const columnas = [
      'Producto',
      'Comprobante',
      'Estado',
      'Fecha venta',
      'Precio venta',
      'Costo',
      'Utilidad bruta',
    ];
    const filas = this.datos.map((r) => [
      r.nombreProducto,
      r.comprobante,
      this.etiquetaEstadoFila(r) || 'Vigente',
      r.fechaVenta,
      this.esFilaExcluida(r) ? 0 : Number(r.precioVenta),
      this.esFilaExcluida(r) ? 0 : Number(r.costo),
      this.esFilaExcluida(r) ? 0 : Number(r.utilidadBruta),
    ]);
    return { columnas, filas };
  }

  formatearMoneda(val: number): string {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  }

  formatearFecha(val: string): string {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
