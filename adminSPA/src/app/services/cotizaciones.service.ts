import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs';

export interface CotizacionCabecera {
  idComprobante: number;
  serie: string;
  numero: string;
  serieNumero?: string;
  fEmision: string;
  fVencimiento?: string | null;
  idDocumento?: string;
  idCliente: number;
  idSucursal?: string | number;
  moneda?: string | null;
  idCondicionPago?: number | null;
  total: number;
}

export interface CotizacionDetalle {
  cantidad: number;
  pVenta: number;
  subtotal: number;
  total: number;
  descuento?: number;
  igv?: number;
  isc?: number;
  codigo?: string;
  descripcion?: string;
  idPresentacion?: number;
  idSucursal?: number | string;
}

export interface CrearCotizacionPayload {
  cotizacion: CotizacionCabecera;
  detalles: CotizacionDetalle[];
}

export interface CotizacionListado {
  idCotizacion: number;
  serieNumero: string;
  serie: string;
  numero: string;
  fEmision: string;
  fVencimiento: string;
  total: number;
  idCliente: number;
  clienteRazonSocial?: string;
  clienteRuc?: string;
  nombreComprobante?: string;
  codigoComprobante?: string;
}

export interface CotizacionDetalleResponse {
  cabecera: {
    idCotizacion: number;
    serieNumero: string;
    idComprobante: number;
    serie: string;
    numero: string;
    fEmision: string;
    fVencimiento: string;
    idDocumento: string;
    idCliente: number;
    moneda?: string;
    idCondicionPago?: number;
    total: number;
    clienteRazonSocial?: string;
    clienteRuc?: string;
    nombreComprobante?: string;
    codigoComprobante?: string;
  };
  detalles: Array<{
    idDetalleCotizacion: number;
    cantidad: number;
    codigo: string;
    descripcion: string;
    idPresentacion: number;
    pVenta: number;
    descuentos: number;
    igv: number;
    ISC: number;
    total: number;
    idSucursal: number;
  }>;
}

export interface CotizacionParaVentaResponse {
  cabecera: {
    idCotizacion: number;
    idCliente: number;
    clienteRazonSocial?: string;
    clienteRuc?: string;
    total: number;
  };
  detalles: Array<{
    idProducto: string | null;
    codigo: string;
    descripcion: string;
    codigoPresentacion: string;
    idPresentacion: number;
    cantidad: number;
    pVenta: number;
    idSucursal?: string;
    nombreSucursal?: string;
  }>;
}

export interface ComprobantePdfData {
  venta: {
    compVenta: string;
    nombreComprobante?: string;
    codigoComprobante?: string;
    fEmision: string;
    subtotal: number;
    igv: number;
    exonerado?: number;
    gratuito?: number;
    otrosCargos?: number;
    descuentos: number;
    total: number;
    resumenHash?: string;
  };
  empresa: { nombre: string; ruc?: string; direccion?: string; telefono?: string; rubro?: string; correo?: string; logo?: string };
  cliente: { rSocial?: string; razonSocial?: string; ruc?: string; direccion?: string; tipoDocSunat?: string };
  items: Array<{ descripcion: string; cantidad: number; pVenta: number; subtotal?: number; total: number }>;
}

@Injectable({
  providedIn: 'root'
})
export class CotizacionesService {
  private url: string;

  constructor(private http: HttpClient) {
    this.url = global.url;
  }

  crearCotizacion(payload: CrearCotizacionPayload): Observable<{ success: boolean; idCotizacion?: number }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this.http.post<{ success: boolean; idCotizacion?: number }>(
      this.url + 'cotizaciones',
      payload,
      { headers, withCredentials: true }
    );
  }

  listar(filtros?: { fechaDesde?: string; fechaHasta?: string; idCliente?: number; serie?: string; numero?: string }): Observable<{ data: CotizacionListado[] }> {
    let params: Record<string, string> = {};
    if (filtros?.fechaDesde) params['fechaDesde'] = filtros.fechaDesde;
    if (filtros?.fechaHasta) params['fechaHasta'] = filtros.fechaHasta;
    if (filtros?.idCliente != null) params['idCliente'] = String(filtros.idCliente);
    if (filtros?.serie) params['serie'] = filtros.serie;
    if (filtros?.numero) params['numero'] = filtros.numero;
    return this.http.get<{ data: CotizacionListado[] }>(this.url + 'cotizaciones', {
      params,
      withCredentials: true
    });
  }

  obtenerPorId(id: number): Observable<{ data: CotizacionDetalleResponse }> {
    return this.http.get<{ data: CotizacionDetalleResponse }>(this.url + 'cotizaciones/' + id, { withCredentials: true });
  }

  /** Cotización con líneas listas para cargar en venta (idProducto resuelto por código). */
  obtenerParaVenta(id: number): Observable<{ data: CotizacionParaVentaResponse }> {
    return this.http.get<{ data: CotizacionParaVentaResponse }>(this.url + 'cotizaciones/' + id + '/para-venta', { withCredentials: true });
  }

  actualizar(id: number, payload: CrearCotizacionPayload): Observable<{ success: boolean; idCotizacion?: number }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this.http.put<{ success: boolean; idCotizacion?: number }>(
      this.url + 'cotizaciones/' + id,
      payload,
      { headers, withCredentials: true }
    );
  }

  eliminar(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(this.url + 'cotizaciones/' + id, { withCredentials: true });
  }

  getCotizacionParaPdf(id: number): Observable<{ data: ComprobantePdfData }> {
    return this.http.get<{ data: ComprobantePdfData }>(this.url + 'cotizaciones/' + id + '/pdf', { withCredentials: true });
  }
}
