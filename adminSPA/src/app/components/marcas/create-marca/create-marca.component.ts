import { Component, Optional } from '@angular/core';
import { variosService } from '../../../services/varios.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
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
  esModal = false;


  constructor(
    private _marcaService: variosService,
    private _router: Router,
    @Optional() public activeModal: NgbActiveModal
  ) { 
    //this.token = this._cookieService.get('token');
    this.esModal = !!this.activeModal;
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
          if (this.activeModal) {
            this.activeModal.close(true);
          } else {
            this._router.navigate(['/marcas']);
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
    this._router.navigate(['/marcas']);
  }
}
