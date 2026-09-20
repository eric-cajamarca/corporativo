import { Directive, inject } from '@angular/core';
import { HotelRecepcionState } from './hotel-recepcion.state';

@Directive()
export abstract class HotelRecepcionTabBase {
  readonly h = inject(HotelRecepcionState);
}
