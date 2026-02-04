import { Component, signal, TemplateRef } from '@angular/core';
import { SucursalService } from '../../../services/sucursal.service';
import { FormsModule } from '@angular/forms';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { TopnavComponent } from '../../topnav/topnav.component';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../sidebar/sidebar.component';

declare var bootstrap: any;

@Component({
  selector: 'app-index-sucursal',
  imports: [FormsModule, NgbPagination, TopnavComponent, SidebarComponent, RouterModule, CommonModule],
  templateUrl: './index-sucursal.component.html',
  styleUrl: './index-sucursal.component.css'
})
export class IndexSucursalComponent {

  // Estado del sidebar
  sidebarCollapsed = signal<boolean>(false);
  public sucursales: Array<any> = [];

  public token:any;
  public sucursales_const:any = {};
  public load_estado:any = false;

   // Configuración de paginación
  public page = 1;
  public pageSize = 10;
  public maxSize = 10;
  public rotate = true;
  public boundaryLinks = true;

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
  }

  constructor(
    private _sucursalcervice: SucursalService,
  ) { 
    //this.token = this._cookieService.get('token');
    this.obtenerSucursales();
  }

  ngAfterViewInit(): void {
    var dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
    var dropdownList = dropdownElementList.map(function (dropdownToggleEl) {
      return new bootstrap.Dropdown(dropdownToggleEl);
    });
  }

  ngOnInit(): void {
  }

  obtenerSucursales(){
    this._sucursalcervice.obtener_sucursal_idempresa().subscribe(
      response=>{
        console.log('response: ',response.data);
        this.sucursales = response.data;
        this.sucursales_const = response.data;
        console.log('this.sucursales: ',this.sucursales);
      },
      error=>{
        console.log('error: ',error);
      }
    )
  }

  actualizarEstado(id:any, estado:any){
    console.log('id: ',id);
    console.log('estado: ',estado);

    let Estado = {estado:estado};

    this._sucursalcervice.editar_estado_idsucursal(id, Estado).subscribe(
      response=>{
        console.log('response: ',response);
        this.obtenerSucursales();
      },
      error=>{
        console.log('error: ',error);
      }
    )
  }

  

   onPageChange(newPage: number) {
    this.page = newPage;
    // Puedes agregar lógica adicional aquí si necesitas
    // cargar más datos cuando cambia la página
  }
}
