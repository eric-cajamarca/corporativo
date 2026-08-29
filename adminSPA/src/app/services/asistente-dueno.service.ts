import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AsistenteChatRequest,
  AsistenteChatResponse,
  AsistenteEstadoResponse
} from '../models/asistente-dueno.model';

@Injectable({ providedIn: 'root' })
export class AsistenteDuenoService {
  private readonly baseUrl = environment.API_URL + 'asistente-dueno';

  constructor(private http: HttpClient) {}

  estado(): Observable<AsistenteEstadoResponse> {
    return this.http.get<AsistenteEstadoResponse>(`${this.baseUrl}/estado`, { withCredentials: true });
  }

  chat(body: AsistenteChatRequest): Observable<AsistenteChatResponse> {
    return this.http.post<AsistenteChatResponse>(`${this.baseUrl}/chat`, body, { withCredentials: true });
  }
}
