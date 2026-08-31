import { Injectable } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { ProductoUnidadesMedidaModalComponent } from '../components/productos/producto-unidades-medida-modal/producto-unidades-medida-modal.component';

@Injectable({
  providedIn: 'root'
})
export class ProductoUnidadesMedidaModalService {
  constructor(private modalService: NgbModal) {}

  abrir(idProducto: string, etiquetaProducto = '', nombrePresentacion = '', precioPrincipal = 0): Promise<boolean> {
    const modalRef: NgbModalRef = this.modalService.open(ProductoUnidadesMedidaModalComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static',
      scrollable: true
    });
    const component = modalRef.componentInstance as ProductoUnidadesMedidaModalComponent;
    component.idProducto = idProducto;
    component.etiquetaProducto = etiquetaProducto;
    if (nombrePresentacion) {
      component.nombrePresentacion = nombrePresentacion;
    }
    component.precioPrincipal = Number(precioPrincipal) || 0;
    return modalRef.result;
  }
}
