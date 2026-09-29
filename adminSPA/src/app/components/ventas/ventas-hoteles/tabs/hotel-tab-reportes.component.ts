import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HotelRecepcionTabBase } from '../hotel-recepcion-tab.base';

@Component({
  selector: 'app-hotel-tab-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hotel-tab-reportes.component.html'
})
export class HotelTabReportesComponent extends HotelRecepcionTabBase {}
