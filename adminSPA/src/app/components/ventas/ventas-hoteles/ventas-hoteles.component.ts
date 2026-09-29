import { Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HotelRecepcionState } from './hotel-recepcion.state';
import { HotelTabCalendarioComponent } from './tabs/hotel-tab-calendario.component';
import { HotelTabReservasComponent } from './tabs/hotel-tab-reservas.component';
import { HotelTabHabitacionesComponent } from './tabs/hotel-tab-habitaciones.component';
import { HotelTabConsumoComponent } from './tabs/hotel-tab-consumo.component';
import { HotelTabHousekeepingComponent } from './tabs/hotel-tab-housekeeping.component';
import { HotelTabReportesComponent } from './tabs/hotel-tab-reportes.component';
import { HotelRecepcionModalesComponent } from './modals/hotel-recepcion-modales.component';

@Component({
  selector: 'app-ventas-hoteles',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HotelTabCalendarioComponent,
    HotelTabReservasComponent,
    HotelTabHabitacionesComponent,
    HotelTabConsumoComponent,
    HotelTabHousekeepingComponent,
    HotelTabReportesComponent,
    HotelRecepcionModalesComponent
  ],
  providers: [HotelRecepcionState],
  templateUrl: './ventas-hoteles.component.html',
  styleUrl: './ventas-hoteles.component.css',
  encapsulation: ViewEncapsulation.None
})
export class VentasHotelesComponent implements OnInit {
  readonly h = inject(HotelRecepcionState);

  ngOnInit(): void {
    this.h.ngOnInit();
  }
}
