import { Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { from, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModalService {


  constructor(private ngbModal: NgbModal) {}

  /**
   * Abre un componente en un modal y retorna un Observable
   * @param component Componente a mostrar
   * @param config Configuración del modal (size, centered, etc.)
   * @param data Datos a pasar al componente (opcional)
   */
  open<T>(component: any, config?: any, data?: any): Observable<T> {
    const modalRef = this.ngbModal.open(component, {
      centered: true,
      backdrop: 'static',
      size: 'sm',
      ...config
    });
    
    // Pasar datos al componente del modal
    if (data) {
      Object.keys(data).forEach(key => {
        modalRef.componentInstance[key] = data[key];
      });
    }
    
    return from(modalRef.result);
  }


  
}
