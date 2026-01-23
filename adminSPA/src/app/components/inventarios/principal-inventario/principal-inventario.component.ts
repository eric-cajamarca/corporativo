import { Component } from '@angular/core';
import { Subscription } from 'rxjs';
import { ComprasService } from '../../../services/compras.service';
import { ComprobanteService } from '../../../services/comprobante.service';
import { ProveedoresService } from '../../../services/proveedores.service';
import { ProductoService } from '../../../services/producto.service';
import { SucursalService } from '../../../services/sucursal.service';
import { DocumentoService } from '../../../services/documento.service';
import { TablasSunatService } from '../../../services/tablas-sunat.service';
import { CategoriaService } from '../../../services/categoria.service';
import { PresentacionService } from '../../../services/presentacion.service';
import { variosService } from '../../../services/varios.service';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var iziToast: any;
declare var boostrap: any;
const FORMATO_FECHA = 'dd/MM/yyyy';

@Component({
  selector: 'app-principal-inventario',
  standalone: true,
  imports: [
    FormsModule,
    RouterModule,
    CommonModule,
    TopnavComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './principal-inventario.component.html',
  styleUrl: './principal-inventario.component.css'
})
export class PrincipalInventarioComponent {
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
  public correlativo: any = '';
  public loadButton: boolean = false;
  public marcas: any = [];
  // FORMATO_FECHA = FORMATO_FECHA;

  // //variables para subir un xml
  // uploadForm: FormGroup;
  // xmlData: any;

  // // variable para consultar XML
  // consultaForm: FormGroup;
  // comprobante: any = null;
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
  ){}
  

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

  // Método para consultar XML
  

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

    this._productoService.obtenerProductosTodos().subscribe(
      (response: any) => {
        if (response.data != undefined) {
          this.productos = response.data;
        }
        this.productos_const = this.productos;
      },
      (error: any) => {
        console.error('Error al cargar productos:', error);
      }
    );

    this._comprasService.obtener_correlativo_empresa().subscribe(
      (response) => {
        this.correlativo = response.data[0];

        console.log('this.correlativo', this.correlativo);
      },
      (error) => {
        console.log(error);
      }
    );

    this._sucursalService.obtener_stock_sucursales_idempresa().subscribe(
      (response) => {
        this.stockSucursales = response.data;
        if (response.data != undefined) {
          if (
            this.productos &&
            this.sucursales &&
            this.categoria &&
            this.presentacion &&
            this.stockSucursales
          ) {
            // Realizar operaciones con los arrays
            console.log('this.productos', this.productos);
            console.log('this.sucursales', this.sucursales);
            console.log('this.categoria', this.categoria);
            console.log('this.presentacion', this.presentacion);
            console.log('this.stockSucursales', this.stockSucursales);

            //quiero buscar en response.data el idProducto y traer todo el objeto del idProducto y agregarlo a this.stockSucursales

            this.stockSucursales.forEach((element: any) => {
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
                (item: any) => item.idCategoria == element.producto.idCategoria
              );
              element.categoria = selectedObjectCategoria;

              //buscar en this.presentacion el idPresentacion y traer todo el objeto del idPresentacion
              const selectedObjectPresentacion = this.presentacion.find(
                (item: any) =>
                  item.idPresentacion == element.producto.idPresentacion
              );
              element.presentacion = selectedObjectPresentacion;

              //buscar en this.marcas el idMarca y traer todo el objeto del idMarca
              const selectedObjectMarca = this.marcas.find(
                (item: any) => item.idMarca == element.producto.idMarca
              );
              element.marca = selectedObjectMarca;

              console.log('selectedObjectMarca', selectedObjectMarca);
            });

            console.log('this.stockSucursales', this.stockSucursales);
          } else {
            console.error('Uno de los arrays es undefined o está vacío.');
          }

          this.stockSucursales_const = this.stockSucursales;
          console.log('this.stockSucursales', this.stockSucursales);
        } else {
          this.stockSucursales = [];
        }
      },
      (error) => {
        console.log(error);
      }
    );
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

    this._proveedoresService.obtener_proveedor_ruc(this.compras.ruc).subscribe(
      (response) => {
        if (response.data && response.data.length > 0) {
          this.proveedores = response.data[0];
          this.compras.idProveedor = this.proveedores.idProveedor;
          this.compras.idDocumento = this.proveedores.idDocumento;
          console.log(this.proveedores);
        } else {
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: 'El proveedor no existe.',
          });
        }
      }
      // error => {
      //   console.log(error);
      // }
    );
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
      this.nuevoProducto.idStockSucursal = this.prodSelecionado.idStockSucursal;
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

    //deseo recorrer detalleCompras y sumar el subtotal y guardarlo en this.compras.total
    this.compras.subTotal = 0;
    this.detalleCompras.forEach((element: any) => {
      this.compras.subTotal = this.compras.subTotal + element.subtotal;
    });

    this.nuevoProducto = {};
    this.correlativo.numero = this.correlativo.numero + 1;
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
      this.correlativo.numero = this.correlativo.numero + 1;
    }
  }

  sumarDetalleCompras() {
    //deseo recorrer detalleCompras y sumar el subtotal y guardarlo en this.compras.total
    this.compras.subTotal = 0;
    this.detalleCompras.forEach((element: any) => {
      this.compras.subTotal = this.compras.subTotal + element.subtotal;
      element.total = element.cantidad * element.pUnitario;
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
    this.compras.idProveedor = this.proveedores.idProveedor;
  }

  registrarCompras() {
    this.compras.compCompra = this.compras.serie + '-' + this.compras.numero;
    this.loadButton = true;

    // verifico si fechaEmision, fvencimiento, idMoneda, idEstadoPago, idMediosPago, total  son diferentes de vacio
    if (!this.validarCamposObligatorios()) {
      return;
   }

    console.log('this.compras', this.compras);
    // Aquí preparo los datos que irán a crear una compra nueva
    this._comprasService.crear_compra(this.compras).subscribe(
      (response) => {
        if (response.data != undefined) {
          // Aquí agrego el idCompra de la compra recién creada a cada detalle de compra
          this.idCompra = response.data;
          console.log('this.idCompra', this.idCompra);

          // Una vez registrada la compra, preparo para registrar los productos y el detalle de compras
          this.detalleCompras.forEach((element: any) => {
            // Creo una nueva instancia de nuevoProducto y nuevoDetalleCompra en cada iteración
            const nuevoProducto = {
              idProducto: element.idProducto,
              Codigo: element.codigo,
              idCategoria: element.idCategoria,
              descripcion: element.descripcion,
              idPresentacion: element.idPresentacion,
              cUnitario: element.cUnitario,
              fProduccion: element.fProduccion,
              fVencimiento: element.fVencimiento,
              cantidad: element.cantidad,
              cantidadAnterior: element.cantidadAnterior,
              facturar: 'SI',
              idStockSucursal: element.idStockSucursal,
              idEmpresa: element.idEmpresa,
              idMarca: element.idMarca,
              idSucursal: element.idSucursal,
              ubicacion: element.ubicacion,
            };
            console.log('nuevoProducto para crear o actualizar', nuevoProducto);

            const nuevoDetalleCompra = {
              idEmpresa: element.idEmpresa,
              idSucursal: element.idSucursal,
              idCompra: this.idCompra,
              cantidad: element.cantidad,
              idPresentacion: element.idPresentacion,
              pUnitario: parseFloat(element.cUnitario),
              total: element.subtotal,
              idProducto: element.idProducto || null, // Aún no conocemos el idProducto, se actualizará después de crearlo o encontrarlo
            };
            console.log('nuevoDetalleCompra para crear', nuevoDetalleCompra);
            // Identifico si el producto no existe, entonces lo creo, y si existe, solo actualizo el stock
            if (element.idProducto == undefined) {
              console.log('El producto es nuevo', this.nuevoProducto);
              this._productoService.crear_producto(nuevoProducto).subscribe(
                (productoResponse) => {
                  if (productoResponse.data != undefined) {
                    iziToast.show({
                      title: 'SUCCESS',
                      titleColor: '#1DC74C',
                      color: '#FFF',
                      class: 'text-success',
                      position: 'topRight',
                      message: 'El producto se registró correctamente.',
                    });

                    // Actualizo el idProducto en nuevoDetalleCompra
                    nuevoDetalleCompra.idProducto = productoResponse.data;
                    nuevoProducto.idProducto = productoResponse.data;
                    console.log('nuevoDetalleCompra con idProducto actualizado', nuevoDetalleCompra);
                    console.log('nuevoProducto con idProducto actualizado', nuevoProducto);
                    // Registro el stock del nuevo producto
                    this.crearStockSucursal(nuevoProducto);
                    this.crearDetalleCompra(nuevoDetalleCompra);
                  }
                },
                (productoError) => {
                  console.log(productoError);
                }
              );
            } else {
              // El código ya existe, entonces actualizo el producto y stock
              console.log('El producto ya existe', this.nuevoProducto);
              this.actualizarProducto(element.idProducto, nuevoProducto);
              this.editarStockSucursal(element.idProducto, nuevoProducto);
              this.crearDetalleCompra(nuevoDetalleCompra);
            }
          });

          // Después de agregar todos los productos, actualizo el correlativo
          this.editarCorrelativo();

          this.loadButton = false;
          this._router.navigate(['/compras']);
        }
      },
      (error) => {
         iziToast.show({
          title: 'ERROR',
          titleColor: '#FF0000',
          color: '#FFF',
          class: 'text-danger',
          position: 'topRight',
          message:error,
        });
        this.loadButton = false;
      }
    );
  }

  private validarCamposObligatorios(): boolean {
    const fechaOk =
      !!this.compras.fEmision &&
      String(this.compras.fEmision).trim() !== '';
      !!this.compras.fVencimiento &&
      String(this.compras.fVencimiento).trim() !== '';
    const idMonedaOk = !!this.compras.idMoneda;
    const idEstadoPagoOk = !!this.compras.idEstadoPago;
    const idMediosPagoOk = !!this.compras.idMediosPago;
    // exigir total > 0 (si quiere permitir total = 0 cambiar a >= 0)
    const totalOk = !isNaN(Number(this.compras.total)) && Number(this.compras.total) > 0;
    const detalleOk = Array.isArray(this.detalleCompras) && this.detalleCompras.length > 0;

    console.log('validarCamposObligatorios', {
      fechaOk,
      idMonedaOk,
      idEstadoPagoOk,
      idMediosPagoOk,
      totalOk,
      detalleOk,
    });

    if (!fechaOk || !idMonedaOk || !idEstadoPagoOk || !idMediosPagoOk || !totalOk || !detalleOk) {
      this.mostrarErrorValidacion();
      return false;
    }
    return true;
  }

  private mostrarErrorValidacion(): void {
    iziToast.show({
      title: 'ERROR',
      titleColor: '#FF0000',
      color: '#FFF',
      class: 'text-danger',
      position: 'topRight',
      message:
        'Debe llenar todos los campos obligatorios (*) y agregar al menos un producto.',
    });
    this.loadButton = false;
  }

  private crearStockSucursal(nuevoProducto: any) {
    console.log('nuevoProducto para crear stock', nuevoProducto);
    this._sucursalService
      .crear_stock_sucursal_idEmpresa(nuevoProducto)
      .subscribe(
        (stockResponse) => {
          if (stockResponse.data != undefined) {
            iziToast.show({
              title: 'SUCCESS',
              titleColor: '#1DC74C',
              color: '#FFF',
              class: 'text-success',
              position: 'topRight',
              message: 'El stock se registró correctamente.',
            });
            console.log('Stock creado', stockResponse.data);
          }
        },
        (stockError) => {
          console.log(stockError);
        }
      );
  }

  private actualizarProducto(element: any, nuevoProducto: any) {
    console.log('actualizarProducto', element, nuevoProducto);

    this._productoService.actualizar_producto(element, nuevoProducto).subscribe(
      (response) => {
        if (response.data != undefined) {
          iziToast.show({
            title: 'SUCCESS',
            titleColor: '#1DC74C',
            color: '#FFF',
            class: 'text-success',
            position: 'topRight',
            message: 'El producto se actualizó correctamente.',
          });

          console.log('Producto actualizado', response.data);
        }
      },
      (error) => {
        console.log(error);
      }
    );
  }

  private editarStockSucursal(element: any, nuevoProducto: any) {
    console.log('editarStockSucursal', nuevoProducto);
    console.log('element.idProducto', element);
    this._sucursalService
      .editar_stock_sucursal(element, nuevoProducto)
      .subscribe(
        (response) => {
          if (response.data != undefined) {
            iziToast.show({
              title: 'SUCCESS',
              titleColor: '#1DC74C',
              color: '#FFF',
              class: 'text-success',
              position: 'topRight',
              message: 'El stock se actualizó correctamente.',
            });

            console.log('Stock actualizado', response.data);
          }
        },
        (error) => {
          console.log(error);
        }
      );
  }

  private crearDetalleCompra(nuevoDetalleCompra: any) {
    console.log('nuevoDetalleCompra', nuevoDetalleCompra);
    this._comprasService
      .crear_detalle_compras_idcompra(nuevoDetalleCompra)
      .subscribe(
        (detalleResponse) => {
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
          console.log('detallecreado', detalleResponse.data);
        },
        (detalleError) => {
          console.log(detalleError);
        }
      );
  }

  private editarCorrelativo() {
    this._comprasService
      .editar_correlativos_empresa(
        this.correlativo.idCorrelativo,
        this.correlativo
      )
      .subscribe(
        (correlativoResponse) => {
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
        (correlativoError) => {
          console.log(correlativoError);
        }
      );
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

}
