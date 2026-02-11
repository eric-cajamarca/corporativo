import { Injectable } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { ProductoDetalleModalComponent } from '../components/productos/producto-detalle-modal/producto-detalle-modal.component';

/**
 * Servicio para abrir el modal de detalle de producto desde cualquier componente.
 * Uso: this.productoDetalleModalService.abrir(idProducto);
 */
@Injectable({
  providedIn: 'root'
})
export class ProductoDetalleModalService {

  constructor(private modalService: NgbModal) {}

  /**
   * Abre el modal de detalle/edición de producto.
   * @param idProducto ID del producto a mostrar/editar
   * @returns Promise que se resuelve al cerrar el modal (con resultado si guardó)
   */
  abrir(idProducto: string): Promise<any> {
    const modalRef: NgbModalRef = this.modalService.open(ProductoDetalleModalComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static',
      scrollable: true
    });

    const component = modalRef.componentInstance as ProductoDetalleModalComponent;
    component.idProducto = idProducto;

    return modalRef.result;
  }
}
