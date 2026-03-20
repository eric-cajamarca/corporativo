import { Component, signal, TemplateRef } from '@angular/core';
import { SucursalService } from '../../../services/sucursal.service';
import { FormsModule } from '@angular/forms';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { TopnavComponent } from '../../topnav/topnav.component';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare var bootstrap: any;

@Component({
  selector: 'app-index-sucursal',
  imports: [FormsModule, NgbPagination, TopnavComponent, SidebarComponent, RouterModule, CommonModule],
  templateUrl: './index-sucursal.component.html',
  styleUrl: './index-sucursal.component.css'
})
export class IndexSucursalComponent {

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

  constructor(
    private _sucursalcervice: SucursalService,
    public sidebarState: SidebarStateService,
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
    this._sucursalcervice.obtener_sucursal_todos().subscribe(
      response=>{
        this.sucursales = response.data || [];
        this.sucursales_const = [...this.sucursales];
        //console.log('sucursales',this.sucursales);
      },
      error=>{
        console.error('Error al cargar sucursales:', error);
      }
    )
  }

  actualizarEstado(id: string, estado: boolean | number): void {
    this.load_estado = true;
    this._sucursalcervice.editar_estado_idsucursal(id, { estado }).subscribe({
      next: () => {
        this.load_estado = false;
        this.obtenerSucursales();
      },
      error: (err) => {
        this.load_estado = false;
        console.error('Error al actualizar estado:', err);
      }
    });
  }

  establecerPrincipal(id: string): void {
    this.load_estado = true;
    this._sucursalcervice.establecer_sucursal_principal(id).subscribe({
      next: () => {
        this.load_estado = false;
        this.obtenerSucursales();
      },
      error: (err) => {
        this.load_estado = false;
        console.error('Error al establecer sucursal principal:', err);
      }
    });
  }

  

   onPageChange(newPage: number) {
    this.page = newPage;
    // Puedes agregar lógica adicional aquí si necesitas
    // cargar más datos cuando cambia la página
  }
}
