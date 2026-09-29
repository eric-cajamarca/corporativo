import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HotelRecepcionTabBase } from '../hotel-recepcion-tab.base';

@Component({
  selector: 'app-hotel-tab-reservas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hotel-tab-reservas.component.html'
})
export class HotelTabReservasComponent extends HotelRecepcionTabBase {}
