import { AfterViewInit, Component, NgZone, OnDestroy, OnInit, signal } from '@angular/core';
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
import { ComprobantePdfData, VentasService } from '../../../services/ventas.service';
import { openComprobanteVaTicket } from '../../../utils/comprobante-va-ticket.util';
import { CotizacionesService, CotizacionListado } from '../../../services/cotizaciones.service';
import { ValesDespachoService, ValeDespachoListItem } from '../../../services/vales-despacho.service';
import { EmpresaService } from '../../../services/empresa.service';
import { RubrosService } from '../../../services/rubros.service';
import { CajaService } from '../../../services/caja.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { FactilizaService } from '../../../services/factiliza.service';
import { ImpuestoService } from '../../../services/impuesto.service';
import { Impuesto } from '../../../interfaces/impuesto.interface';
import { interpretarBooleanoConfig } from '../../../utils/config-valor-booleano.util';
import { VentaSesionService } from '../../../services/venta-sesion.service';
import { VentaSesion } from '../../../interfaces/venta-sesion.interface';
import { CreditosService } from '../../../services/creditos.service';
import { GestoresService } from '../../../services/gestores.service';
import { ProductosImagenService, ImagenProducto } from '../../../services/productos-imagen.service';
import { HotelPreloadVentaService } from '../../../services/hotel-preload-venta.service';
import { PdfService } from '../../../services/pdf.service';
import { WhatsappService } from '../../../services/whatsapp.service';
import { numeroALetras } from '../../../utils/numeroALetras';
import { Empresa } from '../../../interfaces/pdf-interface';

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

  public productos: any[] = [];
  private productos_const: any[] = [];
  public productos_filtrados: any[] = [];
  public productoEncontrado: any = null;
  public searchTerm: string = '';
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

  /** Galería en modal Buscar productos: solo si está habilitado en Config > Inventario. */
  productosConImagenes = false;
  imagenesProductoActual: ImagenProducto[] = [];
  visorAbierto = false;
  visorIndex = 0;
  idProductoCargandoImagenes: string | null = null;

  /** Modal Cargar desde cotización */
  cotizacionesParaCargar: CotizacionListado[] = [];
  loadingCotizaciones = false;

  /** Empresa gestora: venta corporativa con comprobante VA. */
  esGestora = false;
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
    private ventasService: VentasService,
    private cotizacionesService: CotizacionesService,
    private cajaService: CajaService,
    private _factilizaService: FactilizaService,
    private _impuestoService: ImpuestoService,
    private ventaSesionService: VentaSesionService,
    private creditosService: CreditosService,
    public sidebarState: SidebarStateService,
    private gestoresService: GestoresService,
    private productosImagenService: ProductosImagenService,
    private hotelPreloadVentaService: HotelPreloadVentaService,
    private valesDespachoService: ValesDespachoService,
    private empresaService: EmpresaService,
    private rubrosService: RubrosService,
    private pdfService: PdfService,
    private whatsappService: WhatsappService,
    private ngZone: NgZone,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  /** Referencia al modal Bootstrap “Buscar productos” para registrar/quitar el listener. */
  private buscadorModalEl: HTMLElement | null = null;
  /** Handler estable para removeEventListener en ngOnDestroy. */
  private readonly onBuscadorModalShownBound = (): void => {
    this.enfocarInputBuscadorModalVentas();
  };

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

  ngAfterViewInit(): void {
    this.buscadorModalEl = document.getElementById('buscadorModal');
    this.buscadorModalEl?.addEventListener('shown.bs.modal', this.onBuscadorModalShownBound);
    this.pdfPostVentaModalEl = document.getElementById('pdfModalPostVenta');
    this.pdfPostVentaModalEl?.addEventListener('hidden.bs.modal', this.onPdfPostVentaModalHiddenBound);
    this.modalEditarClienteEl = document.getElementById('modalEditarClienteVenta');
    this.modalEditarClienteEl?.addEventListener('hidden.bs.modal', this.onModalEditarClienteHiddenBound);
  }

  ngOnDestroy(): void {
    this.buscadorModalEl?.removeEventListener('shown.bs.modal', this.onBuscadorModalShownBound);
    this.buscadorModalEl = null;
    this.pdfPostVentaModalEl?.removeEventListener('hidden.bs.modal', this.onPdfPostVentaModalHiddenBound);
    this.pdfPostVentaModalEl = null;
    this.modalEditarClienteEl?.removeEventListener('hidden.bs.modal', this.onModalEditarClienteHiddenBound);
    this.modalEditarClienteEl = null;
  }

  /**
   * Pone el foco en el input de búsqueda del modal (Bootstrap suele dejarlo en el botón cerrar).
   */
  enfocarInputBuscadorModalVentas(): void {
    const intentar = () => {
      const el = document.getElementById('create-ventas-buscador-modal-search');
      if (el instanceof HTMLInputElement) {
        el.focus({ preventScroll: true });
        if (el.value.length > 0) {
          el.select();
        }
      }
    };
    intentar();
    setTimeout(intentar, 80);
    setTimeout(intentar, 200);
  }

  ngOnInit(): void {
    this.gestoresService.obtenerConfiguracion().subscribe({
      next: (res) => {
        const lista = Array.isArray(res?.data) ? res.data : [];
        const item = lista.find((c: { clave?: string; Clave?: string }) =>
          (c.clave || c.Clave || '') === 'PRODUCTOS_CON_IMAGENES'
        );
        const valor = item && (item as { valor?: string; Valor?: string }).valor !== undefined
          ? (item as { valor?: string; Valor?: string }).valor
          : (item as { valor?: string; Valor?: string }).Valor;
        this.productosConImagenes = valor ? String(valor).toLowerCase() === 'true' : false;
        const itemDesc = lista.find((c: { clave?: string; Clave?: string }) =>
          (c.clave || c.Clave || '') === 'VENTAS_USAR_DESCUENTO_EN_TOTAL'
        );
        const vDesc =
          itemDesc && (itemDesc as { valor?: string; Valor?: string }).valor !== undefined
            ? (itemDesc as { valor?: string; Valor?: string }).valor
            : (itemDesc as { valor?: string; Valor?: string })?.Valor;
        this.usarDescuentoEnTotal = interpretarBooleanoConfig(vDesc, true);
        const itemPdfModal = lista.find((c: { clave?: string; Clave?: string }) =>
          (c.clave || c.Clave || '') === 'VENTAS_MOSTRAR_MODAL_PDF_TRAS_REGISTRAR'
        );
        const vPdfModal =
          itemPdfModal && (itemPdfModal as { valor?: string; Valor?: string }).valor !== undefined
            ? (itemPdfModal as { valor?: string; Valor?: string }).valor
            : (itemPdfModal as { valor?: string; Valor?: string })?.Valor;
        this.mostrarModalPdfTrasRegistrarVenta = interpretarBooleanoConfig(vPdfModal, true);
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
      },
      error: () => {}
    });
    this.cajaService.obtenerCajas().subscribe({
      next: (r) => {
        this.cajas = (r.data || []).filter((c: any) => c.cajaAbierta && c.idApertura);
        if (this.cajas.length > 0 && this.cajas[0].idSucursal && !this.ventas.idSucursal) {
          this.ventas.idSucursal = this.cajas[0].idSucursal;
        }
      },
      error: () => {}
    });
    const now = new Date();
    const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
    const hoy = `${y}-${m}-${d}`;
    if (!this.ventas.fEmision) this.ventas.fEmision = hoy;
    //if (!this.ventas.fVencimiento) this.ventas.fVencimiento=hoy;
    // fVencimiento no es obligatorio; no se asigna por defecto
    // esGestora desde estado_configuración (BD Gestores_Empresas), no desde listado gestores
    // (obtenerEmpresasGestionadas solo permite Administrador y dejaba al vendedor sin modal gestora).
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (res) => {
        const estado = res?.data;
        this.esGestora = !!estado?.esGestora;
      },
      error: () => {
        this.esGestora = false;
      }
    });
    this._productoService.limpiarCacheListaProductos();
    this.cargarDatos();
    this.cargarConfigDefaultsVenta();
    const duplicarDesde = this.route.snapshot.queryParamMap.get('duplicarDesdeVenta');
    if (duplicarDesde) {
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
              this.productos = pr.data;
              this.productos_const = pr.data;
              this.stockSucursales_const = pr.data;
              this.productos_filtrados = Array.isArray(pr.data) ? [...pr.data] : [];
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
    const list = this.stockSucursales_const || [];
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
  }

  /** Stock numérico del catálogo o null si no aplica. */
  private stockNumericoProducto(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  /** Modal buscar productos: sin stock o stock ≤ 0. */
  productoBusquedaSinStockSuficiente(p: any): boolean {
    const s = this.stockNumericoProducto(p?.stock);
    return s == null || s <= 0;
  }

  private obtenerStockDisponibleParaLineaCarrito(item: any): number | null {
    const list = this.stockSucursales_const || [];
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

  /** Carrito: cantidad supera stock conocido o stock 0. */
  lineaCarritoStockInsuficiente(item: any): boolean {
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
    if (!this.ventaSesionService.tieneSesionesGuardadas()) return;
    this.sesionesGuardadas = this.ventaSesionService.getSesionesGuardadas();
    this.mostrarModalRecuperar = true;
    setTimeout(() => {
      const el = document.getElementById('modalRecuperar');
      if (el) bootstrap.Modal.getOrCreateInstance(el).show();
    }, 300);
  }

  /** Recupera una venta provisional por id y cierra el modal. */
  recuperarSesion(sesion: VentaSesion): void {
    const modalEl = document.getElementById('modalRecuperar');
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
    this.ventaSesionService.cargarSesion(sesion.id);
    this.carrito = Array.isArray(sesion.carrito) ? sesion.carrito.map((x: any) => ({ ...x })) : [];
    this.ventas = sesion.ventas ? { ...sesion.ventas } : this.ventas;
    this.detallePago = Array.isArray(sesion.detallePago) ? sesion.detallePago.map((x: any) => ({ ...x })) : [];
    this.cliente = sesion.cliente ? { ...sesion.cliente } : this.cliente;
    this.pagaCon = Number(sesion.pagaCon) || 0;
    this.vuelto = Number(sesion.vuelto) || 0;
    this.mostrarModalRecuperar = false;
    this.sesionesGuardadas = [];
    this.actualizaTotales();
  }

  /** Descarta todas las ventas provisionales y cierra el modal. */
  descartarTodasLasProvisionales(): void {
    const modalEl = document.getElementById('modalRecuperar');
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
    this.ventaSesionService.descartarTodas();
    this.mostrarModalRecuperar = false;
    this.sesionesGuardadas = [];
  }

  /** Cierra el modal de recuperación sin elegir (sigue con venta nueva). */
  cerrarModalRecuperar(): void {
    const modalEl = document.getElementById('modalRecuperar');
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
    this.mostrarModalRecuperar = false;
    this.sesionesGuardadas = [];
  }

  /** Guarda el estado actual en la sesión activa (localStorage). No guarda idEmpresa. */
  guardarEstadoProvisional(): void {
    const tieneDatos = this.carrito.length > 0 || this.ventas.idComprobante || (this.cliente?.idCliente && this.cliente.idCliente !== '');
    if (!tieneDatos) return;
    if (!this.ventaSesionService.getSesionActivaId()) {
      this.ventaSesionService.obtenerOCrearSesionActiva();
    }
    this.ventaSesionService.actualizarSesionActiva({
      carrito: this.carrito.map((x: any) => ({ ...x })),
      ventas: { ...this.ventas },
      detallePago: this.detallePago.map((x: any) => ({ ...x })),
      cliente: { ...this.cliente },
      pagaCon: this.pagaCon,
      vuelto: this.vuelto
    });
  }

  /** Anula la venta actual (elimina de provisionales) y deja pantalla lista para nueva venta. */
  anularVenta(): void {
    if (!confirm('¿Anular esta venta? Se eliminará de las ventas provisionales.')) return;
    this.ventaSesionService.eliminarSesionActiva();
    this.limpiarVenta();
  }
  /** Consulta productos para refrescar stock (p. ej. tras registrar una venta). */
  cargarProductos(opciones?: { evitarCache?: boolean }): void {
    this._productoService.obtenerProductosTodos(opciones).subscribe({
      next: (response: any) => {
        if (response?.data != null) {
          this.productos = response.data;
          this.productos_const = this.productos;
          this.stockSucursales_const = this.productos;
          this.productos_filtrados = this.stockSucursales_const;
        }
      },
      error: (err) => {
        console.error('Error al cargar productos:', err);
      }
    });
  }

  // Función para cargar todos los productos
  cargarDatos(){
    this._productoService.obtenerProductosTodos({ evitarCache: true }).subscribe(
      (response: any) => {
        if (response.data != undefined) {
          this.productos = response.data;
          this.productos_const = this.productos;
          this.stockSucursales_const = this.productos;
          this.productos_filtrados = Array.isArray(this.stockSucursales_const) ? [...this.stockSucursales_const] : [];
        }
      },
      (error: any) => {
        console.error('Error al cargar productos:', error);
      }
    );

   
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

    this._comprobanteService.obtenerComprobantesVenta().subscribe(
      (response) => {
        this.comprobantes = response.data;
              },
      (error) => {
              }
    );

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



  /** Columna Empresa en el modal Buscar productos: solo tiene sentido para empresa gestora (listado multi-empresa). */
  muestraEmpresaEnBuscadorVentas(): boolean {
    return this.esGestora;
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

  buscarProductos(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (term === '') {
      this.productos_filtrados = this.stockSucursales_const;
    } else {
      this.productos_filtrados = this.stockSucursales_const.filter(
        (item: any) => {
          const descripcion = (item.descripcion ?? '').toString().toLowerCase();
          const codigo = (item.codigo ?? '').toString().toLowerCase();
          const marca = (item.nombre ?? '').toString().toLowerCase();
          const alias = (item.aliasEmpresa ?? '').toString().toLowerCase();
          const sucursal = (item.sucursal ?? '').toString().toLowerCase();
          return (
            descripcion.includes(term) ||
            codigo.includes(term) ||
            marca.includes(term) ||
            alias.includes(term) ||
            sucursal.includes(term)
          );
        }
      );
    }
  }

  // Función para limpiar la búsqueda
  limpiarBusqueda(): void {
    this.searchTerm = '';
    this.productos_filtrados = this.stockSucursales_const;
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
    this._comprobanteService.obtenerComprobantesVenta().subscribe({
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

  seleccionaProducto(prod: any): void {
        // 1.  Agrega al carrito
    this.agregarAlCarrito(prod);

    // 2.  Cierra el modal (por JS)
    const buscador = bootstrap.Modal.getInstance(
      document.getElementById('buscadorModal')!
    );
    buscador?.hide();
  }

  verImagenesProducto(p: any, event: Event): void {
    event.stopPropagation();
    const idProducto = p?.idProducto;
    if (!idProducto) return;
    this.idProductoCargandoImagenes = idProducto;
    this.visorAbierto = false;
    this.productosImagenService.listar(idProducto).subscribe({
      next: (res) => {
        this.imagenesProductoActual = res.data ?? [];
        this.idProductoCargandoImagenes = null;
        if (this.imagenesProductoActual.length > 0) {
          this.visorIndex = 0;
          this.visorAbierto = true;
        }
      },
      error: () => { this.idProductoCargandoImagenes = null; }
    });
  }

  cerrarVisorImagenes(): void {
    this.visorAbierto = false;
  }

  anteriorImagenVisor(): void {
    if (this.imagenesProductoActual.length === 0) return;
    this.visorIndex = (this.visorIndex - 1 + this.imagenesProductoActual.length) % this.imagenesProductoActual.length;
  }

  siguienteImagenVisor(): void {
    if (this.imagenesProductoActual.length === 0) return;
    this.visorIndex = (this.visorIndex + 1) % this.imagenesProductoActual.length;
  }

  agregarAlCarrito(producto: any): void {
        const existe = this.carrito.find(p => p.idProducto === producto.idProducto);
    if (existe) {
      existe.cantidad += 1;
      this.enriquecerLineaCarritoDesdeCatalogo(existe);
    } else {
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

      // 1) Buscar coincidencia exacta en producto.Codigo
      let encontrado = this.stockSucursales_const.find((item: any) => {
        const codigo = (item.codigo ?? '').toString().toLowerCase();
        return codigo === term;
      });

      // 2) Si no hay exacta, buscar por inclusión (parcial)
      if (!encontrado) {
        encontrado = this.stockSucursales_const.find((item: any) => {
          const codigo = (item.codigo ?? '').toString().toLowerCase();
          return codigo.includes(term);
        });
      }

      // 3) (Opcional) buscar por idProducto si la entrada es numérica y no se encontró por código
      if (!encontrado && /^\d+$/.test(term)) {
        encontrado = this.stockSucursales_const.find((item: any) => String(item.idProducto) === term || String(item.idProducto) === term);
      }

      this.productoEncontrado = encontrado ?? null;
      
      if (this.productoEncontrado) {
        // Agregar al carrito usando la función existente
        //this.productoEncontrado.pVenta = this.obtenerPrecioPrincipal(this.productoEncontrado);
        this.agregarAlCarrito(this.productoEncontrado);
        this.searchCodigo = ''; // limpiar campo de búsqueda
        // iziToast.show({ title: 'OK', titleColor: '#1DC74C', message: 'Producto agregado al carrito', position: 'topRight' });
      } else {
        iziToast.show({
          title: 'ERROR',
          titleColor: '#FF0000',
          color: '#f39999ff',
          class: 'text-danger',
          position: 'topRight',
          message: 'El código no existe.'
        });
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

    const aplicarDescuentoLista = this.descuentoEnTotalConfigListo && this.usarDescuentoEnTotal;

    this.carrito.forEach(item => {
      const cant = Number(item.cantidad) || 0;
      const pVenta = Number(item.pVenta) || 0;
      const subtotalItem = Math.round(pVenta * cant * 100) / 100;
      this.ventas.subTotal += subtotalItem;
      if (aplicarDescuentoLista) {
        const precioPrincipal = this.obtenerPrecioPrincipal(item);
        if (precioPrincipal > pVenta) {
          this.ventas.descuentos += Math.round((precioPrincipal - pVenta) * cant * 100) / 100;
        }
      }
    });

    this.ventas.subTotal = Math.round(this.ventas.subTotal * 100) / 100;
    if (!aplicarDescuentoLista) {
      this.ventas.descuentos = 0;
    }
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
    const nuevo = parseInt(el.target.innerText.trim(), 10);
    if (!isNaN(nuevo)) {
      item.cantidad = nuevo;
    }
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
  

  abrirBuscadorModal(): void {
    const el = document.getElementById('buscadorModal');
    if (!el) return;
    bootstrap.Modal.getOrCreateInstance(el).show();
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
              if (dirRes.data && dirRes.data[0]) {
                this.direccionCliente = dirRes.data[0];
                this.cliente.direccion = this.direccionCliente.direccion ?? '';
              }
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
          if (dirRes?.data && dirRes.data.length > 0) {
            this.direccionCliente = dirRes.data[0];
            this.cliente.direccion = (this.direccionCliente.direccion ?? '').toString();
          }
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
        if (dirRes?.data && dirRes.data.length > 0) {
          this.direccionCliente = dirRes.data[0];
          this.cliente.direccion = (this.direccionCliente?.direccion ?? this.cliente.direccion ?? '').toString();
        }
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
    if (this.carrito.length === 0) {
      iziToast.warning({ title: 'Advertencia', message: 'Agregue al menos un producto al carrito.' });
      return;
    }
    if (!this.ventas.idComprobante) {
      iziToast.warning({ title: 'Advertencia', message: 'Seleccione tipo de comprobante (Datos del Comprobante).' });
      return;
    }
    if (!this.ventas.idSucursal && this.cajas.length > 0 && this.cajas[0].idSucursal) {
      this.ventas.idSucursal = this.cajas[0].idSucursal;
    }
    if (!this.ventas.idSucursal && this.sucursales.length > 0) {
      this.ventas.idSucursal = this.sucursales[0].idSucursal;
    }
    if (!this.ventas.idSucursal) {
      iziToast.warning({ title: 'Advertencia', message: 'No se pudo determinar la sucursal. Abra una caja o configure sucursales.' });
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
        this.ventaSesionService.eliminarSesionActiva();
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
      fEmision: this.ventas.fEmision ? new Date(this.ventas.fEmision).toISOString() : new Date().toISOString(),
      fVencimiento: this.ventas.fVencimiento ? new Date(this.ventas.fVencimiento).toISOString() : null,
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
        hVenta: new Date().toISOString(),
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
    if (detallePago.length > 0 && this.cajas.length > 0) {
      idApertura = this.cajas[0].idApertura;
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
          this.ventaSesionService.eliminarSesionActiva();
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
    this.ventaSesionService.eliminarSesionActiva();
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
            if (dirRes?.data && dirRes.data.length > 0) {
              this.direccionCliente = dirRes.data[0];
              this.cliente.direccion = (this.direccionCliente.direccion ?? '').toString();
            }
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
        if (!openComprobanteVaTicket(res.data, idVentaAgrupada)) {
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
    this.cotizacionesService.listar().subscribe({
      next: (res) => {
        this.cotizacionesParaCargar = res.data ?? [];
        this.loadingCotizaciones = false;
      },
      error: () => {
        this.loadingCotizaciones = false;
        iziToast.error({ title: 'Error', message: 'No se pudieron cargar las cotizaciones.' });
      }
    });
  }

  cargarCotizacion(idCotizacion: number): void {
    this.cotizacionesService.obtenerParaVenta(idCotizacion).subscribe({
      next: (res) => {
        const data = res.data;
        if (!data?.cabecera || !data?.detalles?.length) {
          iziToast.warning({ title: 'Aviso', message: 'Cotización sin detalle válido.' });
          return;
        }
        const lineas = data.detalles.filter((d: { idProducto: string | null }) => d.idProducto != null) as Array<{
          idProducto: string;
          idEmpresaProducto?: string | null;
          aliasEmpresa?: string;
          codigo: string;
          descripcion: string;
          codigoPresentacion: string;
          idPresentacion: number;
          cantidad: number;
          pVenta: number;
          idSucursal?: string;
          nombreSucursal?: string;
        }>;
        if (lineas.length === 0) {
          iziToast.warning({ title: 'Aviso', message: 'No se encontraron productos por código en esta cotización.' });
          return;
        }
        this.carrito = lineas.map((d) => ({
          idProducto: d.idProducto,
          idEmpresa: d.idEmpresaProducto != null ? String(d.idEmpresaProducto) : undefined,
          codigo: d.codigo,
          descripcion: d.descripcion,
          codigoPresentacion: d.codigoPresentacion ?? '',
          cantidad: Number(d.cantidad) || 0,
          pVenta: Number(d.pVenta) || 0,
          idSucursal: d.idSucursal,
          sucursal: (d.nombreSucursal ?? '').trim() || undefined,
          aliasEmpresa: (d.aliasEmpresa ?? '').trim() || undefined
        }));
        const primeraSucursal = lineas[0]?.idSucursal;
        if (primeraSucursal) {
          this.ventas.idSucursal = primeraSucursal;
        }
        const cab = data.cabecera;
        if (cab.idCliente != null) {
          this.cliente.idCliente = cab.idCliente;
          this.cliente.rSocial = cab.clienteRazonSocial ?? '';
          this.cliente.ruc = cab.clienteRuc ?? '';
        }
        this.actualizaTotales();
        const modalEl = document.getElementById('modalCotizacion');
        if (modalEl) {
          const modal = bootstrap.Modal.getInstance(modalEl);
          modal?.hide();
        }
        iziToast.success({ title: 'Éxito', message: 'Cotización cargada en la venta.' });
      },
      error: (err) => {
        iziToast.error({ title: 'Error', message: err?.error?.error || err?.error?.message || 'Error al cargar la cotización.' });
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
      fEmision: '',
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
    this.cargarProductos({ evitarCache: true });
  }
}

