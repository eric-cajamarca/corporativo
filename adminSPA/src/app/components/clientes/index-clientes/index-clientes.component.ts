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
  public clienteSearch: Array<any> = [];
  public clientes_const: Array<any> = [];
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

  init_data() {
    this.load_estado = true;
    this._clientesService.obtener_clientes().subscribe(
      response => {
        console.log('response.data');
        console.log(response);

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
          this.clientes_const = response.data;
          this.load_estado = false;
          console.log(this.clientes)
        }
      },
      error => {
        console.log('error', error);
      }
    );
  }


  filtrar() {
    if (this.filtro && this.filtro.trim()) {
      const term = new RegExp(this.filtro.trim(), 'i');
      this.clientes = this.clientes_const.filter(item =>
        term.test(item.rSocial || '') || term.test(item.apellidos || '') || term.test(item.correo || '') || term.test(item.ruc || '')
      );
    } else {
      this.clientes = this.clientes_const;
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

    console.log('id', id);
    console.log('condicion', estado);
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
        console.log('error',error);
      }
    );
    

  }

  eliminar(id: any) {

    console.log('id', id);

    this.load_estado = true;
    this._clientesService.eliminar_direccionCliente(id).subscribe(
      response => {
        console.log('response.data', response.data);
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

  onPageChange(newPage: number) {
    this.page = newPage;
    // Puedes agregar lógica adicional aquí si necesitas
    // cargar más datos cuando cambia la página
  }

  elegir(cliente: any): void {
    this.clienteElegido.emit(cliente);
    console.log('Cliente elegido:', cliente);
  }
}
