import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { DocumentoService } from '../../../services/documento.service';
import { ApiperuService } from '../../../services/apiperu.service';
import { EmpresaService } from '../../../services/empresa.service';
import { RubrosService, Rubro } from '../../../services/rubros.service';
import { global } from '../../../services/global';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { PermisosService } from '../../../services/permisos.service';

declare var $: any;
declare var iziToast: any;
declare var bootstrap: any;

@Component({
  selector: 'app-update-empresa',
  standalone: true,
  imports: [FormsModule, RouterModule,CommonModule],
  templateUrl: './update-empresa.component.html',
  styleUrl: './update-empresa.component.css'
})
export class UpdateEmpresaComponent {

  public sidebarState = inject(SidebarStateService);
  public url: any;
  public empresa: any = {};
  // Variable para guardar el ID a eliminar
  direccionAEliminar: number | null = null;
  public filtro: any = "";
  public empresas: any = {

    idDocumento: '',
    ruc: '',
    razon_Social: '',
    nombre_Comercial: '',
    rubro: '',
    celular: '',
    correo: '',
    password: '',
    logo: '',
    condicion: '',
    estSunat: '',
    logoAnterior: ''

  };
  public clienteruc: any = [];

  imgSelect: any | ArrayBuffer | null = '';
  file: File | undefined;
  fileName: string = 'Seleccionar imagen';

  // public imgSelect: any | ArrayBuffer = '';
  // public file: any = undefined;
  // public direccionEmpresas:any=[];
  public documento: any = [];
  public regiones: any = [];
  public provincias: any = [];
  public distritos: any = [];
  //public token: any = "";
  public contBuscar = 0;
  public empConect: any = {};
  public btn_registrar = false;
  public mostrarDireccion = false;

  public str_pais = '';
  public direccionEmpresas: any = {};
  public direccionEmpresas_const: any = [];
  public crearSucursalConDireccion = false;
  public nombreSucursalNueva = '';
  // public direccionModificada: any = {};

  public data: any = {};
  public rubros: Rubro[] = [];


  constructor(
    private _adminService: AdminService,
    private _documentosService: DocumentoService,
    private _apiperuService: ApiperuService,
    private _empresasService: EmpresaService,
    private _rubrosService: RubrosService,
    private _router: Router,
    private _route: ActivatedRoute,
    public authService: AuthService,
    private _permisosService: PermisosService
  ) {
    
    this.url = global.url;

    this.direccionEmpresas.codpais = 'PEN';
    
   

    this._adminService.get_Regiones().subscribe(
      response => {
        this.regiones = response;
              }
    );

    this._adminService.get_Procincias().subscribe(
      response => {
        this.provincias = response;
              }
    );

    this._adminService.get_Distritos().subscribe(
      response => {
        this.distritos = response;
        
      }
    );

    this._documentosService.obtener_documento().subscribe(
      response => {
        this.documento = response.data;
        
      }
    );

      }

  ngOnInit() {
    this._permisosService.cargarPermisosUsuario().subscribe({ error: () => {} });
    this.initData();

    this.select_pais();
  }

  puedeNuevaDireccionEmpresa(): boolean {
    const lp = this._permisosService.limitesPlan();
    if (!lp) {
      return true;
    }
    return lp.puedeAgregarDireccionEmpresa !== false;
  }

  puedeCrearSucursalSegunPlan(): boolean {
    const lp = this._permisosService.limitesPlan();
    if (!lp) {
      return true;
    }
    return lp.puedeCrearSucursal !== false;
  }

  onSidebarToggle(collapsed: boolean) {
    this.sidebarState.setCollapsed(collapsed);
  }


  removeAccents(str: string) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  initData() {
    //quiero obtener el id de la empresa que lo estoy pasando como parametro en la url

    this._empresasService.getEmpresas_id().subscribe(
      response => {
                //convetir el array response.data a un objeto this.empresas
        this.empresas = response.data[0];
        const p = this.empresas?.permitirVentaMultiSucursal;
        this.empresas.permitirVentaMultiSucursal = !!(
          p === true || p === 1 || p === '1' || String(p).toLowerCase() === 'true'
        );
              }
    );
    this._rubrosService.listar({ activo: true }).subscribe(res => {
      const todos = res.data || [];
      this.rubros = todos.filter(r => ['GEN', 'GRF', 'HOTEL'].includes((r.codigo || '').trim().toUpperCase()));
    });

    this._empresasService.getDireccionEmpresa_id().subscribe(
      response => {
                //convetir el array response.data a un objeto this.empresas
        this.direccionEmpresas_const = response.data;

        
        //recorrer del array this.direccionEmpresas_const  buscar en regiones por el id de response.data.region y asignar el name a direccionEmpresas.region
         this.direccionEmpresas_const.forEach((direccion: any) => {
          const regionEncontrada = this.regiones.find((element: any) => Number(element.id) === Number(direccion.region));
          if (regionEncontrada) {
            direccion.nregion = String(regionEncontrada.name);
          }

          //buscar en provincias por el id de response.data.provincia y asignar el name a direccionEmpresas.provincia
          const provinciaEncontrada = this.provincias.find((element: any) => Number(element.id) === Number(direccion.provincia));
          if (provinciaEncontrada) {
            direccion.nprovincia = String(provinciaEncontrada.name);
          }

          //buscar en distritos por el id de response.data.distrito y asignar el name a direccionEmpresas.distrito
          const distritoEncontrada = this.distritos.find((element: any) => Number(element.id) === Number(direccion.distrito));
          if (distritoEncontrada) {
            direccion.ndistrito = String(distritoEncontrada.name);
          }
        }
        );

        }
    )
  }


  buscar() { }


  // select_pais() {


  //   let pais = 'Perú';
  //   // this.direccionEmpresas.pais = pais;


  //   if (this.direccionEmpresas.codpais == 'PEN') {
  //     setTimeout(() => {
  //       $('#sl-region').prop('disabled', false);
  //     }, 50);
  //     this._adminService.get_Regiones().subscribe(
  //       response => {
  //         console.log(response);
  //         response.forEach((element: any) => {
  //           this.regiones.push({
  //             id: element.id,
  //             name: element.name
  //           });
  //         });

  //       }
  //     );
  //   } else {
  //     setTimeout(() => {
  //       $('#sl-region').prop('disabled', true);
  //       $('#sl-provincia').prop('disabled', true);
  //       $('#sl-distrito').prop('disabled', true);
  //     }, 50);
  //     this.regiones = [];
  //     this.provincias = [];
  //     this.distritos = [];

  //     this.direccionEmpresas.region = '';
  //     this.direccionEmpresas.provincia = '';
  //     this.direccionEmpresas.distrito = '';

  //   }
  // }


  // select_region() {

  //   this.provincias = [];
  //   setTimeout(() => {
  //     $('#sl-provincia').prop('disabled', false);
  //     $('#sl-distrito').prop('disabled', true);
  //   }, 50);
  //   this.direccionEmpresas.provincia = '';
  //   this.direccionEmpresas.distrito = '';
  //   this._adminService.get_Procincias().subscribe(
  //     response => {
  //       response.forEach((element: any) => {
  //         if (element.department_id == this.direccionEmpresas.region) {
  //           this.provincias.push(
  //             element
  //           );
  //         }
  //       });
  //       console.log(this.provincias);


  //     }
  //   );
  // }

  // select_provincia() {
  //   this.distritos = [];
  //   setTimeout(() => {
  //     $('#sl-distrito').prop('disabled', false);
  //   }, 50);

  //   this.direccionEmpresas.distrito = '';

  //   this._adminService.get_Distritos().subscribe(
  //     response => {
  //       response.forEach((element: any) => {
  //         if (element.province_id == this.direccionEmpresas.provincia) {
  //           this.distritos.push(element);
  //           // this.direccion.zip = this.distritos.forEach(element.id);
  //         }
  //       });
  //       console.log(this.distritos);



  //     }
  //   );
  // }

  // select_distrito(event: any) {
  //   const selectedId = event.target.value;
  //   this.direccionEmpresas.ubigeo = selectedId;
  //   console.log(this.direccionEmpresas.ubigeo);
  // }


  // onLogoChange(event: any): void {
  //   var file: any;
  //   if (event.target.files && event.target.files[0]) {
  //     file = <File>event.target.files[0];

  //   } else {
  //     iziToast.show({
  //       title: 'ERROR',
  //       titleColor: '#FF0000',
  //       color: '#FFF',
  //       class: 'text-danger',
  //       position: 'topRight',
  //       message: 'No hay un imagen de envio'
  //     });
  //   }

  //   if (file.size <= 4000000) {

  //     if (file.type == 'image/png' || file.type == 'image/webp' || file.type == 'image/jpg' || file.type == 'image/gif' || file.type == 'image/jpeg') {
  //       // if (
  //       //   file.type.startsWith('image/') ||
  //       //   file.type.startsWith('video/mp4') // Verificar si es una imagen o video
  //       // ) {
  //       const reader = new FileReader();
  //       reader.onload = e => this.imgSelect = reader.result;
  //       console.log(this.imgSelect);

  //       reader.readAsDataURL(file);

  //       $('#input-portada').text(file.name);
  //       this.file = file;

  //     } else {
  //       iziToast.show({
  //         title: 'ERROR',
  //         titleColor: '#FF0000',
  //         color: '#FFF',
  //         class: 'text-danger',
  //         position: 'topRight',
  //         message: 'El archivo debe ser una imagen'
  //       });
  //       $('#input-portada').text('Seleccionar imagen');
  //       this.imgSelect = '01.jpg';
  //       this.file = undefined;
  //     }
  //   } else {
  //     iziToast.show({
  //       title: 'ERROR',
  //       titleColor: '#FF0000',
  //       color: '#FFF',
  //       class: 'text-danger',
  //       position: 'topRight',
  //       message: 'La imagen no puede superar los 4MB'
  //     });
  //     $('#input-portada').text('Seleccionar imagen');
  //     this.imgSelect = '01.jpg';
  //     this.file = undefined;
  //   }

  //   console.log(this.file);

  // }

    select_pais() {
  const pais = 'Perú';
  
  if (this.direccionEmpresas.codpais == 'PEN') {
    // Habilitar select de región
    const regionSelect = document.getElementById('sl-region') as HTMLSelectElement;
    regionSelect.disabled = false;
    
    // Obtener regiones
    this._adminService.get_Regiones().subscribe(
      response => {
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
    this.direccionEmpresas.region = '';
    this.direccionEmpresas.provincia = '';
    this.direccionEmpresas.distrito = '';
  }
}

 
  select_region() {
  // Limpiar arrays y valores
  this.provincias = [];
  this.direccionEmpresas.provincia = '';
  this.direccionEmpresas.distrito = '';

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
        element.department_id == this.direccionEmpresas.region
      );
          }
  );
  }

  

  select_provincia() {
  // Limpiar distritos y valor actual
  this.distritos = [];
  this.direccionEmpresas.distrito = '';

  // Habilitar select de distrito (versión nativa)
  const distritoSelect = document.getElementById('sl-distrito') as HTMLSelectElement;
  distritoSelect.disabled = false;

  // Obtener distritos
  this._adminService.get_Distritos().subscribe(
    response => {
      // Versión optimizada con filter
      this.distritos = response.filter((element: any) => 
        element.province_id == this.direccionEmpresas.provincia
      );
          }
  );
}

  select_distrito(event: any) {
    const selectedId = event.target.value;
    this.direccionEmpresas.ubigeo = selectedId;
      }


  onLogoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    
    if (!input.files || input.files.length === 0) {
      this.showError('No hay una imagen para enviar');
      return;
    }

    const file = input.files[0];
    this.fileName = file.name;

    // Validación de tamaño (4MB)
    if (file.size > 4000000) {
      this.resetSelection('La imagen no puede superar los 4MB');
      return;
    }

    // Validación de tipo
    const validTypes = ['image/png', 'image/webp', 'image/jpg', 'image/gif', 'image/jpeg'];
    if (!validTypes.includes(file.type)) {
      this.resetSelection('El archivo debe ser una imagen');
      return;
    }

    // Lectura de la imagen
    const reader = new FileReader();
    reader.onload = (e) => {
      this.imgSelect = e.target?.result ?? null;
      this.file = file;
    };
    reader.readAsDataURL(file);
  }

  private resetSelection(message: string): void {
    this.showError(message);
    this.fileName = 'Seleccionar imagen';
    this.imgSelect = '01.jpg';
    this.file = undefined;
  }

  private showError(message: string): void {
    iziToast.show({
      title: 'ERROR',
      titleColor: '#FF0000',
      color: '#FFF',
      class: 'text-danger',
      position: 'topRight',
      message: message,
      timeout: 5000
    });
  }



  editarDireccion(id: number) {
    // Limpiar la variable direccionEmpresas antes de buscar
    this.direccionEmpresas = {};

    
    // Buscar el objeto correspondiente en el array direccionEmpresas_const
    const direccion = this.direccionEmpresas_const.find((element: any) => element.idDireccionEmpresa === id);

    if (direccion) {
            // Clonar el objeto encontrado
      this.direccionEmpresas = { ...direccion }; //...este operador se utiliza para clonar un objeto
          } else {
          }
  }

  actualizarDireccion() {
        this._empresasService.updateDireccionEmpresa(this.direccionEmpresas).subscribe(
      response => {
                iziToast.show({
          title: 'SUCCESS',
          titleColor: '#0062cc',
          color: '#FFF',
          class: 'text-success',
          position: 'topRight',
          message: 'Dirección actualizada correctamente'
        });
      }

    );
    this.initData();
  }

  modalCrearDireccion() {
    this.direccionEmpresas = {};
    this.direccionEmpresas.idEmpresa = this.empresas.idEmpresa;
    this.direccionEmpresas.idUsuario = this.empresas.idUsuario;
    this.direccionEmpresas.codpais = 'PEN';
    this.direccionEmpresas.nombre = this.empresas.alias;
    this.crearSucursalConDireccion = false;
    this.nombreSucursalNueva = '';
  }

  crearDireccion() {
    const payload = { ...this.direccionEmpresas };
    if (this.crearSucursalConDireccion && this.nombreSucursalNueva?.trim()) {
      payload.crearSucursal = true;
      payload.nombreSucursal = this.nombreSucursalNueva.trim();
    }
    const lp = this._permisosService.limitesPlan();
    if (lp) {
      if (!lp.puedeAgregarDireccionEmpresa) {
        iziToast.show({
          title: 'Plan',
          titleColor: '#856404',
          color: '#fff8e1',
          position: 'topRight',
          message: 'Ha alcanzado el máximo de direcciones de establecimiento de su plan.'
        });
        return;
      }
      if (payload.crearSucursal && !lp.puedeCrearSucursal) {
        iziToast.show({
          title: 'Plan',
          titleColor: '#856404',
          color: '#fff8e1',
          position: 'topRight',
          message: 'Ha alcanzado el máximo de sucursales de su plan. Desactive «Crear sucursal» o actualice el plan.'
        });
        return;
      }
    }
    this._empresasService.createDireccionEmpresa(payload).subscribe({
      next: (response) => {
        iziToast.show({
          title: 'Éxito',
          titleColor: '#0062cc',
          color: '#FFF',
          class: 'text-success',
          position: 'topRight',
          message: this.crearSucursalConDireccion && this.nombreSucursalNueva?.trim()
            ? 'Dirección y sucursal creadas correctamente'
            : 'Dirección creada correctamente'
        });
        this.initData();
      },
      error: (err) => {
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          color: '#FFF',
          class: 'text-danger',
          position: 'topRight',
          message: err?.error?.message || 'Error al crear la dirección'
        });
      }
    });
  }

  updatePrincipal(id:any){
        this._empresasService.cambiar_principal_direccion(id).subscribe(
      response => {
                if(response.data > 0){
          iziToast.show({
            title: 'SUCCESS',
            titleColor: '#0062cc',
            color: '#FFF',
            class: 'text-success',
            position: 'topRight',
            message: 'Dirección principal actualizada correctamente'
          });

          this.initData();

        }else{
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: 'Error al actualizar la dirección principal'
          });
        }
        
      }
    );
  }

  registrar(registroForm: any) {
          
    if (!registroForm.valid) {
      return; // Salir temprano si el formulario no es válido.
    }
  
    // Establecer 'logoAnterior' basado en la existencia de 'logo'.
    this.empresas.logoAnterior = this.empresas.logo ? this.empresas.logo : undefined;
  
    // Si no hay archivo seleccionado y tampoco hay logo actual, mostrar error.
    if (!this.file && !this.empresas.logo) {
      iziToast.show({
        title: 'ERROR',
        titleColor: '#FF0000',
        color: '#FFF',
        class: 'text-danger',
        position: 'topRight',
        message: 'Debe subir una imagen para el logo de la empresa.'
      });
      return;
    }
  
    // Si hay un archivo seleccionado, actualizar 'logo' con el archivo.
    if (this.file) {
      this.empresas.logo = this.file;
    } else {
      // Si no hay archivo pero sí un logo existente, se procede a eliminar el logo actual.
      this.empresas.logo = undefined;
    }
  
    // Llamar a la función de actualización.
    this.actualizarEmpresa();
  }
  
  actualizarEmpresa() {
    this._empresasService.updateEmpresa(this.empresas.idEmpresa, this.empresas).subscribe(
      response => {
                iziToast.show({
          title: 'SUCCESS',
          titleColor: '#0062cc',
          color: '#FFF',
          class: 'text-success',
          position: 'topRight',
          message: 'Empresa actualizada correctamente.'
        });
        // Refrescar rubro en memoria y menú (Historial / opciones grifo dependen de idRubro).
        this._empresasService.refreshEmpresaFromApi().subscribe({
          next: () => this._permisosService.cargarNavegacion().subscribe({ error: () => {} }),
          error: () => this._permisosService.cargarNavegacion().subscribe({ error: () => {} })
        });
      },
      error => {
        console.error('Error al actualizar la empresa:', error);
        iziToast.show({
          title: 'ERROR',
          titleColor: '#FF0000',
          color: '#FFF',
          class: 'text-danger',
          position: 'topRight',
          message: 'Error al actualizar la empresa.'
        });
      }
    );
  }

  onCheckboxChange() {
    if (this.mostrarDireccion) {
      this.mostrarDireccion = true;
      
      // Realiza acciones cuando el checkbox está marcado
    } else {
      // this.mostrarDireccion = false;
      
      // Realiza acciones cuando el checkbox está desmarcado
    }

  }


  // Método para seleccionar la dirección a eliminar
  seleccionarDireccionAEliminar(id: number) {
    this.direccionAEliminar = id;
      }

  // Método para confirmar la eliminación
  confirmarEliminar() {
    if (this.direccionAEliminar) {
      this._empresasService.eliminarDireccion_id(this.direccionAEliminar).subscribe({
        next: (response) => {
          // Cierra el modal manualmente
          const modal = document.getElementById('confirmarEliminarModal');
          const modalInstance = bootstrap.Modal.getInstance(modal);
          modalInstance?.hide();
          
          // Actualiza la lista
          this.initData();
          iziToast.show({
            title: 'SUCCESS',
            titleColor: '#0062cc',
            color: '#FFF',
            class: 'text-success',
            position: 'topRight',
            message: 'Dirección eliminada correctamente'
          });
        },
        error: (error) => {
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: 'Error al eliminar la dirección'
          });
        }
      });
    }
  }

}
