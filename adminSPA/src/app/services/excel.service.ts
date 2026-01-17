import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  private readonly baseUrl = 'http://localhost:3002/api/reports';

  constructor(private http: HttpClient) {}

  generarExcel(data: ExcelData): Observable<Blob> {
    return this.http.post(
      `${this.baseUrl}/generate-excel`,
      { data },
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