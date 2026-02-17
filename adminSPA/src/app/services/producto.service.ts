import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Producto, ProductoCreate, ProductoResponse } from '../models/producto.models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {
  public url: any;
  private _router: any;
  public idUser:any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = environment.API_URL;
  }

  obtenerProductosTodos(): Observable<ProductoResponse> {
    // SIEMPRE maneja errores en el subscribe (regla 2.2)
    return this._http.get<ProductoResponse>(this.url + 'productos', {
      withCredentials: true
    });
  }

  obtenerProductosCompras(): Observable<ProductoResponse> {
    return this._http.get<ProductoResponse>(this.url + 'productos/compras', {
      withCredentials: true
    });
  }

  obtenerProductoPorId(id: string): Observable<ProductoResponse> {
    return this._http.get<ProductoResponse>(this.url + 'productos/' + id, {
      withCredentials: true
    });
  }

  crearProducto(producto: ProductoCreate): Observable<ProductoResponse> {
    return this._http.post<ProductoResponse>(this.url + 'productos', producto, {
      withCredentials: true
    });
  }

  actualizarProducto(id: string, producto: ProductoCreate): Observable<ProductoResponse> {
    return this._http.put<ProductoResponse>(this.url + 'productos/' + id, producto, {
      withCredentials: true
    });
  }

  eliminarProducto(id: string): Observable<ProductoResponse> {
    return this._http.delete<ProductoResponse>(this.url + 'productos/' + id, {
      withCredentials: true
    });
  }

  /** Busca idProducto por descripción exacta (empresa del usuario). Para compras al cargar XML. */
  matchProductosPorDescripcion(descripciones: string[]): Observable<{ data: Array<{ descripcion: string; idProducto: string | null }> }> {
    return this._http.post<{ data: Array<{ descripcion: string; idProducto: string | null }> }>(
      this.url + 'productos/match-descripcion',
      { descripciones: descripciones || [] },
      { withCredentials: true }
    );
  }
}
