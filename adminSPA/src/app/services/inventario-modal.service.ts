import { Injectable } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { AsignarStockUbicacionComponent } from '../components/inventario/asignar-stock-ubicacion/asignar-stock-ubicacion.component';
import { LoteFormComponent } from '../components/inventario/lote-form/lote-form.component';
import { LoteListComponent } from '../components/inventario/lote-list/lote-list.component';
import { MovimientoUbicacionComponent } from '../components/inventario/movimiento-ubicacion/movimiento-ubicacion.component';
import { UbicacionPrioridadListComponent } from '../components/inventario/ubicacion-prioridad-list/ubicacion-prioridad-list.component';
import { VentaPorPrioridadComponent } from '../components/inventario/venta-por-prioridad/venta-por-prioridad.component';

@Injectable({
  providedIn: 'root'
})
export class InventarioModalService {

  constructor(private modalService: NgbModal) {}

  /**
   * Abre modal para asignar stock a ubicaciones
   */
  abrirAsignarUbicaciones(idLote: string, cantidadTotal: number): Promise<any> {
    const modalRef: NgbModalRef = this.modalService.open(AsignarStockUbicacionComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static'
    });

    const component = modalRef.componentInstance as AsignarStockUbicacionComponent;
    component.idLote = idLote;
    component.cantidadTotal = cantidadTotal;

    return modalRef.result;
  }

  /**
   * Abre modal para crear/editar lote
   */
  abrirLoteForm(idLote?: string, idProducto?: string, idSucursal?: string): Promise<any> {
    const modalRef: NgbModalRef = this.modalService.open(LoteFormComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static'
    });

    const component = modalRef.componentInstance as LoteFormComponent;
    if (idLote) {
      component.idLote = idLote;
      component.isEditMode = true;
    }
    if (idProducto) {
      component.loteForm.patchValue({ idProducto });
    }
    if (idSucursal) {
      component.loteForm.patchValue({ idSucursal });
    }

    return modalRef.result;
  }

  /**
   * Abre modal con lista de lotes
   */
  abrirLoteList(filtros?: any): Promise<any> {
    const modalRef: NgbModalRef = this.modalService.open(LoteListComponent, {
      size: 'xl',
      centered: true,
      backdrop: 'static',
      scrollable: true
    });

    const component = modalRef.componentInstance as LoteListComponent;
    if (filtros) {
      component.filtrosIniciales = filtros;
    }

    return modalRef.result;
  }

  /**
   * Abre modal para movimiento entre ubicaciones
   */
  abrirMovimientoUbicacion(idLote?: string): Promise<any> {
    const modalRef: NgbModalRef = this.modalService.open(MovimientoUbicacionComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static'
    });

    const component = modalRef.componentInstance as MovimientoUbicacionComponent;
    if (idLote) {
      component.movimientoForm.patchValue({ idLote });
      component.onLoteSeleccionado();
    }

    return modalRef.result;
  }

  /**
   * Abre modal para gestionar ubicaciones con prioridad
   */
  abrirUbicacionesPrioridad(idSucursal?: string): Promise<any> {
    const modalRef: NgbModalRef = this.modalService.open(UbicacionPrioridadListComponent, {
      size: 'xl',
      centered: true,
      backdrop: 'static',
      scrollable: true
    });

    const component = modalRef.componentInstance as UbicacionPrioridadListComponent;
    if (idSucursal) {
      component.sucursalFiltro = idSucursal;
    }

    return modalRef.result;
  }

  /**
   * Abre modal para venta por prioridad
   */
  abrirVentaPorPrioridad(idSucursal?: string): Promise<any> {
    const modalRef: NgbModalRef = this.modalService.open(VentaPorPrioridadComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static'
    });

    const component = modalRef.componentInstance as VentaPorPrioridadComponent;
    if (idSucursal) {
      component.ventaForm.patchValue({ idSucursal });
    }

    return modalRef.result;
  }
}
