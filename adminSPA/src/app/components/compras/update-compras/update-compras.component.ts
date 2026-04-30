import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, signal } from '@angular/core';
import { ComprasService } from '../../../services/compras.service';
import { ComprobanteService } from '../../../services/comprobante.service';
import { ProductoService } from '../../../services/producto.service';
import { SucursalService } from '../../../services/sucursal.service';
import { DocumentoService } from '../../../services/documento.service';
import { TablasSunatService } from '../../../services/tablas-sunat.service';
import { CategoriaService } from '../../../services/categoria.service';
import { PresentacionService } from '../../../services/presentacion.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { variosService } from '../../../services/varios.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { ProveedoresService } from '../../../services/proveedores.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CreateCategoriaComponent } from '../../categorias/create-categoria/create-categoria.component';
import { CreateMarcaComponent } from '../../marcas/create-marca/create-marca.component';

declare var iziToast: any;
declare var bootstrap: any;

@Component({
  selector: 'app-update-compras',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule, TopnavComponent, SidebarComponent],
  templateUrl: './update-compras.component.html',
  styleUrl: './update-compras.component.css'
})
export class UpdateComprasComponent implements AfterViewInit, OnDestroy {
  public compras: any = {
    idEmpresa: '',
    idSucursal: '',
    idComprobante: '',
    idCliente: '',
    idDocumento: '',
    idMoneda: '',
    idEstadoPago: '',
    idMedioPago: '',
    fechaEmision: '',
    fechaPago: '',
    total: 0,
    observacion: '',
  };
  public compras_const: any = {};
  public idCompra: any = '';
  public detalleCompras: any = [];
  public detalleCompras_const: any = [];
  public nuevoDetalleCompra: any = {};
  public comprobantes: any = [];
  public marcas: any = [];
  public proveedores: any = {};
  public productos: any = {};

  public prodSelecionado: any = {};
  public productos_const: any = {};
  public sucursales: any = [];
  public stockSucursales: any = [];
  public stockSucursales_const: any = [];
  public filtro: any = {};
  public filtroConsulta: any = '';
  public searchTerm = '';
  public productos_filtrados: any[] = [];
  public documento: any = [];
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
    fproduccion: new Date(),
    fvencimiento: new Date(),
  };
  public correlativo: any = '';
  // FORMATO_FECHA = FORMATO_FECHA;
  public loadCompras: boolean = true;
  public loadActualizarCompras: boolean = false;
  // public prodEliminado: any = [];
  // public idProductoEliminar: any ={};
  public token: any;
  public editardetalle: boolean = false;
  public updateDetalleCompra: any = 0;
  public updatecompra: any = 0;
  public productoCreado: any = false;


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
    private _route: ActivatedRoute,
    private _marcaService: variosService,
    private _router: Router,
    private _cdr: ChangeDetectorRef,
    public sidebarState: SidebarStateService,
    private modalService: NgbModal
  ) {
    //this.token = this._cookieService.get('token');
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
      const el = document.getElementById('update-compras-buscador-modal-search');
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

    this.loadCompras = true;
    this._route.params.subscribe(params => {
            this.idCompra = params['id'];
      
      //aqui obtengo la compra por id
      this._comprasService.obtener_compras_id(this.idCompra).subscribe(
        response => {
                    if (response.data != undefined) {
            this.compras = response.data[0];
            this.compras_const = JSON.parse(JSON.stringify(response.data[0]));
                      }
          this.loadCompras = false;
        },
        error => {
                  }
      );

      this._comprasService.obtener_detalle_compras_idcompra(this.idCompra).subscribe(
        response => {
          if (response.data != undefined) {
            this.detalleCompras = response.data;
            this.detalleCompras_const = JSON.parse(JSON.stringify(response.data));
            this.llenarDetalleCompras();
            this.detalleCompras.forEach((element: any) => {
              element.cUnitario = element.pUnitario;
              element.subtotal = element.total;
              if (element.producto) {
                element.idPresentacion = element.producto.idPresentacion;
                element.idCategoria = element.producto.idCategoria;
                element.descripcion = element.producto.descripcion;
                element.codigo = element.producto.Codigo ?? element.producto.codigo;
                element.fProduccion = element.producto.fProduccion;
                element.fVencimiento = element.producto.fVencimiento;
              }
              if (element.sucursal) {
                element.idSucursal = element.sucursal.idSucursal;
              }
            });
            this.loadCompras = false;
          }
        },
        error => {
          console.error('Error al obtener detalle de compra:', error);
          this.loadCompras = false;
        }
      );
    });

    

  }

 

  initData() {

    this.updateDetalleCompra = 0;
    this.updatecompra = 0;

    this._comprobanteService.obtenerComprobantesCompra().subscribe(
      response => {
        this.comprobantes = response.data;
              },
      error => {
              }
    );


    this._tablasSunatService.obtener_moneda().subscribe(
      response => {
        this.moneda = response.data;
              },
      error => {
              }
    );

    this._tablasSunatService.obtener_estado_pago().subscribe(
      response => {
        this.estadoPago = response.data;
              },
      error => {
              }
    );

    this._tablasSunatService.obtener_medios_pago().subscribe(
      response => {
        this.mediosPago = response.data;
              },
      error => {
              }
    );

    this._categoriaService.obtener_categorias().subscribe(
      response => {
        this.categoria = response.data;
              },
      error => {
              }
    );

    this._presentacionService.obtener_presentaciones().subscribe(
      response => {
        this.presentacion = response.data;
              },
      error => {
              }
    );

   this.cargarSucursales();

    this._marcaService.obtenerMarcas().subscribe(
      response => {
        this.marcas = response.data;
        this.marcas.sort((a: { nombre: string; }, b: { nombre: any; }) => a.nombre.localeCompare(b.nombre));
              },
      error => {
              }
    );

    // this._marcaService.obtenerMarcas().subscribe(
    //   response => {
    //     this.marcas = response.data;
    //     this.marcas.sort((a: { nombre: string; }, b: { nombre: any; }) => a.nombre.localeCompare(b.nombre));
    //     console.log('this.marcas', this.marcas);
    //   },
    //   error => {
    //     console.log(error);
    //   }
    // );

    this.obtenerProductos();

    this.obtenerCorrelativo();

    this.obtenerStockSucursal();

  }

  llenarDetalleCompras() {
    if (!this.detalleCompras?.length || !this.productos?.length) return;

    this.detalleCompras.forEach((element: any) => {
      const selectedObject = this.productos.find((item: any) => item.idProducto == element.idProducto);
      element.producto = selectedObject;

      const selectedObjectSucursal = this.sucursales.find((item: any) => item.idSucursal == element.idSucursal);
      element.sucursal = selectedObjectSucursal;

      if (element.producto) {
        const p = element.producto;
        element.codigo = p.codigo ?? p.Codigo ?? element.codigo;
        element.descripcion = p.descripcion ?? element.descripcion;
        element.fProduccion = p.fProduccion ?? element.fProduccion;
        element.fVencimiento = p.fVencimiento ?? element.fVencimiento;

        const selectedObjectCategoria = this.categoria.find((c: any) =>
          (c.nombre || '').trim() === (p.categoria || '').trim()
        ) ?? this.categoria.find((c: any) => c.idCategoria == p.idCategoria);
        element.categoria = selectedObjectCategoria;

        const selectedObjectMarca = this.marcas.find((m: any) =>
          (m.nombre || '').trim() === (p.marca || '').trim()
        ) ?? this.marcas.find((m: any) => m.idMarca == p.idMarca);
        element.marca = selectedObjectMarca;

        const selectedObjectPresentacion = this.presentacion.find((pr: any) =>
          (pr.Descripcion || pr.descripcion || '').trim() === (p.descripcionPres || '').trim() ||
          (pr.codigo || '').trim() === (p.codigoPresentacion || '').trim()
        ) ?? this.presentacion.find((pr: any) => pr.idPresentacion == p.idPresentacion);
        element.presentacion = selectedObjectPresentacion;
      } else {
        element.categoria = undefined;
        element.presentacion = undefined;
        element.marca = undefined;
      }
    });
  }

  // llenarDetalleCompras2() {
  //   if (this.detalleCompras != undefined) {

  //     this.detalleCompras.forEach((element: any) => {
  //       //buscar en this.productos el codigo y traer todo el objeto del codigo
  //       const selectedObject = this.productos.find((item: any) => item.idProducto == element.idProducto);
  //       element.producto = selectedObject;

  //       //buscar en this.sucursales el idSucursal y traer todo el objeto del idSucursal
  //       const selectedObjectSucursal = this.sucursales.find((item: any) => item.idSucursal == element.idSucursal);
  //       element.sucursal = selectedObjectSucursal;

  //       //buscar en this.categoria el idCategoria y traer todo el objeto del idCategoria
  //       const selectedObjectCategoria = this.categoria.find((item: any) => item.idCategoria == element.producto.idCategoria);
  //       if (selectedObjectCategoria) {
  //         element.categoria = selectedObjectCategoria;
  //       }else{
  //         console.error(`Categoria con id ${element.producto.idCategoria} no encontrada`);
  //       }

  //       //buscar en this.presentacion el idPresentacion y traer todo el objeto del idPresentacion

  //       const selectedObjectPresentacion = this.presentacion.find((item: any) => item.idPresentacion == element.producto.idPresentacion);
  //       element.presentacion = selectedObjectPresentacion;

  //       //buscar en this.marcas el idMarca y traer todo el objeto del idMarca
  //       const selectedObjectMarca = this.marcas.find((item: any) => item.idMarca == element.producto.idMarca);
  //       element.marca = selectedObjectMarca;
  //     }
  //     );
  //     // this.detalleCompras = response.data;
  //     this.detalleCompras_const = JSON.parse(JSON.stringify(this.detalleCompras));


  //     // console.log('this.detalleCompras antes de recorrerlo', this.detalleCompras);
  //     // //quiero recorrer detallecompras y modificar algunos campos
  //     // this.detalleCompras.forEach((element: any) => {
  //     //   element.idPresentacion = element.producto.idPresentacion;
  //     //   element.idCategoria = element.producto.idCategoria;
  //     //   element.idSucursal = element.sucursal.idSucursal;
  //     //   element.pUnitario = element.pUnitario;
  //     //   element.idMarca = element.producto.idMarca;
  //     //   element.subtotal = element.total;
  //     //   element.descripcion = element.producto.descripcion;
  //     //   element.codigo = element.producto.Codigo;
  //     //   element.fProduccion = element.producto.fProduccion;
  //     //   element.fVencimiento = element.producto.fVencimiento;
  //     // });




  //     this.loadCompras = false;
  //     //console.log('this.detalleCompras despues de recorrerlo', this.detalleCompras);
  //   }
  // }

  

  obtenerCorrelativo() {
    this._comprasService.obtener_correlativo_empresa().subscribe(
      response => {
        this.correlativo = response.data[0];

              },
      error => {
              }
    );
  }


  obtenerProductos() {
    this.productos = [];
    this.productos_const = [];

    this._productoService.obtenerProductosTodos().subscribe(
      (response: any) => {
        if (response.data != undefined) {
          this.productos = response.data;
          if (this.detalleCompras?.length) {
            this.llenarDetalleCompras();
          }
        }
        this.productos_const = this.productos;
      },
      (error: any) => {
        console.error('Error al cargar productos:', error);
      }
    );
  }

  obtenerStockSucursal() {
    this._sucursalService.obtener_stock_sucursales_idempresa().subscribe(
      response => {
        this.stockSucursales = response.data;
        if (response.data != undefined) {
          if (this.productos && this.sucursales && this.categoria && this.presentacion && this.stockSucursales) {
            // Realizar operaciones con los arrays
                                                            
            //quiero buscar en response.data el idProducto y traer todo el objeto del idProducto y agregarlo a this.stockSucursales

            this.stockSucursales.forEach((element: any) => {
              //buscar en this.productos el codigo y traer todo el objeto del codigo
              const selectedObject = this.productos.find((item: any) => item.idProducto == element.idProducto);
              element.producto = selectedObject;
              // Ahora, selectedObject contiene toda la información del elemento seleccionado
              //buscar en this.sucursales el idSucursal y traer todo el objeto del idSucursal
              const selectedObjectSucursal = this.sucursales.find((item: any) => item.idSucursal == element.idSucursal);
              element.sucursal = selectedObjectSucursal;

              //buscar en this.categoria el idCategoria y traer todo el objeto del idCategoria
              const selectedObjectCategoria = this.categoria.find((item: any) => item.idCategoria == element.producto.idCategoria);
              element.categoria = selectedObjectCategoria;

              //buscar en this.presentacion el idPresentacion y traer todo el objeto del idPresentacion
              const selectedObjectPresentacion = this.presentacion.find((item: any) => item.idPresentacion == element.producto.idPresentacion);
              element.presentacion = selectedObjectPresentacion;

              //buscar en this.marcas el idMarca y traer todo el objeto del idMarca
              const selectedObjectMarca = this.marcas.find((item: any) => item.idMarca == element.producto.idMarca);
              element.marca = selectedObjectMarca;

            });
          } else {
            console.error('Uno de los arrays es undefined o está vacío.');
          }


          this.stockSucursales_const = this.stockSucursales;
                  } else {
          this.stockSucursales = [];
        }

      },
      error => {
              }
    );
  }

  cargarSucursales() {
    this.sucursales = [];
    this._sucursalService.obtener_sucursal_idempresa().subscribe(
      response => {
        this.sucursales = response.data;
              },
      error => {
              }
    );
  }

  cargarCategorias() {
    this.categoria = [];
    this._categoriaService.obtener_categorias().subscribe(
      response => {
        this.categoria = response.data;
        this.categoria.sort((a: { nombre: string; }, b: { nombre: any; }) => a.nombre.localeCompare(b.nombre));
              },
      error => {
              }
    );
  }

  cargarMarcas() {
    this.marcas = [];
    this._marcaService.obtenerMarcas().subscribe(
      response => {
        this.marcas = response.data;
        this.marcas.sort((a: { nombre: string; }, b: { nombre: any; }) => a.nombre.localeCompare(b.nombre));
              },
      error => {
              }
    );
  }

  buscar() {
        
    this._proveedoresService.obtener_proveedor_ruc(this.compras.ruc).subscribe(
      response => {
                if (response.data && response.data.length > 0) {

          this.proveedores = response.data[0];
          this.compras.idProveedor = this.proveedores.idProveedor;
          this.compras.idDocumento = this.proveedores.idDocumento;
                  } else {
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: 'El Proveedor no existe.'
          });
        }
      },
      // error => {
      //   console.log(error);
      // }
    );
  }


  quitar(idx: any, subtotal: any) {
    if (idx >= 0 && idx < this.detalleCompras.length) {
            //quiero agregar al objeto this.prodEliminado los idProducto de los productos que se eliminen eliminar

      this.detalleCompras.splice(idx, 1);
      this.compras.total = this.compras.total - subtotal;

    }
  }

  seleccionar(idx: number) {
    //quiero agregar a this.nuevoProducto el objeto seleccionado
    if (idx >= 0 && idx < this.stockSucursales.length) {

      this.prodSelecionado = this.stockSucursales[idx];
      
      this.nuevoProducto.idProducto = this.prodSelecionado.idProducto;
      this.nuevoProducto.codigo = this.prodSelecionado.producto.Codigo;
      this.nuevoProducto.descripcion = this.prodSelecionado.producto.descripcion;
      this.nuevoProducto.pUnitario = this.prodSelecionado.producto.cUnitario;
      this.nuevoProducto.idCategoria = this.prodSelecionado.producto.idCategoria;
      this.nuevoProducto.idPresentacion = this.prodSelecionado.producto.idPresentacion;
      this.nuevoProducto.idSucursal = this.prodSelecionado.idSucursal;
      this.nuevoProducto.cantidad = 0;
      this.nuevoProducto.idMarca = this.prodSelecionado.producto.idMarca;
      this.nuevoProducto.cantidadAnterior = this.prodSelecionado.cantidad;
      this.nuevoProducto.ubicacion = this.prodSelecionado.ubicacion;
      this.nuevoProducto.idLote = this.prodSelecionado.idLote ?? this.prodSelecionado.idStockSucursal;
      this.nuevoProducto.idEmpresa = this.prodSelecionado.idEmpresa;

      this.nuevoProducto.fProduccion = this.prodSelecionado.producto.fProduccion;
      //quiero convertir la fecha de produccion a string en formato yyyy-mm-dd



      this.nuevoProducto.fVencimiento = this.prodSelecionado.producto.fVencimiento;
    }




    
  }


  // seleccionarDetalle(idx: number) {
  //   this.editardetalle = true;

  //   if (idx >= 0 && idx < this.detalleCompras.length) {

  //     this.prodSelecionado = this.detalleCompras[idx];
  //     console.log('this.prodSelecionado', this.prodSelecionado);

  //     this.nuevoProducto.idProducto = this.prodSelecionado.idProducto;
  //     this.nuevoProducto.codigo = this.prodSelecionado.producto.Codigo;
  //     this.nuevoProducto.descripcion = this.prodSelecionado.producto.descripcion;
  //     this.nuevoProducto.cUnitario = this.prodSelecionado.producto.cUnitario;
  //     this.nuevoProducto.idCategoria = this.prodSelecionado.producto.idCategoria;
  //     this.nuevoProducto.idPresentacion = this.prodSelecionado.producto.idPresentacion;
  //     this.nuevoProducto.idSucursal = this.prodSelecionado.idSucursal;
  //     this.nuevoProducto.cantidad = this.prodSelecionado.cantidad;
  //     this.nuevoProducto.idMarca = this.prodSelecionado.producto.idMarca;
  //     this.nuevoProducto.cantidadAnterior = this.prodSelecionado.cantidad;
  //     this.nuevoProducto.ubicacion = this.prodSelecionado.ubicacion;
  //     this.nuevoProducto.idStockSucursal = this.prodSelecionado.idStockSucursal;
  //     this.nuevoProducto.idEmpresa = this.prodSelecionado.idEmpresa;

  //     this.nuevoProducto.fProduccion = this.prodSelecionado.producto.fProduccion;
  //     //quiero convertir la fecha de produccion a string en formato yyyy-mm-dd



  //     this.nuevoProducto.fVencimiento = this.prodSelecionado.producto.fVencimiento;
  //   }




  //   console.log('this.nuevoProducto', this.nuevoProducto);

  // }



  buscarDescripcion() {
    if (this.filtroConsulta) {
      const term = new RegExp(this.filtroConsulta, 'i');
      this.stockSucursales = this.stockSucursales_const.filter((item: any) =>
        item?.producto && (term.test(item.producto.descripcion || '') || term.test(item.producto.Codigo || item.producto.codigo || ''))
      );
    } else {
      this.stockSucursales = this.stockSucursales_const;
    }
  }

  muestraEmpresaEnBuscadorCompras(): boolean {
    const list = Array.isArray(this.productos_const) ? this.productos_const : [];
    return list.some(
      (p: { aliasEmpresa?: string; razonSocialEmpresa?: string }) =>
        !!(p?.aliasEmpresa && String(p.aliasEmpresa).trim()) ||
        !!(p?.razonSocialEmpresa && String(p.razonSocialEmpresa).trim())
    );
  }

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
    const term = (this.searchTerm || '').toLowerCase().trim();
    if (term === '') {
      this.productos_filtrados = Array.isArray(this.productos_const) ? [...this.productos_const] : [];
    } else {
      this.productos_filtrados = (this.productos_const || []).filter((item: any) => {
        const descripcion = (item.descripcion ?? '').toString().toLowerCase();
        const codigo = (item.codigo ?? '').toString().toLowerCase();
        const marca = (item.marca ?? '').toString().toLowerCase();
        return descripcion.includes(term) || codigo.includes(term) || marca.includes(term);
      });
    }
  }

  seleccionaProducto(p: any): void {
    if (!p?.idProducto) return;
    const idSucursal = this.compras.idSucursal || (this.sucursales?.length === 1 ? this.sucursales[0].idSucursal : null);
    if (!idSucursal) {
      iziToast.show({
        title: 'Aviso',
        titleColor: '#856404',
        color: '#FFF',
        class: 'text-warning',
        position: 'topRight',
        message: 'Seleccione una sucursal en la cabecera de la compra.'
      });
      return;
    }
    const pUnitario = Number(p.cUnitario ?? p.pUnitario ?? 0);
    const cantidad = 1;
    const total = pUnitario * cantidad;
    const existe = this.detalleCompras.find((d: any) => d.idProducto === p.idProducto && d.idSucursal === idSucursal);
    if (existe) {
      existe.cantidad = (existe.cantidad || 0) + 1;
      existe.subtotal = existe.total = (existe.cantidad || 0) * (Number(existe.cUnitario ?? existe.pUnitario ?? 0));
    } else {
      this.detalleCompras.push({
        idProducto: p.idProducto,
        idSucursal,
        cantidad,
        pUnitario,
        total,
        subtotal: total,
        codigo: p.codigo,
        descripcion: p.descripcion,
        cUnitario: pUnitario,
        producto: p,
        fProduccion: p.fProduccion,
        fVencimiento: p.fVencimiento
      });
      this.llenarDetalleCompras();
    }
    this.sumarDetalleCompras();
    this.sumarFooterFactura();
    const el = document.getElementById('buscadorModal');
    if (el && typeof bootstrap !== 'undefined') {
      const modal = bootstrap.Modal.getInstance(el);
      modal?.hide();
    }
  }

  onselectMarca(selectedValue: any) {
        const selectedObject = this.marcas.find((item: any) => item.idMarca == selectedValue);
    this.nuevoProducto.marca = selectedObject;
          }

  onInputChangesCompCompras() {
    this.compras.compCompra = this.compras.serie + '-' + this.compras.numero;
            
    let idProveedor = {};
    idProveedor = this.compras.idProveedor;

    this._comprasService.buscar_comprobante_idCliente(idProveedor).subscribe(
      response => {
        if (response.data != undefined) {
          
          //quiero buscar this.compras.compCompra en response.data y si existe mostrar un mensaje que el comprobante ya existe
          const selectedObject = response.data.find((item: any) => item.compCompra == this.compras.compCompra);
                    if (selectedObject) {
            iziToast.show({
              title: 'ERROR',
              titleColor: '#FF0000',
              color: '#FFF',
              class: 'text-danger',
              position: 'topRight',
              message: 'El comprobante ya existe.'
            });
            this.compras.numero = '';
          }



        }
      },
      error => {
              }
    );

    this.updatecompra++;

  }

  onSelectPresentacion(event: any) {

    const idPresentacion = Number(event);
    if (!isNaN(idPresentacion)) {
      this.nuevoProducto.idPresentacion = idPresentacion;
      // Lógica adicional para manejar la selección de presentación

      const selectedObject = this.presentacion.find((item: any) => item.idPresentacion == idPresentacion);
      this.nuevoProducto.presentacion = selectedObject;
      // Ahora, selectedObject contiene toda la información del elemento seleccionado
                } else {
      console.error("Valor inválido para idPresentacion");
    }


  }

  onSelectCategoria(selectedValue: any) {
    const numericValue = Number(selectedValue);
    const selectedObject = this.categoria.find((item: any) => item.idCategoria == numericValue);
    this.nuevoProducto.categoria = selectedObject;
    // Ahora, selectedObject contiene toda la información del elemento seleccionado
        
  }

  onSelectSucursal(selectedValue: any) {
    const numericValue = Number(selectedValue);

    const idSucursal = Number(selectedValue);
    if (!isNaN(idSucursal)) {
      this.nuevoProducto.idSucursal = idSucursal;
      // Lógica adicional para manejar la selección de sucursal
      const selectedObject = this.sucursales.find((item: any) => item.idSucursal == numericValue);
      this.nuevoProducto.sucursal = selectedObject;
      // Ahora, selectedObject contiene toda la información del elemento seleccionado
                } else {
      console.error("Valor inválido para idSucursal");
    }


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

  // modalNuevoProducto() {
  //   this.nuevoProducto = {};
  //    $('#nuevoProductoModal').modal('show');
  // }
  modalNuevoProducto() {
    this.nuevoProducto = {}; // Reinicia el objeto del producto
    const modal = new bootstrap.Modal(document.getElementById('nuevoProductoModal'));
    modal.show();
}

  crearNuevoProductoModal() {

        this._productoService.crearProducto(this.nuevoProducto).subscribe(
      response => {
                if (response.data) {
          // this.productos.push(response.data);
          //this.productos = response.data;
                    this.nuevoProducto.idProducto = response.data;
          this.obtenerProductos();

          // Crear lote (stock) con idSucursal, idProducto, cantidad, costoUnitario
          let stockSucursal: Record<string, unknown> = {
            idSucursal: this.nuevoProducto.idSucursal,
            idProducto: this.nuevoProducto.idProducto,
            cantidad: this.nuevoProducto.cantidad,
            costoUnitario: this.nuevoProducto.cUnitario ?? 0,
            idEmpresa: this.compras.idEmpresa
          };
          if (this.nuevoProducto.idLote) {
            stockSucursal['idLote'] = this.nuevoProducto.idLote;
          }

                    this._sucursalService.crear_stock_sucursal_idEmpresa(stockSucursal).subscribe(
            response => {
              if (response.data) {
                iziToast.show({
                  title: 'OK',
                  titleColor: '#008000',
                  color: '#FFF',
                  class: 'text-success',
                  position: 'topRight',
                  message: 'Producto creado correctamente.'
                });

                this.productoCreado = true;
                // this.obtenerProductos();
                                                
                this.obtenerStockSucursal();
                this.obtenerCorrelativo();  // Actualizar correlativo
                //aqui quiero desmarcar el checkbox
                this.nuevoProducto.useCorrelativo = false;
                
              }
            },
            error => {
                          }
          );



          if (this.correlativo && this.correlativo.numero !== undefined) {
            this.correlativo.numero = this.correlativo.numero + 1;

            this._comprasService.editar_correlativos_empresa(this.correlativo.idCorrelativo,this.correlativo).subscribe(
              response => {
                                if (response.data) {
                                    this.obtenerCorrelativo();
                }
              },
              error => {
                              }
            );
          } else {
            console.error("correlativo o correlativo.numero es undefined");
          }
         
          // $('#nuevoProductoModal').modal('hide');
        }
      },
      error => {
              }
    );

    
  }

  // agregarProductoNuevo() {

  //   console.log('this.nuevoProducto', this.nuevoProducto);


  //   //quiero agregar la condicion di idProducto, idpresentacion, idcategoria y idsucursal no estan vacios

  //   if (!this.nuevoProducto.fProduccion) {
  //     this.nuevoProducto.fProduccion = undefined;
  //   }

  //   if (!this.nuevoProducto.fVencimiento) {
  //     this.nuevoProducto.fVencimiento = undefined;
  //   }

  //    let subTotal = this.nuevoProducto.cantidad * this.nuevoProducto.pUnitario;
  //    this.nuevoProducto.subtotal = subTotal;

  //    console.log('this.nuevoProducto.subtotal', this.nuevoProducto);

  //   if (this.nuevoProducto.idPresentacion != undefined && this.nuevoProducto.idCategoria != undefined && this.nuevoProducto.idSucursal != undefined) {
  //     this.detalleCompras.push(this.nuevoProducto);
  //     console.log('si hay datos que guardar')


  //     try {
  //       if (this.detalleCompras.idProducto != undefined) {
  //         console.log('this.detalleCompras.idProducto = undefined');
  //         this.llenarDetalleCompras();

  //       } else {

  //         console.log('this.detalleCompras.idProducto = undefined');

  //         this.llenarDetalleCompras();
  //       }

  //       console.log('this.detalleCompras', this.detalleCompras);
  //     } catch (error) {
  //       console.log(error);
  //     }


  //   } else {
  //     iziToast.show({
  //       title: 'ERROR',
  //       titleColor: '#FF0000',
  //       color: '#FFF',
  //       class: 'text-danger',
  //       position: 'topRight',
  //       message: 'Debe llenar todos los campos obligatorios (*).'
  //     });
  //   }



  //   //deseo multiplicar el precio por la cantidad de this.nuevoProducto
  //   //this.nuevoProducto.subtotal = this.nuevoProducto.cUnitario * this.nuevoProducto.cantidad;
  //   console.log('this.nuevoProducto', this.nuevoProducto);


  //   console.log('this.detalleCompras', this.detalleCompras);

  //   // //deseo recorrer detalleCompras y sumar el subtotal y guardarlo en this.compras.total
  //   // this.compras.subTotal = 0;
  //   // this.detalleCompras.forEach((element: any) => {
  //   //   this.compras.subTotal = this.compras.subTotal + element.subtotal;
  //   // });


  //   this.sumarDetalleCompras();

  //   this.nuevoProducto = {};
  //   this.correlativo.numero = this.correlativo.numero + 1;
  //   this.sumarFooterFactura();

  //   this.updateDetalleCompra++;

  // }

  agregarProductoNuevo() {

    this.productoCreado = false;
    
    // Verificar si los campos necesarios están presentes y no vacíos
    if (!this.nuevoProducto.idPresentacion || !this.nuevoProducto.idCategoria || !this.nuevoProducto.idSucursal) {
      iziToast.show({
        title: 'ERROR',
        titleColor: '#FF0000',
        color: '#FFF',
        class: 'text-danger',
        position: 'topRight',
        message: 'Debe llenar todos los campos obligatorios (*).'
      });
      return;
    }

    // Asignar undefined a fProduccion y fVencimiento si no están presentes
    if (!this.nuevoProducto.fProduccion) {
      this.nuevoProducto.fProduccion = undefined;
    }

    if (!this.nuevoProducto.fVencimiento) {
      this.nuevoProducto.fVencimiento = undefined;
    }

    // Verificar y calcular el subtotal
    if (typeof this.nuevoProducto.cantidad === 'number' && typeof this.nuevoProducto.pUnitario === 'number') {
      let subTotal = this.nuevoProducto.cantidad * this.nuevoProducto.pUnitario;
      this.nuevoProducto.subtotal = subTotal;
    } else {
            return;
    }

    
    // Agregar nuevoProducto a detalleCompras
    this.detalleCompras.push({ ...this.nuevoProducto });
        this.llenarDetalleCompras();

    //quiero buscar en detalleCompras el idProducto de this.nuevoProducto y asignar a this.detalleCompras.subtotal = this.nuevoProducto.subtotal
    //  this.detalleCompras.forEach((element: any) => {
    //     if (element.idProducto === this.nuevoProducto.idProducto) {
    //       element.subtotal = this.nuevoProducto.subtotal;
    //     }
    //   });

    // Reiniciar nuevoProducto
    this.nuevoProducto = {};

    // Incrementar el correlativo


    // Llamar a las funciones adicionales
    this.sumarDetalleCompras();
    this.sumarFooterFactura();

        this.updateDetalleCompra++;
  }




  sumarDetalleCompras() {
    this.compras.subTotal = 0;
    this.detalleCompras.forEach((element: any) => {
      const cantidad = Number(element.cantidad) || 0;
      const pUnitario = (Number(element.pUnitario) ?? Number(element.cUnitario)) || 0;
      element.subtotal = parseFloat((cantidad * pUnitario).toFixed(2));
      element.total = element.subtotal;
      this.compras.subTotal += element.subtotal;
    });
    this.compras.subTotal = parseFloat(Number(this.compras.subTotal).toFixed(2));
  }

  sumarFooterFactura() {
    const subTotal = Number(this.compras.subTotal) || 0;
    const igv = Number(this.compras.igv) || 0;
    const otrosCargos = Number(this.compras.otrosCargos) || 0;
    const descuentos = Number(this.compras.descuentos) || 0;
    this.compras.total = parseFloat((subTotal + igv + otrosCargos - descuentos).toFixed(2));
    this.updatecompra++;
    this._cdr.detectChanges();
  }

  onInput() {
    const subTotal = Number(this.compras.subTotal) || 0;
    const igv = Number(this.compras.igv) || 0;
    const otrosCargos = Number(this.compras.otrosCargos) || 0;
    const descuentos = Number(this.compras.descuentos) || 0;
    this.compras.total = parseFloat((subTotal + igv + otrosCargos - descuentos).toFixed(2));
    this._cdr.detectChanges();
  }


  buscarFactura() {
    this.compras.compCompra = this.compras.serie + '-' + this.compras.numero;
    this.compras.idProveedor = this.proveedores.idProveedor;

  }


  sonArraysIguales(array1: any[], array2: any[]): boolean {
    if (array1.length !== array2.length) {
      return false;
    }
    return array1.every((element, index) => element === array2[index]);
  }


  sonIguales(objeto1: any, objeto2: any): boolean {
    //Si ambos son arrays
    if (Array.isArray(objeto1) && Array.isArray(objeto2)) {
      // Verificar si ambos arrays tienen la misma longitud
      if (objeto1.length !== objeto2.length) {
        return false;
      }
      // Verificar si todos los elementos de objeto1 son iguales a los elementos correspondientes de objeto2
      return objeto1.every((element, index) => element === objeto2[index]);
    }

    // Si ambos son objetos
    if (typeof objeto1 === 'object' && objeto1 !== null && typeof objeto2 === 'object' && objeto2 !== null) {
      const keys1 = Object.keys(objeto1);
      const keys2 = Object.keys(objeto2);

      // Verificar si ambos objetos tienen las mismas claves
      if (!this.sonArraysIguales(keys1, keys2)) {
        return false;
      }

      // Verificar si todos los valores de las claves de objeto1 son iguales a los valores correspondientes de objeto2
      return keys1.every(key => objeto1[key] === objeto2[key]);
    }

    // // Si no son ni arrays ni objetos, simplemente comparar los valores
    return objeto1 === objeto2;
  }



  ActualizarCompras() {
    this.sumarDetalleCompras();
    this.sumarFooterFactura();

    const comprasCambiadas = !this.sonIguales(this.compras, this.compras_const);
    const detalleCambiado = !this.sonIguales(this.detalleCompras, this.detalleCompras_const);
        if (comprasCambiadas) {
      const payloadCompra = {
        compCompra: this.compras.compCompra,
        serie: this.compras.serie,
        numero: this.compras.numero,
        fEmision: this.compras.fEmision,
        fVencimiento: this.compras.fVencimiento,
        idProveedor: this.compras.idProveedor,
        idMoneda: this.compras.idMoneda,
        idEstadoPago: this.compras.idEstadoPago,
        subTotal: this.compras.subTotal,
        igv: this.compras.igv,
        exonerado: this.compras.exonerado ?? 0,
        gratuito: this.compras.gratuito ?? 0,
        otrosCargos: this.compras.otrosCargos ?? 0,
        descuentos: this.compras.descuentos ?? 0,
        total: this.compras.total,
        idMediosPago: this.compras.idMediosPago,
        compRelacionado: this.compras.compRelacionado ?? null,
        idUsuario: this.compras.idUsuario
      };
      this._comprasService.editar_compra(this.idCompra, payloadCompra).subscribe({
        next: (response) => {
          if (response.data != undefined) {
            iziToast.show({
              title: 'SUCCESS',
              titleColor: '#006400',
              color: '#FFF',
              class: 'text-success',
              position: 'topRight',
              message: 'La compra se actualizó correctamente.'
            });
            this.compras_const = JSON.parse(JSON.stringify(this.compras));
          }
        },
        error: (err) => console.error('Error al editar compra:', err)
      });
    }

    if (detalleCambiado) {
      this._comprasService.editar_detalle_compras_idcompra(this.idCompra, this.detalleCompras).subscribe({
        next: (response) => {
          if (response.data != undefined) {
            iziToast.show({
              title: 'SUCCESS',
              titleColor: '#006400',
              color: '#FFF',
              class: 'text-success',
              position: 'topRight',
              message: 'El detalle de la compra se actualizó correctamente.'
            });
            this.detalleCompras_const = JSON.parse(JSON.stringify(this.detalleCompras));
          }
        },
        error: (err) => console.error('Error al editar detalle:', err)
      });
    }

    if (comprasCambiadas || detalleCambiado) {
      iziToast.show({
        title: 'OK',
        titleColor: '#006400',
        color: '#FFF',
        class: 'text-success',
        position: 'topRight',
        message: 'Cambios guardados. Redirigiendo a compras.'
      });
      setTimeout(() => this._router.navigate(['/compras']), 1500);
    } else {
      iziToast.show({
        title: 'Info',
        titleColor: '#0c5460',
        color: '#FFF',
        class: 'text-info',
        position: 'topRight',
        message: 'No hay cambios que guardar.'
      });
    }
  }

  idEliminado(){
    //quiero comparar detalleCompras con detalleCompras_const y extraer los idDetalleCompra que se eliminaron
    let idDetalleCompraEliminado: any[] = [];
    this.detalleCompras_const.forEach((element: any) => {
      if (!this.detalleCompras.some((item: any) => item.idDetalleCompra === element.idDetalleCompra)) {
        idDetalleCompraEliminado.push(element.idDetalleCompra);
      }
    });
    
      }


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



  actualizarSubtotal(idx: number) {
    const el = this.detalleCompras[idx];
    if (!el) return;
    const cantidad = Number(el.cantidad) || 0;
    const pUnitario = Number(el.pUnitario) || 0;
    el.subtotal = parseFloat((cantidad * pUnitario).toFixed(2));
    el.total = el.subtotal;
    this.sumarDetalleCompras();
    this.sumarFooterFactura();
    this.idEliminado();
  }

  //quiero multiplicar el precio unitario por la cantidad y mostrar el resultado en el subtotal de this.nuevoProducto
  actualizarSubtotalNuevoProducto() {
    this.nuevoProducto.subtotal = parseFloat((Number(this.nuevoProducto.cantidad) * this.nuevoProducto.pUnitario).toFixed(2));
      }

  onSelectPUnitario(selectedValue: any) {
    this.nuevoProducto.subtotal = parseFloat((Number(this.nuevoProducto.cantidad) * this.nuevoProducto.pUnitario).toFixed(2));
    //console.log('actualizarSubtotalNuevoProducto this.nuevoProducto', this.nuevoProducto);
  }

}
