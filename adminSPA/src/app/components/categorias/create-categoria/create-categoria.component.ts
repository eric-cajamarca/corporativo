import { Component, Optional } from '@angular/core';
import { CategoriaService } from '../../../services/categoria.service';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
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
  esModal = false;


  constructor(
    private _categoriaService: CategoriaService,
    private _router: Router,
    @Optional() public activeModal: NgbActiveModal
  ) { 
    //this.token = this._cookieService.get('token');
    this.esModal = !!this.activeModal;
  }

  ngOnInit(): void {
  }

  registrar(registroForm:any) {
        this._categoriaService.crear_categoria(this.categorias).subscribe(
      response=>{
                        if(response == undefined){
                    
        }else{
                    iziToast.show({
            title: 'SUCCESS',
            titleColor: '#008000',
            color: '#FFF',
            class: 'text-success',
            position: 'topRight',
            message: 'La categoría se creó correctamente',
          });

          //redireccionar a la lista de marcas
          if (this.activeModal) {
            this.activeModal.close(true);
          } else {
            this._router.navigate(['/categorias']);
          }

        }
      }
    );
  }

  cancelar(): void {
    if (this.activeModal) {
      this.activeModal.dismiss();
      return;
    }
    this._router.navigate(['/categorias']);
  }
}
