import { Component, inject, OnInit, signal } from '@angular/core';
import { DespachoService } from '../../../services/despacho.service';
import { EmpresaService } from '../../../services/empresa.service';
import { PdfService } from '../../../services/pdf.service';
import { WhatsappService } from '../../../services/whatsapp.service';
import { EnviosService } from '../../../services/envios.service';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { ChoferesService, ChoferInterno } from '../../../services/choferes.service';
import { RegistrarChoferVehiculoModalComponent } from '../registrar-chofer-vehiculo-modal/registrar-chofer-vehiculo-modal.component';
import { RegistrarTransportistaModalComponent } from '../registrar-transportista-modal/registrar-transportista-modal.component';
import {
  DevolucionDespachoDetalle,
  DevolucionDespachoResumen
} from '../../../models/devolucion-despacho.model';

declare const iziToast: any;

export interface DetalleVentaLinea {
  idDetalle: number;
  idProducto: string;
  productoCodigo: string;
  productoDescripcion: string;
  productoMarca?: string;
  cantidad: number;
  cantEntregada: number;
  cantPendiente: number;
  ubicaciones: string;
}

export interface VentaDespachosResult {
  venta: {
    idVenta: number;
    compVenta: string;
    serie: string;
    numero: string;
    fEmision: string;
    total: number;
    idEstadoPedidoVenta: number | null;
    estadoPedidoVentaNombre: string | null;
    idEstadoPago?: number;
    estadoPagoNombre?: string;
    clienteRazonSocial: string;
    clienteRuc: string;
    codigoComprobante?: string;
    eliminado?: boolean;
  };
  despachos: Array<{
    idDespacho: string;
    idVenta: number;
    fechaDespacho: string;
    estado: string;
    observaciones: string | null;
    tipoDespacho: string;
    usuarioDespacho: string;
    totalLineas: number;
    lineasDespachadas: number;
  }>;
  detalleVenta?: DetalleVentaLinea[];
  entregadoMismoDia: boolean;
}

export interface VentaAgrupadaCabDespacho {
  idVentaAgrupada: string;
  compVenta: string;
  serie?: string;
  numero?: string;
  total: number;
  fEmision: string;
  clienteRuc: string;
  clienteRazonSocial: string;
}

export interface ComprobanteVaHijoDespacho {
  idEmpresa: string;
  idVenta: number;
  compVenta: string;
  serie?: string;
  numero?: string;
  nombreComprobante?: string;
  codigoComprobante?: string;
  empresaRazonSocial?: string;
  empresaRuc?: string;
  fEmision: string;
  total: number;
  despachos?: VentaDespachosResult['despachos'];
  detalleVenta?: DetalleVentaLinea[];
}

const UUID_REGEX_VA =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-index-despachos',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule, SidebarComponent, TopnavComponent, RegistrarChoferVehiculoModalComponent, RegistrarTransportistaModalComponent],
  templateUrl: './index-despachos.component.html',
  styleUrl: './index-despachos.component.css'
})
export class IndexDespachosComponent implements OnInit {
  public sidebarState = inject(SidebarStateService);

  esGestora = false;
  /** Empresa gestora: búsqueda por venta agrupada por defecto; comprobante sucursal opcional */
  mostrarBusquedaSimple = false;
  vaCriterio = '';
  vaRuc = '';
  vaNombreCliente = '';
  loadingVa = false;
  errorMsgVa = '';
  resultadoVaLista: Array<{
    idVentaAgrupada: string;
    compVenta: string;
    total: number;
    fEmision: string;
    clienteRuc: string;
    clienteRazonSocial: string;
  }> | null = null;
  resultadoVaDetalle: {
    ventaAgrupada: VentaAgrupadaCabDespacho;
    comprobantes: ComprobanteVaHijoDespacho[];
  } | null = null;
  /** Al operar despacho de un comprobante hijo (empresa gestionada) */
  idEmpresaDespachoActiva: string | null = null;
  
  /** Criterio de búsqueda: número de comprobante o idVenta (puede escanearse del código de barras del comprobante) */
  criterioBusqueda = '';
  loading = false;
  errorMsg = '';
  resultado: VentaDespachosResult | null = null;
  /** Detalle cargado por idDespacho para el acordeón */
  detallePorDespacho: Record<string, Array<{
    idDetalleDespacho: string;
    productoCodigo: string;
    productoDescripcion: string;
    cantidadSolicitada: number;
    cantidadDespachada: number;
    estado: string;
    fechaDespacho: string | null;
    ubicacionOrigen?: string | null;
    ubicacionDestino?: string | null;
  }>> = {};
  loadingDetalle: Record<string, boolean> = {};
  guardandoCantidad: Record<string, boolean> = {};
  cantADespacharEdicion: Record<string, number | undefined> = {};
  devolucionCantidadPorDetalle: Record<string, number> = {};
  devolucionNotasPorDetalle: Record<string, string> = {};
  devolucionObservacionesPorDespacho: Record<string, string> = {};
  enviandoDevolucion: Record<string, boolean> = {};
  cargandoDevoluciones: Record<string, boolean> = {};
  devolucionesPorDespacho: Record<string, DevolucionDespachoResumen[]> = {};
  detalleDevolucionPorDespacho: Record<string, DevolucionDespachoDetalle[]> = {};
  idDevolucionSeleccionada: Record<string, string | null> = {};
 

  /** Modal Crear despacho */
  modalCrearDespachoAbierto = signal<boolean>(false);
  tiposDespacho: Array<{ idTipoDespacho: number; nombre: string }> = [];
  idTipoDespachoPanel: number | null = null;
  observacionesPanel = '';
  accionDespachoPanel: 'NORMAL' | 'CAMBIO_PRODUCTO' | 'DEVOLUCION' = 'NORMAL';
  observacionesCambioPanel = '';
  cantADespacharPanel: Record<number, number> = {};
  enviandoCrear = false;
  generandoPdf = false;
  /** Tras crear despacho, abrir ticket PDF si está marcado */
  imprimirTicketAlCrearDespacho = true;

  // Delivery desde despacho
  modoEntregaPanel: 'RECOJO' | 'DELIVERY' = 'RECOJO';
  tipoDeliveryPanel: 'INTERNO' | 'EXTERNO' = 'INTERNO';
  choferesInternos: ChoferInterno[] = [];
  transportistasExternos: Array<{ idTransportista: string; nombres: string; apellidos: string; placa?: string; estado?: boolean }> = [];
  idChoferSeleccionado: string | null = null;
  idTransportistaSeleccionado: string | null = null;
  idTipoEnvioPanel: number | null = null;
  direccionEntregaPanel = 'SIN_DIRECCION';

  // Modal: registrar chofer interno + vehículo
  modalRegistrarChoferVisible = false;

  // Modal: registrar transportista externo
  modalRegistrarTransportistaVisible = false;

  mostrarWhatsappForm = false;
  whatsappNumber = '';
  whatsappCaption = '';
  whatsappFormato: 'A4' | 'A5' | 'ticket' = 'A4';
  enviandoWhatsapp = false;
  whatsappMensaje: string | null = null;

  /** Solo líneas con pendiente > 0 para el modal crear despacho */
  get detalleConPendiente(): DetalleVentaLinea[] {
    const r = this.resultado;
    if (!r?.detalleVenta?.length) return [];
    return r.detalleVenta.filter((dv: DetalleVentaLinea) => (Number(dv.cantPendiente) || 0) > 0);
  }

  get esNotaVenta(): boolean {
    const cod = (this.resultado?.venta?.codigoComprobante || '').toUpperCase();
    return cod === 'NV';
  }

  constructor(
    private despachoService: DespachoService,
    private empresaService: EmpresaService,
    private pdfService: PdfService,
    private whatsappService: WhatsappService,
    private enviosService: EnviosService,
    private choferesService: ChoferesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (res) => {
        this.esGestora = !!res?.data?.esGestora;
        this.mostrarBusquedaSimple = !this.esGestora;
      },
      error: () => {
        this.esGestora = false;
        this.mostrarBusquedaSimple = true;
      }
    });
  }

  buscarVentaAgrupada(): void {
    this.errorMsgVa = '';
    this.resultadoVaLista = null;
    this.resultadoVaDetalle = null;
    const raw = (this.vaCriterio || '').trim();
    const ruc = (this.vaRuc || '').trim();
    const nombreCliente = (this.vaNombreCliente || '').trim();
    if (!raw && !ruc && !nombreCliente) {
      this.errorMsgVa = 'Indique id o número de venta agrupada, RUC o nombre del cliente.';
      return;
    }
    let idVentaAgrupada: string | undefined;
    let compVenta: string | undefined;
    if (raw) {
      if (UUID_REGEX_VA.test(raw)) idVentaAgrupada = raw;
      else compVenta = raw;
    }
    this.loadingVa = true;
    this.despachoService
      .buscarVentaAgrupadaGestora({ idVentaAgrupada, compVenta, ruc: ruc || undefined, nombreCliente: nombreCliente || undefined })
      .subscribe({
        next: (res) => {
          this.loadingVa = false;
          const data = res?.data;
          if (!data) {
            this.errorMsgVa = 'Sin resultados.';
            return;
          }
          if (data.modo === 'lista') {
            this.resultadoVaLista = data.coincidencias || [];
            return;
          }
          if (data.modo === 'detalle') {
            this.resultadoVaDetalle = {
              ventaAgrupada: data.ventaAgrupada as VentaAgrupadaCabDespacho,
              comprobantes: (data.comprobantes || []) as ComprobanteVaHijoDespacho[]
            };
          }
        },
        error: (err) => {
          this.loadingVa = false;
          this.errorMsgVa = err?.error?.message || 'Error al buscar venta agrupada.';
        }
      });
  }

  seleccionarVentaAgrupadaLista(row: { idVentaAgrupada: string }): void {
    this.vaCriterio = row.idVentaAgrupada;
    this.buscarVentaAgrupada();
  }

  abrirComprobanteVa(comp: ComprobanteVaHijoDespacho): void {
    this.idEmpresaDespachoActiva = comp.idEmpresa;
    const va = this.resultadoVaDetalle?.ventaAgrupada;
    this.resultado = {
      venta: {
        idVenta: comp.idVenta,
        compVenta: String(comp.compVenta || ''),
        serie: String(comp.serie || ''),
        numero: String(comp.numero || ''),
        fEmision: String(comp.fEmision || ''),
        total: Number(comp.total) || 0,
        idEstadoPedidoVenta: null,
        estadoPedidoVentaNombre: null,
        clienteRazonSocial: va?.clienteRazonSocial || '',
        clienteRuc: va?.clienteRuc || '',
        codigoComprobante: String(comp.codigoComprobante || ''),
        eliminado: false
      },
      despachos: (comp.despachos || []) as VentaDespachosResult['despachos'],
      detalleVenta: comp.detalleVenta || [],
      entregadoMismoDia: false
    };
    this.detallePorDespacho = {};
  }

  private refrescarVistaTrasCambio(): void {
    const r = this.resultado;
    if (!r?.venta?.idVenta) return;
    const idV = String(r.venta.idVenta);
    if (this.idEmpresaDespachoActiva) {
      this.despachoService
        .buscarVentaDespachos({ idVenta: idV, idEmpresa: this.idEmpresaDespachoActiva })
        .subscribe({
          next: (res) => {
            if (res?.data) this.resultado = res.data as VentaDespachosResult;
          }
        });
      return;
    }
    this.despachoService
      .buscarVentaDespachos(
        r.venta.compVenta ? { compVenta: r.venta.compVenta } : { idVenta: idV }
      )
      .subscribe({
        next: (res) => {
          if (res?.data) this.resultado = res.data as VentaDespachosResult;
        }
      });
  }

  onToggleSidebar(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }

  // #region buscar
  buscar(): void {
    const c = (this.criterioBusqueda || '').trim();
    if (!c) {
      this.errorMsg = 'Ingrese número de comprobante o escanee el código (idVenta).';
      this.resultado = null;
      return;
    }
    this.idEmpresaDespachoActiva = null;
    this.errorMsg = '';
    this.resultado = null;
    this.loading = true;
    const params: { compVenta?: string; idVenta?: string } = {};
    const num = /^\d+$/.test(c);
    if (num) params.idVenta = c; else params.compVenta = c;

    this.despachoService.buscarVentaDespachos(params).subscribe({
      next: (res) => {
        this.loading = false;
        if (res && res.data) {
          this.resultado = res.data as VentaDespachosResult;
          this.detallePorDespacho = {};
        } else {
          this.errorMsg = 'Venta no encontrada.';
        }
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'Error al buscar. Verifique el comprobante o el código.';
      }
    });
  }

  cargarDetalleDespacho(idDespacho: string): void {
    if (this.detallePorDespacho[idDespacho] || this.loadingDetalle[idDespacho]) return;
    this.loadingDetalle[idDespacho] = true;
    this.despachoService.obtenerDetalleDespacho(idDespacho).subscribe({
      next: (res) => {
        this.loadingDetalle[idDespacho] = false;
        const list = (res && res.data) ? res.data : [];
        this.detallePorDespacho[idDespacho] = list;
        list.forEach((lin: any) => {
          this.cantADespacharEdicion[lin.idDetalleDespacho] = Number(lin.cantidadDespachada) || 0;
          this.devolucionCantidadPorDetalle[lin.idDetalleDespacho] = 0;
          this.devolucionNotasPorDetalle[lin.idDetalleDespacho] = '';
        });
      },
      error: () => {
        this.loadingDetalle[idDespacho] = false;
        this.detallePorDespacho[idDespacho] = [];
      }
    });
  }

  expandirDespacho(idDespacho: string): void {
    this.cargarDetalleDespacho(idDespacho);
    this.cargarDevolucionesDespacho(idDespacho);
  }

  pendienteLinea(lin: { cantidadSolicitada: number; cantidadDespachada: number }): number {
    const s = Number(lin.cantidadSolicitada) || 0;
    const d = Number(lin.cantidadDespachada) || 0;
    return Math.max(0, s - d);
  }

  guardarCantidadDespachada(idDespacho: string, idDetalleDespacho: string, cantidadDespachada: number): void {
    const key = idDetalleDespacho;
    if (this.guardandoCantidad[key]) return;
    this.guardandoCantidad[key] = true;
    this.despachoService.actualizarCantidadDetalle({
      idDetalle: idDetalleDespacho,
      cantidadDespachada: Number(cantidadDespachada) || 0
    }).subscribe({
      next: () => {
        this.guardandoCantidad[key] = false;
        delete this.cantADespacharEdicion[key];
        this.detallePorDespacho[idDespacho] = [];
        this.cargarDetalleDespacho(idDespacho);
        if (this.resultado?.detalleVenta) {
          this.refrescarVistaTrasCambio();
        }
      },
      error: () => { this.guardandoCantidad[key] = false; }
    });
  }

  cargarDevolucionesDespacho(idDespacho: string): void {
    if (this.cargandoDevoluciones[idDespacho]) return;
    this.cargandoDevoluciones[idDespacho] = true;
    this.despachoService.listarDevolucionesDespacho(idDespacho).subscribe({
      next: (res) => {
        this.cargandoDevoluciones[idDespacho] = false;
        this.devolucionesPorDespacho[idDespacho] = res?.data ?? [];
      },
      error: () => {
        this.cargandoDevoluciones[idDespacho] = false;
        this.devolucionesPorDespacho[idDespacho] = [];
      }
    });
  }

  registrarDevolucionDesdeDespacho(idDespacho: string): void {
    if (this.enviandoDevolucion[idDespacho]) return;
    const detalle = this.detallePorDespacho[idDespacho] || [];
    const items = detalle
      .map((lin) => ({
        idDetalleDespacho: lin.idDetalleDespacho,
        cantidadDevuelta: Number(this.devolucionCantidadPorDetalle[lin.idDetalleDespacho]) || 0,
        notas: (this.devolucionNotasPorDetalle[lin.idDetalleDespacho] || '').trim() || undefined
      }))
      .filter((it) => it.cantidadDevuelta > 0);
    if (items.length === 0) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese al menos una cantidad a devolver.', position: 'topRight' });
      return;
    }
    this.enviandoDevolucion[idDespacho] = true;
    this.despachoService.crearDevolucionDespacho(idDespacho, {
      observaciones: (this.devolucionObservacionesPorDespacho[idDespacho] || '').trim() || undefined,
      items
    }).subscribe({
      next: () => {
        this.enviandoDevolucion[idDespacho] = false;
        iziToast.success({ title: 'Devolución registrada', position: 'topRight' });
        this.detallePorDespacho[idDespacho] = [];
        this.cargarDetalleDespacho(idDespacho);
        this.cargarDevolucionesDespacho(idDespacho);
      },
      error: (err) => {
        this.enviandoDevolucion[idDespacho] = false;
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo registrar la devolución', position: 'topRight' });
      }
    });
  }

  verDetalleDevolucion(idDespacho: string, idDevolucionDespacho: string): void {
    this.idDevolucionSeleccionada[idDespacho] = idDevolucionDespacho;
    this.detalleDevolucionPorDespacho[idDespacho] = [];
    this.despachoService.obtenerDetalleDevolucion(idDevolucionDespacho).subscribe({
      next: (res) => {
        this.detalleDevolucionPorDespacho[idDespacho] = res?.data ?? [];
      }
    });
  }

  abrirModalCrearDespacho(): void {
    this.cantADespacharPanel = {};
    this.detalleConPendiente.forEach(dv => {
      this.cantADespacharPanel[dv.idDetalle] = Number(dv.cantPendiente) || 0;
    });
    this.despachoService.obtenerTiposDespacho().subscribe({
      next: (res) => {
        this.tiposDespacho = (res?.data ?? []) as Array<{ idTipoDespacho: number; nombre: string }>;
        this.idTipoDespachoPanel = this.tiposDespacho.length ? this.tiposDespacho[0].idTipoDespacho : null;
      }
    });
    this.observacionesPanel = '';
    this.accionDespachoPanel = 'NORMAL';
    this.observacionesCambioPanel = '';

    // Catálogos para delivery desde despacho
    this.modoEntregaPanel = 'RECOJO';
    this.tipoDeliveryPanel = 'INTERNO';
    this.idChoferSeleccionado = null;
    this.idTransportistaSeleccionado = null;
    this.idTipoEnvioPanel = null;
    this.choferesInternos = [];
    this.transportistasExternos = [];

    this.enviosService.obtenerTiposEnvio().subscribe({
      next: (res: any) => {
        const tipos = (res?.data || []) as Array<{ idTipoEnvio: number; nombre: string; costoBase?: number; requiereTransportista?: boolean }>;
        // Preferir delivery local; si no existe, tomar el primer tipo DELIVERY.
        const local = tipos.find((t) => t.nombre === 'DELIVERY_LOCAL') || tipos.find((t) => t.nombre?.includes('DELIVERY'));
        this.idTipoEnvioPanel = local?.idTipoEnvio ?? (tipos[0]?.idTipoEnvio ?? null);
      }
    });

    // Mantener disponibles transportistas para opción EXTERNO si el usuario cambia de modalidad.
    this.cargarTransportistasExternos();

    this.choferesService.listarChoferes().subscribe({
      next: (res: any) => {
        this.choferesInternos = (res?.data || []) as ChoferInterno[];
        if (this.choferesInternos.length > 0) {
          this.tipoDeliveryPanel = 'INTERNO';
          this.idChoferSeleccionado = this.choferesInternos[0].idChofer;
        }
      }
    });

    this.modalCrearDespachoAbierto.set(true);
  }

  private cargarTransportistasExternos(): void {
    this.enviosService.obtenerTransportistas().subscribe({
      next: (res: any) => {
        this.transportistasExternos = (res?.data || []) as Array<{ idTransportista: string; nombres: string; apellidos: string; placa?: string; estado?: boolean }>;
        this.idTransportistaSeleccionado = this.transportistasExternos[0]?.idTransportista || null;
      },
      error: () => {
        this.transportistasExternos = [];
        this.idTransportistaSeleccionado = null;
      }
    });
  }

  private cargarChoferesInternosParaPanel(): void {
    this.choferesService.listarChoferes().subscribe({
      next: (res: any) => {
        this.choferesInternos = (res?.data || []) as ChoferInterno[];
        if (this.choferesInternos.length > 0) {
          this.tipoDeliveryPanel = 'INTERNO';
          this.idChoferSeleccionado = this.choferesInternos[0].idChofer;
        } else {
          this.tipoDeliveryPanel = 'EXTERNO';
          // Si no hay choferes internos, fallback a transportistas externos
          this.cargarTransportistasExternos();
        }
      },
      error: () => {
        this.choferesInternos = [];
        this.tipoDeliveryPanel = 'EXTERNO';
      }
    });
  }

  abrirModalRegistrarChofer(): void {
    this.modalRegistrarChoferVisible = true;
  }

  onChoferVehiculoGuardado(): void {
    this.modalRegistrarChoferVisible = false;
    this.cargarChoferesInternosParaPanel();
  }

  abrirModalRegistrarTransportista(): void {
    this.modalRegistrarTransportistaVisible = true;
  }

  onTransportistaGuardado(): void {
    this.modalRegistrarTransportistaVisible = false;
    this.cargarTransportistasExternos();
  }

  cerrarModalCrearDespacho(): void {
    this.modalCrearDespachoAbierto.set(false);
  }

  crearDespachoDesdeModal(): void {
    const r = this.resultado;
    if (!r || !r.venta?.idVenta || this.idTipoDespachoPanel == null) return;
    const detalles: Array<{ idDetalle: number; idProducto: string; cantidadADespachar: number }> = [];
    for (const dv of this.detalleConPendiente) {
      const cant = Number(this.cantADespacharPanel[dv.idDetalle]) ?? 0;
      if (cant > 0) {
        const maxP = Number(dv.cantPendiente) || 0;
        detalles.push({
          idDetalle: dv.idDetalle,
          idProducto: dv.idProducto,
          cantidadADespachar: cant > maxP ? maxP : cant
        });
      }
    }
    const notasCambio = (this.accionDespachoPanel === 'CAMBIO_PRODUCTO' || this.accionDespachoPanel === 'DEVOLUCION')
      ? (this.observacionesCambioPanel || '').trim()
      : '';
    const observacionesFinales = [this.observacionesPanel, notasCambio ? `Cambio/Devolución: ${notasCambio}` : '']
      .map((v) => (v || '').trim())
      .filter((v) => v.length > 0)
      .join(' | ');
    if (this.modoEntregaPanel === 'DELIVERY') {
      if (this.idTipoEnvioPanel == null) {
        iziToast.warning({ title: 'Aviso', message: 'Selecciona/valida el tipo de envío.', position: 'topRight' });
        return;
      }
      if (this.tipoDeliveryPanel === 'INTERNO' && !this.idChoferSeleccionado) {
        iziToast.warning({ title: 'Aviso', message: 'Selecciona un chofer interno.', position: 'topRight' });
        return;
      }
      if (this.tipoDeliveryPanel === 'EXTERNO' && !this.idTransportistaSeleccionado) {
        iziToast.warning({ title: 'Aviso', message: 'Selecciona un transportista externo.', position: 'topRight' });
        return;
      }
    }

    this.enviandoCrear = true;
    const bodyCrear: {
      idVenta: string;
      idTipoDespacho: number;
      observaciones?: string;
      idEmpresa?: string;
      detalles?: Array<{ idDetalle: number; idProducto: string; cantidadADespachar: number }>;
    } = {
      idVenta: String(r.venta.idVenta),
      idTipoDespacho: this.idTipoDespachoPanel,
      observaciones: observacionesFinales || undefined,
      detalles: detalles.length > 0 ? detalles : undefined
    };
    if (this.idEmpresaDespachoActiva) {
      bodyCrear.idEmpresa = this.idEmpresaDespachoActiva;
    }
    this.despachoService.crearDespacho(bodyCrear).subscribe({
      next: (res: any) => {
        this.enviandoCrear = false;
        this.cerrarModalCrearDespacho();
        if (typeof iziToast !== 'undefined') iziToast.success({ title: 'Despacho creado', position: 'topRight' });

        const idNuevoDespacho = res?.data?.idDespacho as string | undefined;
        if (this.imprimirTicketAlCrearDespacho && idNuevoDespacho) {
          this.imprimirTicketTrasCrearDespacho(idNuevoDespacho);
        }

        if (this.modoEntregaPanel === 'DELIVERY') {
          const payload: any = {
            idVenta: String(r.venta.idVenta),
            idDespacho: res?.data?.idDespacho ?? undefined,
            idTipoEnvio: this.idTipoEnvioPanel,
            costoEnvio: 0,
            direccionEntrega: this.direccionEntregaPanel,
            observaciones: undefined,
            idEstadoEnvioInicial: 1
          };

          if (this.tipoDeliveryPanel === 'INTERNO') {
            payload.idChofer = this.idChoferSeleccionado;
          } else {
            payload.idTransportista = this.idTransportistaSeleccionado;
          }

          this.enviosService.crearEnvio(payload).subscribe({
            next: () => {
              this.refrescarVistaTrasCambio();
            },
            error: (err: any) => {
              iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo crear el envío', position: 'topRight' });
              this.refrescarVistaTrasCambio();
            }
          });
        } else {
          this.refrescarVistaTrasCambio();
        }
      },
      error: (err) => {
        this.enviandoCrear = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo crear el despacho', position: 'topRight' });
        }
      }
    });
  }

  abrirEdicionComprobante(): void {
    const r = this.resultado;
    if (!r?.venta?.idVenta) return;
    this.cerrarModalCrearDespacho();
    this.router.navigate(['/ventas/editar', r.venta.idVenta]);
  }

  abrirNotasCredito(): void {
    const r = this.resultado;
    if (!r?.venta) return;
    this.cerrarModalCrearDespacho();
    this.router.navigate(['/facturacion/notas-credito-debito'], {
      queryParams: {
        tipoComprobanteRef: (r.venta.codigoComprobante || '').toUpperCase() || undefined,
        serie: r.venta.serie,
        numero: r.venta.numero
      }
    });
  }

  abrirNuevaVenta(): void {
    this.cerrarModalCrearDespacho();
    this.router.navigate(['/ventas/create']);
  }

  /**
   * Ticket del despacho (productos despachados, fecha/hora). Usa detalle en caché o lo pide al API.
   * @param event Opcional: usar stopPropagation si el clic está en el acordeón.
   */
  imprimirTicketDespachoUnico(
    d: VentaDespachosResult['despachos'][number],
    event?: Event
  ): void {
    event?.stopPropagation?.();
    const cached = this.detallePorDespacho[d.idDespacho];
    if (cached && cached.length > 0) {
      this.emitirPdfTicketDespacho(cached, d);
      return;
    }
    this.generandoPdf = true;
    this.despachoService.obtenerDetalleDespacho(d.idDespacho).subscribe({
      next: (res) => {
        const list = (res?.data ?? []) as NonNullable<(typeof this.detallePorDespacho)[string]>;
        if (!list.length) {
          this.generandoPdf = false;
          if (typeof iziToast !== 'undefined') {
            iziToast.warning({ title: 'Sin líneas', message: 'No hay productos en este despacho para imprimir.', position: 'topRight' });
          }
          return;
        }
        this.detallePorDespacho[d.idDespacho] = list;
        list.forEach((lin: { idDetalleDespacho: string; cantidadDespachada: number }) => {
          this.cantADespacharEdicion[lin.idDetalleDespacho] = Number(lin.cantidadDespachada) || 0;
          this.devolucionCantidadPorDetalle[lin.idDetalleDespacho] = 0;
          this.devolucionNotasPorDetalle[lin.idDetalleDespacho] = '';
        });
        this.emitirPdfTicketDespacho(list, d);
      },
      error: () => {
        this.generandoPdf = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudo cargar el detalle para imprimir.', position: 'topRight' });
        }
      }
    });
  }

  /** Tras crear despacho: cabecera desde tipo elegido y detalle recién persistido */
  private imprimirTicketTrasCrearDespacho(idDespacho: string): void {
    const tipoNombre =
      this.tiposDespacho.find((t) => t.idTipoDespacho === this.idTipoDespachoPanel)?.nombre || 'Despacho';
    this.generandoPdf = true;
    this.despachoService.obtenerDetalleDespacho(idDespacho).subscribe({
      next: (res) => {
        const list = (res?.data ?? []) as Array<{
          idDetalleDespacho: string;
          productoCodigo: string;
          productoDescripcion: string;
          cantidadDespachada: number;
          ubicacionOrigen?: string | null;
          ubicacionDestino?: string | null;
          fechaDespacho?: string | null;
        }>;
        if (!list.length) {
          this.generandoPdf = false;
          return;
        }
        const cab: VentaDespachosResult['despachos'][number] = {
          idDespacho,
          idVenta: this.resultado?.venta.idVenta ?? 0,
          fechaDespacho: list[0]?.fechaDespacho || '',
          estado: 'COMPLETADO',
          observaciones: null,
          tipoDespacho: tipoNombre,
          usuarioDespacho: '',
          totalLineas: list.length,
          lineasDespachadas: list.length
        };
        this.emitirPdfTicketDespacho(list, cab);
      },
      error: () => {
        this.generandoPdf = false;
      }
    });
  }

  private emitirPdfTicketDespacho(
    lineas: Array<{
      productoCodigo: string;
      productoDescripcion: string;
      cantidadDespachada: number;
      ubicacionOrigen?: string | null;
      ubicacionDestino?: string | null;
    }>,
    cab: VentaDespachosResult['despachos'][number]
  ): void {
    const r = this.resultado;
    if (!r?.venta) {
      this.generandoPdf = false;
      return;
    }
    this.generandoPdf = true;
    this.empresaService.getEmpresa$().subscribe({
      next: (emp) => {
        const empAny = emp as unknown as Record<string, unknown>;
        const logoStr = String(empAny['logo'] ?? empAny['Logo'] ?? '');
        const empresa = {
          logo: logoStr,
          nombre: emp.nombre ?? '',
          ruc: emp.ruc ?? '',
          direccion: emp.direccion ?? '',
          telefono: emp.telefono ?? ''
        };
        const venta = { ...r.venta };
        const cliente = { razonSocial: r.venta.clienteRazonSocial || '', ruc: r.venta.clienteRuc || '' };
        const items = lineas.map((lin) => ({
          productoCodigo: lin.productoCodigo,
          productoDescripcion: lin.productoDescripcion,
          cantidadDespachada: lin.cantidadDespachada,
          ubicaciones: lin.ubicacionOrigen || lin.ubicacionDestino || '—'
        }));
        const despacho = {
          tipoDespacho: cab.tipoDespacho,
          fechaDespacho: cab.fechaDespacho,
          estado: cab.estado
        };
        const datos = {
          empresa,
          venta,
          cliente,
          items,
          despacho,
          titulo: 'Ticket de despacho',
          columnas: ['Código', 'Descripción', 'Despachado', 'Ubicación']
        };
        const nombreArchivo = `ticket-despacho-${(r.venta.compVenta || 'venta').replace(/-/g, '_')}.pdf`;
        this.pdfService.generarPdfComprobanteDespacho(datos, 'ticket', nombreArchivo).subscribe({
          next: (blob) => {
            this.pdfService.previsualizar(blob);
            this.generandoPdf = false;
          },
          error: () => {
            this.generandoPdf = false;
          }
        });
      },
      error: () => {
        this.generandoPdf = false;
      }
    });
  }

  imprimirComprobanteDespacho(formato: 'A4' | 'A5' | 'ticket'): void {
    const r = this.resultado;
    if (!r?.venta || !r?.detalleVenta?.length) return;
    this.generandoPdf = true;
    this.empresaService.getEmpresa$().subscribe({
      next: (emp) => {
        const empAny = emp as unknown as Record<string, unknown>;
        const logoStr = String(empAny['logo'] ?? empAny['Logo'] ?? '');
        const empresa = {
          logo: logoStr,
          nombre: emp.nombre ?? '',
          ruc: emp.ruc ?? '',
          direccion: emp.direccion ?? '',
          telefono: emp.telefono ?? ''
        };
        const venta = { ...r.venta };
        const cliente = { razonSocial: r.venta.clienteRazonSocial || '', ruc: r.venta.clienteRuc || '' };
        const items = (r.detalleVenta || []).map((dv: DetalleVentaLinea) => ({
          productoCodigo: dv.productoCodigo,
          productoDescripcion: dv.productoDescripcion,
          marca: dv.productoMarca,
          cantidad: dv.cantPendiente ?? dv.cantidad,
          ubicaciones: dv.ubicaciones || ''
        }));
        const datos = { empresa, venta, cliente, items, titulo: 'Comprobante de despacho' };
        const nombreArchivo = `despacho-${(r.venta.compVenta || 'venta').replace(/-/g, '_')}.pdf`;
        this.pdfService.generarPdfComprobanteDespacho(datos, formato, nombreArchivo).subscribe({
          next: (blob) => {
            this.pdfService.previsualizar(blob);
            this.generandoPdf = false;
          },
          error: () => {
            this.generandoPdf = false;
          }
        });
      },
      error: () => { this.generandoPdf = false; }
    });
  }

  abrirFormWhatsapp(): void {
    this.mostrarWhatsappForm = true;
    this.whatsappMensaje = null;
  }

  cerrarFormWhatsapp(): void {
    this.mostrarWhatsappForm = false;
    this.whatsappNumber = '';
    this.whatsappCaption = '';
    this.whatsappFormato = 'A4';
    this.whatsappMensaje = null;
  }

  enviarPdfPorWhatsapp(): void {
    const r = this.resultado;
    if (!r?.venta || !r?.detalleVenta?.length) return;
    if (!this.whatsappNumber.trim()) {
      this.whatsappMensaje = 'Ingrese el número de WhatsApp (ej. 51999999999).';
      return;
    }
    this.enviandoWhatsapp = true;
    this.whatsappMensaje = null;
    this.empresaService.getEmpresa$().subscribe({
      next: (emp) => {
        const empAny = emp as unknown as Record<string, unknown>;
        const logoStr = String(empAny['logo'] ?? empAny['Logo'] ?? '');
        const empresa = {
          logo: logoStr,
          nombre: emp?.nombre ?? '',
          ruc: emp?.ruc ?? '',
          direccion: emp?.direccion ?? '',
          telefono: emp?.telefono ?? ''
        };
        const venta = { ...r.venta };
        const cliente = { razonSocial: r.venta.clienteRazonSocial || '', ruc: r.venta.clienteRuc || '' };
        const items = (r.detalleVenta || []).map((dv: DetalleVentaLinea) => ({
          productoCodigo: dv.productoCodigo,
          productoDescripcion: dv.productoDescripcion,
          marca: dv.productoMarca,
          cantidad: dv.cantPendiente ?? dv.cantidad,
          ubicaciones: dv.ubicaciones || ''
        }));
        const datos = { empresa, venta, cliente, items, titulo: 'Comprobante de despacho' };
        const nombreArchivo = `despacho-${(r.venta.compVenta || 'venta').replace(/-/g, '_')}.pdf`;
        this.pdfService.generarPdfComprobanteDespacho(datos, this.whatsappFormato, nombreArchivo).subscribe({
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
          error: () => {
            this.enviandoWhatsapp = false;
            this.whatsappMensaje = 'Error al generar el PDF.';
          }
        });
      },
      error: () => {
        this.enviandoWhatsapp = false;
        this.whatsappMensaje = 'Error al cargar empresa.';
      }
    });
  }
}
