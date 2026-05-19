import { AfterViewInit, Component, OnDestroy, signal } from '@angular/core';
import { ComprasService } from '../../../services/compras.service';
import { ComprobanteService } from '../../../services/comprobante.service';
import { ProductoService } from '../../../services/producto.service';
import { ProductoCreate } from '../../../models/producto.models';
import { SucursalService } from '../../../services/sucursal.service';
import { DocumentoService } from '../../../services/documento.service';
import { TablasSunatService } from '../../../services/tablas-sunat.service';
import { FormaPago } from '../../../interfaces/formasPago-interface';
import { CategoriaService } from '../../../services/categoria.service';
import { PresentacionService } from '../../../services/presentacion.service';
import { variosService } from '../../../services/varios.service';
import { Router, RouterModule } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { ConsultaXMLService } from '../../../services/consulta-xml.service';
import { marcaProductoEnLista, productoSinStockEnBusqueda } from '../../../utils/producto-busqueda.util';
import { descripcionUnidadMedidaProducto } from '../../../utils/producto-presentacion.util';
import { saveAs } from 'file-saver';
import { forkJoin, Observable, of, Subscription, throwError } from 'rxjs';
import { catchError, finalize, mergeMap, switchMap, tap } from 'rxjs/operators';
import { ProveedoresService } from '../../../services/proveedores.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { InventarioModalService } from '../../../services/inventario-modal.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CreateCategoriaComponent } from '../../categorias/create-categoria/create-categoria.component';
import { CreateMarcaComponent } from '../../marcas/create-marca/create-marca.component';

declare var iziToast: any;
declare var bootstrap: any;
const FORMATO_FECHA = 'dd/MM/yyyy';

interface CuotaCompraSunatForm {
  numeroCuota: number;
  fechaVencimiento: string;
  montoCuota: number;
}

@Component({
  selector: 'app-create-compras',
  standalone: true,
  imports: [
    FormsModule,
    RouterModule,
    CommonModule,
    TopnavComponent,
    SidebarComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './create-compras.component.html',
  styleUrl: './create-compras.component.css',
})
export class CreateComprasComponent implements AfterViewInit, OnDestroy {
  public compras: any = {
    idSucursal: '',
    idComprobante: '',
    idProveedor: '',
    idDocumento: '',
    idMoneda: '1',
    idEstadoPago: '2',
    idMediosPago: '5',
    fEmision: '',
    fechaPago: '',
    fVencimiento: '',
    observacion: '',
    total: 0,
    igv: 0,
    exonerado: 0,
    gratuito: 0,
    otrosCargos: 0,
    subTotal: 0,
    descuentos: 0,
    /** Tipo de cambio SUNAT: solo aplica en crédito y moneda distinta de soles. */
    tipoCambioSunat: '' as string | number,
  };

  /** Cuotas del CPE (crédito); se persisten en CuotasCompraSunat vía comprobanteSunat.cuotas. */
  public cuotasSunat: CuotaCompraSunatForm[] = [];

  

  public consultManual = false;
  /** Si la consulta SUNAT/Factiliza llega antes que carguen comprobantes, se mapea el id al tener la lista. */
  private codigoSunatCompraPendiente: string | null = null;
  public idCompra: any = '';
  public indexDetalle: any = 0;
  /** Si true, al registrar cada ítem se asigna a ubicación por defecto. Si false, podrá gestionar ubicaciones manualmente después. */
  public asignarUbicacionPorDefecto = true;
  public detalleCompras: any = [];
  public nuevoDetalleCompra: any = {};
  public comprobantes: any = [];
  public proveedores: any = {};
  public productos: any = {};
  public prodSelecionado: any = {};
  public productos_const: any = {};
  public productos_filtrados: any[] = [];
  public productoEncontrado: any = null;
  public searchTerm: string = '';
  public buscadorModal: any;
  public sucursales: any = [];
  public stockSucursales: any = [];
  public stockSucursales_const: any = [];
  public filtro: any = {};
  public filtroConsulta: any = '';
  public documento: any = {};
  public moneda: any = [];
  public estadoPago: any = [];
  public mediosPago: any = [];
  /** Formas de pago (catálogo) para el modal; solo se usa cuando la compra no es al crédito. */
  public formasPago: FormaPago[] = [];
  public formaPagoSeleccionada: FormaPago = {
    idFormaPago: 0,
    descripcion: '',
    tipo: 0,
    requiereReferencia: 0,
    activo: 0,
    recibido: 0,
    vuelto: 0,
    referencia: '',
  };
  /** Detalle de formas de pago agregadas en el modal (solo cuando compra no es al crédito). */
  public detallePago: Array<{ item: number; idFormaPago: number; descripcion: string; monto: number; referencia: string }> = [];
  /** Formulario del modal: monto y referencia al agregar una forma de pago. */
  public detailForm = { monto: 0, referencia: '' };
  public pagaCon = 0;
  public vuelto = 0;
  /** true = modal abierto desde "Registrar Compra" (mostrar botón Procesar compra). false = abierto desde "Forma de pago" (solo Guardar). */
  public modalPagoParaRegistrar = false;
  public categoria: any = [];
  public presentacion: any = [];
  public nuevoProducto: any = {
    idProducto: '',
    codigo: '',
    descripcion: '',
    cUnitario: 0,
    cantidad: 0,
    subtotal: 0,
    categoria: {},
    presentacion: {},
    sucursal: {},
    useCorrelativo: false,
    ubicacion: '',
    fproduccion: '',
    fvencimiento: '',
  };
  public correlativo: { idCorrelativo?: string; numero?: number; [key: string]: unknown } = { numero: 0 };
  public loadButton: boolean = false;
  public marcas: any = [];
  // FORMATO_FECHA = FORMATO_FECHA;

  //variables para subir un xml
  uploadForm: FormGroup;
  xmlData: any;

  // variable para consultar XML
  consultaForm: FormGroup;
  comprobante: any = null;
  loading = false;
  loadingPdf = false;
  error = '';
  xmlContent = '';

  private subscriptions: Subscription = new Subscription();

  constructor(
    private _comprasService: ComprasService,
    private _comprobanteService: ComprobanteService,
    private _proveedoresService: ProveedoresService,
    private _productoService: ProductoService,
    private _sucursalService: SucursalService,
    private _documentoService: DocumentoService,
    private _tablasSunatService: TablasSunatService,
    private _categoriaService: CategoriaService,
    private _presentacionService: PresentacionService,
    private _marcaService: variosService,
    private inventarioModal: InventarioModalService,
    private _router: Router,
    private modalService: NgbModal,

    // consultarxml
    private fb: FormBuilder,
    private sunatService: ConsultaXMLService,
    public sidebarState: SidebarStateService
  ) {
    //this.token = this._cookieService.get('token');
    this.consultaForm = this.fb.group({
      ruc: ['', [Validators.pattern(/^\d{11}$/)]],
      usuario: [''],
      password: [''],
      proveedor: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
      tipo_doc: ['01', Validators.required],
      serie: ['', [Validators.required, Validators.maxLength(4)]],
      correlativo: ['', [Validators.required, Validators.pattern(/^\d{1,8}$/)]],
    });

    this.uploadForm = this.fb.group({
      xmlFile: [null],
    });
  }

  private buscadorModalEl: HTMLElement | null = null;
  private readonly onBuscadorModalShownBound = (): void => {
    this.enfocarInputBuscadorModalCompras();
  };

  ngAfterViewInit(): void {
    this.buscadorModalEl = document.getElementById('buscadorModal');
    this.buscadorModalEl?.addEventListener('shown.bs.modal', this.onBuscadorModalShownBound);
  }

  ngOnDestroy(): void {
    this.buscadorModalEl?.removeEventListener('shown.bs.modal', this.onBuscadorModalShownBound);
    this.buscadorModalEl = null;
  }

  enfocarInputBuscadorModalCompras(): void {
    const intentar = () => {
      const el = document.getElementById('create-compras-buscador-modal-search');
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
    this.initData();
  }

  //  onFileChange(event: any) {
  //   if (event.target.files.length > 0) {
  //     const file = event.target.files[0];
  //     this.uploadForm.patchValue({
  //       xmlFile: file
  //     });
  //   }
  // }

  // onSubmit() {
  //   const formData = new FormData();
  //   formData.append('xmlFile', this.uploadForm.get('xmlFile')?.value);

  //   this.sunatService.processXmlFile(formData.get('xmlFile') as File).subscribe(
  //     data => {
  //       this.xmlData = data;
  //       console.log('data',this.xmlData)
  //       // Guardar datos o enviar a otro servicio
  //     },
  //     error => {
  //       console.error('Error:', error);
  //     }
  //   );
  // }

  /** Consulta comprobante SUNAT vía backend; el backend devuelve datos ya normalizados. */
  consultarComprobante() {
    if (this.consultaForm.invalid) return;

    this.loading = true;
    this.comprobante = null;
    this.cuotasSunat = [];
    this.error = '';

    const { ruc, usuario, password, proveedor, tipo_doc, serie, correlativo } = this.consultaForm.value;
    const body: any = { proveedor, tipo_doc, serie, correlativo };
    if (ruc) body.ruc = ruc;
    if (usuario) body.usuario = usuario;
    if (password) body.password = password;

    this.sunatService.consultarComprobanteSunat(body).subscribe({
      next: (response) => {
        this.loading = false;
        this.error = '';
        this.comprobante = response?.data ?? null;
                
        if (!this.comprobante) {
          iziToast.error({ title: 'Error', message: 'No se recibieron datos del comprobante', position: 'topRight' });
          return;
        }

        this.consultManual = true;

        const info = this.comprobante.informacionGeneral || {};
        const emisor = this.comprobante.emisor || {};
        const totales = this.comprobante.totales || {};
        const impuestos = this.comprobante.impuestos || {}; 

        if (info.serieNumero) {
          const [s, n] = String(info.serieNumero).split('-');
          this.compras.serie = s || '';
          this.compras.numero = n || '';
        } else {
          this.compras.serie = '';
          this.compras.numero = '';
        }
        const tipoSunat = String(info.tipoDocumento ?? this.consultaForm?.value?.tipo_doc ?? '01').trim().padStart(2, '0');
        this.asignarIdComprobantePorCodigoSunat(tipoSunat);
        this.compras.ruc = emisor.ruc || '';
        this.aplicarSucursalPrincipalSiVacia();

        const emisionIso = this.formatFechaParaInputDate(info.fechaEmision);
        this.compras.fEmision = emisionIso || '';
        let vencIso = this.formatFechaParaInputDate(info.fechaVencimiento);
        if (!vencIso && emisionIso) {
          vencIso = emisionIso;
        }
        this.compras.fVencimiento = vencIso || '';
        this.compras.observacion = this.comprobante.observacion || '';

        const sub = parseFloat(String(totales.totalValorVenta || 0).replace(',', '.')) || 0;
        const igv = parseFloat(String(impuestos.total || totales.totalImpuestos || 0).replace(',', '.')) || 0;
        const total = parseFloat(String(totales.totalVenta || totales.totalPagar || 0).replace(',', '.')) || 0;
        this.compras.subTotal = sub;
        this.compras.igv = igv;
        this.compras.total = total;

        if (this.compras.ruc) this.buscar();

        const detalles = this.comprobante.detalles;
        if (Array.isArray(detalles) && detalles.length > 0) {
          const idSucursalDefault =
            this.compras.idSucursal ||
            this.obtenerIdSucursalPrincipal() ||
            (this.sucursales?.length === 1 ? this.sucursales[0].idSucursal : null);
          const sucursalObj = idSucursalDefault ? this.sucursales?.find((s: any) => s.idSucursal === idSucursalDefault) : null;

          this.detalleCompras = detalles
            .map((item: any) => {
              if (!item) return null;
              const selectedPresentacion = this.presentacion?.find(
                (p: any) => (p.codigo || p.Codigo) === (item.unidadMedida || item.presentacion)
              );
              const presentacionObj = selectedPresentacion || { nombre: item.unidadMedida || item.presentacion || 'UND' };
              const cant = Number(item.cantidad ?? 0);
              const pUnit = Number(item.precioUnitario ?? item.pUnitario ?? 0);
              return {
                idProducto: null,
                codigo: item.codigoProducto || item.codigo || '',
                descripcion: item.descripcion || 'Sin descripción',
                cUnitario: pUnit,
                cantidad: cant,
                subtotal: cant * pUnit,
                categoria: item.categoria || {},
                presentacion: presentacionObj,
                sucursal: sucursalObj || item.sucursal || {},
                idSucursal: idSucursalDefault || item.idSucursal,
                useCorrelativo: false,
                ubicacion: item.ubicacion || '',
                fproduccion: item.fproduccion || null,
                fvencimiento: item.fvencimiento || null,
              };
            })
            .filter((x: any) => x != null);
          this.matchDetalleConProductosCargados();
          this.sumarFooterFactura();
          this.aplicarCuotasDesdeComprobanteSunat();
          this.syncSunatAuxiliaresDesdeFormulario();
        } else {
          iziToast.warning({ title: 'Aviso', message: 'El comprobante no tiene líneas de detalle', position: 'topRight' });
        }
      },
      error: (err) => {
        this.loading = false;
        this.comprobante = null;
        this.error = err?.error?.message || err?.message || 'Error al consultar el comprobante';
        iziToast.error({ title: 'Error', message: this.error, position: 'topRight' });
      },
    });
  }

  /** Consulta y descarga solo el PDF del comprobante (independiente de la consulta XML). */
  consultarYDescargarPdf() {
    if (this.consultaForm.invalid) return;

    const { ruc, usuario, password, proveedor, tipo_doc, serie, correlativo } = this.consultaForm.value;
    const body: any = { proveedor, tipo_doc, serie, correlativo };
    if (ruc) body.ruc = ruc;
    if (usuario) body.usuario = usuario;
    if (password) body.password = password;

    this.loadingPdf = true;
    this.sunatService.consultarComprobantePdf(body).subscribe({
      next: (resp) => {
        this.loadingPdf = false;
        this.sunatService.descargarPdfDesdeRespuesta(resp).catch(err => {
          console.error('Error al descargar PDF:', err);
          iziToast.error({ title: 'Error', message: 'No se pudo descargar el PDF del comprobante', position: 'topRight' });
        });
      },
      error: (err) => {
        this.loadingPdf = false;
        const msg = err?.error?.message || err?.message || 'Error al consultar PDF en SUNAT';
        iziToast.error({ title: 'PDF no disponible', message: msg, position: 'topRight' });
      }
    });
  }

    // try {
    //   const respuesta = await this.sunatService.getComprobante(ruc, tipoDocumento, serie, numero).toPromise();
    //   console.log('Respuesta del servicio:', respuesta);
    //   const { jsonData, xmlFilename } = await this.sunatService.procesarYMostrarXML(respuesta);

    //   console.log('Datos en JSON:', jsonData);
    //   console.log('XML descargado como:', xmlFilename);

    //   // Trabajar con los datos JSON...
    // } catch (error) {
    //   console.error('Error:', error);
    //   // Mostrar mensaje de error al usuario
    // }

    // this.sunatService.getComprobante(ruc, tipoDocumento, serie, numero)
    //   .subscribe({
    //     next: async (response) => {
    //       try {
    //         this.comprobante = await this.sunatService.procesarRespuesta(response);
    //       } catch (error) {
    //         iziToast.show({
    //           title: 'ERROR',
    //           titleColor: '#FF0000',
    //           color: '#FFF',
    //           class: 'text-danger',
    //           position: 'topRight',
    //           message: 'Error al procesar el comprobante. Verifique los datos e intente nuevamente.'
    //         });
    //         // this.error = 'Error al procesar el comprobante. Verifique los datos e intente nuevamente.';
    //         // console.error(error);
    //       }
    //       this.loading = false;
    //     },
    //     error: (err) => {
    //       iziToast.show({
    //           title: 'ERROR',
    //           titleColor: '#FF0000',
    //           color: '#FFF',
    //           class: 'text-danger',
    //           position: 'topRight',
    //           message: 'Error al procesar el comprobante. Verifique los datos e intente nuevamente.'
    //         });
    //       // this.error = 'Error al consultar el comprobante. Verifique los datos e intente nuevamente.';
    //        this.loading = false;
    //       // console.error(err);
    //     }
    //   });

  /**
   * Convierte a yyyy-MM-dd para <input type="date"> (consulta Factiliza/SUNAT u hoy).
   */
  private formatFechaParaInputDate(input: string | Date | null | undefined): string {
    if (input == null || input === '') return '';
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input.trim())) {
      return input.trim().slice(0, 10);
    }
    if (input instanceof Date && !isNaN(input.getTime())) {
      const y = input.getFullYear();
      const m = String(input.getMonth() + 1).padStart(2, '0');
      const d = String(input.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (typeof input === 'string') {
      const ddmm = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (ddmm) {
        let y = ddmm[3];
        if (y.length === 2) y = '20' + y;
        const m = ddmm[2].padStart(2, '0');
        const d = ddmm[1].padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
    const fromFormat = this.formatFecha(input as string | Date | null);
    if (fromFormat && /^\d{2}\/\d{2}\/\d{4}$/.test(fromFormat)) {
      const [d, m, y] = fromFormat.split('/');
      return `${y}-${m}-${d}`;
    }
    return '';
  }

  private fechaHoyInputDate(): string {
    const h = new Date();
    const y = h.getFullYear();
    const m = String(h.getMonth() + 1).padStart(2, '0');
    const d = String(h.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private obtenerIdSucursalPrincipal(): string | null {
    const list = Array.isArray(this.sucursales) ? this.sucursales : [];
    if (list.length === 0) return null;
    const principal = list.find(
      (s: any) =>
        s.esPrincipal === true ||
        s.esPrincipal === 1 ||
        s.esPrincipal === '1' ||
        String(s.nombre || '')
          .toLowerCase()
          .includes('principal')
    );
    return (principal || list[0])?.idSucursal ?? null;
  }

  /** Sucursal principal cuando el campo sigue vacío (manual o tras cargar catálogo). */
  aplicarSucursalPrincipalSiVacia(): void {
    if (!this.consultManual) return;
    if (this.compras.idSucursal != null && String(this.compras.idSucursal).trim() !== '') return;
    const id = this.obtenerIdSucursalPrincipal();
    if (id) {
      this.compras.idSucursal = id;
    }
  }

  /** Fechas de emisión/vencimiento por defecto (hoy) cuando se entra sin consulta API. */
  aplicarFechasDefaultSiSinConsulta(): void {
    if (!this.consultManual) return;
    const hoy = this.fechaHoyInputDate();
    if (!this.compras.fEmision || String(this.compras.fEmision).trim() === '') {
      this.compras.fEmision = hoy;
    }
    if (!this.compras.fVencimiento || String(this.compras.fVencimiento).trim() === '') {
      this.compras.fVencimiento = this.compras.fEmision || hoy;
    }
  }

  asignarIdComprobantePorCodigoSunat(codigoSunatRaw: string | null | undefined): void {
    const cod = String(codigoSunatRaw ?? '')
      .trim()
      .padStart(2, '0');
    const lista = Array.isArray(this.comprobantes) ? this.comprobantes : [];
    if (lista.length === 0) {
      this.codigoSunatCompraPendiente = cod;
      this.compras.idComprobante = '';
      return;
    }
    this.codigoSunatCompraPendiente = null;
    const found =
      lista.find((c: any) => String(c.codigo ?? '').trim().padStart(2, '0') === cod) ||
      lista.find((c: any) => String(c.codigo ?? '').trim() === cod.trim());
    if (found && found.idComprobante != null) {
      this.compras.idComprobante = String(found.idComprobante);
    } else {
      this.compras.idComprobante = '';
    }
  }

  etiquetaTipoComprobanteCabecera(): string {
    const id = this.compras.idComprobante;
    const lista = Array.isArray(this.comprobantes) ? this.comprobantes : [];
    const comp = lista.find((c: any) => String(c.idComprobante) === String(id));
    const codigo = comp?.codigo != null ? String(comp.codigo).trim() : '';
    if (codigo) return this.getTipoComprobanteLabel(codigo);
    if (id != null && String(id).trim() !== '') return this.getTipoComprobanteLabel(String(id));
    return '-';
  }

  etiquetaFechaMostrar(fechaIsoODdMm: string | null | undefined): string {
    if (!fechaIsoODdMm || String(fechaIsoODdMm).trim() === '') return '-';
    const s = String(fechaIsoODdMm).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-');
      return `${d}/${m}/${y}`;
    }
    return s;
  }

  private formatFecha(input: string | Date | null): string {
    if (!input) return '';
    // Si ya es Date
    const asDate = input instanceof Date ? input : new Date(String(input));
    if (!isNaN(asDate.getTime())) {
      const d = asDate;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }

    // fallback: intentar parsear formatos comunes dd/mm/yyyy o dd-mm-yyyy
    const parts = String(input).match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/
    );
    if (parts) {
      const day = parts[1].padStart(2, '0');
      const month = parts[2].padStart(2, '0');
      let year = parts[3];
      if (year.length === 2) year = '20' + year;
      return `${day}/${month}/${year}`;
    }

    return '';
  }

  initData() {
    this._comprobanteService.obtenerComprobantesCompra().subscribe(
      (response) => {
        this.comprobantes = response.data;
        if (this.codigoSunatCompraPendiente) {
          this.asignarIdComprobantePorCodigoSunat(this.codigoSunatCompraPendiente);
          this.codigoSunatCompraPendiente = null;
        }
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
        this.sincronizarEstadoPagoSiCreditoOperacion();
      },
      (error) => {
              }
    );

    this._tablasSunatService.obtener_medios_pago().subscribe(
      (response) => {
        this.mediosPago = response.data;
        this.sincronizarEstadoPagoSiCreditoOperacion();
      },
      (error) => {
              }
    );

    this._documentoService.getFormasPago().subscribe({
      next: (response) => {
        this.formasPago = response.data || [];
        const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
        if (efectivo) {
          this.formaPagoSeleccionada = { ...efectivo };
        }
      },
      error: () => {
        this.formasPago = [];
      },
    });

    this._marcaService.obtenerMarcas().subscribe(
      (response) => {
        this.marcas = response.data;
        this.marcas.sort((a: { nombre: string }, b: { nombre: any }) =>
          a.nombre.localeCompare(b.nombre)
        );
              },
      (error) => {
              }
    );

    this._categoriaService.obtener_categorias().subscribe(
      (response) => {
        this.categoria = response.data;
              },
      (error) => {
              }
    );

    this._presentacionService.obtener_presentaciones().subscribe(
      (response) => {
        this.presentacion = response.data;
              },
      (error) => {
              }
    );

    this._sucursalService.obtener_sucursal_idempresa().subscribe(
      (response) => {
        this.sucursales = response.data;
        this.aplicarSucursalPrincipalSiVacia();
              },
      (error) => {
              }
    );

    this._productoService.obtenerProductosCompras().subscribe(
      (response) => {
        if (response.data != undefined) {
          this.productos = response.data;
        }
        this.productos_const = this.productos;
        this.buscarProductos();
      },
      (error) => {
      }
    );

    this._comprasService.obtener_correlativo_empresa().subscribe({
      next: (response) => {
        const data = response?.data?.[0];
        this.correlativo = data && typeof data === 'object' ? data : this.correlativo;
      },
      error: (err) => {
        console.error('obtener_correlativo_empresa:', err);
        // Mantener correlativo inicial { numero: 0 } si la API falla (ej. 500)
      },
    });

    // this._sucursalService.obtener_stock_sucursales_idempresa().subscribe(
    //   (response) => {
    //     this.stockSucursales = response.data;
    //     if (response.data != undefined) {
    //       if (
    //         this.productos &&
    //         this.sucursales &&
    //         this.categoria &&
    //         this.presentacion &&
    //         this.stockSucursales
    //       ) {
    //         // Realizar operaciones con los arrays
    //         console.log('this.productos', this.productos);
    //         console.log('this.sucursales', this.sucursales);
    //         console.log('this.categoria', this.categoria);
    //         console.log('this.presentacion', this.presentacion);
    //         console.log('this.stockSucursales', this.stockSucursales);

    //         //quiero buscar en response.data el idProducto y traer todo el objeto del idProducto y agregarlo a this.stockSucursales

    //         this.stockSucursales.forEach((element: any) => {
    //           //buscar en this.productos el codigo y traer todo el objeto del codigo
    //           const selectedObject = this.productos.find(
    //             (item: any) => item.idProducto == element.idProducto
    //           );
    //           element.producto = selectedObject;
    //           // Ahora, selectedObject contiene toda la información del elemento seleccionado
    //           //buscar en this.sucursales el idSucursal y traer todo el objeto del idSucursal
    //           const selectedObjectSucursal = this.sucursales.find(
    //             (item: any) => item.idSucursal == element.idSucursal
    //           );
    //           element.sucursal = selectedObjectSucursal;

    //           //buscar en this.categoria el idCategoria y traer todo el objeto del idCategoria
    //           const selectedObjectCategoria = this.categoria.find(
    //             (item: any) => item.idCategoria == element.producto.idCategoria
    //           );
    //           element.categoria = selectedObjectCategoria;

    //           //buscar en this.presentacion el idPresentacion y traer todo el objeto del idPresentacion
    //           const selectedObjectPresentacion = this.presentacion.find(
    //             (item: any) =>
    //               item.idPresentacion == element.producto.idPresentacion
    //           );
    //           element.presentacion = selectedObjectPresentacion;

    //           //buscar en this.marcas el idMarca y traer todo el objeto del idMarca
    //           const selectedObjectMarca = this.marcas.find(
    //             (item: any) => item.idMarca == element.producto.idMarca
    //           );
    //           element.marca = selectedObjectMarca;

    //           console.log('selectedObjectMarca', selectedObjectMarca);
    //         });

    //         console.log('this.stockSucursales', this.stockSucursales);
    //       } else {
    //         console.error('Uno de los arrays es undefined o está vacío.');
    //       }

    //       this.stockSucursales_const = this.stockSucursales;
    //       console.log('this.stockSucursales', this.stockSucursales);
    //     } else {
    //       this.stockSucursales = [];
    //     }
    //   },
    //   (error) => {
    //     console.log(error);
    //   }
    // );
  }

  cargarSucursales() {
    this.sucursales = [];
    this._sucursalService.obtener_sucursal_idempresa().subscribe(
      (response) => {
        this.sucursales = response.data;
        this.aplicarSucursalPrincipalSiVacia();
              },
      (error) => {
              }
    );
  }

  cargarCategorias() {
    this.categoria = [];
    this._categoriaService.obtener_categorias().subscribe(
      (response) => {
        this.categoria = response.data;
        this.categoria.sort((a: { nombre: string }, b: { nombre: any }) =>
          a.nombre.localeCompare(b.nombre)
        );
              },
      (error) => {
              }
    );
  }

  cargarMarcas() {
    this.marcas = [];
    this._marcaService.obtenerMarcas().subscribe(
      (response) => {
        this.marcas = response.data;
        this.marcas.sort((a: { nombre: string }, b: { nombre: any }) =>
          a.nombre.localeCompare(b.nombre)
        );
              },
      (error) => {
              }
    );
  }

  buscar() {
        
    this._proveedoresService.obtener_proveedor_ruc(this.compras.ruc).subscribe({
      next: (response) => {
        if (response?.data && response.data.length > 0) {
          this.proveedores = response.data[0];
          this.compras.idProveedor = this.proveedores?.idProveedor;
          this.compras.idDocumento = this.proveedores?.idDocumento;
        } else {
          this.proveedores = {};
          this.compras.idProveedor = '';
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: 'El proveedor no existe.',
          });
        }
      },
      error: (err) => {
        console.error('buscar proveedor:', err);
        this.proveedores = {};
        this.compras.idProveedor = '';
      },
    });
  }

  quitar(idx: any, subtotal: any) {
    this.detalleCompras.splice(idx, 1);
    this.compras.total = this.compras.total - subtotal;
    this.sumarDetalleCompras();
    this.sumarFooterFactura();
  }

  seleccionar(idx: number) {
    //quiero agregar a this.nuevoProducto el objeto seleccionado
    if (idx >= 0 && idx < this.stockSucursales.length) {
      this.prodSelecionado = this.stockSucursales[idx];
      
      this.nuevoProducto.idProducto = this.prodSelecionado.idProducto;
      this.nuevoProducto.codigo = this.prodSelecionado.producto.Codigo;
      this.nuevoProducto.descripcion =
        this.prodSelecionado.producto.descripcion;
      this.nuevoProducto.cUnitario = this.prodSelecionado.producto.cUnitario;
      this.nuevoProducto.idCategoria =
        this.prodSelecionado.producto.idCategoria;
      this.nuevoProducto.idMarca = this.prodSelecionado.producto.idMarca;
      this.nuevoProducto.idPresentacion =
        this.prodSelecionado.producto.idPresentacion;
      this.nuevoProducto.idSucursal = this.prodSelecionado.idSucursal;
      this.nuevoProducto.cantidad = 0;
      this.nuevoProducto.cantidadAnterior = this.prodSelecionado.cantidad;
      this.nuevoProducto.ubicacion = this.prodSelecionado.ubicacion;
      this.nuevoProducto.idLote = this.prodSelecionado.idLote ?? this.prodSelecionado.idStockSucursal;
      this.nuevoProducto.idEmpresa = this.prodSelecionado.idEmpresa;

      this.nuevoProducto.fProduccion =
        this.prodSelecionado.producto.fProduccion;
      //quiero convertir la fecha de produccion a string en formato yyyy-mm-dd

      this.nuevoProducto.fVencimiento =
        this.prodSelecionado.producto.fVencimiento;
    }

      }

  //ahora quiero seleccionar el index de la tabla detalleCompra y pasar los datos del registro al objeto nuevoProducto y mostrarlo en un modal
  seleccionarDetalle(idx: number) {
    this.indexDetalle = idx;
        //quiero agregar a this.nuevoProducto el objeto seleccionado
    if (idx >= 0 && idx < this.detalleCompras.length) {
      this.nuevoProducto = this.detalleCompras[idx];
      
      //quiero buscar en this.productos el codigo y traer todo el objeto del codigo
      const selectedObject = this.productos.find(
        (item: any) => item.idProducto == this.nuevoProducto.idProducto
      );
      this.nuevoProducto.producto = selectedObject;

      //buscar en this.sucursales el idSucursal y traer todo el objeto del idSucursal
      const selectedObjectSucursal = this.sucursales.find(
        (item: any) => item.idSucursal == this.nuevoProducto.idSucursal
      );
      this.nuevoProducto.sucursal = selectedObjectSucursal;

      //buscar en this.categoria el idCategoria y traer todo el objeto del idCategoria
      const selectedObjectCategoria = this.categoria.find(
        (item: any) => item.idCategoria == this.nuevoProducto.idCategoria
      );
      this.nuevoProducto.categoria = selectedObjectCategoria;

      //buscar en this.presentacion el idPresentacion y traer todo el objeto del idPresentacion
      const selectedObjectPresentacion = this.presentacion.find(
        (item: any) => item.idPresentacion == this.nuevoProducto.idPresentacion
      );
      this.nuevoProducto.presentacion = selectedObjectPresentacion;

      //buscar en this.marcas el idMarca y traer todo el objeto del idMarca
      const selectedObjectMarca = this.marcas.find(
        (item: any) => item.idMarca == this.nuevoProducto.idMarca
      );
      this.nuevoProducto.marca = selectedObjectMarca;
    }
  }

  buscarDescripcion() {
    
    if (this.filtroConsulta) {
      // quiero bucar en this.stockSucursales el codigo o la descripcion que coincida con this.filtroConsulta
      var term = new RegExp(this.filtroConsulta, 'i');
      this.stockSucursales = this.stockSucursales_const.filter(
        (item: {
          producto: { descripcion: string; Codigo: string };
          marca: { nombre: string };
        }) =>
          term.test(item.producto.descripcion) ||
          term.test(item.producto.Codigo) ||
          term.test(item.marca.nombre)
      );
      
      //
      // var term = new RegExp(this.filtroConsulta, 'i');
      // this.stockSucursales = this.stockSucursales_const.filter((item: { descripcion: string; Codigo: string; }) => term.test(item.descripcion) || term.test(item.Codigo));
      // console.log('this.productos despues de la busqueda', this.stockSucursales);
    } else {
      this.stockSucursales = this.stockSucursales_const;
    }
  }

  onInputChangesCompCompras() {
    this.compras.compCompra = this.compras.serie + '-' + this.compras.numero;
            
    let idProveedor = {};
    idProveedor = this.compras.idProveedor;

    // this._comprasService.buscar_comprobante_idProveedor(idProveedor).subscribe(
    //   (response) => {
    //     if (response.data != undefined) {
    //       console.log('response.data', response.data);

    //       //quiero buscar this.compras.compCompra en response.data y si existe mostrar un mensaje que el comprobante ya existe
    //       const selectedObject = response.data.find(
    //         (item: any) => item.compCompra == this.compras.compCompra
    //       );
    //       console.log('selectedObject', selectedObject);
    //       if (selectedObject) {
    //         iziToast.show({
    //           title: 'ERROR',
    //           titleColor: '#FF0000',
    //           color: '#FFF',
    //           class: 'text-danger',
    //           position: 'topRight',
    //           message: 'El comprobante ya existe.',
    //         });
    //         this.compras.numero = '';
    //       }
    //     }
    //   },
    //   (error) => {
    //     console.log(error);
    //   }
    // );
  }

  onselectMarca(selectedValue: any) {
        const selectedObject = this.marcas.find(
      (item: any) => item.idMarca == selectedValue
    );
    this.nuevoProducto.marca = selectedObject;
          }

  onSelectPresentacion(selectedValue: any) {
    const selectedObject = this.presentacion.find(
      (item: any) => item.idPresentacion == selectedValue
    );
    this.nuevoProducto.presentacion = selectedObject;
    // Ahora, selectedObject contiene toda la información del elemento seleccionado
          }

  onSelectCategoria(selectedValue: any) {
    const selectedObject = this.categoria.find(
      (item: any) => item.idCategoria == selectedValue
    );
    this.nuevoProducto.categoria = selectedObject;
    // Ahora, selectedObject contiene toda la información del elemento seleccionado
          }

  onSelectSucursal(selectedValue: any) {
    const selectedObject = this.sucursales.find(
      (item: any) => item.idSucursal == selectedValue
    );
    this.nuevoProducto.sucursal = selectedObject;
    // Ahora, selectedObject contiene toda la información del elemento seleccionado
          }

  onCheckboxChange() {
    if (this.nuevoProducto.useCorrelativo) {
      
      // Realiza acciones cuando el checkbox está marcado

      this.nuevoProducto.codigo = this.correlativo.numero;
      this.nuevoProducto.idProducto = undefined;

          } else {
            // Realiza acciones cuando el checkbox NO está marcado
      this.nuevoProducto.codigo = '';
    }
  }

  agregarProductoNuevo() {
    //quiero agregar la condicion di idProducto, idpresentacion, idcategoria y idsucursal no estan vacios

    // Verificar si las fechas son válidas y convertirlas a string
    this.nuevoProducto.fProduccion = this.nuevoProducto.fProduccion || '';
    this.nuevoProducto.fvencimiento = this.nuevoProducto.fVencimiento || '';

    // Validar que no sean objetos Date
    if (this.nuevoProducto.fProduccion instanceof Date) {
      this.nuevoProducto.fProduccion = '';
    }
    if (this.nuevoProducto.fVencimiento instanceof Date) {
      this.nuevoProducto.fVencimiento = '';
    }

    if (
      this.nuevoProducto.idPresentacion != undefined &&
      this.nuevoProducto.idCategoria != undefined &&
      this.nuevoProducto.idSucursal != undefined &&
      this.nuevoProducto.idMarca != undefined &&
      this.nuevoProducto.codigo != '' &&
      this.nuevoProducto.descripcion != ''
    ) {
      this.detalleCompras.push(this.nuevoProducto);
      
      try {
        this.detalleCompras.forEach((element: any) => {
          if (element.idProducto != undefined) {
            // ... Resto del código que maneja los datos cuando idProducto está definido

            //buscar en this.productos el codigo y traer todo el objeto del codigo
            const selectedObjectMarca = this.marcas.find(
              (item: any) => Number(item.idMarca) == Number(element.idMarca)
            );
            element.marca = selectedObjectMarca;

            //buscar en this.productos el codigo y traer todo el objeto del codigo
            const selectedObject = this.productos.find(
              (item: any) => item.idProducto == element.idProducto
            );
            element.producto = selectedObject;
            // Ahora, selectedObject contiene toda la información del elemento seleccionado
            //buscar en this.sucursales el idSucursal y traer todo el objeto del idSucursal
            const selectedObjectSucursal = this.sucursales.find(
              (item: any) => item.idSucursal == element.idSucursal
            );
            element.sucursal = selectedObjectSucursal;

            //buscar en this.categoria el idCategoria y traer todo el objeto del idCategoria
            const selectedObjectCategoria = this.categoria.find(
              (item: any) => item.idCategoria == element.idCategoria
            );
            element.categoria = selectedObjectCategoria;

            //buscar en this.presentacion el idPresentacion y traer todo el objeto del idPresentacion
            const selectedObjectPresentacion = this.presentacion.find(
              (item: any) => item.idPresentacion == element.idPresentacion
            );
            element.presentacion = selectedObjectPresentacion;
          } else {
            // ... Resto del código que maneja los datos cuando idProducto no está definido
            this.detalleCompras.forEach((element: any) => {
              //buscar en this.sucursales el idSucursal y traer todo el objeto del idSucursal
              const selectedObjectSucursal = this.sucursales.find(
                (item: any) => item.idSucursal == element.idSucursal
              );
              element.sucursal = selectedObjectSucursal;

              //buscar en this.categoria el idCategoria y traer todo el objeto del idCategoria
              const selectedObjectCategoria = this.categoria.find(
                (item: any) => item.idCategoria == element.idCategoria
              );
              element.categoria = selectedObjectCategoria;

              //buscar en this.presentacion el idPresentacion y traer todo el objeto del idPresentacion
              const selectedObjectPresentacion = this.presentacion.find(
                (item: any) => item.idPresentacion == element.idPresentacion
              );
              element.presentacion = selectedObjectPresentacion;
            });
          }
        });
      } catch (error) {
              }
    } else {
      iziToast.show({
        title: 'ERROR',
        titleColor: '#FF0000',
        color: '#FFF',
        class: 'text-danger',
        position: 'topRight',
        message: 'Debe llenar todos los campos obligatorios (*).',
      });
    }

    
    //deseo multiplicar el precio por la cantidad de this.nuevoProducto
    this.nuevoProducto.subtotal =
      this.nuevoProducto.cUnitario * this.nuevoProducto.cantidad;
    
    
    this.compras.subTotal = 0;
    this.detalleCompras.forEach((element: any) => {
      const subtotalItem = element.subtotal ?? ((Number(element.cantidad) || 0) * (Number(element.cUnitario ?? element.pUnitario) || 0));
      element.subtotal = subtotalItem;
      this.compras.subTotal = this.compras.subTotal + subtotalItem;
    });

    this.nuevoProducto = {};
    if (this.correlativo && typeof this.correlativo === 'object') {
      this.correlativo.numero = (Number(this.correlativo.numero) || 0) + 1;
    }
    this.sumarFooterFactura();
  }

  //aqui quiero editar el producto modificado y agregarlo a detalleCompras
  actualizarDetalleCompras(idx: number) {
    //deseo multiplicar el precio por la cantidad de this.nuevoProducto
    this.nuevoProducto.subtotal =
      this.nuevoProducto.cUnitario * this.nuevoProducto.cantidad;
    if (idx >= 0 && idx < this.detalleCompras.length) {
      // Solo actualiza el elemento en el índice dado
      this.detalleCompras[idx] = { ...this.nuevoProducto };

      this.nuevoProducto = {};
      this.sumarDetalleCompras();
      this.sumarFooterFactura();
      if (this.correlativo && typeof this.correlativo === 'object') {
        this.correlativo.numero = (Number(this.correlativo.numero) || 0) + 1;
      }
    }
  }

  sumarDetalleCompras() {
    this.compras.subTotal = 0;
    this.detalleCompras.forEach((element: any) => {
      const subtotalItem = element.subtotal ?? ((Number(element.cantidad) || 0) * (Number(element.cUnitario ?? element.pUnitario) || 0));
      element.subtotal = subtotalItem;
      this.compras.subTotal = this.compras.subTotal + subtotalItem;
      element.total = (Number(element.cantidad) || 0) * (Number(element.pUnitario ?? element.cUnitario) || 0);
    });
    this.sumarFooterFactura();
  }

  sumarFooterFactura() {
        
    this.compras.igv = 0;
    this.compras.exonerado = 0;
    this.compras.gratuito = 0;
    this.compras.descuentos = 0;
    this.compras.otrosCargos = 0;
    this.compras.total = 0;

    this.compras.total =
      this.compras.subTotal +
      this.compras.igv +
      this.compras.otrosCargos -
      this.compras.descuentos;

        this.onInput();
  }

  buscarFactura() {
    this.compras.compCompra = this.compras.serie + '-' + this.compras.numero;
    this.compras.idProveedor = this.proveedores?.idProveedor ?? '';
  }

  /**
   * Al hacer clic en "Registrar Compra": si es al crédito procesa directo; si es contado abre el modal de formas de pago para completar el pago y luego procesar.
   */
  prepararRegistrarCompra(): void {
    this.compras.compCompra = this.compras.serie + '-' + this.compras.numero;
    if (!this.validarCamposObligatoriosParaAbrir()) {
      return;
    }
    if (this.esCompraAlCreditoParaSunat()) {
      this.registrarCompras();
      return;
    }
    this.modalPagoParaRegistrar = true;
    this.abrirModalFormaPago();
    const modalEl = document.getElementById('modalPagoCompra');
    if (modalEl && typeof bootstrap !== 'undefined') {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  /**
   * Validación mínima para poder abrir el modal o procesar (no exige detalle de pago si no es crédito; eso se valida al procesar desde el modal).
   */
  private validarCamposObligatoriosParaAbrir(): boolean {
    const fechaEmisionOk = !!this.compras.fEmision && String(this.compras.fEmision).trim() !== '';
    const fechaVencOk = !!this.compras.fVencimiento && String(this.compras.fVencimiento).trim() !== '';
    const idProveedorOk = !!this.compras.idProveedor && String(this.compras.idProveedor).trim() !== '';
    const idSucursalOk = !!this.compras.idSucursal && String(this.compras.idSucursal).trim() !== '';
    const idMonedaOk = !!this.compras.idMoneda;
    const idEstadoPagoOk = !!this.compras.idEstadoPago;
    const totalOk = !isNaN(Number(this.compras.total)) && Number(this.compras.total) > 0;
    const detalleOk = Array.isArray(this.detalleCompras) && this.detalleCompras.length > 0;
    const esCredito = this.esCompraAlCredito();
    let idMediosPagoOk = true;
    if (esCredito) {
      idMediosPagoOk = !!this.compras.idMediosPago;
    }
    if (!fechaEmisionOk || !fechaVencOk || !idProveedorOk || !idSucursalOk || !idMonedaOk || !idEstadoPagoOk || !idMediosPagoOk || !totalOk || !detalleOk) {
      this.mostrarErrorValidacion(esCredito);
      return false;
    }
    if (!this.validarComprobanteSunatParaRegistrar()) {
      return false;
    }
    return true;
  }

  /**
   * Llamado desde el modal de formas de pago al hacer clic en "Procesar compra". Valida que el total del detalle de pago coincida y registra la compra (guardando idMediosPago para arqueo).
   */
  procesarCompraDesdeModal(): void {
    const totalPago = this.calcularTotalTablaPago();
    const totalCompra = Number(this.compras.total) || 0;
    if (this.detallePago.length === 0) {
      iziToast.show({
        title: 'ERROR',
        titleColor: '#FF0000',
        color: '#FFF',
        class: 'text-danger',
        position: 'topRight',
        message: 'Agregue al menos una forma de pago.',
      });
      return;
    }
    if (Math.abs(totalPago - totalCompra) > 0.01) {
      iziToast.show({
        title: 'ERROR',
        titleColor: '#FF0000',
        color: '#FFF',
        class: 'text-danger',
        position: 'topRight',
        message: 'El total del detalle de pago no coincide con el total de la compra.',
      });
      return;
    }
    this.compras.idMediosPago = String(this.detallePago[0].idFormaPago);
    this.cerrarModalPagoCompra();
    this.modalPagoParaRegistrar = false;
    this.registrarCompras();
  }

  cerrarModalPagoCompra(): void {
    const modalEl = document.getElementById('modalPagoCompra');
    if (modalEl && typeof bootstrap !== 'undefined') {
      const inst = bootstrap.Modal.getInstance(modalEl);
      if (inst) inst.hide();
    }
  }

  registrarCompras() {
    this.compras.compCompra = this.compras.serie + '-' + this.compras.numero;
    this.loadButton = true;

    if (!this.validarCamposObligatorios()) {
      return;
    }

    // Solo contado: idFormaPago es de FormasPago; Compras.idMediosPago tiene FK a MediosPago (no pisar en crédito por medio/estado).
    if (!this.esCompraAlCreditoParaSunat() && this.detallePago.length > 0) {
      this.compras.idMediosPago = String(this.detallePago[0].idFormaPago);
    }

    const idSucursalCompra = this.compras.idSucursal;
    const cuerpoCompra: Record<string, unknown> = { ...this.compras };
    const snap = this.buildComprobanteSunatPayload();
    if (snap) {
      cuerpoCompra['comprobanteSunat'] = snap;
    }
    this._comprasService.crear_compra(cuerpoCompra).pipe(
      switchMap((response) => {
        if (response.data == null) {
          return of(null);
        }
        this.idCompra = response.data;
        const observables: Observable<any>[] = [];
        for (const element of this.detalleCompras) {
          const idSucursalDetalle = element.sucursal?.idSucursal ?? element.idSucursal ?? idSucursalCompra;
          const idPresentacionDetalle = element.presentacion?.idPresentacion ?? element.idPresentacion;
          const subtotalDetalle = element.subtotal ?? (Number(element.cantidad) * Number(element.cUnitario ?? element.pUnitario ?? 0));
          const usarCorrelativoLinea = !!element.useCorrelativo;
          const codigoLinea = usarCorrelativoLinea
            ? ''
            : String(element.codigo ?? element.Codigo ?? '').trim();

          const nuevoProducto: ProductoCreate = {
            ...(element.idProducto ? { idProducto: String(element.idProducto) } : {}),
            Codigo: codigoLinea,
            useCorrelativo: usarCorrelativoLinea,
            idCategoria: Number(element.idCategoria ?? element.categoria?.idCategoria),
            descripcion: element.descripcion,
            idPresentacion: Number(idPresentacionDetalle),
            cUnitario: Number(element.cUnitario ?? element.pUnitario ?? 0),
            fProduccion: element.fProduccion ?? element.fproduccion,
            fVencimiento: element.fVencimiento ?? element.fvencimiento,
            idMarca: Number(element.idMarca ?? element.marca?.idMarca),
          };

          const nuevoDetalleCompra = {
            idSucursal: idSucursalDetalle,
            idCompra: this.idCompra,
            cantidad: Number(element.cantidad),
            idPresentacion: Number(idPresentacionDetalle) || 1,
            pUnitario: parseFloat(String(element.cUnitario ?? element.pUnitario ?? 0)),
            total: subtotalDetalle,
            idProducto: element.idProducto || null,
            ubicacion: element.ubicacion ?? null,
            fechaVencimiento: element.fVencimiento || element.fvencimiento || null,
            asignarPorDefecto: this.asignarUbicacionPorDefecto,
          };

          if (element.idProducto == null || element.idProducto === undefined || element.idProducto === '') {
            observables.push(
              this._productoService.crearProducto(nuevoProducto).pipe(
                switchMap((pr) => {
                  if (pr?.data != null) {
                    nuevoDetalleCompra.idProducto = pr.data;
                    return this._comprasService.crear_detalle_compras_idcompra(nuevoDetalleCompra);
                  }
                  return throwError(
                    () => new Error('El servidor no devolvió el id del producto nuevo.')
                  );
                }),
                catchError((err: unknown) => {
                  console.error('Error creando producto:', err);
                  const msg =
                    (err as { error?: { message?: string } })?.error?.message ||
                    (err as Error)?.message ||
                    'No se pudo crear el producto.';
                  iziToast.show({
                    title: 'ERROR',
                    titleColor: '#FF0000',
                    color: '#FFF',
                    position: 'topRight',
                    message: msg,
                  });
                  return throwError(() => err);
                })
              )
            );
          } else {
            const payloadActualizar: ProductoCreate = { ...nuevoProducto };
            delete (payloadActualizar as { useCorrelativo?: boolean }).useCorrelativo;
            observables.push(
              this._productoService.actualizarProducto(element.idProducto, payloadActualizar).pipe(
                switchMap(() => this._comprasService.crear_detalle_compras_idcompra(nuevoDetalleCompra)),
                catchError((err: unknown) => {
                  console.error('Error actualizando producto:', err);
                  const msg =
                    (err as { error?: { message?: string } })?.error?.message ||
                    (err as Error)?.message ||
                    'No se pudo actualizar el producto.';
                  iziToast.show({
                    title: 'ERROR',
                    titleColor: '#FF0000',
                    color: '#FFF',
                    position: 'topRight',
                    message: msg,
                  });
                  return throwError(() => err);
                })
              )
            );
          }
        }
        if (observables.length === 0) {
          return of(null);
        }
        return forkJoin(observables);
      }),
      finalize(() => {
        this.loadButton = false;
      })
    ).subscribe({
      next: (responses: any) => {
        this.editarCorrelativo();
        iziToast.show({
          title: 'SUCCESS',
          titleColor: '#1DC74C',
          color: '#FFF',
          class: 'text-success',
          position: 'topRight',
          message: 'Compra registrada correctamente.',
        });
        const idLotes = Array.isArray(responses)
          ? responses.map((r: any) => r?.idLote).filter(Boolean)
          : [];
        this.afterCompraRegistrada(idLotes);
      },
      error: (err: unknown) => {
        const e = err as { error?: { message?: string }; message?: string };
        iziToast.show({
          title: 'ERROR',
          titleColor: '#FF0000',
          color: '#FFF',
          class: 'text-danger',
          position: 'topRight',
          message: e?.error?.message || e?.message || 'Error al registrar la compra.',
        });
      },
    });
  }

  /**
   * Match del detalle de compras con productos ya cargados: si la descripción coincide, asigna idProducto
   * y copia los datos del producto (código, categoría, marca, presentación) para mostrar en la tabla.
   */
  private matchDetalleConProductosCargados(): void {
    const lista = Array.isArray(this.productos_const) ? this.productos_const : [];
    const mapDescAProducto: Record<string, any> = {};
    lista.forEach((p: any) => {
      const desc = (p.descripcion ?? '').toString().trim();
      if (desc && p.idProducto && !mapDescAProducto[desc]) mapDescAProducto[desc] = p;
    });
    let coincidencias = 0;
    const detalleCoincidencias: { descripcion: string; idProducto: string }[] = [];
    const detalleSinMatch: string[] = [];
    this.detalleCompras.forEach((d: any) => {
      const key = (d.descripcion ?? '').toString().trim();
      const producto = key ? mapDescAProducto[key] : null;
      if (producto) {
        d.idProducto = producto.idProducto;
        d.codigo = producto.codigo ?? d.codigo;
        d.idCategoria = producto.idCategoria ?? d.idCategoria;
        d.idMarca = producto.idMarca ?? d.idMarca;
        d.idPresentacion = producto.idPresentacion ?? d.idPresentacion;
        d.categoria = typeof producto.categoria === 'object' && producto.categoria != null
          ? producto.categoria
          : { nombre: (producto.categoria ?? '') || '-' };
        d.marca = typeof producto.marca === 'object' && producto.marca != null
          ? producto.marca
          : { nombre: (producto.marca ?? '') || '-' };
        d.presentacion = producto.codigoPresentacion != null || producto.descripcionPres != null
          ? {
              codigo: producto.codigoPresentacion ?? producto.presentacion?.codigo ?? '',
              descripcion: producto.descripcionPres ?? producto.presentacion?.descripcion ?? '',
              Descripcion: producto.descripcionPres ?? producto.presentacion?.Descripcion ?? '',
              idPresentacion: producto.idPresentacion
            }
          : (d.presentacion || { codigo: '-', Descripcion: '-' });
        d.idSucursal = producto.idSucursal ?? d.idSucursal;
        d.sucursal = typeof producto.sucursal === 'object' && producto.sucursal != null
          ? producto.sucursal
          : { nombre: (producto.sucursal ?? '') || '-', idSucursal: producto.idSucursal };
        coincidencias++;
        detalleCoincidencias.push({ descripcion: key, idProducto: producto.idProducto });
      } else if (key) {
        detalleSinMatch.push(key);
      }
    });
    
  }

  /**
   * Después de registrar compra exitosamente, ofrece gestionar inventario.
   * Si no se asignó ubicación por defecto, pasa idLotes para mostrar solo lotes de esta compra.
   */
  private afterCompraRegistrada(idLotes?: string[]): void {
    const list = idLotes ?? [];
    setTimeout(() => {
      const mensaje = this.asignarUbicacionPorDefecto
        ? 'El stock se asignó a la ubicación por defecto.\n\n¿Desea ver o editar los lotes e inventario?'
        : '¿Desea asignar ahora las ubicaciones a los lotes creados?\n\nPuede hacerlo desde Inventario más tarde si lo prefiere.';
      const respuesta = confirm(mensaje);
      if (respuesta) {
        const filtros: any = { idSucursal: this.compras.idSucursal };
        if (!this.asignarUbicacionPorDefecto && list.length > 0) {
          filtros.idLotes = list;
        }
        this.inventarioModal.abrirLoteList(filtros)
          .then(() => this._router.navigate(['/compras']))
          .catch(() => this._router.navigate(['/compras']));
      } else {
        this._router.navigate(['/compras']);
      }
    }, 500);
  }

  /**
   * Abre modal para gestionar lotes desde un detalle de compra
   */
  gestionarLoteDetalle(detalle: any): void {
    if (!detalle.idLote) {
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        message: 'Este producto aún no tiene lote asignado',
        position: 'topRight'
      });
      return;
    }
    
    this.inventarioModal.abrirLoteForm(detalle.idLote).then(result => {
      if (result?.success) {
        // Recargar datos si es necesario
      }
    }).catch(() => {});
  }

  /**
   * Abre modal para asignar ubicaciones a un lote desde detalle de compra
   */
  asignarUbicacionesDetalle(detalle: any): void {
    if (!detalle.idLote) {
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        message: 'Este producto aún no tiene lote asignado',
        position: 'topRight'
      });
      return;
    }
    
    /** Preferir stock actual del lote; `detalle.cantidad` es la de la línea de compra y puede quedar desactualizada tras más ingresos. */
    const cantidadTotal =
      detalle.cantidadDisponible != null && detalle.cantidadDisponible !== ''
        ? Number(detalle.cantidadDisponible)
        : Number(detalle.cantidad) || 0;
    this.inventarioModal.abrirAsignarUbicaciones(detalle.idLote, cantidadTotal).then(result => {
      if (result?.success) {
        // Actualizar vista si es necesario
      }
    }).catch(() => {});
  }

  /**
   * Abre modal de lista de lotes desde compras
   */
  abrirGestionLotes(): void {
    this.inventarioModal.abrirLoteList({ idSucursal: this.compras.idSucursal })
      .then(() => {})
      .catch(() => {});
  }

  private validarCamposObligatorios(): boolean {
    const fechaEmisionOk =
      !!this.compras.fEmision && String(this.compras.fEmision).trim() !== '';
    const fechaVencOk =
      !!this.compras.fVencimiento && String(this.compras.fVencimiento).trim() !== '';
    const idProveedorOk = !!this.compras.idProveedor && String(this.compras.idProveedor).trim() !== '';
    const idSucursalOk = !!this.compras.idSucursal && String(this.compras.idSucursal).trim() !== '';
    const idMonedaOk = !!this.compras.idMoneda;
    const idEstadoPagoOk = !!this.compras.idEstadoPago;
    const totalOk = !isNaN(Number(this.compras.total)) && Number(this.compras.total) > 0;
    const detalleOk = Array.isArray(this.detalleCompras) && this.detalleCompras.length > 0;

    const esCredito = this.esCompraAlCreditoParaSunat();
    let idMediosPagoOk = !!this.compras.idMediosPago;
    if (!esCredito) {
      if (this.detallePago.length > 0) {
        const totalPago = this.calcularTotalTablaPago();
        const totalCompra = Number(this.compras.total) || 0;
        if (Math.abs(totalPago - totalCompra) > 0.01) {
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: 'El total del detalle de pago no coincide con el total de la compra.',
          });
          this.loadButton = false;
          return false;
        }
        idMediosPagoOk = true;
      } else {
        idMediosPagoOk = !!this.compras.idMediosPago;
      }
    } else {
      idMediosPagoOk = !!this.compras.idMediosPago;
    }

    if (!fechaEmisionOk || !fechaVencOk || !idProveedorOk || !idSucursalOk || !idMonedaOk || !idEstadoPagoOk || !idMediosPagoOk || !totalOk || !detalleOk) {
      this.mostrarErrorValidacion(esCredito);
      return false;
    }
    if (!this.validarComprobanteSunatParaRegistrar()) {
      return false;
    }
    return true;
  }

  private mostrarErrorValidacion(esCredito?: boolean): void {
    const faltan: string[] = [];
    if (!this.compras.fEmision?.trim()) faltan.push('Fecha emisión');
    if (!this.compras.fVencimiento?.trim()) faltan.push('Fecha vencimiento');
    if (!this.compras.idProveedor) faltan.push('Proveedor');
    if (!this.compras.idSucursal) faltan.push('Sucursal');
    if (!this.compras.idMoneda) faltan.push('Moneda');
    if (!this.compras.idEstadoPago) faltan.push('Estado de pago');
    if (esCredito === false && this.detallePago.length === 0 && !this.compras.idMediosPago) {
      faltan.push('Formas de pago (abra el modal "Forma de pago" y agregue al menos un pago)');
    } else if (esCredito !== false && !this.compras.idMediosPago) {
      faltan.push('Medio de pago');
    }
    if (!this.compras.total || Number(this.compras.total) <= 0) faltan.push('Total mayor a 0');
    if (!this.detalleCompras?.length) faltan.push('Al menos un producto en el detalle');
    const msg = faltan.length ? `Faltan: ${faltan.join(', ')}.` : 'Debe llenar todos los campos obligatorios (*) y agregar al menos un producto.';
    iziToast.show({
      title: 'ERROR',
      titleColor: '#FF0000',
      color: '#FFF',
      class: 'text-danger',
      position: 'topRight',
      message: msg,
    });
    this.loadButton = false;
  }

  private crearStockSucursal(nuevoProducto: unknown): void {
    this._sucursalService
      .crear_stock_sucursal_idEmpresa(nuevoProducto)
      .subscribe({
        next: (stockResponse: { data?: unknown }) => {
          if (stockResponse.data != undefined) {
            iziToast.show({
              title: 'SUCCESS',
              titleColor: '#1DC74C',
              color: '#FFF',
              class: 'text-success',
              position: 'topRight',
              message: 'El stock se registró correctamente.',
            });
          }
        },
        error: (stockError: unknown) => {
          console.error('crearStockSucursal:', stockError);
        },
      });
  }

  private actualizarProducto(element: unknown, nuevoProducto: unknown): void {
    this._productoService.actualizarProducto(element as string, nuevoProducto as ProductoCreate).subscribe({
      next: (response: { data?: unknown }) => {
        if (response.data != undefined) {
          iziToast.show({
            title: 'SUCCESS',
            titleColor: '#1DC74C',
            color: '#FFF',
            class: 'text-success',
            position: 'topRight',
            message: 'El producto se actualizó correctamente.',
          });
        }
      },
      error: (err: unknown) => {
        console.error('actualizarProducto:', err);
      },
    });
  }

  private editarStockSucursal(element: unknown, nuevoProducto: unknown): void {
    const idLote = (element as { idLote?: string; idStockSucursal?: string })?.idLote ?? (element as { idStockSucursal?: string })?.idStockSucursal;
    const body = { cantidad: (nuevoProducto as { cantidad?: number })?.cantidad };
    this._sucursalService
      .editar_stock_sucursal(idLote, body)
      .subscribe({
        next: (response: { data?: unknown }) => {
          if (response.data != undefined) {
            iziToast.show({
              title: 'SUCCESS',
              titleColor: '#1DC74C',
              color: '#FFF',
              class: 'text-success',
              position: 'topRight',
              message: 'El stock se actualizó correctamente.',
            });
          }
        },
        error: (err: unknown) => {
          console.error('editarStockSucursal:', err);
        },
      });
  }

  private crearDetalleCompra(nuevoDetalleCompra: unknown): void {
    this._comprasService
      .crear_detalle_compras_idcompra(nuevoDetalleCompra)
      .subscribe({
        next: (detalleResponse: { data?: unknown }) => {
          if (detalleResponse.data != undefined) {
            iziToast.show({
              title: 'SUCCESS',
              titleColor: '#1DC74C',
              color: '#FFF',
              class: 'text-success',
              position: 'topRight',
              message: 'El detalle de compra se registró correctamente.',
            });
          }
        },
        error: (detalleError: unknown) => {
          console.error('crearDetalleCompra:', detalleError);
        },
      });
  }

  private editarCorrelativo(): void {
    this._comprasService
      .editar_correlativos_empresa(
        this.correlativo.idCorrelativo,
        this.correlativo
      )
      .subscribe({
        next: (correlativoResponse: { data?: unknown }) => {
          if (correlativoResponse.data != undefined) {
            iziToast.show({
              title: 'SUCCESS',
              titleColor: '#1DC74C',
              color: '#FFF',
              class: 'text-success',
              position: 'topRight',
              message: 'El correlativo se actualizó correctamente.',
            });
          }
        },
        error: (correlativoError: unknown) => {
          console.error('editarCorrelativo:', correlativoError);
        },
      });
  }

  ///hasta aqui el registro de las compras

  agregarNuevaCategoria(): void {
    const modalRef = this.modalService.open(CreateCategoriaComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      size: 'lg',
    });
    modalRef.result.finally(() => {
      this.cargarCategorias();
    });
  }

  agregarNuevaMarca(): void {
    const modalRef = this.modalService.open(CreateMarcaComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      size: 'lg',
    });
    modalRef.result.finally(() => {
      this.cargarMarcas();
    });
  }

  agregarNuevoProveedor() {
    
    window.open('/proveedores/create', '_blank');
  }

  agregarNuevaSucursal() {
        window.open('/sucursal/create', '_blank');
  }

  //quiero multiplicar el precio unitario por la cantidad y mostrar el resultado en el subtotal de this.nuevoProducto
  actualizarSubtotalNuevoProducto() {
    this.nuevoProducto.subtotal = parseFloat(
      (
        Number(this.nuevoProducto.cantidad) * this.nuevoProducto.pUnitario
      ).toFixed(2)
    );
      }

  consultarManual() {
    this.consultManual = true;
    this.aplicarSucursalPrincipalSiVacia();
    this.aplicarFechasDefaultSiSinConsulta();
  }

  /** Etiqueta del tipo de comprobante según código SUNAT (01=Factura, 03=Boleta, etc.) */
  getTipoComprobanteLabel(codigo: string | undefined): string {
    if (!codigo) return '-';
    const map: Record<string, string> = {
      '01': 'Factura',
      '03': 'Boleta',
      '07': 'Nota de Crédito',
      '08': 'Nota de Débito',
    };
    return map[String(codigo).trim()] || `Comprobante (${codigo})`;
  }

  onInput() {
    this.compras.total =
      this.compras.subTotal +
      this.compras.igv +
      this.compras.otrosCargos -
      this.compras.descuentos;

    const round2 = (v: any): number => {
      const n = Number(v);
      if (isNaN(n)) return 0;
      return Math.round(n * 100) / 100;
    };

    if (this.compras.subTotal != null) {
      this.compras.subTotal = round2(this.compras.subTotal);
    }

    // Redondear otros campos numéricos a 2 decimales
    this.compras.igv = round2(this.compras.igv);
    this.compras.exonerado = round2(this.compras.exonerado);
    this.compras.gratuito = round2(this.compras.gratuito);
    this.compras.otrosCargos = round2(this.compras.otrosCargos);
    this.compras.descuentos = round2(this.compras.descuentos);

    // Recalcular y redondear total (si corresponde)
    this.compras.total = round2(
      (Number(this.compras.subTotal) || 0) +
        (Number(this.compras.igv) || 0) +
        (Number(this.compras.otrosCargos) || 0) -
        (Number(this.compras.descuentos) || 0)
    );
  }

  /** True si el listado de productos trae empresa (gestora / multi-empresa en compras). */
  muestraEmpresaEnBuscadorCompras(): boolean {
    const list = Array.isArray(this.productos_const) ? this.productos_const : [];
    return list.some(
      (p: { aliasEmpresa?: string; razonSocialEmpresa?: string }) =>
        !!(p?.aliasEmpresa && String(p.aliasEmpresa).trim()) ||
        !!(p?.razonSocialEmpresa && String(p.razonSocialEmpresa).trim())
    );
  }

  /** Marca para filas de detalle (objeto, string, producto o idMarca + catálogo). */
  textoMarcaDetalle(item: any): string {
    if (!item) return '—';
    const m = item.marca ?? item.producto?.marca;
    if (m != null && m !== '') {
      if (typeof m === 'string') {
        const t = m.trim();
        if (t) return t;
      } else {
        const n = m.nombre ?? m.Nombre ?? m.descripcion ?? m.Descripcion;
        if (n != null && String(n).trim()) return String(n).trim();
      }
    }
    const idMarca = item.idMarca ?? item.producto?.idMarca;
    if (idMarca != null && Array.isArray(this.marcas)) {
      const found = this.marcas.find((x: any) => String(x.idMarca) === String(idMarca));
      if (found?.nombre) return String(found.nombre).trim();
    }
    return '—';
  }

  /** Sucursal del ítem (objeto, string, producto o idSucursal + catálogo). */
  textoSucursalDetalle(item: any): string {
    if (!item) return '—';
    const s = item.sucursal ?? item.producto?.sucursal;
    if (s != null && s !== '') {
      if (typeof s === 'string') {
        const t = s.trim();
        if (t) return t;
      } else {
        const n = s.nombre ?? s.Nombre ?? s.descripcion ?? s.Descripcion;
        if (n != null && String(n).trim()) return String(n).trim();
      }
    }
    const idSucursal = item.idSucursal ?? item.producto?.idSucursal;
    if (idSucursal != null && Array.isArray(this.sucursales)) {
      const found = this.sucursales.find((x: any) => String(x.idSucursal) === String(idSucursal));
      if (found?.nombre) return String(found.nombre).trim();
    }
    return '—';
  }

  buscarProductos(): void {
    const term: string = this.searchTerm.toLowerCase().trim();
    if (term === '') {
      this.productos_filtrados = this.productos_const;
    } else {
      this.productos_filtrados = this.productos_const.filter((item: any) => {
        const descripcion = (item.descripcion ?? '').toString().toLowerCase();
        const codigo = (item.codigo ?? '').toString().toLowerCase();
        const marcaCol = marcaProductoEnLista(item).toLowerCase();
        const marcaLegacy = (item.nombre ?? '').toString().toLowerCase();
        const categoria = (item.categoria ?? '').toString().toLowerCase();
        return (
          descripcion.includes(term) ||
          codigo.includes(term) ||
          marcaCol.includes(term) ||
          marcaLegacy.includes(term) ||
          categoria.includes(term)
        );
      });
    }
  }

  /** Vuelve a cargar productos desde BD y reaplica el filtro sin tocar el input. */
  recargarProductosModalCompras(): void {
    this._productoService.obtenerProductosCompras({ evitarCache: true }).subscribe({
      next: (response) => {
        if (response.data != undefined) {
          this.productos = response.data;
        }
        this.productos_const = this.productos;
        this.buscarProductos();
      },
      error: () => {}
    });
  }

  uMedidaColumnaCompras(p: any): string {
    return descripcionUnidadMedidaProducto(p);
  }

  marcaColumnaCompras(p: any): string {
    const t = marcaProductoEnLista(p as Record<string, unknown>);
    return t || '—';
  }

  productoSinStockEnBusquedaModal(p: unknown): boolean {
    return productoSinStockEnBusqueda(p as Record<string, unknown>);
  }

  agregarDetallesCompra(producto: any): void {
    const idSucursal =
      this.compras.idSucursal ||
      this.obtenerIdSucursalPrincipal() ||
      (this.sucursales?.length === 1 ? this.sucursales[0].idSucursal : null);
    const idPresentacion = producto.idPresentacion ?? producto.presentacion?.idPresentacion;
    const pUnitario = Number(producto.cUnitario ?? producto.pUnitario ?? 0);
    const existe = this.detalleCompras.find((p: { idProducto: any }) => p.idProducto === producto.idProducto);
    if (existe) {
      existe.cantidad = (existe.cantidad || 0) + 1;
      existe.subtotal = (existe.cantidad || 0) * (Number(existe.cUnitario ?? existe.pUnitario ?? 0));
    } else {
      const sucursalObj = this.sucursales?.find((s: any) => s.idSucursal === idSucursal) ?? null;
      const presentacionObj = this.presentacion?.find((p: any) => p.idPresentacion === idPresentacion) ?? producto.presentacion ?? null;
      this.detalleCompras.push({
        ...producto,
        idSucursal,
        sucursal: sucursalObj,
        idPresentacion: idPresentacion ?? presentacionObj?.idPresentacion,
        presentacion: presentacionObj,
        cantidad: 1,
        cUnitario: pUnitario || producto.cUnitario,
        pUnitario: pUnitario || producto.pUnitario,
        subtotal: pUnitario,
      });
    }
    this.sumarFooterFactura();
  }

  seleccionaProducto(prod: any): void {
        // 1.  Agrega al carrito
    this.agregarDetallesCompra(prod);


    // 2.  Cierra el modal (por JS)
    const buscador = bootstrap.Modal.getInstance(
      document.getElementById('buscadorModal')!
    );
    buscador?.hide();
  }

  abrirBuscadorModal(): void {
    this.searchTerm = '';
    this.productos_filtrados = this.productos_const ?? [];
    const el: HTMLElement | null = document.getElementById('buscadorModal');
    if (el) {
      const modal = new bootstrap.Modal(el);
      modal.show();
    }
  }

  /** Limpia tipo de cambio SUNAT cuando no aplica (soles o contado). */
  syncSunatAuxiliaresDesdeFormulario(): void {
    if (!this.comprobante) return;
    if (this.esMonedaSolesSunatXml() || !this.esCompraAlCreditoParaSunat()) {
      this.compras.tipoCambioSunat = '';
    }
  }

  onCambioEstadoPagoCompras(): void {
    this.sincronizarEstadoPagoSiCreditoOperacion();
    if (this.comprobante) {
      this.syncSunatAuxiliaresDesdeFormulario();
    }
  }

  onCambioMedioPagoCompras(): void {
    this.sincronizarEstadoPagoSiCreditoOperacion();
    if (this.comprobante) {
      this.syncSunatAuxiliaresDesdeFormulario();
    }
  }

  esMedioPagoCredito(): boolean {
    const mp = this.mediosPago?.find((m: any) => String(m.idMediosPago) === String(this.compras.idMediosPago));
    return /credito/i.test(String(mp?.descripcion ?? ''));
  }

  /** Crédito operativo: estado de pago o medio de pago (misma lógica que el backend con idEstadoPago). */
  esCompraAlCreditoParaSunat(): boolean {
    return this.esCompraAlCredito() || this.esMedioPagoCredito();
  }

  /** Moneda del CPE consultado (DocumentCurrencyCode); el tipo de cambio SUNAT sigue esta moneda. */
  esMonedaSolesSunatXml(): boolean {
    const code = String(this.comprobante?.informacionGeneral?.moneda || 'PEN')
      .toUpperCase()
      .trim();
    return !code || code.startsWith('PEN');
  }

  private aplicarCuotasDesdeComprobanteSunat(): void {
    const raw = this.comprobante?.cuotas;
    if (!Array.isArray(raw) || raw.length === 0) {
      this.cuotasSunat = [];
      return;
    }
    this.cuotasSunat = raw
      .map((c: any, idx: number) => ({
        numeroCuota: Number(c.numeroCuota ?? c.numero ?? idx + 1) || idx + 1,
        fechaVencimiento: this.formatFechaParaInputDate(c.fechaVencimiento) || '',
        montoCuota: Number(String(c.montoCuota ?? c.amount ?? 0).replace(',', '.')) || 0,
      }))
      .filter((c) => c.fechaVencimiento && c.montoCuota > 0)
      .sort((a, b) => a.numeroCuota - b.numeroCuota);
  }

  /** Si hubo consulta SUNAT, valida tipo de cambio (solo moneda extranjera) y cuotas en crédito. */
  validarComprobanteSunatParaRegistrar(): boolean {
    if (!this.comprobante) return true;
    if (!this.esCompraAlCreditoParaSunat()) {
      return true;
    }
    if (!this.esMonedaSolesSunatXml()) {
      const tc = Number(this.compras.tipoCambioSunat);
      if (!Number.isFinite(tc) || tc <= 0) {
        iziToast.error({
          title: 'SUNAT',
          message: 'En crédito con comprobante en moneda extranjera debe indicar el tipo de cambio (mayor a 0).',
          position: 'topRight',
        });
        return false;
      }
    }
    if (!this.compras.fVencimiento) {
      iziToast.error({
        title: 'SUNAT',
        message: 'En crédito debe indicar la fecha de vencimiento de la compra.',
        position: 'topRight',
      });
      return false;
    }
    let cuotas = [...this.cuotasSunat];
    if (!cuotas.length) {
      cuotas = [
        {
          numeroCuota: 1,
          fechaVencimiento: this.compras.fVencimiento,
          montoCuota: Number(this.compras.total) || 0,
        },
      ];
    }
    const sum = cuotas.reduce((s, c) => s + (Number(c.montoCuota) || 0), 0);
    const tot = Number(this.compras.total) || 0;
    if (tot > 0 && Math.abs(sum - tot) > 0.05) {
      iziToast.error({
        title: 'SUNAT',
        message: 'La suma de las cuotas debe coincidir con el total de la compra.',
        position: 'topRight',
      });
      return false;
    }
    return true;
  }

  /** Payload para tabla ComprobantesCompraSunat (totales reales del XML normalizado). */
  private buildComprobanteSunatPayload(): Record<string, unknown> | undefined {
    if (!this.comprobante) return undefined;
    const info = this.comprobante.informacionGeneral || {};
    const emisor = this.comprobante.emisor || {};
    const totales = this.comprobante.totales || {};
    const impuestos = this.comprobante.impuestos || {};
    const tipo = String(info.tipoDocumento ?? this.consultaForm?.value?.tipo_doc ?? '01')
      .trim()
      .padStart(2, '0');
    let serie = String(this.compras.serie || '').trim();
    let numero = String(this.compras.numero || '').trim();
    if (!serie || !numero) {
      const parts = String(info.serieNumero || '').split('-');
      serie = (parts[0] || serie).trim();
      numero = (parts[1] || numero).trim();
    }
    const sub = parseFloat(String(totales.totalValorVenta || 0).replace(',', '.')) || 0;
    const igv = parseFloat(String(impuestos.total || totales.totalImpuestos || 0).replace(',', '.')) || 0;
    const total = parseFloat(String(totales.totalVenta || totales.totalPagar || 0).replace(',', '.')) || 0;
    const esCred = this.esCompraAlCreditoParaSunat();
    const cond = esCred ? 'CREDITO' : 'CONTADO';
    const tcRaw = Number(this.compras.tipoCambioSunat);
    const codigoMoneda = String(info.moneda || 'PEN')
      .toUpperCase()
      .substring(0, 3);

    let cuotasPayload: CuotaCompraSunatForm[] = [];
    if (esCred) {
      cuotasPayload = this.cuotasSunat.map((c, i) => ({
        numeroCuota: c.numeroCuota || i + 1,
        fechaVencimiento: c.fechaVencimiento,
        montoCuota: Number(c.montoCuota) || 0,
      }));
      if (!cuotasPayload.length && this.compras.fVencimiento) {
        cuotasPayload = [
          {
            numeroCuota: 1,
            fechaVencimiento: this.compras.fVencimiento,
            montoCuota: total,
          },
        ];
      }
    }

    const payload: Record<string, unknown> = {
      condicionPago: cond,
      tipoCambio:
        cond === 'CREDITO' &&
        !this.esMonedaSolesSunatXml() &&
        Number.isFinite(tcRaw) &&
        tcRaw > 0
          ? tcRaw
          : null,
      rucEmisor: String(emisor.ruc || '').replace(/\D/g, '').slice(0, 11),
      razonSocialEmisor: (() => {
        const rsXml = String(emisor.razonSocial ?? '').trim();
        const rsProv = String(this.proveedores?.rSocial ?? this.proveedores?.razonSocial ?? '').trim();
        return rsXml || rsProv || null;
      })(),
      tipoDocumento: tipo,
      serie: serie.substring(0, 10),
      numero: numero.substring(0, 20),
      fechaEmision: this.compras.fEmision || info.fechaEmision,
      codigoMoneda,
      fechaVencimiento: esCred ? this.compras.fVencimiento || null : null,
      subTotal: sub,
      igv,
      exonerado: 0,
      total,
    };
    if (esCred && cuotasPayload.length > 0) {
      payload['cuotas'] = cuotasPayload;
    }
    return payload;
  }

  /** True si la compra es al crédito (no se muestra el modal de formas de pago). */
  esCompraAlCredito(): boolean {
    const id = this.compras.idEstadoPago;
    if (id == null || id === '') return false;
    const estado = this.estadoPago?.find((e: any) => String(e.idEstadoPago) === String(id));
    const desc = (estado?.descripcion ?? '').toLowerCase();
    return desc.includes('credito') || desc.includes('crédito');
  }

  private idEstadoPagoPendienteCatalogo(): string | number {
    const row = this.estadoPago?.find((e: any) => /pendiente/i.test(String(e.descripcion ?? '')));
    if (row?.idEstadoPago != null && row.idEstadoPago !== '') return row.idEstadoPago;
    return 1;
  }

  /**
   * Compra al crédito (estado o medio): estado de pago = Pendiente (coherente con backend; no modal de formas de pago).
   */
  sincronizarEstadoPagoSiCreditoOperacion(): void {
    if (!this.esCompraAlCreditoParaSunat()) {
      return;
    }
    const pendiente = this.idEstadoPagoPendienteCatalogo();
    this.compras.idEstadoPago = String(pendiente);
  }

  calcularTotalTablaPago(): number {
    return this.detallePago.reduce((sum, item) => sum + (Number(item.monto) || 0), 0);
  }

  getSaldoPendienteCompra(): number {
    const total = Number(this.compras.total) || 0;
    const pendiente = Math.max(0, total - this.calcularTotalTablaPago());
    return Math.round(pendiente * 100) / 100;
  }

  actualizarMontoSaldoCompra(): void {
    this.detailForm.monto = this.getSaldoPendienteCompra();
  }

  /** Abre el modal de forma de pago: selecciona Efectivo y monto = saldo. No modifica modalPagoParaRegistrar (lo define quien llama). */
  abrirModalFormaPago(): void {
    const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
    if (efectivo) {
      this.formaPagoSeleccionada = { ...efectivo };
    }
    this.actualizarMontoSaldoCompra();
    const total = Number(this.compras.total) || 0;
    this.pagaCon = total;
    this.vuelto = 0;
  }

  agregarDetallePago(): void {
    const monto = Math.round((Number(this.detailForm.monto) || 0) * 100) / 100;
    const idForma = this.formaPagoSeleccionada?.idFormaPago != null ? Number(this.formaPagoSeleccionada.idFormaPago) : 0;
    if (monto > 0 && idForma) {
      const desc = this.formasPago.find((f: FormaPago) => f.idFormaPago === idForma)?.descripcion || 'Pago';
      this.detallePago.push({
        item: this.detallePago.length + 1,
        idFormaPago: idForma,
        descripcion: desc,
        monto,
        referencia: this.detailForm.referencia || 'N/A',
      });
      this.detailForm.referencia = '';
      this.actualizarMontoSaldoCompra();
    }
  }

  eliminarDetallePago(index: number): void {
    this.detallePago.splice(index, 1);
    this.detallePago.forEach((item, idx) => (item.item = idx + 1));
    this.actualizarMontoSaldoCompra();
  }

  guardarPagoCompra(): void {
    this.cerrarModalPagoCompra();
    if (this.detallePago.length > 0 && !this.esCompraAlCreditoParaSunat()) {
      this.compras.idMediosPago = String(this.detallePago[0].idFormaPago);
    }
  }
}
