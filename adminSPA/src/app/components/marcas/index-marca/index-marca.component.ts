import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { variosService } from '../../../services/varios.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare var iziToast: any;
declare var boostrap: any;

@Component({
  selector: 'app-index-marca',
  standalone: true,
  imports: [FormsModule,RouterModule, CommonModule, NgbPagination],
  templateUrl: './index-marca.component.html',
  styleUrl: './index-marca.component.css'
})
export class IndexMarcaComponent {
  public sidebarState = inject(SidebarStateService);

  public marcas: Array<any> = [];
  public marcas_const: Array<any> = [];
  public prod_Modificar: any = {};
  public load_estado = false;
  public token: any = '';
  public filtro = '';

  // Configuración de paginación
  public page = 1;
  public readonly pageSize = 10;

  
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
                        if (response.data == undefined) {
                  } else {
          this.marcas_const = response.data;
          this.filtrar();
        }
      },
      error => {
                      }
    );
  }

  filtrar(): void {
    const texto = String(this.filtro || '').trim();
    if (texto) {
      const term = new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      this.marcas = this.marcas_const.filter(
        (item) =>
          term.test(String(item.nombre || '')) ||
          term.test(String(item.descripcion || '')) ||
          term.test(String(item.contacto || '')) ||
          term.test(String(item.paginaWeb || ''))
      );
    } else {
      this.marcas = [...this.marcas_const];
    }
    this.page = 1;
  }

  cambiarEstado(id: any, estado: any) {
        this._marcaService.editarEstadoMarca(id, estado).subscribe(
      response => {
                        if (response.data == undefined) {

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
                //console.log(<any>error);
      }
    );

  }

  seleccionar(id: any) {
            
    this._marcaService.obtenerMarcaPorId(id).subscribe(
      response => {
                        if (response.data == undefined) {
                  } else {
          
          this.prod_Modificar = response.data[0];
                              // $('#modalModificar').modal('show');
        }
      },
      error => {
                      }
    );
  }

  
  editarMarca(id: number) {
        this._marcaService.editarMarca(id, this.prod_Modificar).subscribe(
      response=>{
        
                if(response.data == undefined){
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
                      }
    );

  }

  deleteMarca(id: number) {
        this._marcaService.editarMarca(id, this.marcas).subscribe(
      response => {
                        if (response.data == undefined) {
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

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
