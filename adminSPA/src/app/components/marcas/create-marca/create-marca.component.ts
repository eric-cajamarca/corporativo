import { Component } from '@angular/core';
import { variosService } from '../../../services/varios.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var iziToast: any;

@Component({
  selector: 'app-create-marca',
  imports: [FormsModule, CommonModule, TopnavComponent],
  templateUrl: './create-marca.component.html',
  styleUrl: './create-marca.component.css'
})
export class CreateMarcaComponent {
  public marca: any = {};
  public token: any = '';
  
  public btn_registrar = false;


  constructor(
    private _marcaService: variosService,
    private _router: Router
  ) { 
    //this.token = this._cookieService.get('token');
  }

  ngOnInit(): void {
  }

  registrar(registroForm:any) {
        this._marcaService.crearMarca(this.marca).subscribe(
      response=>{
                        if(response == undefined){
                    
        }else{
                    iziToast.show({
            title: 'SUCCESS',
            titleColor: '#008000',
            color: '#FFF',
            class: 'text-success',
            position: 'topRight',
            message: 'La marca se creó correctamente',
          });

          //redireccionar a la lista de marcas
          this._router.navigate(['/marcas']);

        }
      }
    );
  } 
}
