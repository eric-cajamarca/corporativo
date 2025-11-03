import { Component } from '@angular/core';
import { EmpresaService } from '../../../services/empresa.service';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';

declare var iziToast: any;


@Component({
  selector: 'app-index-empresa',
  standalone: true,
  imports: [FormsModule,RouterModule,CommonModule, TopnavComponent, NgbPagination],
  templateUrl: './index-empresa.component.html',
  styleUrl: './index-empresa.component.css'
})
export class IndexEmpresaComponent {

  public empresas:Array<any> = [];
public empresas_const: Array<any> = []
public token: any = '';
public prod_Modificar: any = {};
public load_estado: any = false;


  // Configuración de paginación
  public page = 1;
  public pageSize = 10;
  public maxSize = 10;
  public rotate = true;
  public boundaryLinks = true;


constructor(
  public _empresaService: EmpresaService,
  public _router: Router,
  
) {
  //this.token = this._cookieService.get('token');
 }



ngOnInit() {
  this.initData();
}

initData() { 
  this._empresaService.getEmpresas().subscribe(
    response => {
      console.log('response', response.data);
      this.empresas = response.data;
      this.empresas_const = response.data;
    },
    error => {
      console.log(error);
    }
  );
}

seleccionar(id:any){}

cambiarEstado(id: any, estado:any) {
  console.log('cambiar estado', id, estado);
  this.load_estado = true;
  this._empresaService.cambiar_estado_empresa(id, estado).subscribe(
    response => {
      console.log('response', response);
      this.load_estado = false;

      if (response.data != undefined) {
        iziToast.show({
          title: 'SUCCESS',
          titleColor: '#006064',
          color: '#FFF',
          class: 'text-success',
          position: 'topRight',
          message: 'Estado cambiado correctamente'
        });

        this.initData();
      }
    },
    error => {
      console.log(error);
    }
  );
}

editarempresas(id: any) {}

 onPageChange(newPage: number) {
    this.page = newPage;
    // Puedes agregar lógica adicional aquí si necesitas
    // cargar más datos cuando cambia la página
  }

}
