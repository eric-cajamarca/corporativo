import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { RolService } from '../../../services/rol.service';
import { FormsModule } from '@angular/forms';
declare var iziToast: any;

@Component({
  selector: 'app-update-rol',
  imports: [FormsModule, RouterModule],
  templateUrl: './update-rol.component.html',
  styleUrl: './update-rol.component.css'
})
export class UpdateRolComponent {
  public token: any = '';
  public rol: any = {};
  public id: any;
  public load_data: boolean = false;

  constructor(
    private _Route: ActivatedRoute,
    private _rolService: RolService,
    private _router: Router,
  ) {
    //this.token = this._cookieService.get('token');
  }


  ngOnInit(): void {
    this._Route.params.subscribe(
      params => {
                this.id = params['id'];
        
        this._rolService.obtenerRolId(this.id).subscribe(
          response => {
                        this.rol = response;
            // this.rol = this.rol[0].descripcion;
            // this.load_data = true;


            //convertir this.rol a un objeto par usarlo en mi formulario
            this.rol = {
              descripcion: this.rol[0].descripcion,
              id: this.rol[0].id,

            }

                      },
          error => {
                      }
        )
      }
    )



  }

  actualizar(updateForm: any) {
    //validar si el formulario es valido
    if (updateForm.valid) {
            this._rolService.actualizarRol(this.id, this.rol).subscribe(
        response=>{
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
        }
      );
    }
  }
}
