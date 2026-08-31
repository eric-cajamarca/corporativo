import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ComprasService } from '../../../services/compras.service';
import { ConsultaXMLService } from '../../../services/consulta-xml.service';
import { ExcelService } from '../../../services/excel.service';
import { PdfService } from '../../../services/pdf.service';
import { EmpresaService } from '../../../services/empresa.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import type { ComprobanteCompraSunatListaItem } from '../../../models/comprobante-compra-sunat.model';
import type { Empresa } from '../../../models/empresa.model';

declare const iziToast: { error: (o: { title: string; message: string; position?: string }) => void };

@Component({
  selector: 'app-index-comprobantes-compra-sunat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './index-comprobantes-compra-sunat.component.html',
  styleUrl: './index-comprobantes-compra-sunat.component.css'
})
export class IndexComprobantesCompraSunatComponent implements OnInit {
  sidebarState = inject(SidebarStateService);
  filas: ComprobanteCompraSunatListaItem[] = [];
  filasFiltradas: ComprobanteCompraSunatListaItem[] = [];
  cargando = false;

  filtroRuc = '';
  filtroRazon = '';
  filtroCondicion = '';
  filtroTipoDoc = '';
  fechaDesde = '';
  fechaHasta = '';

  empresa: Empresa | null = null;

  constructor(
    private comprasService: ComprasService,
    private consultaXml: ConsultaXMLService,
    private excelService: ExcelService,
    private pdfService: PdfService,
    private empresaService: EmpresaService,
    //public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.empresaService.getEmpresasPdf().subscribe({
      next: (r) => {
        this.empresa = r?.data?.[0] ?? null;
      },
      error: () => {
        this.empresa = null;
      }
    });
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    const params: Record<string, string> = {};
    if (this.filtroRuc.trim()) params['rucEmisor'] = this.filtroRuc.trim();
    if (this.filtroRazon.trim()) params['razonSocial'] = this.filtroRazon.trim();
    if (this.filtroCondicion) params['condicionPago'] = this.filtroCondicion;
    if (this.filtroTipoDoc.trim()) params['tipoDocumento'] = this.filtroTipoDoc.trim();
    if (this.fechaDesde) params['fechaDesde'] = this.fechaDesde;
    if (this.fechaHasta) params['fechaHasta'] = this.fechaHasta;

    this.comprasService.listarComprobantesCompraSunat(params).subscribe({
      next: (resp) => {
        this.cargando = false;
        this.filas = Array.isArray(resp?.data) ? resp.data : [];
        this.filasFiltradas = [...this.filas];
      },
      error: (err) => {
        this.cargando = false;
        this.filas = [];
        this.filasFiltradas = [];
        const msg = err?.error?.message || err?.message || 'No se pudo cargar el listado';
        iziToast?.error?.({ title: 'Compras SUNAT', message: msg, position: 'topRight' });
      }
    });
  }

  limpiarFiltros(): void {
    this.filtroRuc = '';
    this.filtroRazon = '';
    this.filtroCondicion = '';
    this.filtroTipoDoc = '';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.cargar();
  }

  descargarPdfFila(row: ComprobanteCompraSunatListaItem): void {
    const proveedor = String(row.rucEmisor || '').replace(/\D/g, '').slice(0, 11);
    if (proveedor.length !== 11) {
      iziToast?.error?.({ title: 'PDF', message: 'RUC emisor inválido para consulta SUNAT.', position: 'topRight' });
      return;
    }
    const tipo_doc = String(row.tipoDocumento || '01')
      .replace(/\D/g, '')
      .slice(0, 2)
      .padStart(2, '0');
    const serie = String(row.serie || '').trim();
    const correlativo = String(row.numero || '').trim().replace(/\D/g, '') || String(row.numero || '').trim();
    if (!serie || !correlativo) {
      iziToast?.error?.({ title: 'PDF', message: 'Serie o número incompleto.', position: 'topRight' });
      return;
    }
    this.consultaXml.consultarComprobantePdf({ proveedor, tipo_doc, serie, correlativo }).subscribe({
      next: (resp) => {
        this.consultaXml.descargarPdfDesdeRespuesta(resp).catch((e) => {
          iziToast?.error?.({ title: 'PDF', message: 'No se pudo descargar el PDF.', position: 'topRight' });
        });
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Error al solicitar PDF';
        iziToast?.error?.({ title: 'PDF SUNAT', message: msg, position: 'topRight' });
      }
    });
  }

  exportarPdfLista(): void {
    const datos = {
      empresa: this.empresa ?? undefined,
      titulo: 'Compras SUNAT',
      columnas: [
        '#',
        'RUC',
        'Razón social',
        'Tipo',
        'Serie',
        'Número',
        'Emisión',
        'Moneda',
        'Condición',
        'Total',
        'Comp. compra'
      ],
      filas: this.filasFiltradas.map((r, i) => [
        i + 1,
        r.rucEmisor,
        r.razonSocialEmisor ?? '—',
        r.tipoDocumento,
        r.serie,
        r.numero,
        r.fechaEmision,
        r.codigoMoneda ?? '—',
        r.condicionPago,
        Number(r.total).toFixed(2),
        r.compCompra ?? '—'
      ])
    };
    this.pdfService.generarPdfDinamico(datos, 'lista-compras', 9).subscribe({
      next: (blob) => this.pdfService.previsualizar(blob),
      error: () => undefined
    });
  }

  exportarExcel(): void {
    const datosExcel = {
      title: 'Compras SUNAT',
      filename: `comprobantes_sunat_${Date.now()}`,
      worksheetName: 'SUNAT',
      columns: [
        'RUC',
        'Razón social',
        'Tipo doc.',
        'Serie',
        'Número',
        'Emisión',
        'Moneda',
        'Condición',
        'Vencimiento',
        'Tipo cambio',
        'Subtotal',
        'IGV',
        'Total',
        'Comp. compra',
        'Registro'
      ],
      rows: this.filasFiltradas.map((r) => [
        r.rucEmisor,
        r.razonSocialEmisor ?? '',
        r.tipoDocumento,
        r.serie,
        r.numero,
        r.fechaEmision,
        r.codigoMoneda ?? '',
        r.condicionPago,
        r.fechaVencimiento ?? '',
        r.tipoCambio ?? '',
        Number(r.subTotal),
        Number(r.igv),
        Number(r.total),
        r.compCompra ?? '',
        r.fRegistro
      ])
    };
    this.excelService.generarExcel(datosExcel).subscribe({
      next: (blob) => this.excelService.descargar(blob, `${datosExcel.filename}.xlsx`),
      error: () => undefined
    });
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
