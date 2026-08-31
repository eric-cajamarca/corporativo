import { Injectable } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { MatizadoPinturaModalComponent } from '../components/shared/matizado-pintura-modal/matizado-pintura-modal.component';
import { MatizadoLineaPayload } from '../models/formula-matizado.model';

@Injectable({
  providedIn: 'root'
})
export class MatizadoPinturaModalService {
  constructor(private modalService: NgbModal) {}

  abrir(params: {
    descripcionBase: string;
    idProductoBase: string;
    factorEscala: number;
    presentacionCompra: string;
    cargoMatizado: number;
    idSucursal?: string;
  }): Promise<MatizadoLineaPayload | null> {
    const modalRef: NgbModalRef = this.modalService.open(MatizadoPinturaModalComponent, {
      size: 'lg',
      centered: true,
      backdrop: 'static'
    });
    const cmp = modalRef.componentInstance as MatizadoPinturaModalComponent;
    cmp.descripcionBase = params.descripcionBase;
    cmp.idProductoBase = params.idProductoBase;
    cmp.factorEscala = params.factorEscala;
    cmp.presentacionCompra = params.presentacionCompra;
    cmp.cargoMatizado = params.cargoMatizado;
    cmp.idSucursal = params.idSucursal || '';
    return modalRef.result.catch(() => null);
  }
}
