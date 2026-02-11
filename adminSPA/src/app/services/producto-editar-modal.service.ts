import { Injectable } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { UpdateProductoComponent } from '../components/productos/update-producto/update-producto.component';

/**
 * Servicio para abrir el modal de edición de producto desde cualquier componente.
 * Uso: this.productoEditarModalService.abrir(idProducto);
 */
@Injectable({
  providedIn: 'root'
})
export class ProductoEditarModalService {

  constructor(private modalService: NgbModal) {}

  /**
   * Abre el modal de edición de producto.
   * @param idProducto ID del producto a editar
   * @returns Promise que se resuelve al cerrar el modal (con true si guardó)
   */
  abrir(idProducto: string): Promise<boolean> {
    const modalRef: NgbModalRef = this.modalService.open(UpdateProductoComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static',
      scrollable: true
    });

    const component = modalRef.componentInstance as UpdateProductoComponent;
    component.idProducto = idProducto;

    return modalRef.result;
  }
}
