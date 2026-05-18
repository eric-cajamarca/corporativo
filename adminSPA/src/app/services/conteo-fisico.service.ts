import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ConteoFisicoAplicarResponse,
  ConteoFisicoCrearSesionResponse,
  ConteoFisicoListarSesionesResponse,
  ConteoFisicoPrevisualizarResponse,
  ConteoFisicoSesionResponse,
  ConteoFisicoUpsertLineaResponse
} from '../models/conteo-fisico.model';

export interface CrearSesionConteoBody {
  idSucursal: string;
  tipoConteo: string;
  observaciones?: string | null;
  /** Opcional: sesión fijada a una ubicación; al aplicar, entradas/salidas solo afectan esa ubicación (requiere stock por ubicación en inventario). */
  idUbicacionInventario?: number | null;
  /** Gestora: código común (ej. TNDA_2PISO) resuelto por empresa del producto al aplicar. */
  codigoUbicacionInventario?: string | null;
}

export interface UpsertLineaConteoBody {
  stockReal?: number | null;
  verificado?: boolean;
  notas?: string | null;
  /** Solo se envían si cambiaron respecto al producto al elegirlo (requiere permiso editar producto en servidor). */
  descripcion?: string;
  idCategoria?: number;
  idPresentacion?: number;
  idMarca?: number;
  /** Empresa dueña del producto (gestora + empresas gestionadas). */
  idEmpresaProducto?: string | null;
}

export interface AplicarConteoBody {
  observaciones?: string | null;
  docRelacionado?: string | null;
  idComprobante?: string | number | null;
  /** Fecha/hora local sin Z (YYYY-MM-DDTHH:mm:ss); el servidor la guarda tal cual en SQL. */
  fechaMovimiento?: string | null;
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

  /** Borradores con líneas guardadas y movimientos aún no aplicados. */
  listarSesionesPendientes(soloConLineas = true): Observable<ConteoFisicoListarSesionesResponse> {
    const params = soloConLineas ? '?soloConLineas=true' : '?soloConLineas=false';
    return this.http.get<ConteoFisicoListarSesionesResponse>(this.baseUrl + 'sesiones' + params, {
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
