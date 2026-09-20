import { Injectable } from '@angular/core';
import type { TipoLineaCheckoutHotel } from './hotel.service';

/** Item para prellenar el carrito de create-ventas desde consumo habitación */
export interface PreloadItemVenta {
  idProducto: string;
  codigo: string;
  descripcion: string;
  codigoPresentacion?: string;
  marca?: string;
  cantidad: number;
  pVenta: number;
  tipo?: TipoLineaCheckoutHotel;
  idConsumo?: string | null;
}

export interface PreloadFromHabitacion {
  idEstancia?: string;
  idGrupo?: string;
  idProductoHabitacion: string;
  habitacionCodigo: string;
  habitacionDescripcion: string;
  idCliente?: number | null;
  nombreHuesped?: string;
  idReserva?: string | null;
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
