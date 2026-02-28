import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { IndexVentasComponent } from '../index-ventas/index-ventas.component';

export interface ReservaMock {
  id: number;
  codigo: string;
  huesped: string;
  habitacion: string;
  entrada: string;
  salida: string;
  estado: 'confirmada' | 'en_curso' | 'cancelada' | 'completada';
  total: number;
}

export interface HabitacionMock {
  numero: string;
  tipo: string;
  estado: 'disponible' | 'ocupada' | 'mantenimiento' | 'reservada';
}

@Component({
  selector: 'app-ventas-hoteles',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    SidebarComponent,
    TopnavComponent,
    IndexVentasComponent
  ],
  templateUrl: './ventas-hoteles.component.html',
  styleUrl: './ventas-hoteles.component.css'
})
export class VentasHotelesComponent {
  activeTab = signal<'reservas' | 'habitaciones' | 'consumo'>('reservas');

  reservas: ReservaMock[] = [
    { id: 1, codigo: 'RES-2025-001', huesped: 'Juan Pérez García', habitacion: '101', entrada: '2025-02-25', salida: '2025-02-28', estado: 'en_curso', total: 450 },
    { id: 2, codigo: 'RES-2025-002', huesped: 'María López Soto', habitacion: '205', entrada: '2025-02-26', salida: '2025-03-01', estado: 'confirmada', total: 720 },
    { id: 3, codigo: 'RES-2025-003', huesped: 'Carlos Ramírez', habitacion: '110', entrada: '2025-02-20', salida: '2025-02-23', estado: 'completada', total: 380 },
  ];

  habitaciones: HabitacionMock[] = [
    { numero: '101', tipo: 'Doble estándar', estado: 'ocupada' },
    { numero: '102', tipo: 'Doble estándar', estado: 'disponible' },
    { numero: '103', tipo: 'Simple', estado: 'disponible' },
    { numero: '201', tipo: 'Suite', estado: 'reservada' },
    { numero: '202', tipo: 'Suite', estado: 'disponible' },
    { numero: '205', tipo: 'Suite', estado: 'reservada' },
    { numero: '301', tipo: 'Suite premium', estado: 'mantenimiento' },
    { numero: '302', tipo: 'Suite premium', estado: 'disponible' },
  ];

  constructor(public sidebarState: SidebarStateService) {}

  setTab(tab: 'reservas' | 'habitaciones' | 'consumo'): void {
    this.activeTab.set(tab);
  }

  estadoReservaClass(estado: ReservaMock['estado']): string {
    switch (estado) {
      case 'confirmada': return 'hotel-badge-confirmada';
      case 'en_curso': return 'hotel-badge-en-curso';
      case 'completada': return 'hotel-badge-completada';
      case 'cancelada': return 'hotel-badge-cancelada';
      default: return 'hotel-badge-default';
    }
  }

  estadoReservaLabels: Record<ReservaMock['estado'], string> = {
    confirmada: 'Confirmada',
    en_curso: 'En curso',
    completada: 'Completada',
    cancelada: 'Cancelada'
  };

  estadoHabitacionClass(estado: HabitacionMock['estado']): string {
    switch (estado) {
      case 'disponible': return 'hotel-room-disponible';
      case 'ocupada': return 'hotel-room-ocupada';
      case 'reservada': return 'hotel-room-reservada';
      case 'mantenimiento': return 'hotel-room-mantenimiento';
      default: return 'hotel-room-default';
    }
  }

  estadoHabitacionLabels: Record<HabitacionMock['estado'], string> = {
    disponible: 'Disponible',
    ocupada: 'Ocupada',
    reservada: 'Reservada',
    mantenimiento: 'Mantenimiento'
  };

  formatearMoneda(value: number): string {
    return 'S/ ' + Number(value).toFixed(2);
  }

  get ocupadasCount(): number {
    return this.habitaciones.filter((h) => h.estado === 'ocupada').length;
  }

  get disponiblesCount(): number {
    return this.habitaciones.filter((h) => h.estado === 'disponible').length;
  }
}
