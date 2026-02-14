import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs';

export interface VentaCompletaPayload {
  venta: {
    idSucursal: string;
    serie: string;
    numero: string;
    compVenta: string;
    idComprobante: number;
    fEmision: string;
    fVencimiento: string;
    idCliente: number;
    idMoneda: number;
    tCambio?: number;
    subtotal: number;
    igv: number;
    exonerado?: number;
    gratuito?: number;
    otrosCargos?: number;
    descuentos?: number;
    total: number;
    idMediosPago: string;
    idEstadoSunat?: number;
    compRelacionado?: string;
  };
  detalles: Array<{
    idProducto: string;
    cantidad: number;
    pVenta: number;
    descuento?: number;
    subtotal: number;
    igv?: number;
    isc?: number;
    total: number;
    hVenta?: string;
    cantEntregada?: number;
    idEstadoPedido?: number;
  }>;
  detallePago?: Array<{ idMediosPago: number; monto: number }>;
  idApertura?: string;
}

@Injectable({
  providedIn: 'root'
})
export class VentasService {
  public url: string;

  constructor(private _http: HttpClient) {
    this.url = global.url;
  }

  crearVentaCompleta(payload: VentaCompletaPayload): Observable<{ success: boolean; idVenta?: number }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.post<{ success: boolean; idVenta?: number }>(
      this.url + 'ventas/completa',
      payload,
      { headers, withCredentials: true }
    );
  }

  /** Lista comprobantes de venta de la empresa (cabecera con comprobante y cliente). */
  listarVentasEmpresa(): Observable<{ data: VentaListado[] }> {
    return this._http.get<{ data: VentaListado[] }>(this.url + 'ventas/listar', { withCredentials: true });
  }

  /** Datos de una venta para generar comprobante PDF (empresa, venta, cliente, items). */
  getComprobanteParaPdf(idVenta: number): Observable<{ data: ComprobantePdfData }> {
    return this._http.get<{ data: ComprobantePdfData }>(
      this.url + 'ventas/comprobante/' + idVenta,
      { withCredentials: true }
    );
  }
}

export interface ComprobantePdfData {
  venta: { compVenta: string; nombreComprobante?: string; fEmision: string; subtotal: number; igv: number; descuentos: number; total: number };
  empresa: { nombre: string; ruc?: string; direccion?: string; telefono?: string };
  cliente: { rSocial?: string; razonSocial?: string; ruc?: string; direccion?: string };
  items: Array<{ descripcion: string; cantidad: number; pVenta: number; subtotal?: number; total: number }>;
}

export interface VentaListado {
  idVenta: number;
  compVenta: string;
  fEmision: string;
  total: number;
  idEstadoSunat?: number;
  serie?: string;
  numero?: string;
  nombreComprobante?: string;
  clienteRazonSocial?: string;
  clienteRuc?: string;
}
