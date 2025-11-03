import { Component } from '@angular/core';
import { DespachoSerciceService } from '../../../services/despacho.sercice.service';
import { EmpresaService } from '../../../services/empresa.service';
import { CventaService } from '../../../services/cventa.service';
import { DventaService } from '../../../services/dventa.service';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-index-despachos',
  imports: [FormsModule,RouterModule,CommonModule,TopnavComponent],
  templateUrl: './index-despachos.component.html',
  styleUrl: './index-despachos.component.css'
})
export class IndexDespachosComponent {

  public id: any = '';
  public compVenta: any = {};
  public compEnvio: any = '';
  public detalleVenta: any = [];
  public henvio: any = [];
  public empresa:any= [];
  public empresaSeleccionada: any;
  public idempresa: any = {};
  public aliasEmpresa: any = '';
  public token: any = "";
  public filtro = '';
  public page = 1;
  public pageSize = 10;

  constructor(
    private _despachoService: DespachoSerciceService,
    private _empresaService: EmpresaService,
    private _cventas:CventaService,
    private _dventas:DventaService,
  ) { 
    //this.token = this._cookieService.get('token');
  };

  ngOnInit(): void {
    this.filtro = 'NP01-00000011'

    this._empresaService.getEmpresas().subscribe(
      response => {
        this.empresa = response.data;
        console.log('this.empresa : ', this.empresa);
      }
    )

  }

  filtrar() {

    // let data:any = {
    //   Serie_Numero: this.filtro,
    //   aliasempresa: this.aliasEmpresa,
    //   idempresa: this.idempresa
    // }

      
    this._cventas.obtener_datos_cventas_empresa(this.filtro, this.aliasEmpresa).subscribe(
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
      });

    this._dventas.obtener_datos_dventas_empresa(this.filtro, this.idempresa).subscribe(
      response => {

        this.detalleVenta = response;
        // if (response != undefined) {
        //   response.forEach((item:any) =>{
        //     this.detalleVenta.id = item.id;
        //     this.detalleVenta.compVenta = item.CompVenta;
        //     this.detalleVenta.Cantidad = item.Cantidad;
        //     this.detalleVenta.Codigo = item.Codigo;
        //     this.detalleVenta.Descripcion = item.Descripcion;
        //     this.detalleVenta.Presentacion = item.Presentacion;
        //     this.detalleVenta.Precio = item.PVenta;
        //     this.detalleVenta.CEntregado = item.CantEntregado;

        //   });

        // } else {

        // }

        console.log('obtener datos detalle ventas', this.detalleVenta);
      }
    );

    this._despachoService.obtener_datos_envios_id(this.filtro).subscribe(
      response => {
        this.henvio = response;
        console.log('henvio:', this.henvio);

        if (response != undefined) {
          // Conjunto para realizar un seguimiento de CompEnvio únicos
          const compEnvioSet: Set<string> = new Set();

          // Filtrar registros únicos y almacenarlos en compEnvio
          this.compEnvio = response.filter((item: any) => {
            const compEnvio = item.CompEnvio;

            if (!compEnvioSet.has(compEnvio)) {
              compEnvioSet.add(compEnvio);
              return true; // Añadir al resultado final
            }

            return false; // Duplicado, no añadir al resultado final
          });

          console.log('Registros únicos de CompEnvio:', this.compEnvio);
        }


      }
    )

  }


  onEmpresaSeleccionada() {
    if (this.empresaSeleccionada) {
      this.idempresa = this.empresaSeleccionada.id;
      this.aliasEmpresa = this.empresaSeleccionada.Alias;
  
      console.log('ID seleccionado:', this.idempresa);
      console.log('Alias seleccionado:', this.aliasEmpresa);
    }
  }
}
