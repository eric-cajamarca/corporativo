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
    fVencimiento?: string | null;
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
    compRelacionado?: string | null;
    observaciones?: string | null;
    tipoComprobanteDestino?: string;
    idEstadoPedido?: number;
    idEstadoPago?: number;
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
    idSucursalEmpresa?: string;
    aliasEmpresa?: string;
    sucursal?: string;
    descripcion?: string;
    codigo?: string;
  }>;
  detallePago?: Array<{ idMediosPago: number; monto: number }>;
  idApertura?: string;
}

export interface ComprobanteVentaAgrupada {
  idVenta: number;
  compVenta: string;
  serie: string;
  numero: string;
  idComprobante: number;
  nombreComprobante?: string;
  codigoComprobante?: string;
  empresaRazonSocial?: string;
  empresaRuc?: string;
  fEmision: string;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class VentasService {
  public url: string;

  constructor(private _http: HttpClient) {
    this.url = global.url;
  }

  crearVentaCompleta(payload: VentaCompletaPayload): Observable<{ success: boolean; idVentaAgrupada?: string; avisoStockInsuficiente?: string }> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.post<{ success: boolean; idVentaAgrupada?: string; avisoStockInsuficiente?: string }>(
      this.url + 'ventas/completa',
      payload,
      { headers, withCredentials: true }
    );
  }

  /** Lista ventas agrupadas (total corporativo). */
  listarVentasAgrupadas(): Observable<{ data: VentaAgrupadaListado[] }> {
    return this._http.get<{ data: VentaAgrupadaListado[] }>(this.url + 'ventas/agrupadas', { withCredentials: true });
  }

  /** Lista ventas por empresa (comprobantes). */
  listarVentasEmpresa(): Observable<{ data: VentaListado[] }> {
    return this._http.get<{ data: VentaListado[] }>(this.url + 'ventas/listar', { withCredentials: true });
  }

  /** Lista comprobantes asociados a una venta agrupada. */
  listarComprobantesVentaAgrupada(idVentaAgrupada: string): Observable<{ data: ComprobanteVentaAgrupada[] }> {
    return this._http.get<{ data: ComprobanteVentaAgrupada[] }>(
      this.url + 'ventas/agrupadas/' + idVentaAgrupada + '/comprobantes',
      { withCredentials: true }
    );
  }

  /** Datos de una venta para generar comprobante PDF o edición (empresa, venta, cliente, items). */
  getComprobanteParaPdf(idVenta: number): Observable<{ data: ComprobantePdfData }> {
    return this._http.get<{ data: ComprobantePdfData }>(
      this.url + 'ventas/comprobante/' + idVenta,
      { withCredentials: true }
    );
  }

  /** Datos del comprobante VA (Venta Agrupada) para ticket térmico / impresión (no PDF A4). */
  getComprobanteVAParaPdf(idVentaAgrupada: string): Observable<{ data: ComprobanteVAPdfData }> {
    return this._http.get<{ data: ComprobanteVAPdfData }>(
      this.url + 'ventas/agrupadas/' + idVentaAgrupada + '/comprobante-va',
      { withCredentials: true }
    );
  }

  /** Actualiza cabecera y detalle de una venta (solo si no está aceptada en SUNAT). */
  actualizarVenta(idVenta: number, payload: { venta: VentaEdicionPayload; detalles: DetalleVentaEdicionPayload[] }): Observable<{ message?: string }> {
    return this._http.put<{ message?: string }>(
      this.url + 'ventas/editar/' + idVenta,
      payload,
      { withCredentials: true }
    );
  }

  /** Lista entregas parciales de una venta (DetalleVentaEntrega). */
  getEntregas(idVenta: number): Observable<{ data: EntregaItem[] }> {
    return this._http.get<{ data: EntregaItem[] }>(
      this.url + 'ventas/' + idVenta + '/entregas',
      { withCredentials: true }
    );
  }

  /** Registra una entrega parcial. Body: idVenta, idDetalle, cantidad, notas? */
  crearEntrega(body: { idVenta: number; idDetalle: number; cantidad: number; notas?: string }): Observable<{ data: { idEntrega: number } }> {
    return this._http.post<{ data: { idEntrega: number } }>(
      this.url + 'ventas/entregas',
      body,
      { withCredentials: true }
    );
  }

  /** Config por defecto para nueva venta (estado pedido, estado pago). */
  getConfigDefaults(): Observable<{ data: { idEstadoPedidoPorDefecto: number; idEstadoPagoPorDefecto: number } }> {
    return this._http.get<{ data: { idEstadoPedidoPorDefecto: number; idEstadoPagoPorDefecto: number } }>(
      this.url + 'ventas/config-defaults',
      { withCredentials: true }
    );
  }

  putConfigDefaults(body: { idEstadoPedidoPorDefecto?: number; idEstadoPagoPorDefecto?: number }): Observable<{ message: string }> {
    return this._http.put<{ message: string }>(
      this.url + 'ventas/config-defaults',
      body,
      { withCredentials: true }
    );
  }

  /** Ventas agrupadas pendientes de pago (idEstadoPago = 1). Params: idVentaAgrupada?, cliente? */
  getPendientesPago(params?: { idVentaAgrupada?: string; cliente?: string }): Observable<{ data: VentaPendientePagoAgrupada[] }> {
    const q = new URLSearchParams();
    if (params?.idVentaAgrupada) q.set('idVentaAgrupada', params.idVentaAgrupada);
    if (params?.cliente) q.set('cliente', params.cliente);
    const query = q.toString();
    return this._http.get<{ data: VentaPendientePagoAgrupada[] }>(
      this.url + 'ventas/agrupadas/pendientes-pago' + (query ? '?' + query : ''),
      { withCredentials: true }
    );
  }

  /** Ventas pendientes de pago por empresa. Params: idVenta?, cliente? */
  getPendientesPagoEmpresa(params?: { idVenta?: string; cliente?: string }): Observable<{ data: VentaPendientePago[] }> {
    const q = new URLSearchParams();
    if (params?.idVenta) q.set('idVenta', params.idVenta);
    if (params?.cliente) q.set('cliente', params.cliente);
    const query = q.toString();
    return this._http.get<{ data: VentaPendientePago[] }>(
      this.url + 'ventas/pendientes-pago' + (query ? '?' + query : ''),
      { withCredentials: true }
    );
  }

  /** Registrar cobro de una venta agrupada pendiente. */
  cobrarVentaAgrupada(idVentaAgrupada: string, body: { detallePago: Array<{ idMediosPago: number; monto: number }>; idApertura?: string }): Observable<{ message: string }> {
    return this._http.post<{ message: string }>(
      this.url + 'ventas/agrupadas/' + idVentaAgrupada + '/cobrar',
      body,
      { headers: new HttpHeaders({ 'Content-Type': 'application/json' }), withCredentials: true }
    );
  }

  /** Registrar cobro de una venta pendiente por empresa. */
  cobrarVenta(idVenta: number, body: { detallePago: Array<{ idMediosPago: number; monto: number }>; idApertura?: string }): Observable<{ message: string }> {
    return this._http.post<{ message: string }>(
      this.url + 'ventas/' + idVenta + '/cobrar',
      body,
      { headers: new HttpHeaders({ 'Content-Type': 'application/json' }), withCredentials: true }
    );
  }

  /** Anula lógicamente un comprobante (restaura stock). No permitido si ya enviado a SUNAT. */
  anularVenta(idVenta: number): Observable<{ message: string }> {
    return this._http.delete<{ message: string }>(
      this.url + 'ventas/anular/' + idVenta,
      { withCredentials: true }
    );
  }
}

export interface VentaPendientePagoAgrupada {
  idVentaAgrupada: string;
  fEmision: string;
  total: number;
  idEstadoPago: number;
  clienteRazonSocial: string;
  clienteRuc: string;
  compVenta?: string;
  serie?: string;
  numero?: string;
  tipoComprobanteDestino?: string;
}

export interface VentaPendientePago {
  idVenta: number;
  compVenta: string;
  serie: string;
  numero: string;
  fEmision: string;
  total: number;
  idEstadoPago: number;
  clienteRazonSocial: string;
  clienteRuc: string;
}

export interface EntregaItem {
  idEntrega: number;
  idVenta: number;
  idDetalle: number;
  cantidad: number;
  fEntrega: string;
  usuarioNombre: string;
  notas: string | null;
  productoCodigo?: string;
  productoDescripcion?: string;
}

export interface VentaEdicionPayload {
  fEmision: string;
  idCliente?: number;
  subtotal: number;
  igv: number;
  descuentos: number;
  total: number;
}

export interface DetalleVentaEdicionPayload {
  idProducto: string;
  cantidad: number;
  pVenta: number;
  descuento?: number;
  subtotal?: number;
  total: number;
  igv?: boolean;
  isc?: boolean;
}

export interface ComprobantePdfData {
  venta: {
    idVenta?: number;
    idEstadoSunat?: number | null;
    idSucursal?: string;
    idComprobante?: number;
    idCliente?: number;
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
    eliminado?: boolean;
  };
  empresa: { nombre: string; ruc?: string; direccion?: string; telefono?: string; rubro?: string; correo?: string; logo?: string };
  cliente: { rSocial?: string; razonSocial?: string; ruc?: string; direccion?: string; tipoDocSunat?: string };
  items: Array<{
    idDetalle?: number;
    idProducto?: string;
    codigo?: string;
    descripcion: string;
    cantidad: number;
    cantEntregada?: number;
    pVenta: number;
    subtotal?: number;
    total: number;
  }>;
}

export interface VentaAgrupadaListado {
  idVentaAgrupada: string;
  fEmision: string;
  total: number;
  clienteRazonSocial?: string;
  clienteRuc?: string;
  idEstadoPago?: number;
  idSucursal?: string;
  sucursal?: string;
  compVenta?: string;
  serie?: string;
  numero?: string;
  tipoComprobanteDestino?: string;
  observaciones?: string;
}

export interface ComprobanteVAPdfData {
  venta: {
    idVentaAgrupada: string;
    compVenta: string;
    serie?: string;
    numero?: string;
    fEmision: string;
    subtotal: number;
    igv: number;
    descuentos: number;
    total: number;
    idEstadoPago?: number;
    tipoComprobanteDestino?: string;
    tipoComprobanteDestinoNombre?: string;
    observaciones?: string;
    sucursal?: string;
  };
  empresa: { nombre: string; ruc?: string; direccion?: string; telefono?: string; rubro?: string; correo?: string; logo?: string };
  cliente: { rSocial?: string; razonSocial?: string; ruc?: string; celular?: string; direccion?: string; tipoDocSunat?: string };
  items: Array<{
    idDetalleVA?: number;
    idProducto?: string;
    codigo?: string;
    descripcion?: string;
    cantidad: number;
    pVenta: number;
    descuento?: number;
    subtotal?: number;
    total: number;
    aliasEmpresa?: string;
    sucursal?: string;
    idEmpresaProducto?: string;
  }>;
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
  /** Código tipo comprobante electrónico: 01=Factura, 03=Boleta, 07=NC, 08=ND. */
  tipoComprobante?: string;
  clienteRazonSocial?: string;
  clienteRuc?: string;
  condicionPago?: string;
  /** Código del tipo de comprobante en BD (ej. CT=Cotización, NV=Nota de venta, 01=Factura, 03=Boleta). */
  codigoComprobante?: string;
  /** Presente cuando la venta tiene comprobante electrónico (para botón Enviar a SUNAT). */
  idComprobanteElectronico?: string;
  /** True si el comprobante tiene XML generado (Facturador). */
  tieneXml?: boolean;
  /** True si el comprobante tiene CDR de SUNAT. */
  tieneCdr?: boolean;
  /** Formas de pago usadas (ej. {YAP,EFE,PLI}). */
  formaPago?: string;
  /** True si el comprobante fue anulado/eliminado (registro tachado). */
  eliminado?: boolean;
}
