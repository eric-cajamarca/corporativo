import { Component } from '@angular/core';
import { ProductoService } from '../../../services/producto.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TopnavComponent } from '../../topnav/topnav.component';
import { RouterModule } from '@angular/router';
import { CategoriaService } from '../../../services/categoria.service';
import { SucursalService } from '../../../services/sucursal.service';
import { PresentacionService } from '../../../services/presentacion.service';
import { variosService } from '../../../services/varios.service';
import { IndexClientesComponent } from '../../clientes/index-clientes/index-clientes.component';
import { ClienteService } from '../../../services/cliente.service';
import { ComprobanteService } from '../../../services/comprobante.service';
import { TablasSunatService } from '../../../services/tablas-sunat.service';
import { DocumentoService } from '../../../services/documento.service';

declare var bootstrap: any;
declare var iziToast: any;

@Component({
  selector: 'app-create-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule,IndexClientesComponent, TopnavComponent],
  templateUrl: './create-ventas.component.html',
  styleUrl: './create-ventas.component.css'
})
export class CreateVentasComponent {

  public productos: any[] = [];
  productos_const: any[] = [];
  productos_filtrados: any[] = [];
  searchTerm: string = '';
  public categoria: any = [];
  public presentacion: any = [];
  public marcas: any = [];
  public stockSucursales: any = [];
  stockSucursales_const: any = [];
  private TASA_IGV: number = 0.18;
  public sucursales: any = [];
  public carrito: any[] = [];
  private buscadorModal: any;
  public moneda: any = [];
  public mediosPago: any = [];
  public estadoPago: any = [];
  public documento: any = [];
  public comprobantes: any = [];
  public cliente : any = {
    tipoDocumento: '1',
    razonsocial: '',
    direccion: '',

  };
  public ventas: any = {
    compVenta: '0000-00000000',
    idComprobante: '0',
    serie: '0000',
    numero: 0,
    idSucursal: '',
    idcliente: '',
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

  constructor(
    private _productoService: ProductoService,
    private _marcaService: variosService,
    private _categoriaService: CategoriaService,
    private _presentacionService: PresentacionService,
    private _sucursalService: SucursalService,
    private _clienteService: ClienteService,
    private _comprobanteService: ComprobanteService,
    private _tablasSunatService: TablasSunatService,
    private _documentosService: DocumentoService

  ) { }

 ngOnInit(): void {
    this.cargarDatos();
  }
  // Función para cargar todos los productos
  cargarDatos(){
    this._productoService.obtener_productos_todos().subscribe(
      (response) => {
        console.log('response productos', response.data);
        if (response.data != undefined) {
          this.productos = response.data;
          this.productos_const = this.productos;
          //this.productos_filtrados = this.productos; // Inicializar con todos los productos
          console.log('this.productos', this.productos);
        }
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

    this._comprobanteService.obtener_comprobantes().subscribe(
      (response) => {
        this.comprobantes = response.data;
        console.log('comprobantes',this.comprobantes);
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

     this._documentosService.obtener_documento().subscribe(
      response => {
        this.documento = response.data;
        console.log('this.documento', this.documento);
      },
      error => {
        console.log(error);
      }
    );

  }

  // Función para buscar productos por código o descripción
  buscarProductos(): void {
    const term = this.searchTerm.toLowerCase().trim();
    console.log('Término de búsqueda:', term);
    
    if (term === '') {
      // Si no hay término de búsqueda, mostrar todos los productos
      this.productos_filtrados = this.stockSucursales_const;
      console.log('No se ingresó término de búsqueda. Mostrando todos los productos.');
    } else {
      // Filtrar por código o descripción (uso includes en lugar de test)
      this.productos_filtrados = this.stockSucursales_const.filter(
        (item: any) => {
          const descripcion = (item.producto?.descripcion ?? '').toString().toLowerCase();
          const codigo = (item.producto?.Codigo ?? '').toString().toLowerCase();
          const marca = (item.marca?.nombre ?? '').toString().toLowerCase();
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

  // Función para limpiar la búsqueda
  limpiarBusqueda(): void {
    this.searchTerm = '';
    this.productos_filtrados = this.productos_const;
  }

//   cargarDatosComprobante(evt: Event): void {
//   const valor = (evt.target as HTMLInputElement).value;   // boleta | factura | nota | cotizacion
//   console.log('Comprobante seleccionado:', valor);
//   const comp = this.comprobantes.find((c: { nombre: string; }) => c.nombre === valor);

//   if (comp) {
//     this.ventas.serie = comp.serie;
//     this.ventas.numero = comp.numero;
//     this.ventas.idComprobante = comp.idComprobante;
//   }

//   console.log('Datos del comprobante cargados en ventas:', this.ventas);
// }

// ...existing code...
  cargarDatosComprobante(evt: Event): void {
    // obtener valor desde el input (manteniendo el enfoque actual)
    let valor = (evt.target as HTMLInputElement).value?.toString().trim();
    console.log('Comprobante seleccionado:', valor);

    if (!valor) {
      // Si el input está vacío, limpiar campos relacionados
      this.ventas.serie = '';
      this.ventas.numero = 0;
      this.ventas.idComprobante = '';
      console.warn('Valor de comprobante vacío, se limpiaron los datos en ventas.');
      return;
    }

    if(valor === 'nota'){
      valor = 'nota de pedido';
    }
    

    if(valor === 'factura'){
      this.documento.idDocumento = '6';
      
    }if(valor === 'boleta'){
      this.documento.idDocumento = '1';
    }if(valor === 'cotizacion'){
      this.documento.idDocumento = '1';
    }if(valor === 'nota de pedido'){
      this.documento.idDocumento = '1';
    }

    this.ventas.idDocumento = this.documento.idDocumento;

    // 1) Buscar por nombre (insensible a mayúsculas/espacios)
    const compByName = this.comprobantes.find((c: any) =>
      (c.nombre ?? '').toString().trim().toLowerCase() === valor.toLowerCase()
    );

    
    const comp = compByName;

    if (comp) {
      // Asignar de forma segura y normalizando tipos
      // this.ventas.serie = comp.serie ?? '';
      // this.ventas.numero = comp.numero != null ? Number(comp.numero) : 0;
      this.ventas.idComprobante = comp.idComprobante ?? comp.id ?? '';
      // this.ventas.compVenta = comp.serie + '-' + (comp.numero != null ? String(comp.numero).padStart(8, '0') : '00000000');
      // console.log('Datos del comprobante cargados en ventas:', this.ventas);
    } else {
      // No se encontró: limpia o conserva según prefieras — aquí limpiamos para evitar datos inconsistentes
      console.warn('No se encontró comprobante para el valor:', valor);
      this.ventas.serie = '';
      this.ventas.numero = 0;
      this.ventas.idComprobante = '';
    }
  }


  agregarAlCarrito(producto: any): void {
    console.log('Agregando al carrito:', producto);
    const existe = this.carrito.find(p => p.producto.idProducto === producto.idProducto);
    if (existe) {
      existe.cantidad += 1;
    } else {
      this.carrito.push({
        ...producto,
        cantidad: 1
      });
      
      console.log('Producto agregado al carrito:', this.carrito);
    }
    this.actualizaTotales();
  }

  actualizaTotales(): void {
    //quiero recorrer el carrito y sumar el subtotal, igv y total
    console.log('Calculando totales para el carrito:', this.carrito);

    this.ventas.subTotal = 0;
    this.ventas.igv = 0;
    this.ventas.total = 0;

    this.carrito.forEach(item => {
      const subtotalItem = item.producto.cUnitario * item.cantidad;
      this.ventas.subTotal += subtotalItem;
      console.log(`Subtotal para ${item.producto.descripcion}: ${subtotalItem}`);
    });

    this.ventas.igv = this.ventas.subTotal * this.TASA_IGV;
    this.ventas.total = this.ventas.subTotal + this.ventas.igv;
    console.log('Totales actualizados:', {
      subTotal: this.ventas.subTotal,
      igv: this.ventas.igv,
      total: this.ventas.total
    });
  }

  eliminarDelCarrito(index: number): void {
    this.carrito.splice(index, 1);
  }

  actualizaPrecio(item: any, el: any) {
    const nuevo = parseFloat(el.target.innerText.replace('S/', '').trim());
    if (!isNaN(nuevo)) {
      item.producto.cUnitario = nuevo;
    }
  }

  actualizaCantidad(item: any, el: any) {
    const nuevo = parseInt(el.target.innerText.trim(), 10);
    if (!isNaN(nuevo)) {
      item.cantidad = nuevo;
    }
  }

  abrirBuscadorModal(): void {
    
    this.searchTerm = '';
    this.productos_filtrados = [];          // o cárgalos todos
    const modal = new bootstrap.Modal(this.buscadorModal.nativeElement);
    modal.show();
  }

  onInputChangesCompventas() {
    console.log('Cambios en el formulario de ventas:', this.ventas);
  }

  limpiarCliente() {}

  onInputNumero(): void {
    const long = this.cliente.ruc.length;
    if (
      long === 8 || long === 11
    ) {
      console.log('Longitud válida para búsqueda:', long);
      this.buscarRuc();
    }
  }

  buscarRuc() {
    console.log('Buscando RUC:', this.cliente.ruc);
    this._clienteService.obtener_cliente_ruc(this.cliente.ruc).subscribe(
      (response) => {
        console.log('response cliente por ruc', response.data);
        if (response.data != undefined && response.data.length > 0) {
          this.cliente = response.data[0];
          console.log('this.cliente', this.cliente);
        }else{
           iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#f39999ff',
            class: 'text-danger',
            position: 'topRight',
            message: 'El cliente no existe.',
          });
        }
      },
      (error) => {
        console.log(error);
      }
    );
  }

  clienteSeleccionado(event: any) {
    this.cliente = event;
    console.log('Cliente seleccionado en CreateVentasComponent:', this.cliente);

    // 2.  Cerrar el modal vía JS
  const modalEl = document.getElementById('clientesModal');
  const modalInst = bootstrap.Modal.getInstance(modalEl);
  modalInst.hide();
  this.buscarRuc()
  }
}
