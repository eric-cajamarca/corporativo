import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiperuService {

  private readonly baseUrl = environment.API_URL + 'external/';

  constructor(private _http: HttpClient) {}

  getRucInfo(filtro: string): Observable<any> {
    const url = `${this.baseUrl}ruc/${encodeURIComponent(filtro.trim())}`;
    return this._http.get(url, {
      headers: new HttpHeaders().set('Content-Type', 'application/json'),
      withCredentials: true
    }).pipe(
      catchError(err => throwError(() => err))
    );
  }

  /** Consulta RUC sin autenticación (para crear-empresa / registro público). */
  getRucInfoPublic(filtro: string): Observable<any> {
    const url = `${environment.API_URL}public/ruc/${encodeURIComponent(filtro.trim())}`;
    return this._http.get(url, {
      headers: new HttpHeaders().set('Content-Type', 'application/json'),
      withCredentials: true
    }).pipe(
      catchError(err => throwError(() => err))
    );
  }

  getDniInfo(filtro: string): Observable<any> {
    const url = `${this.baseUrl}dni/${encodeURIComponent(filtro.trim())}`;
    return this._http.get(url, {
      headers: new HttpHeaders().set('Content-Type', 'application/json'),
      withCredentials: true
    }).pipe(
      catchError(err => throwError(() => err))
    );
  }

  /** Carnet de extranjería (CEE) - Factiliza */
  getCeeInfo(cee: string): Observable<any> {
    const url = `${this.baseUrl}cee/${encodeURIComponent(cee.trim())}`;
    return this._http.get(url, {
      headers: new HttpHeaders().set('Content-Type', 'application/json'),
      withCredentials: true
    }).pipe(
      catchError(err => throwError(() => err))
    );
  }

  /** RUC - Establecimientos (anexos) - solo Factiliza */
  getRucAnexo(ruc: string): Observable<any> {
    const url = `${this.baseUrl}ruc/anexo/${encodeURIComponent(ruc.trim())}`;
    return this._http.get(url, {
      headers: new HttpHeaders().set('Content-Type', 'application/json'),
      withCredentials: true
    }).pipe(
      catchError(err => throwError(() => err))
    );
  }

}


