import { Component } from '@angular/core';
import { ProveedoresService } from '../../../services/proveedores.service';
import { AdminService } from '../../../services/admin.service';
import { ApiperuService } from '../../../services/apiperu.service';
import { DocumentoService } from '../../../services/documento.service';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule, NgModel } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { FactilizaService } from '../../../services/factiliza.service';

declare var iziToast: any;

@Component({
  selector: 'app-update-proveedor',
  standalone: true,
  imports: [FormsModule, CommonModule, TopnavComponent],
  templateUrl: './update-proveedor.component.html',
  styleUrl: './update-proveedor.component.css'
})
export class UpdateProveedorComponent {
  public filtro: any = "";
  public proveedores: any = {
    correo: '',
    celular: '',
    condicion: 'ACTIVO',
  };
  public proveedorruc: any = [];
  // public direccionClientes:any=[];
  public documento: any = [];
  public regiones: any = [];
  public provincias: any = [];
  public distritos: any = [];
  public token: any = "";
  public contBuscar = 0;
  public btn_registrar = false;
  public mostrarDireccion = false;

  public str_pais = '';
  public direccionProveedores: any = {};
  public direccionProveedores_const: any = [];
  public data: any = {};

  constructor(
    private _adminService: AdminService,
    private _documentosService: DocumentoService,
    private _apiperuService: ApiperuService,
    private _proveedorService: ProveedoresService,
    private _router: Router,
    private _route: ActivatedRoute,
    private factilizaSvc: FactilizaService

  ) {
    //this.token = this._cookieService.get('token');



    this._adminService.get_Regiones().subscribe(
      response => {
        this.regiones = response;
        console.log('this.regiones', this.regiones);
      }
    );

    this._adminService.get_Procincias().subscribe(
      response => {
        this.provincias = response;
        console.log('this.provincias', this.provincias);
      }
    );

    this._adminService.get_Distritos().subscribe(
      response => {
        this.distritos = response;
        console.log('this.distritos', this.distritos);
      }
    );

    this._documentosService.obtener_documento().subscribe(
      response => {
        this.documento = response.data;
        console.log('this.documento', this.documento);
      }
    );


  }

  ngOnInit() {
    this._route.params.subscribe(
      params => {

        this.proveedores.idCliente = params['id'];
        console.log('this.clientes.idCliente', this.proveedores.idCliente);

        this._proveedorService.obtener_proveedor_id(this.proveedores.idCliente ).subscribe(
          response => {
            console.log('response.data', response.data);
            if (response.data != undefined) {


              // Modificar el campo 'password' dentro del array 'data'
              response.data.forEach((item: any) => {
                this.proveedores.idCliente = item.idCliente;
                this.proveedores.ruc = item.ruc;
                this.proveedores.idDocumento = item.idDocumento;
                this.proveedores.rSocial = item.rSocial;
                this.proveedores.correo = item.correo;
                this.proveedores.celular = item.celular;
                this.proveedores.condicion = item.condicion;
                // this.proveedores.fregistro = item.fregistro;
              });
              console.log('this.proveedores', this.proveedores);
            }
          }
        );

        this._proveedorService.obtener_direccionesProveedor_idProveedor(this.proveedores.idCliente).subscribe(
          response => {
            console.log('response.data', response.data);
            if (response.data != undefined) {

              this.direccionProveedores_const = response.data;
              console.log('this.direccionProveedores_const', this.direccionProveedores_const);

              //buscar en regiones por el id de response.data.region y asignar el name a direccionEmpresas.region
              const regionEncontrada = this.regiones.find((element: any) => Number(element.id) === Number(response.data[0].region));

              if (regionEncontrada) {

                this.direccionProveedores_const[0].nregion = String(regionEncontrada.name);
                console.log('this.direccionEmpresas.region', this.direccionProveedores_const.nregion);
              }else{
                console.log('no se encontro la region');
              }


              //buscar en provincias por el id de response.data.provincia y asignar el name a direccionEmpresas.provincia
              const provinciaEncontrada = this.provincias.find((element: any) => Number(element.id) === Number(response.data[0].provincia));

              if (provinciaEncontrada) {

                this.direccionProveedores_const[0].nprovincia = String(provinciaEncontrada.name);
                console.log('this.direccionEmpresas.provincia', this.direccionProveedores_const.nprovincia);
              }

              //buscar en distritos por el id de response.data.distrito y asignar el name a direccionEmpresas.distrito
              const distritoEncontrada = this.distritos.find((element: any) => Number(element.id) === Number(response.data[0].distrito));

              if (distritoEncontrada) {

                this.direccionProveedores_const[0].ndistrito = String(distritoEncontrada.name);
                console.log('this.direccionEmpresas.distrito', this.direccionProveedores_const.ndistrito);
              }

              console.log('this.direccionProveedores', this.direccionProveedores_const);
            }
          }
        )
      }

    );



    // this.select_pais();
  }

  //https://dniruc.apisperu.com/api/v1/dni/45633353?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImVyaWNvcnRpemd1ZXZhcmFAZ21haWwuY29tIn0.-cs9eKiQegcTM0bbaz7O-BT_sS7_BpV_6cndIqCeHfk

  buscar() {
    this.contBuscar = 1;
    console.log('veo que cod comprobante', this.proveedores.idDocumento)

    console.log('filtro', this.proveedores.ruc);
    this.filtro = this.proveedores.ruc;

    try {

      if (this.proveedores.ruc.length === 11 && this.proveedores.idDocumento === '6') {
        this._apiperuService.getRucInfo(this.filtro).subscribe(
          response => {
            this.proveedorruc = response;
            //divido los datos de la despuesta
            this.proveedores.rSocial = response.razonSocial;
            this.proveedores.condicion = response.estado


            ///////////
            this.direccionProveedores.codpais = "PEN";
            this.direccionProveedores.ubigeo = response.ubigeo;
            this.direccionProveedores.region = response.departamento;
            this.direccionProveedores.provincia = response.provincia;
            this.direccionProveedores.distrito = response.distrito;
            this.direccionProveedores.direccion = response.direccion;

            console.log('this.clienteruc: ', this.proveedorruc);
          },
          error => {
            iziToast.show({
              title: 'ERROR',
              titleColor: '#FF0000',
              color: '#FFF',
              class: 'text-danger',
              position: 'topRight',
              message: 'Error al realizar la consulta por falta de datos'
            });
          });

      }





      if (this.proveedores.ruc.length === 8 && this.proveedores.idDocumento === '1') {
        this._apiperuService.getDniInfo(this.filtro).subscribe(
          response => {
            this.proveedorruc = response;
            //divido los datos de la despuesta
            this.proveedores.rSocial = response.apellidoPaterno + ' ' + response.apellidoMaterno + ', ' + response.nombres;


            console.log('this.proveedorruc: ', this.proveedorruc);
          },
          error => {
            iziToast.show({
              title: 'ERROR',
              titleColor: '#FF0000',
              color: '#FFF',
              class: 'text-danger',
              position: 'topRight',
              message: 'Error al realizar la consulta por falta de datos '
            });
          });

      }
    } catch (error) {
      iziToast.show({
        title: 'ERROR',
        titleColor: '#FF0000',
        color: '#FFF',
        class: 'text-danger',
        position: 'topRight',
        message: 'Ingrese un número de DNI o Ruc'
      });
    }





  }


  select_pais() {


    let pais = 'Perú';
    // this.direccionClientes.pais = pais;


    if (this.direccionProveedores.codpais == 'PEN') {
      setTimeout(() => {
        //$('#sl-region').prop('disabled', false);
      }, 50);
      this._adminService.get_Regiones().subscribe(
        response => {
          console.log(response);
          response.forEach((element: any) => {
            this.regiones.push({
              id: element.id,
              name: element.name
            });
          });

        }
      );
    } else {
      setTimeout(() => {
        // $('#sl-region').prop('disabled', true);
        // $('#sl-provincia').prop('disabled', true);
        // $('#sl-distrito').prop('disabled', true);
      }, 50);
      this.regiones = [];
      this.provincias = [];
      this.distritos = [];

      this.direccionProveedores.region = '';
      this.direccionProveedores.provincia = '';
      this.direccionProveedores.distrito = '';

    }
  }


  select_region() {

    this.provincias = [];
    setTimeout(() => {
      // $('#sl-provincia').prop('disabled', false);
      // $('#sl-distrito').prop('disabled', true);
    }, 50);
    this.direccionProveedores.provincia = '';
    this.direccionProveedores.distrito = '';
    this._adminService.get_Procincias().subscribe(
      response => {
        response.forEach((element: any) => {
          if (element.department_id == this.direccionProveedores.region) {
            this.provincias.push(
              element
            );
          }
        });
        console.log(this.provincias);


      }
    );
  }

  select_provincia() {
    this.distritos = [];
    setTimeout(() => {
     // $('#sl-distrito').prop('disabled', false);
    }, 50);

    this.direccionProveedores.distrito = '';

    this._adminService.get_Distritos().subscribe(
      response => {
        response.forEach((element: any) => {
          if (element.province_id == this.direccionProveedores.provincia) {
            this.distritos.push(element);
            // this.direccion.zip = this.distritos.forEach(element.id);
          }
        });
        console.log(this.distritos);



      }
    );
  }

  select_distrito(event: any) {
    const selectedId = event.target.value;
    this.direccionProveedores.ubigeo = selectedId;
    console.log(this.direccionProveedores.ubigeo);
  }


  editarDireccion(id: string) {}

  actualizarDireccion() {}

  registrar(registroForm: any) {

    console.log('this.cliientes', this.proveedores);
    console.log('this.direccionproveedores', this.direccionProveedores);

    // if (registroForm.valid) {
    this.btn_registrar = true;
    this.data = this.proveedores;
    console.log('this.data', this.data);
    //convertir array this.clientes a un objeto para pasarlo a mi servicio
    //  this.data.forEach((element: { id: string | number; name: any; }) => {
    //   this.data[element.id] = element.id;
    //  });

    //  console.log('this.data como objeto', this.data);
    this._proveedorService.crear_proveedor(this.data).subscribe(
      response => {
        if (response.data != undefined) {
          this._proveedorService.obtener_proveedor_id(this.proveedores.ruc).subscribe(
            response => {
              console.log('response.data', response.data);
              this.direccionProveedores.idCliente = response.data[0].idCliente;
              console.log('this.direccionProveedores con idCliente', this.direccionProveedores);
              if (response.data != undefined) {
                // this._clientesService.crear_direccionCliente(this.token, this.direccionClientes).subscribe(
                //   response => {
                //     if (response.data != undefined) {
                //       iziToast.show({
                //         title: 'SUCCESS',
                //         titleColor: '#006064',
                //         color: '#FFF',
                //         class: 'text-success',
                //         position: 'topRight',
                //         message: 'Cliente creado correctamente'
                //       });
                //       this.btn_registrar = false;
                //       //quiero redirigir a la pagina de index-clientes
                //       this._router.navigate(['/cliente']);
                //     }

                //   },
                //   error => {
                //     console.log(<any>error);
                //     console.error('Error al crear el cliente:', error);
                //     this.btn_registrar = false;
                //   }
                // )
              }

            }
          )
        } else {
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: response.message,
          });
          this.btn_registrar = false;
        }
        console.log(response.data);
        this.btn_registrar = false;
      },
      error => {
        console.log(<any>error);
        console.error('Error al crear el cliente:', error);
        this.btn_registrar = false;
      }

    )

  }

  onCheckboxChange() {
    if (this.mostrarDireccion) {
      this.mostrarDireccion = true;
      console.log('El checkbox está marcado.', this.mostrarDireccion);

      // Realiza acciones cuando el checkbox está marcado
    } else {
      // this.mostrarDireccion = false;
      console.log('El checkbox está desmarcado.', this.mostrarDireccion);

      // Realiza acciones cuando el checkbox está desmarcado
    }

  }

  consultar() {
    this.factilizaSvc.getAnexoByRUC('20512034617')
      .subscribe(res => console.log(res));
  }
}
