import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { HotelService, type ConfiguracionHotel } from '../../../services/hotel.service';

declare var iziToast: { success: (o: object) => void; error: (o: object) => void };

@Component({
  selector: 'app-hotel-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent],
  templateUrl: './hotel-configuracion.component.html',
  styleUrl: './hotel-configuracion.component.css'
})
export class HotelConfiguracionComponent implements OnInit {
  private hotelService = inject(HotelService);
  sidebarState = inject(SidebarStateService);

  loading = true;
  guardando = false;
  errorMessage: string | null = null;

  form: ConfiguracionHotel = {
    horaCheckIn: '14:00:00',
    horaCheckOut: '11:00:00',
    horaCorteDia: '11:00:00',
    minutosLimpieza: 30,
    nochesMinimasWalkIn: 1,
    permitirWalkInSinReserva: true,
    recargoEarlyCheckIn: 0,
    recargoLateCheckOut: 0
  };

  ngOnInit(): void {
    this.hotelService.getConfiguracion().subscribe({
      next: (res) => {
        if (res.data) {
          this.form = { ...this.form, ...res.data };
        }
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Error al cargar configuración';
        this.loading = false;
      }
    });
  }

  guardar(): void {
    this.guardando = true;
    this.errorMessage = null;
    this.hotelService.guardarConfiguracion(this.form).subscribe({
      next: (res) => {
        this.form = { ...this.form, ...res.data };
        this.guardando = false;
        iziToast.success({ title: 'OK', message: 'Configuración guardada.', position: 'topRight' });
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Error al guardar';
        this.guardando = false;
      }
    });
  }
}
