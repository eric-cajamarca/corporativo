import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { ProveedoresService } from '../../../services/proveedores.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { RouterModule } from '@angular/router';
import { SidebarStateService } from '../../../services/sidebar-state.service';
declare var iziToast: any;
declare var $: any;


@Component({
  selector: 'app-index-proveedor',
  standalone: true,
  imports: [FormsModule, CommonModule, NgbPaginationModule, RouterModule],
  templateUrl: './index-proveedor.component.html',
  styleUrl: './index-proveedor.component.css',
  host: {
    '[class.modo-selector-host]': 'modoSelector'
  }
})
export class IndexProveedorComponent {
  @Input() modoSelector = false;
  @Output() proveedorElegido = new EventEmitter<Record<string, unknown>>();

  public sidebarState = inject(SidebarStateService);

  public proveedores: Array<any> = [];
    public proveedores_const: Array<any> = [];
    public token: any = "";
  
     // Configuración de paginación
    public page = 1;
    public pageSize = 10;
    public maxSize = 10;
    public rotate = true;
    public boundaryLinks = true;
  
    public filtro = '';
   public load_estado = false;
  
    constructor(
      private _adminService: AdminService,
      private _proveedorService: ProveedoresService
    ) {
      //this.token = this._cookieService.get('token');
    }
  
  
  
  
    ngOnInit(): void {
  
      this.init_data();
  
  
  
    }
  
    onToggleSidebar(collapsed: boolean): void {
      this.sidebarState.setCollapsed(collapsed);
    }
  
    init_data() {
      this.load_estado = true;
      this._proveedorService.obtener_proveedores().subscribe(
        response => {
                              if (response.data == undefined) {
            iziToast.show({
              title: 'ERROR',
              titleColor: '#FF0000',
              color: '#FFF',
              class: 'text-danger',
              position: 'topRight',
              message: 'Usted no tiene acceso a clientes'
            });
            this.load_estado = false;
          } else {
            this.proveedores = response.data;
            this.proveedores_const = response.data;
            this.load_estado = false;
          }
        },
        error => {
                  }
      );
    }
  
  
    filtrar() {
      if (this.filtro && this.filtro.trim()) {
        const term = new RegExp(this.filtro.trim(), 'i');
        this.proveedores = this.proveedores_const.filter(
          (item) =>
            term.test(item.rSocial || '') ||
            term.test(item.apellidos || '') ||
            term.test(item.correo || '') ||
            term.test(item.ruc || '')
        );
      } else {
        this.proveedores = this.proveedores_const;
      }
    }
  
    //aqui se hace el cambio del estado habido y no habido
    // set_state(id: any, condicion: any) {
    //   console.log($);
    //   console.log('id', id);
    //   console.log('condicion', condicion);
    //   this.load_estado = true;
    //   this._clientesService.cambiar_estado_clientes(id, { condicion: condicion }, ).subscribe(
    //     response => {
    //       this.load_estado = false;
    //       //quiero cerrar el modal usando jquery sabiendo que el id="delete-{{item.id}}"
  
    //       $('body').removeClass('modal-open');
    //       $('.modal-backdrop').remove();
    //       //habilitar el scroll en el body en el componente
    //       $('body').css('overflow-y', 'auto');
  
  
    //        this.init_data();
    //     }
    //   );
  
  
    //aqui hago el cambio de estado de activo o inactivo
    set_state(id: any, estado: any) {
  
                  this.load_estado = true;
      this._proveedorService.cambiar_estado_proveedores(id, { estado: estado } ).subscribe(
        response => {
          if (response.data != undefined) {
            this.load_estado = false;
  
            this.init_data();
            //quiero cerrar el modal usando jquery sabiendo que el id="delete-{{item.id}}"
  
            // $('body').removeClass('modal-open');
            // $('.modal-backdrop').remove();
            // //habilitar el scroll en el body en el componente
            // $('body').css('overflow-y', 'auto');
          }
          
        },
        error=>{
                  }
      );
      
  
    }
  
    eliminar(id: any) {
  
        
      this.load_estado = true;
      this._proveedorService.eliminar_direccionProveedor(id).subscribe(
        response => {
                  }
      )
  
      this._proveedorService.eliminar_proveedor(id).subscribe(
        response => {
          this.load_estado = false;
          if (response.data != undefined) {
            iziToast.show({
              title: 'success',
              titleColor: '#00FF00',
              color: '#FFF',
              class: 'text-success',
              position: 'topRight',
              message: 'Cliente eliminado correctamente'
            });
  
            // $('body').removeClass('modal-open');
            // $('.modal-backdrop').remove();
            // //habilitar el scroll en el body en el componente
            // $('body').css('overflow-y', 'auto');
  
  
            this.init_data();
          }
          //quiero cerrar el modal usando jquery sabiendo que el id="delete-{{item.id}}"
  
  
        }
      );
  
  
  
    }
  
    onPageChange(newPage: number) {
      this.page = newPage;
    }

    elegir(proveedor: Record<string, unknown>): void {
      if (!this.modoSelector) return;
      this.proveedorElegido.emit(proveedor);
    }
}
