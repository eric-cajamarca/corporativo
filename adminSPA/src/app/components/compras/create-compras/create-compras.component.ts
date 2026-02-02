import { Component, signal } from '@angular/core';
import { ComprasService } from '../../../services/compras.service';
import { ComprobanteService } from '../../../services/comprobante.service';
import { ProductoService } from '../../../services/producto.service';
import { ProductoCreate } from '../../../models/producto.models';
import { SucursalService } from '../../../services/sucursal.service';
import { DocumentoService } from '../../../services/documento.service';
import { TablasSunatService } from '../../../services/tablas-sunat.service';
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
import { saveAs } from 'file-saver';
import { forkJoin, Observable, of, Subscription, throwError } from 'rxjs';
import { catchError, finalize, mergeMap, switchMap, tap } from 'rxjs/operators';
import { ProveedoresService } from '../../../services/proveedores.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';

declare var iziToast: any;
declare var bootstrap: any;
const FORMATO_FECHA = 'dd/MM/yyyy';

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
export class CreateComprasComponent {
  /** Estado del sidebar: contenido se centra o se extiende según esté visible u oculto */
  sidebarCollapsed = signal<boolean>(false);

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
  };

  

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
  }

  public consultManual = false;
  public idCompra: any = '';
  public indexDetalle: any = 0;
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
    private _router: Router,

    // consultarxml
    private fb: FormBuilder,
    private sunatService: ConsultaXMLService
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
        console.log('this.comprobante', this.comprobante);
        
        if (!this.comprobante) {
          iziToast.error({ title: 'Error', message: 'No se recibieron datos del comprobante', position: 'topRight' });
          return;
        }

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
        this.compras.idComprobante = info.tipoDocumento || '1';
        this.compras.ruc = emisor.ruc || '';
        this.compras.fEmision = this.formatFecha(info.fechaEmision) || '';
        this.compras.fVencimiento = this.formatFecha(info.fechaVencimiento) || '';
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
          const idSucursalDefault = this.compras.idSucursal || (this.sucursales?.length === 1 ? this.sucursales[0].idSucursal : null);
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
          this.sumarFooterFactura();
        } else {
          iziToast.warning({ title: 'Aviso', message: 'El comprobante no tiene líneas de detalle', position: 'topRight' });
        }
        this.consultManual = true;
      },
      error: (err) => {
        this.loading = false;
        this.comprobante = null;
        this.error = err?.error?.message || err?.message || 'Error al consultar el comprobante';
        iziToast.error({ title: 'Error', message: this.error, position: 'topRight' });
      },
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
    this._comprobanteService.obtener_comprobantes().subscribe(
      (response) => {
        this.comprobantes = response.data;
        console.log(this.comprobantes);
      },
      (error) => {
        console.log(error);
      }
    );

    this._tablasSunatService.obtener_moneda().subscribe(
      (response) => {
        this.moneda = response.data;
        console.log(this.moneda);
      },
      (error) => {
        console.log(error);
      }
    );

    this._tablasSunatService.obtener_estado_pago().subscribe(
      (response) => {
        this.estadoPago = response.data;
        console.log(this.estadoPago);
      },
      (error) => {
        console.log(error);
      }
    );

    this._tablasSunatService.obtener_medios_pago().subscribe(
      (response) => {
        this.mediosPago = response.data;
        console.log(this.mediosPago);
      },
      (error) => {
        console.log(error);
      }
    );

    this._marcaService.obtenerMarcas().subscribe(
      (response) => {
        this.marcas = response.data;
        this.marcas.sort((a: { nombre: string }, b: { nombre: any }) =>
          a.nombre.localeCompare(b.nombre)
        );
        console.log('this.marcas', this.marcas);
      },
      (error) => {
        console.log(error);
      }
    );

    this._categoriaService.obtener_categorias().subscribe(
      (response) => {
        this.categoria = response.data;
        console.log('this.categoria', this.categoria);
      },
      (error) => {
        console.log(error);
      }
    );

    this._presentacionService.obtener_presentaciones().subscribe(
      (response) => {
        this.presentacion = response.data;
        console.log('this.presentacion', this.presentacion);
      },
      (error) => {
        console.log(error);
      }
    );

    this._sucursalService.obtener_sucursal_idempresa().subscribe(
      (response) => {
        this.sucursales = response.data;
        console.log('this.sucursales', this.sucursales);
      },
      (error) => {
        console.log(error);
      }
    );

    this._productoService.obtenerProductosCompras().subscribe(
      (response) => {
        console.log('response productos', response.data);
        if (response.data != undefined) {
          this.productos = response.data;

          // this.productos = response.data;
          // console.log('this.productos como objeto',this.productos);
        }
        this.productos_const = this.productos;
        console.log('this.productos', this.productos);
      },
      (error) => {
        console.log(error);
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
        console.log('this.sucursales', this.sucursales);
      },
      (error) => {
        console.log(error);
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
        console.log('this.categoria', this.categoria);
      },
      (error) => {
        console.log(error);
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
        console.log('this.marcas', this.marcas);
      },
      (error) => {
        console.log(error);
      }
    );
  }

  buscar() {
    console.log('this.filtro', this.filtro);
    console.log('this.proveedores.ruc', this.compras.ruc);

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
      console.log('this.prodSelecionado', this.prodSelecionado);

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

    console.log('this.nuevoProducto', this.nuevoProducto);
  }

  //ahora quiero seleccionar el index de la tabla detalleCompra y pasar los datos del registro al objeto nuevoProducto y mostrarlo en un modal
  seleccionarDetalle(idx: number) {
    this.indexDetalle = idx;
    console.log('this.indexDetalle', this.indexDetalle);
    //quiero agregar a this.nuevoProducto el objeto seleccionado
    if (idx >= 0 && idx < this.detalleCompras.length) {
      this.nuevoProducto = this.detalleCompras[idx];
      console.log('this.nuevoProducto', this.nuevoProducto);

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
    console.log('this.filtroConsulta', this.filtroConsulta);

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
      console.log(
        'this.productos despues de la busqueda',
        this.stockSucursales
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
    console.log('ejecuto una funcion onInputChangesCompCompras');
    console.log('this.compras.compCompra', this.compras.compCompra);
    console.log('this.compras.idProveedor', this.compras.idProveedor);

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
    console.log('selectedValue', selectedValue);
    const selectedObject = this.marcas.find(
      (item: any) => item.idMarca == selectedValue
    );
    this.nuevoProducto.marca = selectedObject;
    console.log('selectedObject', selectedObject);
    console.log('this.nuevoProducto', this.nuevoProducto);
  }

  onSelectPresentacion(selectedValue: any) {
    const selectedObject = this.presentacion.find(
      (item: any) => item.idPresentacion == selectedValue
    );
    this.nuevoProducto.presentacion = selectedObject;
    // Ahora, selectedObject contiene toda la información del elemento seleccionado
    console.log('selectedObject', selectedObject);
    console.log('this.nuevoProducto', this.nuevoProducto);
  }

  onSelectCategoria(selectedValue: any) {
    const selectedObject = this.categoria.find(
      (item: any) => item.idCategoria == selectedValue
    );
    this.nuevoProducto.categoria = selectedObject;
    // Ahora, selectedObject contiene toda la información del elemento seleccionado
    console.log('selectedObject', selectedObject);
    console.log('this.nuevoProducto', this.nuevoProducto);
  }

  onSelectSucursal(selectedValue: any) {
    const selectedObject = this.sucursales.find(
      (item: any) => item.idSucursal == selectedValue
    );
    this.nuevoProducto.sucursal = selectedObject;
    // Ahora, selectedObject contiene toda la información del elemento seleccionado
    console.log('selectedObject', selectedObject);
    console.log('this.nuevoProducto', this.nuevoProducto);
  }

  onCheckboxChange() {
    if (this.nuevoProducto.useCorrelativo) {
      console.log(
        'El checkbox está marcado.',
        this.nuevoProducto.useCorrelativo
      );

      // Realiza acciones cuando el checkbox está marcado

      this.nuevoProducto.codigo = this.correlativo.numero;
      this.nuevoProducto.idProducto = undefined;

      console.log('this.nuevoProducto', this.nuevoProducto);
    } else {
      console.log(
        'El checkbox está desmarcado.',
        this.nuevoProducto.useCorrelativo
      );
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
      console.log('si hay datos que guardar');

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
        console.log(error);
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

    console.log('this.detalleCompras', this.detalleCompras);

    //deseo multiplicar el precio por la cantidad de this.nuevoProducto
    this.nuevoProducto.subtotal =
      this.nuevoProducto.cUnitario * this.nuevoProducto.cantidad;
    console.log('this.nuevoProducto', this.nuevoProducto);

    console.log('this.detalleCompras', this.detalleCompras);

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
    console.log('sumarFooterFactura');
    
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

    console.log('this.compras', this.compras);
    this.onInput();
  }

  buscarFactura() {
    this.compras.compCompra = this.compras.serie + '-' + this.compras.numero;
    this.compras.idProveedor = this.proveedores?.idProveedor ?? '';
  }

  registrarCompras() {
    this.compras.compCompra = this.compras.serie + '-' + this.compras.numero;
    this.loadButton = true;

    if (!this.validarCamposObligatorios()) {
      return;
    }

    const idSucursalCompra = this.compras.idSucursal;
    this._comprasService.crear_compra(this.compras).pipe(
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

          const nuevoProducto = {
            idProducto: element.idProducto,
            Codigo: element.codigo ?? element.Codigo,
            idCategoria: element.idCategoria ?? element.categoria?.idCategoria,
            descripcion: element.descripcion,
            idPresentacion: idPresentacionDetalle,
            cUnitario: element.cUnitario ?? element.pUnitario,
            fProduccion: element.fProduccion ?? element.fproduccion,
            fVencimiento: element.fVencimiento ?? element.fvencimiento,
            cantidad: element.cantidad,
            cantidadAnterior: element.cantidadAnterior,
            facturar: 'SI',
            idStockSucursal: element.idStockSucursal,
            idEmpresa: element.idEmpresa,
            idMarca: element.idMarca ?? element.marca?.idMarca,
            idSucursal: idSucursalDetalle,
            ubicacion: element.ubicacion ?? '',
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
          };

          if (element.idProducto == null || element.idProducto === undefined || element.idProducto === '') {
            observables.push(
              this._productoService.crearProducto(nuevoProducto).pipe(
                switchMap((pr) => {
                  if (pr?.data != null) {
                    nuevoDetalleCompra.idProducto = pr.data;
                    return this._comprasService.crear_detalle_compras_idcompra(nuevoDetalleCompra);
                  }
                  return of(null);
                }),
                catchError((err) => {
                  console.error('Error creando producto:', err);
                  iziToast.show({ title: 'ERROR', titleColor: '#FF0000', color: '#FFF', position: 'topRight', message: 'No se pudo crear el producto.' });
                  return of(null);
                })
              )
            );
          } else {
            observables.push(
              this._productoService.actualizarProducto(element.idProducto, nuevoProducto).pipe(
                switchMap(() => this._comprasService.crear_detalle_compras_idcompra(nuevoDetalleCompra)),
                catchError((err) => {
                  console.error('Error actualizando producto:', err);
                  iziToast.show({ title: 'ERROR', titleColor: '#FF0000', color: '#FFF', position: 'topRight', message: 'No se pudo actualizar el producto.' });
                  return of(null);
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
      next: () => {
        this.editarCorrelativo();
        iziToast.show({
          title: 'SUCCESS',
          titleColor: '#1DC74C',
          color: '#FFF',
          class: 'text-success',
          position: 'topRight',
          message: 'Compra registrada correctamente.',
        });
        this._router.navigate(['/compras']);
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

  private validarCamposObligatorios(): boolean {
    const fechaEmisionOk =
      !!this.compras.fEmision && String(this.compras.fEmision).trim() !== '';
    const fechaVencOk =
      !!this.compras.fVencimiento && String(this.compras.fVencimiento).trim() !== '';
    const idProveedorOk = !!this.compras.idProveedor && String(this.compras.idProveedor).trim() !== '';
    const idSucursalOk = !!this.compras.idSucursal && String(this.compras.idSucursal).trim() !== '';
    const idMonedaOk = !!this.compras.idMoneda;
    const idEstadoPagoOk = !!this.compras.idEstadoPago;
    const idMediosPagoOk = !!this.compras.idMediosPago;
    const totalOk = !isNaN(Number(this.compras.total)) && Number(this.compras.total) > 0;
    const detalleOk = Array.isArray(this.detalleCompras) && this.detalleCompras.length > 0;

    if (!fechaEmisionOk || !fechaVencOk || !idProveedorOk || !idSucursalOk || !idMonedaOk || !idEstadoPagoOk || !idMediosPagoOk || !totalOk || !detalleOk) {
      this.mostrarErrorValidacion();
      return false;
    }
    return true;
  }

  private mostrarErrorValidacion(): void {
    const faltan: string[] = [];
    if (!this.compras.fEmision?.trim()) faltan.push('Fecha emisión');
    if (!this.compras.fVencimiento?.trim()) faltan.push('Fecha vencimiento');
    if (!this.compras.idProveedor) faltan.push('Proveedor');
    if (!this.compras.idSucursal) faltan.push('Sucursal');
    if (!this.compras.idMoneda) faltan.push('Moneda');
    if (!this.compras.idEstadoPago) faltan.push('Estado de pago');
    if (!this.compras.idMediosPago) faltan.push('Medio de pago');
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

  agregarNuevaCategoria() {
    console.log('agregarNuevaCategoria', this.categoria);
    //this._router.navigate(['/categorias/create']);
    window.open('/categorias/create', '_blank');
  }

  agregarNuevaMarca() {
    console.log('agregarNuevaMarca', this.marcas);
    window.open('/marcas/create', '_blank');
  }

  agregarNuevoProveedor() {
    
    window.open('/proveedores/create', '_blank');
  }

  agregarNuevaSucursal() {
    console.log('agregarNuevaSucursal', this.sucursales);
    window.open('/sucursal/create', '_blank');
  }

  //quiero multiplicar el precio unitario por la cantidad y mostrar el resultado en el subtotal de this.nuevoProducto
  actualizarSubtotalNuevoProducto() {
    this.nuevoProducto.subtotal = parseFloat(
      (
        Number(this.nuevoProducto.cantidad) * this.nuevoProducto.pUnitario
      ).toFixed(2)
    );
    console.log(
      'actualizarSubtotalNuevoProducto this.nuevoProducto',
      this.nuevoProducto
    );
  }

  consultarManual() {
    this.consultManual = true;
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

  buscarProductos(): void {
    const term: string = this.searchTerm.toLowerCase().trim();
    console.log('Término de búsqueda:', term);
    
    if (term === '') {
      // Si no hay término de búsqueda, mostrar todos los productos
      this.productos_filtrados = this.productos_const;
      console.log('No se ingresó término de búsqueda. Mostrando todos los productos.');
    } else {
      // Filtrar por código o descripción (uso includes en lugar de test)
      this.productos_filtrados = this.productos_const.filter(
        (item: any) => {
          const descripcion = (item.descripcion ?? '').toString().toLowerCase();
          const codigo = (item.codigo ?? '').toString().toLowerCase();
          const marca = (item.nombre ?? '').toString().toLowerCase();
          return (
            descripcion.includes(term) ||
            codigo.includes(term) ||
            marca.includes(term)
          );
        }
      );
    }
    
    console.log('Productos filtrados:', this.productos_filtrados);
  }

  agregarDetallesCompra(producto: any): void {
    const idSucursal = this.compras.idSucursal || (this.sucursales?.length === 1 ? this.sucursales[0].idSucursal : null);
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
    console.log('Producto seleccionado:', prod);
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
}
