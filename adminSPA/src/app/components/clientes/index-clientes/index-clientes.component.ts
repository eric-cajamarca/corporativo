import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { ClienteService } from '../../../services/cliente.service';
import { ClienteEditarModalService } from '../../../services/cliente-editar-modal.service';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';

declare var iziToast: any;
@Component({
  selector: 'app-index-clientes',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule, NgbPagination, TopnavComponent, SidebarComponent],
  templateUrl: './index-clientes.component.html',
  styleUrl: './index-clientes.component.css'
})
export class IndexClientesComponent {
  @Input() modoSelector = false;   // true  → dentro de modal (sin sidebar)
  @Output() clienteElegido: EventEmitter<any> = new EventEmitter<any>();

  public clientes: Array<any> = [];
  public token: any = "";

   // Configuración de paginación
  public page = 1;
  public pageSize = 10;
  totalClientes = 0;
  public maxSize = 10;
  public rotate = true;
  public boundaryLinks = true;

  public filtro = '';
 public load_estado = false;

  constructor(
    private _adminService: AdminService,
    private _clientesService: ClienteService,
    private clienteEditarModal: ClienteEditarModalService,
    public sidebarState: SidebarStateService
  ) {}

  abrirEditarClienteModal(idCliente: string | number): void {
    this.clienteEditarModal.abrir(idCliente).then(() => this.init_data());
  }




  ngOnInit(): void {

    this.init_data();



  }

  init_data(pagina = 1) {
    this.load_estado = true;
    this.page = pagina;
    this._clientesService.obtenerClientesPaginado({
      pagina,
      porPagina: this.pageSize,
      buscar: (this.filtro || '').trim() || undefined
    }).subscribe(
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
          this.clientes = response.data;
          this.totalClientes = response.total ?? 0;
          this.load_estado = false;
        }
      },
      error => {
        this.load_estado = false;
      }
    );
  }

  filtrar() {
    this.init_data(1);
  }

  onPageChange(pagina: number): void {
    this.init_data(pagina);
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
    this._clientesService.cambiar_estado_clientes(id, { estado: estado } ).subscribe(
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
    this._clientesService.eliminar_direccionCliente(id).subscribe(
      response => {
              }
    )

    this._clientesService.eliminar_cliente(id).subscribe(
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

  elegir(cliente: any): void {
    this.clienteElegido.emit(cliente);
      }
}
