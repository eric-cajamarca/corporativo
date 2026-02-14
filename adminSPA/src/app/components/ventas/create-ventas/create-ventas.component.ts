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
import { FactilizaService } from '../../../services/factiliza.service';
import { ImpuestoService } from '../../../services/impuesto.service';
import { Impuesto } from '../../../interfaces/impuesto.interface';
import { VentaSesionService } from '../../../services/venta-sesion.service';
import { VentaSesion } from '../../../interfaces/venta-sesion.interface';

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
  /** Impuestos activos de la empresa (tabla Impuestos por idEmpresa). El footer y el total se calculan solo con estos. */
  public impuestosActivosEmpresa: Impuesto[] = [];
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
  public cliente: any = {
    idCliente: '',
    idDocumento: '',
    ruc: '',
    rSocial: '',
    direccion: '',
    correo: '',
    celular: '',
    condicion: 'ACTIVO'
  };
  public cajas: any[] = [];
  public sidebarCollapsed = signal(false);
  public loading = false;
  public clienteBuscando = false;

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

  public direccionCliente: any;

  /** Ventas provisionales: sesiones guardadas en localStorage para recuperar tras apagón. */
  sesionesGuardadas: VentaSesion[] = [];
  mostrarModalRecuperar = false;

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
    private cajaService: CajaService,
    private _factilizaService: FactilizaService,
    private _impuestoService: ImpuestoService,
    private ventaSesionService: VentaSesionService
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
    this.revisarVentasProvisionales();
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
  cargarProductos(): void {
    this._productoService.obtenerProductosTodos().subscribe({
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
        this.impuestosActivosEmpresa = list.filter((i: Impuesto) => !!i.estado);
      },
      error: () => {}
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

  /** idDocumento según tabla Documentos: RUC = 6, DNI = 1 (Perú). */
  private readonly ID_DOC_RUC = '6';
  private readonly ID_DOC_DNI = '1';

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
      this.guardarEstadoProvisional();
      return;
    }
    const id = Number(idComprobante);
    this.ventas.idComprobante = idComprobante as any;
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
        } else {
          this.ventas.serie = '';
          this.ventas.numero = '00000001';
          this.ventas.compVenta = (this.ventas.serie ? this.ventas.serie + '-' : '') + this.ventas.numero;
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
        }
        this.guardarEstadoProvisional();
      }
    });
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
      const subtotalItem = Math.round(pVenta * cant * 100) / 100;
      this.ventas.subTotal += subtotalItem;
      const precioPrincipal = this.obtenerPrecioPrincipal(item);
      if (precioPrincipal > pVenta) {
        this.ventas.descuentos += Math.round((precioPrincipal - pVenta) * cant * 100) / 100;
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
            condicion: row.condicion ?? 'ACTIVO'
          };
          console.log('[Ventas] Datos del cliente (desde BD):', { row, cliente: this.cliente });
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
        console.log('[Ventas] Datos del cliente (desde API Factiliza):', { data, cliente: this.cliente });
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
      condicion: e.condicion ?? 'ACTIVO'
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
    const monto = Math.round((Number(this.detailForm.monto) || 0) * 100) / 100;
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
      this.detailForm.referencia = '';
      this.actualizarMontoSaldo();
    }
  }

  // Eliminar detalle
  eliminarDetalle(index: number): void {
    this.detallePago.splice(index, 1);
    this.detallePago.forEach((item: { item: any; }, idx: number) => item.item = idx + 1);
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

  /** Al abrir el modal Forma de pago: selecciona Efectivo y pone el monto = saldo (total de la venta). */
  abrirModalPago(): void {
    const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
    if (efectivo) {
      this.formaPagoSeleccionada = { ...efectivo };
    }
    this.actualizarMontoSaldo();
    const total = Number(this.ventas.total) || 0;
    this.pagaCon = total;
    this.calcularVuelto();
  }

  guardarPago(): void {
    const modalEl = document.getElementById('modalPago');
    const inst = bootstrap.Modal.getInstance(modalEl as HTMLElement);
    inst?.hide();
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
    if (!this.ventas.idSucursal) {
      iziToast.warning({ title: 'Advertencia', message: 'Seleccione sucursal.' });
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
    if (totalPago > 0 && Math.abs(totalPago - totalVenta) > 0.01) {
      iziToast.warning({ title: 'Advertencia', message: 'El total del detalle de pago no coincide con el total de la venta.' });
      return;
    }
    this.enviarVentaConCliente(idCliente);
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
        if (idCliente == null) {
          this._clienteService.obtener_cliente_ruc(payload.ruc).subscribe({
            next: (r: any) => {
              if (r.data && r.data.length > 0) {
                this.cliente.idCliente = r.data[0].idCliente;
                this.enviarVentaConCliente(Number(this.cliente.idCliente));
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
          this.cliente.idCliente = idCliente;
          this.enviarVentaConCliente(idCliente);
        }
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message ?? 'No se pudo crear el cliente.';
        iziToast.error({ title: 'Error', message: msg });
      }
    });
  }

  private enviarVentaConCliente(idCliente: number): void {
    const totalVenta = Number(this.ventas.total) || 0;
    const totalPago = this.calcularTotalTabla();
    if (totalPago > 0 && Math.abs(totalPago - totalVenta) > 0.01) {
      this.loading = false;
      iziToast.warning({ title: 'Advertencia', message: 'El total del detalle de pago no coincide con el total de la venta.' });
      return;
    }
    this.loading = true;

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
      isc: Number(this.ventas.isc) || 0,
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

    this.ventasService.crearVentaCompleta({
      venta: ventaPayload,
      detalles,
      detallePago: detallePago.length > 0 ? detallePago : undefined,
      idApertura
    }).subscribe({
      next: () => {
        this.loading = false;
        iziToast.success({ title: 'Éxito', message: 'Venta registrada correctamente.' });
        this.ventaSesionService.eliminarSesionActiva();
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
    this.pagaCon = 0;
    this.vuelto = 0;

    // Reset modal comprobante
    this.ventas = {
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
      condicion: 'ACTIVO'
    };
    this.direccionCliente = undefined;

    // Reset forma de pago seleccionada a efectivo si existe
    const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
    if (efectivo) {
      this.formaPagoSeleccionada = { ...efectivo };
    }

    this.actualizaTotales();
    this.cargarProductos();
  }
}

