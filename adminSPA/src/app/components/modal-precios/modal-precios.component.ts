import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-modal-precios',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-precios.component.html',
  styleUrl: './modal-precios.component.css'
})
export class ModalPreciosComponent {

   @Input() precios: any[] = [];
  @Input() precioActual: number = 0;

  constructor(public activeModal: NgbActiveModal) {}

  /**
   * Selecciona un precio y cierra el modal
   */
  seleccionarPrecio(precio: any) {
    console.log('Precio seleccionado en modal:', precio);
    this.activeModal.close(precio);
  }

  /**
   * Cancela la selección
   */
  cancelar() {
    this.activeModal.dismiss();
  }

  /**
   * Verifica si el precio es el actual
   */
  esPrecioActual(precio: number): boolean {
    return precio === this.precioActual;
  }

}
