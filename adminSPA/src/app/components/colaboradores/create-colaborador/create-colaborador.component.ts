import { Component, inject } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { Router, RouterModule } from '@angular/router';
import { RolService } from '../../../services/rol.service';
import { FormsModule } from '@angular/forms';
import { TopnavComponent } from '../../topnav/topnav.component';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare var iziToast:any;
declare var $:any;

@Component({
  selector: 'app-create-colaborador',
  standalone: true,
  imports: [FormsModule, RouterModule, TopnavComponent, CommonModule, SidebarComponent],
  templateUrl: './create-colaborador.component.html',
  styleUrl: './create-colaborador.component.css'
})
export class CreateColaboradorComponent {
  public sidebarState = inject(SidebarStateService);

  public colaborador:any = {
    estado : false
  };

  public roles:any[] = [];
  public btn_registrar = false;
  public token:any = "";

  constructor(
    private _colaboradorService:AdminService,
    private _router:Router,
    private _rolService: RolService,
  ) { 
    //this.token = this._cookieService.get('token');
  };

  ngOnInit(): void {

    this._rolService.obtenerRoles().subscribe(
      (response: any) => {
                
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
          this.roles = response.data;
                    //convertir array de lista de roles this.roles a un objeto par usarlo en mi formulario
          
          


                  }

      }
    )

  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }

  registrar(registroForm:any){
            if(registroForm.valid){
      this.btn_registrar=true;

      
      this._colaboradorService.registro_colaborador_admin(this.colaborador).subscribe(
        (response: any) =>{
                    if(response.data == undefined){
            iziToast.show({
              title: 'ERROR',
              titleColor: '#FF0000',
              color: '#FFF',
              class: 'text-danger',
              position: 'topRight',
              message: response.message,
            });
            this.btn_registrar=false;

          }else{
             this.btn_registrar=false;
            // setTimeout(()=> {
            //   this.btn_registrar=false;
            // }, 4000);

            iziToast.show({
              title: 'SUCCESS',
              titleColor: '#1DC74C',
              color: '#FFF',
              class: 'text-success',
              position: 'topRight',
              message: 'Se registró correctamente el colaborador.'
          });

          this._router.navigate(['/colaborador']);
          }
          
        },
        (error:any) => {
        this.btn_registrar=false;

        }
        
        
      )
      
    }else{
      iziToast.show({
        title: 'ERROR',
        titleColor: '#FF0000',
        color: '#FFF',
        class: 'text-danger',
        position: 'topRight',
        message: 'Complete correctamente el formulario'
    });

      this.btn_registrar=false;

    }
  }

}
