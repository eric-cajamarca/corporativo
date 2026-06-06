import { Injectable } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { take } from 'rxjs';
import { BuscadorProductosModalComponent } from '../components/shared/buscador-productos-modal/buscador-productos-modal.component';
import { ProductoSeleccionado } from '../components/shared/buscador-productos-modal/buscador-productos-modal.component';
import { BuscadorProductosModalOpciones } from './buscador-productos-modal.opciones';

/**
 * Servicio para abrir el modal de búsqueda de productos desde cualquier componente.
 * Uso: this.buscadorProductosModal.abrir({ modo: 'venta', venta: { ... } }).then(p => { ... });
 */
@Injectable({
  providedIn: 'root'
})
export class BuscadorProductosModalService {

  constructor(private modalService: NgbModal) {}

  /**
   * Abre el modal de búsqueda de productos.
   * @param opciones Configuración del modal (modo catálogo, compra o venta)
   * @returns Promise que se resuelve con el producto seleccionado o null si se cierra sin elegir
   */
  abrir(opciones?: BuscadorProductosModalOpciones | string): Promise<ProductoSeleccionado | null> {
    const opts: BuscadorProductosModalOpciones =
      typeof opciones === 'string' ? { idSucursal: opciones } : (opciones ?? {});

    const modalRef: NgbModalRef = this.modalService.open(BuscadorProductosModalComponent, {
      size: 'xl',
      centered: false,
      backdrop: 'static',
      scrollable: false,
      fullscreen: 'sm',
      modalDialogClass: 'buscador-productos-ngb-modal buscador-productos-compra-dialog'
    });

    const component = modalRef.componentInstance as BuscadorProductosModalComponent;
    component.modo = opts.modo ?? 'catalogo';
    component.etiquetaPrecio = opts.etiquetaPrecio ?? 'Precio';
    if (opts.idSucursal != null) {
      component.idSucursal = opts.idSucursal;
    }
    if (opts.venta) {
      component.ventaOpciones = opts.venta;
    }

    modalRef.shown.pipe(take(1)).subscribe(() => {
      opts.venta?.onPrecargarCatalogo?.();
      component.enfocarCampoBusqueda();
    });

    return modalRef.result.catch(() => null);
  }
}
