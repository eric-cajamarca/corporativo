import { Component } from '@angular/core';
import { UbicacionPrioridad } from '../../../models/ubicacion-prioridad.model';
import { UbicacionPrioridadService } from '../../../services/ubicacion-prioridad.service';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';

@Component({
  selector: 'app-ubicacion-prioridad-list',
  standalone: true,
  imports: [CommonModule, TopnavComponent],
  templateUrl: './ubicacion-prioridad-list.component.html',
  styleUrl: './ubicacion-prioridad-list.component.css'
})
export class UbicacionPrioridadListComponent {
  // Lista de ubicaciones
  ubicaciones: UbicacionPrioridad[] = [];
  
  // Agrupadas por sucursal para mejor visualización
  ubicacionesPorSucursal: { [key: string]: UbicacionPrioridad[] } = {};
  
  // Bandera de carga
  isLoading = true;

  constructor(private ubicacionService: UbicacionPrioridadService) {}

  ngOnInit(): void {
    this.cargarUbicaciones();
  }

  /**
   * Carga todas las ubicaciones y las agrupa por sucursal
   */
  cargarUbicaciones(): void {
    this.isLoading = true;
    this.ubicacionService.obtener_ubicacionesPrioridad_todos().subscribe({
      next: (data) => {
        this.ubicaciones = data;
        this.agruparPorSucursal();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar ubicaciones', error);
        this.isLoading = false;
      }
    });
  }

  /**
   * Agrupa las ubicaciones por sucursal para mostrar en secciones
   */
  agruparPorSucursal(): void {
    this.ubicacionesPorSucursal = {};
    for (const ubicacion of this.ubicaciones) {
      const key = ubicacion.idSucursal;
      if (!this.ubicacionesPorSucursal[key]) {
        this.ubicacionesPorSucursal[key] = [];
      }
      this.ubicacionesPorSucursal[key].push(ubicacion);
    }
  }

  /**
   * Cambia prioridad de una ubicación (drag & drop)
   */
  actualizarPrioridad(idUbicacion: number, nuevaPrioridad: number): void {
    this.ubicacionService.actualizar_ubicacionPrioridad(idUbicacion, { prioridad: nuevaPrioridad }).subscribe({
      next: () => {
        alert('Prioridad actualizada');
        this.cargarUbicaciones();
      },
      error: (error) => alert('Error: ' + error.message)
    });
  }

  /**
   * Elimina ubicación
   */
  eliminarUbicacion(idUbicacion: number): void {
    if (confirm('¿Eliminar ubicación? Se perderán las asignaciones de stock.')) {
      this.ubicacionService.eliminar_ubicacionPrioridad(idUbicacion).subscribe({
        next: () => {
          alert('Ubicación eliminada');
          this.cargarUbicaciones();
        },
        error: (error) => alert('Error: ' + error.message)
      });
    }
  }

  onPrioridadBlur(id: number, event: Event) {
  const input = event.target as HTMLInputElement;
  this.actualizarPrioridad(id, Number(input.value));
}

}
