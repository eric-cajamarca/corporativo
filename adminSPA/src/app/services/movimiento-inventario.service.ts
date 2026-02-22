import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TipoMovimientoItem {
  codigo: string;
  descripcion: string;
}

export interface ItemMovimiento {
  idProducto: string;
  cantidad: number;
  costoUnitario?: number;
  fechaVencimiento?: string | null;
  numeroLote?: string | null;
}

export interface MovimientoRequest {
  tipoMovimiento: string;
  idSucursal: string;
  fechaMovimiento?: string;
  docRelacionado?: string;
  observaciones?: string;
  items: ItemMovimiento[];
}

export interface MovimientoListItem {
  idMovimiento: number;
  idSucursal: string;
  sucursal: string;
  tipoMovimiento: string;
  docRelacionado: string | null;
  fMovimiento: string;
  observaciones: string | null;
  usuario: string;
  totalProductos: number;
  totalCantidad: number;
}

export interface MovimientoDetalle {
  idMovimiento: number;
  idSucursal: string;
  sucursal: string;
  tipoMovimiento: string;
  docRelacionado: string | null;
  fMovimiento: string;
  observaciones: string | null;
  usuario: string;
  idProducto?: string;
  cantidad?: number;
  costoUnitario?: number;
  productoCodigo?: string;
  productoDescripcion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MovimientoInventarioService {
  private readonly baseUrl = environment.API_URL + 'inventario/';

  constructor(private http: HttpClient) {}

  obtenerTiposMovimiento(): Observable<TipoMovimientoItem[]> {
    return this.http.get<TipoMovimientoItem[]>(this.baseUrl + 'tipos-movimiento', {
      withCredentials: true
    });
  }

  registrarMovimiento(body: MovimientoRequest): Observable<{ idMovimiento: number; message: string }> {
    return this.http.post<{ idMovimiento: number; message: string }>(this.baseUrl + 'movimientos', body, {
      withCredentials: true
    });
  }

  listarMovimientos(filtros: {
    fechaInicio?: string | null;
    fechaFin?: string | null;
    idSucursal?: string | null;
    tipoMovimiento?: string | null;
  }): Observable<MovimientoListItem[]> {
    let params = new HttpParams();
    if (filtros.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
    if (filtros.fechaFin) params = params.set('fechaFin', filtros.fechaFin);
    if (filtros.idSucursal) params = params.set('idSucursal', filtros.idSucursal);
    if (filtros.tipoMovimiento) params = params.set('tipoMovimiento', filtros.tipoMovimiento);
    return this.http.get<MovimientoListItem[]>(this.baseUrl + 'movimientos', {
      params,
      withCredentials: true
    });
  }

  /** Obtiene un movimiento por id (para modal detalle). */
  obtenerMovimientoPorId(idMovimiento: number): Observable<MovimientoDetalle> {
    return this.http.get<MovimientoDetalle>(this.baseUrl + 'movimientos/' + idMovimiento, {
      withCredentials: true
    });
  }

  /** Kardex: compras, ventas y movimientos de un producto en un rango de fechas */
  obtenerKardex(idProducto: string, fechaDesde: string, fechaHasta: string): Observable<KardexResponse> {
    let params = new HttpParams().set('idProducto', idProducto);
    if (fechaDesde) params = params.set('fechaDesde', fechaDesde);
    if (fechaHasta) params = params.set('fechaHasta', fechaHasta);
    return this.http.get<KardexResponse>(this.baseUrl + 'kardex', {
      params,
      withCredentials: true
    });
  }
}

export interface KardexProducto {
  idProducto: string;
  codigo: string;
  descripcion: string;
}

export interface KardexSaldoInicial {
  cantidad: number;
  pUnitario: number;
  importe: number;
}

export interface KardexFila {
  fecha: string;
  tipoMov: string;
  nroDocum: string;
  idRef: string;
  tipoRef: 'COMPRA' | 'VENTA' | 'MOVIMIENTO';
  cantidadEntrada: number;
  pUnitarioEntrada: number;
  importeEntrada: number;
  cantidadSalida: number;
  pUnitarioSalida: number;
  importeSalida: number;
  saldoCantidad: number;
  saldoPUnitario: number;
  saldoImporte: number;
}

export interface KardexTotales {
  totalEntradaCantidad: number;
  totalEntradaImporte: number;
  totalSalidaCantidad: number;
  totalSalidaImporte: number;
  saldoFinalCantidad: number;
  saldoFinalImporte: number;
}

export interface KardexResponse {
  producto: KardexProducto | null;
  saldoInicial: KardexSaldoInicial | null;
  filas: KardexFila[];
  totales: KardexTotales | null;
}
