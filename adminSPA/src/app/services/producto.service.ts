import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  productoActivoParaVenta,
  productoCoincideBusquedaMultipalabra
} from '../utils/producto-busqueda.util';

export interface BuscarProductosVentaOpciones {
  q: string;
  limit?: number;
  idSucursal?: string;
  evitarCache?: boolean;
}
import {
  Producto,
  ProductoCreate,
  ProductoResponse,
  ImportacionProductosValidarData,
  ImportacionProductosEjecutarData,
  StockUbicacionProductoFila,
  CatalogoProductoSunatItem,
  ProductoCodigoSunatPendiente
} from '../models/producto.models';
import {
  HistorialCompraProductoItem,
  HistorialProductoResponse,
  HistorialVentaProductoItem
} from '../models/producto-historial.model';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {
  public url: any;
  private _router: any;
  public idUser:any;
  /** Copia en memoria del último GET /productos (misma sesión SPA). Evita repetir HTTP al abrir el modal si ya se cargó al iniciar venta u otra pantalla. */
  private listaProductosMemoria: ProductoResponse | null = null;
  /** Empresa del JWT cuando se guardó listaProductosMemoria (evita mezclar catálogo al cambiar de empresa sin recargar). */
  private catalogoMemoriaIdEmpresa: string | null = null;
  /** Caché corta de búsquedas en modal de ventas (misma sesión). */
  private readonly cacheBusquedaVenta = new Map<string, { ts: number; data: ProductoResponse }>();
  private readonly ttlBusquedaVentaMs = 60_000;

  constructor(
    private _http: HttpClient,
    private auth: AuthService
  ) {
    this.url = environment.API_URL;
  }

  private idEmpresaJwtCacheKey(): string {
    return String(this.auth.userData()?.idEmpresa || '').trim().toLowerCase();
  }

  /** Si cambió la empresa del token, invalida catálogo en memoria (login en otra empresa sin F5). */
  invalidarCacheSiEmpresaDistinta(): void {
    const actual = this.idEmpresaJwtCacheKey();
    if (!actual) {
      this.limpiarCacheListaProductos();
      return;
    }
    if (this.catalogoMemoriaIdEmpresa && this.catalogoMemoriaIdEmpresa !== actual) {
      this.limpiarCacheListaProductos();
    }
  }

  /** Invalida la copia en memoria del listado completo (p. ej. tras crear/editar producto). */
  limpiarCacheListaProductos(): void {
    this.listaProductosMemoria = null;
    this.catalogoMemoriaIdEmpresa = null;
    this.cacheBusquedaVenta.clear();
  }

  tieneCatalogoEnMemoria(): boolean {
    const emp = this.idEmpresaJwtCacheKey();
    if (!emp || this.catalogoMemoriaIdEmpresa !== emp) {
      return false;
    }
    return Array.isArray(this.listaProductosMemoria?.data) && this.listaProductosMemoria!.data!.length > 0;
  }

  /**
   * Filtra el catálogo ya cargado en memoria (instantáneo si existe).
   */
  filtrarListaMemoriaVenta(termino: string, limite = 80): any[] | null {
    const raw = this.listaProductosMemoria?.data;
    if (!Array.isArray(raw) || raw.length === 0) {
      return null;
    }
    const term = String(termino || '').trim();
    if (term.length < 2) {
      return [];
    }
    const filtrados = raw
      .filter((item) => productoActivoParaVenta(item as unknown as Record<string, unknown>))
      .filter((item) =>
        productoCoincideBusquedaMultipalabra(item as unknown as Record<string, unknown>, term)
      );
    return filtrados.slice(0, Math.min(100, Math.max(1, limite)));
  }

  /**
   * Búsqueda server-side para modal de ventas (no descarga el catálogo completo).
   */
  buscarProductosVenta(opciones: BuscarProductosVentaOpciones): Observable<ProductoResponse> {
    this.invalidarCacheSiEmpresaDistinta();
    const qRaw = String(opciones.q || '').trim();
    const limit = opciones.limit != null ? Math.min(100, Math.max(1, opciones.limit)) : 80;
    const cacheKey = `${this.idEmpresaJwtCacheKey()}|${qRaw.toLowerCase()}|${limit}|${opciones.idSucursal || ''}`;
    if (!opciones?.evitarCache) {
      const hit = this.cacheBusquedaVenta.get(cacheKey);
      if (hit && Date.now() - hit.ts < this.ttlBusquedaVentaMs) {
        const d = hit.data.data;
        const dataCopy = Array.isArray(d) ? [...d] : d;
        return of({ ...hit.data, data: dataCopy } as ProductoResponse);
      }
    }
    const q = encodeURIComponent(qRaw);
    let url = `${this.url}productos/buscar-venta?q=${q}&limit=${limit}`;
    if (opciones.idSucursal) {
      url += `&idSucursal=${encodeURIComponent(opciones.idSucursal)}`;
    }
    if (opciones.evitarCache) {
      url += `&_=${encodeURIComponent(String(Date.now()))}`;
    }
    return this._http.get<ProductoResponse>(url, { withCredentials: true }).pipe(
      tap((res) => {
        if (res?.data != null) {
          const d = res.data;
          this.cacheBusquedaVenta.set(cacheKey, {
            ts: Date.now(),
            data: {
              ...res,
              data: Array.isArray(d) ? [...d] : d
            } as ProductoResponse
          });
        }
      })
    );
  }

  /**
   * Lista de productos con stock/precios por sucursal (empresa del token).
   * @param opciones.evitarCache Fuerza petición HTTP (query anti-caché) y actualiza memoria.
   */
  obtenerProductosTodos(opciones?: { evitarCache?: boolean }): Observable<ProductoResponse> {
    this.invalidarCacheSiEmpresaDistinta();
    const empKey = this.idEmpresaJwtCacheKey();
    if (
      !opciones?.evitarCache &&
      empKey &&
      this.catalogoMemoriaIdEmpresa === empKey &&
      this.listaProductosMemoria?.data != null
    ) {
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
          this.catalogoMemoriaIdEmpresa = empKey || null;
          this.listaProductosMemoria = {
            ...res,
            data: Array.isArray(d) ? [...d] : d
          } as ProductoResponse;
        }
      })
    );
  }

  obtenerProductosPaginado(params: {
    pagina?: number;
    porPagina?: number;
    buscar?: string;
  }): Observable<{ data: unknown[]; total: number; pagina?: number; porPagina?: number }> {
    let q = new HttpParams();
    if (params.pagina != null) q = q.set('pagina', String(params.pagina));
    if (params.porPagina != null) q = q.set('porPagina', String(params.porPagina));
    if (params.buscar) q = q.set('buscar', params.buscar);
    return this._http.get<{ data: unknown[]; total: number }>(this.url + 'productos', {
      withCredentials: true,
      params: q
    });
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

  listarCatalogoProductoSunat(params?: { anexo?: string; q?: string; limite?: number }): Observable<{ data: CatalogoProductoSunatItem[] }> {
    let httpParams = new HttpParams();
    if (params?.anexo) httpParams = httpParams.set('anexo', params.anexo);
    if (params?.q) httpParams = httpParams.set('q', params.q);
    if (params?.limite) httpParams = httpParams.set('limite', String(params.limite));
    return this._http.get<{ data: CatalogoProductoSunatItem[] }>(`${this.url}catalogo-producto-sunat`, {
      withCredentials: true,
      params: httpParams
    });
  }

  sugerirCodigoProductoSunat(descripcion: string, categoria?: string): Observable<{ data: CatalogoProductoSunatItem[] }> {
    return this._http.post<{ data: CatalogoProductoSunatItem[] }>(
      `${this.url}catalogo-producto-sunat/sugerir`,
      { descripcion, categoria, limite: 8 },
      { withCredentials: true }
    );
  }

  listarProductosCodigoSunatPendientes(params?: {
    filtro?: string;
    anexo?: string;
    idCategoria?: number | string;
    idMarca?: number | string;
    q?: string;
    limite?: number;
  }): Observable<{ data: ProductoCodigoSunatPendiente[] }> {
    let httpParams = new HttpParams();
    if (params?.filtro) httpParams = httpParams.set('filtro', params.filtro);
    if (params?.anexo) httpParams = httpParams.set('anexo', params.anexo);
    if (params?.idCategoria != null && params.idCategoria !== '') {
      httpParams = httpParams.set('idCategoria', String(params.idCategoria));
    }
    if (params?.idMarca != null && params.idMarca !== '') {
      httpParams = httpParams.set('idMarca', String(params.idMarca));
    }
    if (params?.q) httpParams = httpParams.set('q', params.q);
    if (params?.limite) httpParams = httpParams.set('limite', String(params.limite));
    return this._http.get<{ data: ProductoCodigoSunatPendiente[] }>(`${this.url}productos/codigo-sunat/pendientes`, {
      withCredentials: true,
      params: httpParams
    });
  }

  sugerirCodigoSunatBatch(limite = 200): Observable<{ data: { revisados: number; actualizados: number } }> {
    return this._http.post<{ data: { revisados: number; actualizados: number } }>(
      `${this.url}productos/codigo-sunat/sugerir-batch`,
      { limite },
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

  /**
   * Historial de ventas del producto (líneas vigentes).
   */
  obtenerHistorialVentasProducto(
    idProducto: string,
    opts?: { limite?: number; idCliente?: number | string; fechaDesde?: string }
  ): Observable<HistorialProductoResponse<HistorialVentaProductoItem>> {
    let params = new HttpParams();
    if (opts?.limite != null) params = params.set('limite', String(opts.limite));
    if (opts?.idCliente != null && opts.idCliente !== '') {
      params = params.set('idCliente', String(opts.idCliente));
    }
    if (opts?.fechaDesde) params = params.set('fechaDesde', opts.fechaDesde);
    return this._http.get<HistorialProductoResponse<HistorialVentaProductoItem>>(
      `${this.url}productos/${encodeURIComponent(idProducto)}/historial-ventas`,
      { withCredentials: true, params }
    );
  }

  /**
   * Historial de compras del producto. Solo Administrador (403 si no).
   */
  obtenerHistorialComprasProducto(
    idProducto: string,
    opts?: { limite?: number; fechaDesde?: string }
  ): Observable<HistorialProductoResponse<HistorialCompraProductoItem>> {
    let params = new HttpParams();
    if (opts?.limite != null) params = params.set('limite', String(opts.limite));
    if (opts?.fechaDesde) params = params.set('fechaDesde', opts.fechaDesde);
    return this._http.get<HistorialProductoResponse<HistorialCompraProductoItem>>(
      `${this.url}productos/${encodeURIComponent(idProducto)}/historial-compras`,
      { withCredentials: true, params }
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
