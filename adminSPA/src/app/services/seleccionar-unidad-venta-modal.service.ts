import { Injectable } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import {
  SeleccionarUnidadVentaModalComponent,
  SeleccionUnidadVentaResultado
} from '../components/shared/seleccionar-unidad-venta-modal/seleccionar-unidad-venta-modal.component';
import { ProductoUnidadVentaItem } from '../models/producto-unidad-venta.model';

@Injectable({
  providedIn: 'root'
})
export class SeleccionarUnidadVentaModalService {
  constructor(private modalService: NgbModal) {}

  abrir(params: {
    descripcion: string;
    stockCompra: number | null;
    presentacionCompra: string;
    factorCompraAInterna: number;
    unidadInternaNombre: string;
    unidades: ProductoUnidadVentaItem[];
    usarMatizado?: boolean;
    precioPrincipal?: number;
  }): Promise<SeleccionUnidadVentaResultado | null> {
    const modalRef: NgbModalRef = this.modalService.open(SeleccionarUnidadVentaModalComponent, {
      size: 'md',
      centered: true,
      backdrop: 'static'
    });
    const cmp = modalRef.componentInstance as SeleccionarUnidadVentaModalComponent;
    cmp.descripcion = params.descripcion;
    cmp.stockCompra = params.stockCompra;
    cmp.presentacionCompra = params.presentacionCompra;
    cmp.factorCompraAInterna = params.factorCompraAInterna;
    cmp.unidadInternaNombre = params.unidadInternaNombre;
    cmp.unidades = params.unidades;
    cmp.usarMatizado = !!params.usarMatizado;
    cmp.precioPrincipal = Number(params.precioPrincipal) || 0;
    return modalRef.result.catch(() => null);
  }
}
