import { Injectable } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { CreateProductoComponent } from '../components/productos/create-producto/create-producto.component';

/**
 * Servicio para abrir el modal de creación de producto desde cualquier componente.
 * Registra un producto con todos sus datos relacionados (lote inicial y precio si se indican).
 */
@Injectable({
  providedIn: 'root'
})
export class ProductoCrearModalService {

  constructor(private modalService: NgbModal) {}

  /**
   * Abre el modal para crear un nuevo producto.
   * @returns Promise que se resuelve al cerrar (true si guardó, dismiss si canceló)
   */
  abrir(): Promise<boolean> {
    const modalRef: NgbModalRef = this.modalService.open(CreateProductoComponent, {
      size: 'xl',
      centered: true,
      backdrop: 'static',
      scrollable: true
    });

    return modalRef.result;
  }
}
