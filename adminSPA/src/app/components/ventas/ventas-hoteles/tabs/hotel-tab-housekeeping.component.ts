import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HotelRecepcionTabBase } from '../hotel-recepcion-tab.base';

@Component({
  selector: 'app-hotel-tab-housekeeping',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hotel-tab-housekeeping.component.html'
})
export class HotelTabHousekeepingComponent extends HotelRecepcionTabBase {}
