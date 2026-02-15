import { Component } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { DocumentoService } from '../../../services/documento.service';
import { ApiperuService } from '../../../services/apiperu.service';
import { ClienteService } from '../../../services/cliente.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var iziToast: any;
declare var bootstrap: any;

@Component({
  selector: 'app-update-clientes',
  imports: [FormsModule,RouterModule,CommonModule,TopnavComponent],
  templateUrl: './update-clientes.component.html',
  styleUrl: './update-clientes.component.css'
})
export class UpdateClientesComponent {

  public filtro: any = "";
  public clientes: any = {
    correo: '',
    celular: '',
    condicion: 'ACTIVO',
  };
  public clienteruc: any = [];
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
  public direccionClientes: any = {};
  public direccionClientes_const: any[] = [];
  public data: any = {};
  public guardandoDireccion = false;
  public nuevaDireccion: any = {
    ubigeo: '',
    codPais: 'PEN',
    region: '',
    provincia: '',
    distrito: '',
    urbanizacion: '',
    direccion: '',
    referencia: '',
    codLocal: '',
    principal: true
  };

  constructor(
    private _adminService: AdminService,
    private _documentosService: DocumentoService,
    private _apiperuService: ApiperuService,
    private _clientesService: ClienteService,
    private _router: Router,
    private _route: ActivatedRoute,


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

        this.clientes.idCliente = params['id'];
        console.log('this.clientes.idCliente', this.clientes.idCliente);

        this._clientesService.obtener_cliente_id(this.clientes.idCliente ).subscribe(
          response => {
            console.log('response.data', response.data);
            if (response.data != undefined) {


              // Modificar el campo 'password' dentro del array 'data'
              response.data.forEach((item: any) => {
                this.clientes.idCliente = item.idCliente;
                this.clientes.ruc = item.ruc;
                this.clientes.idDocumento = item.idDocumento;
                this.clientes.rSocial = item.rSocial;
                this.clientes.correo = item.correo;
                this.clientes.celular = item.celular;
                this.clientes.condicion = item.condicion;
                // this.clientes.fregistro = item.fregistro;
              });
              console.log('this.clientes', this.clientes);
            }
          }
        );

        const idClienteParam = params['id'];
        this._clientesService.obtener_direccionesCliente_idCliente(idClienteParam).subscribe(
          response => {
            const data = response?.data;
            this.direccionClientes_const = Array.isArray(data) && data.length > 0 ? data : [];
            if (this.direccionClientes_const.length > 0) {
              console.log('this.direccionClientes_const', this.direccionClientes_const);

              //buscar en regiones por el id de response.data.region y asignar el name a direccionEmpresas.region
              const regionEncontrada = this.regiones.find((element: any) => Number(element.id) === Number(this.direccionClientes_const[0].region));

              if (regionEncontrada) {

                this.direccionClientes_const[0].nregion = String(regionEncontrada.name);
                console.log('this.direccionEmpresas.region', this.direccionClientes_const[0].nregion);
              }else{
                console.log('no se encontro la region');
              }


              //buscar en provincias por el id de response.data.provincia y asignar el name a direccionEmpresas.provincia
              const provinciaEncontrada = this.provincias.find((element: any) => Number(element.id) === Number(this.direccionClientes_const[0].provincia));

              if (provinciaEncontrada) {

                this.direccionClientes_const[0].nprovincia = String(provinciaEncontrada.name);
                console.log('this.direccionEmpresas.provincia', this.direccionClientes_const[0].nprovincia);
              }

              //buscar en distritos por el id de response.data.distrito y asignar el name a direccionEmpresas.distrito
              const distritoEncontrada = this.distritos.find((element: any) => Number(element.id) === Number(this.direccionClientes_const[0].distrito));

              if (distritoEncontrada) {

                this.direccionClientes_const[0].ndistrito = String(distritoEncontrada.name);
                console.log('this.direccionEmpresas.distrito', this.direccionClientes_const[0].ndistrito);
              }

            }
            console.log('this.direccionClientes_const', this.direccionClientes_const);
          },
          () => { this.direccionClientes_const = []; }
        )
      }

    );



    // this.select_pais();
  }

  //https://dniruc.apisperu.com/api/v1/dni/45633353?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImVyaWNvcnRpemd1ZXZhcmFAZ21haWwuY29tIn0.-cs9eKiQegcTM0bbaz7O-BT_sS7_BpV_6cndIqCeHfk

  buscar() {
    this.contBuscar = 1;
    console.log('veo que cod comprobante', this.clientes.idDocumento)

    console.log('filtro', this.clientes.ruc);
    this.filtro = this.clientes.ruc;

    try {

      if (this.clientes.ruc.length === 11 && this.clientes.idDocumento === '6') {
        this._apiperuService.getRucInfo(this.filtro).subscribe(
          response => {
            this.clienteruc = response;
            //divido los datos de la despuesta
            this.clientes.rSocial = response.razonSocial;
            this.clientes.condicion = response.estado


            ///////////
            this.direccionClientes.codpais = "PEN";
            this.direccionClientes.ubigeo = response.ubigeo;
            this.direccionClientes.region = response.departamento;
            this.direccionClientes.provincia = response.provincia;
            this.direccionClientes.distrito = response.distrito;
            this.direccionClientes.direccion = response.direccion;

            console.log('this.clienteruc: ', this.clienteruc);
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





      if (this.clientes.ruc.length === 8 && this.clientes.idDocumento === '1') {
        this._apiperuService.getDniInfo(this.filtro).subscribe(
          response => {
            this.clienteruc = response;
            //divido los datos de la despuesta
            this.clientes.rSocial = response.apellidoPaterno + ' ' + response.apellidoMaterno + ', ' + response.nombres;


            console.log('this.clienteruc: ', this.clienteruc);
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


    if (this.direccionClientes.codpais == 'PEN') {
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

      this.direccionClientes.region = '';
      this.direccionClientes.provincia = '';
      this.direccionClientes.distrito = '';

    }
  }


  select_region() {

    this.provincias = [];
    setTimeout(() => {
      // $('#sl-provincia').prop('disabled', false);
      // $('#sl-distrito').prop('disabled', true);
    }, 50);
    this.direccionClientes.provincia = '';
    this.direccionClientes.distrito = '';
    this._adminService.get_Procincias().subscribe(
      response => {
        response.forEach((element: any) => {
          if (element.department_id == this.direccionClientes.region) {
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

    this.direccionClientes.distrito = '';

    this._adminService.get_Distritos().subscribe(
      response => {
        response.forEach((element: any) => {
          if (element.province_id == this.direccionClientes.provincia) {
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
    this.direccionClientes.ubigeo = selectedId;
    console.log(this.direccionClientes.ubigeo);
  }


  editarDireccion(id: string) {
    const item = this.direccionClientes_const.find((d: any) => Number(d.idDireccionClientes) === Number(id));
    if (item) {
      this.direccionClientes = { ...item };
    }
  }

  actualizarDireccion() {
    if (!this.direccionClientes?.idDireccionClientes) return;
    const payload = {
      idCliente: this.direccionClientes.idCliente,
      ubigeo: this.direccionClientes.ubigeo ?? '',
      codPais: this.direccionClientes.codPais ?? 'PEN',
      region: this.direccionClientes.region ?? '',
      provincia: this.direccionClientes.provincia ?? '',
      distrito: this.direccionClientes.distrito ?? '',
      urbanizacion: this.direccionClientes.urbanizacion ?? '',
      direccion: this.direccionClientes.direccion ?? '',
      referencia: this.direccionClientes.referencia ?? '',
      codLocal: this.direccionClientes.codLocal ?? ''
    };
    this._clientesService.editar_direccionCliente(this.direccionClientes.idDireccionClientes, payload).subscribe({
      next: () => {
        this.cargarDirecciones();
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'OK', message: 'Dirección actualizada.', position: 'topRight' });
        }
      },
      error: () => {
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudo actualizar la dirección.', position: 'topRight' });
        }
      }
    });
  }

  cargarDirecciones(): void {
    if (!this.clientes?.idCliente) return;
    this._clientesService.obtener_direccionesCliente_idCliente(this.clientes.idCliente).subscribe({
      next: (response) => {
        const data = response?.data;
        this.direccionClientes_const = Array.isArray(data) && data.length > 0 ? data : [];
        if (this.direccionClientes_const.length > 0) {
          this.regiones.forEach((reg: any) => {
            const r = this.direccionClientes_const.find((d: any) => Number(d.region) === Number(reg.id));
            if (r) r.nregion = reg.name;
          });
          this.provincias.forEach((prov: any) => {
            const p = this.direccionClientes_const.find((d: any) => Number(d.provincia) === Number(prov.id));
            if (p) p.nprovincia = prov.name;
          });
          this.distritos.forEach((dist: any) => {
            const d = this.direccionClientes_const.find((x: any) => Number(x.distrito) === Number(dist.id));
            if (d) d.ndistrito = dist.name;
          });
        }
      },
      error: () => { this.direccionClientes_const = []; }
    });
  }

  guardarNuevaDireccion(): void {
    const dir = (this.nuevaDireccion.direccion || '').toString().trim();
    if (!dir) return;
    if (!this.clientes?.idCliente) return;
    const payload = {
      idCliente: this.clientes.idCliente,
      ubigeo: (this.nuevaDireccion.ubigeo ?? '').toString().trim(),
      codpais: (this.nuevaDireccion.codPais ?? 'PEN').toString(),
      region: (this.nuevaDireccion.region ?? '').toString().trim(),
      provincia: (this.nuevaDireccion.provincia ?? '').toString().trim(),
      distrito: (this.nuevaDireccion.distrito ?? '').toString().trim(),
      urbanizacion: (this.nuevaDireccion.urbanizacion ?? '').toString().trim(),
      direccion: dir,
      referencia: (this.nuevaDireccion.referencia ?? '').toString().trim(),
      codLocal: (this.nuevaDireccion.codLocal ?? '').toString().trim(),
      principal: true
    };
    this.guardandoDireccion = true;
    this._clientesService.crear_direccionCliente(payload).subscribe({
      next: () => {
        this.guardandoDireccion = false;
        this.nuevaDireccion = { ubigeo: '', codPais: 'PEN', region: '', provincia: '', distrito: '', urbanizacion: '', direccion: '', referencia: '', codLocal: '', principal: true };
        this.cargarDirecciones();
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'OK', message: 'Dirección registrada.', position: 'topRight' });
        }
      },
      error: () => {
        this.guardandoDireccion = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudo registrar la dirección.', position: 'topRight' });
        }
      }
    });
  }

  registrar(registroForm: any) {

    console.log('this.cliientes', this.clientes);
    console.log('this.direccionClientes', this.direccionClientes);

    // if (registroForm.valid) {
    this.btn_registrar = true;
    this.data = this.clientes;
    console.log('this.data', this.data);
    //convertir array this.clientes a un objeto para pasarlo a mi servicio
    //  this.data.forEach((element: { id: string | number; name: any; }) => {
    //   this.data[element.id] = element.id;
    //  });

    //  console.log('this.data como objeto', this.data);
    this._clientesService.crear_cliente(this.data).subscribe(
      response => {
        if (response.data != undefined) {
          this._clientesService.obtener_cliente_id(this.clientes.ruc).subscribe(
            response => {
              console.log('response.data', response.data);
              this.direccionClientes.idCliente = response.data[0].idCliente;
              console.log('this.direccionClientes con idCliente', this.direccionClientes);
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
}
