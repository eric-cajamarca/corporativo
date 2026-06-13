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
  idCliente?: number | null;
  idReserva?: string | null;
  /** Primera línea = habitación (1 ud), resto = consumo */
  lineas: PreloadItemVenta[];
}

export interface PendientePostVentaHotel {
  idProductoHabitacion: string;
  idReserva?: string | null;
}

@Injectable({ providedIn: 'root' })
export class HotelPreloadVentaService {
  private preload: PreloadFromHabitacion | null = null;
  private pendientePostVenta: PendientePostVentaHotel | null = null;

  setPreload(data: PreloadFromHabitacion): void {
    this.preload = data;
  }

  getAndClearPreload(): PreloadFromHabitacion | null {
    const p = this.preload;
    if (p) {
      this.pendientePostVenta = {
        idProductoHabitacion: p.idProductoHabitacion,
        idReserva: p.idReserva ?? null
      };
    }
    this.preload = null;
    return p;
  }

  hasPreload(): boolean {
    return this.preload != null && (this.preload.lineas?.length ?? 0) > 0;
  }

  getAndClearPendientePostVenta(): PendientePostVentaHotel | null {
    const p = this.pendientePostVenta;
    this.pendientePostVenta = null;
    return p;
  }

  hasPendientePostVenta(): boolean {
    return this.pendientePostVenta != null;
  }
}
