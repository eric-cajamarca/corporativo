import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

/** Producto del catálogo con presentación Servicios (ZZ) = habitación */
export interface ProductoHabitacion {
  idProducto: string;
  codigo: string;
  descripcion: string;
  codigoPresentacion: string;
}

export interface Reserva {
  idReserva: string;
  idEmpresa: string;
  idProductoHabitacion: string;
  idCliente: number | null;
  codigo: string;
  nombreHuesped: string;
  fechaEntrada: string;
  fechaSalida: string;
  estado: 'vigente' | 'sin_efecto';
  total: number;
  observaciones: string | null;
  fRegistro?: string;
  habitacionDescripcion: string;
  habitacionCodigo: string;
}

export interface ReservaCrearPayload {
  idProductoHabitacion: string;
  idCliente?: number | null;
  codigo?: string;
  nombreHuesped: string;
  fechaEntrada: string;
  fechaSalida: string;
  estado?: string;
  total?: number;
  observaciones?: string | null;
}

@Injectable({ providedIn: 'root' })
export class HotelService {
  private readonly url = environment.API_URL;

  constructor(private http: HttpClient) {}

  /** Productos con presentación ZZ (habitaciones) para select en reserva */
  getProductosHabitacion(): Observable<{ data: ProductoHabitacion[] }> {
    return this.http.get<{ data: ProductoHabitacion[] }>(this.url + 'productos/habitaciones', { withCredentials: true });
  }

  listarReservas(filtros?: { estado?: string; idProductoHabitacion?: string }): Observable<{ data: Reserva[] }> {
    let query = '';
    if (filtros?.estado) query += (query ? '&' : '?') + 'estado=' + encodeURIComponent(filtros.estado);
    if (filtros?.idProductoHabitacion) query += (query ? '&' : '?') + 'idProductoHabitacion=' + encodeURIComponent(filtros.idProductoHabitacion);
    return this.http.get<{ data: Reserva[] }>(this.url + 'reservas' + query, { withCredentials: true });
  }

  obtenerReserva(id: string): Observable<{ data: Reserva }> {
    return this.http.get<{ data: Reserva }>(this.url + 'reservas/' + id, { withCredentials: true });
  }

  siguienteCodigoReserva(): Observable<{ data: { codigo: string } }> {
    return this.http.get<{ data: { codigo: string } }>(this.url + 'reservas/siguiente-codigo', { withCredentials: true });
  }

  crearReserva(body: ReservaCrearPayload): Observable<{ data: { idReserva: string; codigo: string } }> {
    return this.http.post<{ data: { idReserva: string; codigo: string } }>(this.url + 'reservas', body, { withCredentials: true });
  }

  actualizarReserva(id: string, body: Partial<ReservaCrearPayload> & { codigo: string; estado: string; total: number }): Observable<{ data: { ok: boolean } }> {
    return this.http.put<{ data: { ok: boolean } }>(this.url + 'reservas/' + id, body, { withCredentials: true });
  }

  eliminarReserva(id: string): Observable<{ data: { ok: boolean } }> {
    return this.http.delete<{ data: { ok: boolean } }>(this.url + 'reservas/' + id, { withCredentials: true });
  }

  /** Consumo registrado por habitación (sin generar venta aún) */
  listarConsumo(idProductoHabitacion?: string): Observable<{ data: ConsumoHabitacionLinea[] }> {
    const q = idProductoHabitacion ? '?idProductoHabitacion=' + encodeURIComponent(idProductoHabitacion) : '';
    return this.http.get<{ data: ConsumoHabitacionLinea[] }>(this.url + 'consumo-habitacion' + q, { withCredentials: true });
  }

  agregarConsumo(body: { idProductoHabitacion: string; idProducto: string; cantidad: number; pUnitario?: number }): Observable<{ data: { idConsumo: string } }> {
    return this.http.post<{ data: { idConsumo: string } }>(this.url + 'consumo-habitacion', body, { withCredentials: true });
  }

  actualizarConsumo(idConsumo: string, body: { cantidad: number; pUnitario?: number }): Observable<{ data: { ok: boolean } }> {
    return this.http.patch<{ data: { ok: boolean } }>(this.url + 'consumo-habitacion/' + idConsumo, body, { withCredentials: true });
  }

  eliminarConsumo(idConsumo: string): Observable<{ data: { ok: boolean } }> {
    return this.http.delete<{ data: { ok: boolean } }>(this.url + 'consumo-habitacion/' + idConsumo, { withCredentials: true });
  }

  limpiarConsumoHabitacion(idProductoHabitacion: string): Observable<{ data: { ok: boolean } }> {
    return this.http.delete<{ data: { ok: boolean } }>(this.url + 'consumo-habitacion/habitacion/' + idProductoHabitacion, { withCredentials: true });
  }
}

export interface ConsumoHabitacionLinea {
  idConsumo: string;
  idProductoHabitacion: string;
  idProducto: string;
  cantidad: number;
  pUnitario: number;
  fRegistro?: string;
  productoCodigo: string;
  productoDescripcion: string;
  habitacionDescripcion?: string;
  habitacionCodigo?: string;
}
