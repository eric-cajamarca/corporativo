import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { CategoriaService } from '../../../services/categoria.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare var iziToast: any;
declare var bootstrap: any;

@Component({
  selector: 'app-index-categoria',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule, TopnavComponent,SidebarComponent, NgbPagination],
  templateUrl: './index-categoria.component.html',
  styleUrl: './index-categoria.component.css'
})
export class IndexCategoriaComponent {
  public sidebarState = inject(SidebarStateService);

  public categorias: Array<any> = [];
  public categorias_const: Array<any> = [];
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
    private _categoriaService: CategoriaService,
  ) { 
    //this.token = this._cookieService.get('token');
  }

  ngAfterViewInit(): void {
    var dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
    var dropdownList = dropdownElementList.map(function (dropdownToggleEl) {
      return new bootstrap.Dropdown(dropdownToggleEl);
    });
  }

  ngOnInit(): void {
    this.initData();

  }

  initData() {
    this._categoriaService.obtener_categorias().subscribe(
      response => {
                        if (response.data == undefined) {
                  } else {
          this.categorias_const = response.data;
          this.filtrar();
        }
      },
      error => {
                      }
    );
  }

  cambiarEstado(id: any, estado: any) {
        this._categoriaService.cambiar_estado_categoria(id, estado).subscribe(
      response => {
                        if (response.data == undefined) {

                  } else {
          this.categorias = response.data;
          

          iziToast.show({
            title: 'SUCCESS',
            titleColor: '#008000',
            color: '#FFF',
            class: 'text-success',
            position: 'topRight',
            message: 'El estado de la categoría ha sido actualizado correctamente',
          });
          this.initData();
          
        }
      },
      error => {
                //console.log(<any>error);
      }
    );

  }

  filtrar(): void {
    const texto = String(this.filtro || '').trim();
    if (texto) {
      const term = new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      this.categorias = this.categorias_const.filter(
        (item) =>
          term.test(String(item.nombre || '')) ||
          term.test(String(item.descripcion || ''))
      );
    } else {
      this.categorias = [...this.categorias_const];
    }
    this.page = 1;
  }

  seleccionar(id: any) {
        
    // //quiero buscar el id en el array de categorias y extraer el objeto
    // const idEncontrado = this.categorias_const.filter((item: any) => item.idCategoria == id);
    // this.prod_Modificar = idEncontrado[0];
    // console.log('this.prod_Modificar', this.prod_Modificar);
    
    

    this._categoriaService.obtener_categoria_id(id, this.token).subscribe(
      response => {
                        if (response.data == undefined) {
                  } else {
          
          this.prod_Modificar = response.data[0];
          // console.log('this.prod_Modificar');
          // console.log(this.prod_Modificar);
          // $('#modalModificar').modal('show');
        }
      },
      error => {
                      }
    );


  }

  
  editarCategorias(id: number) {
        this._categoriaService.editar_categoria(this.prod_Modificar.idCategoria, this.prod_Modificar).subscribe(
      response=>{
        
                if(response.data == undefined){
                  }else{
          this.categorias = response.data;
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
        this._categoriaService.editar_categoria(id, this.categorias).subscribe(
      response => {
                        if (response.data == undefined) {
                  } else {
          this.categorias = response.data;
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
