import { Component, inject } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { RolService } from '../../../services/rol.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare var iziToast:any;


@Component({
  selector: 'app-update-colaborador',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './update-colaborador.component.html',
  styleUrl: './update-colaborador.component.css'
})
export class UpdateColaboradorComponent {

  public sidebarState = inject(SidebarStateService);
  public colaborador: any = {};
  // public colaborador_const: any = {};
  // public colaborador: Array<any> = [];

  public btn_actualizar = false;
  public token: any = "";
  public id = '';
  public load_data = false;
  public data = false;
  public roles: any = [];

  constructor(
    private _adminservice: AdminService,
    private _router: Router,
    private _route: ActivatedRoute,
    private _rolService: RolService,
  ) { 
    //this.token = this._cookieService.get('token');
  };


  ngOnInit(): void {
    this._route.params.subscribe(
      params => {

        this.id = params['id'];
        this.load_data = true;
        this._adminservice.obtener_datos_colaborador_admin(this.id).subscribe(
          response => {

            
            if (response.data != undefined) {
              // Modificar el campo 'password' dentro del array 'data'
              response.data.forEach((item:any) => {
                this.colaborador.idUsuario = item.idUsuario;
                this.colaborador.nombres = item.nombres;
                this.colaborador.apellidos = item.apellidos;
                this.colaborador.email = item.email;
                this.colaborador.password  = '';
                this.colaborador.idRol = item.idRol[0];
                this.colaborador.fregistro = item.fregistro;
              });

              this.colaborador.idRol = this.colaborador.idRol || null;
              
                            // this.colaborador = response;             
              this.data = true;
              this.load_data = false;
             }else {
              this.data = false;
              this.load_data = false;
            }
            
            
          }

        );

        this._rolService.obtenerRoles().subscribe(
          response => {
                        
            if (response.data == undefined) {
              iziToast.show({
                title: 'ERROR',
                titleColor: '#FF0000',
                color: '#FFF',
                class: 'text-danger',
                position: 'topRight',
                message: 'Usted no tiene acceso a roles'
              });
              //this._router.navigate(['/']);
            } else {
              this.roles = response.data || null;
                            //convertir array de lista de roles this.roles a un objeto par usarlo en mi formulario
              
              


                          }

          }
        )

      }
    );
  }


  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }

  actualizar(updateForm: any) {
    if (updateForm.valid) {
      this.btn_actualizar = true;

            if(this.colaborador.password == ''){
                this.colaborador.password = 'sin datos'
      }else{
                
      }
      
      
      try {
        this._adminservice.editar_colaborador_admin(this.id, this.colaborador).subscribe(
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
              this.btn_actualizar = false;
  
            } else {
              this.btn_actualizar = false;
              // setTimeout(()=> {
              //   this.btn_actualizar=false;
              // }, 4000);
  
              iziToast.show({
                title: 'SUCCESS',
                titleColor: '#1DC74C',
                color: '#FFF',
                class: 'text-success',
                position: 'topRight',
                message: response.message,
              });
  
              this._router.navigate(['/colaborador']);
            }
  
          },
          error =>{
            this.btn_actualizar = false;
          }
        
        )
      } catch (error) {
        iziToast.show({
          title: 'ERROR',
          titleColor: '#FF0000',
          color: '#FFF',
          class: 'text-danger',
          position: 'topRight',
          message: 'Error en el servidor, intente mas tarde'
        });
      }
      

    } else {
      iziToast.show({
        title: 'ERROR',
        titleColor: '#FF0000',
        color: '#FFF',
        class: 'text-danger',
        position: 'topRight',
        message: 'Complete correctamente el formulario'
      });
    }

  }
}
