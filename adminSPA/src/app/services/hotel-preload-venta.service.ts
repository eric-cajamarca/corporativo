import { Injectable } from '@angular/core';

/** Item para prellenar el carrito de create-ventas desde consumo habitación */
export interface PreloadItemVenta {
  idProducto: string;
  codigo: string;
  descripcion: string;
  codigoPresentacion?: string;
  cantidad: number;
  pVenta: number;
}

export interface PreloadFromHabitacion {
  idProductoHabitacion: string;
  habitacionCodigo: string;
  habitacionDescripcion: string;
  /** Primera línea = habitación (1 ud), resto = consumo */
  lineas: PreloadItemVenta[];
}

@Injectable({ providedIn: 'root' })
export class HotelPreloadVentaService {
  private preload: PreloadFromHabitacion | null = null;

  setPreload(data: PreloadFromHabitacion): void {
    this.preload = data;
  }

  getAndClearPreload(): PreloadFromHabitacion | null {
    const p = this.preload;
    this.preload = null;
    return p;
  }

  hasPreload(): boolean {
    return this.preload != null && (this.preload.lineas?.length ?? 0) > 0;
  }
}
