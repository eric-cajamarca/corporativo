import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { FacturacionService, OrigenParaNota, ComprobanteOrigenItem } from '../../../services/facturacion.service';
import { CatalogosService } from '../../../services/catalogos.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { VentasService, NotaCreditoDebitoListado } from '../../../services/ventas.service';
import { PdfService } from '../../../services/pdf.service';
import { numeroALetras } from '../../../utils/numeroALetras';
import { Empresa } from '../../../interfaces/pdf-interface';

declare var iziToast: any;

interface ItemEditable {
  idProducto: string;
  descripcion?: string;
  cantidad: number;
  pVenta: number;
  subtotal: number;
  total: number;
}

@Component({
  selector: 'app-notas-credito-debito',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SidebarComponent, TopnavComponent, NgbPagination],
  templateUrl: './notas-credito-debito.component.html',
  styleUrl: './notas-credito-debito.component.css'
})
export class NotasCreditoDebitoComponent implements OnInit {

  sidebarState = inject(SidebarStateService);
  origen: OrigenParaNota | null = null;
  serie = '';
  numero = '';
  tipoComprobanteRef = '01';
  rucCliente = '';
  razonSocialCliente = '';
  listadoBusqueda: ComprobanteOrigenItem[] = [];
  loadingOrigen = false;
  loadingListado = false;
  tipoNota: '07' | '08' = '07';
  codigoMotivoNotaCredito = '01';
  motivosNotaCredito: { codigoSunat: string; descripcion: string }[] = [];
  items: ItemEditable[] = [];
  guardando = false;
  creado: { idVenta: string; idComprobanteElectronico: string } | null = null;
  enviandoId: string | null = null;

  /** Tabla de notas emitidas */
  notasEmitidas: NotaCreditoDebitoListado[] = [];
  loadingNotasEmitidas = false;
  totalNotasEmitidas = 0;
  buscarNotasInput = '';
  buscarNotasFiltro = '';
  paginaNotas = 1;
  porPaginaNotas = 15;
  pdfNotaCargandoId: number | null = null;
  eliminandoIdVenta: number | null = null;

  constructor(
    private _facturacionService: FacturacionService,
    private _catalogosService: CatalogosService,
    private _ventasService: VentasService,
    private _pdfService: PdfService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.cargarMotivosNotaCredito();
    this.cargarNotasEmitidas();
    this.route.queryParams.subscribe((params) => {
      const serie = (params['serie'] || '').trim();
      const numero = (params['numero'] || '').trim().replace(/\D/g, '');
      const tipo = (params['tipoComprobanteRef'] || '').trim();
      if (tipo) this.tipoComprobanteRef = tipo;
      if (serie) this.serie = serie;
      if (numero) this.numero = numero;
      if (serie && numero) {
        this.cargarOrigen({ serie, numero, tipoComprobante: this.tipoComprobanteRef || '01' });
      }
    });
  }

  cargarNotasEmitidas(): void {
    this.loadingNotasEmitidas = true;
    this._ventasService
      .listarNotasCreditoDebito({
        buscar: this.buscarNotasFiltro || undefined,
        pagina: this.paginaNotas,
        porPagina: this.porPaginaNotas
      })
      .subscribe({
        next: (res) => {
          this.loadingNotasEmitidas = false;
          this.notasEmitidas = res?.data ?? [];
          this.totalNotasEmitidas = typeof res?.total === 'number' ? res.total : this.notasEmitidas.length;
        },
        error: (err) => {
          this.loadingNotasEmitidas = false;
          this.notasEmitidas = [];
          this.totalNotasEmitidas = 0;
          const msg = err?.error?.message || err?.message || 'Error al cargar el listado de notas.';
          if (typeof iziToast !== 'undefined') iziToast.error({ title: 'Error', message: msg });
        }
      });
  }

  aplicarBusquedaNotas(): void {
    this.buscarNotasFiltro = (this.buscarNotasInput || '').trim();
    this.paginaNotas = 1;
    this.cargarNotasEmitidas();
  }

  onPaginaNotasChange(p: number): void {
    this.paginaNotas = p;
    this.cargarNotasEmitidas();
  }

  scrollToEmitir(): void {
    const el = document.getElementById('notas-emitir-bloque');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  prefijoTipoNota(row: NotaCreditoDebitoListado): string {
    const c = (row.codigoComprobante || '').toUpperCase();
    if (['F8', 'B8', '08'].includes(c)) return 'ND';
    return 'NC';
  }

  textoDocumento(row: NotaCreditoDebitoListado): string {
    const serie = (row.serie || '').trim();
    const num = String(row.numero || '').replace(/\D/g, '').padStart(8, '0');
    return `${this.prefijoTipoNota(row)} ${serie}-${num}`;
  }

  formatearFechaCorta(f: string | undefined): string {
    if (!f) return '—';
    const s = f.trim().slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    const m2 = /^(\d{4})-(\d{2})-(\d{2})/.exec(f);
    if (m2) return `${m2[3]}/${m2[2]}/${m2[1]}`;
    return s;
  }

  estadoNotaEtiqueta(idEstadoSunat: number | null | undefined): string {
    if (idEstadoSunat == null) return 'PENDIENTE';
    if (idEstadoSunat === 7) return 'PEND. ENVÍO';
    if (idEstadoSunat === 1 || idEstadoSunat === 2) return 'CONFIRMADO';
    if (idEstadoSunat === 3) return 'CONFIRMADO (OBS.)';
    if (idEstadoSunat === 6) return 'ERROR ENVÍO';
    if (idEstadoSunat === 4) return 'RECHAZADO';
    return 'PENDIENTE';
  }

  puedeEliminarNota(row: NotaCreditoDebitoListado): boolean {
    const id = row.idEstadoSunat;
    if (id === 1 || id === 2 || id === 3) return false;
    return true;
  }

  verNota(idVenta: number): void {
    this.abrirPdfNota(idVenta, 'A4');
  }

  imprimirNota(idVenta: number): void {
    this.abrirPdfNota(idVenta, 'A4');
  }

  private abrirPdfNota(idVenta: number, formato: 'A4' | 'A5' | 'ticket'): void {
    this.pdfNotaCargandoId = idVenta;
    this._ventasService.getComprobanteParaPdf(idVenta).subscribe({
      next: (res) => {
        const d = res.data;
        if (!d) {
          this.pdfNotaCargandoId = null;
          return;
        }
        const cantidadLetras = numeroALetras(Number(d.venta?.total ?? 0));
        const nombreArchivo = `comprobante-${(d.venta?.compVenta || 'nota').replace(/-/g, '_')}.pdf`;
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
          nombreArchivo
        };
        this._pdfService.generarPdfComprobanteVenta(datos, formato, nombreArchivo).subscribe({
          next: (blob) => {
            this._pdfService.previsualizar(blob);
            this.pdfNotaCargandoId = null;
          },
          error: () => {
            this.pdfNotaCargandoId = null;
            if (typeof iziToast !== 'undefined') iziToast.error({ title: 'Error', message: 'No se pudo generar el PDF.' });
          }
        });
      },
      error: () => {
        this.pdfNotaCargandoId = null;
        if (typeof iziToast !== 'undefined') iziToast.error({ title: 'Error', message: 'No se pudieron cargar los datos del comprobante.' });
      }
    });
  }

  confirmarEliminarNota(row: NotaCreditoDebitoListado): void {
    if (!this.puedeEliminarNota(row)) return;
    const doc = this.textoDocumento(row);
    if (!confirm(`¿Eliminar la nota ${doc}? Se restaurará el stock. Solo use esta opción si la nota no fue enviada o aceptada en SUNAT.`)) {
      return;
    }
    this.eliminandoIdVenta = row.idVenta;
    this._ventasService.anularVenta(row.idVenta).subscribe({
      next: (res) => {
        this.eliminandoIdVenta = null;
        if (typeof iziToast !== 'undefined') iziToast.success({ title: 'Listo', message: res.message || 'Nota anulada.' });
        this.cargarNotasEmitidas();
      },
      error: (err) => {
        this.eliminandoIdVenta = null;
        const msg = err?.error?.error || err?.error?.message || err?.message || 'No se pudo eliminar.';
        if (typeof iziToast !== 'undefined') iziToast.error({ title: 'Error', message: msg });
      }
    });
  }

  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  cargarMotivosNotaCredito(): void {
    this._catalogosService.listarMotivoNotaCredito(undefined, 1, 50).subscribe({
      next: (res) => {
        const list = res?.data ?? [];
        this.motivosNotaCredito = list.map((m: any) => ({ codigoSunat: m.codigoSunat || '01', descripcion: m.descripcion || m.codigoSunat || 'Anulación' }));
        if (this.motivosNotaCredito.length === 0) {
          this.motivosNotaCredito = [{ codigoSunat: '01', descripcion: 'Anulación de la operación' }];
        }
      },
      error: () => {
        this.motivosNotaCredito = [{ codigoSunat: '01', descripcion: 'Anulación de la operación' }];
      }
    });
  }

  buscarPorSerieNumero(): void {
    const s = (this.serie || '').trim();
    const n = (this.numero || '').trim().replace(/\D/g, '');
    if (!s || !n) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Búsqueda', message: 'Indique serie y número del comprobante (Factura/Boleta aceptada).' });
      }
      return;
    }
    this.cargarOrigen({ serie: s, numero: n, tipoComprobante: this.tipoComprobanteRef || '01' });
  }

  buscarPorRucRazonSocial(): void {
    const ruc = (this.rucCliente || '').trim();
    const razon = (this.razonSocialCliente || '').trim();
    if (!ruc && !razon) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Búsqueda', message: 'Indique RUC o razón social del cliente.' });
      }
      return;
    }
    this.loadingListado = true;
    this.listadoBusqueda = [];
    this._facturacionService.listarComprobantesOrigenPorCliente({
      rucCliente: ruc || undefined,
      razonSocial: razon || undefined,
      tipoComprobante: this.tipoComprobanteRef || undefined
    }).subscribe({
      next: (res) => {
        this.loadingListado = false;
        this.listadoBusqueda = res?.data ?? [];
        if (this.listadoBusqueda.length === 0 && typeof iziToast !== 'undefined') {
          iziToast.info({ title: 'Búsqueda', message: 'No se encontraron comprobantes.' });
        }
      },
      error: (err) => {
        this.loadingListado = false;
        this.listadoBusqueda = [];
        const msg = err?.error?.message || err?.message || 'Error al buscar.';
        if (typeof iziToast !== 'undefined') iziToast.error({ title: 'Error', message: msg });
      }
    });
  }

  seleccionarComprobante(item: ComprobanteOrigenItem): void {
    this.listadoBusqueda = [];
    this.cargarOrigen({ idComprobanteElectronico: item.idComprobanteElectronico });
  }

  cargarOrigen(params: { idComprobanteElectronico?: string; serie?: string; numero?: string; tipoComprobante?: string }): void {
    this.loadingOrigen = true;
    this.origen = null;
    this.creado = null;
    this._facturacionService.obtenerOrigenParaNota(params).subscribe({
      next: (res) => {
        this.loadingOrigen = false;
        this.origen = res?.data ?? null;
        this.items = (this.origen?.items ?? []).map(it => ({
          idProducto: it.idProducto,
          descripcion: it.descripcion,
          cantidad: Number(it.cantidad) || 0,
          pVenta: Number(it.pVenta) || 0,
          subtotal: Number(it.subtotal) || 0,
          total: Number(it.total) || 0
        }));
      },
      error: (err) => {
        this.loadingOrigen = false;
        const msg = err?.error?.message || err?.message || 'Comprobante no encontrado o no está aceptado (solo Factura/Boleta).';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        }
      }
    });
  }

  recalcularItem(item: ItemEditable): void {
    const cant = Number(item.cantidad) || 0;
    const pv = Number(item.pVenta) || 0;
    item.subtotal = Math.round(cant * pv * 100) / 100;
    item.total = item.subtotal;
  }

  get totalGeneral(): number {
    return this.items.reduce((s, it) => s + (Number(it.total) || 0), 0);
  }

  crearNota(): void {
    if (!this.origen?.comprobanteOrigen?.idComprobanteElectronico) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Datos', message: 'Cargue primero un comprobante origen.' });
      }
      return;
    }
    if (this.items.length === 0 || this.items.every(it => (Number(it.cantidad) || 0) <= 0)) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Ítems', message: 'Debe haber al menos un ítem con cantidad mayor a 0.' });
      }
      return;
    }
    const body = {
      idComprobanteElectronicoOrigen: this.origen.comprobanteOrigen.idComprobanteElectronico,
      tipoNota: this.tipoNota,
      codigoMotivoNotaCredito: this.tipoNota === '07' ? (this.codigoMotivoNotaCredito || '01') : undefined,
      items: this.items
        .filter(it => (Number(it.cantidad) || 0) > 0)
        .map(it => ({
          idProducto: it.idProducto,
          cantidad: Number(it.cantidad) || 0,
          pVenta: Number(it.pVenta) || 0,
          subtotal: Number(it.subtotal) || 0,
          total: Number(it.total) || 0
        }))
    };
    this.guardando = true;
    this._facturacionService.crearNotaCreditoDebito(body).subscribe({
      next: (res) => {
        this.guardando = false;
        this.creado = res?.data ?? null;
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Creado', message: this.tipoNota === '07' ? 'Nota de crédito creada.' : 'Nota de débito creada.' });
        }
        this.paginaNotas = 1;
        this.cargarNotasEmitidas();
      },
      error: (err) => {
        this.guardando = false;
        const msg = err?.error?.message || err?.message || 'Error al crear la nota.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        }
      }
    });
  }

  enviarSunat(idComprobante: string): void {
    this.enviandoId = idComprobante;
    this._facturacionService.enviarComprobanteSunat(idComprobante).subscribe({
      next: () => {
        this.enviandoId = null;
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Enviado', message: 'Comprobante enviado a SUNAT. Consulte el estado en Ventas.' });
        }
        this.creado = null;
        this.origen = null;
        this.items = [];
        this.cargarNotasEmitidas();
      },
      error: (err) => {
        this.enviandoId = null;
        const body = err?.error;
        let msg = typeof body === 'object' && body !== null && typeof body.message === 'string'
          ? body.message
          : err?.message || 'Error al enviar.';
        if (typeof body === 'string' && (body.includes('<') || body.includes('faultstring'))) {
          msg = 'SUNAT no pudo procesar el envío. Intente nuevamente o comuníquese con su Administrador.';
        }
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        }
      }
    });
  }

  limpiar(): void {
    this.origen = null;
    this.serie = '';
    this.numero = '';
    this.rucCliente = '';
    this.razonSocialCliente = '';
    this.listadoBusqueda = [];
    this.items = [];
    this.creado = null;
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
