import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { variosService } from '../../../services/varios.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';

declare var iziToast: any;
declare var boostrap: any;

@Component({
  selector: 'app-index-marca',
  imports: [FormsModule,RouterModule, CommonModule, TopnavComponent, NgbPagination],
  templateUrl: './index-marca.component.html',
  styleUrl: './index-marca.component.css'
})
export class IndexMarcaComponent {

  public marcas: Array<any> = [];
  public marcas_const: Array<any> = [];
  public prod_Modificar: any = {};
  public load_estado = false;
  public token: any = '';

  // Configuración de paginación
  public page = 1;
  public pageSize = 10;
  public maxSize = 10;
  public rotate = true;
  public boundaryLinks = true;

  
  constructor(
    private _router: Router,
    private _adminService: AdminService,
    private _marcaService: variosService
  ) { 
    //this.token = this._cookieService.get('token');
  }

  ngOnInit(): void {
    this.initData();

  }

  initData() {
    this._marcaService.obtenerMarcas().subscribe(
      response => {
        console.log('response.data');
        console.log(response.data);
        if (response.data == undefined) {
          console.log('No hay datos');
        } else {
          this.marcas = response.data;
          this.marcas_const = response.data;
        }
      },
      error => {
        console.log('Error al obtener marcas');
        console.log(<any>error);
      }
    );
  }

  cambiarEstado(id: any, estado: any) {
    console.log('Cambiar estado de la marca: ', id, estado);
    this._marcaService.editarEstadoMarca(id, estado).subscribe(
      response => {
        console.log('response.data');
        console.log(response.data);
        if (response.data == undefined) {

          console.log('No hay datos');
        } else {
          this.marcas = response.data;
          

          iziToast.show({
            title: 'SUCCESS',
            titleColor: '#008000',
            color: '#FFF',
            class: 'text-success',
            position: 'topRight',
            message: 'El estado de la marca ha sido actualizado correctamente',
          });
          this.initData();
          // $('body').removeClass('modal-open');
          // $('.modal-backdrop').remove();
          // //habilitar el scroll en el body en el componente
          // $('body').css('overflow-y', 'auto');


        }
      },
      error => {
        console.log('Error al obtener marcas');
        //console.log(<any>error);
      }
    );

  }

  seleccionar(id: any) {
    console.log('Seleccionar marca con id: ', id);
    console.log('this.marcas_const', this.marcas_const);
    
    this._marcaService.obtenerMarcaPorId(id).subscribe(
      response => {
        console.log('response.data');
        console.log(response.data);
        if (response.data == undefined) {
          console.log('No hay datos');
        } else {
          
          this.prod_Modificar = response.data[0];
          console.log('this.prod_Modificar');
          console.log(this.prod_Modificar);
          // $('#modalModificar').modal('show');
        }
      },
      error => {
        console.log('Error al obtener marcas');
        console.log(<any>error);
      }
    );
  }

  
  editarMarca(id: number) {
    console.log('Editar marca con id: ', id , this.prod_Modificar);
    this._marcaService.editarMarca(id, this.prod_Modificar).subscribe(
      response=>{
        
        console.log('response.data', response.data);
        if(response.data == undefined){
          console.log('No hay datos');
        }else{
          this.marcas = response.data;
          iziToast.show({
            title: 'SUCCESS',
            titleColor: '#008000',
            color: '#FFF',
            class: 'text-success',
            position: 'topRight',
            message: 'La marca ha sido editada correctamente',
          });
          this.initData();
          // $('#modalModificar').modal('hide');
        }
      
      },
      error => {
        console.log('Error al obtener marcas');
        console.log(<any>error);
      }
    );

  }

  deleteMarca(id: number) {
    console.log('Eliminar marca con id: ', id);
    this._marcaService.editarMarca(id, this.marcas).subscribe(
      response => {
        console.log('response.data');
        console.log(response.data);
        if (response.data == undefined) {
          console.log('No hay datos');
        } else {
          this.marcas = response.data;
          iziToast.show({
            title: 'SUCCESS',
            titleColor: '#008000',
            color: '#FFF',
            class: 'text-success',
            position: 'topRight',
            message: 'La marca ha sido eliminada correctamente',
          });
          this.initData();
        }
      }
    );
  }

  onPageChange(newPage: number) {
    this.page = newPage;
    // Puedes agregar lógica adicional aquí si necesitas
    // cargar más datos cuando cambia la página
  }
}
