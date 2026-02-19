import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface WhatsappApiResponse {
  status: number;
  success: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class WhatsappService {
  private readonly baseUrl = environment.API_URL + 'whatsapp';

  constructor(private http: HttpClient) {}

  enviarTexto(number: string, text: string): Observable<WhatsappApiResponse> {
    return this.http.post<WhatsappApiResponse>(
      `${this.baseUrl}/send-text`,
      { number: number.trim(), text: text.trim() },
      { withCredentials: true }
    );
  }

  enviarArchivo(
    number: string,
    mediaBase64: string,
    filename: string,
    mediatype: 'image' | 'document' | 'video' | 'audio' = 'document',
    caption?: string
  ): Observable<WhatsappApiResponse> {
    const body: Record<string, string> = {
      number: number.trim(),
      media: mediaBase64,
      filename: filename.trim(),
      mediatype
    };
    if (caption != null && caption.trim() !== '') body['caption'] = caption.trim();
    return this.http.post<WhatsappApiResponse>(
      `${this.baseUrl}/send-media`,
      body,
      { withCredentials: true }
    );
  }
}
