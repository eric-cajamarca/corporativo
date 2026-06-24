import {
  PosAlertaTemprana,
  construirAlertaValidacionTemprana,
  validarClienteSunatParaComprobante
} from './pos-validacion.util';
import { codigoComprobanteSunatGestora } from './gestora-venta.util';

export interface ValidacionCobroGestoraInput {
  esCotizacion: boolean;
  bloqueoSucursal: boolean;
  idSucursal: string | null | undefined;
  tieneCajaAbierta: boolean;
  nombresCajasAbiertas?: string[];
  tipoComprobanteDestino: string | null | undefined;
  idDocumento: string | number | null | undefined;
  numeroDocumento: string | null | undefined;
  razonSocial?: string | null;
  permitirVentasNegativas: boolean;
  lineaSinStock?: { descripcion?: string; codigo?: string } | null;
}

export interface ValidacionCobroGestoraResult {
  valido: boolean;
  titulo?: string;
  mensaje?: string;
}

/** Alerta temprana de caja/sucursal para empresa gestora (misma regla operativa que comercio). */
export function construirAlertaValidacionTempranaGestora(ctx: {
  esCotizacion: boolean;
  bloqueoSucursal: boolean;
  idSucursal: string | null | undefined;
  tieneCajaAbierta: boolean;
  nombresCajasAbiertas?: string[];
}): PosAlertaTemprana | null {
  return construirAlertaValidacionTemprana(ctx);
}

/**
 * Validación previa al cobro/registro en empresa gestora.
 * Aislada del flujo POS/hotel: usa comprobante destino (no VA) y no aplica reglas de rubro hotel.
 */
export function validarAntesDeCobrarGestora(input: ValidacionCobroGestoraInput): ValidacionCobroGestoraResult {
  const alerta = construirAlertaValidacionTempranaGestora({
    esCotizacion: input.esCotizacion,
    bloqueoSucursal: input.bloqueoSucursal,
    idSucursal: input.idSucursal,
    tieneCajaAbierta: input.tieneCajaAbierta,
    nombresCajasAbiertas: input.nombresCajasAbiertas
  });

  if (alerta?.tipo === 'danger') {
    return {
      valido: false,
      titulo: 'No se puede registrar',
      mensaje: alerta.mensaje
    };
  }

  const codComp = codigoComprobanteSunatGestora(input.tipoComprobanteDestino);
  const sunat = validarClienteSunatParaComprobante({
    codigoComprobante: codComp,
    idDocumento: input.idDocumento,
    numeroDocumento: input.numeroDocumento,
    razonSocial: input.razonSocial
  });
  if (!sunat.valido) {
    return {
      valido: false,
      titulo: 'Validación SUNAT',
      mensaje: sunat.mensaje || 'Datos del cliente inválidos.'
    };
  }

  if (!input.permitirVentasNegativas && input.lineaSinStock) {
    const ln = input.lineaSinStock;
    return {
      valido: false,
      titulo: 'Stock insuficiente',
      mensaje: `Revise cantidades: ${ln.descripcion || ln.codigo || 'producto'}.`
    };
  }

  return { valido: true };
}
