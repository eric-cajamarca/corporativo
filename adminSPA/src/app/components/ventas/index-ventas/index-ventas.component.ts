import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { forkJoin } from 'rxjs';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { VentasService, VentaAgrupadaListado, ComprobanteVentaAgrupada, VentaListado } from '../../../services/ventas.service';
import { openComprobanteVaTicket } from '../../../utils/comprobante-va-ticket.util';
import { FacturacionService } from '../../../services/facturacion.service';
import { PdfService } from '../../../services/pdf.service';
import { ExcelService } from '../../../services/excel.service';
import { EmpresaService } from '../../../services/empresa.service';
import { WhatsappService } from '../../../services/whatsapp.service';
import { Empresa as EmpresaModel } from '../../../models/empresa.model';
import { numeroALetras } from '../../../utils/numeroALetras';
import { Empresa } from '../../../interfaces/pdf-interface';

@Component({
  selector: 'app-index-ventas',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule, SidebarComponent, TopnavComponent, NgbPagination],
  templateUrl: './index-ventas.component.html',
  styleUrl: './index-ventas.component.css'
})
export class IndexVentasComponent implements OnInit {
  /** Popper en modo fixed evita que el menú quede recortado por .table-responsive / overflow */
  readonly dropdownPopperConfig = JSON.stringify({ strategy: 'fixed' });

  /** Si es true, no se muestran sidebar ni topnav (para incrustar en ventas-hoteles u otro contenedor). */
  @Input() noShell = false;

  ventas: VentaAgrupadaListado[] = [];
  ventasConst: VentaAgrupadaListado[] = [];
  ventasEmpresa: VentaListado[] = [];
  ventasEmpresaConst: VentaListado[] = [];
  loading = true;
  ventaSeleccionada: VentaListado | null = null;
  exportandoLista = false;
  generandoPdf = false;
  enviandoSunatId: string | null = null;
  consultandoEstadoId: string | null = null;
  consultandoValidezId: string | null = null;
  anulandoIdVenta: number | null = null;
  empresa: EmpresaModel | null = null;
  esGestora = false;
  useResumenDiarioBoletas = false;

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
  /** Paginación de la tabla de comprobantes cuando la sesión es gestora (tabla inferior). */
  pageCompGestora = 1;
  pageSize = 10;

  filtroFecha = 'all';
  fechaDesde = '';
  fechaHasta = '';
  filtroRuc = '';
  filtroRazon = '';
  filtroNumero = '';
  filtroTipoComprobante = '';

  comprobantesVenta: ComprobanteVentaAgrupada[] = [];
  ventaAgrupadaSeleccionada: VentaAgrupadaListado | null = null;
  cargandoComprobantes = false;
  errorComprobantes = '';
  comprobanteImprimiendoId: number | null = null;
  imprimiendoVAId: string | null = null;
  /** idVenta del comprobante hijo (modal imprimir desde venta agrupada). */
  idVentaPdfComprobanteHijo: number | null = null;
  mostrarWhatsappFormHijo = false;
  datosParaWhatsappHijo: { datos: unknown; nombreArchivo: string } | null = null;
  whatsappMensajeHijo: string | null = null;
  whatsappNumberHijo = '';
  whatsappCaptionHijo = '';
  whatsappFormatoHijo: 'A4' | 'A5' | 'ticket' = 'A4';
  enviandoWhatsappHijo = false;

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
    this.facturacionService.obtenerConfiguracion().subscribe({
      next: (res) => {
        this.useResumenDiarioBoletas = res?.data?.useResumenDiarioBoletas === true;
      },
      error: () => {
        this.useResumenDiarioBoletas = false;
      }
    });
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (res) => {
        const estado = res?.data;
        this.esGestora = !!estado?.esGestora;
        this.cargarVentas();
      },
      error: () => {
        this.esGestora = false;
        this.cargarVentas();
      }
    });
  }

  cargarVentas(): void {
    this.loading = true;
    if (this.esGestora) {
      forkJoin({
        agrupadas: this.ventasService.listarVentasAgrupadas(),
        comprobantes: this.ventasService.listarVentasEmpresa()
      }).subscribe({
        next: ({ agrupadas, comprobantes }) => {
          this.ventasConst = agrupadas.data ?? [];
          this.ventasEmpresaConst = comprobantes.data ?? [];
          this.page = 1;
          this.pageCompGestora = 1;
          this.aplicarFiltros();
          this.loading = false;
        },
        error: () => {
          this.ventasConst = [];
          this.ventas = [];
          this.ventasEmpresaConst = [];
          this.ventasEmpresa = [];
          this.loading = false;
        }
      });
    } else {
      this.ventasService.listarVentasEmpresa().subscribe({
        next: (res) => {
          this.ventasEmpresaConst = res.data ?? [];
          this.ventasEmpresa = [...this.ventasEmpresaConst];
          this.loading = false;
        },
        error: () => {
          this.ventasEmpresaConst = [];
          this.ventasEmpresa = [];
          this.loading = false;
        }
      });
    }
  }

  aplicarFiltros(): void {
    this.page = 1;
    this.pageCompGestora = 1;
    if (this.esGestora) {
      let listVa = [...this.ventasConst];

      if (this.filtroFecha === 'today') {
        const hoy = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })();
        listVa = listVa.filter((v) => (v.fEmision || '').slice(0, 10) === hoy);
      } else if (this.filtroFecha === 'month') {
        const now = new Date();
        const mes = String(now.getMonth() + 1).padStart(2, '0');
        const anio = now.getFullYear();
        listVa = listVa.filter((v) => {
          const f = (v.fEmision || '').slice(0, 10);
          return f.startsWith(`${anio}-${mes}`);
        });
      } else if (this.filtroFecha === 'range' && (this.fechaDesde || this.fechaHasta)) {
        if (this.fechaDesde) listVa = listVa.filter((v) => (v.fEmision || '').slice(0, 10) >= this.fechaDesde);
        if (this.fechaHasta) listVa = listVa.filter((v) => (v.fEmision || '').slice(0, 10) <= this.fechaHasta);
      }

      let ruc = (this.filtroRuc || '').toLowerCase().trim();
      if (ruc) listVa = listVa.filter((v) => (v.clienteRuc || '').toLowerCase().includes(ruc));

      let razon = (this.filtroRazon || '').toLowerCase().trim();
      if (razon) listVa = listVa.filter((v) => (v.clienteRazonSocial || '').toLowerCase().includes(razon));

      const numVa = (this.filtroNumero || '').trim();
      if (numVa) listVa = listVa.filter((v) => (v.idVentaAgrupada || '').toLowerCase().includes(numVa.toLowerCase()));

      this.ventas = listVa;

      let listComp = [...this.ventasEmpresaConst];
      if (this.filtroFecha === 'today') {
        const hoy = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })();
        listComp = listComp.filter((v) => (v.fEmision || '').slice(0, 10) === hoy);
      } else if (this.filtroFecha === 'month') {
        const now = new Date();
        const mes = String(now.getMonth() + 1).padStart(2, '0');
        const anio = now.getFullYear();
        listComp = listComp.filter((v) => {
          const f = (v.fEmision || '').slice(0, 10);
          return f.startsWith(`${anio}-${mes}`);
        });
      } else if (this.filtroFecha === 'range' && (this.fechaDesde || this.fechaHasta)) {
        if (this.fechaDesde) listComp = listComp.filter((v) => (v.fEmision || '').slice(0, 10) >= this.fechaDesde);
        if (this.fechaHasta) listComp = listComp.filter((v) => (v.fEmision || '').slice(0, 10) <= this.fechaHasta);
      }

      ruc = (this.filtroRuc || '').toLowerCase().trim();
      if (ruc) listComp = listComp.filter((v) => (v.clienteRuc || '').toLowerCase().includes(ruc));

      razon = (this.filtroRazon || '').toLowerCase().trim();
      if (razon) listComp = listComp.filter((v) => (v.clienteRazonSocial || '').toLowerCase().includes(razon));

      const numComp = (this.filtroNumero || '').trim();
      if (numComp) {
        const n = numComp.toLowerCase();
        listComp = listComp.filter(
          (v) =>
            (v.compVenta || '').toLowerCase().includes(n) ||
            String(v.idVenta).includes(numComp)
        );
      }

      const tipo = (this.filtroTipoComprobante || '').trim();
      if (tipo) listComp = listComp.filter((v) => (v.nombreComprobante || '').toLowerCase().includes(tipo.toLowerCase()));

      this.ventasEmpresa = listComp;
    } else {
      let list = [...this.ventasEmpresaConst];
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

      this.ventasEmpresa = list;
    }
  }

  limpiarFiltros(): void {
    this.page = 1;
    this.pageCompGestora = 1;
    this.filtroFecha = 'all';
    this.fechaDesde = '';
    this.fechaHasta = '';
    this.filtroRuc = '';
    this.filtroRazon = '';
    this.filtroNumero = '';
    this.filtroTipoComprobante = '';
    if (this.esGestora) {
      this.ventas = [...this.ventasConst];
      this.ventasEmpresa = [...this.ventasEmpresaConst];
    } else {
      this.ventasEmpresa = [...this.ventasEmpresaConst];
    }
  }
  estadoPagoLabel(idEstadoPago: number | undefined): string {
    if (idEstadoPago == null) return 'Pendiente';
    return idEstadoPago === 2 ? 'Pagado' : 'Pendiente';
  }

  formatearMoneda(value: number | undefined): string {
    if (value == null) return 'S/ 0.00';
    return 'S/ ' + Number(value).toFixed(2);
  }

  formatearFecha(fEmision: string | undefined): string {
    if (!fEmision) return '—';
    return fEmision.slice(0, 19).replace('T', ' ');
  }

  etiquetaTipoComprobanteDestino(codigo: string | undefined | null): string {
    const c = (codigo || '').trim().toUpperCase();
    if (c === 'NV') return 'Nota Venta';
    if (c === '01') return 'Factura';
    if (c === '03') return 'Boleta';
    return c || '—';
  }

  /** Comprobante VA solo en formato ticket térmico (ventana + Imprimir). */
  imprimirVA(idVentaAgrupada: string): void {
    if (!idVentaAgrupada) return;
    this.imprimiendoVAId = idVentaAgrupada;
    this.ventasService.getComprobanteVAParaPdf(idVentaAgrupada).subscribe({
      next: (res) => {
        this.imprimiendoVAId = null;
        if (!res?.data) {
          alert('No se pudieron cargar los datos del comprobante VA.');
          return;
        }
        if (!openComprobanteVaTicket(res.data, idVentaAgrupada)) {
          alert('Permita ventanas emergentes para ver e imprimir el ticket VA.');
        }
      },
      error: () => {
        this.imprimiendoVAId = null;
        alert('No se pudo cargar el comprobante VA para impresión.');
      }
    });
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

  /** True si se debe mostrar el botón Enviar a SUNAT. */
  puedeEnviarSunat(v: VentaListado): boolean {
    if (v.eliminado) return false;
    if (this.idComprobanteStr(v) === '') return false;
    if (this.useResumenDiarioBoletas && (v.tipoComprobante === '03' || (v.nombreComprobante || '').toLowerCase().includes('boleta'))) return false;
    return true;
  }

  private esCodigoTipoSunat(codigo: string | undefined | null): boolean {
    const c = (codigo || '').trim().toUpperCase();
    return c === '01' || c === '03' || c === '07' || c === '08';
  }

  esCotizacionONotaVenta(v: VentaListado): boolean {
    const tipoCe = (v.tipoComprobante || '').trim();
    if (this.esCodigoTipoSunat(tipoCe)) return false;
    const codCat = (v.codigoComprobante || '').trim().toUpperCase();
    if (this.esCodigoTipoSunat(codCat)) return false;
    if (codCat === 'CT' || codCat === 'NV') return true;
    const n = (v.nombreComprobante || '').toLowerCase();
    if (n.includes('cotiz')) return true;
    if (n.includes('nota de venta')) return true;
    return false;
  }

  muestraOpcionesFacturacionEnMenu(v: VentaListado): boolean {
    return !this.esCotizacionONotaVenta(v) && this.idComprobanteStr(v) !== '';
  }

  esNotaVentaSinSunat(v: VentaListado): boolean {
    const tipoCe = (v.tipoComprobante || '').trim();
    if (this.esCodigoTipoSunat(tipoCe)) return false;
    const codCat = (v.codigoComprobante || '').trim().toUpperCase();
    if (this.esCodigoTipoSunat(codCat)) return false;
    if (codCat === 'NV') return true;
    const n = (v.nombreComprobante || '').toLowerCase();
    return n.includes('nota de venta');
  }

  etiquetaEstadoSunatListado(v: VentaListado): string {
    if (v.eliminado) return 'Anulado';
    if (this.esNotaVentaSinSunat(v)) return '—';
    return this.estadoSunatLabel(v.idEstadoSunat);
  }

  dentro24HorasDesdeEmision(v: VentaListado): boolean {
    const s = (v.fEmision || '').trim();
    if (!s) return false;
    const t = new Date(s.replace(' ', 'T')).getTime();
    if (!Number.isFinite(t)) return false;
    return Date.now() - t <= 24 * 60 * 60 * 1000;
  }

  puedeEditarVenta(v: VentaListado): boolean {
    if (v.eliminado) return false;
    const id = v?.idEstadoSunat;
    if (!this.esNotaVentaSinSunat(v) && (id === 1 || id === 2 || id === 3)) return false;
    if (this.esCotizacionONotaVenta(v) && !this.dentro24HorasDesdeEmision(v)) return false;
    return true;
  }

  puedeEliminarVenta(v: VentaListado): boolean {
    if (v.eliminado) return false;
    const id = v?.idEstadoSunat;
    if (!this.esNotaVentaSinSunat(v) && (id === 1 || id === 2 || id === 3)) return false;
    return true;
  }

  etiquetaFormaPago(v: VentaListado): string {
    const fp = (v.formaPago || '').trim();
    if (!fp || fp === '{}') return '—';
    return fp;
  }

  confirmarAnularVenta(v: VentaListado): void {
    if (!this.puedeEliminarVenta(v)) return;
    if (!confirm(`¿Anular el comprobante ${v.compVenta || v.idVenta}? Se restaurará el stock y el registro quedará tachado en el historial.`)) {
      return;
    }
    this.anulandoIdVenta = v.idVenta;
    this.ventasService.anularVenta(v.idVenta).subscribe({
      next: (res) => {
        this.anulandoIdVenta = null;
        alert(res.message || 'Comprobante anulado.');
        this.cargarVentas();
      },
      error: (err) => {
        this.anulandoIdVenta = null;
        const msg = err?.error?.error || err?.error?.message || err?.message || 'No se pudo anular.';
        alert(msg);
      }
    });
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
        const body = err?.error;
        let msg = typeof body === 'object' && body !== null && typeof body.message === 'string'
          ? body.message
          : err?.message || 'Error al enviar a SUNAT';
        if (typeof body === 'string' && (body.includes('<') || body.includes('faultstring'))) {
          msg = 'SUNAT no pudo procesar el envío. Intente nuevamente o comuníquese con su Administrador.';
        }
        alert(msg);
      }
    });
  }

  consultarEstadoEnSunat(v: VentaListado): void {
    const id = this.idComprobanteStr(v);
    if (!id) return;
    this.consultandoEstadoId = id;
    this.facturacionService.consultarEstadoSunat(id).subscribe({
      next: (res) => {
        this.consultandoEstadoId = null;
        this.cargarVentas();
        const msg = res?.message || 'Estado actualizado';
        const det = res?.data ? `\n${res.data.estadoSunat || ''}${res.data.codigoRespuesta ? ' - ' + res.data.codigoRespuesta : ''}` : '';
        alert(msg + det);
      },
      error: (err) => {
        this.consultandoEstadoId = null;
        alert(err?.error?.message || err?.message || 'Error al consultar estado');
      }
    });
  }

  consultarValidezEnSunat(v: VentaListado): void {
    const id = this.idComprobanteStr(v);
    if (!id) return;
    this.consultandoValidezId = id;
    this.facturacionService.consultarValidezComprobante({ idComprobanteElectronico: id }).subscribe({
      next: (res) => {
        this.consultandoValidezId = null;
        const d = res?.data;
        const msg = d?.valido ? `Válido: ${d.mensaje || 'Comprobante aceptado'}` : `No válido: ${d?.mensaje || d?.error || 'Verifique en SUNAT'}`;
        alert(msg);
      },
      error: (err) => {
        this.consultandoValidezId = null;
        alert(err?.error?.message || err?.message || 'Error al consultar validez');
      }
    });
  }

  estadoSunatClass(idEstadoSunat: number | undefined): string {
    if (idEstadoSunat == null) return 'bg-secondary';
    if (idEstadoSunat === 7) return 'bg-warning text-dark';
    if (idEstadoSunat === 1 || idEstadoSunat === 2 || idEstadoSunat === 3) return 'bg-info';
    return 'bg-danger';
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
    this.idVentaPdfComprobanteHijo = null;
    this.mostrarWhatsappForm = false;
    this.datosParaWhatsapp = null;
    this.whatsappMensaje = null;
  }

  abrirModalPdfComprobanteHijo(idVenta: number): void {
    this.idVentaPdfComprobanteHijo = idVenta;
    this.mostrarWhatsappFormHijo = false;
    this.datosParaWhatsappHijo = null;
    this.whatsappMensajeHijo = null;
    const el = document.getElementById('pdfModalComprobanteHijo');
    if (el && (window as unknown as { bootstrap?: { Modal: { getOrCreateInstance: (e: HTMLElement) => { show: () => void } } } }).bootstrap) {
      (window as unknown as { bootstrap: { Modal: { getOrCreateInstance: (e: HTMLElement) => { show: () => void } } } }).bootstrap.Modal.getOrCreateInstance(el).show();
    }
  }

  generarPdfComprobanteHijo(formato: 'A4' | 'A5' | 'ticket'): void {
    const id = this.idVentaPdfComprobanteHijo;
    if (id == null) return;
    this.imprimirComprobante(id, formato);
  }

  cerrarFormWhatsappHijo(): void {
    this.mostrarWhatsappFormHijo = false;
    this.datosParaWhatsappHijo = null;
    this.whatsappNumberHijo = '';
    this.whatsappCaptionHijo = '';
    this.whatsappFormatoHijo = 'A4';
    this.whatsappMensajeHijo = null;
  }

  abrirFormWhatsappHijo(): void {
    const idVenta = this.idVentaPdfComprobanteHijo;
    if (idVenta == null) return;
    this.generandoPdf = true;
    this.whatsappMensajeHijo = null;
    this.ventasService.getComprobanteParaPdf(idVenta).subscribe({
      next: (res) => {
        const d = res.data;
        this.generandoPdf = false;
        if (!d) return;
        const cantidadLetras = numeroALetras(Number(d.venta?.total ?? 0));
        const nombreArchivo = `comprobante-${(d.venta?.compVenta || 'venta').replace(/-/g, '_')}.pdf`;
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
        this.datosParaWhatsappHijo = { datos, nombreArchivo };
        this.whatsappNumberHijo = (d.cliente as { celular?: string })?.celular ?? '';
        this.mostrarWhatsappFormHijo = true;
      },
      error: (err) => {
        this.generandoPdf = false;
        this.whatsappMensajeHijo = err?.error?.error || err?.message || 'No se pudieron cargar los datos.';
      }
    });
  }

  enviarPdfPorWhatsappHijo(): void {
    if (!this.datosParaWhatsappHijo || !this.whatsappNumberHijo.trim()) {
      this.whatsappMensajeHijo = 'Ingrese el número de WhatsApp (ej. 51999999999).';
      return;
    }
    this.enviandoWhatsappHijo = true;
    this.whatsappMensajeHijo = null;
    const { datos, nombreArchivo } = this.datosParaWhatsappHijo;
    const formato = this.whatsappFormatoHijo;
    this.pdfService.generarPdfComprobanteVenta(datos as never, formato, nombreArchivo).subscribe({
      next: (blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : dataUrl;
          this.whatsappService.enviarArchivo(this.whatsappNumberHijo.trim(), base64, nombreArchivo, 'document', this.whatsappCaptionHijo.trim() || undefined).subscribe({
            next: (res) => {
              this.enviandoWhatsappHijo = false;
              this.whatsappMensajeHijo = res.message;
              if (res.success) setTimeout(() => this.cerrarFormWhatsappHijo(), 2000);
            },
            error: (err) => {
              this.enviandoWhatsappHijo = false;
              this.whatsappMensajeHijo = err?.error?.message || err?.message || 'Error al enviar por WhatsApp.';
            }
          });
        };
        reader.readAsDataURL(blob);
      },
      error: () => {
        this.enviandoWhatsappHijo = false;
        this.whatsappMensajeHijo = 'Error al generar el PDF.';
      }
    });
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
        const e = err?.error;
        if (e instanceof Blob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            try {
              const json = JSON.parse(reader.result as string);
              this.whatsappMensaje = json?.error || 'Error al generar el PDF.';
            } catch {
              this.whatsappMensaje = 'Error al generar el PDF.';
            }
          };
          reader.readAsText(e);
        } else {
          this.whatsappMensaje = (e && typeof e === 'object' && typeof (e as { error?: string }).error === 'string')
            ? (e as { error: string }).error
            : err?.message || 'Error al generar el PDF.';
        }
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

  get resumenValidosSunat(): { cantidad: number; total: number } {
    const list = this.ventasEmpresa.filter(
      (v) => !v.eliminado && !this.esNotaVentaSinSunat(v) && (v.idEstadoSunat === 1 || v.idEstadoSunat === 2 || v.idEstadoSunat === 3)
    );
    const total = list.reduce((sum, v) => sum + (Number(v.total) || 0), 0);
    return { cantidad: list.length, total };
  }

  get resumenNoValidosSunat(): { cantidad: number; total: number } {
    const list = this.ventasEmpresa.filter(
      (v) => !v.eliminado && !this.esNotaVentaSinSunat(v) && v.idEstadoSunat !== 1 && v.idEstadoSunat !== 2 && v.idEstadoSunat !== 3
    );
    const total = list.reduce((sum, v) => sum + (Number(v.total) || 0), 0);
    return { cantidad: list.length, total };
  }

  abrirModalComprobantes(v: VentaAgrupadaListado): void {
    this.ventaAgrupadaSeleccionada = v;
    this.comprobantesVenta = [];
    this.errorComprobantes = '';
    this.cargandoComprobantes = true;
    this.ventasService.listarComprobantesVentaAgrupada(v.idVentaAgrupada).subscribe({
      next: (res) => {
        this.comprobantesVenta = res.data || [];
        this.cargandoComprobantes = false;
      },
      error: () => {
        this.cargandoComprobantes = false;
        this.errorComprobantes = 'No se pudieron cargar los comprobantes.';
      }
    });
  }

  imprimirComprobante(idVenta: number, formato: 'A4' | 'A5' | 'ticket'): void {
    this.generandoPdf = true;
    this.comprobanteImprimiendoId = idVenta;
    this.ventasService.getComprobanteParaPdf(idVenta).subscribe({
      next: (res) => {
        const d = res.data;
        if (!d) {
          this.generandoPdf = false;
          this.comprobanteImprimiendoId = null;
          return;
        }
        const cantidadLetras = numeroALetras(Number(d.venta?.total ?? 0));
        const nombreArchivo = `comprobante-${(d.venta?.compVenta || 'venta').replace(/-/g, '_')}.pdf`;
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
        this.pdfService.generarPdfComprobanteVenta(datos, formato, nombreArchivo).subscribe({
          next: (blob) => {
            this.pdfService.previsualizar(blob);
            this.generandoPdf = false;
            this.comprobanteImprimiendoId = null;
          },
          error: () => {
            this.generandoPdf = false;
            this.comprobanteImprimiendoId = null;
            alert('Error al generar el PDF.');
          }
        });
      },
      error: () => {
        this.generandoPdf = false;
        this.comprobanteImprimiendoId = null;
        alert('No se pudieron cargar los datos del comprobante.');
      }
    });
  }

  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  /** Exporta la lista actual (filtrada) de ventas a PDF (vista previa). */
  exportarListaPdf(): void {
    if (this.esGestora && this.ventas.length === 0 && this.ventasEmpresa.length === 0) return;
    if (!this.esGestora && this.ventasEmpresa.length === 0) return;
    const emp = this.empresa;
    const empresaPdf = {
      logo: emp?.logo ?? '',
      nombre: emp?.nombre ?? '',
      ruc: emp?.ruc ?? '',
      direccion: emp?.direccion ?? '',
      telefono: emp?.telefono ?? ''
    };
    const datos = this.esGestora
      ? this.ventasEmpresa.length > 0
        ? {
            empresa: empresaPdf,
            titulo: 'Comprobantes (gestora y empresas gestionadas)',
            columnas: ['#', 'Empresa', 'Fecha', 'Comprobante', 'RUC Cliente', 'Cliente', 'Total (S/)', 'Estado SUNAT'],
            filas: this.ventasEmpresa.map((v, i) => [
              i + 1,
              (v.razonSocialEmpresa || '').trim() || '—',
              this.formatearFecha(v.fEmision),
              v.compVenta || '—',
              v.clienteRuc || '—',
              v.clienteRazonSocial || '—',
              `S/ ${Number(v.total).toFixed(2)}`,
              this.etiquetaEstadoSunatListado(v)
            ])
          }
        : {
            empresa: empresaPdf,
            titulo: 'Lista de Ventas Agrupadas',
            columnas: ['#', 'Fecha', 'ID Venta', 'RUC Cliente', 'Cliente', 'Sucursal', 'Total (S/)', 'Estado Pago'],
            filas: this.ventas.map((v, i) => [
              i + 1,
              this.formatearFecha(v.fEmision),
              v.idVentaAgrupada || '—',
              v.clienteRuc || '—',
              v.clienteRazonSocial || '—',
              v.sucursal || '—',
              `S/ ${Number(v.total).toFixed(2)}`,
              this.estadoPagoLabel(v.idEstadoPago)
            ])
          }
      : {
          empresa: empresaPdf,
          titulo: 'Lista de Ventas',
          columnas: ['#', 'Fecha', 'Comprobante', 'RUC Cliente', 'Cliente', 'Total (S/)', 'Estado SUNAT'],
          filas: this.ventasEmpresa.map((v, i) => [
            i + 1,
            this.formatearFecha(v.fEmision),
            v.compVenta || '—',
            v.clienteRuc || '—',
            v.clienteRazonSocial || '—',
            `S/ ${Number(v.total).toFixed(2)}`,
            this.etiquetaEstadoSunatListado(v)
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
    if (this.esGestora && this.ventas.length === 0 && this.ventasEmpresa.length === 0) return;
    if (!this.esGestora && this.ventasEmpresa.length === 0) return;
    const datosExcel = this.esGestora
      ? this.ventasEmpresa.length > 0
        ? {
            title: 'Comprobantes (gestora y gestionadas)',
            filename: `ventas_${new Date().getTime()}`,
            worksheetName: 'Ventas',
            columns: ['#', 'Empresa', 'Fecha', 'Comprobante', 'RUC Cliente', 'Cliente', 'Total (S/)', 'Estado SUNAT'],
            rows: this.ventasEmpresa.map((v, i) => [
              i + 1,
              (v.razonSocialEmpresa || '').trim() || '—',
              this.formatearFecha(v.fEmision),
              v.compVenta || '—',
              v.clienteRuc || '—',
              v.clienteRazonSocial || '—',
              Number(v.total),
              this.etiquetaEstadoSunatListado(v)
            ])
          }
        : {
            title: 'Lista de Ventas Agrupadas',
            filename: `ventas_${new Date().getTime()}`,
            worksheetName: 'Ventas',
            columns: ['#', 'Fecha', 'ID Venta', 'RUC Cliente', 'Cliente', 'Sucursal', 'Total (S/)', 'Estado Pago'],
            rows: this.ventas.map((v, i) => [
              i + 1,
              this.formatearFecha(v.fEmision),
              v.idVentaAgrupada || '—',
              v.clienteRuc || '—',
              v.clienteRazonSocial || '—',
              v.sucursal || '—',
              Number(v.total),
              this.estadoPagoLabel(v.idEstadoPago)
            ])
          }
      : {
          title: 'Lista de Ventas',
          filename: `ventas_${new Date().getTime()}`,
          worksheetName: 'Ventas',
          columns: ['#', 'Fecha', 'Comprobante', 'RUC Cliente', 'Cliente', 'Total (S/)', 'Estado SUNAT'],
          rows: this.ventasEmpresa.map((v, i) => [
            i + 1,
            this.formatearFecha(v.fEmision),
            v.compVenta || '—',
            v.clienteRuc || '—',
            v.clienteRazonSocial || '—',
            Number(v.total),
            this.etiquetaEstadoSunatListado(v)
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
