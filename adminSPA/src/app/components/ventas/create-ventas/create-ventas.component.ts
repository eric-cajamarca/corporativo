import { Component } from '@angular/core';
import { forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
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
import { FormaPago } from '../../../interfaces/formasPago-interface';
import { Documento } from '../../../interfaces/documento-interface';
import { Sucursal } from '../../../interfaces/sucursal-interface';
import { Presentacion } from '../../../interfaces/presentacion-interface';
import { ModalPreciosComponent } from '../../modal-precios/modal-precios.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ModalService } from '../../../services/modal.service';

declare var bootstrap: any;
declare var iziToast: any;

interface DocumentoResponse {
  message: string;
  data: Documento[];
}

@Component({
  selector: 'app-create-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule,IndexClientesComponent, TopnavComponent],
  templateUrl: './create-ventas.component.html',
  styleUrl: './create-ventas.component.css'
})
export class CreateVentasComponent {

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
  private TASA_IGV: number = 0.18;
  public sucursales: Sucursal[] = [];
  public carrito: any[] = [];
  public buscadorModal: any;
  public moneda: any = [];
  public mediosPago:any=[];
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
  public documento: Documento[] = [];
  
  public comprobantes: any = [];
  public cajaMovimientos:{} ={
    idFormaPago:0,
  };
  public cliente : any = {
    tipoDocumento: '1',
    razonsocial: '',
    direccion: '',

  };
  public ventas: any = {
    compVenta: '0000-00000000',
    idComprobante: '',
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

  public direccionCliente: any;

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
    private modalService: ModalService

  ) { }

 ngOnInit(): void {


    this._documentosService.obtener_documento1().subscribe({
      next: (response) => {
        this.documento = response.data; // ✅ Asigna directo el array
        console.log('Documentos:', this.documento);
      },
      error: (error) => console.error(error)
    });

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
          this.stockSucursales_const = this.productos;
          //this.productos_filtrados = this.productos; // Inicializar con todos los productos
          console.log('this.productos', this.productos);
        }
      },
      (error) => {
        console.log(error);
      }
    );

   
  this._documentosService.getFormasPago().subscribe({
    next: (response) => {
      this.formasPago = response.data || [];
      console.log('formaspago', this.formasPago);
    },
    error: (err) => {
      console.error('Error:', err);
      this.formasPago = [];
    }
  });

  
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


   
      
  

    console.log('documento', this.documento);
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

  // Función para limpiar la búsqueda
  limpiarBusqueda(): void {
    this.searchTerm = '';
    this.productos_filtrados = this.stockSucursales_const;
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
        
    // switch (valor) {
    //   case 'factura':
    //     this.documento.idDocumento = '6';
    //     break;
    //   case 'boleta':
    //   case 'cotizacion':
    //   case 'nota de pedido':
    //     this.documento.idDocumento = '1';
    //     break;
    //   default:
    //     console.warn('Valor no reconocido:', valor);
    // }

    //this.ventas.idDocumento = this.documento.idDocumento;

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

  seleccionaProducto(prod: any): void {
    console.log('Producto seleccionado:', prod);
    // 1.  Agrega al carrito
    this.agregarAlCarrito(prod);

    // 2.  Cierra el modal (por JS)
    const buscador = bootstrap.Modal.getInstance(
      document.getElementById('buscadorModal')!
    );
    buscador?.hide();
  }

  agregarAlCarrito(producto: any): void {
    console.log('Agregando al carrito:', producto);
    const existe = this.carrito.find(p => p.idProducto === producto.idProducto);
    if (existe) {
      existe.cantidad += 1;
    } else {
      this.carrito.push({
        ...producto,
        cantidad: 1
      });
      
      console.log('Producto agregado al carrito:', this.carrito);
      console.log('ventas', this.ventas)
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
      console.log('Producto encontrado por código:', this.productoEncontrado);

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
    //quiero recorrer el carrito y sumar el subtotal, igv y total
    console.log('Calculando totales para el carrito:', this.carrito);
    console.log('Estado actual de ventas antes de totales:', this.searchCodigo);

    this.ventas.subTotal = 0;
    this.ventas.igv = 0;
    this.ventas.total = 0;
    console.log('aqui muetro el carrito para ver si pventa se modifico', this.carrito);

    this.carrito.forEach(item => {
      const subtotalItem = item.pVenta * item.cantidad;
      this.ventas.subTotal += subtotalItem;
      console.log(`Subtotal para ${item.descripcion}: ${subtotalItem}`);
    });
    console.log('Subtotal calculado:', this.ventas.subTotal);

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
    this.actualizaTotales();
  }

  actualizaPrecio(item: any, el: any) {
    console.log('Elemento editado para el:', el);
    console.log('Elemento editado para Item:', item);
    //const nuevo = parseFloat(el.target.innerText.replace('S/', '').trim(),10);
    const nuevo = parseInt(el.target.innerText.trim(), 10);
    if (!isNaN(nuevo)) {
      item.pVenta = nuevo;
    }
    console.log('Nuevo precio establecido:', item.producto);
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
      centered: true,
      backdrop: 'static'
    }, {
      precios: opcionesPrecios,
      precioActual: this.obtenerPrecioPrincipal(item)
      
    }).subscribe({
      next: (precioSeleccionado: any) => {
        if (precioSeleccionado) {
          item.pVenta = precioSeleccionado.precio;
          this.actualizaTotales(); // Recalcula totales si aplica
          console.log('Precio seleccionado desde el modal:', precioSeleccionado);
          console.log('Item actualizado con nuevo precio:', item);
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
    this.actualizaTotales();
  }

  actualizaDescripcion(item: any, el: any) {
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
    if (!this.documento) {
    console.error('Documento no cargado');
    return;
  }

  const id = this.documento[0].idDocumento;
//  const long = id.length;

  if (long === 8 && id === '1') {
    console.log('buscando dni');
    this.buscarRuc();
  }

  if (long === 11 && id === '6') {
    console.log('buscando ruc');
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
            this._clienteService.obtener_direccionesCliente_idCliente(this.cliente.idCliente).subscribe(
              (response) => {
                  this.direccionCliente = response.data[0];
                  this.cliente.direccion = this.direccionCliente.direccion
                  console.log("direcciones", response)
              }
              
            )
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
    return this.detallePago.reduce((sum: any, item: { monto: any; }) => sum + item.monto, 0);
  }

  // Agregar detalle
  agregarDetalle(): void {
    if (this.detailForm.monto > 0) {
      this.detallePago.push({
        item: this.detallePago.length + 1,
        descripcion: this.detailForm.formaPago,
        monto: this.detailForm.monto,
        referencia: this.detailForm.referencia || 'N/A'
      });
      // Resetear formulario
      this.detailForm = { formaPago: 'Efectivo', monto: 0, referencia: '' };
    }
  }

  // Eliminar detalle
  eliminarDetalle(index: number): void {
    this.detallePago.splice(index, 1);
    // Reenumerar items
    this.detallePago.forEach((item: { item: any; }, idx: number) => item.item = idx + 1);
  }

  // Guardar pago
  guardarPago() {
    // console.log('Detalles guardados:', this.detallePago);
    // const modal = bootstrap.Modal.getInstance(document.getElementById('modalPago'));
    // modal?.hide();
  }
}





function captureError(arg0: () => never[]): import("rxjs").OperatorFunction<any, unknown> {
  throw new Error('Function not implemented.');
}

