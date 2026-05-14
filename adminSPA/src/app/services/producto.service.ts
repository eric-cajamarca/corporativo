import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  Producto,
  ProductoCreate,
  ProductoResponse,
  ImportacionProductosValidarData,
  ImportacionProductosEjecutarData,
  StockUbicacionProductoFila
} from '../models/producto.models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {
  public url: any;
  private _router: any;
  public idUser:any;
  /** Copia en memoria del último GET /productos (misma sesión SPA). Evita repetir HTTP al abrir el modal si ya se cargó al iniciar venta u otra pantalla. */
  private listaProductosMemoria: ProductoResponse | null = null;

  constructor(
    private _http: HttpClient,
  ) {
    this.url = environment.API_URL;
  }

  /** Llamar al entrar a «Nueva venta» para forzar un GET fresco y actualizar la copia en memoria. */
  limpiarCacheListaProductos(): void {
    this.listaProductosMemoria = null;
  }

  /**
   * Lista de productos con stock/precios por sucursal (empresa del token).
   * @param opciones.evitarCache Fuerza petición HTTP (query anti-caché) y actualiza memoria.
   */
  obtenerProductosTodos(opciones?: { evitarCache?: boolean }): Observable<ProductoResponse> {
    if (!opciones?.evitarCache && this.listaProductosMemoria?.data != null) {
      const d = this.listaProductosMemoria.data;
      const dataCopy = Array.isArray(d) ? [...d] : d;
      return of({ ...this.listaProductosMemoria, data: dataCopy } as ProductoResponse);
    }
    let url = this.url + 'productos';
    if (opciones?.evitarCache) {
      url += (url.includes('?') ? '&' : '?') + '_=' + encodeURIComponent(String(Date.now()));
    }
    return this._http.get<ProductoResponse>(url, {
      withCredentials: true
    }).pipe(
      tap((res) => {
        if (res?.data != null) {
          const d = res.data;
          this.listaProductosMemoria = {
            ...res,
            data: Array.isArray(d) ? [...d] : d
          } as ProductoResponse;
        }
      })
    );
  }

  /** Lista para modal de compras; `evitarCache` fuerza GET fresco (p. ej. producto recién creado). */
  obtenerProductosCompras(opciones?: { evitarCache?: boolean }): Observable<ProductoResponse> {
    let u = this.url + 'productos/compras';
    if (opciones?.evitarCache) {
      u += (u.includes('?') ? '&' : '?') + '_=' + encodeURIComponent(String(Date.now()));
    }
    return this._http.get<ProductoResponse>(u, {
      withCredentials: true
    });
  }

  obtenerProductoPorId(id: string): Observable<ProductoResponse> {
    return this._http.get<ProductoResponse>(this.url + 'productos/' + id, {
      withCredentials: true
    });
  }

  /** Stock desglosado por ubicación (sucursal del query; empresa del JWT). */
  obtenerStockUbicacionesProducto(
    idProducto: string,
    idSucursal: string
  ): Observable<{ data: StockUbicacionProductoFila[] }> {
    const pid = encodeURIComponent(idProducto);
    const sid = encodeURIComponent(idSucursal);
    return this._http.get<{ data: StockUbicacionProductoFila[] }>(
      `${this.url}productos/${pid}/stock-ubicaciones?idSucursal=${sid}`,
      { withCredentials: true }
    );
  }

  crearProducto(producto: ProductoCreate): Observable<ProductoResponse> {
    return this._http.post<ProductoResponse>(this.url + 'productos', producto, {
      withCredentials: true
    }).pipe(
      tap(() => {
        this.limpiarCacheListaProductos();
      })
    );
  }

  actualizarProducto(id: string, producto: ProductoCreate): Observable<ProductoResponse> {
    return this._http.put<ProductoResponse>(this.url + 'productos/' + id, producto, {
      withCredentials: true
    }).pipe(
      tap(() => {
        this.limpiarCacheListaProductos();
      })
    );
  }

  /** Activa o desactiva el producto (PATCH; no elimina). Requiere rol Administrador en el backend. */
  actualizarEstadoProducto(id: string, activo: boolean): Observable<ProductoResponse> {
    return this._http.patch<ProductoResponse>(
      `${this.url}productos/${id}/estado`,
      { activo },
      { withCredentials: true }
    ).pipe(
      tap(() => {
        this.limpiarCacheListaProductos();
      })
    );
  }

  eliminarProducto(id: string): Observable<ProductoResponse> {
    return this._http.delete<ProductoResponse>(this.url + 'productos/' + id, {
      withCredentials: true
    }).pipe(
      tap(() => {
        this.limpiarCacheListaProductos();
      })
    );
  }

  /** Busca idProducto por descripción exacta (empresa del usuario). Para compras al cargar XML. */
  matchProductosPorDescripcion(descripciones: string[]): Observable<{ data: Array<{ descripcion: string; idProducto: string | null }> }> {
    return this._http.post<{ data: Array<{ descripcion: string; idProducto: string | null }> }>(
      this.url + 'productos/match-descripcion',
      { descripciones: descripciones || [] },
      { withCredentials: true }
    );
  }

  descargarPlantillaImportacionProductos(): Observable<Blob> {
    return this._http.get(`${this.url}productos/importacion/plantilla`, {
      withCredentials: true,
      responseType: 'blob'
    });
  }

  validarImportacionProductos(archivo: File): Observable<{ message: string; data: ImportacionProductosValidarData }> {
    const fd = new FormData();
    fd.append('archivo', archivo, archivo.name);
    return this._http.post<{ message: string; data: ImportacionProductosValidarData }>(
      `${this.url}productos/importacion/validar`,
      fd,
      { withCredentials: true }
    );
  }

  ejecutarImportacionProductos(archivo: File): Observable<{ message: string; data: ImportacionProductosEjecutarData }> {
    const fd = new FormData();
    fd.append('archivo', archivo, archivo.name);
    return this._http
      .post<{ message: string; data: ImportacionProductosEjecutarData }>(
        `${this.url}productos/importacion/ejecutar`,
        fd,
        { withCredentials: true }
      )
      .pipe(
        tap(() => {
          this.limpiarCacheListaProductos();
        })
      );
  }
}
