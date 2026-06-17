import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable, of } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ComprobanteService {
  public url: any;
  private _router: any;
  public idUser: any;

  private cacheComprobantes = new Map<string, { data: any[] }>();
  private enVueloComprobantes = new Map<string, Observable<{ data: any[] }>>();

  constructor(private _http: HttpClient) {
    this.url = global.url;
  }

  invalidarCacheComprobantes(): void {
    this.cacheComprobantes.clear();
    this.enVueloComprobantes.clear();
  }

  private cacheKey(uso: string, idSucursal?: string | null): string {
    return `${uso || 'all'}::${idSucursal != null && String(idSucursal).trim() !== '' ? String(idSucursal).trim() : ''}`;
  }

  private obtenerComprobantesCached(
    uso: string,
    idSucursal?: string | null,
    evitarCache = false
  ): Observable<{ data: any[] }> {
    const key = this.cacheKey(uso, idSucursal);
    if (!evitarCache && this.cacheComprobantes.has(key)) {
      return of(this.cacheComprobantes.get(key)!);
    }
    if (!evitarCache && this.enVueloComprobantes.has(key)) {
      return this.enVueloComprobantes.get(key)!;
    }
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    let params = new HttpParams();
    if (uso) params = params.set('uso', uso);
    if (idSucursal != null && String(idSucursal).trim() !== '') {
      params = params.set('idSucursal', String(idSucursal).trim());
    }
    const req$ = this._http.get<{ data: any[] }>(this.url + 'comprobantes', {
      headers,
      withCredentials: true,
      params
    }).pipe(
      tap((res) => {
        this.cacheComprobantes.set(key, res);
        this.enVueloComprobantes.delete(key);
      }),
      shareReplay(1)
    );
    this.enVueloComprobantes.set(key, req$);
    return req$;
  }

  obtener_comprobantes_alias(id: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'comprobantes/' + id, {
      headers,
      withCredentials: true
    });
  }

  obtener_comprobantes(idSucursal?: string | null, opciones?: { evitarCache?: boolean }): Observable<{ data: any[] }> {
    return this.obtenerComprobantesCached('', idSucursal, opciones?.evitarCache);
  }

  obtenerComprobantesVenta(idSucursal?: string | null, opciones?: { evitarCache?: boolean }): Observable<{ data: any[] }> {
    return this.obtenerComprobantesCached('venta', idSucursal, opciones?.evitarCache);
  }

  obtenerComprobantesCompra(idSucursal?: string | null, opciones?: { evitarCache?: boolean }): Observable<{ data: any[] }> {
    return this.obtenerComprobantesCached('compra', idSucursal, opciones?.evitarCache);
  }

  actualizar(
    idComprobante: number,
    payload: { serie?: string; numero?: number; usarEnVenta?: boolean; usarEnCompra?: boolean }
  ): Observable<{ data: { rowsAffected: number } }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.put<{ data: { rowsAffected: number } }>(this.url + 'comprobantes/' + idComprobante, payload, {
      headers,
      withCredentials: true
    }).pipe(tap(() => this.invalidarCacheComprobantes()));
  }

  crear(payload: {
    codigo: string;
    nombre: string;
    serie: string;
    numero?: number;
    usarEnVenta?: boolean;
    usarEnCompra?: boolean;
    idSucursal?: string;
  }): Observable<{ data: { idComprobante: number } }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.post<{ data: { idComprobante: number } }>(this.url + 'comprobantes', payload, {
      headers,
      withCredentials: true
    }).pipe(tap(() => this.invalidarCacheComprobantes()));
  }
}
