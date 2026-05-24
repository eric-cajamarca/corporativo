import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  WhatsappBotApiResponse,
  WhatsappBotCatalogoStatus,
  WhatsappBotConfig,
  WhatsappBotLogEntry,
  WhatsappBotSinonimo
} from '../interfaces/whatsapp-bot-interface';

@Injectable({ providedIn: 'root' })
export class WhatsappBotService {
  private readonly baseUrl = environment.API_URL + 'whatsapp-bot';

  constructor(private http: HttpClient) {}

  getConfig(): Observable<WhatsappBotApiResponse<WhatsappBotConfig>> {
    return this.http.get<WhatsappBotApiResponse<WhatsappBotConfig>>(`${this.baseUrl}/config`, { withCredentials: true });
  }

  updateConfig(body: Partial<WhatsappBotConfig>): Observable<WhatsappBotApiResponse<WhatsappBotConfig>> {
    return this.http.put<WhatsappBotApiResponse<WhatsappBotConfig>>(`${this.baseUrl}/config`, body, { withCredentials: true });
  }

  syncCatalogo(): Observable<WhatsappBotApiResponse<{ ok: boolean; productos: number; ultimaSync: string | null }>> {
    return this.http.post<WhatsappBotApiResponse<{ ok: boolean; productos: number; ultimaSync: string | null }>>(
      `${this.baseUrl}/catalogo/sync`,
      {},
      { withCredentials: true }
    );
  }

  catalogoStatus(): Observable<WhatsappBotApiResponse<WhatsappBotCatalogoStatus>> {
    return this.http.get<WhatsappBotApiResponse<WhatsappBotCatalogoStatus>>(`${this.baseUrl}/catalogo/status`, { withCredentials: true });
  }

  listarSinonimos(): Observable<WhatsappBotApiResponse<WhatsappBotSinonimo[]>> {
    return this.http.get<WhatsappBotApiResponse<WhatsappBotSinonimo[]>>(`${this.baseUrl}/sinonimos`, { withCredentials: true });
  }

  crearSinonimo(terminoEntrada: string, terminoBusqueda: string): Observable<WhatsappBotApiResponse<WhatsappBotSinonimo[]>> {
    return this.http.post<WhatsappBotApiResponse<WhatsappBotSinonimo[]>>(
      `${this.baseUrl}/sinonimos`,
      { terminoEntrada, terminoBusqueda },
      { withCredentials: true }
    );
  }

  eliminarSinonimo(idSinonimo: string): Observable<WhatsappBotApiResponse<WhatsappBotSinonimo[]>> {
    return this.http.delete<WhatsappBotApiResponse<WhatsappBotSinonimo[]>>(`${this.baseUrl}/sinonimos/${idSinonimo}`, { withCredentials: true });
  }

  listarLogs(limit = 50): Observable<WhatsappBotApiResponse<WhatsappBotLogEntry[]>> {
    return this.http.get<WhatsappBotApiResponse<WhatsappBotLogEntry[]>>(`${this.baseUrl}/logs?limit=${limit}`, { withCredentials: true });
  }
}
