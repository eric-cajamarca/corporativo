import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ExcelData {
  title?: string;
  filename?: string;
  columns: string[];
  rows: any[][];
  worksheetName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExcelService {
  private readonly baseUrl = environment.PDF_API_BASE.replace(/\/$/, '');

  constructor(private http: HttpClient) {}

  generarExcel(data: ExcelData): Observable<Blob> {
    return this.http.post(
      `${this.baseUrl}/generate-excel`,
      { data },
      { responseType: 'blob' }
    );
  }

  generarExcelComprasDetallado(data: Record<string, unknown>): Observable<Blob> {
    return this.http.post(
      `${this.baseUrl}/generate-excel`,
      { data: { ...data, tipo: 'compras-detallado' } },
      { responseType: 'blob' }
    );
  }

  generarExcelVentasDetallado(data: Record<string, unknown>): Observable<Blob> {
    return this.http.post(
      `${this.baseUrl}/generate-excel`,
      { data: { ...data, tipo: 'ventas-detallado' } },
      { responseType: 'blob' }
    );
  }

  generarExcelKardex131(data: Record<string, unknown>): Observable<Blob> {
    return this.http.post(
      `${this.baseUrl}/generate-excel`,
      { data: { ...data, tipo: 'kardex-13.1' } },
      { responseType: 'blob' }
    );
  }

  descargar(blob: Blob, nombreArchivo = 'reporte.xlsx'): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}