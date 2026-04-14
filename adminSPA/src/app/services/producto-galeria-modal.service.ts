import { Injectable } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { ProductoGaleriaModalComponent } from '../components/productos/producto-galeria-modal/producto-galeria-modal.component';

@Injectable({
  providedIn: 'root'
})
export class ProductoGaleriaModalService {
  constructor(private modalService: NgbModal) {}

  /**
   * Abre el modal de galería (máx. 5 imágenes, portada).
   * @param idProducto ID del producto
   * @param etiquetaProducto Texto opcional (ej. código — descripción)
   */
  abrir(idProducto: string, etiquetaProducto?: string): Promise<boolean> {
    const modalRef: NgbModalRef = this.modalService.open(ProductoGaleriaModalComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static',
      scrollable: true
    });
    const c = modalRef.componentInstance as ProductoGaleriaModalComponent;
    c.idProducto = idProducto;
    c.etiquetaProducto = etiquetaProducto || '';
    return modalRef.result;
  }
}
