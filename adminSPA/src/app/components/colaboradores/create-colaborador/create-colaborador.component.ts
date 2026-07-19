import { Component, inject, OnInit } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { Router, RouterModule } from '@angular/router';
import { RolService } from '../../../services/rol.service';
import { PermisosService } from '../../../services/permisos.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare var iziToast:any;
declare var $:any;

@Component({
  selector: 'app-create-colaborador',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './create-colaborador.component.html',
  styleUrl: './create-colaborador.component.css'
})
export class CreateColaboradorComponent implements OnInit {
  public sidebarState = inject(SidebarStateService);

  public colaborador:any = {
    estado : false
  };

  public roles:any[] = [];
  public btn_registrar = false;
  public token:any = "";

  constructor(
    private _colaboradorService: AdminService,
    private _router: Router,
    private _rolService: RolService,
    private _permisosService: PermisosService
  ) {}

  private cargarRoles(): void {
    this._rolService.obtenerRoles().subscribe((response: any) => {
      if (response.data == undefined) {
        iziToast.show({
          title: 'ERROR',
          titleColor: '#FF0000',
          color: '#FFF',
          class: 'text-danger',
          position: 'topRight',
          message: 'Usted no tiene acceso a roles'
        });
      } else {
        this.roles = response.data;
      }
    });
  }

  ngOnInit(): void {
    this._permisosService.cargarPermisosUsuario().subscribe({
      next: () => {
        const lp = this._permisosService.limitesPlan();
        if (lp && lp.puedeCrearUsuario === false) {
          iziToast.show({
            title: 'Plan',
            titleColor: '#856404',
            color: '#FFF8e1',
            position: 'topRight',
            message: 'Límite de usuarios del plan alcanzado. Actualice el plan en Mi suscripción.'
          });
          void this._router.navigate(['/colaborador']);
          return;
        }
        this.cargarRoles();
      },
      error: () => {
        this.cargarRoles();
      }
    });
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
        (error: { status?: number; error?: { message?: string } }) => {
          this.btn_registrar = false;
          const msg =
            error?.status === 403 && error.error?.message
              ? error.error.message
              : 'No se pudo registrar el colaborador.';
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: msg
          });
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
