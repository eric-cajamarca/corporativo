import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FacturacionService, OrigenParaNota, ComprobanteOrigenItem } from '../../../services/facturacion.service';
import { CatalogosService } from '../../../services/catalogos.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';

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
  imports: [CommonModule, FormsModule, RouterLink, SidebarComponent, TopnavComponent],
  templateUrl: './notas-credito-debito.component.html',
  styleUrl: './notas-credito-debito.component.css'
})
export class NotasCreditoDebitoComponent implements OnInit {

  sidebarState = inject(SidebarStateService);
  origen: OrigenParaNota | null = null;
  /** Búsqueda por serie-número */
  serie = '';
  numero = '';
  tipoComprobanteRef = '01';
  /** Búsqueda por RUC o razón social del cliente */
  rucCliente = '';
  razonSocialCliente = '';
  listadoBusqueda: ComprobanteOrigenItem[] = [];
  loadingOrigen = false;
  loadingListado = false;
  /** Tipo de nota a emitir */
  tipoNota: '07' | '08' = '07';
  codigoMotivoNotaCredito = '01';
  motivosNotaCredito: { codigoSunat: string; descripcion: string }[] = [];
  /** Ítems editables (copia del origen) */
  items: ItemEditable[] = [];
  guardando = false;
  creado: { idVenta: string; idComprobanteElectronico: string } | null = null;
  enviandoId: string | null = null;

  constructor(
    private _facturacionService: FacturacionService,
    private _catalogosService: CatalogosService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.cargarMotivosNotaCredito();
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
