import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HotelRecepcionTabBase } from '../hotel-recepcion-tab.base';

@Component({
  selector: 'app-hotel-tab-calendario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hotel-tab-calendario.component.html'
})
export class HotelTabCalendarioComponent extends HotelRecepcionTabBase {}
