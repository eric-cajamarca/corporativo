import { Injectable } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { UpdateClientesComponent } from '../components/clientes/update-clientes/update-clientes.component';

/**
 * Servicio para abrir el modal de edición de cliente desde cualquier componente.
 * Uso: this.clienteEditarModalService.abrir(idCliente);
 */
@Injectable({
  providedIn: 'root'
})
export class ClienteEditarModalService {

  constructor(private ngbModal: NgbModal) {}

  /**
   * Abre el modal de edición de cliente.
   * @param idCliente ID del cliente a editar
   * @returns Promise que se resuelve al cerrar el modal
   */
  abrir(idCliente: string | number): Promise<void> {
    const modalRef: NgbModalRef = this.ngbModal.open(UpdateClientesComponent, {
      size: 'xl',
      centered: true,
      backdrop: 'static',
      scrollable: true
    });

    const comp = modalRef.componentInstance as UpdateClientesComponent;
    comp.modoModal = true;
    comp.idClienteModal = idCliente;
    comp.cargarClientePorId(idCliente);

    comp.cerrar.subscribe(() => modalRef.close());

    return modalRef.result.catch(() => undefined);
  }
}
