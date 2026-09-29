import { Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { LineaRecetaVenta, RecetaVentaPayload } from '../models/receta-venta.model';
import { RecetaVentaModalComponent } from '../components/ventas/receta-venta-modal/receta-venta-modal.component';

@Injectable({ providedIn: 'root' })
export class RecetaVentaModalService {
  constructor(private modalService: NgbModal) {}

  abrir(lineas: LineaRecetaVenta[]): Promise<RecetaVentaPayload | null> {
    const ref = this.modalService.open(RecetaVentaModalComponent, {
      size: 'lg',
      backdrop: 'static',
      centered: true
    });
    const cmp = ref.componentInstance as RecetaVentaModalComponent;
    cmp.lineas = lineas || [];
    return ref.result.then(
      (r: RecetaVentaPayload) => r || null,
      () => null
    );
  }
}
