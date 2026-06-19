import { Component, inject, OnInit, signal } from '@angular/core';
import { DespachoService } from '../../../services/despacho.service';
import { EmpresaService } from '../../../services/empresa.service';
import { PdfService } from '../../../services/pdf.service';
import { WhatsappService } from '../../../services/whatsapp.service';
import { EnviosService } from '../../../services/envios.service';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
import { descripcionProductoConMarca } from '../../../utils/producto-presentacion.util';

declare const iziToast: any;

/** Línea de DetalleDespachos en el acordeón (API + marca para UI/PDF). */
export interface LineaDetalleDespachoAcordeon {
  idDetalleDespacho: string;
  productoCodigo: string;
  productoDescripcion: string;
  productoMarca?: string | null;
  cantidadSolicitada: number;
  cantidadDespachada: number;
  estado: string;
  fechaDespacho: string | null;
  ubicacionOrigen?: string | null;
  ubicacionDestino?: string | null;
}

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
    idEmpresa?: string;
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
  detallePorDespacho: Record<string, LineaDetalleDespachoAcordeon[]> = {};
  loadingDetalle: Record<string, boolean> = {};
  /** Un solo guardado por despacho (todas las líneas pendientes). */
  guardandoCantidadesBatch: Record<string, boolean> = {};
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
  transportistasExternos: Array<{
    idTransportista: string;
    nombres: string;
    apellidos: string;
    placa?: string;
    estado?: boolean;
    idEmpresa?: string;
    razonSocialEmpresa?: string;
  }> = [];
  idChoferSeleccionado: string | null = null;
  idTransportistaSeleccionado: string | null = null;
  idTipoEnvioPanel: number | null = null;
  direccionEntregaPanel = 'SIN_DIRECCION';
  /** Solo gestora + delivery: fecha programada del envío (yyyy-MM-dd). */
  fechaEnvioDeliveryPanel = '';

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

  /** Misma regla que el PDF: «descripción - marca». */
  descripcionProductoDespacho(
    descripcion?: string | null,
    marca?: string | null
  ): string {
    return descripcionProductoConMarca(descripcion, marca);
  }

  private enriquecerLineaDescripcionProducto<T extends { productoDescripcion?: string; productoMarca?: string | null }>(
    lin: T
  ): T {
    return {
      ...lin,
      productoDescripcion: descripcionProductoConMarca(lin.productoDescripcion, lin.productoMarca)
    };
  }

  private normalizarDetalleVentaDespacho(lineas?: DetalleVentaLinea[]): DetalleVentaLinea[] {
    return (lineas || []).map((dv) => this.enriquecerLineaDescripcionProducto(dv));
  }

  private normalizarResultadoDespachos(data: VentaDespachosResult): VentaDespachosResult {
    return {
      ...data,
      detalleVenta: this.normalizarDetalleVentaDespacho(data.detalleVenta)
    };
  }

  constructor(
    private despachoService: DespachoService,
    private empresaService: EmpresaService,
    private pdfService: PdfService,
    private whatsappService: WhatsappService,
    private enviosService: EnviosService,
    private choferesService: ChoferesService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  /** Empresa dueña del despacho (comprobante hijo); obligatorio para catálogos y POST envío en modo gestora. */
  private idEmpresaCatalogoEnvios(): string | undefined {
    return this.idEmpresaDespachoActiva?.trim() || undefined;
  }

  private inicializarFechaEnvioGestora(): void {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.fechaEnvioDeliveryPanel = `${y}-${m}-${day}`;
  }

  private cargarChoferesInternosParaDespacho(): void {
    const req$ = this.esGestora
      ? this.choferesService.listarChoferes(undefined, { alcanceGestora: true })
      : this.choferesService.listarChoferes(this.idEmpresaCatalogoEnvios());
    req$.subscribe({
      next: (res: any) => {
        this.choferesInternos = (res?.data || []) as ChoferInterno[];
        if (this.choferesInternos.length > 0) {
          this.tipoDeliveryPanel = 'INTERNO';
          this.idChoferSeleccionado = this.choferesInternos[0].idChofer;
        }
      },
      error: () => {
        this.choferesInternos = [];
      }
    });
  }

  ngOnInit(): void {
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (res) => {
        this.esGestora = !!res?.data?.esGestora;
        this.mostrarBusquedaSimple = !this.esGestora;
        this.intentarBusquedaDesdeQueryParams();
      },
      error: () => {
        this.esGestora = false;
        this.mostrarBusquedaSimple = true;
        this.intentarBusquedaDesdeQueryParams();
      }
    });
  }

  /** Desde envíos u otro módulo: /despachos?compVenta=NV01-00000023 */
  private intentarBusquedaDesdeQueryParams(): void {
    const qp = this.route.snapshot.queryParamMap;
    const comp = (qp.get('compVenta') || qp.get('q') || '').trim();
    if (!comp) return;
    if (this.esGestora) {
      this.mostrarBusquedaSimple = true;
    }
    this.criterioBusqueda = comp;
    queueMicrotask(() => this.buscar());
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
      detalleVenta: this.normalizarDetalleVentaDespacho(comp.detalleVenta || []),
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
            if (res?.data) this.resultado = this.normalizarResultadoDespachos(res.data as VentaDespachosResult);
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
          if (res?.data) this.resultado = this.normalizarResultadoDespachos(res.data as VentaDespachosResult);
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
    const qp = this.route.snapshot.queryParamMap;
    const compQp = (qp.get('compVenta') || qp.get('q') || '').trim();
    const idEmpQp = (qp.get('idEmpresa') || '').trim();
    if (idEmpQp && compQp && compQp === c) {
      this.idEmpresaDespachoActiva = idEmpQp;
    } else {
      this.idEmpresaDespachoActiva = null;
    }
    this.errorMsg = '';
    this.resultado = null;
    this.loading = true;
    const params: { compVenta?: string; idVenta?: string; idEmpresa?: string } = {};
    params.compVenta = c;
    if (this.idEmpresaDespachoActiva) {
      params.idEmpresa = this.idEmpresaDespachoActiva;
    }
    // idVenta (código escaneado): solo si es numérico sin ceros a la izquierda (evita confundir "00000011" con id 11)
    if (/^\d+$/.test(c) && !/^0+\d/.test(c)) {
      params.idVenta = c;
    }

    this.despachoService.buscarVentaDespachos(params).subscribe({
      next: (res) => {
        this.loading = false;
        if (res && res.data) {
          const data = res.data as VentaDespachosResult;
          const idEmpVenta = data.venta?.idEmpresa;
          if (idEmpVenta) {
            this.idEmpresaDespachoActiva = String(idEmpVenta).trim();
          }
          this.resultado = this.normalizarResultadoDespachos(data);
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
    if (this.loadingDetalle[idDespacho]) return;
    // [] es truthy en JS: no usar `if (this.detallePorDespacho[id])` para decidir si recargar.
    if ((this.detallePorDespacho[idDespacho]?.length ?? 0) > 0) return;

    this.loadingDetalle[idDespacho] = true;
    this.despachoService.obtenerDetalleDespacho(idDespacho).subscribe({
      next: (res) => {
        this.loadingDetalle[idDespacho] = false;
        const list = ((res && res.data) ? res.data : []).map((lin: LineaDetalleDespachoAcordeon) =>
          this.enriquecerLineaDescripcionProducto(lin)
        );
        this.detallePorDespacho[idDespacho] = list;
        list.forEach((lin: any) => {
          const pend = this.pendienteLinea(lin);
          this.cantADespacharEdicion[lin.idDetalleDespacho] =
            pend > 0 ? Number(lin.cantidadSolicitada) : Number(lin.cantidadDespachada) || 0;
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

  /** Líneas del despacho con cantidad pendiente de registrar en almacén. */
  lineasConPendienteDespacho(idDespacho: string): LineaDetalleDespachoAcordeon[] {
    const list = this.detallePorDespacho[idDespacho] || [];
    return list.filter((lin) => this.pendienteLinea(lin) > 0);
  }

  guardarTodasCantidadesDespacho(d: { idDespacho: string }): void {
    const idDespacho = d.idDespacho;
    if (this.guardandoCantidadesBatch[idDespacho]) return;

    const pendientes = this.lineasConPendienteDespacho(idDespacho);
    if (pendientes.length === 0) {
      iziToast.info({ title: 'Sin pendientes', message: 'No hay líneas pendientes de despacho.', position: 'topRight' });
      return;
    }

    const items: Array<{ idDetalleDespacho: string; cantidadDespachada: number }> = [];
    for (const lin of pendientes) {
      const idDd = lin.idDetalleDespacho as string;
      const qty = Number(this.cantADespacharEdicion[idDd]);
      if (!Number.isFinite(qty) || qty <= 0) {
        iziToast.warning({
          title: 'Cantidades incompletas',
          message: `Indique una cantidad mayor que 0 en todas las líneas pendientes (código ${lin.productoCodigo || idDd}).`,
          position: 'topRight'
        });
        return;
      }
      const fullLin = (this.detallePorDespacho[idDespacho] || []).find((x: any) => x.idDetalleDespacho === idDd);
      const maxSol = fullLin ? Number(fullLin.cantidadSolicitada) : qty;
      if (qty > maxSol + 1e-9) {
        iziToast.warning({
          title: 'Cantidad inválida',
          message: `La cantidad no puede superar lo solicitado (${maxSol}) en ${lin.productoCodigo || 'línea'}.`,
          position: 'topRight'
        });
        return;
      }
      items.push({ idDetalleDespacho: idDd, cantidadDespachada: qty });
    }

    this.guardandoCantidadesBatch[idDespacho] = true;
    this.despachoService.registrarCantidadesDespachoBatch(idDespacho, items).subscribe({
      next: () => {
        this.guardandoCantidadesBatch[idDespacho] = false;
        delete this.detallePorDespacho[idDespacho];
        this.cargarDetalleDespacho(idDespacho);
        if (this.resultado?.detalleVenta) {
          this.refrescarVistaTrasCambio();
        }
        iziToast.success({
          title: 'Guardado',
          message: 'Cantidades de despacho registradas correctamente.',
          position: 'topRight'
        });
      },
      error: (err) => {
        this.guardandoCantidadesBatch[idDespacho] = false;
        const msg = err?.error?.message || 'No se pudieron guardar las cantidades.';
        iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
      }
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
        this.detalleDevolucionPorDespacho[idDespacho] = (res?.data ?? []).map((det: DevolucionDespachoDetalle) =>
          this.enriquecerLineaDescripcionProducto(det)
        );
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
    if (this.esGestora) {
      this.inicializarFechaEnvioGestora();
    } else {
      this.fechaEnvioDeliveryPanel = '';
    }

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

    this.cargarChoferesInternosParaDespacho();

    this.modalCrearDespachoAbierto.set(true);
  }

  private cargarTransportistasExternos(): void {
    const req$ = this.esGestora
      ? this.enviosService.obtenerTransportistas()
      : this.enviosService.obtenerTransportistas(this.idEmpresaCatalogoEnvios());
    req$.subscribe({
      next: (res: any) => {
        this.transportistasExternos = (res?.data || []) as typeof this.transportistasExternos;
        this.idTransportistaSeleccionado = this.transportistasExternos[0]?.idTransportista || null;
      },
      error: () => {
        this.transportistasExternos = [];
        this.idTransportistaSeleccionado = null;
      }
    });
  }

  private cargarChoferesInternosParaPanel(): void {
    const req$ = this.esGestora
      ? this.choferesService.listarChoferes(undefined, { alcanceGestora: true })
      : this.choferesService.listarChoferes(this.idEmpresaCatalogoEnvios());
    req$.subscribe({
      next: (res: any) => {
        this.choferesInternos = (res?.data || []) as ChoferInterno[];
        if (this.choferesInternos.length > 0) {
          this.tipoDeliveryPanel = 'INTERNO';
          this.idChoferSeleccionado = this.choferesInternos[0].idChofer;
        } else {
          this.tipoDeliveryPanel = 'EXTERNO';
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
      if (this.esGestora && !(this.fechaEnvioDeliveryPanel || '').trim()) {
        iziToast.warning({ title: 'Aviso', message: 'Indique la fecha de envío.', position: 'topRight' });
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
      mercaderiaPendienteDeCarga?: boolean;
    } = {
      idVenta: String(r.venta.idVenta),
      idTipoDespacho: this.idTipoDespachoPanel,
      observaciones: observacionesFinales || undefined,
      detalles: detalles.length > 0 ? detalles : undefined
    };
    if (this.idEmpresaDespachoActiva) {
      bodyCrear.idEmpresa = this.idEmpresaDespachoActiva;
    }
    if (this.modoEntregaPanel === 'DELIVERY') {
      bodyCrear.mercaderiaPendienteDeCarga = true;
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
          const idEmpDespacho = bodyCrear.idEmpresa || this.idEmpresaCatalogoEnvios();
          if (idEmpDespacho) {
            payload.idEmpresa = idEmpDespacho;
          }
          if (this.esGestora && (this.fechaEnvioDeliveryPanel || '').trim()) {
            payload.fechaProgramada = (this.fechaEnvioDeliveryPanel || '').trim();
          }

          if (this.tipoDeliveryPanel === 'INTERNO') {
            payload.idChofer = this.idChoferSeleccionado;
          } else {
            payload.idTransportista = this.idTransportistaSeleccionado;
          }

          this.enviosService.crearEnvio(payload).subscribe({
            next: () => {
              this.refrescarVistaTrasCambio();
              if (typeof iziToast !== 'undefined') {
                iziToast.success({
                  title: 'Envío registrado',
                  message: 'El envío quedó vinculado al comprobante. La mercadería sigue pendiente de carga hasta confirmar en despacho.',
                  position: 'topRight'
                });
              }
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
        this.detallePorDespacho[d.idDespacho] = list.map((lin: LineaDetalleDespachoAcordeon) =>
          this.enriquecerLineaDescripcionProducto(lin)
        );
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

  private itemPdfDespacho(lin: {
    productoCodigo?: string;
    productoDescripcion?: string;
    productoMarca?: string | null;
    marca?: string | null;
    cantidadDespachada?: number;
    cantidad?: number;
    cantPendiente?: number;
    ubicacionOrigen?: string | null;
    ubicacionDestino?: string | null;
    ubicaciones?: string;
  }): {
    productoCodigo: string;
    productoDescripcion: string;
    marca: string;
    cantidadDespachada?: number;
    cantidad?: number;
    ubicaciones: string;
  } {
    const marca = String(lin.productoMarca ?? lin.marca ?? '').trim();
    return {
      productoCodigo: String(lin.productoCodigo ?? ''),
      productoDescripcion: descripcionProductoConMarca(lin.productoDescripcion, marca),
      marca,
      cantidadDespachada: lin.cantidadDespachada,
      cantidad: lin.cantidad ?? lin.cantPendiente,
      ubicaciones: lin.ubicaciones || lin.ubicacionOrigen || lin.ubicacionDestino || '—'
    };
  }

  private emitirPdfTicketDespacho(
    lineas: Array<{
      productoCodigo: string;
      productoDescripcion: string;
      productoMarca?: string | null;
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
        const items = lineas.map((lin) => this.itemPdfDespacho(lin));
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
          titulo: 'Comprobante de despacho',
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
        const items = (r.detalleVenta || []).map((dv: DetalleVentaLinea) => this.itemPdfDespacho(dv));
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
        const items = (r.detalleVenta || []).map((dv: DetalleVentaLinea) => this.itemPdfDespacho(dv));
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
