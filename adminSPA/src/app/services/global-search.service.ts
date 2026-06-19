import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { global } from './global';

export interface GlobalSearchProducto {
  idProducto: string;
  codigo: string;
  descripcion: string;
  stock?: number;
}

export interface GlobalSearchCliente {
  idCliente: number;
  ruc: string;
  rSocial: string;
}

export interface GlobalSearchVenta {
  idVenta: number;
  compVenta: string;
  total: number;
  fecha?: string;
}

export interface GlobalSearchResult {
  productos: GlobalSearchProducto[];
  clientes: GlobalSearchCliente[];
  ventas: GlobalSearchVenta[];
}

@Injectable({ providedIn: 'root' })
export class GlobalSearchService {
  private readonly url = global.url;

  constructor(private http: HttpClient) {}

  buscar(q: string, limit = 12): Observable<{ data: GlobalSearchResult }> {
    const term = encodeURIComponent(String(q || '').trim());
    return this.http.get<{ data: GlobalSearchResult }>(
      `${this.url}busqueda-global?q=${term}&limit=${limit}`,
      { withCredentials: true }
    );
  }
}
