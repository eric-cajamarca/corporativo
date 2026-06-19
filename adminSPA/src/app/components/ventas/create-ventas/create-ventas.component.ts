import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { ProductoService } from '../../../services/producto.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TopnavComponent } from '../../topnav/topnav.component';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CategoriaService } from '../../../services/categoria.service';
import { SucursalService } from '../../../services/sucursal.service';
import { PresentacionService } from '../../../services/presentacion.service';
import { variosService } from '../../../services/varios.service';
import { IndexClientesComponent } from '../../clientes/index-clientes/index-clientes.component';
import { CreateClientesComponent } from '../../clientes/create-clientes/create-clientes.component';
import { UpdateClientesComponent } from '../../clientes/update-clientes/update-clientes.component';
import { ClienteService } from '../../../services/cliente.service';
import { ComprobanteService } from '../../../services/comprobante.service';
import { TablasSunatService } from '../../../services/tablas-sunat.service';
import { DocumentoService } from '../../../services/documento.service';
import { FormaPago } from '../../../interfaces/formasPago-interface';
import { Documento } from '../../../interfaces/documento-interface';
import { Sucursal } from '../../../interfaces/sucursal-interface';
import { Presentacion } from '../../../interfaces/presentacion-interface';
import { ModalPreciosComponent } from '../../modal-precios/modal-precios.component';
import { ModalService } from '../../../services/modal.service';
import { BuscadorProductosModalService } from '../../../services/buscador-productos-modal.service';
import { ComprobantePdfData, VentasService } from '../../../services/ventas.service';
import { openComprobanteVaTicket } from '../../../utils/comprobante-va-ticket.util';
import {
  marcaProductoEnLista,
  productoActivoParaVenta,
  productoCoincideBusquedaMultipalabra,
  productoSinStockEnBusqueda
} from '../../../utils/producto-busqueda.util';
import { CotizacionesService, CotizacionListado } from '../../../services/cotizaciones.service';
import { VentaCotizacionUiService } from '../../../services/venta-cotizacion-ui.service';
import { VentaProvisionalUiService } from '../../../services/venta-provisional-ui.service';
import {
  cerrarModalCotizacionSiCorresponde,
  mapearCotizacionACarrito,
  notificarCotizacionCargada,
  validarCotizacionParaCarrito
} from '../../../utils/venta-cotizacion.util';
import { ValesDespachoService, ValeDespachoListItem } from '../../../services/vales-despacho.service';
import { EmpresaService } from '../../../services/empresa.service';
import { AuthService } from '../../../services/auth.service';
import { RubrosService } from '../../../services/rubros.service';
import { CajaService } from '../../../services/caja.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { FactilizaService } from '../../../services/factiliza.service';
import { ImpuestoService } from '../../../services/impuesto.service';
import { Impuesto } from '../../../interfaces/impuesto.interface';
import { interpretarBooleanoConfig } from '../../../utils/config-valor-booleano.util';
import { fechaEmisionVentaParaApi, fechaVentaOpcionalParaApi, getFechaHoyLocal } from '../../../utils/fecha-local.util';
import { VentaSesion } from '../../../interfaces/venta-sesion.interface';
import { CreditosService } from '../../../services/creditos.service';
import { GestoresService } from '../../../services/gestores.service';
import { HotelPreloadVentaService } from '../../../services/hotel-preload-venta.service';
import { PdfService } from '../../../services/pdf.service';
import { WhatsappService } from '../../../services/whatsapp.service';
import { UsuarioSucursalService, SucursalUsuario } from '../../../services/usuario-sucursal.service';
import {
  PosAlertaTemprana,
  codigoComprobanteDesdeLista,
  construirAlertaValidacionTemprana,
  validarClienteSunatParaComprobante,
  validarStockLinea
} from '../../../utils/pos-validacion.util';
import { numeroALetras } from '../../../utils/numeroALetras';
import { Empresa } from '../../../interfaces/pdf-interface';
import { PosKeyboardService } from '../../../services/pos-keyboard.service';

declare var bootstrap: any;
declare var iziToast: any;

interface DocumentoResponse {
  message: string;
  data: Documento[];
}

@Component({
  selector: 'app-create-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IndexClientesComponent, CreateClientesComponent, UpdateClientesComponent, TopnavComponent, SidebarComponent],
  templateUrl: './create-ventas.component.html',
  styleUrl: './create-ventas.component.css'
})
export class CreateVentasComponent implements OnInit, AfterViewInit, OnDestroy {

  readonly buscadorLimiteFilas = 80;
  @ViewChild('inputSearchCodigo') inputSearchCodigo?: ElementRef<HTMLInputElement>;
  mostrarAyudaAtajosPos = false;
  public searchCodigo = '';
  public categoria: any = [];
  public presentacion: Presentacion[] = [];
  public marcas: any = [];
  public stockSucursales: any = [];
  private stockSucursales_const: any = [];
  /** Impuestos activos de la empresa (tabla Impuestos por idEmpresa). El footer y el total se calculan solo con estos. */
  public impuestosActivosEmpresa: Impuesto[] = [];
  public sucursales: Sucursal[] = [];
  public carrito: any[] = [];
  public moneda: any = [];
  public mediosPago: any[] = [];
  public formasPago: FormaPago[] = [];
  public formaPagoSeleccionada: FormaPago = {
  idFormaPago: 0,
  descripcion: '',
  tipo: 0,
  requiereReferencia: 0,
  activo: 0,
  recibido: 0,
  vuelto: 0,
  referencia: ''
};
  public detallePago: any =[];
  public estadoPago: any = [];
  public estadosPedidos: any = [];
  public documento: Documento[] = [];
  
  public comprobantes: any = [];
  public cajaMovimientos:{} ={
    idFormaPago:0,
  };
  public cliente: any = {
    idCliente: '',
    idDocumento: '',
    ruc: '',
    rSocial: '',
    direccion: '',
    correo: '',
    celular: '',
    condicion: 'ACTIVO',
    sujetoCredito: undefined as boolean | undefined,
    lineaCredito: undefined as number | undefined
  };

  /** Formulario modal editar línea de crédito del cliente (desde nueva venta). */
  editClienteCreditoForm = { sujetoCredito: false, lineaCredito: 0 };
  loadingEditClienteCredito = false;
  public cajas: any[] = [];
  public loading = false;
  public clienteBuscando = false;
  /** Se incrementa al abrir "Registrar cliente" desde búsqueda sin BD, para que create-clientes reaplique @Input en cada apertura. */
  public crearClientePreSerial = 0;

  public ventas: any = {
    compVenta: '0000-00000000',
    idComprobante: '',
    serie: '0000',
    numero: '00000000',
    idSucursal: '',
    idCliente: '',
    idDocumento: '',
    idMoneda: 1,
    idEstadoPedido: 1,
    idEstadoPago: 2,
    idMediosPago: '',
    fEmision: '',
    fechaPago: '',
    fVencimiento: '',
    observacion: '',
    total: 0,
    igv: 0,
    isc: 0,
    /** Detalle de impuestos aplicados (sin IGV; IGV va en línea aparte siempre visible). */
    impuestosDetalle: [] as { descripcion: string; porcentaje: number; monto: number; pIncluyeIGV: boolean }[],
    /** IGV: siempre visible. Si la empresa está afecta se calcula; si no, 0. */
    igvPorcentaje: 0,
    igvMonto: 0,
    exonerado: 0,
    gratuito: 0,
    otrosCargos: 0,
    subTotal: 0,
    descuentos: 0,
  };

  /** Config empresa: si false, no acumular descuentos por diferencia de precio y el backend guarda descuentos 0. */
  usarDescuentoEnTotal = true;

  /** Hasta que llegue gestores/config, no aplicar descuento lista vs vendido (evita total erróneo con default true). */
  private descuentoEnTotalConfigListo = false;

  /** Gestora: descuento en total por empresa del producto (idEmpresa en minúsculas). */
  private descuentoPorEmpresa = new Map<string, boolean>();

  /** Config > Ventas: mostrar modal PDF/WhatsApp al registrar venta (por defecto activo). */
  mostrarModalPdfTrasRegistrarVenta = true;

  /** Modal comprobante PDF tras registrar venta */
  postVentaIdVenta: number | null = null;
  postVentaGenerandoPdf = false;
  postVentaMostrarWhatsapp = false;
  postVentaDatosWhatsapp: { datos: unknown; nombreArchivo: string } | null = null;
  postVentaWhatsappNumero = '';
  postVentaWhatsappCaption = '';
  postVentaWhatsappFormato: 'A4' | 'A5' | 'ticket' = 'A4';
  postVentaWhatsappEnviando = false;
  postVentaWhatsappMensaje: string | null = null;

  /** Edición de cliente existente desde modal “Información del cliente” */
  idClienteParaEditarModal: number | string | null = null;

  public direccionCliente: any;

  /** Valores por defecto de estado pedido y estado pago (según configuración). */
  configDefaults = { idEstadoPedidoPorDefecto: 1, idEstadoPagoPorDefecto: 2 };

  /** Ventas provisionales: sesiones guardadas en localStorage para recuperar tras apagón. */
  sesionesGuardadas: VentaSesion[] = [];
  mostrarModalRecuperar = false;

  /** Config inventario: permitir vender con stock 0 o negativo. */
  permitirVentasNegativas = false;
  alertaValidacionTemprana: PosAlertaTemprana | null = null;

  /** Modal Cargar desde cotización */
  cotizacionesParaCargar: CotizacionListado[] = [];
  loadingCotizaciones = false;

  /** Empresa gestora: venta corporativa con comprobante VA. */
  esGestora = false;
  /** Empresa gestionada por otra (token es empresa destino en Gestores_Empresas). */
  esEmpresaGestionada = false;
  permitirVentaMultiSucursal = false;
  sucursalesUsuarioAsignadas: SucursalUsuario[] = [];
  sucursalesPermitidasVenta: Sucursal[] = [];
  bloqueoPorSucursalUsuario = false;
  private ultimaSucursalSeleccionada = '';
  tipoComprobanteDestino = 'NV';
  comprobantesDestinoOpciones = [
    { codigo: 'NV', nombre: 'Nota de Venta' },
    { codigo: '03', nombre: 'Boleta' },
    { codigo: '01', nombre: 'Factura' }
  ];

  /** Cuotas explícitas para factura/boleta a crédito (SUNAT / PDF). En NV el crédito va solo por formas de pago (una cuota en servidor). */
  cuotasCreditoPlano: { monto: number; fechaVencimiento: string }[] = [];

  /** Modal Convertir vale en venta (liquidación). Solo visible si la empresa tiene habilitado vales de despacho (config rubro usaValeDespacho). */
  usaValeDespachoHabilitado = false;
  valesParaLiquidar: ValeDespachoListItem[] = [];
  valeSeleccionadoLiquidar: ValeDespachoListItem | null = null;
  idComprobanteLiquidacion: number | null = null;
  loadingVales = false;
  loadingLiquidar = false;

  /** Comprobantes Factura (01) y Boleta (03) para elegir al liquidar vale */
  get comprobantesFacturaBoleta(): any[] {
    const list = this.comprobantes || [];
    return list.filter((c: any) => {
      const cod = String(c?.codigo ?? '').trim();
      return cod === '01' || cod === '03';
    });
  }

  constructor(
    private _productoService: ProductoService,
    private _marcaService: variosService,
    private _categoriaService: CategoriaService,
    private _presentacionService: PresentacionService,
    private _sucursalService: SucursalService,
    private _clienteService: ClienteService,
    private _comprobanteService: ComprobanteService,
    private _tablasSunatService: TablasSunatService,
    private _documentosService: DocumentoService,
    private modalService: ModalService,
    private buscadorProductosModal: BuscadorProductosModalService,
    private ventasService: VentasService,
    private cotizacionesService: CotizacionesService,
    private cajaService: CajaService,
    private _factilizaService: FactilizaService,
    private _impuestoService: ImpuestoService,
    private ventaProvisionalUi: VentaProvisionalUiService,
    private ventaCotizacionUi: VentaCotizacionUiService,
    private creditosService: CreditosService,
    public sidebarState: SidebarStateService,
    private gestoresService: GestoresService,
    private hotelPreloadVentaService: HotelPreloadVentaService,
    private valesDespachoService: ValesDespachoService,
    private empresaService: EmpresaService,
    private auth: AuthService,
    private rubrosService: RubrosService,
    private pdfService: PdfService,
    private whatsappService: WhatsappService,
    private usuarioSucursalService: UsuarioSucursalService,
    private ngZone: NgZone,
    private route: ActivatedRoute,
    private router: Router,
    private posKeyboard: PosKeyboardService
  ) {}


  private pdfPostVentaModalEl: HTMLElement | null = null;
  private readonly onPdfPostVentaModalHiddenBound = (): void => {
    this.finalizarFlujoTrasModalPdfPostVenta();
  };

  private modalEditarClienteEl: HTMLElement | null = null;
  private readonly onModalEditarClienteHiddenBound = (): void => {
    this.ngZone.run(() => {
      this.idClienteParaEditarModal = null;
    });
  };
  private modalComprobanteEl: HTMLElement | null = null;
  private readonly onModalComprobanteHiddenBound = (): void => {
    this.ngZone.run(() => this.enfocarEscannerCodigo());
  };

  ngAfterViewInit(): void {
    this.configurarAtajosPos();
    this.enfocarEscannerCodigo();
    this.pdfPostVentaModalEl = document.getElementById('pdfModalPostVenta');
    this.pdfPostVentaModalEl?.addEventListener('hidden.bs.modal', this.onPdfPostVentaModalHiddenBound);
    this.modalEditarClienteEl = document.getElementById('modalEditarClienteVenta');
    this.modalEditarClienteEl?.addEventListener('hidden.bs.modal', this.onModalEditarClienteHiddenBound);
    this.modalComprobanteEl = document.getElementById('modalComprobante');
    this.modalComprobanteEl?.addEventListener('hidden.bs.modal', this.onModalComprobanteHiddenBound);
  }

  ngOnDestroy(): void {
    this.posKeyboard.desactivar();
    this.pdfPostVentaModalEl?.removeEventListener('hidden.bs.modal', this.onPdfPostVentaModalHiddenBound);
    this.pdfPostVentaModalEl = null;
    this.modalEditarClienteEl?.removeEventListener('hidden.bs.modal', this.onModalEditarClienteHiddenBound);
    this.modalEditarClienteEl = null;
    this.modalComprobanteEl?.removeEventListener('hidden.bs.modal', this.onModalComprobanteHiddenBound);
    this.modalComprobanteEl = null;
  }

  ngOnInit(): void {
    this.ventaProvisionalUi.configurarModo('completa');
    this.gestoresService.obtenerConfiguracion({ evitarCache: true }).subscribe({
      next: (res) => {
        const lista = Array.isArray(res?.data) ? res.data : [];
        const normClave = (c: { clave?: string; Clave?: string }) =>
          String(c?.clave ?? c?.Clave ?? '')
            .trim()
            .toUpperCase();
        const itemDesc = lista.find((c: { clave?: string; Clave?: string }) => normClave(c) === 'VENTAS_USAR_DESCUENTO_EN_TOTAL');
        const vDesc =
          itemDesc && (itemDesc as { valor?: string; Valor?: string }).valor !== undefined
            ? (itemDesc as { valor?: string; Valor?: string }).valor
            : (itemDesc as { valor?: string; Valor?: string })?.Valor;
        this.usarDescuentoEnTotal = interpretarBooleanoConfig(vDesc, true);
        const itemPdfModal = lista.find((c: { clave?: string; Clave?: string }) =>
          normClave(c) === 'VENTAS_MOSTRAR_MODAL_PDF_TRAS_REGISTRAR'
        );
        const vPdfModal =
          itemPdfModal && (itemPdfModal as { valor?: string; Valor?: string }).valor !== undefined
            ? (itemPdfModal as { valor?: string; Valor?: string }).valor
            : (itemPdfModal as { valor?: string; Valor?: string })?.Valor;
        this.mostrarModalPdfTrasRegistrarVenta = interpretarBooleanoConfig(vPdfModal, true);
        const itemPermNeg = lista.find(
          (c: { clave?: string; Clave?: string }) => normClave(c) === 'INVENTARIO_PERMITIR_VENTAS_NEGATIVAS'
        );
        const vPermNeg =
          itemPermNeg && (itemPermNeg as { valor?: string; Valor?: string }).valor !== undefined
            ? (itemPermNeg as { valor?: string; Valor?: string }).valor
            : (itemPermNeg as { valor?: string; Valor?: string })?.Valor;
        this.permitirVentasNegativas = interpretarBooleanoConfig(vPermNeg, false);
        this.descuentoEnTotalConfigListo = true;
        this.actualizaTotales();
      },
      error: () => {
        this.descuentoEnTotalConfigListo = true;
        this.mostrarModalPdfTrasRegistrarVenta = true;
      }
    });
    this._documentosService.obtener_documento1().subscribe({
      next: (response) => { this.documento = response.data || []; },
      error: () => {}
    });
    this._sucursalService.obtener_sucursal_todos().subscribe({
      next: (r) => {
        this.sucursales = r.data || r || [];
        if (this.sucursales.length && !this.ventas.idSucursal) {
          this.ventas.idSucursal = this.sucursales[0].idSucursal;
        }
        this.resolverSucursalesPermitidasVenta();
        this.cargarComprobantesVentaInicial();
      },
      error: () => {}
    });
    this.cajaService.obtenerCajas().subscribe({
      next: (r) => {
        this.cajas = (r.data || []).filter((c: any) => this.esCajaConAperturaActiva(c));
        this.aplicarSucursalConCajaAbiertaPreferida();
        this.resolverSucursalesPermitidasVenta();
        this.cargarComprobantesVentaInicial();
        this.actualizarValidacionTemprana();
      },
      error: () => {}
    });
    this.ventasService.getBootstrapVenta().subscribe({
      next: (res) => {
        const d = res?.data as { cajas?: unknown[]; sucursales?: Sucursal[] };
        if (Array.isArray(d?.cajas)) {
          this.cajas = d.cajas.filter((c: any) => this.esCajaConAperturaActiva(c));
          this.aplicarSucursalConCajaAbiertaPreferida();
        }
        if (Array.isArray(d?.sucursales) && d.sucursales.length) {
          this.sucursales = d.sucursales;
        }
        this.actualizarValidacionTemprana();
      },
      error: () => {}
    });
    const hoy = getFechaHoyLocal();
    if (!this.ventas.fEmision) this.ventas.fEmision = hoy;
    //if (!this.ventas.fVencimiento) this.ventas.fVencimiento=hoy;
    // fVencimiento no es obligatorio; no se asigna por defecto
    // esGestora desde estado_configuración (BD Gestores_Empresas), no desde listado gestores
    // (obtenerEmpresasGestionadas solo permite Administrador y dejaba al vendedor sin modal gestora).
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (res) => {
        const estado = res?.data;
        this.esGestora = !!estado?.esGestora;
        this.esEmpresaGestionada = !!(estado as { esEmpresaGestionada?: boolean })?.esEmpresaGestionada;
        if (this.esGestora) {
          this.cargarDescuentoPorEmpresaGestora();
        }
        if (!this.esGestora) {
          this._productoService.limpiarCacheListaProductos();
          this.stockSucursales_const = this.filtrarFilasCatalogoEmpresaOperativa(this.stockSucursales_const);
          this.carrito = this.carrito.filter((ln) => this.productoPerteneceEmpresaOperativa(ln));
        }
        this.cargarPermitirVentaMultiSucursal();
      },
      error: () => {
        this.esGestora = false;
        this.esEmpresaGestionada = false;
        this._productoService.limpiarCacheListaProductos();
        this.stockSucursales_const = this.filtrarFilasCatalogoEmpresaOperativa(this.stockSucursales_const);
        this.cargarPermitirVentaMultiSucursal();
      }
    });
    this.cargarSucursalesUsuario();
    this.cargarDatosAuxiliaresVenta();
    this.cargarConfigDefaultsVenta();
    const duplicarDesdeCot = this.route.snapshot.queryParamMap.get('duplicarDesdeCotizacion');
    const duplicarDesde = this.route.snapshot.queryParamMap.get('duplicarDesdeVenta');
    if (duplicarDesdeCot) {
      this.procesarDuplicarDesdeCotizacionSiCorresponde(duplicarDesdeCot);
    } else if (duplicarDesde) {
      this.procesarDuplicarDesdeVentaSiCorresponde(duplicarDesde);
    } else if (this.hotelPreloadVentaService.hasPreload()) {
      this.aplicarPreloadDesdeHabitacion();
    } else {
      this.revisarVentasProvisionales();
    }
    this.cargarUsaValeDespacho();
  }

  /** Determina si la empresa tiene habilitado vales de despacho (config del rubro usaValeDespacho = true). */
  cargarUsaValeDespacho(): void {
    this.empresaService.refreshEmpresaFromApi().subscribe({
      next: (emp) => {
        const idRubro = emp?.idRubro != null ? Number(emp.idRubro) : null;
        if (idRubro == null) {
          this.usaValeDespachoHabilitado = false;
          return;
        }
        this.rubrosService.listarConfiguracion(idRubro).subscribe({
          next: (res) => {
            const items = res.data ?? [];
            this.usaValeDespachoHabilitado = items.some(
              (c: { clave: string; valor: string }) =>
                (c.clave || '').trim().toLowerCase() === 'usavaledespacho' &&
                String(c.valor || '').trim().toLowerCase() === 'true'
            );
          },
          error: () => { this.usaValeDespachoHabilitado = false; }
        });
      },
      error: () => { this.usaValeDespachoHabilitado = false; }
    });
  }

  /** Rellena el carrito desde consumo habitación (hotel → Generar venta). */
  aplicarPreloadDesdeHabitacion(): void {
    const preload = this.hotelPreloadVentaService.getAndClearPreload();
    if (!preload?.lineas?.length) return;
    this.carrito = preload.lineas.map((lin: { idProducto: string; codigo: string; descripcion: string; codigoPresentacion?: string; cantidad: number; pVenta: number; permiteDescripcionEnVenta?: boolean }) => {
      const desc = (lin.descripcion ?? '').toString().trim();
      return {
        idProducto: lin.idProducto,
        codigo: lin.codigo,
        descripcion: lin.descripcion,
        descripcionOriginal: desc,
        permiteDescripcionEnVenta: !!(lin as { permiteDescripcionEnVenta?: boolean }).permiteDescripcionEnVenta,
        codigoPresentacion: lin.codigoPresentacion ?? '',
        cantidad: lin.cantidad,
        pVenta: lin.pVenta
      };
    });
    this.actualizaTotales();
  }

  /** Quitar query `duplicarDesdeVenta` de la URL tras procesar. */
  private limpiarQueryDuplicarDesdeVenta(): void {
    this.router.navigate(['/ventas/create'], { replaceUrl: true });
  }

  private limpiarQueryDuplicarDesdeCotizacion(): void {
    this.router.navigate(['/ventas/create'], { replaceUrl: true });
  }

  /**
   * Desde historial de cotizaciones: mismo detalle que "Cargar cotización", en carrito limpio (nueva venta).
   */
  private procesarDuplicarDesdeCotizacionSiCorresponde(raw: string): void {
    const idCotizacion = parseInt(String(raw).trim(), 10);
    if (Number.isNaN(idCotizacion) || idCotizacion < 1) {
      this.limpiarQueryDuplicarDesdeCotizacion();
      return;
    }
    this.cotizacionesService.obtenerParaVenta(idCotizacion).subscribe({
      next: (res) => {
        const data = res.data;
        if (!validarCotizacionParaCarrito(data)) {
          this.limpiarQueryDuplicarDesdeCotizacion();
          return;
        }
        this.limpiarVenta();
        this.aplicarCotizacionEnCarrito(data, false);
        this._productoService.obtenerProductosTodos({ evitarCache: true }).subscribe({
          next: (pr: any) => {
            if (pr?.data) {
              this.stockSucursales_const = pr.data;
            }
            this.carrito.forEach((ln) => this.enriquecerLineaCarritoDesdeCatalogo(ln));
            this.actualizaTotales();
            this.guardarEstadoProvisional();
            if (typeof iziToast !== 'undefined') {
              iziToast.success({
                title: 'Duplicado',
                message: 'Carrito cargado desde la cotización. Elija tipo de comprobante y forma de pago.',
                position: 'topRight'
              });
            }
            this.limpiarQueryDuplicarDesdeCotizacion();
          },
          error: () => {
            this.actualizaTotales();
            this.guardarEstadoProvisional();
            this.limpiarQueryDuplicarDesdeCotizacion();
          }
        });
      },
      error: () => {
        if (typeof iziToast !== 'undefined') {
          iziToast.error({
            title: 'Duplicar',
            message: 'No se pudo cargar la cotización.',
            position: 'topRight'
          });
        }
        this.limpiarQueryDuplicarDesdeCotizacion();
      }
    });
  }

  private aplicarCotizacionEnCarrito(data: Parameters<typeof mapearCotizacionACarrito>[0], cerrarModal: boolean): void {
    const mapped = mapearCotizacionACarrito(data);
    this.carrito = mapped.carrito as typeof this.carrito;
    if (mapped.idSucursal) {
      this.ventas.idSucursal = mapped.idSucursal;
    }
    if (mapped.cliente.idCliente != null) {
      this.cliente.idCliente = mapped.cliente.idCliente;
      this.cliente.rSocial = mapped.cliente.rSocial ?? '';
      this.cliente.ruc = mapped.cliente.ruc ?? '';
    }
    this.actualizaTotales();
    cerrarModalCotizacionSiCorresponde(cerrarModal);
    notificarCotizacionCargada(cerrarModal);
  }

  /**
   * Desde historial de ventas: carga el detalle del comprobante en el carrito (cliente, comprobante y pago manual).
   */
  private procesarDuplicarDesdeVentaSiCorresponde(raw: string): void {
    const idVenta = parseInt(String(raw).trim(), 10);
    if (Number.isNaN(idVenta) || idVenta < 1) {
      this.limpiarQueryDuplicarDesdeVenta();
      return;
    }
    this.ventasService.getComprobanteParaPdf(idVenta).subscribe({
      next: (res) => {
        const data: ComprobantePdfData | null = res.data ?? null;
        const items = data?.items;
        if (!data?.venta || !Array.isArray(items) || items.length === 0) {
          if (typeof iziToast !== 'undefined') {
            iziToast.warning({
              title: 'Duplicar',
              message: 'No se encontró detalle para duplicar.',
              position: 'topRight'
            });
          }
          this.limpiarQueryDuplicarDesdeVenta();
          return;
        }
        this.limpiarVenta();
        this.carrito = this.mapearItemsPdfACarrito(items, data.venta);
        if (data.venta.idSucursal != null && String(data.venta.idSucursal).trim() !== '') {
          this.ventas.idSucursal = String(data.venta.idSucursal);
        }
        this._productoService.obtenerProductosTodos({ evitarCache: true }).subscribe({
          next: (pr: any) => {
            if (pr?.data) {
              this.stockSucursales_const = pr.data;
            }
            this.carrito.forEach((ln) => this.enriquecerLineaCarritoDesdeCatalogo(ln));
            this.actualizaTotales();
            this.guardarEstadoProvisional();
            if (typeof iziToast !== 'undefined') {
              iziToast.success({
                title: 'Duplicado',
                message: 'Carrito cargado desde el comprobante. Indique cliente, tipo de comprobante y forma de pago.',
                position: 'topRight'
              });
            }
            this.limpiarQueryDuplicarDesdeVenta();
          },
          error: () => {
            this.actualizaTotales();
            this.guardarEstadoProvisional();
            this.limpiarQueryDuplicarDesdeVenta();
          }
        });
      },
      error: () => {
        if (typeof iziToast !== 'undefined') {
          iziToast.error({
            title: 'Duplicar',
            message: 'No se pudo cargar el comprobante para duplicar.',
            position: 'topRight'
          });
        }
        this.limpiarQueryDuplicarDesdeVenta();
      }
    });
  }

  private mapearItemsPdfACarrito(
    items: ComprobantePdfData['items'],
    ventaCab: ComprobantePdfData['venta']
  ): any[] {
    const idSucursalCab = ventaCab?.idSucursal != null ? String(ventaCab.idSucursal).trim() : '';
    return items
      .filter((d) => d.idProducto != null && String(d.idProducto).trim() !== '')
      .map((d) => {
        const idProducto = String(d.idProducto);
        const descLin = (d.descripcion ?? '').toString().trim();
        const descProd = (d.descripcionProducto ?? descLin).toString().trim();
        const cantidad = Number(d.cantidad) || 0;
        const pVenta = Number(d.pVenta) || 0;
        return {
          idProducto,
          codigo: (d.codigo ?? '').toString(),
          descripcion: descLin || descProd,
          descripcionOriginal: descProd || descLin,
          permiteDescripcionEnVenta: !!(d.permiteDescripcionEnVenta === true || Number(d.permiteDescripcionEnVenta) === 1),
          codigoPresentacion: '',
          cantidad,
          pVenta,
          idSucursal: idSucursalCab || this.ventas.idSucursal
        };
      });
  }

  /** Completa stock, presentación, sucursal y datos multiempresa desde el catálogo en memoria. */
  enriquecerLineaCarritoDesdeCatalogo(linea: any): void {
    const list = this.filtrarFilasCatalogoEmpresaOperativa(this.stockSucursales_const || []);
    const idP = String(linea.idProducto ?? '');
    const idS = linea.idSucursal != null ? String(linea.idSucursal).trim() : '';
    const idE = linea.idEmpresa != null ? String(linea.idEmpresa).trim() : '';
    let match = list.find((r: any) => {
      if (String(r.idProducto) !== idP) return false;
      if (idS && r.idSucursal != null && String(r.idSucursal) !== idS) return false;
      if (this.esGestora && idE) {
        const re = r.idEmpresa != null ? String(r.idEmpresa) : '';
        if (re && re !== idE) return false;
      }
      return true;
    });
    if (!match) {
      match = list.find((r: any) => String(r.idProducto) === idP);
    }
    if (!match) return;
    linea.stock = match.stock;
    if (!linea.codigoPresentacion) linea.codigoPresentacion = match.codigoPresentacion ?? '';
    if (!linea.sucursal) linea.sucursal = match.sucursal ?? '';
    if (match.idEmpresa != null) {
      linea.idEmpresa = String(match.idEmpresa);
      linea.aliasEmpresa = match.aliasEmpresa ?? match.razonSocialEmpresa ?? '';
    }
    const marcaCat = marcaProductoEnLista(match as Record<string, unknown>);
    if (marcaCat) {
      (linea as Record<string, unknown>)['nombreMarca'] =
        (match as Record<string, unknown>)['nombreMarca'] ??
        (match as Record<string, unknown>)['marca'] ??
        marcaCat;
    }
  }

  /** Stock numérico del catálogo o null si no aplica. */
  private stockNumericoProducto(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }


  private obtenerStockDisponibleParaLineaCarrito(item: any): number | null {
    const list = this.filtrarFilasCatalogoEmpresaOperativa(this.stockSucursales_const || []);
    const idP = String(item.idProducto ?? '');
    const idS = item.idSucursal != null ? String(item.idSucursal).trim() : '';
    const idE = item.idEmpresa != null ? String(item.idEmpresa).trim() : '';
    let match = list.find((r: any) => {
      if (String(r.idProducto) !== idP) return false;
      if (idS && r.idSucursal != null && String(r.idSucursal) !== idS) return false;
      if (this.esGestora && idE) {
        const re = r.idEmpresa != null ? String(r.idEmpresa) : '';
        if (re && re !== idE) return false;
      }
      return true;
    });
    if (!match) match = list.find((r: any) => String(r.idProducto) === idP);
    const s = this.stockNumericoProducto(match?.stock ?? item?.stock);
    return s;
  }

  /** Carrito: cantidad supera stock conocido o stock 0 (solo aviso visual si no está permitido vender sin stock). */
  lineaCarritoStockInsuficiente(item: any): boolean {
    if (this.permitirVentasNegativas) return false;
    const cant = Number(item?.cantidad) || 0;
    const disp = this.obtenerStockDisponibleParaLineaCarrito(item);
    if (disp == null) return false;
    if (disp <= 0) return true;
    return cant > disp;
  }

  /** Carga estado pedido y estado pago por defecto desde configuración y los aplica a la venta actual. */
  cargarConfigDefaultsVenta(): void {
    this.ventasService.getConfigDefaults().subscribe({
      next: (res) => {
        const d = res?.data;
        if (d) {
          this.configDefaults.idEstadoPedidoPorDefecto = d.idEstadoPedidoPorDefecto ?? 1;
          this.configDefaults.idEstadoPagoPorDefecto = d.idEstadoPagoPorDefecto ?? 2;
          this.ventas.idEstadoPedido = this.configDefaults.idEstadoPedidoPorDefecto;
          this.ventas.idEstadoPago = this.configDefaults.idEstadoPagoPorDefecto;
        }
      },
      error: () => {}
    });
  }

  /** Tras cargar datos, revisa si hay ventas provisionales y ofrece recuperarlas. */
  revisarVentasProvisionales(): void {
    if (!this.ventaProvisionalUi.tieneSesionesGuardadas()) return;
    this.sesionesGuardadas = this.ventaProvisionalUi.listarSesionesGuardadas();
    this.mostrarModalRecuperar = true;
    this.ventaProvisionalUi.abrirModalRecuperar();
  }

  /** Recupera una venta provisional por id y cierra el modal. */
  recuperarSesion(sesion: VentaSesion): void {
    const recuperada = this.ventaProvisionalUi.prepararRecuperacion(sesion);
    if (!recuperada) return;
    this.carrito = Array.isArray(recuperada.carrito) ? recuperada.carrito.map((x: any) => ({ ...x })) : [];
    this.ventas = recuperada.ventas ? { ...recuperada.ventas } : this.ventas;
    this.detallePago = Array.isArray(recuperada.detallePago) ? recuperada.detallePago.map((x: any) => ({ ...x })) : [];
    this.cliente = recuperada.cliente ? { ...recuperada.cliente } : this.cliente;
    this.pagaCon = Number(recuperada.pagaCon) || 0;
    this.vuelto = Number(recuperada.vuelto) || 0;
    this.mostrarModalRecuperar = false;
    this.sesionesGuardadas = [];
    this.actualizaTotales();
  }

  /** Descarta todas las ventas provisionales y cierra el modal. */
  descartarTodasLasProvisionales(): void {
    this.ventaProvisionalUi.descartarTodasLasSesiones();
    this.mostrarModalRecuperar = false;
    this.sesionesGuardadas = [];
  }

  /** Cierra el modal de recuperación sin elegir (sigue con venta nueva). */
  cerrarModalRecuperar(): void {
    this.ventaProvisionalUi.cerrarModalRecuperar();
    this.mostrarModalRecuperar = false;
    this.sesionesGuardadas = [];
  }

  /** Guarda el estado actual en la sesión activa (localStorage). No guarda idEmpresa. */
  guardarEstadoProvisional(): void {
    this.ventaProvisionalUi.guardarEstadoActual({
      carrito: this.carrito,
      ventas: this.ventas,
      detallePago: this.detallePago,
      cliente: this.cliente,
      pagaCon: this.pagaCon,
      vuelto: this.vuelto
    });
  }

  /** Anula la venta actual (elimina de provisionales) y deja pantalla lista para nueva venta. */
  anularVenta(): void {
    if (!confirm('¿Anular esta venta? Se eliminará de las ventas provisionales.')) return;
    this.ventaProvisionalUi.eliminarSesionActiva();
    this.limpiarVenta();
  }
  /** Catálogo Comprobantes (venta) para la sucursal operativa; sin idSucursal no llama al API. */
  private cargarComprobantesVentaInicial(): void {
    if (!this.ventas.idSucursal || String(this.ventas.idSucursal).trim() === '') {
      return;
    }
    this._comprobanteService.obtenerComprobantesVenta(this.ventas.idSucursal).subscribe({
      next: (response) => {
        this.comprobantes = response.data || [];
      },
      error: () => {}
    });
  }

  /** Consulta productos para refrescar stock (p. ej. tras registrar una venta). */
  cargarProductos(opciones?: { evitarCache?: boolean }): void {
    this._productoService.obtenerProductosTodos(opciones).subscribe({
      next: (response: any) => {
        if (response?.data != null) {
          const data = this.filtrarFilasCatalogoEmpresaOperativa(
            Array.isArray(response.data) ? response.data : []
          );
          this.stockSucursales_const = data;
        }
      },
      error: (err) => {
        console.error('Error al cargar productos:', err);
      }
    });
  }


  marcaColumnaVentas(p: any): string {
    const t = marcaProductoEnLista(p as Record<string, unknown>);
    return t || '—';
  }

  /** Formas de pago e impuestos (sin catálogo completo de productos). */
  private cargarDatosAuxiliaresVenta(): void {
  this._documentosService.getFormasPago().subscribe({
    next: (response) => {
      this.formasPago = response.data || [];
      const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
      if (efectivo) {
        this.formaPagoSeleccionada = { ...efectivo };
      }
    },
    error: (err) => {
      console.error('Error:', err);
      this.formasPago = [];
    }
  });

    // Impuestos a los que está sujeta la empresa (activos). El footer y el total se calculan solo con estos.
    this._impuestoService.obtenerTodos().subscribe({
      next: (res) => {
        const list: Impuesto[] = res.data || [];
        this.impuestosActivosEmpresa = list.filter((i: Impuesto) => this.impuestoEstaActivo(i));
      },
      error: () => {}
    });

    this.cargarComprobantesVentaInicial();

    this._tablasSunatService.obtener_moneda().subscribe(
      (response) => {
        this.moneda = response.data;
              },
      (error) => {
              }
    );

    this._tablasSunatService.obtener_estado_pago().subscribe(
      (response) => {
        this.estadoPago = response.data;
      },
      (error) => {  }
    );

    this._tablasSunatService.obtener_estados_pedidos().subscribe(
      (response) => {
        this.estadosPedidos = response.data || [];
        if (this.estadosPedidos.length && (this.ventas.idEstadoPedido == null || this.ventas.idEstadoPedido === '')) {
          this.ventas.idEstadoPedido = this.estadosPedidos[0].idEstadoPedido;
        }
      },
      (error) => {  }
    );

    this._tablasSunatService.obtener_medios_pago().subscribe(
      (response) => {
        this.mediosPago = response.data || [];
        if (this.mediosPago.length && !this.ventas.idMediosPago) {
          const contado = this.mediosPago.find((m: any) => (m.codigo || '').toString().trim() === '009');
          this.ventas.idMediosPago = contado ? String(contado.idMediosPago) : String(this.mediosPago[0].idMediosPago);
        }
      },
      (error) => {
        console.error('Error al cargar medios de pago:', error);
      }
    );


   
      
  

        // this._documentosService.obtener_documento().subscribe(
    //   response => {
    //     this.documento = response.data;
    //     console.log('this.documento', this.documento);
    //   },
    //   error => {
    //     console.log(error);
    //   }
    // );

  }



  private cargarPermitirVentaMultiSucursal(): void {
    this.empresaService.refreshEmpresaFromApi().subscribe({
      next: (emp) => {
        const raw = (emp as unknown as { permitirVentaMultiSucursal?: unknown })?.permitirVentaMultiSucursal;
        this.permitirVentaMultiSucursal = raw === true || raw === 1 || raw === '1';
        this.resolverSucursalesPermitidasVenta();
      },
      error: () => {
        this.permitirVentaMultiSucursal = false;
        this.resolverSucursalesPermitidasVenta();
      }
    });
  }

  private cargarSucursalesUsuario(): void {
    this.usuarioSucursalService.cargarMisSucursales().subscribe({
      next: (res) => {
        this.sucursalesUsuarioAsignadas = Array.isArray(res?.data) ? res.data : [];
        this.resolverSucursalesPermitidasVenta();
      },
      error: () => {
        this.sucursalesUsuarioAsignadas = [];
        this.resolverSucursalesPermitidasVenta();
      }
    });
  }

  private idsSucursalesAsignadasActivas(): Set<string> {
    return new Set(
      (this.sucursalesUsuarioAsignadas || [])
        .map((s) => String(s.idSucursal || '').toLowerCase())
        .filter(Boolean)
    );
  }

  /** Empresa del JWT: en gestionada/independiente solo sus productos y sucursales. */
  private idEmpresaOperacionJwt(): string {
    return String(this.auth.userData()?.idEmpresa || '').trim();
  }

  private productoPerteneceEmpresaOperativa(item: { idEmpresa?: string | null } | null | undefined): boolean {
    if (this.esGestora || !item) {
      return true;
    }
    const idJwt = this.idEmpresaOperacionJwt().toLowerCase();
    if (!idJwt) {
      return true;
    }
    const idProdEmp = item.idEmpresa != null ? String(item.idEmpresa).trim().toLowerCase() : idJwt;
    return idProdEmp === idJwt;
  }

  private filtrarFilasCatalogoEmpresaOperativa(filas: any[]): any[] {
    if (!filas?.length || this.esGestora) {
      return filas || [];
    }
    return filas.filter((item) => this.productoPerteneceEmpresaOperativa(item));
  }

  /** Precarga catálogo en memoria (sin bloquear UI) para búsquedas locales instantáneas. */
  private precargarCatalogoProductosEnSegundoPlano(): void {
    if (this._productoService.tieneCatalogoEnMemoria()) {
      return;
    }
    this._productoService.obtenerProductosTodos().subscribe({
      next: (res) => {
        const data = this.filtrarFilasCatalogoEmpresaOperativa(Array.isArray(res?.data) ? res.data : []);
        if (data.length) {
          this.fusionarFilasEnCatalogoMemoria(data);
        }
      },
      error: () => {}
    });
  }

  private obtenerCatalogoProductosOperativo(fuente?: any[]): any[] {
    let activos = (fuente ?? this.stockSucursales_const ?? []).filter((item: any) =>
      productoActivoParaVenta(item as Record<string, unknown>)
    );
    const idsAsignadas = this.idsSucursalesAsignadasActivas();
    // En gestora el catálogo incluye sucursales de empresas gestionadas; no filtrar por asignaciones del usuario (token = gestora).
    if (idsAsignadas.size > 0 && !this.esGestora) {
      activos = activos.filter((item: any) =>
        idsAsignadas.has(String(item?.idSucursal || '').toLowerCase())
      );
    }
    let resultado = activos;
    if (!this.permitirVentaMultiSucursal && !this.esGestora) {
      // Varias sucursales asignadas: ya acotado por ids; no recortar otra vez a ventas.idSucursal.
      if (idsAsignadas.size > 1) {
        resultado = activos;
      } else if (idsAsignadas.size === 1) {
        resultado = activos;
      } else if (this.esEmpresaGestionada) {
        resultado = activos;
      } else if (this.ventas.idSucursal) {
        const idSuc = String(this.ventas.idSucursal);
        resultado = activos.filter((item: any) => String(item?.idSucursal || '') === idSuc);
      } else {
        resultado = activos;
      }
    }
    return this.filtrarFilasCatalogoEmpresaOperativa(resultado);
  }

  private resolverSucursalesPermitidasVenta(): void {
    const idsAsignadas = this.idsSucursalesAsignadasActivas();
    const sucursalesActivas = (this.sucursales || []).filter((s: any) => (s?.estado ?? true) !== false);
    this.sucursalesPermitidasVenta = idsAsignadas.size > 0
      ? sucursalesActivas.filter((s) => idsAsignadas.has(String(s.idSucursal || '').toLowerCase()))
      : sucursalesActivas;
    this.bloqueoPorSucursalUsuario = idsAsignadas.size > 0 && this.sucursalesPermitidasVenta.length === 0;
    if (this.bloqueoPorSucursalUsuario) {
      this.ventas.idSucursal = '';
      this.comprobantes = [];
      return;
    }
    if (!this.permitirVentaMultiSucursal && this.sucursalesPermitidasVenta.length > 0) {
      const actual = String(this.ventas.idSucursal || '').toLowerCase();
      const existeActual = this.sucursalesPermitidasVenta.some((s) => String(s.idSucursal).toLowerCase() === actual);
      if (!existeActual) {
        const def = (this.sucursalesUsuarioAsignadas.find((s) => s.esDefault) || this.sucursalesUsuarioAsignadas[0])?.idSucursal;
        const permitidaDefault = this.sucursalesPermitidasVenta.find((s) => String(s.idSucursal).toLowerCase() === String(def || '').toLowerCase());
        this.ventas.idSucursal = permitidaDefault?.idSucursal || this.sucursalesPermitidasVenta[0].idSucursal;
      }
      this.ultimaSucursalSeleccionada = String(this.ventas.idSucursal || '');
    } else if (!this.ventas.idSucursal && this.sucursalesPermitidasVenta.length > 0) {
      this.ventas.idSucursal = this.sucursalesPermitidasVenta[0].idSucursal;
      this.ultimaSucursalSeleccionada = String(this.ventas.idSucursal || '');
    }
    this.aplicarSucursalConCajaAbiertaPreferida();
    this.cargarComprobantesVentaInicial();
  }

  /** Apertura activa devuelta por GET caja/cajas (cajaAbierta puede ser 1/0 desde SQL). */
  private esCajaConAperturaActiva(c: { cajaAbierta?: unknown; idApertura?: string | null } | null | undefined): boolean {
    if (!c?.idApertura) return false;
    const v = c.cajaAbierta;
    return v === true || v === 1 || v === '1';
  }

  /**
   * Si la sucursal del comprobante no tiene caja abierta, usa la primera sucursal permitida (o caja abierta) que sí tenga.
   * Corrige carrera al iniciar: sucursales cargan antes que cajas y dejaban idSucursal sin apertura.
   */
  private aplicarSucursalConCajaAbiertaPreferida(): boolean {
    const actual = String(this.ventas.idSucursal || '').trim();
    if (actual && this.tieneCajaAbiertaEnSucursal(actual)) {
      return true;
    }
    const candidatas = (this.sucursalesPermitidasVenta?.length
      ? this.sucursalesPermitidasVenta
      : this.sucursales || []) as { idSucursal?: string; nombre?: string }[];
    const conCaja = candidatas.find((s) => this.tieneCajaAbiertaEnSucursal(s.idSucursal));
    if (conCaja?.idSucursal) {
      this.ventas.idSucursal = conCaja.idSucursal;
      this.ultimaSucursalSeleccionada = String(conCaja.idSucursal);
      return true;
    }
    const primeraCaja = (this.cajas || []).find((c) => this.esCajaConAperturaActiva(c) && c.idSucursal);
    if (primeraCaja?.idSucursal) {
      this.ventas.idSucursal = primeraCaja.idSucursal;
      this.ultimaSucursalSeleccionada = String(primeraCaja.idSucursal);
      return true;
    }
    return !!actual && this.tieneCajaAbiertaEnSucursal(actual);
  }

  private tieneCajaAbiertaEnSucursal(idSucursal: string | null | undefined): boolean {
    const id = String(idSucursal || '').trim().toLowerCase();
    if (!id) return false;
    return (this.cajas || []).some((c: any) =>
      String(c?.idSucursal || '').trim().toLowerCase() === id && this.esCajaConAperturaActiva(c)
    );
  }

  private obtenerCajaAbiertaSucursal(idSucursal: string | null | undefined): any | null {
    const id = String(idSucursal || '').trim().toLowerCase();
    if (!id) return null;
    return (this.cajas || []).find((c: any) =>
      String(c?.idSucursal || '').trim().toLowerCase() === id && this.esCajaConAperturaActiva(c)
    ) || null;
  }

  onSucursalVentaChange(): void {
    const idNueva = String(this.ventas.idSucursal || '').trim();
    if (this.carrito.length > 0 && !this.permitirVentaMultiSucursal && !this.esGestora) {
      const ok = confirm('Cambiar de sucursal limpiará el carrito actual para evitar mezclar stock. ¿Desea continuar?');
      if (!ok) {
        this.ventas.idSucursal = this.ultimaSucursalSeleccionada;
        return;
      }
      this.carrito = [];
      this.actualizaTotales();
    }
    if (!idNueva) {
      this.comprobantes = [];
      return;
    }
    this.ultimaSucursalSeleccionada = idNueva;
    this.cargarComprobantesVentaInicial();
  }

  /**
   * Cotización "agrupada" (corporativa / multi-empresa): solo empresa gestora y solo si el carrito
   * mezcla productos de más de una empresa. Evita marcar agrupada en gestionadas (todas las líneas llevan idEmpresa propio).
   */
  private cotizacionDebeMarcarseAgrupada(): boolean {
    if (!this.esGestora || !this.carrito?.length) return false;
    const ids = new Set<string>();
    for (const item of this.carrito) {
      const id = item?.idEmpresa != null && String(item.idEmpresa).trim() !== '' ? String(item.idEmpresa) : null;
      if (id) ids.add(id);
    }
    return ids.size > 1;
  }


  /** Búsqueda instantánea si el catálogo ya está en memoria (SPA u otra pantalla). */
  private buscarEnCatalogoLocal(term: string): any[] | null {
    const termOk = String(term || '').trim();
    if (termOk.length < 2) {
      return [];
    }

    if (this._productoService.tieneCatalogoEnMemoria()) {
      const mem = this._productoService.filtrarListaMemoriaVenta(termOk, 300);
      if (mem !== null) {
        return this.obtenerCatalogoProductosOperativo(mem).slice(0, this.buscadorLimiteFilas);
      }
    }

    if ((this.stockSucursales_const?.length || 0) > 0) {
      const parcial = (this.stockSucursales_const || []).filter((item: any) =>
        productoCoincideBusquedaMultipalabra(item as Record<string, unknown>, termOk)
      );
      return this.obtenerCatalogoProductosOperativo(parcial).slice(0, this.buscadorLimiteFilas);
    }

    return null;
  }

  productoYaEnCarrito(producto: any): boolean {
    return this.carrito.some(
      (p) =>
        String(p.idProducto) === String(producto?.idProducto) &&
        String(p.idSucursal || '') === String(producto?.idSucursal || this.ventas.idSucursal || '') &&
        String(p.idEmpresa || '') === String(producto?.idEmpresa || '')
    );
  }

  abrirBuscadorProductos(): void {
    this.buscadorProductosModal.abrir({
      modo: 'venta',
      conservarUltimaBusqueda: true,
      idSucursal: String(this.ventas.idSucursal || ''),
      venta: {
        idSucursalApi: this.idSucursalParaBusquedaApi(),
        esGestora: this.esGestora,
        idSucursalDefault: String(this.ventas.idSucursal || ''),
        buscarLocal: (term) => this.buscarEnCatalogoLocal(term),
        filtrarFila: (row) => this.productoPerteneceEmpresaOperativa(row),
        onPrecargarCatalogo: () => this.precargarCatalogoProductosEnSegundoPlano(),
        estaEnDetalle: (p) => this.productoYaEnCarrito(p)
      }
    }).then((prod) => {
      if (!prod) {
        this.enfocarEscannerCodigo();
        return;
      }
      this.fusionarFilasEnCatalogoMemoria([prod]);
      this.agregarAlCarrito(prod);
      this.enfocarEscannerCodigo();
    });
  }

  private idSucursalParaBusquedaApi(): string | undefined {
    if (this.permitirVentaMultiSucursal || this.esGestora || this.esEmpresaGestionada) {
      return undefined;
    }
    const idsAsignadas = this.idsSucursalesAsignadasActivas();
    if (idsAsignadas.size > 0) {
      return undefined;
    }
    const id = String(this.ventas.idSucursal || '').trim();
    return id || undefined;
  }

  private fusionarFilasEnCatalogoMemoria(filas: any[]): void {
    const permitidas = this.filtrarFilasCatalogoEmpresaOperativa(filas || []);
    if (!permitidas.length) {
      return;
    }
    const clave = (r: any) =>
      `${String(r.idProducto)}|${String(r.idSucursal || '')}|${String(r.idEmpresa || '')}`;
    const map = new Map<string, any>();
    for (const r of this.filtrarFilasCatalogoEmpresaOperativa(this.stockSucursales_const)) {
      map.set(clave(r), r);
    }
    for (const r of permitidas) {
      map.set(clave(r), r);
    }
    this.stockSucursales_const = [...map.values()];
  }


  /** Retorna el idMediosPago de CONTADO para usar como valor por defecto. */
  getIdMediosPagoContado(): string {
    const contado = this.mediosPago?.find((m: any) => (m.codigo || '').toString().trim() === '009');
    if (contado) return String(contado.idMediosPago);
    if (this.mediosPago?.length) return String(this.mediosPago[0].idMediosPago);
    return '1';
  }

  /** idDocumento según tabla Documentos: RUC = 6, DNI = 1 (Perú). */
  private readonly ID_DOC_RUC = '6';
  private readonly ID_DOC_DNI = '1';

  /**
   * Empresa gestora: el select "Comprobante destino" refleja el código del tipo elegido (01, 03, NV).
   */
  private sincronizarTipoComprobanteDestinoDesdeCodigo(codigo: string | undefined | null): void {
    if (!this.esGestora) return;
    const c = String(codigo ?? '').trim();
    const permitidos = new Set(this.comprobantesDestinoOpciones.map((o) => o.codigo));
    this.tipoComprobanteDestino = permitidos.has(c) ? c : 'NV';
    if (this.tipoComprobanteDestino !== '01' && this.tipoComprobanteDestino !== '03') {
      this.cuotasCreditoPlano = [];
    }
  }

  onTipoComprobanteDestinoChanged(): void {
    if (!this.esFacturaOBoletaVenta()) {
      this.cuotasCreditoPlano = [];
    }
  }

  /**
   * Consulta el número correlativo en BD al seleccionar el comprobante y asigna serie/número.
   * Ajusta el tipo de documento: Factura (01) = RUC, otros = DNI.
   */
  cargarDatosComprobantePorId(idComprobante: string | number): void {
    if (idComprobante == null || idComprobante === '') {
      this.ventas.serie = '';
      this.ventas.numero = '';
      this.ventas.compVenta = '';
      this.ventas.idComprobante = '';
      if (this.esGestora) {
        this.tipoComprobanteDestino = 'NV';
      }
      this.guardarEstadoProvisional();
      return;
    }
    const id = Number(idComprobante);
    this.ventas.idComprobante = idComprobante as any;
    const compPrevio = this.comprobantes.find((c: any) => Number(c.idComprobante) === id);
    if (compPrevio) {
      this.sincronizarTipoComprobanteDestinoDesdeCodigo(compPrevio.codigo);
    }
    this._comprobanteService.obtenerComprobantesVenta(this.ventas.idSucursal).subscribe({
      next: (response) => {
        const lista = response.data || [];
        this.comprobantes = lista;
        const comp = lista.find((c: any) => Number(c.idComprobante) === id);
        if (comp) {
          this.ventas.serie = comp.serie ?? '';
          const siguienteNumero = (comp.numero != null ? Number(comp.numero) : 0) + 1;
          this.ventas.numero = String(siguienteNumero).padStart(8, '0');
          this.ventas.compVenta = this.ventas.serie + '-' + this.ventas.numero;
          this.ventas.idDocumento = (comp.codigo === '01') ? this.ID_DOC_RUC : this.ID_DOC_DNI;
          this.sincronizarTipoComprobanteDestinoDesdeCodigo(comp.codigo);
          if (!this.esFacturaOBoletaVenta()) {
            this.cuotasCreditoPlano = [];
          }
        } else {
          this.ventas.serie = '';
          this.ventas.numero = '00000001';
          this.ventas.compVenta = (this.ventas.serie ? this.ventas.serie + '-' : '') + this.ventas.numero;
          if (this.esGestora) {
            this.tipoComprobanteDestino = 'NV';
          }
          this.cuotasCreditoPlano = [];
        }
        this.guardarEstadoProvisional();
      },
      error: () => {
        const comp = this.comprobantes.find((c: any) => Number(c.idComprobante) === id);
        if (comp) {
          this.ventas.serie = comp.serie ?? '';
          const siguienteNumero = (comp.numero != null ? Number(comp.numero) : 0) + 1;
          this.ventas.numero = String(siguienteNumero).padStart(8, '0');
          this.ventas.compVenta = this.ventas.serie + '-' + this.ventas.numero;
          this.ventas.idDocumento = (comp.codigo === '01') ? this.ID_DOC_RUC : this.ID_DOC_DNI;
          this.sincronizarTipoComprobanteDestinoDesdeCodigo(comp.codigo);
          if (!this.esFacturaOBoletaVenta()) {
            this.cuotasCreditoPlano = [];
          }
        }
        this.guardarEstadoProvisional();
      }
    });
  }


  agregarAlCarrito(producto: any): void {
    if (!this.productoPerteneceEmpresaOperativa(producto)) {
      iziToast.warning({
        title: 'Producto no permitido',
        message: 'Este producto no pertenece a su empresa. Actualice la búsqueda o cierre sesión si cambió de empresa.'
      });
      return;
    }
    if (!this.permitirVentaMultiSucursal) {
      const idEmpresaNuevo = String(producto?.idEmpresa || '').trim();
      const idSucursalNuevo = String(producto?.idSucursal || this.ventas.idSucursal || '').trim();
      const mezclaSucursalMismaEmpresa = this.carrito.find((p) =>
        String(p?.idEmpresa || '').trim() === idEmpresaNuevo &&
        String(p?.idSucursal || '').trim() !== idSucursalNuevo
      );
      if (mezclaSucursalMismaEmpresa) {
        iziToast.warning({
          title: 'Sucursal restringida',
          message: 'Con multi-sucursal desactivado solo puede usar una sucursal por empresa en la venta.'
        });
        return;
      }
    }
    const existe = this.carrito.find(p =>
      String(p.idProducto) === String(producto.idProducto) &&
      String(p.idSucursal || '') === String(producto.idSucursal || this.ventas.idSucursal || '') &&
      String(p.idEmpresa || '') === String(producto.idEmpresa || '')
    );
    if (existe) {
      const cantNueva = (Number(existe.cantidad) || 0) + 1;
      const stockVal = this.validarStockAgregarAlCarrito(existe, cantNueva);
      if (!stockVal.valido) {
        iziToast.warning({ title: 'Stock', message: stockVal.mensaje || 'Stock insuficiente.', position: 'topRight' });
        return;
      }
      existe.cantidad = cantNueva;
      this.enriquecerLineaCarritoDesdeCatalogo(existe);
    } else {
      const stockVal = this.validarStockAgregarAlCarrito(producto, 1);
      if (!stockVal.valido) {
        iziToast.warning({ title: 'Stock', message: stockVal.mensaje || 'Stock insuficiente.', position: 'topRight' });
        return;
      }
      const descCat = (producto.descripcion ?? '').toString().trim();
      this.carrito.push({
        ...producto,
        cantidad: 1,
        descripcionOriginal: descCat,
        permiteDescripcionEnVenta: !!(producto.permiteDescripcionEnVenta === true || producto.permiteDescripcionEnVenta === 1)
      });
      const agregado = this.carrito[this.carrito.length - 1];
      this.enriquecerLineaCarritoDesdeCatalogo(agregado);
            }
    this.actualizaTotales();
  }

  actualizarValidacionTemprana(): void {
    const abiertas = (this.cajas || [])
      .filter((c) => this.esCajaConAperturaActiva(c))
      .map((c) => (c.sucursal || c.nombre || '').trim())
      .filter(Boolean);
    this.alertaValidacionTemprana = construirAlertaValidacionTemprana({
      esCotizacion: this.esCotizacion(),
      bloqueoSucursal: this.bloqueoPorSucursalUsuario,
      idSucursal: this.ventas.idSucursal,
      tieneCajaAbierta: this.tieneCajaAbiertaEnSucursal(this.ventas.idSucursal),
      nombresCajasAbiertas: [...new Set(abiertas)]
    });
  }

  private validarAntesDeCobrar(validarCarrito = true): boolean {
    this.actualizarValidacionTemprana();
    if (this.alertaValidacionTemprana?.tipo === 'danger') {
      iziToast.warning({
        title: 'No se puede registrar',
        message: this.alertaValidacionTemprana.mensaje,
        position: 'topRight'
      });
      return false;
    }
    const codComp = codigoComprobanteDesdeLista(this.comprobantes, this.ventas.idComprobante);
    const sunat = validarClienteSunatParaComprobante({
      codigoComprobante: codComp,
      idDocumento: this.ventas.idDocumento,
      numeroDocumento: this.cliente?.ruc,
      razonSocial: this.cliente?.rSocial
    });
    if (!sunat.valido) {
      iziToast.warning({
        title: 'Validación SUNAT',
        message: sunat.mensaje || 'Datos del cliente inválidos.',
        position: 'topRight'
      });
      return false;
    }
    if (validarCarrito && !this.permitirVentasNegativas) {
      const lineaSinStock = this.carrito.find((item) => this.lineaCarritoStockInsuficiente(item));
      if (lineaSinStock) {
        iziToast.warning({
          title: 'Stock insuficiente',
          message: `Revise cantidades: ${lineaSinStock.descripcion || lineaSinStock.codigo}.`,
          position: 'topRight'
        });
        return false;
      }
    }
    return true;
  }

  private configurarAtajosPos(): void {
    this.posKeyboard.activar(
      {
        buscar: () => this.abrirBuscadorProductos(),
        comprobante: () => this.abrirModalComprobanteAtajo(),
        cobrar: () => this.cobrarAtajoPos(),
        cliente: () => this.abrirModalClienteAtajo(),
        cerrarModal: () => {
          if (this.posKeyboard.cerrarModalesVisibles()) {
            this.enfocarEscannerCodigo();
            return;
          }
          if (this.mostrarAyudaAtajosPos) {
            this.mostrarAyudaAtajosPos = false;
          } else {
            this.enfocarEscannerCodigo();
          }
        },
        ayuda: () => {
          this.mostrarAyudaAtajosPos = !this.mostrarAyudaAtajosPos;
        }
      },
      {
        teclas: { cliente: 'F6', cerrarModal: 'Escape', limpiarBusqueda: null }
      }
    );
  }

  /** Campo escáner: foco listo para el siguiente código de barras. */
  enfocarEscannerCodigo(): void {
    setTimeout(() => {
      const el = this.inputSearchCodigo?.nativeElement;
      if (!el) {
        return;
      }
      el.focus();
      el.select();
    }, 0);
  }

  abrirModalComprobanteAtajo(): void {
    const modalEl = document.getElementById('modalComprobante');
    if (modalEl && typeof bootstrap !== 'undefined') {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  }

  abrirModalClienteAtajo(): void {
    if (!this.ventas?.idComprobante) {
      iziToast.warning({
        title: 'Aviso',
        message: 'Seleccione primero el tipo de comprobante.',
        position: 'topRight'
      });
      return;
    }
    const modalEl = document.getElementById('modalCliente');
    if (modalEl && typeof bootstrap !== 'undefined') {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  }

  /** F4: abre forma de pago (contado) o registra directo (pendiente/crédito). */
  cobrarAtajoPos(): void {
    if (!this.validarAntesDeCobrar()) {
      return;
    }
    if (this.carrito.length === 0) {
      iziToast.warning({ title: 'Advertencia', message: 'Agregue al menos un producto al carrito.' });
      return;
    }
    const idEstadoPago = Number(this.ventas.idEstadoPago) || 2;
    if (idEstadoPago !== 1) {
      this.abrirModalPago();
      const modalEl = document.getElementById('modalPago');
      if (modalEl && typeof bootstrap !== 'undefined') {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
      }
      return;
    }
    this.registrarVenta();
  }

  private validarStockAgregarAlCarrito(
    producto: any,
    cantidadNueva: number
  ): { valido: boolean; mensaje?: string; advertencia?: string } {
    const stock = this.obtenerStockDisponibleParaLineaCarrito(producto);
    return validarStockLinea({
      cantidadNueva,
      stockDisponible: stock,
      permitirVentasNegativas: this.permitirVentasNegativas,
      nombreProducto: producto?.descripcion || producto?.codigo
    });
  }

  
  buscarCodigoProd(): void {
      // normalizar input
      const raw = (this.searchCodigo ?? '').toString().trim();
      if (!raw) {
        iziToast.show({ title: 'ERROR', titleColor: '#FF0000', message: 'Ingrese un código', position: 'topRight' });
        return;
      }

      // opcional: exigir mínimo de caracteres para evitar búsquedas insignificantes
      if (raw.length < 5) {
        // iziToast.show({ title: 'INFO', titleColor: '#007bff', message: 'Ingrese al menos 3 caracteres', position: 'topRight' });
        return;
      }

      const term = raw.toLowerCase();
      const fuenteMemoria = this.obtenerCatalogoProductosOperativo();
      if (fuenteMemoria.length > 0) {
        const enMemoria = this.resolverProductoPorCodigoEnLista(fuenteMemoria, term, raw);
        if (enMemoria) {
          this.aplicarResultadoBusquedaCodigo(enMemoria);
          return;
        }
      }
      this._productoService
        .buscarProductosVenta({
          q: raw,
          limit: 30,
          idSucursal: this.idSucursalParaBusquedaApi()
        })
        .subscribe({
          next: (res) => {
            const list = (Array.isArray(res?.data) ? res.data : []).filter((item: any) =>
              productoActivoParaVenta(item as Record<string, unknown>)
            );
            this.fusionarFilasEnCatalogoMemoria(list);
            this.aplicarResultadoBusquedaCodigo(this.resolverProductoPorCodigoEnLista(list, term, raw));
          },
          error: () => {
            iziToast.show({
              title: 'ERROR',
              titleColor: '#FF0000',
              message: 'No se pudo buscar el producto por código',
              position: 'topRight'
            });
          }
        });
  }

  private resolverProductoPorCodigoEnLista(fuente: any[], term: string, raw: string): any | null {
      let encontrado = fuente.find((item: any) => {
        const codigo = (item.codigo ?? '').toString().toLowerCase();
        return codigo === term;
      });
      if (!encontrado) {
        encontrado = fuente.find((item: any) => {
          const codigo = (item.codigo ?? '').toString().toLowerCase();
          return codigo.includes(term);
        });
      }
      if (!encontrado && /^\d+$/.test(term)) {
        encontrado = fuente.find((item: any) => String(item.idProducto) === term);
      }
      if (!encontrado && raw.length >= 2) {
        encontrado = fuente.find((item: any) => {
          const codigo = (item.codigo ?? '').toString().toLowerCase();
          return codigo.startsWith(term);
        });
      }
      return encontrado ?? null;
  }

  private aplicarResultadoBusquedaCodigo(encontrado: any | null): void {
      if (encontrado) {
        this.agregarAlCarrito(encontrado);
        this.searchCodigo = '';
        this.enfocarEscannerCodigo();
      } else {
        iziToast.show({
          title: 'ERROR',
          titleColor: '#FF0000',
          color: '#f39999ff',
          class: 'text-danger',
          position: 'topRight',
          message: 'El código no existe.'
        });
        this.searchCodigo = '';
        this.enfocarEscannerCodigo();
      }
  }



  actualizaTotales(): void {
    this.ventas.subTotal = 0;
    this.ventas.descuentos = 0;
    this.ventas.exonerado = 0;
    this.ventas.igv = 0;
    this.ventas.isc = 0;
    this.ventas.impuestosDetalle = [];
    this.ventas.igvPorcentaje = 0;
    this.ventas.igvMonto = 0;
    this.ventas.total = 0;

    this.carrito.forEach(item => {
      const cant = Number(item.cantidad) || 0;
      const pVenta = Number(item.pVenta) || 0;
      const aplicarDescuentoLinea = this.aplicaDescuentoEnTotalLinea(item);

      if (aplicarDescuentoLinea) {
        const precioPrincipal = this.obtenerPrecioPrincipal(item);
        const subtotalItem = Math.round(precioPrincipal * cant * 100) / 100;
        this.ventas.subTotal += subtotalItem;
        if (precioPrincipal > pVenta) {
          this.ventas.descuentos += Math.round((precioPrincipal - pVenta) * cant * 100) / 100;
        }
      } else {
        const subtotalItem = Math.round(pVenta * cant * 100) / 100;
        this.ventas.subTotal += subtotalItem;
      }
    });

    this.ventas.subTotal = Math.round(this.ventas.subTotal * 100) / 100;
    this.ventas.descuentos = Math.round(this.ventas.descuentos * 100) / 100;
    const neto = Math.round((this.ventas.subTotal - this.ventas.descuentos) * 100) / 100;

    const tieneIGV = this.impuestosActivosEmpresa.some((i: Impuesto) => (i.descripcion || '').toUpperCase().includes('IGV'));
    if (tieneIGV) {
      this.ventas.exonerado = 0;
    } else {
      this.ventas.exonerado = neto;
    }
    const baseGravada = neto;

    const igvImpuesto = this.impuestosActivosEmpresa.find((i: Impuesto) => (i.descripcion || '').toUpperCase().includes('IGV'));
    if (igvImpuesto) {
      this.ventas.igvPorcentaje = Number(igvImpuesto.porcentaje) || 0;
      this.ventas.igvMonto = Math.round(baseGravada * (this.ventas.igvPorcentaje / 100) * 100) / 100;
      const pIncluyeIGV = !!igvImpuesto.pIncluyeIGV;
      if (!pIncluyeIGV) {
        this.ventas.igv = this.ventas.igvMonto;
      }
    }

    const otrosImpuestos = this.impuestosActivosEmpresa.filter((i: Impuesto) => {
      const d = (i.descripcion || '').toUpperCase();
      return !d.includes('IGV') && d !== 'EXO';
    });
    let totalImpuestosASumar = this.ventas.igv;
    this.ventas.impuestosDetalle = otrosImpuestos.map((imp: Impuesto) => {
      const porcentaje = Number(imp.porcentaje) || 0;
      const monto = Math.round(baseGravada * (porcentaje / 100) * 100) / 100;
      const pIncluyeIGV = !!imp.pIncluyeIGV;
      const esISC = (imp.descripcion || '').toUpperCase().includes('ISC');
      if (esISC || !pIncluyeIGV) {
        totalImpuestosASumar += monto;
      }
      return { descripcion: imp.descripcion || 'Impuesto', porcentaje, monto, pIncluyeIGV };
    });
    this.ventas.isc = this.ventas.impuestosDetalle
      .filter((i: { descripcion: string }) => (i.descripcion || '').toUpperCase().includes('ISC'))
      .reduce((s: number, i: { monto: number }) => s + i.monto, 0);
    this.ventas.total = Math.round((baseGravada + totalImpuestosASumar) * 100) / 100;
    this.guardarEstadoProvisional();
  }

  private impuestoEstaActivo(impuesto: Impuesto): boolean {
    const estado: unknown = (impuesto as { estado?: unknown })?.estado;
    if (estado === true || estado === 1) return true;
    if (estado === false || estado === 0 || estado == null) return false;
    const s = String(estado).trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'activo' || s === 'activa';
  }

  eliminarDelCarrito(index: number): void {
    this.carrito.splice(index, 1);
    this.actualizaTotales();
  }

  actualizaPrecio(item: any, el: any): void {
    const raw = (el.target?.innerText ?? '').replace(/[^\d.,]/g, '').replace(',', '.').trim();
    const nuevo = parseFloat(raw);
    if (!isNaN(nuevo) && nuevo >= 0) {
      item.pVenta = nuevo;
    }
    this.actualizaTotales();
  }

 obtenerPrecioPrincipal(item: any): number {
  if (!item.precios || typeof item.precios !== 'object') {
    return item.precio || 0;
  }

  const listaPrincipal = Object.values(item.precios).find(
    (p: any) => p.principal === true
  );

  //return listaPrincipal ? listaPrincipal.precio : item.precio || 0;
  return listaPrincipal ? (listaPrincipal as any).precio : item.pVenta || 0;
}

  private aplicaDescuentoEnTotalLinea(item: { idEmpresa?: string | null }): boolean {
    if (!this.descuentoEnTotalConfigListo) return false;
    if (!this.esGestora) return this.usarDescuentoEnTotal;
    const idJwt = this.idEmpresaOperacionJwt().toLowerCase();
    const idEmp =
      item?.idEmpresa != null && String(item.idEmpresa).trim() !== ''
        ? String(item.idEmpresa).trim().toLowerCase()
        : idJwt;
    if (this.descuentoPorEmpresa.has(idEmp)) {
      return this.descuentoPorEmpresa.get(idEmp)!;
    }
    return this.usarDescuentoEnTotal;
  }

  private cargarDescuentoPorEmpresaGestora(): void {
    this.gestoresService.obtenerDescuentoVentaPorEmpresas().subscribe({
      next: (res) => {
        const data = res?.data ?? {};
        this.descuentoPorEmpresa.clear();
        for (const [idEmpresa, activo] of Object.entries(data)) {
          this.descuentoPorEmpresa.set(String(idEmpresa).trim().toLowerCase(), !!activo);
        }
        this.actualizaTotales();
      },
      error: () => {}
    });
  }

/**
 * Abre el modal de selección de precios
 */
abrirModalPrecios(item: any) {
    const opcionesPrecios = Object.values(item.precios || {}).map((precio: any) => ({
      ...precio,
      idProducto: item.idProducto
    }));

    this.modalService.open(ModalPreciosComponent, {
      size: 'sm',
      backdrop: 'static'
    }, {
      precios: opcionesPrecios,
      precioActual: this.obtenerPrecioPrincipal(item)
      
    }).subscribe({
      next: (precioSeleccionado: any) => {
        if (precioSeleccionado) {
          item.pVenta = precioSeleccionado.precio;
          this.actualizaTotales(); // Recalcula totales si aplica
                            }
      },
      error: () => {
        // Modal cerrado sin selección
      }
    });

  }

  actualizaCantidad(item: any, el: any) {
    const raw = (el.target?.innerText ?? '')
      .replace(/[^\d.,\-]/g, '')
      .replace(',', '.')
      .trim();
    let nuevo = parseFloat(raw);
    if (Number.isNaN(nuevo) || nuevo < 0) {
      nuevo = Number(item.cantidad) || 0;
    }
    item.cantidad = Math.round(nuevo * 1e6) / 1e6;
    this.enriquecerLineaCarritoDesdeCatalogo(item);
    this.actualizaTotales();
  }

  private descripcionLineaParaDetalle(item: {
    permiteDescripcionEnVenta?: boolean;
    descripcion?: string;
    descripcionOriginal?: string;
  }): string | undefined {
    if (!item.permiteDescripcionEnVenta) return undefined;
    const cur = (item.descripcion ?? '').toString().trim();
    const orig = (item.descripcionOriginal ?? '').toString().trim();
    if (!cur || cur === orig) return undefined;
    return cur.length > 500 ? cur.slice(0, 500) : cur;
  }

  actualizaDescripcion(item: any, el: any) {
    if (!item.permiteDescripcionEnVenta) {
      return;
    }
    // Obtener el texto editado y normalizar
    const texto = ((el.target as HTMLElement)?.innerText ?? '').trim();

    // Asignar la descripción al objeto correcto:
    // si el item tiene la propiedad 'producto', actualizar producto.descripcion,
    // si no, guardar en item.descripcion (por compatibilidad).
    if (item.producto) {
      item.producto.descripcion = texto;
    } else {
      item.descripcion = texto;
    }
  }
  

  onInputChangesCompventas() {
      }

  limpiarCliente() {}

  /** Valor a mostrar en Razón Social / Nombre (soporta distintas claves del API). */
  getRazonSocialDisplay(): string {
    const c = this.cliente;
    if (!c) return '';
    return (c.rSocial ?? c.r_Social ?? c.rsocial ?? c.nombre_o_razon_social ?? c.razonSocial ?? c.RazonSocial ?? '').toString().trim();
  }

  /** True si hay cliente elegido: con idCliente (BD/lista) o con documento y razón social (se creará al registrar). */
  tieneClienteParaVenta(): boolean {
    if (!this.cliente) return false;
    if (this.cliente.idCliente != null && this.cliente.idCliente !== '' && this.cliente.idCliente !== 0) return true;
    const ruc = (this.cliente.ruc ?? '').toString().trim();
    const nombre = this.getRazonSocialDisplay();
    return ruc.length > 0 && nombre.length > 0;
  }

  /**
   * Busca cliente: primero en BD por número de documento; si no existe, consulta API Factiliza (RUC/DNI).
   */
  buscarDocumentoCliente(): void {
    const numero = (this.cliente.ruc ?? '').toString().trim();
    const idDoc = this.ventas.idDocumento;
    if (!numero) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese el número de documento.', position: 'topRight' });
      return;
    }
    if (idDoc === this.ID_DOC_RUC && numero.length !== 11) {
      iziToast.warning({ title: 'Aviso', message: 'El RUC debe tener 11 dígitos.', position: 'topRight' });
      return;
    }
    if (idDoc === this.ID_DOC_DNI && numero.length !== 8) {
      iziToast.warning({ title: 'Aviso', message: 'El DNI debe tener 8 dígitos.', position: 'topRight' });
      return;
    }
    this.clienteBuscando = true;
    this._clienteService.obtener_cliente_ruc(numero).subscribe({
      next: (response) => {
        if (response.data != null && response.data.length > 0) {
          const row = response.data[0];
          this.cliente = {
            idCliente: row.idCliente,
            idDocumento: row.idDocumento,
            ruc: row.ruc,
            rSocial: (row.rSocial ?? row.r_Social ?? row.rsocial ?? row.razonSocial ?? row.RazonSocial ?? '').toString().trim(),
            direccion: (row.direccion ?? '').toString(),
            correo: row.correo ?? '',
            celular: row.celular ?? '',
            condicion: row.condicion ?? 'ACTIVO',
            sujetoCredito: row.sujetoCredito === true || row.sujetoCredito === 1,
            lineaCredito: row.lineaCredito != null && !isNaN(Number(row.lineaCredito)) ? Number(row.lineaCredito) : undefined
          };
                    this._clienteService.obtener_direccionesCliente_idCliente(this.cliente.idCliente).subscribe({
            next: (dirRes) => {
              this.aplicarPrimeraDireccionClienteAlContexto(dirRes);
              this.clienteBuscando = false;
            },
            error: () => { this.clienteBuscando = false; }
          });
          iziToast.success({ title: 'OK', message: 'Cliente encontrado en base de datos.', position: 'topRight' });
        } else {
          this.consultarDocumentoApi(numero, idDoc);
        }
      },
      error: () => {
        this.clienteBuscando = false;
        iziToast.error({ title: 'Error', message: 'Error al buscar en base de datos.', position: 'topRight' });
      }
    });
  }

  private consultarDocumentoApi(numero: string, idDoc: string): void {
    const isRuc = idDoc === this.ID_DOC_RUC;
    const obs = isRuc ? this._factilizaService.getRuc(numero) : this._factilizaService.getDni(numero);
    obs.subscribe({
      next: (response: any) => {
        const data = response.data ?? response;
        const rSocial = (data.nombre_o_razon_social ?? data.razonSocial ?? data.nombre ?? data.razon_social ?? '').toString().trim();
        const nombreCompletoDni = data.apellidoPaterno != null
          ? `${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''} ${data.nombres || ''}`.trim()
          : (data.nombres ?? '');
        const direccion = (data.direccion_completa ?? data.direccion ?? data.direccionCompleta ?? '').toString().trim();
        this.cliente = {
          idCliente: '',
          idDocumento: idDoc,
          ruc: (data.numero ?? numero).toString().trim(),
          rSocial: rSocial || nombreCompletoDni || '',
          direccion,
          correo: this.cliente?.correo ?? '',
          celular: (this.cliente?.celular ?? data.celular ?? '').toString(),
          condicion: (data.condicion ?? data.estado ?? 'ACTIVO').toString()
        };
        this.clienteBuscando = false;
                iziToast.info({ title: 'Info', message: 'Cliente no registrado. Se creará al registrar la venta.', position: 'topRight' });
      },
      error: (err) => {
        this.clienteBuscando = false;
        const msg = err?.error?.message ?? (isRuc ? 'RUC no encontrado.' : 'DNI no encontrado.');
        iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
      }
    });
  }

  clienteSeleccionado(event: any): void {
    const e = event || {};
    this.cliente = {
      idCliente: e.idCliente,
      idDocumento: e.idDocumento,
      ruc: e.ruc,
      rSocial: (e.rSocial ?? e.r_Social ?? e.rsocial ?? e.razonSocial ?? e.RazonSocial ?? '').toString().trim(),
      direccion: (e.direccion ?? '').toString(),
      correo: e.correo ?? '',
      celular: e.celular ?? '',
      condicion: e.condicion ?? 'ACTIVO',
      sujetoCredito: e.sujetoCredito === true || e.sujetoCredito === 1,
      lineaCredito: e.lineaCredito != null && !isNaN(Number(e.lineaCredito)) ? Number(e.lineaCredito) : undefined
    };
    const modalEl = document.getElementById('clientesModal');
    const modalInst = bootstrap.Modal.getInstance(modalEl as HTMLElement);
    modalInst?.hide();
    if (this.cliente.idCliente != null && this.cliente.idCliente !== '' && this.cliente.idCliente !== 0) {
      this._clienteService.obtener_direccionesCliente_idCliente(this.cliente.idCliente).subscribe({
        next: (dirRes) => {
          this.aplicarPrimeraDireccionClienteAlContexto(dirRes);
        },
        error: () => {}
      });
    }
    this.guardarEstadoProvisional();
  }

  /**
   * Consulta en BD por RUC/DNI: si existe carga los datos del cliente; si no existe abre el modal
   * create-clientes con tipo doc y número pre-cargados. Al registrar y cerrar el modal, vuelve a
   * consultar la BD y carga los datos.
   */
  buscarORegistrarCliente(): void {
    const digitos = this.normalizarDigitosDocumentoCliente((this.cliente.ruc ?? '').toString());
    if (!digitos) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese el número de documento (RUC o DNI).', position: 'topRight' });
      return;
    }
    const inferido = this.inferirIdDocumentoPorLongitudDigitos(digitos);
    if (inferido == null) {
      iziToast.warning({
        title: 'Aviso',
        message: 'Ingrese 8 dígitos (DNI) u 11 dígitos (RUC).',
        position: 'topRight'
      });
      return;
    }
    this.ventas.idDocumento = inferido;
    this.cliente.ruc = digitos;

    this.clienteBuscando = true;
    this._clienteService.obtener_cliente_ruc(digitos).subscribe({
      next: (response) => {
        if (response.data != null && response.data.length > 0) {
          this.aplicarClienteDesdeBd(response.data[0]);
          this.clienteBuscando = false;
          iziToast.success({ title: 'OK', message: 'Cliente encontrado en base de datos.', position: 'topRight' });
        } else {
          this.clienteBuscando = false;
          this.crearClientePreSerial += 1;
          this.abrirModalCrearCliente();
        }
      },
      error: () => {
        this.clienteBuscando = false;
        iziToast.error({ title: 'Error', message: 'Error al consultar en base de datos.', position: 'topRight' });
      }
    });
  }

  /** Aplica los datos del cliente desde un registro de BD (y carga direcciones). */
  private aplicarClienteDesdeBd(row: any): void {
    this.cliente = {
      idCliente: row.idCliente,
      idDocumento: row.idDocumento,
      ruc: row.ruc,
      rSocial: (row.rSocial ?? row.r_Social ?? row.rsocial ?? row.razonSocial ?? row.RazonSocial ?? '').toString().trim(),
      direccion: (row.direccion ?? '').toString(),
      correo: row.correo ?? '',
      celular: row.celular ?? '',
      condicion: row.condicion ?? 'ACTIVO',
      sujetoCredito: row.sujetoCredito === true || row.sujetoCredito === 1,
      lineaCredito: row.lineaCredito != null && !isNaN(Number(row.lineaCredito)) ? Number(row.lineaCredito) : undefined
    };
    this._clienteService.obtener_direccionesCliente_idCliente(this.cliente.idCliente).subscribe({
      next: (dirRes) => {
        this.aplicarPrimeraDireccionClienteAlContexto(dirRes);
      },
      error: () => {}
    });
    this.guardarEstadoProvisional();
  }

  /** Solo dígitos del campo número (RUC/DNI). */
  private normalizarDigitosDocumentoCliente(raw: string): string {
    return (raw ?? '').toString().replace(/\D/g, '');
  }

  /** idDocumento catálogo: RUC=6 (11 dígitos), DNI=1 (8 dígitos). */
  private inferirIdDocumentoPorLongitudDigitos(digitos: string): string | null {
    if (digitos.length === 11) return this.ID_DOC_RUC;
    if (digitos.length === 8) return this.ID_DOC_DNI;
    return null;
  }

  /** Abre el modal de crear cliente con tipo doc y número pre-cargados (desde venta). */
  abrirModalCrearCliente(): void {
    const modalEl = document.getElementById('modalCrearCliente');
    if (!modalEl) return;
    setTimeout(() => {
      const modalInst = (window as any).bootstrap?.Modal?.getOrCreateInstance(modalEl);
      modalInst?.show();
    }, 0);
  }

  /** Cuando se registra el cliente desde el modal create-clientes: cierra el modal y vuelve a consultar la BD para cargar los datos. */
  onClienteCreadoDesdeModal(event: any): void {
    const modalEl = document.getElementById('modalCrearCliente');
    const modalInst = bootstrap?.Modal?.getInstance?.(modalEl as HTMLElement) ?? (window as any).bootstrap?.Modal?.getInstance?.(modalEl);
    modalInst?.hide();
    const numero = (event?.ruc ?? this.cliente?.ruc ?? '').toString().trim();
    if (!numero) {
      this.guardarEstadoProvisional();
      return;
    }
    this.clienteBuscando = true;
    this._clienteService.obtener_cliente_ruc(numero).subscribe({
      next: (response) => {
        this.clienteBuscando = false;
        if (response?.data != null && response.data.length > 0) {
          this.aplicarClienteDesdeBd(response.data[0]);
          iziToast.success({ title: 'OK', message: 'Cliente registrado y cargado.', position: 'topRight' });
        } else {
          this.cliente = {
            idCliente: event?.idCliente,
            idDocumento: event?.idDocumento ?? this.ventas.idDocumento,
            ruc: numero,
            rSocial: (event?.rSocial ?? event?.r_Social ?? '').toString().trim(),
            direccion: (event?.direccion ?? '').toString(),
            correo: event?.correo ?? '',
            celular: event?.celular ?? '',
            condicion: event?.condicion ?? 'ACTIVO'
          };
          this.guardarEstadoProvisional();
        }
      },
      error: () => {
        this.clienteBuscando = false;
        this.cliente = {
          idCliente: event?.idCliente,
          idDocumento: event?.idDocumento ?? this.ventas.idDocumento,
          ruc: numero,
          rSocial: (event?.rSocial ?? event?.r_Social ?? '').toString().trim(),
          direccion: (event?.direccion ?? '').toString(),
          correo: event?.correo ?? '',
          celular: event?.celular ?? '',
          condicion: event?.condicion ?? 'ACTIVO'
        };
        this.guardarEstadoProvisional();
      }
    });
  }

  abrirModalEditarClienteCredito(): void {
    const id = Number(this.cliente?.idCliente);
    if (!id) {
      iziToast.warning({ title: 'Aviso', message: 'Busque un cliente registrado antes de editar línea de crédito.' });
      return;
    }
    this.loadingEditClienteCredito = true;
    this._clienteService.obtener_cliente_id(id).subscribe({
      next: (res: any) => {
        const row = Array.isArray(res?.data) ? res.data[0] : res?.data;
        if (!row) {
          this.loadingEditClienteCredito = false;
          iziToast.error({ title: 'Error', message: 'No se encontró el cliente.' });
          return;
        }
        this.editClienteCreditoForm = {
          sujetoCredito: row.sujetoCredito === true || row.sujetoCredito === 1,
          lineaCredito: row.lineaCredito != null ? Number(row.lineaCredito) : 0
        };
        this.loadingEditClienteCredito = false;
        const el = document.getElementById('modalEditarClienteCredito');
        if (el) {
          bootstrap.Modal.getOrCreateInstance(el as HTMLElement).show();
        }
      },
      error: () => {
        this.loadingEditClienteCredito = false;
        iziToast.error({ title: 'Error', message: 'No se pudieron cargar los datos del cliente.' });
      }
    });
  }

  guardarLineaCreditoClienteDesdeVenta(): void {
    const id = Number(this.cliente?.idCliente);
    if (!id) return;
    this.loadingEditClienteCredito = true;
    const payload = {
      idDocumento: String(this.cliente.idDocumento ?? this.ventas.idDocumento ?? '1'),
      ruc: String(this.cliente.ruc ?? '').trim(),
      rSocial: String(this.cliente.rSocial ?? '').trim(),
      correo: this.cliente.correo ?? '',
      celular: this.cliente.celular ?? '',
      condicion: this.cliente.condicion ?? 'ACTIVO',
      sujetoCredito: this.editClienteCreditoForm.sujetoCredito,
      lineaCredito: Math.max(0, Number(this.editClienteCreditoForm.lineaCredito) || 0)
    };
    this._clienteService.editar_cliente(id, payload).subscribe({
      next: (res: any) => {
        this.loadingEditClienteCredito = false;
        const row = res?.data?.[0] ?? res?.data;
        if (row) {
          this.cliente.sujetoCredito = row.sujetoCredito === true || row.sujetoCredito === 1;
          this.cliente.lineaCredito = row.lineaCredito != null ? Number(row.lineaCredito) : 0;
        } else {
          this.cliente.sujetoCredito = payload.sujetoCredito;
          this.cliente.lineaCredito = payload.lineaCredito;
        }
        iziToast.success({ title: 'Listo', message: 'Cliente actualizado.' });
        const el = document.getElementById('modalEditarClienteCredito');
        bootstrap.Modal.getInstance(el as HTMLElement)?.hide();
        this.guardarEstadoProvisional();
      },
      error: (err) => {
        this.loadingEditClienteCredito = false;
        iziToast.error({ title: 'Error', message: err?.error?.message ?? 'No se pudo guardar.' });
      }
    });
  }


//  idFormaPago: number;
//   descripcion:string,
//   tipo:number,
//   reqRef:number,
//   recibido: number;
//   vuelto: number;
//   referencia: string;
 
  // Propiedad
  forma: FormaPago = {
    idFormaPago: 1,
    descripcion:'',
    tipo:0,
    requiereReferencia:0,   // efectivo por defecto
    recibido:0,
    activo: 0,
    vuelto: 0,
    referencia: ''
  };


  // Métodos
  calculaVuelto(): void {
    this.forma.vuelto = Math.max(0, this.forma.recibido ?? 0 - this.ventas.total);
  }

  resetCalculos(): void {
    this.forma.recibido = 0;
    this.forma.vuelto   = 0;
    this.forma.referencia = '';
  }

  //pago
  deudaTotal: number = this.ventas.total; // Asigna con tu valor real
  pagaCon: number = 0;
  vuelto: number = 0;

  // Formulario de detalle
  detailForm = {
    formaPago: 'Efectivo',
    monto: 0,
    referencia: ''
  };

  // Calcular vuelto cuando cambia "Paga Con"
  calcularVuelto(): void {
    this.vuelto = this.pagaCon - this.ventas.total;
  }

  // Calcular total de la tabla
  calcularTotalTabla(): number {
    return this.detallePago.reduce(
      (sum: number, item: { monto?: unknown }) => sum + (Number(item.monto) || 0),
      0
    );
  }

  // Agregar detalle (guardamos idFormaPago para enviar como idMediosPago al API)
  /** Si ya existe una fila con la misma forma de pago, suma el monto; si no, agrega fila nueva. */
  agregarDetalle(): void {
    const monto = Math.round((Number(this.detailForm.monto) || 0) * 100) / 100;
    const idForma = this.formaPagoSeleccionada?.idFormaPago != null ? Number(this.formaPagoSeleccionada.idFormaPago) : 0;
    if (monto <= 0 || !idForma) return;

    const desc = this.formasPago.find((f: FormaPago) => Number(f.idFormaPago) === idForma)?.descripcion || 'Pago';
    const ref = (this.detailForm.referencia || '').trim() || 'N/A';

    const existente = this.detallePago.find((d: { idFormaPago?: unknown }) => Number(d.idFormaPago) === idForma);
    if (existente) {
      existente.monto = Math.round(((Number(existente.monto) || 0) + monto) * 100) / 100;
    } else {
      this.detallePago.push({
        item: this.detallePago.length + 1,
        idFormaPago: idForma,
        descripcion: desc,
        monto,
        referencia: ref
      });
      this.detallePago.forEach((item: { item: number }, idx: number) => {
        item.item = idx + 1;
      });
    }

    this.detailForm.referencia = '';
    this.actualizarMontoSaldo();
    this.guardarEstadoProvisional();
  }

  // Eliminar detalle
  eliminarDetalle(index: number): void {
    this.detallePago.splice(index, 1);
    this.detallePago.forEach((item: { item: any; }, idx: number) => item.item = idx + 1);
    this.actualizarMontoSaldo();
  }

  /** Monto editable en la tabla del modal: redondea a 2 decimales y no permite negativos. */
  normalizarMontoDetallePago(detalle: { monto?: unknown }): void {
    const n = Math.round((Number(detalle.monto) || 0) * 100) / 100;
    detalle.monto = n < 0 ? 0 : n;
    this.actualizarMontoSaldo();
    this.guardarEstadoProvisional();
  }

  /** Mientras se edita el monto en la tabla, el input “Monto” del formulario muestra el saldo pendiente. */
  onMontoTablaDetallePagoChange(): void {
    this.actualizarMontoSaldo();
  }

  /** Saldo pendiente = total venta − total ya registrado. Redondeado a 2 decimales. */
  getSaldoPendiente(): number {
    const total = Number(this.ventas.total) || 0;
    const pendiente = Math.max(0, total - this.calcularTotalTabla());
    return Math.round(pendiente * 100) / 100;
  }

  /** Actualiza el campo monto del detalle para que siempre muestre el saldo pendiente (2 decimales). */
  actualizarMontoSaldo(): void {
    this.detailForm.monto = this.getSaldoPendiente();
  }

  /**
   * Si aún no hay líneas, agrega una fila EFECTIVO por el total de la venta.
   * No aplica en pago PENDIENTE + condición crédito corriente (el backend arma la línea fiado).
   */
  private aplicarDetallePagoEfectivoPorDefectoSiVacio(): void {
    if (this.detallePago.length > 0) return;
    const idEstadoPago = Number(this.ventas.idEstadoPago) || 2;
    if (idEstadoPago === 1 && this.cabeceraEsCreditoFinanciacion()) return;
    const total = Math.round((Number(this.ventas.total) || 0) * 100) / 100;
    if (total <= 0) return;
    const efectivo = this.formasPago.find(
      (f: FormaPago) => (f.descripcion || '').trim().toUpperCase() === 'EFECTIVO'
    );
    if (!efectivo?.idFormaPago) return;
    const idForma = Number(efectivo.idFormaPago);
    this.detallePago.push({
      item: 1,
      idFormaPago: idForma,
      descripcion: efectivo.descripcion || 'EFECTIVO',
      monto: total,
      referencia: 'N/A'
    });
  }

  /** Al abrir el modal Forma de pago: selecciona Efectivo, fila por defecto con el total (si aplica) y sincroniza resumen. */
  abrirModalPago(): void {
    if (!this.validarAntesDeCobrar()) {
      return;
    }
    const efectivo = this.formasPago.find(
      (f: FormaPago) => (f.descripcion || '').trim().toUpperCase() === 'EFECTIVO'
    );
    if (efectivo) {
      this.formaPagoSeleccionada = { ...efectivo };
    }
    this.aplicarDetallePagoEfectivoPorDefectoSiVacio();
    this.actualizarMontoSaldo();
    const total = Number(this.ventas.total) || 0;
    this.pagaCon = total;
    this.calcularVuelto();
  }

  guardarPago(): void {
    const modalEl = document.getElementById('modalPago');
    const inst = bootstrap.Modal.getInstance(modalEl as HTMLElement);
    inst?.hide();
    this.registrarVenta();
    
  }

  /** Normaliza texto para detectar "crédito" aunque venga con tilde (FormasPago / MediosPago). */
  private descripcionEsCredito(texto: string | undefined | null): boolean {
    const d = (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return d.includes('credito');
  }

  /** True si el medio (MediosPago) es crédito por descripción o código SUNAT 010. */
  private medioPagoEsCredito(m: { descripcion?: string; codigo?: string } | undefined): boolean {
    if (!m) return false;
    return this.descripcionEsCredito(m.descripcion || '') || ['010', '10'].includes(String(m.codigo || '').trim());
  }

  /** Tarjeta de crédito/débito: no cuenta como crédito corriente (línea cliente / cobranza cuotas). */
  private descripcionIndicaTarjeta(texto: string | undefined | null): boolean {
    const d = (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return d.includes('tarjeta');
  }

  /** Crédito corriente / fiado (SUNAT 010), excluye tarjeta crédito. */
  private medioPagoEsCreditoFinanciacion(m: { descripcion?: string; codigo?: string } | undefined): boolean {
    if (!m) return false;
    if (this.descripcionIndicaTarjeta(m.descripcion || '')) return false;
    return this.descripcionEsCredito(m.descripcion || '') || ['010', '10'].includes(String(m.codigo || '').trim());
  }

  /** Condición de pago de cabecera = crédito corriente (no tarjeta). */
  cabeceraEsCreditoFinanciacion(): boolean {
    const idCab = Number(this.ventas.idMediosPago);
    const m = this.mediosPago.find((x: any) => Number(x.idMediosPago) === idCab);
    return this.medioPagoEsCreditoFinanciacion(m);
  }

  /** Alias para validación SUNAT en factura/boleta. */
  cabeceraEsMedioCredito(): boolean {
    return this.cabeceraEsCreditoFinanciacion();
  }

  /** True si el comprobante seleccionado es electrónico (01 Factura, 03 Boleta, 07 NC, 08 ND). */
  esComprobanteElectronico(): boolean {
    const id = this.ventas?.idComprobante;
    if (id == null || id === '') return false;
    const comp = this.comprobantes?.find((c: any) => Number(c.idComprobante) === Number(id));
    const codigo = String(comp?.codigo ?? '').trim();
    return ['01', '03', '07', '08', 'F7', 'B7', 'F8', 'B8'].includes(codigo);
  }

  /** True si el comprobante seleccionado es Cotización (CT). */
  esCotizacion(): boolean {
    const id = this.ventas?.idComprobante;
    if (id == null || id === '') return false;
    const comp = this.comprobantes?.find((c: any) => Number(c.idComprobante) === Number(id));
    const codigo = String(comp?.codigo ?? '').trim().toUpperCase();
    return codigo === 'CT';
  }

  /** Registra la venta completa. Si el cliente no tiene idCliente, lo crea antes en BD. */
  registrarVenta(): void {
    if (!this.validarAntesDeCobrar()) {
      return;
    }
    if (this.carrito.length === 0) {
      iziToast.warning({ title: 'Advertencia', message: 'Agregue al menos un producto al carrito.' });
      return;
    }
    const lineaAjena = this.carrito.find((ln) => !this.productoPerteneceEmpresaOperativa(ln));
    if (lineaAjena) {
      iziToast.warning({
        title: 'Producto no permitido',
        message: `«${(lineaAjena.descripcion || lineaAjena.codigo || '').toString().trim()}» no pertenece a su empresa. Elimínelo del carrito y vuelva a buscar.`
      });
      return;
    }
    if (!this.ventas.idComprobante) {
      iziToast.warning({ title: 'Advertencia', message: 'Seleccione tipo de comprobante (Datos del Comprobante).' });
      return;
    }
    if (this.bloqueoPorSucursalUsuario) {
      iziToast.warning({
        title: 'Sucursal no asignada',
        message: 'Su usuario no tiene sucursales asignadas o activas. Solicite al administrador su asignación.'
      });
      return;
    }
    if (!this.ventas.idSucursal && this.sucursales.length > 0) {
      this.ventas.idSucursal = this.sucursales[0].idSucursal;
    }
    this.aplicarSucursalConCajaAbiertaPreferida();
    if (!this.ventas.idSucursal) {
      iziToast.warning({ title: 'Advertencia', message: 'No se pudo determinar la sucursal. Abra una caja o configure sucursales.' });
      return;
    }
    /** Cotización (CT) no usa caja ni movimientos; no exigir caja abierta (evita falso error en gestora con sucursal de empresa hija). */
    if (!this.esCotizacion() && !this.tieneCajaAbiertaEnSucursal(this.ventas.idSucursal)) {
      const abiertas = (this.cajas || [])
        .filter((c) => this.esCajaConAperturaActiva(c))
        .map((c) => (c.sucursal || c.nombre || '').trim())
        .filter(Boolean);
      const detalleAbiertas = abiertas.length
        ? ` Cajas abiertas en: ${[...new Set(abiertas)].join(', ')}.`
        : '';
      iziToast.warning({
        title: 'Caja requerida',
        message:
          'No hay una caja abierta para la sucursal del comprobante. En Caja → Gestión de cajas, abra caja en la sucursal donde vende (empresa gestionada, no la gestora).' +
          detalleAbiertas
      });
      return;
    }
    const ruc = (this.cliente?.ruc ?? '').toString().trim();
    const rSocial = (this.cliente?.rSocial ?? '').toString().trim();
    let idCliente = this.cliente?.idCliente != null ? Number(this.cliente.idCliente) : null;
    if (idCliente == null || idCliente === 0) {
      if (!ruc || !rSocial) {
        iziToast.warning({ title: 'Advertencia', message: 'Complete información del cliente (número y razón social).' });
        return;
      }
      this.crearClienteYRegistrarVenta();
      return;
    }

    const totalVenta = Number(this.ventas.total) || 0;
    const totalPago = this.calcularTotalTabla();
    const idEstadoPago = Number(this.ventas.idEstadoPago) || 2;
    const esPagoPendiente = idEstadoPago === 1;
    if (!this.esCotizacion() && !esPagoPendiente && totalPago > 0 && Math.abs(totalPago - totalVenta) > 0.01) {
      iziToast.warning({ title: 'Advertencia', message: 'El total del detalle de pago no coincide con el total de la venta.' });
      return;
    }
    if (this.esCotizacion()) {
      this.enviarCotizacion(idCliente);
      return;
    }
    const totalCredit = this.getMontoCreditoVenta();
    if (
      totalCredit > 0.01 &&
      Number(this.ventas.idEstadoPago) === 1 &&
      this.calcularTotalTabla() < 0.01 &&
      (this.esFacturaOBoletaVenta() || this.esNotaVentaVenta()) &&
      this.cabeceraEsCreditoFinanciacion() &&
      !this.mediosPago.some((m: any) => this.medioPagoEsCreditoFinanciacion(m))
    ) {
      iziToast.warning({
        title: 'Medios de pago',
        message:
          'Para venta al crédito corriente con pago PENDIENTE debe existir un medio de pago tipo CRÉDITO (código SUNAT 010), no solo tarjeta. Revise el catálogo Medios de pago.'
      });
      return;
    }
    if (totalCredit > 0.01 && this.esFacturaOBoletaVenta() && !this.cabeceraEsMedioCredito()) {
      iziToast.warning({
        title: 'Condición de pago (SUNAT)',
        message:
          'En factura o boleta con monto al crédito corriente, en Datos del comprobante elija la condición de pago CRÉDITO (código SUNAT 010), no tarjeta.'
      });
      return;
    }
    if (totalCredit > 0.01 && idCliente != null && idCliente !== 0 && !this.asegurarCuotasCreditoSiCorresponde()) {
      return;
    }
    if (totalCredit > 0 && (idCliente == null || idCliente === 0)) {
      iziToast.warning({
        title: 'Venta al crédito',
        message: 'No puede registrar una venta al crédito para un cliente nuevo. Los clientes nuevos no están habilitados para crédito. Cree primero el cliente, en Editar marque "Sujeto a crédito" y asigne una línea de crédito, luego registre la venta.'
      });
      return;
    }
    if (totalCredit > 0 && idCliente) {
      this.validarYEnviarVentaAlCredito(idCliente, totalCredit);
      return;
    }
    this.enviarVentaConCliente(idCliente);
  }

  /**
   * Suma montos del detalle que son crédito corriente / fiado (excluye tarjeta). Usado para línea de crédito del cliente y cuotas.
   */
  getTotalVentaAlCredito(): number {
    let sum = 0;
    for (const d of this.detallePago) {
      const monto = Number(d.monto) || 0;
      if (monto <= 0) continue;
      const id = Number(d.idMediosPago ?? d.idFormaPago);
      const medio = this.mediosPago.find((m: any) => Number(m.idMediosPago) === id);
      if (this.medioPagoEsCreditoFinanciacion(medio)) {
        sum += monto;
        continue;
      }
      const forma = this.formasPago.find((f: FormaPago) => Number(f.idFormaPago) === id);
      if (
        forma &&
        this.descripcionEsCredito(forma.descripcion || '') &&
        !this.descripcionIndicaTarjeta(forma.descripcion || '')
      ) {
        sum += monto;
        continue;
      }
      if (
        this.descripcionEsCredito(d.descripcion || '') &&
        !this.descripcionIndicaTarjeta(d.descripcion || '')
      ) {
        sum += monto;
      }
    }
    return Math.round(sum * 100) / 100;
  }

  /**
   * Monto que cuenta como crédito corriente: líneas en formas de pago, o pago PENDIENTE solo si la condición de cabecera ya es CRÉDITO (010 / fiado), nunca con CONTADO ni tarjeta.
   */
  getMontoCreditoVenta(): number {
    const desdeDetalle = this.getTotalVentaAlCredito();
    if (desdeDetalle > 0.01) return desdeDetalle;
    const idEstadoPago = Number(this.ventas.idEstadoPago) || 2;
    if (idEstadoPago !== 1) return 0;
    if (!this.cabeceraEsCreditoFinanciacion()) return 0;
    const total = Math.round((Number(this.ventas.total) || 0) * 100) / 100;
    if (total <= 0.01) return 0;
    if (this.esFacturaOBoletaVenta() || this.esNotaVentaVenta()) return total;
    return 0;
  }

  /** Nota de venta efectiva (gestora: tipo destino NV; si no, código NV). */
  esNotaVentaVenta(): boolean {
    if (this.esGestora) {
      return String(this.tipoComprobanteDestino || '').trim().toUpperCase() === 'NV';
    }
    return this.codigoComprobanteVentaSeleccionado() === 'NV';
  }

  private codigoComprobanteVentaSeleccionado(): string {
    const id = this.ventas?.idComprobante;
    if (id == null || id === '') return '';
    const comp = this.comprobantes?.find((c: any) => Number(c.idComprobante) === Number(id));
    return String(comp?.codigo ?? '').trim().toUpperCase();
  }

  /** Factura o boleta efectiva (gestora: comprobante destino; resto: tipo seleccionado). */
  esFacturaOBoletaVenta(): boolean {
    if (this.esGestora) {
      const c = String(this.tipoComprobanteDestino || '').trim().toUpperCase();
      return c === '01' || c === '03';
    }
    const c = this.codigoComprobanteVentaSeleccionado();
    return c === '01' || c === '03';
  }

  cuotasCreditoRequeridas(): boolean {
    return this.esFacturaOBoletaVenta() && this.getMontoCreditoVenta() > 0.01;
  }

  get sumaCuotasCreditoPlano(): number {
    return Math.round(this.cuotasCreditoPlano.reduce((s, r) => s + (Number(r.monto) || 0), 0) * 100) / 100;
  }

  validarCuotasCreditoPlano(): boolean {
    if (!this.cuotasCreditoRequeridas()) return true;
    const target = Math.round(this.getMontoCreditoVenta() * 100) / 100;
    if (this.cuotasCreditoPlano.length === 0) return false;
    if (!this.cuotasCreditoPlano.every((r) => r.fechaVencimiento && (Number(r.monto) || 0) > 0)) return false;
    return Math.abs(this.sumaCuotasCreditoPlano - target) <= 0.02;
  }

  /** Si falta plan de cuotas (F/B + crédito), abre el modal y devuelve false. */
  asegurarCuotasCreditoSiCorresponde(): boolean {
    if (!this.cuotasCreditoRequeridas()) return true;
    if (this.validarCuotasCreditoPlano()) return true;
    this.abrirModalCuotasCredito();
    iziToast.warning({
      title: 'Plan de cuotas',
      message: 'En factura o boleta a crédito defina cada cuota, monto y fecha de vencimiento. La suma debe coincidir con el total al crédito.'
    });
    return false;
  }

  abrirModalCuotasCredito(): void {
    const target = Math.round(this.getMontoCreditoVenta() * 100) / 100;
    const fvCab = (this.ventas.fVencimiento || '').toString().slice(0, 10);
    const hoy = (() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    })();
    const defaultFv = fvCab || hoy;
    if (this.cuotasCreditoPlano.length === 0 && target > 0) {
      this.cuotasCreditoPlano = [{ monto: target, fechaVencimiento: defaultFv }];
    }
    const el = document.getElementById('modalCuotasCredito');
    if (el) {
      bootstrap.Modal.getOrCreateInstance(el as HTMLElement).show();
    }
  }

  cerrarModalCuotasCredito(): void {
    const el = document.getElementById('modalCuotasCredito');
    bootstrap.Modal.getInstance(el as HTMLElement)?.hide();
  }

  agregarFilaCuotaCredito(): void {
    const fv = (this.ventas.fVencimiento || '').toString().slice(0, 10) || (() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    })();
    this.cuotasCreditoPlano.push({ monto: 0, fechaVencimiento: fv });
  }

  quitarFilaCuotaCredito(index: number): void {
    this.cuotasCreditoPlano.splice(index, 1);
  }

  confirmarCuotasCreditoYRegistrar(): void {
    if (!this.validarCuotasCreditoPlano()) {
      iziToast.warning({
        title: 'Revise las cuotas',
        message: 'Cada fila requiere monto y fecha. La suma de cuotas debe igualar el total al crédito.'
      });
      return;
    }
    this.cerrarModalCuotasCredito();
    this.registrarVenta();
  }

  /** Valida sujeto a crédito y línea de crédito; si es válido, envía la venta. */
  validarYEnviarVentaAlCredito(idCliente: number, totalCredit: number): void {
    const tieneDatosCredito = this.cliente.sujetoCredito !== undefined && this.cliente.lineaCredito !== undefined;
    if (tieneDatosCredito) {
      this.evaluarCreditoYEnviar(this.cliente.sujetoCredito, this.cliente.lineaCredito, idCliente, totalCredit);
      return;
    }
    this._clienteService.obtener_cliente_id(idCliente).subscribe({
      next: (res: any) => {
        const row = (res?.data && res.data[0]) ? res.data[0] : res?.data;
        const sujetoCredito = row?.sujetoCredito === true || row?.sujetoCredito === 1;
        const lineaCredito = row?.lineaCredito != null && !isNaN(Number(row.lineaCredito)) ? Number(row.lineaCredito) : 0;
        this.cliente.sujetoCredito = sujetoCredito;
        this.cliente.lineaCredito = lineaCredito;
        this.evaluarCreditoYEnviar(sujetoCredito, lineaCredito, idCliente, totalCredit);
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo verificar los datos del cliente para crédito.' });
      }
    });
  }

  private evaluarCreditoYEnviar(sujetoCredito: boolean, lineaCredito: number, idCliente: number, totalCredit: number): void {
    if (!sujetoCredito) {
      iziToast.warning({
        title: 'Cliente no sujeto a crédito',
        message: 'Este cliente no está habilitado para ventas al crédito. Edite el cliente y marque "Sujeto a crédito" con una línea de crédito mayor a 0.'
      });
      return;
    }
    this.creditosService.obtenerCreditosCliente(String(idCliente)).subscribe({
      next: (res) => {
        const list = res?.data || [];
        const deudaActual = list.reduce((sum: number, c: any) => sum + (Number(c.saldoPendiente) || 0), 0);
        const totalConNuevaVenta = deudaActual + totalCredit;
        if (totalConNuevaVenta > lineaCredito) {
          iziToast.warning({
            title: 'Línea de crédito excedida',
            message: `La deuda actual del cliente es S/ ${deudaActual.toFixed(2)}. Con esta venta (S/ ${totalCredit.toFixed(2)}) el total sería S/ ${totalConNuevaVenta.toFixed(2)}, que supera su línea de crédito (S/ ${lineaCredito.toFixed(2)}).`
          });
          return;
        }
        this.enviarVentaConCliente(idCliente);
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo obtener la deuda del cliente.' });
      }
    });
  }

  private crearClienteYRegistrarVenta(): void {
    const payload = {
      idDocumento: this.ventas.idDocumento || this.ID_DOC_DNI,
      ruc: (this.cliente.ruc ?? '').toString().trim(),
      rSocial: (this.cliente.rSocial ?? '').toString().trim(),
      correo: this.cliente.correo ?? null,
      celular: this.cliente.celular ?? null,
      condicion: this.cliente.condicion ?? 'ACTIVO'
    };
    this.loading = true;
    this._clienteService.crear_cliente(payload).subscribe({
      next: (res: any) => {
        const creado = res?.data;
        const idCliente = creado?.idCliente != null ? Number(creado.idCliente) : null;
        const enviarVenta = (id: number) => {
          this.cliente.idCliente = id;
          this.registrarDireccionClienteSiNuevo(id, () => {
            this.loading = false;
            this.registrarVenta();
          });
        };
        if (idCliente == null) {
          this._clienteService.obtener_cliente_ruc(payload.ruc).subscribe({
            next: (r: any) => {
              if (r.data && r.data.length > 0) {
                enviarVenta(Number(r.data[0].idCliente));
              } else {
                this.loading = false;
                iziToast.error({ title: 'Error', message: 'No se pudo obtener el cliente creado.' });
              }
            },
            error: () => {
              this.loading = false;
              iziToast.error({ title: 'Error', message: 'No se pudo crear el cliente.' });
            }
          });
        } else {
          enviarVenta(idCliente);
        }
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message ?? 'No se pudo crear el cliente.';
        iziToast.error({ title: 'Error', message: msg });
      }
    });
  }

  /**
   * Registra una dirección en DireccionClientes para un cliente recién creado.
   * Usa datos por defecto para campos no disponibles. Siempre ejecuta onDone (para continuar con la venta).
   */
  registrarDireccionClienteSiNuevo(idCliente: number, onDone: () => void): void {
    const direccion = (this.cliente?.direccion ?? '').toString().trim() || 'Sin especificar';
    const payload = {
      idCliente,
      direccion,
      ubigeo: '',
      codpais: 'PEN',
      region: '',
      provincia: '',
      distrito: '',
      urbanizacion: '',
      referencia: '',
      codLocal: '',
      principal: true
    };
    this._clienteService.crear_direccionCliente(payload).subscribe({
      next: () => onDone(),
      error: () => onDone()
    });
  }

  private enviarCotizacion(idCliente: number): void {
    this.loading = true;
    const totalVenta = Number(this.ventas.total) || 0;
    const cotizacionPayload = {
      cotizacion: {
        idComprobante: Number(this.ventas.idComprobante),
        serie: String(this.ventas.serie || '0000').substring(0, 4),
        numero: String(this.ventas.numero || '00000000').substring(0, 8),
        compVenta: this.ventas.compVenta || this.ventas.serie + '-' + this.ventas.numero,
        fEmision: this.ventas.fEmision ? String(this.ventas.fEmision).substring(0, 10) : (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })(),
        fVencimiento: this.ventas.fVencimiento ? String(this.ventas.fVencimiento).substring(0, 10) : null,
        idDocumento: this.ventas.idDocumento != null ? String(this.ventas.idDocumento).substring(0, 1) : '1',
        idCliente,
        idSucursal: this.ventas.idSucursal,
        moneda: null,
        idCondicionPago: null,
        total: totalVenta,
        esCotizacionAgrupada: this.cotizacionDebeMarcarseAgrupada()
      },
      detalles: this.carrito.map((item: any) => {
        const cant = Number(item.cantidad) || 0;
        const pVenta = Number(item.pVenta) || 0;
        const subtotal = cant * pVenta;
        const idSucursalLinea = item.idSucursal != null && String(item.idSucursal).trim() !== ''
          ? item.idSucursal
          : this.ventas.idSucursal;
        return {
          cantidad: cant,
          pVenta,
          descuento: 0,
          subtotal,
          igv: 0,
          isc: 0,
          total: subtotal,
          codigo: (item.codigo ?? item.Codigo ?? '').toString(),
          descripcion: (item.descripcion ?? '').toString(),
          idPresentacion: item.idPresentacion != null ? item.idPresentacion : 1,
          idSucursal: idSucursalLinea,
          idProducto: item.idProducto != null ? String(item.idProducto) : undefined,
          idEmpresaProducto: item.idEmpresa != null ? String(item.idEmpresa) : undefined,
          aliasEmpresa: item.aliasEmpresa != null ? String(item.aliasEmpresa).substring(0, 10) : undefined
        };
      })
    };
    this.cotizacionesService.crearCotizacion(cotizacionPayload).subscribe({
      next: () => {
        this.loading = false;
        iziToast.success({ title: 'Éxito', message: 'Cotización registrada correctamente.' });
        this.ventaProvisionalUi.eliminarSesionActiva();
        this.limpiarVenta();
      },
      error: (err) => {
        this.loading = false;
        iziToast.error({
          title: 'Error',
          message: err.error?.error || err.error?.message || 'Error al registrar la cotización.'
        });
      }
    });
  }

  /**
   * PENDIENTE + condición CRÉDITO corriente + sin líneas: envía una línea fiado por el total (CreditosClientes/CuotasCredito).
   */
  private completarDetallePagoCreditoPendiente(detallePago: { idMediosPago: number; monto: number }[]): void {
    const idEstadoPago = Number(this.ventas.idEstadoPago) || 2;
    if (idEstadoPago !== 1) return;
    if (!this.cabeceraEsCreditoFinanciacion()) return;
    if (!this.esFacturaOBoletaVenta() && !this.esNotaVentaVenta()) return;
    const totalVenta = Math.round((Number(this.ventas.total) || 0) * 100) / 100;
    if (totalVenta <= 0.01) return;
    if (detallePago.length > 0) return;
    const medioCred = this.mediosPago.find((m: any) => this.medioPagoEsCreditoFinanciacion(m));
    if (!medioCred) return;
    detallePago.push({ idMediosPago: Number(medioCred.idMediosPago), monto: totalVenta });
  }

  /** Lista de filas DireccionClientes desde la respuesta HTTP (varios formatos de envoltorio). */
  private extraerFilasDireccionesClienteDesdeRespuestaHttp(dirRes: unknown): unknown[] {
    if (!dirRes) return [];
    if (Array.isArray(dirRes)) return dirRes;
    const dr = dirRes as Record<string, unknown>;
    const d = dr['data'];
    if (Array.isArray(d)) return d;
    if (d != null && typeof d === 'object' && Array.isArray((d as Record<string, unknown>)['data'])) {
      return (d as Record<string, unknown>)['data'] as unknown[];
    }
    return [];
  }

  /** Asigna `direccionCliente` y texto en `cliente.direccion` desde la primera fila devuelta por el API. */
  private aplicarPrimeraDireccionClienteAlContexto(dirRes: unknown): void {
    const filas = this.extraerFilasDireccionesClienteDesdeRespuestaHttp(dirRes);
    const primera = filas[0] as Record<string, unknown> | undefined;
    if (!primera) {
      return;
    }
    const rawId =
      primera['idDireccionClientes'] ?? primera['idDireccionCliente'] ?? primera['IdDireccionClientes'];
    const idNum = Number(rawId);
    this.direccionCliente = { ...primera };
    if (Number.isFinite(idNum) && idNum > 0) {
      (this.direccionCliente as Record<string, unknown>)['idDireccionClientes'] = idNum;
    }
    const partes = [
      primera['direccion'],
      primera['urbanizacion'],
      primera['distrito'],
      primera['provincia'],
      primera['region']
    ]
      .map((x) => (x ?? '').toString().trim())
      .filter((s) => s.length > 0);
    this.cliente.direccion = (partes.join(', ') || (primera['direccion'] ?? '')).toString();
  }

  /** Id de dirección a persistir en Ventas (misma empresa / POS). */
  private obtenerIdDireccionClienteSeleccionadaParaVenta(): number | undefined {
    const dc = this.direccionCliente as Record<string, unknown> | undefined;
    if (!dc || typeof dc !== 'object') return undefined;
    const raw = dc['idDireccionClientes'] ?? dc['idDireccionCliente'] ?? dc['IdDireccionClientes'];
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  private enviarVentaConCliente(idCliente: number): void {
    const totalVenta = Number(this.ventas.total) || 0;
    const totalPago = this.calcularTotalTabla();
    const idEstadoPago = Number(this.ventas.idEstadoPago) || 2;
    const esPagoPendiente = idEstadoPago === 1;
    if (!esPagoPendiente && totalPago > 0 && Math.abs(totalPago - totalVenta) > 0.01) {
      this.loading = false;
      iziToast.warning({ title: 'Advertencia', message: 'El total del detalle de pago no coincide con el total de la venta.' });
      return;
    }
    if (!this.asegurarCuotasCreditoSiCorresponde()) {
      return;
    }
    this.loading = true;

    const ventaPayload: any = {
      idSucursal: this.ventas.idSucursal,
      serie: String(this.ventas.serie || '0000').substring(0, 4),
      numero: String(this.ventas.numero || '00000000').substring(0, 8),
      compVenta: this.ventas.compVenta || this.ventas.serie + '-' + this.ventas.numero,
      idComprobante: Number(this.ventas.idComprobante),
      fEmision: fechaEmisionVentaParaApi(this.ventas.fEmision),
      fVencimiento: fechaVentaOpcionalParaApi(this.ventas.fVencimiento),
      idCliente,
      idMoneda: Number(this.ventas.idMoneda) || 1,
      tCambio: 1,
      subtotal: Number(this.ventas.subTotal) || 0,
      igv: Number(this.ventas.igv) || 0,
      isc: Number(this.ventas.isc) || 0,
      exonerado: Number(this.ventas.exonerado) || 0,
      gratuito: Number(this.ventas.gratuito) || 0,
      otrosCargos: Number(this.ventas.otrosCargos) || 0,
      descuentos: Number(this.ventas.descuentos) || 0,
      total: totalVenta,
      idMediosPago: String(this.ventas.idMediosPago || this.getIdMediosPagoContado()),
      idEstadoPedido: Number(this.ventas.idEstadoPedido) || 1,
      idEstadoPago,
      idEstadoSunat: this.esComprobanteElectronico() ? 7 : 1,
      compRelacionado: null,
      observaciones: this.ventas.observacion || null
    };

    const idDirUi = this.obtenerIdDireccionClienteSeleccionadaParaVenta();
    if (idDirUi != null) {
      ventaPayload.idDireccionClientes = idDirUi;
    }

    if (this.esGestora) {
      ventaPayload.tipoComprobanteDestino = this.tipoComprobanteDestino;
    }

    const idEstadoPedidoVenta = Number(this.ventas.idEstadoPedido) || 1;
    const esEstadoPendiente = idEstadoPedidoVenta === 1;
    const detalles = this.carrito.map((item: any) => {
      const cant = Number(item.cantidad) || 0;
      const pVenta = Number(item.pVenta) || 0;
      const subtotal = cant * pVenta;
      return {
        idProducto: item.idProducto,
        cantidad: cant,
        pVenta,
        descuento: 0,
        subtotal,
        igv: 0,
        isc: 0,
        total: subtotal,
        hVenta: fechaEmisionVentaParaApi(this.ventas.fEmision),
        cantEntregada: esEstadoPendiente ? 0 : cant,
        idEstadoPedido: idEstadoPedidoVenta,
        idSucursalEmpresa: item.idSucursal || undefined,
        aliasEmpresa: item.aliasEmpresa || undefined,
        sucursal: item.sucursal || undefined,
        descripcion: item.descripcion || undefined,
        codigo: item.codigo || undefined,
        descripcionLinea: this.descripcionLineaParaDetalle(item)
      };
    });

    const detallePago: { idMediosPago: number; monto: number }[] = this.detallePago
      .filter((d: any) => d.monto > 0 && (d.idFormaPago != null || d.idMediosPago != null))
      .map((d: any) => ({
        idMediosPago: Number(d.idMediosPago ?? d.idFormaPago),
        monto: Number(d.monto)
      }));

    this.completarDetallePagoCreditoPendiente(detallePago);

    let idApertura: string | undefined;
    if (detallePago.length > 0) {
      const cajaSucursal = this.obtenerCajaAbiertaSucursal(this.ventas.idSucursal);
      idApertura = cajaSucursal?.idApertura;
    }

    const cuotasCredito =
      this.cuotasCreditoRequeridas() && this.validarCuotasCreditoPlano()
        ? this.cuotasCreditoPlano.map((r) => ({
            monto: Math.round((Number(r.monto) || 0) * 100) / 100,
            fechaVencimiento: String(r.fechaVencimiento || '').slice(0, 10)
          }))
        : undefined;

    this.ventasService.crearVentaCompleta({
      venta: ventaPayload,
      detalles,
      detallePago: detallePago.length > 0 ? detallePago : undefined,
      ...(cuotasCredito && cuotasCredito.length ? { cuotasCredito } : {}),
      idApertura
    }).subscribe({
      next: (res: any) => {
        this.loading = false;
        iziToast.success({ title: 'Éxito', message: 'Venta registrada correctamente.' });
        if (res.avisoStockInsuficiente) {
          iziToast.warning({ title: 'Aviso', message: res.avisoStockInsuficiente, position: 'topRight' });
        }
        if (this.esGestora && res.idVentaAgrupada) {
          this.imprimirComprobanteVA(res.idVentaAgrupada);
        }
        const idVentaPdf = this.obtenerIdVentaTrasRegistro(res);
        const abrirPdf =
          this.mostrarModalPdfTrasRegistrarVenta && idVentaPdf != null;
        if (abrirPdf) {
          this.postVentaIdVenta = idVentaPdf;
          this.cerrarPostVentaWhatsappForm();
          setTimeout(() => {
            const el = document.getElementById('pdfModalPostVenta');
            if (el && typeof bootstrap !== 'undefined') {
              bootstrap.Modal.getOrCreateInstance(el).show();
            }
          }, 0);
        } else {
          this.ventaProvisionalUi.eliminarSesionActiva();
          this.limpiarVenta();
        }
      },
      error: (err) => {
        this.loading = false;
        iziToast.error({
          title: 'Error',
          message: err.error?.error || err.error?.message || 'Error al registrar la venta.'
        });
      }
    });
  }

  private obtenerIdVentaTrasRegistro(res: { ventasEmpresa?: Array<{ idVenta?: number }> }): number | null {
    const arr = res?.ventasEmpresa;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const n = Number(arr[0]?.idVenta);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private finalizarFlujoTrasModalPdfPostVenta(): void {
    this.postVentaIdVenta = null;
    this.cerrarPostVentaWhatsappForm();
    this.postVentaGenerandoPdf = false;
    this.ventaProvisionalUi.eliminarSesionActiva();
    this.limpiarVenta();
  }

  cerrarPostVentaWhatsappForm(): void {
    this.postVentaMostrarWhatsapp = false;
    this.postVentaDatosWhatsapp = null;
    this.postVentaWhatsappNumero = '';
    this.postVentaWhatsappCaption = '';
    this.postVentaWhatsappFormato = 'A4';
    this.postVentaWhatsappMensaje = null;
    this.postVentaWhatsappEnviando = false;
  }

  private aplicarWhatsappDesdeClientePdfPostVenta(d: {
    cliente?: { celular?: string; rSocial?: string; razonSocial?: string };
  }): void {
    const cel = String(d?.cliente?.celular ?? '').trim();
    const nombre = String(d?.cliente?.rSocial ?? d?.cliente?.razonSocial ?? '').trim();
    if (cel) {
      this.postVentaWhatsappNumero = cel;
      this.postVentaWhatsappCaption = nombre ? `${nombre} aquí envío tu comprobante` : '';
    } else {
      this.postVentaWhatsappNumero = '';
      this.postVentaWhatsappCaption = '';
    }
  }

  abrirFormWhatsappPostVenta(): void {
    const id = this.postVentaIdVenta;
    if (id == null) return;
    this.postVentaGenerandoPdf = true;
    this.postVentaWhatsappMensaje = null;
    this.ventasService.getComprobanteParaPdf(id).subscribe({
      next: (res) => {
        const d = res.data;
        this.postVentaGenerandoPdf = false;
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
          impuestos: Array.isArray(d.impuestos) ? d.impuestos : [],
          cantidadLetras,
          nombreArchivo
        };
        this.postVentaDatosWhatsapp = { datos, nombreArchivo };
        this.aplicarWhatsappDesdeClientePdfPostVenta(d);
        this.postVentaMostrarWhatsapp = true;
      },
      error: (err) => {
        this.postVentaGenerandoPdf = false;
        this.postVentaWhatsappMensaje = err?.error?.error || err?.message || 'No se pudieron cargar los datos.';
      }
    });
  }

  enviarPdfPorWhatsappPostVenta(): void {
    if (!this.postVentaDatosWhatsapp || !this.postVentaWhatsappNumero.trim()) {
      this.postVentaWhatsappMensaje = 'Ingrese el número de WhatsApp (ej. 51999999999).';
      return;
    }
    this.postVentaWhatsappEnviando = true;
    this.postVentaWhatsappMensaje = null;
    const { datos, nombreArchivo } = this.postVentaDatosWhatsapp;
    const formato = this.postVentaWhatsappFormato;
    this.pdfService.generarPdfComprobanteVenta(datos as never, formato, nombreArchivo).subscribe({
      next: (blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.split(',')[1] : dataUrl;
          this.whatsappService
            .enviarArchivo(
              this.postVentaWhatsappNumero.trim(),
              base64,
              nombreArchivo,
              'document',
              this.postVentaWhatsappCaption.trim() || undefined
            )
            .subscribe({
              next: (r) => {
                this.postVentaWhatsappEnviando = false;
                this.postVentaWhatsappMensaje = r.message;
                if (r.success) setTimeout(() => this.cerrarPostVentaWhatsappForm(), 2000);
              },
              error: (err) => {
                this.postVentaWhatsappEnviando = false;
                this.postVentaWhatsappMensaje = err?.error?.message || err?.message || 'Error al enviar por WhatsApp.';
              }
            });
        };
        reader.readAsDataURL(blob);
      },
      error: (err) => {
        this.postVentaWhatsappEnviando = false;
        const e = err?.error;
        if (e instanceof Blob) {
          const rdr = new FileReader();
          rdr.onloadend = () => {
            try {
              const json = JSON.parse(rdr.result as string);
              this.postVentaWhatsappMensaje = json?.error || 'Error al generar el PDF.';
            } catch {
              this.postVentaWhatsappMensaje = 'Error al generar el PDF.';
            }
          };
          rdr.readAsText(e);
        } else {
          this.postVentaWhatsappMensaje =
            e && typeof e === 'object' && typeof (e as { error?: string }).error === 'string'
              ? (e as { error: string }).error
              : err?.message || 'Error al generar el PDF.';
        }
      }
    });
  }

  generarPdfPostVenta(formato: 'A4' | 'A5' | 'ticket'): void {
    const id = this.postVentaIdVenta;
    if (id == null) return;
    this.postVentaGenerandoPdf = true;
    this.ventasService.getComprobanteParaPdf(id).subscribe({
      next: (res) => {
        const d = res.data;
        if (!d) {
          this.postVentaGenerandoPdf = false;
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
          impuestos: Array.isArray(d.impuestos) ? d.impuestos : [],
          cantidadLetras,
          nombreArchivo
        };
        this.pdfService.generarPdfComprobanteVenta(datos, formato, nombreArchivo).subscribe({
          next: (blob) => {
            this.pdfService.previsualizar(blob);
            this.postVentaGenerandoPdf = false;
          },
          error: (err) => {
            this.postVentaGenerandoPdf = false;
            const msg = err?.error?.error || err?.message || 'Error al generar el PDF.';
            console.error('Error generar PDF post-venta:', err);
            iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
          }
        });
      },
      error: (err) => {
        this.postVentaGenerandoPdf = false;
        const msg = err?.error?.error || err?.message || 'Error al cargar el comprobante.';
        iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
      }
    });
  }

  abrirModalEditarClienteCompleto(): void {
    if (!this.cliente?.idCliente || this.cliente.idCliente === '') return;
    this.idClienteParaEditarModal = this.cliente.idCliente;
    setTimeout(() => {
      const el = document.getElementById('modalEditarClienteVenta');
      if (el && typeof bootstrap !== 'undefined') {
        bootstrap.Modal.getOrCreateInstance(el).show();
      }
    }, 0);
  }

  cerrarModalEditarClienteVenta(): void {
    const el = document.getElementById('modalEditarClienteVenta');
    if (el && typeof bootstrap !== 'undefined') {
      bootstrap.Modal.getInstance(el)?.hide();
    }
  }

  onClienteEditadoDesdeModal(): void {
    const id = this.cliente?.idCliente;
    if (id == null || id === '') {
      this.cerrarModalEditarClienteVenta();
      return;
    }
    this._clienteService.obtener_cliente_id(id).subscribe({
      next: (r) => {
        const item = Array.isArray(r.data) ? r.data[0] : r.data;
        if (item) {
          this.cliente.rSocial = (item.rSocial ?? item.r_Social ?? '').toString().trim();
          this.cliente.correo = item.correo ?? '';
          this.cliente.celular = item.celular ?? '';
          this.cliente.ruc = item.ruc != null ? String(item.ruc) : this.cliente.ruc;
          this.cliente.idDocumento = String(item.idDocumento ?? this.cliente.idDocumento);
        }
        this._clienteService.obtener_direccionesCliente_idCliente(id).subscribe({
          next: (dirRes) => {
            this.aplicarPrimeraDireccionClienteAlContexto(dirRes);
          },
          error: () => {}
        });
        this.guardarEstadoProvisional();
        this.cerrarModalEditarClienteVenta();
      },
      error: () => {
        this.cerrarModalEditarClienteVenta();
      }
    });
  }

  /** Solo ticket térmico (ventana + Imprimir); no PDF A4. */
  imprimirComprobanteVA(idVentaAgrupada: string): void {
    this.ventasService.getComprobanteVAParaPdf(idVentaAgrupada).subscribe({
      next: (res) => {
        if (!res?.data) {
          iziToast.warning({ title: 'Aviso', message: 'No se pudieron cargar los datos del comprobante VA.', position: 'topRight' });
          return;
        }
        if (!openComprobanteVaTicket(res.data)) {
          iziToast.warning({
            title: 'Aviso',
            message: 'Permita ventanas emergentes para ver e imprimir el ticket VA.',
            position: 'topRight'
          });
        }
      },
      error: () => {
        iziToast.warning({ title: 'Aviso', message: 'No se pudo cargar el comprobante VA para impresión.', position: 'topRight' });
      }
    });
  }

  abrirModalCotizacion(): void {
    this.cotizacionesParaCargar = [];
    this.loadingCotizaciones = true;
    this.ventaCotizacionUi.listarParaModal().subscribe({
      next: (listado) => {
        this.cotizacionesParaCargar = listado;
        this.loadingCotizaciones = false;
      },
      error: () => {
        this.loadingCotizaciones = false;
      }
    });
  }

  cargarCotizacion(idCotizacion: number): void {
    this.ventaCotizacionUi.obtenerDetalleParaVenta(idCotizacion).subscribe({
      next: (data) => {
        if (!data || !validarCotizacionParaCarrito(data)) {
          return;
        }
        this.aplicarCotizacionEnCarrito(data, true);
        this.guardarEstadoProvisional();
      }
    });
  }

  abrirModalValeLiquidar(): void {
    this.valesParaLiquidar = [];
    this.valeSeleccionadoLiquidar = null;
    this.idComprobanteLiquidacion = null;
    this.loadingVales = true;
    this.valesDespachoService.listar().subscribe({
      next: (res) => {
        const todos = res.data ?? [];
        this.valesParaLiquidar = todos.filter((v: ValeDespachoListItem) =>
          String(v?.estado || '').toUpperCase() !== 'ANULADO' && (v.idVentaLiquidacion == null || v.idVentaLiquidacion === undefined)
        );
        this.loadingVales = false;
      },
      error: () => {
        this.loadingVales = false;
        iziToast.error({ title: 'Error', message: 'No se pudieron cargar los vales.' });
      }
    });
  }

  seleccionarValeParaLiquidar(v: ValeDespachoListItem): void {
    this.valeSeleccionadoLiquidar = v;
    this.idComprobanteLiquidacion = this.comprobantesFacturaBoleta.length > 0 ? this.comprobantesFacturaBoleta[0].idComprobante : null;
  }

  confirmarLiquidarVale(): void {
    if (!this.valeSeleccionadoLiquidar || this.idComprobanteLiquidacion == null) return;
    this.loadingLiquidar = true;
    this.valesDespachoService.liquidar(this.valeSeleccionadoLiquidar.idValeDespacho, this.idComprobanteLiquidacion).subscribe({
      next: (res) => {
        this.loadingLiquidar = false;
        const modalEl = document.getElementById('modalValeLiquidar');
        if (modalEl) {
          const modal = bootstrap.Modal.getInstance(modalEl);
          modal?.hide();
        }
        this.valeSeleccionadoLiquidar = null;
        this.idComprobanteLiquidacion = null;
        iziToast.success({
          title: 'Éxito',
          message: `Venta ${res.data?.compVenta ?? ''} generada. Vale liquidado.`
        });
      },
      error: (err) => {
        this.loadingLiquidar = false;
        iziToast.error({
          title: 'Error',
          message: err?.error?.error || err?.error?.message || 'Error al liquidar el vale.'
        });
      }
    });
  }

  limpiarVenta(): void {
    this.carrito = [];
    this.detallePago = [];
    this.cuotasCreditoPlano = [];
    this.pagaCon = 0;
    this.vuelto = 0;

    // Reset modal comprobante (estado pedido y pago según configuración)
    this.ventas = {
      compVenta: '0000-00000000',
      idComprobante: '',
      serie: '0000',
      numero: '00000000',
      idSucursal: '',
      idCliente: '',
      idDocumento: '',
      idMoneda: 1,
      idEstadoPedido: this.configDefaults.idEstadoPedidoPorDefecto,
      idEstadoPago: this.configDefaults.idEstadoPagoPorDefecto,
      idMediosPago: this.getIdMediosPagoContado(),
      fEmision: getFechaHoyLocal(),
      fechaPago: '',
      fVencimiento: '',
      observacion: '',
      total: 0,
      igv: 0,
      isc: 0,
      impuestosDetalle: [],
      igvPorcentaje: 0,
      igvMonto: 0,
      exonerado: 0,
      gratuito: 0,
      otrosCargos: 0,
      subTotal: 0,
      descuentos: 0,
    };

    // Reset información del cliente
    this.cliente = {
      idCliente: '',
      idDocumento: '',
      ruc: '',
      rSocial: '',
      direccion: '',
      correo: '',
      celular: '',
      condicion: 'ACTIVO',
      sujetoCredito: undefined,
      lineaCredito: undefined
    };
    this.editClienteCreditoForm = { sujetoCredito: false, lineaCredito: 0 };
    this.direccionCliente = undefined;

    // Reset forma de pago seleccionada a efectivo si existe
    const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
    if (efectivo) {
      this.formaPagoSeleccionada = { ...efectivo };
    }

    this.actualizaTotales();
    this._productoService.limpiarCacheListaProductos();
  }
}

