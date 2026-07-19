import { Component } from '@angular/core';
import { RolService } from '../../../services/rol.service';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
declare var iziToast: any;

@Component({
  selector: 'app-create-rol',
  imports: [FormsModule, RouterModule],
  templateUrl: './create-rol.component.html',
  styleUrl: './create-rol.component.css'
})
export class CreateRolComponent {

  public rol:any = {};
  public token:any;

  constructor(
   private _rolService: RolService,
   private _router: Router,
  ) {}

  ngOnInit(): void {
    
  }

  registrar(registroForm: any){
    //validar si el formulario es valido
    if(registroForm.valid){
       
        //llamar al servicio crearRol
        this._rolService.crearRol(this.rol).subscribe(
          response=>{
                        //valido que response no sea undefined
            if (response.data == undefined) {
              iziToast.show({
                title: 'ERROR',
                titleColor: '#FF0000',
                color: '#FFF',
                class: 'text-danger',
                position: 'topRight',
                message: response.message,
              });
              //this.btn_actualizar = false;
    
            } else {
            //this.btn_actualizar = false;
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
    
            this._router.navigate(['/rol']);
            }
          },
          error=>{
                      }
        )
    } else{
          }
  }
}
