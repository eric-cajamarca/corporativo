import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Empresa } from '../interfaces/pdf-interface'; // Ajusta tu ruta

export interface PdfDatosDinamicos {
  empresa?: Empresa;
  columnas?: string[];
  filas?: any[][];
  titulo?: string;
  html?: string; // Para compatibilidad hacia atrás
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private readonly baseUrl = environment.PDF_API_BASE.replace(/\/$/, '');

  constructor(private http: HttpClient) {}

  // Método principal - recibe datos estructurados
  generarPdfDinamico(datos: PdfDatosDinamicos, tipo: string = 'reporte', fontSize: number = 10, formato?: 'A4' | 'A5' | 'ticket'): Observable<Blob> {
    return this.http.post(
      `${this.baseUrl}/generate-pdf`,
      { datos, tipo, fontSize, formato: formato || 'A4' },
      { responseType: 'blob' }
    );
  }

  /** Genera PDF de comprobante de venta (A4, A5 o ticket). */
  generarPdfComprobanteVenta(datos: PdfDatosDinamicos, formato: 'A4' | 'A5' | 'ticket', nombreArchivo?: string): Observable<Blob> {
    const payload = { ...datos };
    if (nombreArchivo) payload['nombreArchivo'] = nombreArchivo;
    return this.http.post(
      `${this.baseUrl}/generate-pdf`,
      { datos: payload, tipo: 'comprobante-venta', fontSize: 10, formato },
      { responseType: 'blob' }
    );
  }

  /** Genera PDF de comprobante de despacho (lista para almacenero: venta, items con ubicaciones). */
  /** Genera PDF de arqueo de caja (ticket, A5, A4). */
  generarPdfArqueoCaja(datos: PdfDatosDinamicos, formato: 'A4' | 'A5' | 'ticket', nombreArchivo?: string): Observable<Blob> {
    return this.http.post(
      `${this.baseUrl}/generate-pdf`,
      { datos, tipo: 'arqueo-caja', fontSize: formato === 'ticket' ? 8 : 10, formato },
      { responseType: 'blob' }
    );
  }

  generarPdfComprobanteDespacho(datos: PdfDatosDinamicos, formato: 'A4' | 'A5' | 'ticket', nombreArchivo?: string): Observable<Blob> {
    const payload = { ...datos };
    if (nombreArchivo) payload['nombreArchivo'] = nombreArchivo;
    /** Ticket térmico: 11px para legibilidad en recojo / almacén */
    const fontTicket = 11;
    return this.http.post(
      `${this.baseUrl}/generate-pdf`,
      { datos: payload, tipo: 'comprobante-despacho', fontSize: formato === 'ticket' ? fontTicket : 10, formato },
      { responseType: 'blob' }
    );
  }

  // Método legacy para HTML directo (si lo necesitas)
  generarPdfHtml(html: string, fontSize: number = 10): Observable<Blob> {
    return this.http.post(
      `${this.baseUrl}/generate-pdf`,
      { datos: { html }, fontSize },
      { responseType: 'blob' }
    );
  }

  descargar(blob: Blob, nombreArchivo = 'documento.pdf'): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  previsualizar(blob: Blob): void {
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank', 'width=900,height=800,scrollbars=yes,resizable=yes');
    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  }
}





// import { Injectable } from '@angular/core';
// import { HttpClient } from '@angular/common/http';
// import { Observable } from 'rxjs';

// // INTERFACES (puedes moverlas a pdf.models.ts si quieres)
// export interface Empresa {
//   logo: string;
//   nombre: string;
//   ruc: string;
//   direccion: string;
//   telefono: string;
// }

// export interface Cliente {
//   razonSocial: string;
//   ruc: string;
//   direccion: string;
//   telefono?: string;
//   email?: string;
// }

// export interface Item {
//   cant: number;
//   desc: string;
//   pUnit: number;
//   importe: number;
// }

// export interface Totales {
//   gravado: number;
//   inafecto: number;
//   exonerado: number;
//   exportacion: number;
//   descuentos: number;
//   gratuitos: number;
//   igv: number;
//   isc: number;
//   icbper: number;
//   total: number;
// }

// export interface DatosPdf {
//   comprobante: string;
//   emp: Empresa;
//   cli: Cliente;
//   items: Item[];
//   cantidadLetras: string;
//   totales: Totales;
//   resumenDigital: string;
//   observaciones: string[];
// }

// @Injectable({
//   providedIn: 'root'
// })
// export class PdfService {
//   private readonly baseUrl = 'http://localhost:3002/api/reports'; // backend Puppeteer

//   constructor(private http: HttpClient) {}

//   generarFactura(datos: DatosPdf, fontSize = 10): Observable<Blob> {
//     const html = this.armarHtml(datos, fontSize);
//     return this.generarPdf(html, fontSize);
//   }

//   private armarHtml(d: DatosPdf, fontSize: number): string {
//     const filas = d.items.map(i => `
//       <tr>
//         <td>${i.cant}</td>
//         <td>${i.desc}</td>
//         <td style="text-align:right">${i.pUnit.toFixed(2)}</td>
//         <td style="text-align:right">${i.importe.toFixed(2)}</td>
//       </tr>`).join('');

//     return `
//     <!DOCTYPE html>
//     <html>
//     <head>
//       <meta charset="UTF-8">
//       <style>
//         body{font-family:Arial,sans-serif;font-size:${fontSize}px;margin:0;padding:0}
//         .header{border-bottom:2px solid #0056b3;padding-bottom:10px;margin-bottom:20px}
//         .logo{max-width:100px}
//         .datos-empresa{padding-left:20px}
//         .datos-cliente{margin-top:20px;padding:10px;border:1px solid #ddd;background:#f9f9f9}
//         .detalle-factura{width:100%;border-collapse:collapse;margin-top:20px}
//         .detalle-factura th,.detalle-factura td{border:1px solid #ccc;padding:8px}
//         .detalle-factura th{background:#f2f2f2}
//         .text-center{text-align:center}
//         .text-end{text-align:right}
//         .totales-table{width:100%;border-collapse:collapse;margin-top:10px}
//         .totales-table td{padding:4px}
//         .totales-table td:nth-child(2){text-align:right}
//         .resumen-digital,.observaciones{margin-top:20px}
//       </style>
//     </head>
//     <body>
//       <div class="header">
//         <table style="width:100%;border:none">
//           <tr>
//             <td style="border:none; width: 30%;"><img src="${d.emp.logo}" alt="Logo" class="logo"></td>
//             <td style="border:none; width: 50%;" class="datos-empresa">
//               <h3>${d.emp.nombre}</h3>
//               <p>RUC: ${d.emp.ruc}<br>${d.emp.direccion}<br>Tel: ${d.emp.telefono}</p>
//             </td>
//             <td style="border:none; width: 20%;" class="text-end">
//               <p>RUC: ${d.emp.ruc}<br>FACTURA ELECTRONICA<br>Tel: ${d.comprobante}</p>
//             </td>
//           </tr>
//         </table>
//       </div>

//       <div class="datos-cliente">
//         <h4>DATOS DEL CLIENTE</h4>
//         <p><strong>Razón Social:</strong> ${d.cli.razonSocial}<br>
//         <strong>RUC:</strong> ${d.cli.ruc}<br>
//         <strong>Dirección:</strong> ${d.cli.direccion}<br>
//         <strong>Teléfono:</strong> ${d.cli.telefono || ''}<br>
//         <strong>Email:</strong> ${d.cli.email || ''}</p>
//       </div>

//       <table class="detalle-factura">
//         <thead><tr><th>Cant.</th><th>Descripción</th><th class="text-end">P. Unitario</th><th class="text-end">Importe</th></tr></thead>
//         <tbody>${filas}</tbody>
//       </table>

//       <table style="width:100%;margin-top:20px">
//         <tr>
//           <td style="width:60%;vertical-align:top"><strong>SON:</strong> ${d.cantidadLetras}</td>
//           <td style="width:40%">
//             <table class="totales-table">
//               <tr><td>Total Gravado</td>     <td>S/ ${d.totales.gravado.toFixed(2)}</td></tr>
//               <tr><td>Total Inafecto</td>    <td>S/ ${d.totales.inafecto.toFixed(2)}</td></tr>
//               <tr><td>Total Exonerado</td>   <td>S/ ${d.totales.exonerado.toFixed(2)}</td></tr>
//               <tr><td>Total Exportación</td> <td>S/ ${d.totales.exportacion.toFixed(2)}</td></tr>
//               <tr><td>Total Descuentos</td>  <td>S/ ${d.totales.descuentos.toFixed(2)}</td></tr>
//               <tr><td>Total Gratuitos</td>   <td>S/ ${d.totales.gratuitos.toFixed(2)}</td></tr>
//               <tr><td>Total IGV 18%</td>     <td>S/ ${d.totales.igv.toFixed(2)}</td></tr>
//               <tr><td>Total ISC</td>         <td>S/ ${d.totales.isc.toFixed(2)}</td></tr>
//               <tr><td>Total ICBPER</td>      <td>S/ ${d.totales.icbper.toFixed(2)}</td></tr>
//               <tr><td><strong>Importe Total</strong></td><td><strong>S/ ${d.totales.total.toFixed(2)}</strong></td></tr>
//             </table>
//           </td>
//         </tr>
//       </table>

//       <div class="resumen-digital"><strong>Resumen Digital:</strong><br>${d.resumenDigital}</div>
//       <div class="observaciones"><strong>OBSERVACIONES:</strong><br>${d.observaciones.map(o => `${o}<br>`).join('')}</div>
//     </body>
//     </html>`;
//   }

//   generarPdf(html: string, fontSize: number): Observable<Blob> {
//     return this.http.post(
//       `${this.baseUrl}/generate-pdf`,
//       { html, fontSize },
//       { responseType: 'blob' }
//     );
//   }

//   descargar(blob: Blob, nombreArchivo = 'documento.pdf'): void {
//     const url = window.URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = nombreArchivo;
//     a.click();
//     window.URL.revokeObjectURL(url);
//   }

//   previsualizar(blob: Blob): void {
//   const url = window.URL.createObjectURL(blob);
//   window.open(url, '_blank', 'width=900,height=800,scrollbars=yes,resizable=yes');
//   // Opcional: libera el objeto después de un tiempo
//   setTimeout(() => window.URL.revokeObjectURL(url), 15000);
//   }


//   //   generarPdfConHeader(
//   //   html: string,
//   //   fontSize = 10,
//   //   header?: HeaderPdf
//   // ): Observable<Blob> {
//   //   // si no mandan header usamos uno vacío para no romper
//   //   const headerHtml = header
//   //     ? this.construirHeader(header)
//   //     : '<div></div>';

//   //   return this.http.post(
//   //     `${this.baseUrl}/generate-pdf`,
//   //     { html, fontSize, headerHtml }, // <-- nuevo campo
//   //     { responseType: 'blob' }
//   //   );
//   // }

//   // private construirHeader(h: HeaderPdf): string {
//   //   return `
//   //   <div style="width:100%;font-size:8px">
//   //     <table style="width:100%;border-collapse:collapse">
//   //       <tr>
//   //         <td style="width:30%;text-align:left;vertical-align:top">${h.colIzq || ''}</td>
//   //         <td style="width:40%;text-align:center">${h.colCen || '<span class="pageNumber"></span> / <span class="totalPages"></span>'}</td>
//   //         <td style="width:30%;text-align:right;vertical-align:top">${h.colDer || ''}</td>
//   //       </tr>
//   //     </table>
//   //   </div>`;
//   // }
// }