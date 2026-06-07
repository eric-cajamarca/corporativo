import { Injectable } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { CreateProductoComponent } from '../components/productos/create-producto/create-producto.component';

/** Datos devueltos al cerrar el modal tras crear producto (p. ej. para el detalle de movimiento de inventario). */
export interface ProductoCreadoModalResult {
  idProducto: string;
  codigo: string;
  descripcion: string;
  idCategoria?: number;
  idMarca?: number;
  idPresentacion?: number;
  fProduccion?: string;
  /** Cantidad del lote inicial si se registró en el modal */
  cantidadDesdeLote?: number;
  costoUnitario?: number;
  fechaVencimiento?: string;
  numeroLote?: string;
  /** Sucursal elegida al registrar lote inicial (útil para alinear cabecera del movimiento). */
  idSucursalLote?: string;
}

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
   * @returns Datos del producto creado si guardó y cerró; undefined si canceló o cerró sin crear.
   */
  abrir(): Promise<ProductoCreadoModalResult | undefined> {
    const modalRef: NgbModalRef = this.modalService.open(CreateProductoComponent, {
      size: 'xl',
      centered: true,
      backdrop: 'static',
      scrollable: false,
      fullscreen: 'sm',
      modalDialogClass: 'modal-inventario-dialog modal-inventario-dialog--crear'
    });

    return modalRef.result.catch(() => undefined);
  }
}
