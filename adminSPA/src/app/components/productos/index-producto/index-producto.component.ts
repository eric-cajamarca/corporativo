import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ComprasService } from '../../../services/compras.service';
import { SucursalService } from '../../../services/sucursal.service';
import { ProductoService } from '../../../services/producto.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';

 declare var iziToast: any;
 declare var bootstrap: any;

@Component({
  selector: 'app-index-producto',
  imports: [FormsModule,RouterModule, CommonModule, TopnavComponent, NgbPagination],
  templateUrl: './index-producto.component.html',
  styleUrl: './index-producto.component.css'
})
export class IndexProductoComponent {

  public productos: Array<any> = [];
  public productos_const: Array<any> = [];
  public token: any = "";
  public filtro = '';
  public load_estado = false;

  // Configuración de paginación
  public page = 1;
  public pageSize = 10;
  public maxSize = 10;
  public rotate = true;
  public boundaryLinks = true;

  constructor(
    
    private _router: Router,
    private _comprasService: ComprasService,
    private _sucursalService: SucursalService,
    private _productoService: ProductoService,
  ) {
   // this.token = this._cookieService.get('token');
  }

  ngOnInit(): void {
    this.initData();

  }

  initData() {
    this._productoService.obtener_productos_todos().subscribe(
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
            message: 'Usted no tiene acceso a compras'
          });
          this._router.navigate(['/']);
        } else {
          this.productos = response.data;
          this.productos_const = response.data;
        }
      },
      error => {
        console.log(error);
      }
    );
  }

  filtrar() {
    if (this.filtro) {
      //
      var term = new RegExp(this.filtro, 'i');
      this.productos = this.productos_const.filter(item => term.test(item.compCompra) || term.test(item.rSocial) || term.test(item.total) || term.test(item.fEmision) || term.test(item.descripcion));
    } else {
      this.productos = this.productos_const;
    }
  }

  consultaidProducto(id: any,) {
    // this.load_estado = true;
    



  }


  set_eliminar(id: any) {
    console.log('aqui set_eliminar', id);
    this._productoService.eliminar_producto(id).subscribe(
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
            message: 'Error al eliminar el producto'
          });
          
        } else {
          this.initData();

          // Cierra el modal manualmente
          const modal = document.getElementById('.modal-backdrop');
          const modalInstance = bootstrap.Modal.getInstance(modal);
          modalInstance?.hide();

          // $('body').removeClass('modal-open');
          // $('.modal-backdrop').remove();
          // //habilitar el scroll en el body en el componente
          // $('body').css('overflow-y', 'auto');

        }
       
      },
      error => {
        console.log(error);
      }
    );




  }

  onPageChange(newPage: number) {
    this.page = newPage;
    // Puedes agregar lógica adicional aquí si necesitas
    // cargar más datos cuando cambia la página
  }

}
