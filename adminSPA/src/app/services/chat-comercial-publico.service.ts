import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ChatComercialRespuesta } from '../models/chat-comercial-publico.model';

@Injectable({ providedIn: 'root' })
export class ChatComercialPublicoService {
  private readonly baseUrl = environment.API_URL;
  private readonly headers = new HttpHeaders({ 'Content-Type': 'application/json' });

  constructor(private http: HttpClient) {}

  chatear(body: { mensaje: string; sessionId?: string | null }): Observable<ChatComercialRespuesta> {
    return this.http
      .post<{ data: ChatComercialRespuesta }>(
        `${this.baseUrl}public/chat-comercial`,
        JSON.stringify(body),
        { headers: this.headers, withCredentials: false }
      )
      .pipe(map((r) => r.data));
  }
}
