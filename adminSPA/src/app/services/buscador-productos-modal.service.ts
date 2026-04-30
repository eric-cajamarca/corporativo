import { Injectable } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { take } from 'rxjs';
import { BuscadorProductosModalComponent } from '../components/shared/buscador-productos-modal/buscador-productos-modal.component';
import { ProductoSeleccionado } from '../components/shared/buscador-productos-modal/buscador-productos-modal.component';

/**
 * Servicio para abrir el modal de búsqueda de productos desde cualquier componente.
 * Uso: this.buscadorProductosModal.abrir(idSucursal).then(p => { if (p) this.agregarProducto(p); });
 */
@Injectable({
  providedIn: 'root'
})
export class BuscadorProductosModalService {

  constructor(private modalService: NgbModal) {}

  /**
   * Abre el modal de búsqueda de productos.
   * @param idSucursal Opcional: filtrar por sucursal
   * @returns Promise que se resuelve con el producto seleccionado o null si se cierra sin elegir
   */
  abrir(idSucursal?: string): Promise<ProductoSeleccionado | null> {
    const modalRef: NgbModalRef = this.modalService.open(BuscadorProductosModalComponent, {
      size: 'xl',
      centered: false,
      backdrop: 'static',
      scrollable: false,
      fullscreen: 'sm',
      modalDialogClass: 'buscador-productos-ngb-modal buscador-productos-compra-dialog'
    });

    const component = modalRef.componentInstance as BuscadorProductosModalComponent;
    if (idSucursal != null) {
      component.idSucursal = idSucursal;
    }

    modalRef.shown.pipe(take(1)).subscribe(() => {
      component.enfocarCampoBusqueda();
    });

    return modalRef.result.catch(() => null);
  }
}
