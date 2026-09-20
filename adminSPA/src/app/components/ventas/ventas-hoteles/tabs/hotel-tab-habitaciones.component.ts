import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HotelRecepcionTabBase } from '../hotel-recepcion-tab.base';

@Component({
  selector: 'app-hotel-tab-habitaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hotel-tab-habitaciones.component.html'
})
export class HotelTabHabitacionesComponent extends HotelRecepcionTabBase {}
