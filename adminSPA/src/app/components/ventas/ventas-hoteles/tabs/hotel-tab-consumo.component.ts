import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IndexVentasComponent } from '../../index-ventas/index-ventas.component';
import { HotelRecepcionTabBase } from '../hotel-recepcion-tab.base';

@Component({
  selector: 'app-hotel-tab-consumo',
  standalone: true,
  imports: [CommonModule, RouterModule, IndexVentasComponent],
  templateUrl: './hotel-tab-consumo.component.html'
})
export class HotelTabConsumoComponent extends HotelRecepcionTabBase {}
