import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  ProductoUnidadesVentaGuardar,
  ProductoUnidadesVentaResponse
} from '../models/producto-unidad-venta.model';

@Injectable({
  providedIn: 'root'
})
export class ProductoUnidadVentaService {
  private readonly cache = new Map<string, ProductoUnidadesVentaResponse>();

  constructor(private http: HttpClient) {}

  obtener(idProducto: string, evitarCache = false): Observable<ProductoUnidadesVentaResponse> {
    const id = String(idProducto || '').trim();
    if (!id) {
      return of({ conversion: null, unidades: [] });
    }
    if (!evitarCache && this.cache.has(id.toLowerCase())) {
      return of(this.cache.get(id.toLowerCase()) as ProductoUnidadesVentaResponse);
    }
    return this.http
      .get<{ data: ProductoUnidadesVentaResponse }>(
        `${environment.API_URL}/productos/${id}/unidades-venta`
      )
      .pipe(
        map((res) => res?.data || { conversion: null, unidades: [] }),
        tap((data) => this.cache.set(id.toLowerCase(), data))
      );
  }

  guardar(idProducto: string, body: ProductoUnidadesVentaGuardar): Observable<ProductoUnidadesVentaResponse> {
    const id = String(idProducto || '').trim();
    return this.http
      .put<{ data: ProductoUnidadesVentaResponse }>(
        `${environment.API_URL}/productos/${id}/unidades-venta`,
        body
      )
      .pipe(
        map((res) => res?.data || { conversion: null, unidades: [] }),
        tap((data) => this.cache.set(id.toLowerCase(), data))
      );
  }

  invalidar(idProducto?: string): void {
    if (!idProducto) {
      this.cache.clear();
      return;
    }
    this.cache.delete(String(idProducto).trim().toLowerCase());
  }
}
