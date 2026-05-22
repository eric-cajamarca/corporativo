import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  WhatsappApiResponse,
  WhatsappProveedor,
  WhatsappSessionApiResponse,
  WhatsappSessionData
} from '../interfaces/whatsapp-interface';

/** Mensaje cuando Baileys no tiene sesión activa (todos los botones WhatsApp del ERP). */
export const WHATSAPP_MSG_VINCULAR_BAILEYS =
  'WhatsApp Baileys no está conectado. Vaya a Configuración → Vincular WhatsApp y escanee el código QR.';

@Injectable({
  providedIn: 'root'
})
export class WhatsappService {
  private readonly baseUrl = environment.API_URL + 'whatsapp';

  constructor(private http: HttpClient) {}

  /**
   * Envía texto usando el proveedor configurado en EmpresaWhatsApp:
   * - factiliza → API Factiliza (instancia global)
   * - baileys → sesión vinculada en whatsapp-gateway
   */
  enviarTexto(number: string, text: string): Observable<WhatsappApiResponse> {
    return this.assertPuedeEnviar$().pipe(
      switchMap(() =>
        this.http.post<WhatsappApiResponse>(
          `${this.baseUrl}/send-text`,
          { number: number.trim(), text: text.trim() },
          { withCredentials: true }
        )
      )
    );
  }

  /**
   * Envía archivo/PDF por el mismo proveedor que enviarTexto.
   */
  enviarArchivo(
    number: string,
    mediaBase64: string,
    filename: string,
    mediatype: 'image' | 'document' | 'video' | 'audio' = 'document',
    caption?: string
  ): Observable<WhatsappApiResponse> {
    return this.assertPuedeEnviar$().pipe(
      switchMap(() => {
        const body: Record<string, string> = {
          number: number.trim(),
          media: mediaBase64,
          filename: filename.trim(),
          mediatype
        };
        if (caption != null && caption.trim() !== '') body['caption'] = caption.trim();
        return this.http.post<WhatsappApiResponse>(`${this.baseUrl}/send-media`, body, {
          withCredentials: true
        });
      })
    );
  }

  getSessionStatus(): Observable<WhatsappSessionApiResponse> {
    return this.http.get<WhatsappSessionApiResponse>(`${this.baseUrl}/session/status`, {
      withCredentials: true
    });
  }

  startSession(): Observable<WhatsappSessionApiResponse> {
    return this.http.post<WhatsappSessionApiResponse>(
      `${this.baseUrl}/session`,
      {},
      { withCredentials: true }
    );
  }

  logoutSession(): Observable<WhatsappApiResponse> {
    return this.http.delete<WhatsappApiResponse>(`${this.baseUrl}/session`, {
      withCredentials: true
    });
  }

  setProveedor(proveedor: WhatsappProveedor): Observable<WhatsappSessionApiResponse> {
    return this.http.put<WhatsappSessionApiResponse>(
      `${this.baseUrl}/proveedor`,
      { proveedor },
      { withCredentials: true }
    );
  }

  /** Baileys requiere sesión conectada; Factiliza usa API global (siempre listo si está configurado en servidor). */
  puedeEnviar(session: WhatsappSessionData | null | undefined): boolean {
    if (!session) return false;
    const prov = String(session.proveedor || 'factiliza').toLowerCase();
    if (prov !== 'baileys') return true;
    return String(session.estadoSesion || '').toLowerCase() === 'conectado';
  }

  mensajeSiNoPuedeEnviar(session: WhatsappSessionData | null | undefined): string | null {
    if (this.puedeEnviar(session)) return null;
    if (String(session?.proveedor || '').toLowerCase() === 'baileys') {
      return WHATSAPP_MSG_VINCULAR_BAILEYS;
    }
    return 'No puede enviar por WhatsApp en este momento.';
  }

  private assertPuedeEnviar$(): Observable<true> {
    return this.getSessionStatus().pipe(
      switchMap((res) => {
        const data = res.success ? res.data : null;
        if (!data || !this.puedeEnviar(data)) {
          const msg = this.mensajeSiNoPuedeEnviar(data) || res.message || 'No puede enviar por WhatsApp';
          return throwError(() => ({ message: msg, needsVinculo: String(data?.proveedor || '').toLowerCase() === 'baileys' }));
        }
        return of(true as const);
      })
    );
  }
}
