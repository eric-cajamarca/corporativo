import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Abre el único modal global de consulta de placa (Topnav).
 * Evita montar un segundo `<app-consultar-placa-modal>` dentro de otros modales,
 * que duplicaba instancias y podía dejar solo la consulta SOAT sin datos de vehículo.
 */
@Injectable({ providedIn: 'root' })
export class ConsultarPlacaModalOpenerService {
  private readonly openRequested = new Subject<void>();
  private readonly cerrado = new Subject<void>();

  readonly openRequested$ = this.openRequested.asObservable();
  readonly cerrado$ = this.cerrado.asObservable();

  solicitarAbrir(): void {
    this.openRequested.next();
  }

  notificarCerrado(): void {
    this.cerrado.next();
  }
}
