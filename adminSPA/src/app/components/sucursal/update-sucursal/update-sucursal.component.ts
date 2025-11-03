import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SucursalService } from '../../../services/sucursal.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';

@Component({
  selector: 'app-update-sucursal',
  imports: [FormsModule, RouterModule, CommonModule, TopnavComponent],
  templateUrl: './update-sucursal.component.html',
  styleUrl: './update-sucursal.component.css'
})
export class UpdateSucursalComponent {
  public sucursal: any = {};
  public token: any = '';

  public id: any;
  public load_data: boolean = false;

  constructor(
    private _Route: ActivatedRoute,
    private _sucursalService: SucursalService,
    private _router: Router,
  ) {
    //this.token = this._cookieService.get('token');

  }

  ngOnInit(): void {
    this._Route.params.subscribe(
      params => {
        console.log('params: ', params);
        this.id = params['id'];
        console.log('this.id: ', this.id);

        this._sucursalService.obtener_sucursal_idempresa().subscribe(
          response => {
            console.log('response: ', response);
            this.sucursal = response;
            // this.sucursal = this.sucursal[0].descripcion;
            // this.load_data = true;

            //deseo buscar en response.data el objeto que tenga el this.id y extraer el objeto
            this.sucursal = response.data.find((sucursal: any) => sucursal.idSucursal == this.id);
            //this.sucursal = this.sucursal[0].descripcion;

            console.log('this.sucursal: ', this.sucursal);


            //convertir this.sucursal a un objeto par usarlo en mi formulario
            // this.sucursal = {
            //   nombre: this.sucursal[0].nombre,
            //   direccion: this.sucursal[0].direccion,
            //   telefono: this.sucursal[0].telefono,
            //   id: this.sucursal[0].id,
            // }

            console.log('this.sucursal: ', this.sucursal);
          },
          error => {
            console.log('error: ', error);
          }
        )

      }
    )
  }

  actualizar(updateForm: any) {
    console.log('updateForm: ', updateForm);
    console.log('this.sucursal: ', this.sucursal);
    this.load_data = true;
    this._sucursalService.editar_sucursal_idEmpresa(this.sucursal).subscribe(
      response => {
        console.log('response: ', response);
        this._router.navigate(['/sucursal']);
        this.load_data = false;
      },
      error => {
        console.log('error: ', error);
      }
    )
  }

}
