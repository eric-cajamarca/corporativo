import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { global } from './global';

@Injectable({
  providedIn: 'root'
})
export class MarcaService {
  public url: any;

  constructor(private _http: HttpClient) {
    this.url = global.url;
  }

  /**
   * Obtiene todas las marcas de la empresa autenticada.
   * Equivalente a GET /marcas
   */
  obtener_marcas(): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': ''
    });

    return this._http.get(this.url + 'marcas', {
      headers,
      withCredentials: true
    });
  }

  obtener_marcas_idEmpresa(idEmpresa: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': ''
    });

    return this._http.get(this.url + 'marcasempresa/' + encodeURIComponent(idEmpresa), {
      headers,
      withCredentials: true
    });
  }
}

