import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DespachoSerciceService } from '../../../services/despacho.sercice.service';
import { DespachoService } from '../../../services/despacho.service';
import {
  CrearDevolucionDespachoRequest,
  DevolucionDespachoDetalle,
  DevolucionDespachoItemRequest,
  DevolucionDespachoResumen,
  DespachoResumen,
  DetalleDespachoLinea
} from '../../../models/devolucion-despacho.model';
import { EmpresaService } from '../../../services/empresa.service';
import { CventaService } from '../../../services/cventa.service';
import { DventaService } from '../../../services/dventa.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { descripcionProductoConMarca } from '../../../utils/producto-presentacion.util';

declare var iziToast: any;

@Component({
  selector: 'app-create-despachos',
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './create-despachos.component.html',
  styleUrl: './create-despachos.component.css'
})
export class CreateDespachosComponent {
  public datos: any;
  public compVenta: any = {};
  public detalleVenta: any = [];
  public token: any = "";
  public dCantidad: any;
  public idempresa: any;
  public serieNumero: any;
  public aliasempresa: any;
  public valides: any = false;
  public mensajeCant = '';
  public registroCompEnvio: any = {};
  public comprobantes: any = [];

  /** Modo por idVenta (ruta despachos/create/:idVenta): formulario tipo + observaciones */
  modoIdVenta = false;
  idVenta: string | null = null;
  ventaInfo: { compVenta: string; clienteRazonSocial: string; total: number } | null = null;
  tiposDespacho: Array<{ idTipoDespacho: number; nombre: string }> = [];
  idTipoDespachoSeleccionado: number | null = null;
  observacionesNuevo = '';
  loadingVenta = false;
  enviando = false;
  errorVenta = '';
  cargandoDespachos = false;
  despachosVenta: DespachoResumen[] = [];
  despachoSeleccionadoId: string | null = null;
  detalleDespachoSeleccionado: DetalleDespachoLinea[] = [];
  devolucionItems: DevolucionDespachoItemRequest[] = [];
  devolucionObservaciones = '';
  enviandoDevolucion = false;
  cargandoDetalleDespacho = false;
  cargandoDevoluciones = false;
  devolucionesDespacho: DevolucionDespachoResumen[] = [];
  detalleDevolucionSeleccionada: DevolucionDespachoDetalle[] = [];
  idDevolucionSeleccionada: string | null = null;
  errorDevolucion = '';

  constructor(
    private route: ActivatedRoute,
    private _despachoService: DespachoSerciceService,
    private _despachoApi: DespachoService,
    private _empresaService: EmpresaService,
    private _cventaService: CventaService,
    private _dventaService: DventaService,
    private _router: Router,
    public sidebarState: SidebarStateService,
  ) {}

  /** Cargar venta y tipos cuando se entra con idVenta */
  cargarVentaYTipos(): void {
    if (!this.idVenta) return;
    this.errorVenta = '';
    this.loadingVenta = true;
    this._despachoApi.buscarVentaDespachos({ idVenta: this.idVenta }).subscribe({
      next: (res) => {
        this.loadingVenta = false;
        if (res?.data?.venta) {
          this.ventaInfo = {
            compVenta: res.data.venta.compVenta,
            clienteRazonSocial: res.data.venta.clienteRazonSocial || '',
            total: res.data.venta.total ?? 0
          };
        } else {
          this.errorVenta = 'Venta no encontrada.';
        }
      },
      error: () => {
        this.loadingVenta = false;
        this.errorVenta = 'Error al cargar la venta.';
      }
    });
    this._despachoApi.obtenerTiposDespacho().subscribe({
      next: (res) => {
        this.tiposDespacho = (res?.data ?? []) as Array<{ idTipoDespacho: number; nombre: string }>;
        if (this.tiposDespacho.length && this.idTipoDespachoSeleccionado == null) {
          this.idTipoDespachoSeleccionado = this.tiposDespacho[0].idTipoDespacho;
        }
      }
    });
    this.cargarDespachosVenta();
  }

  /** Crear despacho (modo idVenta) */
  crearDespachoNuevo(): void {
    if (!this.idVenta || this.idTipoDespachoSeleccionado == null) return;
    this.enviando = true;
    this._despachoApi.crearDespacho({
      idVenta: this.idVenta,
      idTipoDespacho: this.idTipoDespachoSeleccionado,
      observaciones: this.observacionesNuevo || undefined
    }).subscribe({
      next: () => {
        this.enviando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Despacho creado', position: 'topRight' });
        }
        this._router.navigate(['/despachos']);
      },
      error: (err) => {
        this.enviando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo crear el despacho', position: 'topRight' });
        }
      }
    });
  }

  cargarDespachosVenta(): void {
    if (!this.idVenta) return;
    this.cargandoDespachos = true;
    this._despachoApi.obtenerDespachosPorVenta(this.idVenta).subscribe({
      next: (res) => {
        this.cargandoDespachos = false;
        this.despachosVenta = (res?.data ?? []) as DespachoResumen[];
      },
      error: () => {
        this.cargandoDespachos = false;
      }
    });
  }

  seleccionarDespacho(idDespacho: string | null): void {
    this.despachoSeleccionadoId = idDespacho;
    this.detalleDespachoSeleccionado = [];
    this.devolucionItems = [];
    this.devolucionObservaciones = '';
    this.devolucionesDespacho = [];
    this.detalleDevolucionSeleccionada = [];
    this.idDevolucionSeleccionada = null;
    this.errorDevolucion = '';
    if (!idDespacho) return;
    this.cargarDetalleDespacho(idDespacho);
    this.cargarDevolucionesDespacho(idDespacho);
  }

  descripcionProductoDespacho(
    descripcion?: string | null,
    marca?: string | null
  ): string {
    return descripcionProductoConMarca(descripcion, marca);
  }

  cargarDetalleDespacho(idDespacho: string): void {
    this.cargandoDetalleDespacho = true;
    this._despachoApi.obtenerDetalleDespacho(idDespacho).subscribe({
      next: (res) => {
        this.cargandoDetalleDespacho = false;
        const raw = (res?.data ?? []) as DetalleDespachoLinea[];
        this.detalleDespachoSeleccionado = raw.map((d) => ({
          ...d,
          productoDescripcion: descripcionProductoConMarca(d.productoDescripcion, d.productoMarca)
        }));
        this.devolucionItems = this.detalleDespachoSeleccionado.map((d) => ({
          idDetalleDespacho: d.idDetalleDespacho,
          cantidadDevuelta: 0,
          notas: ''
        }));
      },
      error: () => {
        this.cargandoDetalleDespacho = false;
      }
    });
  }

  cargarDevolucionesDespacho(idDespacho: string): void {
    this.cargandoDevoluciones = true;
    this._despachoApi.listarDevolucionesDespacho(idDespacho).subscribe({
      next: (res) => {
        this.cargandoDevoluciones = false;
        this.devolucionesDespacho = res?.data ?? [];
      },
      error: () => {
        this.cargandoDevoluciones = false;
      }
    });
  }

  registrarDevolucion(): void {
    if (!this.despachoSeleccionadoId) return;
    const itemsValidos = this.devolucionItems.filter((i) => Number(i.cantidadDevuelta) > 0);
    if (itemsValidos.length === 0) {
      this.errorDevolucion = 'Ingrese al menos una cantidad a devolver.';
      return;
    }
    this.errorDevolucion = '';
    const payload: CrearDevolucionDespachoRequest = {
      observaciones: this.devolucionObservaciones || undefined,
      items: itemsValidos
    };
    this.enviandoDevolucion = true;
    this._despachoApi.crearDevolucionDespacho(this.despachoSeleccionadoId, payload).subscribe({
      next: () => {
        this.enviandoDevolucion = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Devolución registrada', position: 'topRight' });
        }
        this.cargarDetalleDespacho(this.despachoSeleccionadoId as string);
        this.cargarDevolucionesDespacho(this.despachoSeleccionadoId as string);
      },
      error: (err) => {
        this.enviandoDevolucion = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo registrar la devolución', position: 'topRight' });
        }
      }
    });
  }

  verDetalleDevolucion(idDevolucionDespacho: string): void {
    this.idDevolucionSeleccionada = idDevolucionDespacho;
    this.detalleDevolucionSeleccionada = [];
    this._despachoApi.obtenerDetalleDevolucion(idDevolucionDespacho).subscribe({
      next: (res) => {
        const raw = (res?.data ?? []) as DevolucionDespachoDetalle[];
        this.detalleDevolucionSeleccionada = raw.map((dd) => ({
          ...dd,
          productoDescripcion: descripcionProductoConMarca(dd.productoDescripcion, dd.productoMarca)
        }));
      }
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.idVenta = params['idVenta'] ?? null;
      this.idempresa = params['id'];
      this.serieNumero = params['serie'];
      this.modoIdVenta = !!this.idVenta;
      if (this.modoIdVenta && this.idVenta) this.cargarVentaYTipos();
    });

    if (this.modoIdVenta) return;

    // Flujo antiguo: id + serie

    this._empresaService.getEmpresas_id().subscribe(
      response => {
        this.aliasempresa = response[0].Alias;
        

        this._cventaService.obtener_datos_cventas_empresa(this.serieNumero, this.aliasempresa).subscribe(
          response => {
                        if (response != undefined) {
              // Modificar el campo 'password' dentro del responseay 'data'
              response.forEach((item: any) => {
                this.compVenta.Serie_Numero = item.Serie_Numero;
                this.compVenta.IdDoc = item.IdDoc;
                // this.compVenta.SerieDoc = item.SerieDoc;
                // this.compVenta.NumeroDoc = item.NumeroDoc;
                this.compVenta.F_Emision = item.F_Emision;
                // this.compVenta.F_Vencimiento = item.F_Vencimiento;
                // this.compVenta.TipoDoc = item.TipoDoc;
                // this.compVenta.Ruc = item.Ruc_Dni;
                this.compVenta.Razon_Social = item.Razon_Social;
                // this.compVenta.CondicionPago = item.CondicionPago;
                this.compVenta.Total = item.Total;
                // this.compVenta.Estado = item.Estado;
                // this.compVenta.EstadoPedido = item.EstadoPedido;
                // this.compVenta.EstadoSunat = item.EstadoSunat;
                this.compVenta.Usuario = item.Usuario;
                // this.compVenta.destino = item.destino;

              });
            }

                      }
        );

        // console.log('this.aliasempresa antes de entrar a obtner_comprobantes_alias', this.aliasempresa);
        // this._comprobanteService.obtener_comprobantes_alias(this.aliasempresa, this.token).subscribe(
        //   response => {
        //     this.comprobantes = response;
        //     console.log('this.comprobantes', this.comprobantes);
        //   }
        // )
        

      }
    )

    this._dventaService.obtener_datos_dventas_empresa(this.serieNumero, this.idempresa).subscribe(
      response => {

        this.detalleVenta = response;

        //   if (response != undefined) {
        //     response.forEach((item:any) =>{
        //       this.detalleVenta.id = item.id;
        //       this.detalleVenta.compVenta = item.CompVenta;
        //       this.detalleVenta.Cantidad = item.Cantidad;
        //       this.detalleVenta.Codigo = item.Codigo;
        //       this.detalleVenta.Descripcion = item.Descripcion;
        //       this.detalleVenta.Presentacion = item.Presentacion;
        //       this.detalleVenta.Precio = item.PVenta;
        //       this.detalleVenta.CEntregado = item.CantEntregado;

        //     });

        //   // } else {

        //    }

        //   console.log('obtener datos detalle ventas', this.detalleVenta);
      }
    );





  }

  guardarDatos(miFormulario: any) {
    // console.log('miformulario', miFormulario);
        // Validar cantidades antes de enviar al backend

    // Suponiendo que detalleVenta es un array de objetos con las propiedades CantidadIngresar y Cantidad
    for (const item of this.detalleVenta) {
      // console.log('item.cantingresar', item.CantidadIngresar);
      
      if (item.CantEntregado > item.Cantidad) {
                // Puedes manejar el error aquí según tus necesidades
        this.valides = true;
        iziToast.show({
          title: 'ERROR',
          titleColor: '#FF0000',
          color: '#FFF',
          class: 'text-danger',
          position: 'topRight',
          message: 'Error en la Cantidad ingresada para el registro:' + item.Descripcion,

        });


      }
    }

    if (!this.valides) {
            this._dventaService.actualizar_CEntrega_DVentas(this.serieNumero, this.detalleVenta).subscribe(
        response => {
          if (response.data == undefined) {
            iziToast.show({
              title: 'ERROR',
              titleColor: '#FF0000',
              color: '#FFF',
              class: 'text-danger',
              position: 'topRight',
              message: response.message,
            });

          } else {
            iziToast.show({
              title: 'SUCCESS',
              titleColor: '#1DC74C',
              color: '#FFF',
              class: 'text-success',
              position: 'topRight',
              message: response.message,
            });
            // console.log('actualizar_CEntrega_DVentas response', response);

            this.registrarCompEnvio();
            this._router.navigate(['/despachos']);
          }


        }
      )


    }

  }


  registrarCompEnvio() {
    // Inicializa el objeto registroCompEnvio
    this.registroCompEnvio = {};

    // Utiliza map para crear un nuevo array con los resultados
    this.registroCompEnvio = this.detalleVenta.map((item: any) => ({
      CompVentas: this.compVenta.Serie_Numero,
      Descripcion: item.Descripcion,
      Presentacion: item.Presentacion,
      Cantidad: item.CantEntregado,
      IdEmpresa: this.idempresa,
      Alias: this.aliasempresa, // Asumo que es 'Cantidad', ajusta según tus datos reales
      // Puedes agregar más campos aquí si es necesario
    }));

    // Muestra el objeto resultante en la consola
    
    this._despachoService.registro_compEnvio(this.registroCompEnvio).subscribe(
      response => {
        if (response.data == undefined) {
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: response.message,
          });

        } else {
          iziToast.show({
            title: 'SUCCESS',
            titleColor: '#1DC74C',
            color: '#FFF',
            class: 'text-success',
            position: 'topRight',
            message: response.message,
          });

          
          

        }
      }
    )
  }

  resetCantEntrega() {
    this.detalleVenta.forEach((item: any) => {
      item.CantEntregado = 0;
    });

  }
}
