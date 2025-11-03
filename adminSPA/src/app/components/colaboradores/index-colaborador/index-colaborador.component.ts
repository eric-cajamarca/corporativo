import { Component } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TopnavComponent } from '../../topnav/topnav.component';
import { CommonModule } from '@angular/common';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';



declare var $: any;
declare var iziToast: any;
declare var bootstrap: any;

@Component({
  selector: 'app-index-colaborador',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule ,TopnavComponent, NgbPagination],
  templateUrl: './index-colaborador.component.html',
  styleUrl: './index-colaborador.component.css'
})
export class IndexColaboradorComponent {

   public clientes: Array<any> = [];
  public clientes_const: Array<any> = [];
  public token: any = "";

  
// Configuración de paginación
  public page = 1;
  public pageSize = 10;
  public maxSize = 0;
  public rotate = true;
  public boundaryLinks = true;


  public filtro = '';
  public colaboradores: Array<any> = [];
  public colaboradores_const: Array<any> = [];

  public load_estado = false;

  constructor(
    private _adminService: AdminService,
    private _router: Router,
    //private _cookieService: CookieService,
  ) {
    //this.token = this._cookieService.get('token');
  }

  ngOnInit(): void {

    this.init_data();
  }

  init_data() {
    this._adminService.getAdmin().subscribe(
      response => {
        console.log('response.data');
        console.log(response.data);
        if (response.data == undefined) {
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: 'Usted no tiene acceso a colaboradores'
          });
          this._router.navigate(['/']);
        } else {
          this.colaboradores = response.data;
          this.colaboradores_const = this.colaboradores;
          console.log(this.colaboradores);
        }

      }
    )


  }

  filtrar() {
    if (this.filtro) {
      //
      var term = new RegExp(this.filtro, 'i');
      this.colaboradores = this.colaboradores_const.filter(item => term.test(item.nombres) || term.test(item.apellidos) || term.test(item.email) || term.test(item.n_doc));
    } else {
      this.colaboradores = this.colaboradores_const;
    }
  }

  set_state(id: any, estado: any) {
    //console.log($);
    console.log('id', id);
    this.load_estado = true;
    this._adminService.cambiar_estado_colaborador_admin(id, { estado: estado }).subscribe(
      response => {
        // Cierra el modal correctamente
        const modalElement = document.getElementById('delete-' + id);
        if (modalElement) {
          const modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
          modalInstance.hide();
        }

        this.load_estado = false;


        this.init_data();
      }
    );



  }



  generateColor(initial: string): string {
    const charCode = initial.charCodeAt(0);
    const colors = ['MediumAquamarine', 'Coral', 'MediumPurple', 'SeaGreen'];
    const index = charCode % 4; // Ajusta el índice para obtener un color de la matriz de colores
    const color = colors[index];
    // console.log('Color generado:', color); 
    // Imprime el color generado en la consola
    return color;
  }

  onPageChange(newPage: number) {
    this.page = newPage;
    // Puedes agregar lógica adicional aquí si necesitas
    // cargar más datos cuando cambia la página
  }
}
