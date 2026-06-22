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
  categoria?: string;
  pVenta?: number;
}

export type EstadoReserva =
  | 'confirmada'
  | 'cancelada'
  | 'no_show'
  | 'convertida'
  | 'vigente'
  | 'sin_efecto';

export interface Reserva {
  idReserva: string;
  idEmpresa: string;
  idProductoHabitacion: string;
  idCliente: number | null;
  idEstancia?: string | null;
  codigo: string;
  nombreHuesped: string;
  fechaEntrada: string;
  fechaSalida: string;
  estado: EstadoReserva;
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

export interface ConfiguracionHotel {
  idEmpresa?: string;
  horaCheckIn: string;
  horaCheckOut: string;
  horaCorteDia: string;
  minutosLimpieza: number;
  nochesMinimasWalkIn: number;
  permitirWalkInSinReserva: boolean | number;
  recargoEarlyCheckIn?: number;
  recargoLateCheckOut?: number;
  fActualizacion?: string;
}

export interface Estancia {
  idEstancia: string;
  idEmpresa: string;
  idProductoHabitacion: string;
  idReserva: string | null;
  idCliente: number | null;
  nombreHuesped: string;
  checkIn: string;
  checkOutPrevisto: string;
  checkOutReal: string | null;
  estadoEstancia: 'activa' | 'checkout' | 'cancelada';
  tarifaNoche: number;
  totalHabitacion: number;
  idVenta: number | null;
  habitacionCodigo: string;
  habitacionDescripcion: string;
}

export interface CheckInWalkInPayload {
  idProductoHabitacion: string;
  nombreHuesped: string;
  fechaSalida: string;
  idCliente?: number | null;
  tarifaNoche?: number;
  totalHabitacion?: number;
  pVenta?: number;
}

export interface CheckOutPreloadLinea {
  idProducto: string;
  codigo: string;
  descripcion: string;
  codigoPresentacion?: string;
  marca?: string;
  cantidad: number;
  pVenta: number;
}

export interface CheckOutPreload {
  idEstancia: string;
  idProductoHabitacion: string;
  habitacionCodigo: string;
  habitacionDescripcion: string;
  idCliente: number | null;
  nombreHuesped?: string;
  idReserva: string | null;
  anticiposTotal?: number;
  lineas: CheckOutPreloadLinea[];
}

export type EstadoLimpiezaHotel = 'sucia' | 'en_limpieza' | 'limpia' | 'fuera_servicio';

export interface HotelHousekeepingItem {
  idEmpresa?: string;
  idProductoHabitacion: string;
  estadoLimpieza: EstadoLimpiezaHotel;
  observaciones?: string | null;
  fActualizacion?: string;
  habitacionCodigo?: string;
  habitacionDescripcion?: string;
}

export interface HotelAnticipo {
  idAnticipo: string;
  idEmpresa?: string;
  idReserva?: string | null;
  idEstancia?: string | null;
  monto: number;
  concepto?: string | null;
  idVenta?: number | null;
  estado: 'pendiente' | 'aplicado' | 'anulado';
  fRegistro?: string;
}

export interface HotelReporte {
  fechaDesde: string;
  fechaHasta: string;
  ocupacion: {
    habitaciones: number;
    dias: number;
    nochesOcupadas: number;
    ocupacionPct: number;
    ingresoHabitacion: number;
  };
  consumo: { ingresoConsumo: number; lineasFacturadas: number };
  reservas: {
    cancelaciones: number;
    noShow: number;
    convertidas: number;
    confirmadas: number;
  };
  ingresoTotal: number;
}

export interface HotelHistorialEstanciaResumen extends Estancia {
  totalConsumo: number;
  cantidadConsumos: number;
}

export interface HotelHistorialHabitacion {
  idProductoHabitacion: string;
  habitacionCodigo: string;
  habitacionDescripcion: string;
  anio: number;
  mes: number;
  totalEstancias: number;
  diasOcupados: number;
  fechasOcupadas: string[];
  estancias: HotelHistorialEstanciaResumen[];
}

export interface HotelHistorialConsumoLinea {
  idConsumo: string;
  idProducto: string;
  cantidad: number;
  pUnitario: number;
  estadoConsumo?: string;
  fRegistro?: string;
  productoCodigo?: string;
  productoDescripcion?: string;
}

export interface HotelHistorialEstanciaDetalle {
  estancia: Estancia;
  consumos: HotelHistorialConsumoLinea[];
  totalConsumo: number;
}

export type MotivoBloqueoHotel = 'mantenimiento' | 'admin' | 'housekeeping';

export interface HotelBloqueo {
  idBloqueo: string;
  idProductoHabitacion: string;
  fechaDesde: string;
  fechaHasta: string;
  motivo: MotivoBloqueoHotel;
  observaciones?: string | null;
  habitacionCodigo?: string;
  habitacionDescripcion?: string;
  tipo?: 'bloqueo';
}

export interface HotelCalendarioEvento {
  tipo: 'reserva' | 'estancia' | 'bloqueo';
  idReserva?: string;
  idEstancia?: string;
  idBloqueo?: string;
  idProductoHabitacion: string;
  codigo?: string;
  nombreHuesped?: string;
  fechaEntrada?: string;
  fechaSalida?: string;
  checkIn?: string;
  checkOutPrevisto?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  inicio?: string;
  fin?: string;
  motivo?: string;
  observaciones?: string | null;
  estado?: string;
  total?: number;
  habitacionCodigo?: string;
  habitacionDescripcion?: string;
}

export interface HotelCalendarioData {
  fechaDesde: string;
  fechaHasta: string;
  habitaciones: ProductoHabitacion[];
  eventos: HotelCalendarioEvento[];
}

export interface HotelBloqueoPayload {
  idProductoHabitacion: string;
  fechaDesde: string;
  fechaHasta: string;
  motivo: MotivoBloqueoHotel;
  observaciones?: string | null;
}

@Injectable({ providedIn: 'root' })
export class HotelService {
  private readonly url = environment.API_URL;

  constructor(private http: HttpClient) {}

  getConfiguracion(): Observable<{ data: ConfiguracionHotel }> {
    return this.http.get<{ data: ConfiguracionHotel }>(this.url + 'hotel/configuracion', { withCredentials: true });
  }

  guardarConfiguracion(body: Partial<ConfiguracionHotel>): Observable<{ data: ConfiguracionHotel }> {
    return this.http.put<{ data: ConfiguracionHotel }>(this.url + 'hotel/configuracion', body, { withCredentials: true });
  }

  listarEstanciasActivas(): Observable<{ data: Estancia[] }> {
    return this.http.get<{ data: Estancia[] }>(this.url + 'hotel/estancias/activas', { withCredentials: true });
  }

  checkInWalkIn(body: CheckInWalkInPayload): Observable<{ data: Estancia }> {
    return this.http.post<{ data: Estancia }>(this.url + 'hotel/estancias/check-in', body, { withCredentials: true });
  }

  checkInDesdeReserva(idReserva: string, body?: { tarifaNoche?: number }): Observable<{ data: Estancia }> {
    return this.http.post<{ data: Estancia }>(
      this.url + 'hotel/reservas/' + encodeURIComponent(idReserva) + '/check-in',
      body ?? {},
      { withCredentials: true }
    );
  }

  checkOutPreload(idEstancia: string): Observable<{ data: CheckOutPreload }> {
    return this.http.post<{ data: CheckOutPreload }>(
      this.url + 'hotel/estancias/' + encodeURIComponent(idEstancia) + '/check-out',
      {},
      { withCredentials: true }
    );
  }

  confirmarCheckoutPostVenta(idEstancia: string, idVenta: number): Observable<{ data: { ok: boolean } }> {
    return this.http.post<{ data: { ok: boolean } }>(
      this.url + 'hotel/estancias/' + encodeURIComponent(idEstancia) + '/check-out/confirmar',
      { idVenta },
      { withCredentials: true }
    );
  }

  consultarDisponibilidad(
    idProductoHabitacion: string,
    fechaEntrada: string,
    fechaSalida: string
  ): Observable<{ data: { disponible: boolean; motivo?: string } }> {
    const q =
      '?idProductoHabitacion=' + encodeURIComponent(idProductoHabitacion) +
      '&fechaEntrada=' + encodeURIComponent(fechaEntrada) +
      '&fechaSalida=' + encodeURIComponent(fechaSalida);
    return this.http.get<{ data: { disponible: boolean; motivo?: string } }>(
      this.url + 'hotel/disponibilidad' + q,
      { withCredentials: true }
    );
  }

  getCalendario(fechaDesde: string, fechaHasta: string): Observable<{ data: HotelCalendarioData }> {
    const q =
      '?fechaDesde=' + encodeURIComponent(fechaDesde) +
      '&fechaHasta=' + encodeURIComponent(fechaHasta);
    return this.http.get<{ data: HotelCalendarioData }>(this.url + 'hotel/calendario' + q, { withCredentials: true });
  }

  listarBloqueos(fechaDesde?: string, fechaHasta?: string): Observable<{ data: HotelBloqueo[] }> {
    let q = '';
    if (fechaDesde) q += (q ? '&' : '?') + 'fechaDesde=' + encodeURIComponent(fechaDesde);
    if (fechaHasta) q += (q ? '&' : '?') + 'fechaHasta=' + encodeURIComponent(fechaHasta);
    return this.http.get<{ data: HotelBloqueo[] }>(this.url + 'hotel/bloqueos' + q, { withCredentials: true });
  }

  crearBloqueo(body: HotelBloqueoPayload): Observable<{ data: HotelBloqueo }> {
    return this.http.post<{ data: HotelBloqueo }>(this.url + 'hotel/bloqueos', body, { withCredentials: true });
  }

  eliminarBloqueo(idBloqueo: string): Observable<{ data: { ok: boolean } }> {
    return this.http.delete<{ data: { ok: boolean } }>(
      this.url + 'hotel/bloqueos/' + encodeURIComponent(idBloqueo),
      { withCredentials: true }
    );
  }

  getProductosHabitacion(): Observable<{ data: ProductoHabitacion[] }> {
    return this.http.get<{ data: ProductoHabitacion[] }>(this.url + 'productos/habitaciones', { withCredentials: true });
  }

  listarReservas(filtros?: { estado?: string; idProductoHabitacion?: string }): Observable<{ data: Reserva[] }> {
    let query = '';
    if (filtros?.estado) query += (query ? '&' : '?') + 'estado=' + encodeURIComponent(filtros.estado);
    if (filtros?.idProductoHabitacion) {
      query += (query ? '&' : '?') + 'idProductoHabitacion=' + encodeURIComponent(filtros.idProductoHabitacion);
    }
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

  actualizarReserva(
    id: string,
    body: Partial<ReservaCrearPayload> & { codigo: string; estado: string; total: number }
  ): Observable<{ data: { ok: boolean } }> {
    return this.http.put<{ data: { ok: boolean } }>(this.url + 'reservas/' + id, body, { withCredentials: true });
  }

  cancelarReserva(id: string): Observable<{ data: { ok: boolean } }> {
    return this.http.put<{ data: { ok: boolean } }>(this.url + 'reservas/' + id + '/cancelar', {}, { withCredentials: true });
  }

  eliminarReserva(id: string): Observable<{ data: { ok: boolean } }> {
    return this.http.delete<{ data: { ok: boolean } }>(this.url + 'reservas/' + id, { withCredentials: true });
  }

  listarConsumo(idProductoHabitacion?: string): Observable<{ data: ConsumoHabitacionLinea[] }> {
    const q = idProductoHabitacion ? '?idProductoHabitacion=' + encodeURIComponent(idProductoHabitacion) : '';
    return this.http.get<{ data: ConsumoHabitacionLinea[] }>(this.url + 'consumo-habitacion' + q, { withCredentials: true });
  }

  agregarConsumo(body: {
    idProductoHabitacion: string;
    idProducto: string;
    cantidad: number;
    pUnitario?: number;
    idEstancia?: string;
  }): Observable<{ data: { idConsumo: string } }> {
    return this.http.post<{ data: { idConsumo: string } }>(this.url + 'consumo-habitacion', body, { withCredentials: true });
  }

  actualizarConsumo(idConsumo: string, body: { cantidad: number; pUnitario?: number }): Observable<{ data: { ok: boolean } }> {
    return this.http.patch<{ data: { ok: boolean } }>(this.url + 'consumo-habitacion/' + idConsumo, body, { withCredentials: true });
  }

  eliminarConsumo(idConsumo: string): Observable<{ data: { ok: boolean } }> {
    return this.http.delete<{ data: { ok: boolean } }>(this.url + 'consumo-habitacion/' + idConsumo, { withCredentials: true });
  }

  limpiarConsumoHabitacion(idProductoHabitacion: string): Observable<{ data: { ok: boolean } }> {
    return this.http.delete<{ data: { ok: boolean } }>(
      this.url + 'consumo-habitacion/habitacion/' + idProductoHabitacion,
      { withCredentials: true }
    );
  }

  listarHousekeeping(): Observable<{ data: HotelHousekeepingItem[] }> {
    return this.http.get<{ data: HotelHousekeepingItem[] }>(this.url + 'hotel/housekeeping', { withCredentials: true });
  }

  actualizarHousekeeping(
    idProductoHabitacion: string,
    body: { estadoLimpieza: EstadoLimpiezaHotel; observaciones?: string | null }
  ): Observable<{ data: HotelHousekeepingItem }> {
    return this.http.put<{ data: HotelHousekeepingItem }>(
      this.url + 'hotel/housekeeping/' + encodeURIComponent(idProductoHabitacion),
      body,
      { withCredentials: true }
    );
  }

  listarAnticipos(filtros?: { estado?: string; idReserva?: string; idEstancia?: string }): Observable<{ data: HotelAnticipo[] }> {
    let q = '';
    if (filtros?.estado) q += (q ? '&' : '?') + 'estado=' + encodeURIComponent(filtros.estado);
    if (filtros?.idReserva) q += (q ? '&' : '?') + 'idReserva=' + encodeURIComponent(filtros.idReserva);
    if (filtros?.idEstancia) q += (q ? '&' : '?') + 'idEstancia=' + encodeURIComponent(filtros.idEstancia);
    return this.http.get<{ data: HotelAnticipo[] }>(this.url + 'hotel/anticipos' + q, { withCredentials: true });
  }

  registrarAnticipo(body: {
    idReserva?: string | null;
    idEstancia?: string | null;
    monto: number;
    concepto?: string;
  }): Observable<{ data: { idAnticipo: string; monto: number } }> {
    return this.http.post<{ data: { idAnticipo: string; monto: number } }>(
      this.url + 'hotel/anticipos',
      body,
      { withCredentials: true }
    );
  }

  anularAnticipo(idAnticipo: string): Observable<{ data: { ok: boolean } }> {
    return this.http.put<{ data: { ok: boolean } }>(
      this.url + 'hotel/anticipos/' + encodeURIComponent(idAnticipo) + '/anular',
      {},
      { withCredentials: true }
    );
  }

  getReporteHotel(fechaDesde: string, fechaHasta: string): Observable<{ data: HotelReporte }> {
    const q =
      '?fechaDesde=' + encodeURIComponent(fechaDesde) +
      '&fechaHasta=' + encodeURIComponent(fechaHasta);
    return this.http.get<{ data: HotelReporte }>(this.url + 'hotel/reportes' + q, { withCredentials: true });
  }

  getHistorialHabitacionMes(idProductoHabitacion: string, mes: string): Observable<{ data: HotelHistorialHabitacion }> {
    const q =
      '?idProductoHabitacion=' + encodeURIComponent(idProductoHabitacion) +
      '&mes=' + encodeURIComponent(mes);
    return this.http.get<{ data: HotelHistorialHabitacion }>(
      this.url + 'hotel/reportes/historial-habitacion' + q,
      { withCredentials: true }
    );
  }

  getDetalleEstanciaHistorial(idEstancia: string): Observable<{ data: HotelHistorialEstanciaDetalle }> {
    return this.http.get<{ data: HotelHistorialEstanciaDetalle }>(
      this.url + 'hotel/estancias/' + encodeURIComponent(idEstancia) + '/historial-detalle',
      { withCredentials: true }
    );
  }

  moverReservaCalendario(
    idReserva: string,
    body: { fechaEntrada: string; fechaSalida: string; idProductoHabitacion?: string }
  ): Observable<{ data: Reserva }> {
    return this.http.put<{ data: Reserva }>(
      this.url + 'hotel/reservas/' + encodeURIComponent(idReserva) + '/mover',
      body,
      { withCredentials: true }
    );
  }

  /** Tras facturar desde habitación: limpia consumo y cierra reserva vigente. */
  cerrarPostVenta(body: { idProductoHabitacion: string; idVenta: number; idReserva?: string | null }): Observable<{ data: { ok: boolean } }> {
    return this.http.post<{ data: { ok: boolean } }>(this.url + 'hotel/cerrar-post-venta', body, { withCredentials: true });
  }
}

export interface ConsumoHabitacionLinea {
  idConsumo: string;
  idProductoHabitacion: string;
  idEstancia?: string;
  idProducto: string;
  cantidad: number;
  pUnitario: number;
  estadoConsumo?: string;
  fRegistro?: string;
  productoCodigo: string;
  productoDescripcion: string;
  habitacionDescripcion?: string;
  habitacionCodigo?: string;
}
