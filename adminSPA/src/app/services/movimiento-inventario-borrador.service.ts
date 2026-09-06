import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import {
  MovimientoInventarioBorrador,
  MovimientoInventarioBorradorModo
} from '../interfaces/movimiento-inventario-borrador.interface';

@Injectable({
  providedIn: 'root'
})
export class MovimientoInventarioBorradorService {
  private readonly auth = inject(AuthService);

  private storageKey(modo: MovimientoInventarioBorradorModo): string {
    const idEmpresa = String(this.auth.userData()?.idEmpresa || 'sin-empresa').trim();
    return `movInvBorrador:${modo}:${idEmpresa}`;
  }

  leer(modo: MovimientoInventarioBorradorModo): MovimientoInventarioBorrador | null {
    try {
      const raw = localStorage.getItem(this.storageKey(modo));
      if (!raw) return null;
      const data = JSON.parse(raw) as MovimientoInventarioBorrador;
      if (!data || data.version !== 1 || data.modo !== modo) return null;
      if (!data.cabecera || !Array.isArray(data.filas)) return null;
      return data;
    } catch {
      return null;
    }
  }

  guardar(borrador: MovimientoInventarioBorrador): void {
    try {
      localStorage.setItem(this.storageKey(borrador.modo), JSON.stringify(borrador));
    } catch {
      /* quota o modo privado */
    }
  }

  limpiar(modo: MovimientoInventarioBorradorModo): void {
    try {
      localStorage.removeItem(this.storageKey(modo));
    } catch {
      /* ignore */
    }
  }

  /** true si hay al menos un producto o datos de cabecera útiles. */
  tieneContenidoUtil(borrador: Pick<MovimientoInventarioBorrador, 'cabecera' | 'filas'>): boolean {
    const c = borrador.cabecera;
    if (c?.tipoMovimiento || c?.idSucursal || c?.idSucursalDestino || c?.observaciones?.trim()) {
      return true;
    }
    return (borrador.filas || []).some((f) => String(f?.idProducto || '').trim() !== '');
  }
}
