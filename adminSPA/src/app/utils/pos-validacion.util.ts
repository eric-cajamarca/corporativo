/** Alerta temprana de caja / sucursal en pantallas POS. */
export interface PosAlertaTemprana {
  tipo: 'ok' | 'warning' | 'danger';
  mensaje: string;
}

export function construirAlertaValidacionTemprana(ctx: {
  esCotizacion: boolean;
  bloqueoSucursal: boolean;
  idSucursal: string | null | undefined;
  tieneCajaAbierta: boolean;
  nombresCajasAbiertas?: string[];
}): PosAlertaTemprana | null {
  if (ctx.esCotizacion) {
    return null;
  }
  if (ctx.bloqueoSucursal) {
    return {
      tipo: 'danger',
      mensaje: 'Su usuario no tiene sucursales asignadas. Solicite asignación al administrador.'
    };
  }
  if (!ctx.idSucursal) {
    return {
      tipo: 'warning',
      mensaje: 'Seleccione sucursal. Debe tener una caja abierta para registrar ventas.'
    };
  }
  if (!ctx.tieneCajaAbierta) {
    const det = ctx.nombresCajasAbiertas?.length
      ? ` Cajas abiertas en: ${ctx.nombresCajasAbiertas.join(', ')}.`
      : '';
    return {
      tipo: 'danger',
      mensaje: `No hay caja abierta en la sucursal seleccionada.${det} Abra caja en Caja → Gestión de cajas.`
    };
  }
  return {
    tipo: 'ok',
    mensaje: 'Listo para vender. Caja abierta en la sucursal activa.'
  };
}

export function codigoComprobanteDesdeLista(
  comprobantes: Array<{ idComprobante?: string | number; codigo?: string }>,
  idComprobante: string | number | null | undefined
): string {
  const id = String(idComprobante ?? '').trim();
  if (!id) {
    return '';
  }
  const comp = (comprobantes || []).find((c) => String(c.idComprobante) === id);
  return String(comp?.codigo ?? '').trim();
}

/** Boleta electrónica: valor de fábrica hasta que la empresa configure otro. */
export const CODIGO_COMPROBANTE_VENTA_DEFECTO = '03';

export const OPCIONES_COMPROBANTE_VENTA_DEFECTO: Array<{ codigo: string; nombre: string }> = [
  { codigo: '03', nombre: 'Boleta electrónica' },
  { codigo: '01', nombre: 'Factura electrónica' },
  { codigo: 'NV', nombre: 'Nota de venta' }
];

export function normalizarCodigoComprobantePorDefecto(valor?: string | null): string {
  const raw = String(valor ?? '').trim();
  if (!raw) {
    return CODIGO_COMPROBANTE_VENTA_DEFECTO;
  }
  return raw.toUpperCase() === 'NV' ? 'NV' : raw;
}

/** Elige el comprobante de venta por código de empresa; si no existe, boleta 03 y luego el primero. */
export function elegirComprobantePorCodigoDefecto<T extends { codigo?: string; idComprobante?: string | number }>(
  comprobantes: T[] | null | undefined,
  codigoPreferido?: string | null
): T | undefined {
  if (!Array.isArray(comprobantes) || comprobantes.length === 0) {
    return undefined;
  }
  const pref = normalizarCodigoComprobantePorDefecto(codigoPreferido).toUpperCase();
  const porPref = comprobantes.find(
    (c) => String(c.codigo ?? '').trim().toUpperCase() === pref
  );
  if (porPref) {
    return porPref;
  }
  const boleta = comprobantes.find(
    (c) => String(c.codigo ?? '').trim() === CODIGO_COMPROBANTE_VENTA_DEFECTO
  );
  return boleta ?? comprobantes[0];
}

/** Reglas SUNAT mínimas antes de cobrar (factura/boleta). */
export function validarClienteSunatParaComprobante(input: {
  codigoComprobante: string;
  idDocumento: string | number | null | undefined;
  numeroDocumento: string | null | undefined;
  razonSocial?: string | null;
}): { valido: boolean; mensaje?: string } {
  const cod = String(input.codigoComprobante || '').trim();
  const num = String(input.numeroDocumento || '').trim();
  const idDoc = String(input.idDocumento ?? '').trim();
  const rSocial = String(input.razonSocial || '').trim();

  if (cod === '01') {
    if (idDoc !== '6') {
      return { valido: false, mensaje: 'Factura requiere tipo de documento RUC.' };
    }
    if (!/^\d{11}$/.test(num)) {
      return { valido: false, mensaje: 'Factura requiere RUC de 11 dígitos.' };
    }
    if (num === '00000000000' || num.startsWith('00000000')) {
      return { valido: false, mensaje: 'RUC inválido para factura electrónica.' };
    }
    if (!rSocial || /varios/i.test(rSocial)) {
      return { valido: false, mensaje: 'Factura requiere cliente con razón social válida (no "Varios").' };
    }
  }

  if (cod === '03') {
    if (idDoc === '1' && num && !/^\d{8}$/.test(num)) {
      return { valido: false, mensaje: 'Boleta con DNI debe tener 8 dígitos.' };
    }
    if (idDoc === '6' && num && !/^\d{11}$/.test(num)) {
      return { valido: false, mensaje: 'Boleta con RUC debe tener 11 dígitos.' };
    }
  }

  return { valido: true };
}

export function validarStockLinea(params: {
  cantidadNueva: number;
  stockDisponible: number | null;
  permitirVentasNegativas: boolean;
  nombreProducto?: string;
  /** Presentación ZZ (servicio): no valida stock. */
  esServicio?: boolean;
}): { valido: boolean; mensaje?: string; advertencia?: string } {
  if (params.esServicio) {
    return { valido: true };
  }
  const nombre = params.nombreProducto || 'el producto';
  if (params.permitirVentasNegativas) {
    if (params.stockDisponible != null && params.stockDisponible <= 0) {
      return {
        valido: true,
        advertencia: `Sin stock registrado para ${nombre}. Se permitirá por configuración.`
      };
    }
    return { valido: true };
  }
  if (params.stockDisponible == null) {
    return { valido: true };
  }
  if (params.stockDisponible <= 0) {
    return { valido: false, mensaje: `Sin stock para ${nombre}.` };
  }
  if (params.cantidadNueva > params.stockDisponible) {
    return {
      valido: false,
      mensaje: `Stock insuficiente para ${nombre}: disponible ${params.stockDisponible}, solicitado ${params.cantidadNueva}.`
    };
  }
  return { valido: true };
}
