import { Component } from '@angular/core';
import { CategoriaService } from '../../../services/categoria.service';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var iziToast: any;


@Component({
  selector: 'app-create-categoria',
  imports: [FormsModule, RouterModule, CommonModule, TopnavComponent],
  templateUrl: './create-categoria.component.html',
  styleUrl: './create-categoria.component.css'
})
export class CreateCategoriaComponent {

  public categorias: any = {};
  public token: any = '';
  
  public btn_registrar = false;


  constructor(
    private _categoriaService: CategoriaService,
    private _router: Router
  ) { 
    //this.token = this._cookieService.get('token');
  }

  ngOnInit(): void {
  }

  registrar(registroForm:any) {
    console.log('Formulario enviado', this.categorias);
    this._categoriaService.crear_categoria(this.categorias).subscribe(
      response=>{
        console.log('response');
        console.log(response);
        if(response == undefined){
          console.log('Catgoría no creada');
          
        }else{
          console.log('Categoría creada');
          iziToast.show({
            title: 'SUCCESS',
            titleColor: '#008000',
            color: '#FFF',
            class: 'text-success',
            position: 'topRight',
            message: 'La categoría se creó correctamente',
          });

          //redireccionar a la lista de marcas
          this._router.navigate(['/categorias']);

        }
      }
    );
  } 
}
