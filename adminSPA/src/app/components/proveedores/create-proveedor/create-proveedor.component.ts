import { Component } from '@angular/core';
import { ProveedoresService } from '../../../services/proveedores.service';
import { ApiperuService } from '../../../services/apiperu.service';
import { DocumentoService } from '../../../services/documento.service';
import { AdminService } from '../../../services/admin.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TopnavComponent } from '../../topnav/topnav.component';
import { CommonModule } from '@angular/common';

declare var iziToast: any;


@Component({
  selector: 'app-create-proveedor',
  imports: [FormsModule,CommonModule ,TopnavComponent],
  templateUrl: './create-proveedor.component.html',
  styleUrl: './create-proveedor.component.css'
})
export class CreateProveedorComponent {
  public busqueda = false;
  public filtro: any = "";
  public proveedores: any = {
    correo: '',
    celular: '',
    condicion:'ACTIVO',
    idDocumento: '',
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
  public direccionProveedores: any = {

    ubigeo: '',
    codpais: 'PEN',
    region: '',
    provincia: '',
    distrito: '',
    principal: false,
    codLocal: '0',
    urbanizacion: '',
  };
  public data: any = {};

  constructor(
    private _adminService: AdminService,
    private _documentosService: DocumentoService,
    private _apiperuService: ApiperuService,
    private _proveedoresService: ProveedoresService,
    private _router: Router,
    
  ) {
    //this.token = this._cookieService.get('token');

    this.direccionProveedores.codpais = 'PEN';


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

    console.log('this.direccionProveedores', this.direccionProveedores);
  }

  ngOnInit() {
    this._documentosService.obtener_documento().subscribe(
      response => {
        this.documento = response.data;
        console.log('this.documento', this.documento);

        //convertir array de lista de roles this.roles a un objeto par usarlo en mi formulario
        //  this.documento.forEach((element: { id: string | number; name: any; }) => {
        //   this.documento[element.id] = element.id;
        //  });

      }
    );

    this.select_pais();
  }


  removeAccents(str: string) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  
  //https://dniruc.apisperu.com/api/v1/dni/45633353?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImVyaWNvcnRpemd1ZXZhcmFAZ21haWwuY29tIn0.-cs9eKiQegcTM0bbaz7O-BT_sS7_BpV_6cndIqCeHfk

  // buscar() {
  //   this.contBuscar = 1;
  //   console.log('veo que cod comprobante', this.clientes.idDocumento)

  //   console.log('filtro', this.clientes.ruc);
  //   this.filtro = this.clientes.ruc;

  //   try {

  //     if (this.clientes.ruc.length === 11 && this.clientes.idDocumento === '6') {
  //       this._apiperuService.getRucInfo(this.filtro).subscribe(
  //         response => {
  //           this.clienteruc = response;
  //           //divido los datos de la despuesta
  //           this.clientes.rSocial = response.razonSocial;
  //           this.clientes.condicion = response.estado
  
  
  //           ///////////
  //           this.direccionClientes.codpais = "PEN";
  //           this.direccionClientes.ubigeo = response.ubigeo;
            
  //           this.direccionClientes.direccion = response.direccion;

  //           //encuentro el id de la region
  //           const regionEncontrada = this.regiones.find((element: any) => this.removeAccents(element.name).toUpperCase() === response.departamento.toUpperCase());

  //           if (regionEncontrada) {
  //            this.direccionClientes.region = regionEncontrada.id;
  //            console.log('this.direccionClientes.region', this.direccionClientes.region);
  //          } else {
  //            console.log('No se encontró la región correspondiente para el departamento:', response.departamento);
  //          }

  //          //encuentro el id de la provincia
  //          const provinciaEncontrada = this.provincias.find((element: any) => this.removeAccents(element.name).toUpperCase() === response.provincia.toUpperCase());

  //          if (provinciaEncontrada) {
  //            this.direccionClientes.provincia = provinciaEncontrada.id;
  //            console.log('this.direccionClientes.provincia', this.direccionClientes.provincia);
  //          } else {
  //            console.log('No se encontró la provincia correspondiente para el departamento:', response.provincia);
  //          }

  //          //encuentro el id del distrito
  //          const distritoEncontrado = this.distritos.find((element: any) => this.removeAccents(element.name).toUpperCase() === response.distrito.toUpperCase());

  //          if (distritoEncontrado) {
  //            this.direccionClientes.distrito = distritoEncontrado.id;
  //            console.log('this.direccionClientes.distrito', this.direccionClientes.distrito);
  //          } else {
  //            console.log('No se encontró el distrito correspondiente para el departamento:', response.distrito);
  //          }

  
  //           console.log('this.clienteruc: ', this.clienteruc);
  //         },error => {
  //           iziToast.show({
  //             title: 'ERROR',
  //             titleColor: '#FF0000',
  //             color: '#FFF',
  //             class: 'text-danger',
  //             position: 'topRight',
  //             message: error.error.message || 'Error al realizar la consulta por falta de datos '
  //           });
  //         });

  //     }
      




  //     if (this.clientes.ruc.length === 8 && this.clientes.idDocumento === '1') {
  //       this._apiperuService.getDniInfo(this.filtro).subscribe(
  //         response => {
  //           this.clienteruc = response;
  //           //divido los datos de la despuesta
  //           this.clientes.rSocial = response.apellidoPaterno + ' ' + response.apellidoMaterno + ', ' + response.nombres;


  //           console.log('this.clienteruc: ', this.clienteruc);
  //         },
  //         error => {
  //           iziToast.show({
  //             title: 'ERROR',
  //             titleColor: '#FF0000',
  //             color: '#FFF',
  //             class: 'text-danger',
  //             position: 'topRight',
  //             message: 'Error al realizar la consulta por falta de datos '
  //           });
  //         });

  //     }
  //   } catch (error) {
  //     iziToast.show({
  //       title: 'ERROR',
  //       titleColor: '#FF0000',
  //       color: '#FFF',
  //       class: 'text-danger',
  //       position: 'topRight',
  //       message: 'Ingrese un número de DNI o Ruc'
  //     });
  //   }





  // }

  async buscar() {
    this.busqueda=true;
  this.contBuscar = 1;
  console.log('Documento:', this.proveedores.idDocumento);
  console.log('Filtro RUC/DNI:', this.proveedores.ruc);
  
  this.filtro = this.proveedores.ruc;

  // Validación básica
  if (!this.filtro || !this.proveedores.idDocumento) {
    this.showError('Ingrese un número de documento y seleccione un tipo');
    return;
  }

  try {
    if (this.proveedores.ruc.length === 11 && this.proveedores.idDocumento === '6') {
      await this.handleRucSearch();
      this.busqueda=false;
    } else if (this.proveedores.ruc.length === 8 && this.proveedores.idDocumento === '1') {
      await this.handleDniSearch();
      this.busqueda=false;
    } else {
      this.busqueda=false;
      this.showError('Formato de documento incorrecto');
    }

 
  } catch (error) {
    console.error('Error en búsqueda:', error);
    this.showError(error instanceof Error ? error.message : 'Error desconocido');
    this.busqueda=false;
  }
}

private async handleRucSearch(): Promise<void> {
  try {
    const response = await this._apiperuService.getRucInfo(this.filtro).toPromise();
    
    if (!response) {
      throw new Error('No se recibieron datos del servicio');
    }

    console.log('Respuesta RUC:', response);
    // Asignación de datos básicos
    this.proveedorruc = response;
    this.proveedores.rSocial = response.razonSocial;
    this.proveedores.condicion = response.estado;
    this.direccionProveedores.codpais = "PEN";
    this.direccionProveedores.ubigeo = response.ubigeo;
    this.direccionProveedores.direccion = response.direccion;

    // Búsqueda de ubicación geográfica
    this.direccionProveedores.region = this.findLocationId(
      this.regiones, 
      response.departamento, 
      'departamento'
    );
    
    this.direccionProveedores.provincia = this.findLocationId(
      this.provincias, 
      response.provincia, 
      'provincia'
    );
    
    this.direccionProveedores.distrito = this.findLocationId(
      this.distritos, 
      response.distrito, 
      'distrito'
    );
    
    if (response.success === false) {
      iziToast.show({
        title: 'ERROR',
        titleColor: '#FF0000',
        color: '#FFF',
        class: 'text-danger',
        position: 'topRight',
        message: response.message || 'Error al consultar RUC'
      });

      this.busqueda=false;
    }
    console.log('Datos RUC obtenidos:', this.proveedorruc);
  } catch (error) {
    console.error('Error en búsqueda RUC:', error);
    throw new Error( 'Error al consultar RUC');
    this.busqueda=false;
  }
}

private async handleDniSearch(): Promise<void> {
  try {
    const response = await this._apiperuService.getDniInfo(this.filtro).toPromise();
    
    if (!response) {
      throw new Error('No se recibieron datos del servicio');
    }

    this.proveedorruc = response;
    this.proveedores.rSocial = `${response.apellidoPaterno} ${response.apellidoMaterno}, ${response.nombres}`;
    
   
    
  } catch (error) {
    console.error('Error en búsqueda DNI:', error);
    throw new Error('Error al consultar DNI');
    this.busqueda=false;
  }
}

  // private findLocationId(items: any[], name: string, type: string): string | undefined {
  //   if (!items || items.length === 0) {
  //     console.warn(`No hay ${type}s cargados para buscar`);
  //     return undefined;
  //   }

  //   const foundItem = items.find(item => 
  //     this.removeAccents(item.name).toUpperCase() === name?.toUpperCase()
  //   );

  //   if (!foundItem) {
  //     console.warn(`No se encontró ${type} correspondiente para:`, name);
  //     return undefined;
  //   }

  //   console.log(`${type} encontrado:`, foundItem);
  //   return foundItem.id;
  // }

  private findLocationId(items: any[], name: string, type: string): string | undefined {
    if (!items || items.length === 0) {
      console.warn(`No hay ${type}s cargados para buscar`);
      return undefined;
    }

    if (!name) {
      console.warn(`El nombre del ${type} es inválido o vacío`);
      return undefined;
    }

    // 🔤 Normalizar texto: elimina tildes, espacios y pasa a minúsculas
    const normalize = (text: string) =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // elimina tildes
        .replace(/\s+/g, ' ') // normaliza espacios
        .trim()
        .toLowerCase();

    const normalizedName = normalize(name);

    // 🔍 1️⃣ Búsqueda exacta (ya sin tildes ni mayúsculas)
    let foundItem = items.find(item => normalize(item.name) === normalizedName);

    // 🔍 2️⃣ Si no encuentra, busca coincidencia parcial (ej. "lima" dentro de "lima metropolitana")
    if (!foundItem) {
      foundItem = items.find(item => normalize(item.name).includes(normalizedName));
    }

    // 🔍 3️⃣ Si aún no encuentra, intenta coincidencia inversa
    if (!foundItem) {
      foundItem = items.find(item => normalizedName.includes(normalize(item.name)));
    }

    if (!foundItem) {
      console.warn(`No se encontró ${type} correspondiente para: ${name}`);
      console.log(`Lista disponible de ${type}s:`, items.map(i => i.name));
      return undefined;
    }

    console.log(`${type} encontrado:`, foundItem.name, `(ID: ${foundItem.id})`);
    return foundItem.id;
  }



  private showError(message: string): void {
    iziToast.show({
      title: 'ERROR',
      titleColor: '#FF0000',
      color: '#FFF',
      class: 'text-danger',
      position: 'topRight',
      message: message
    });
  }

  
  select_pais() {
  const pais = 'Perú';
  
  if (this.direccionProveedores.codpais == 'PEN') {
    // Habilitar select de región
    const regionSelect = document.getElementById('sl-region') as HTMLSelectElement;
    regionSelect.disabled = false;
    
    // Obtener regiones
    this._adminService.get_Regiones().subscribe(
      response => {
        console.log(response);
        // Usar map en lugar de forEach + push (más eficiente)
        this.regiones = response.map((element: any) => ({
          id: element.id,
          name: element.name
        }));
      }
    );
  } else {
    // Deshabilitar todos los selects
    const regionSelect = document.getElementById('sl-region') as HTMLSelectElement;
    const provinciaSelect = document.getElementById('sl-provincia') as HTMLSelectElement;
    const distritoSelect = document.getElementById('sl-distrito') as HTMLSelectElement;
    
    regionSelect.disabled = true;
    provinciaSelect.disabled = true;
    distritoSelect.disabled = true;
    
    // Limpiar arrays y modelos
    this.regiones = [];
    this.provincias = [];
    this.distritos = [];
    this.direccionProveedores.region = '';
    this.direccionProveedores.provincia = '';
    this.direccionProveedores.distrito = '';
  }
}

 
  select_region() {
  // Limpiar arrays y valores
  this.provincias = [];
  this.direccionProveedores.provincia = '';
  this.direccionProveedores.distrito = '';

  // Obtener elementos del DOM nativamente
  const provinciaSelect = document.getElementById('sl-provincia') as HTMLSelectElement;
  const distritoSelect = document.getElementById('sl-distrito') as HTMLSelectElement;

  // Cambiar estados de los selects
  provinciaSelect.disabled = false;
  distritoSelect.disabled = true;

  // Obtener provincias
  this._adminService.get_Procincias().subscribe(
    response => {
      // Usar filter en lugar de forEach + if
      this.provincias = response.filter((element: any) => 
        element.department_id == this.direccionProveedores.region
      );
      console.log(this.provincias);
    }
  );
  }

  

  select_provincia() {
  // Limpiar distritos y valor actual
  this.distritos = [];
  this.direccionProveedores.distrito = '';

  // Habilitar select de distrito (versión nativa)
  const distritoSelect = document.getElementById('sl-distrito') as HTMLSelectElement;
  distritoSelect.disabled = false;

  // Obtener distritos
  this._adminService.get_Distritos().subscribe(
    response => {
      // Versión optimizada con filter
      this.distritos = response.filter((element: any) => 
        element.province_id == this.direccionProveedores.provincia
      );
      console.log('Distritos cargados:', this.distritos);
    }
  );
}

  select_distrito(event: any) {
    const selectedId = event.target.value;
    this.direccionProveedores.ubigeo = selectedId;
    console.log(this.direccionProveedores.ubigeo);
  }

  registrar(registroForm: any){

    // if (registroForm.valid) {
      this.btn_registrar = true;
      this.data = this.proveedores;
      console.log('this.data', this.data);
      //convertir array this.clientes a un objeto para pasarlo a mi servicio
      //  this.data.forEach((element: { id: string | number; name: any; }) => {
      //   this.data[element.id] = element.id;
      //  });

      //  console.log('this.data como objeto', this.data);
      this._proveedoresService.crear_proveedor(this.data).subscribe(
        response => {
          if(response.data != undefined){
            this._proveedoresService.obtener_proveedor_ruc(this.proveedores.ruc).subscribe(
              response => {
                // console.log('response.data', response.data);
                this.direccionProveedores.idProveedor = response.data[0].idProveedor;
                // console.log('this.direccionClientes con idCliente', this.direccionClientes);
                if(response.data != undefined){
                  this._proveedoresService.crear_direccionProveedor(this.direccionProveedores).subscribe(
                      response => {
                        if(response.data != undefined){
                          iziToast.show({
                            title: 'SUCCESS',
                            titleColor: '#006064',
                            color: '#FFF',
                            class: 'text-success',
                            position: 'topRight',
                            message: 'Cliente creado correctamente'
                          });
                          this.btn_registrar = false;
                          //quiero redirigir a la pagina de index-clientes
                          this._router.navigate(['/cliente']);
                        }
                        
                      },
                      error => {
                        console.log(<any>error);
                        console.error('Error al crear el cliente:', error);
                        this.btn_registrar = false;
                      }
                    )
                }
                
              }
            )
          }else{
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

  onCheckboxChange(){
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
