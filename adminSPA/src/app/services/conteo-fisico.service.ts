import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ConteoFisicoAplicarResponse,
  ConteoFisicoCrearSesionResponse,
  ConteoFisicoPrevisualizarResponse,
  ConteoFisicoSesionResponse,
  ConteoFisicoUpsertLineaResponse
} from '../models/conteo-fisico.model';

export interface CrearSesionConteoBody {
  idSucursal: string;
  tipoConteo: string;
  observaciones?: string | null;
}

export interface UpsertLineaConteoBody {
  stockReal?: number | null;
  verificado?: boolean;
  notas?: string | null;
}

export interface AplicarConteoBody {
  observaciones?: string | null;
  docRelacionado?: string | null;
  idComprobante?: string | number | null;
}

@Injectable({
  providedIn: 'root'
})
export class ConteoFisicoService {
  private readonly baseUrl = environment.API_URL + 'inventario/conteo-fisico/';

  constructor(private http: HttpClient) {}

  crearSesion(body: CrearSesionConteoBody): Observable<ConteoFisicoCrearSesionResponse> {
    return this.http.post<ConteoFisicoCrearSesionResponse>(this.baseUrl + 'sesiones', body, {
      withCredentials: true
    });
  }

  obtenerSesion(idSesion: string): Observable<ConteoFisicoSesionResponse> {
    return this.http.get<ConteoFisicoSesionResponse>(this.baseUrl + 'sesiones/' + encodeURIComponent(idSesion), {
      withCredentials: true
    });
  }

  previsualizar(idSesion: string): Observable<ConteoFisicoPrevisualizarResponse> {
    return this.http.get<ConteoFisicoPrevisualizarResponse>(
      this.baseUrl + 'sesiones/' + encodeURIComponent(idSesion) + '/previsualizar',
      { withCredentials: true }
    );
  }

  upsertLinea(idSesion: string, idProducto: string, body: UpsertLineaConteoBody): Observable<ConteoFisicoUpsertLineaResponse> {
    const pid = encodeURIComponent(idProducto);
    return this.http.put<ConteoFisicoUpsertLineaResponse>(
      this.baseUrl + 'sesiones/' + encodeURIComponent(idSesion) + '/lineas/' + pid,
      body,
      { withCredentials: true }
    );
  }

  aplicarMovimientos(idSesion: string, body?: AplicarConteoBody): Observable<ConteoFisicoAplicarResponse> {
    return this.http.post<ConteoFisicoAplicarResponse>(
      this.baseUrl + 'sesiones/' + encodeURIComponent(idSesion) + '/aplicar-movimientos',
      body || {},
      { withCredentials: true }
    );
  }

  obtenerDatosExport(idSesion: string): Observable<ConteoFisicoSesionResponse> {
    return this.http.get<ConteoFisicoSesionResponse>(
      this.baseUrl + 'sesiones/' + encodeURIComponent(idSesion) + '/export',
      { withCredentials: true }
    );
  }
}
