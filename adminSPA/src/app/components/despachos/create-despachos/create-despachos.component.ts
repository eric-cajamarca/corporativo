import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DespachoSerciceService } from '../../../services/despacho.sercice.service';
import { EmpresaService } from '../../../services/empresa.service';
import { CventaService } from '../../../services/cventa.service';
import { DventaService } from '../../../services/dventa.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';


declare var iziToast: any;

@Component({
  selector: 'app-create-despachos',
  imports: [FormsModule,RouterModule,CommonModule, TopnavComponent],
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

  constructor(
    private route: ActivatedRoute,
    private _despachoService: DespachoSerciceService,
    private _empresaService: EmpresaService,
    private _cventaService: CventaService,
    private _dventaService: DventaService,
    private _router: Router,
  ) { 
    //this.token = this._cookieService.get('token');
  }

  ngOnInit(): void {

    //aqui jalo los parametros de comprobante y empresa
    this.route.params.subscribe(params => {
      this.idempresa = params['id'];
      this.serieNumero = params['serie'];

      
    });

    this._empresaService.getEmpresas_id().subscribe(
      response => {
        this.aliasempresa = response[0].Alias;
        console.log('this.alias', this.aliasempresa);


        this._cventaService.obtener_datos_cventas_empresa(this.serieNumero, this.aliasempresa).subscribe(
          response => {
            console.log('obtener_datos_cventas', response);
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

            console.log('this.compVenta', this.compVenta);
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
    console.log('guardo los datos del formulario', this.detalleVenta);
    // Validar cantidades antes de enviar al backend

    // Suponiendo que detalleVenta es un array de objetos con las propiedades CantidadIngresar y Cantidad
    for (const item of this.detalleVenta) {
      // console.log('item.cantingresar', item.CantidadIngresar);
      console.log('item.cantEntregado', item.CantEntregado);

      if (item.CantEntregado > item.Cantidad) {
        console.log('Error:', item.CantEntregado, 'para el registro con Id', item.Descripcion);
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
      console.log('El formulario si es valido');
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
    console.log('this.registroCompEnvio', this.registroCompEnvio);

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
