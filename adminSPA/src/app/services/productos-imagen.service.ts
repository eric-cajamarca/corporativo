import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ImagenProducto {
  idImagen: string;
  idProducto: string;
  rutaArchivo: string;
  orden: number;
  fRegistro?: string;
  url: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductosImagenService {
  private readonly baseUrl = environment.API_URL + 'productos/';

  constructor(private http: HttpClient) {}

  listar(idProducto: string): Observable<{ data: ImagenProducto[] }> {
    return this.http.get<{ data: ImagenProducto[] }>(
      `${this.baseUrl}${idProducto}/imagenes`,
      { withCredentials: true }
    );
  }

  subir(idProducto: string, files: File[]): Observable<{ data: Array<{ rutaArchivo: string; orden: number }> }> {
    const formData = new FormData();
    files.forEach(f => formData.append('imagenes', f, f.name));
    return this.http.post<{ data: Array<{ rutaArchivo: string; orden: number }> }>(
      `${this.baseUrl}${idProducto}/imagenes`,
      formData,
      { withCredentials: true }
    );
  }

  eliminar(idImagen: string): Observable<{ data: { deleted: boolean } }> {
    return this.http.delete<{ data: { deleted: boolean } }>(
      `${this.baseUrl}imagenes/${idImagen}`,
      { withCredentials: true }
    );
  }
}
