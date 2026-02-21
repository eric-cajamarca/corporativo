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
}
