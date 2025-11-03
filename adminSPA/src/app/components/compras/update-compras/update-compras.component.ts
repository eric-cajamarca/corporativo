import { Component } from '@angular/core';
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
import { ProveedoresService } from '../../../services/proveedores.service';


declare var iziToast: any;
declare var boostrap: any;

@Component({
  selector: 'app-update-compras',
  imports: [FormsModule, RouterModule, CommonModule, TopnavComponent],
  templateUrl: './update-compras.component.html',
  styleUrl: './update-compras.component.css'
})
export class UpdateComprasComponent {

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
    private _router: Router

  ) {
    //this.token = this._cookieService.get('token');
  }

  ngOnInit(): void {

    this.initData();

    this.loadCompras = true;
    this._route.params.subscribe(params => {
      console.log('params', params);
      this.idCompra = params['id'];
      console.log('this.idCompra', this.idCompra);

      //aqui obtengo la compra por id
      this._comprasService.obtener_compras_id(this.idCompra).subscribe(
        response => {
          console.log('obtener_compras_id', response);
          if (response.data != undefined) {
            this.compras = response.data[0];
            this.compras_const = JSON.parse(JSON.stringify(response.data[0]));
            console.log('this.compras', this.compras);
          }
          this.loadCompras = false;
        },
        error => {
          console.log(error);
        }
      );

      //aqui obtengo el detalle de compra por idCompra
      this._comprasService.obtener_detalle_compras_idcompra(this.idCompra).subscribe(
        response => {
          console.log('response detalle compras', response);
          this.detalleCompras = response.data;
          this.llenarDetalleCompras();
          if (response.data != undefined) {

           
            this.detalleCompras = response.data;
            this.detalleCompras_const = JSON.parse(JSON.stringify(response.data));


            //quiero recorrer detallecompras y modificar algunos campos
            this.detalleCompras.forEach((element: any) => {
              element.idPresentacion = element.producto.idPresentacion;
              element.idCategoria = element.producto.idCategoria;
              element.idSucursal = element.sucursal.idSucursal;
              element.cUnitario = element.pUnitario;
              element.subtotal = element.total;
              element.descripcion = element.producto.descripcion;
              element.codigo = element.producto.Codigo;
              element.fProduccion = element.producto.fProduccion;
              element.fVencimiento = element.producto.fVencimiento;
            });


            this.loadCompras = false;
            console.log('this.detalleCompras', this.detalleCompras);
          }
        },
        error => {
          console.log(error);
        }
      );
    });

    

  }

 

  initData() {

    this.updateDetalleCompra = 0;
    this.updatecompra = 0;

    this._comprobanteService.obtener_comprobantes().subscribe(
      response => {
        this.comprobantes = response.data;
        console.log(this.comprobantes);
      },
      error => {
        console.log(error);
      }
    );


    this._tablasSunatService.obtener_moneda().subscribe(
      response => {
        this.moneda = response.data;
        console.log(this.moneda);
      },
      error => {
        console.log(error);
      }
    );

    this._tablasSunatService.obtener_estado_pago().subscribe(
      response => {
        this.estadoPago = response.data;
        console.log(this.estadoPago);
      },
      error => {
        console.log(error);
      }
    );

    this._tablasSunatService.obtener_medios_pago().subscribe(
      response => {
        this.mediosPago = response.data;
        console.log(this.mediosPago);
      },
      error => {
        console.log(error);
      }
    );

    this._categoriaService.obtener_categorias().subscribe(
      response => {
        this.categoria = response.data;
        console.log('this.categoria', this.categoria);
      },
      error => {
        console.log(error);
      }
    );

    this._presentacionService.obtener_presentaciones().subscribe(
      response => {
        this.presentacion = response.data;
        console.log('this.presentacion', this.presentacion);
      },
      error => {
        console.log(error);
      }
    );

   this.cargarSucursales();

    this._marcaService.obtenerMarcas().subscribe(
      response => {
        this.marcas = response.data;
        this.marcas.sort((a: { nombre: string; }, b: { nombre: any; }) => a.nombre.localeCompare(b.nombre));
        console.log('this.marcas', this.marcas);
      },
      error => {
        console.log(error);
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
    if (this.detalleCompras != undefined) {

      this.detalleCompras.forEach((element: any) => {
        //buscar en this.productos el codigo y traer todo el objeto del codigo
        const selectedObject = this.productos.find((item: any) => item.idProducto == element.idProducto);
        element.producto = selectedObject;

        //buscar en this.sucursales el idSucursal y traer todo el objeto del idSucursal
        const selectedObjectSucursal = this.sucursales.find((item: any) => item.idSucursal == element.idSucursal);
        element.sucursal = selectedObjectSucursal;

        //buscar en this.categoria el idCategoria y traer todo el objeto del idCategoria
        const selectedObjectCategoria = this.categoria.find((item: any) => item.idCategoria == element.producto.idCategoria);
        if (selectedObjectCategoria) {
          element.categoria = selectedObjectCategoria;
        }else{
          console.error(`Categoria con id ${element.producto.idCategoria} no encontrada`);
        }

        //buscar en this.presentacion el idPresentacion y traer todo el objeto del idPresentacion

        const selectedObjectPresentacion = this.presentacion.find((item: any) => item.idPresentacion == element.producto.idPresentacion);
        element.presentacion = selectedObjectPresentacion;

        //buscar en this.marcas el idMarca y traer todo el objeto del idMarca
        const selectedObjectMarca = this.marcas.find((item: any) => item.idMarca == element.producto.idMarca);
        element.marca = selectedObjectMarca;
      }
      );
      // this.detalleCompras = response.data;
      //this.detalleCompras_const = JSON.parse(JSON.stringify(this.detalleCompras));


    }
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

        console.log('this.correlativo', this.correlativo);
      },
      error => {
        console.log(error);
      }
    );
  }


  obtenerProductos() {
    this.productos = [];
    this.productos_const = [];

    this._productoService.obtener_productos_todos().subscribe(
      response => {
        console.log('response productos', response.data);
        if (response.data != undefined) {

          this.productos = response.data;

          // this.productos = response.data;
          // console.log('this.productos como objeto',this.productos);

        }
        this.productos_const = this.productos;
        console.log('this.productos', this.productos);
      },
      error => {
        console.log(error);
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
            console.log('this.productos', this.productos);
            console.log('this.sucursales', this.sucursales);
            console.log('this.categoria', this.categoria);
            console.log('this.presentacion', this.presentacion);
            console.log('this.stockSucursales', this.stockSucursales);

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
          console.log('this.stockSucursales', this.stockSucursales);
        } else {
          this.stockSucursales = [];
        }

      },
      error => {
        console.log(error);
      }
    );
  }

  cargarSucursales() {
    this.sucursales = [];
    this._sucursalService.obtener_sucursal_idempresa().subscribe(
      response => {
        this.sucursales = response.data;
        console.log('this.sucursales', this.sucursales);
      },
      error => {
        console.log(error);
      }
    );
  }

  cargarCategorias() {
    this.categoria = [];
    this._categoriaService.obtener_categorias().subscribe(
      response => {
        this.categoria = response.data;
        this.categoria.sort((a: { nombre: string; }, b: { nombre: any; }) => a.nombre.localeCompare(b.nombre));
        console.log('this.categoria', this.categoria);
      },
      error => {
        console.log(error);
      }
    );
  }

  cargarMarcas() {
    this.marcas = [];
    this._marcaService.obtenerMarcas().subscribe(
      response => {
        this.marcas = response.data;
        this.marcas.sort((a: { nombre: string; }, b: { nombre: any; }) => a.nombre.localeCompare(b.nombre));
        console.log('this.marcas', this.marcas);
      },
      error => {
        console.log(error);
      }
    );
  }

  buscar() {
    console.log('this.filtro', this.filtro);
    console.log('this.clientes.ruc', this.compras.ruc);

    this._proveedoresService.obtener_proveedor_ruc(this.compras.ruc).subscribe(
      response => {
        console.log('obtener_proveedor_ruc', response);
        if (response.data && response.data.length > 0) {

          this.proveedores = response.data[0];
          this.compras.idProveedor = this.proveedores.idProveedor;
          this.compras.idDocumento = this.proveedores.idDocumento;
          console.log("proveedores", this.proveedores);
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
      console.log('idx', idx);
      //quiero agregar al objeto this.prodEliminado los idProducto de los productos que se eliminen eliminar

      this.detalleCompras.splice(idx, 1);
      this.compras.total = this.compras.total - subtotal;

    }
  }

  seleccionar(idx: number) {
    //quiero agregar a this.nuevoProducto el objeto seleccionado
    if (idx >= 0 && idx < this.stockSucursales.length) {

      this.prodSelecionado = this.stockSucursales[idx];
      console.log('this.prodSelecionado', this.prodSelecionado);

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
      this.nuevoProducto.idStockSucursal = this.prodSelecionado.idStockSucursal;
      this.nuevoProducto.idEmpresa = this.prodSelecionado.idEmpresa;

      this.nuevoProducto.fProduccion = this.prodSelecionado.producto.fProduccion;
      //quiero convertir la fecha de produccion a string en formato yyyy-mm-dd



      this.nuevoProducto.fVencimiento = this.prodSelecionado.producto.fVencimiento;
    }




    console.log('this.nuevoProducto', this.nuevoProducto);

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
    console.log('this.filtroConsulta', this.filtroConsulta);

    if (this.filtroConsulta) {
      // quiero bucar en this.stockSucursales el codigo o la descripcion que coincida con this.filtroConsulta
      var term = new RegExp(this.filtroConsulta, 'i');
      this.stockSucursales = this.stockSucursales_const.filter((item: { producto: { descripcion: string; Codigo: string; }; }) => term.test(item.producto.descripcion) || term.test(item.producto.Codigo));
      console.log('this.productos despues de la busqueda', this.stockSucursales);

      //
      // var term = new RegExp(this.filtroConsulta, 'i');
      // this.stockSucursales = this.stockSucursales_const.filter((item: { descripcion: string; Codigo: string; }) => term.test(item.descripcion) || term.test(item.Codigo));
      // console.log('this.productos despues de la busqueda', this.stockSucursales);
    }
    else {
      this.stockSucursales = this.stockSucursales_const;
    }
  }

  onselectMarca(selectedValue: any) {
    console.log('selectedValue', selectedValue);
    const selectedObject = this.marcas.find((item: any) => item.idMarca == selectedValue);
    this.nuevoProducto.marca = selectedObject;
    console.log('selectedObject', selectedObject);
    console.log('this.nuevoProducto', this.nuevoProducto);
  }

  onInputChangesCompCompras() {
    this.compras.compCompra = this.compras.serie + '-' + this.compras.numero;
    console.log('ejecuto una funcion onInputChangesCompCompras');
    console.log('this.compras.compCompra', this.compras.compCompra);
    console.log('this.compras.idProveedor', this.compras.idProveedor);

    let idProveedor = {};
    idProveedor = this.compras.idProveedor;

    this._comprasService.buscar_comprobante_idCliente(idProveedor).subscribe(
      response => {
        if (response.data != undefined) {
          console.log('response.data', response.data);

          //quiero buscar this.compras.compCompra en response.data y si existe mostrar un mensaje que el comprobante ya existe
          const selectedObject = response.data.find((item: any) => item.compCompra == this.compras.compCompra);
          console.log('selectedObject', selectedObject);
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
        console.log(error);
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
      console.log('selectedObject', selectedObject);
      console.log('this.nuevoProducto', this.nuevoProducto);
    } else {
      console.error("Valor inválido para idPresentacion");
    }


  }

  onSelectCategoria(selectedValue: any) {
    const numericValue = Number(selectedValue);
    const selectedObject = this.categoria.find((item: any) => item.idCategoria == numericValue);
    this.nuevoProducto.categoria = selectedObject;
    // Ahora, selectedObject contiene toda la información del elemento seleccionado
    console.log('selectedObject', selectedObject);
    console.log('this.nuevoProducto', this.nuevoProducto);

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
      console.log('selectedObject', selectedObject);
      console.log('this.nuevoProducto', this.nuevoProducto);
    } else {
      console.error("Valor inválido para idSucursal");
    }


  }

  onCheckboxChange() {
    if (this.nuevoProducto.useCorrelativo) {

      console.log('El checkbox está marcado.', this.nuevoProducto.useCorrelativo);

      // Realiza acciones cuando el checkbox está marcado

      this.nuevoProducto.codigo = this.correlativo.numero;
      this.nuevoProducto.idProducto = undefined;

      console.log('this.nuevoProducto', this.nuevoProducto);

    } else {
      console.log('El checkbox está desmarcado.', this.nuevoProducto.useCorrelativo);
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
    const modal = new boostrap.Modal(document.getElementById('nuevoProductoModal'));
    modal.show();
}

  crearNuevoProductoModal() {

    console.log('this.nuevoProducto', this.nuevoProducto);
    this._productoService.crear_producto(this.nuevoProducto).subscribe(
      response => {
        console.log('response', response);
        if (response.data) {
          // this.productos.push(response.data);
          //this.productos = response.data;
          console.log('this.productos', response.data);
          this.nuevoProducto.idProducto = response.data;
          this.obtenerProductos();

          //ahora quiero crear un nuevo registro en stockSucursales con estos datos idSucursal, idProducto, cantidad, ubicacion y idEmpresa
          let stockSucursal = {
            idSucursal: this.nuevoProducto.idSucursal,
            idProducto: this.nuevoProducto.idProducto,
            cantidad: this.nuevoProducto.cantidad,
            ubicacion: this.nuevoProducto.ubicacion,
            idEmpresa: this.compras.idEmpresa
          }

          console.log('stockSucursal antes de enviar a backend', stockSucursal);
          this._sucursalService.crear_stock_sucursal_idEmpresa(stockSucursal).subscribe(
            response => {
              console.log('response', response);
              if (response.data) {
                this.stockSucursales.push(response.data);
                console.log('this.stockSucursales', this.stockSucursales);

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
                console.log('this.productoCreado', this.productoCreado);
                console.log('this.productos', this.productos);
                console.log('this.nuevoProducto', this.nuevoProducto);

                this.obtenerStockSucursal();
                this.obtenerCorrelativo();  // Actualizar correlativo
                //aqui quiero desmarcar el checkbox
                this.nuevoProducto.useCorrelativo = false;
                
              }
            },
            error => {
              console.log(error);
            }
          );



          if (this.correlativo && this.correlativo.numero !== undefined) {
            this.correlativo.numero = this.correlativo.numero + 1;

            this._comprasService.editar_correlativos_empresa(this.correlativo.idCorrelativo,this.correlativo).subscribe(
              response => {
                console.log('response', response);
                if (response.data) {
                  console.log('correlativo actualizado correctamente');
                  this.obtenerCorrelativo();
                }
              },
              error => {
                console.log(error);
              }
            );
          } else {
            console.error("correlativo o correlativo.numero es undefined");
          }
         
          // $('#nuevoProductoModal').modal('hide');
        }
      },
      error => {
        console.log(error);
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
    console.log('this.nuevoProducto inicial', this.nuevoProducto);

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
      console.log('Error: cantidad o pUnitario no son números válidos', this.nuevoProducto.cantidad, this.nuevoProducto.pUnitario);
      return;
    }

    console.log('this.nuevoProducto con subtotal', this.nuevoProducto);

    // Agregar nuevoProducto a detalleCompras
    this.detalleCompras.push({ ...this.nuevoProducto });
    console.log('Producto agregado: ', this.nuevoProducto);
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

    console.log('this.detalleCompras despues de agregar el producto nuevo', this.detalleCompras);
    this.updateDetalleCompra++;
  }




  sumarDetalleCompras() {
    // //deseo recorrer detalleCompras y sumar el subtotal y guardarlo en this.compras.total
    this.compras.subTotal = 0;
    this.detalleCompras.forEach((element: any) => {
      this.compras.subTotal = this.compras.subTotal + element.subtotal;
      element.total = element.cantidad * element.pUnitario;
    });

    console.log('this.detallecompras.Total', this.detalleCompras);
  }


  sumarFooterFactura() {

    // this.compras.igv = 0;
    // this.compras.exonerado = 0;
    // this.compras.gratuito = 0;
    // this.compras.descuentos = 0;
    // this.compras.otrosCargos = 0;
    this.compras.total = 0;

    this.compras.total = (this.compras.subTotal + this.compras.igv + this.compras.otrosCargos) - this.compras.descuentos;

    console.log('this.compras', this.compras);
    this.updatecompra++;
  }

  onInput() {
    this.compras.total = (this.compras.subTotal + this.compras.igv + this.compras.otrosCargos) - this.compras.descuentos;
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

    console.log('this.compras', this.compras);
    console.log('this.detalleCompras', this.detalleCompras);

    //---------------------------------------
    //detecto si se realizo cambios en this.compras y this.detalleCompras
    //quiero comparar this.compras con this.compras_const son iguales o no
    if (this.sonIguales(this.compras, this.compras_const)) {
      console.log(' compras Son iguales');
    }
    else {
      console.log('compras No son iguales');

      this.compras.idCliente = this.compras.idCliente[0];
      console.log('this.compras antes de hacer la consulta', this.compras);
      this._comprasService.editar_compra(this.idCompra, this.compras).subscribe(
        response => {
          console.log('response', response);
          if (response.data != undefined) {
            iziToast.show({
              title: 'SUCCESS',
              titleColor: '#006400',
              color: '#FFF',
              class: 'text-success',
              position: 'topRight',
              message: 'La compra se actualizó correctamente.'
            });
          }
        },
        error => {
          console.log(error);
        }
      );
    }

    console.log('this.compras', this.compras);
    console.log('this.compras_const', this.compras_const);

    //quiero comparar this.detalleCompras con this.detalleCompras_const son iguales o no
    if (this.sonIguales(this.detalleCompras, this.detalleCompras_const)) {
      console.log('detalleCompras Son iguales');
    }
    else {
      console.log('detalleCompras No son iguales');

      //quiero recorrer detallecompras y modificar algunos campos
      console.log('this.detallecompras antes de recorrerlo', this.detalleCompras);
      // this.detalleCompras.forEach((element: any) => {

      //   element.pUnitario = element.cUnitario;

      // });
      console.log('this.detallecompras despues de recorrerlo', this.detalleCompras);

      console.log('this.detalleCompras antes de la consulta al controlador ', this.detalleCompras);
      
        this._comprasService.editar_detalle_compras_idcompra(this.idCompra, this.detalleCompras).subscribe(
          response => {
            console.log('response', response);
            if (response.data != undefined) {
              iziToast.show({
                title: 'SUCCESS',
                titleColor: '#006400',
                color: '#FFF',
                class: 'text-success',
                position: 'topRight',
                message: 'El detalle de la compra se actualizó correctamente.'
              });
            }
          },
          error => {
            console.log(error);
          }
        );

        // //quiero comparar detalleCompras con detalleCompras_const y extraer los idDetalleCompra que se eliminaron
        // let idDetalleCompraEliminado = [];
        // this.detalleCompras_const.forEach((element: any) => {
        //   if (!this.detalleCompras.some((item: any) => item.idDetalleCompra === element.idDetalleCompra)) {
        //     idDetalleCompraEliminado.push(element.idDetalleCompra);
        //   }
        // });
      
      //deseo recorrer detalleCompras y crear un nuevo objeto con los campos que necesito
      const estockSucursal = this.detalleCompras.forEach((element: any) => {
        let detalleCompra = {
          idStockSucursal: element.idStockSucursal,
          idEmpresa: element.idEmpresa,
          idSucursal: element.idSucursal,
          idProducto: element.idProducto,
          cantidadAnterior: element.cantidadAnterior,
          cantidad: element.cantidad,
          ubicacion: element.ubicacion,
          
          
        };

        console.log('estockSucursal', estockSucursal);
      }
      );
      
      this._sucursalService.crear_stock_sucursal_idEmpresa( estockSucursal).subscribe(
        response => {
          console.log('response', response);
          if (response.data != undefined) {
            iziToast.show({
              title: 'SUCCESS',
              titleColor: '#006400',
              color: '#FFF',
              class: 'text-success',
              position: 'topRight',
              message: 'El stock de la sucursal se actualizó correctamente.'
            });
          }
        },
        error => {
          console.log(error);
        }
      );
    }

    //aqui elimino los idDetalleCompra que se eliminaron
    this.idEliminado();
    //this._comprasService.(this.idCompra, this.token).subscribe(


    //this._router.navigate(['/compras']);


  }

  idEliminado(){
    //quiero comparar detalleCompras con detalleCompras_const y extraer los idDetalleCompra que se eliminaron
    let idDetalleCompraEliminado: any[] = [];
    this.detalleCompras_const.forEach((element: any) => {
      if (!this.detalleCompras.some((item: any) => item.idDetalleCompra === element.idDetalleCompra)) {
        idDetalleCompraEliminado.push(element.idDetalleCompra);
      }
    });
    
    console.log('idDetalleCompraEliminado', idDetalleCompraEliminado);
  }


  agregarNuevaCategoria() {
    console.log('agregarNuevaCategoria', this.categoria);
    //this._router.navigate(['/categorias/create']);
    window.open('/categorias/create', '_blank');

  }

  agregarNuevaMarca() {
    console.log('agregarNuevaMarca', this.marcas);
    window.open('/marcas/create', '_blank');
  }



  actualizarSubtotal(idx: number) {

    this.detalleCompras[idx].subtotal = parseFloat((this.detalleCompras[idx].cantidad * this.detalleCompras[idx].pUnitario).toFixed(2));
    this.sumarDetalleCompras();
    this.sumarFooterFactura();
    console.log('this.detalleCompras', this.detalleCompras);

    this.idEliminado();
    console.log('this.detalleCompras_const', this.detalleCompras_const);
  }

  //quiero multiplicar el precio unitario por la cantidad y mostrar el resultado en el subtotal de this.nuevoProducto
  actualizarSubtotalNuevoProducto() {
    this.nuevoProducto.subtotal = parseFloat((Number(this.nuevoProducto.cantidad) * this.nuevoProducto.pUnitario).toFixed(2));
    console.log('actualizarSubtotalNuevoProducto this.nuevoProducto', this.nuevoProducto);
  }

  onSelectPUnitario(selectedValue: any) {
    this.nuevoProducto.subtotal = parseFloat((Number(this.nuevoProducto.cantidad) * this.nuevoProducto.pUnitario).toFixed(2));
    console.log('actualizarSubtotalNuevoProducto this.nuevoProducto', this.nuevoProducto);
  }

}
