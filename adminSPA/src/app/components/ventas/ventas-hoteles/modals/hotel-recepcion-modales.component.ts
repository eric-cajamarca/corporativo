import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IndexClientesComponent } from '../../../clientes/index-clientes/index-clientes.component';
import { CreateClientesComponent } from '../../../clientes/create-clientes/create-clientes.component';
import { HotelRecepcionTabBase } from '../hotel-recepcion-tab.base';

@Component({
  selector: 'app-hotel-recepcion-modales',
  standalone: true,
  imports: [CommonModule, FormsModule, IndexClientesComponent, CreateClientesComponent],
  templateUrl: './hotel-recepcion-modales.component.html'
})
export class HotelRecepcionModalesComponent extends HotelRecepcionTabBase {}
