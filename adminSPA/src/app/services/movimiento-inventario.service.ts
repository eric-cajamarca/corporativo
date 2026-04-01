import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StockActualResponse } from '../models/stock-actual.model';
import { ProductosVendidosResponse } from '../models/productos-vendidos.model';
import { ProductosCompradosResponse } from '../models/productos-comprados.model';
import {
  MovimientoInventarioCabecera,
  MovimientoInventarioLineaDetalle,
  MovimientosResumenPaginados
} from '../models/movimientos-inventario-resumen.model';

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

  /** Cabeceras agrupadas (pantalla Movimientos). */
  listarMovimientosResumen(filtros: {
    fechaDesde?: string | null;
    fechaHasta?: string | null;
    idSucursal?: string | null;
    codigoTipo?: string | null;
    buscar?: string | null;
    page?: number;
    pageSize?: number;
  }): Observable<MovimientosResumenPaginados> {
    let params = new HttpParams();
    if (filtros.fechaDesde) params = params.set('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta) params = params.set('fechaHasta', filtros.fechaHasta);
    if (filtros.idSucursal) params = params.set('idSucursal', filtros.idSucursal);
    if (filtros.codigoTipo?.trim()) params = params.set('codigoTipo', filtros.codigoTipo.trim());
    if (filtros.buscar?.trim()) params = params.set('buscar', filtros.buscar.trim());
    if (filtros.page != null) params = params.set('page', String(filtros.page));
    if (filtros.pageSize != null) params = params.set('pageSize', String(filtros.pageSize));
    return this.http.get<MovimientosResumenPaginados>(this.baseUrl + 'movimientos-resumen', {
      params,
      withCredentials: true
    });
  }

  listarLineasMovimientoCabecera(idMovimiento: number): Observable<MovimientoInventarioLineaDetalle[]> {
    return this.http.get<MovimientoInventarioLineaDetalle[]>(this.baseUrl + 'movimientos/' + idMovimiento + '/lineas', {
      withCredentials: true
    });
  }

  /** Obtiene un movimiento por id (para modal detalle). */
  obtenerMovimientoPorId(idMovimiento: number): Observable<MovimientoDetalle> {
    return this.http.get<MovimientoDetalle>(this.baseUrl + 'movimientos/' + idMovimiento, {
      withCredentials: true
    });
  }

  obtenerProductosVendidos(params: {
    fechaDesde: string;
    fechaHasta: string;
    idCliente?: string | null;
    clienteRuc?: string | null;
    clienteRazon?: string | null;
    categoria?: string | null;
    producto?: string | null;
    agrupar: boolean;
    buscar?: string | null;
  }): Observable<ProductosVendidosResponse> {
    let hp = new HttpParams()
      .set('fechaDesde', params.fechaDesde)
      .set('fechaHasta', params.fechaHasta)
      .set('agrupar', params.agrupar ? '1' : '0');
    if (params.idCliente?.trim()) hp = hp.set('idCliente', params.idCliente.trim());
    if (params.clienteRuc?.trim()) hp = hp.set('clienteRuc', params.clienteRuc.trim());
    if (params.clienteRazon?.trim()) hp = hp.set('clienteRazon', params.clienteRazon.trim());
    if (params.categoria?.trim()) hp = hp.set('categoria', params.categoria.trim());
    if (params.producto?.trim()) hp = hp.set('producto', params.producto.trim());
    if (params.buscar?.trim()) hp = hp.set('buscar', params.buscar.trim());
    return this.http.get<ProductosVendidosResponse>(this.baseUrl + 'productos-vendidos', {
      params: hp,
      withCredentials: true
    });
  }

  obtenerProductosComprados(params: {
    fechaDesde: string;
    fechaHasta: string;
    idProveedor?: string | null;
    proveedorRuc?: string | null;
    proveedorRazon?: string | null;
    idComprobante?: string | null;
    producto?: string | null;
    agrupar: boolean;
    buscar?: string | null;
  }): Observable<ProductosCompradosResponse> {
    let hp = new HttpParams()
      .set('fechaDesde', params.fechaDesde)
      .set('fechaHasta', params.fechaHasta)
      .set('agrupar', params.agrupar ? '1' : '0');
    if (params.idProveedor?.trim()) hp = hp.set('idProveedor', params.idProveedor.trim());
    if (params.proveedorRuc?.trim()) hp = hp.set('proveedorRuc', params.proveedorRuc.trim());
    if (params.proveedorRazon?.trim()) hp = hp.set('proveedorRazon', params.proveedorRazon.trim());
    if (params.idComprobante?.trim()) hp = hp.set('idComprobante', params.idComprobante.trim());
    if (params.producto?.trim()) hp = hp.set('producto', params.producto.trim());
    if (params.buscar?.trim()) hp = hp.set('buscar', params.buscar.trim());
    return this.http.get<ProductosCompradosResponse>(this.baseUrl + 'productos-comprados', {
      params: hp,
      withCredentials: true
    });
  }

  /** Stock actual agregado por producto (filtros en query). */
  obtenerStockActual(params: {
    idSucursal?: string | null;
    categoria?: string | null;
    marca?: string | null;
    filtroStock?: 'todos' | 'cero' | 'minimo';
    buscar?: string | null;
  }): Observable<StockActualResponse> {
    let hp = new HttpParams();
    if (params.idSucursal) hp = hp.set('idSucursal', params.idSucursal);
    if (params.categoria?.trim()) hp = hp.set('categoria', params.categoria.trim());
    if (params.marca?.trim()) hp = hp.set('marca', params.marca.trim());
    if (params.filtroStock) hp = hp.set('filtroStock', params.filtroStock);
    if (params.buscar?.trim()) hp = hp.set('buscar', params.buscar.trim());
    return this.http.get<StockActualResponse>(this.baseUrl + 'stock-actual', {
      params: hp,
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
