import { Component, OnInit, signal } from '@angular/core';
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
import { ModalService } from '../../../services/modal.service';
import { VentasService } from '../../../services/ventas.service';
import { CajaService } from '../../../services/caja.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';

declare var bootstrap: any;
declare var iziToast: any;

interface DocumentoResponse {
  message: string;
  data: Documento[];
}

@Component({
  selector: 'app-create-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IndexClientesComponent, TopnavComponent, SidebarComponent],
  templateUrl: './create-ventas.component.html',
  styleUrl: './create-ventas.component.css'
})
export class CreateVentasComponent implements OnInit {

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
  public cajas: any[] = [];
  public sidebarCollapsed = signal(false);
  public loading = false;

  public ventas: any = {
    compVenta: '0000-00000000',
    idComprobante: '',
    serie: '0000',
    numero: '00000000',
    idSucursal: '',
    idCliente: '',
    idDocumento: '',
    idMoneda: 1,
    idEstadoPago: 2,
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
    private modalService: ModalService,
    private ventasService: VentasService,
    private cajaService: CajaService
  ) {}

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
  }

  ngOnInit(): void {
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
      },
      error: () => {}
    });
    const hoy = new Date().toISOString().split('T')[0];
    if (!this.ventas.fEmision) this.ventas.fEmision = hoy;
    if (!this.ventas.fVencimiento) this.ventas.fVencimiento = hoy;
    const collapsed = localStorage.getItem('sidebarCollapsed');
    if (collapsed === 'true') this.sidebarCollapsed.set(true);
    this.cargarDatos();
  }
  // Función para cargar todos los productos
  cargarDatos(){
    this._productoService.obtenerProductosTodos().subscribe(
      (response: any) => {
        if (response.data != undefined) {
          this.productos = response.data;
          this.productos_const = this.productos;
          this.stockSucursales_const = this.productos;
        }
      },
      (error: any) => {
        console.error('Error al cargar productos:', error);
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

  
    this._comprobanteService.obtenerComprobantesVenta().subscribe(
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

  /**
   * Carga serie y número desde la tabla Comprobantes (BD) al seleccionar un tipo de comprobante.
   * Los comprobantes vienen de obtenerComprobantesVenta() (habilitados para ventas en Configuración).
   */
  cargarDatosComprobantePorId(idComprobante: string | number): void {
    if (idComprobante == null || idComprobante === '') {
      this.ventas.serie = '';
      this.ventas.numero = '';
      this.ventas.compVenta = '';
      this.ventas.idComprobante = '';
      return;
    }
    const id = Number(idComprobante);
    const comp = this.comprobantes.find((c: any) => Number(c.idComprobante) === id);
    if (comp) {
      this.ventas.idComprobante = comp.idComprobante;
      this.ventas.serie = comp.serie ?? '';
      const siguienteNumero = (comp.numero != null ? Number(comp.numero) : 0) + 1;
      this.ventas.numero = String(siguienteNumero).padStart(8, '0');
      this.ventas.compVenta = this.ventas.serie + '-' + this.ventas.numero;
    } else {
      this.ventas.serie = '';
      this.ventas.numero = '';
      this.ventas.compVenta = '';
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

  // Agregar detalle (guardamos idFormaPago para enviar como idMediosPago al API)
  agregarDetalle(): void {
    const monto = Number(this.detailForm.monto);
    const idForma = this.formaPagoSeleccionada?.idFormaPago != null ? Number(this.formaPagoSeleccionada.idFormaPago) : 0;
    if (monto > 0 && idForma) {
      const desc = this.formasPago.find((f: FormaPago) => f.idFormaPago === idForma)?.descripcion || 'Pago';
      this.detallePago.push({
        item: this.detallePago.length + 1,
        idFormaPago: idForma,
        descripcion: desc,
        monto,
        referencia: this.detailForm.referencia || 'N/A'
      });
      this.detailForm = { formaPago: 'Efectivo', monto: 0, referencia: '' };
    }
  }

  // Eliminar detalle
  eliminarDetalle(index: number): void {
    this.detallePago.splice(index, 1);
    // Reenumerar items
    this.detallePago.forEach((item: { item: any; }, idx: number) => item.item = idx + 1);
  }

  guardarPago(): void {
    const modalEl = document.getElementById('modalPago');
    const inst = bootstrap.Modal.getInstance(modalEl);
    inst?.hide();
  }

  /** Registra la venta completa: Ventas + DetalleVenta + DetallePagoVenta + MovimientosCaja (si hay pago) */
  registrarVenta(): void {
    if (this.carrito.length === 0) {
      iziToast.warning({ title: 'Advertencia', message: 'Agregue al menos un producto al carrito.' });
      return;
    }
    if (!this.ventas.idComprobante) {
      iziToast.warning({ title: 'Advertencia', message: 'Seleccione tipo de comprobante (Datos del Comprobante).' });
      return;
    }
    if (!this.ventas.idSucursal) {
      iziToast.warning({ title: 'Advertencia', message: 'Seleccione sucursal.' });
      return;
    }
    const idCliente = this.cliente?.idCliente != null ? Number(this.cliente.idCliente) : null;
    if (idCliente == null || idCliente === 0) {
      iziToast.warning({ title: 'Advertencia', message: 'Seleccione un cliente (Información del Cliente).' });
      return;
    }

    const totalVenta = Number(this.ventas.total) || 0;
    const totalPago = this.calcularTotalTabla();
    if (totalPago > 0 && Math.abs(totalPago - totalVenta) > 0.01) {
      iziToast.warning({ title: 'Advertencia', message: 'El total del detalle de pago no coincide con el total de la venta.' });
      return;
    }

    const ventaPayload = {
      idSucursal: this.ventas.idSucursal,
      serie: String(this.ventas.serie || '0000').substring(0, 4),
      numero: String(this.ventas.numero || '00000000').substring(0, 8),
      compVenta: this.ventas.compVenta || this.ventas.serie + '-' + this.ventas.numero,
      idComprobante: Number(this.ventas.idComprobante),
      fEmision: this.ventas.fEmision ? new Date(this.ventas.fEmision).toISOString() : new Date().toISOString(),
      fVencimiento: this.ventas.fVencimiento ? new Date(this.ventas.fVencimiento).toISOString() : new Date().toISOString(),
      idCliente,
      idMoneda: Number(this.ventas.idMoneda) || 1,
      tCambio: 1,
      subtotal: Number(this.ventas.subTotal) || 0,
      igv: Number(this.ventas.igv) || 0,
      exonerado: Number(this.ventas.exonerado) || 0,
      gratuito: Number(this.ventas.gratuito) || 0,
      otrosCargos: Number(this.ventas.otrosCargos) || 0,
      descuentos: Number(this.ventas.descuentos) || 0,
      total: totalVenta,
      idMediosPago: String(this.ventas.idMediosPago || '5'),
      idEstadoSunat: 1,
      compRelacionado: this.ventas.observacion || null
    };

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
        cantEntregada: cant,
        idEstadoPedido: 1
      };
    });

    const detallePago = this.detallePago
      .filter((d: any) => d.monto > 0 && (d.idFormaPago != null || d.idMediosPago != null))
      .map((d: any) => ({
        idMediosPago: Number(d.idMediosPago ?? d.idFormaPago),
        monto: Number(d.monto)
      }));

    let idApertura: string | undefined;
    if (detallePago.length > 0 && this.cajas.length > 0) {
      idApertura = this.cajas[0].idApertura;
    }

    this.loading = true;
    this.ventasService.crearVentaCompleta({
      venta: ventaPayload,
      detalles,
      detallePago: detallePago.length > 0 ? detallePago : undefined,
      idApertura
    }).subscribe({
      next: (res) => {
        this.loading = false;
        iziToast.success({ title: 'Éxito', message: 'Venta registrada correctamente.' });
        this.limpiarVenta();
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

  limpiarVenta(): void {
    this.carrito = [];
    this.detallePago = [];
    this.actualizaTotales();
    this.pagaCon = 0;
    this.vuelto = 0;
    const comp = this.comprobantes.find((c: any) => String(c.idComprobante || c.id) === String(this.ventas.idComprobante));
    if (comp) {
      const nextNum = (comp.numero != null ? Number(comp.numero) : 0) + 1;
      this.ventas.numero = String(nextNum).padStart(8, '0');
      this.ventas.compVenta = this.ventas.serie + '-' + this.ventas.numero;
    }
  }
}

