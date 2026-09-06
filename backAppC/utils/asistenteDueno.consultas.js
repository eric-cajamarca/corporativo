/**
 * Ficha + consultas dinámicas del asistente de la plataforma.
 * No usar en el bot comercial de WhatsApp. Sin montos ni secretos.
 */

const PERMISO_RUTA = {
  configuracion: { permiso: 'VER_CONFIGURACION', ruta: '/configuracion?tab=facturacion', etiqueta: 'Facturación SUNAT' },
  caja: { permiso: 'VER_CAJA', ruta: '/caja', etiqueta: 'Gestión de Cajas' },
  creditos: { permiso: 'VER_CREDITOS', ruta: '/creditos', etiqueta: 'Cobranza de Créditos' },
  ventas: { permiso: 'VER_VENTAS', ruta: '/ventas', etiqueta: 'Ventas' },
  inventario: { permiso: 'VER_INVENTARIO', ruta: '/inventario/stock-actual', etiqueta: 'Stock actual' },
  kardex: { permiso: 'VER_INVENTARIO', ruta: '/inventario/kardex', etiqueta: 'Kardex' },
  guias: { permiso: 'VER_VENTAS', ruta: '/facturacion/emision-guias', etiqueta: 'Emisión de guías' },
  notas: { permiso: 'VER_VENTAS', ruta: '/facturacion/notas-credito-debito', etiqueta: 'Emisión de notas' }
};

function tienePermiso(ficha, permiso) {
  const lista = (ficha && ficha.permisos) || [];
  if (!lista.length) return true;
  return lista.includes(permiso);
}

function enlaceSiPuede(ficha, clave) {
  const def = PERMISO_RUTA[clave];
  if (!def) return '';
  if (!tienePermiso(ficha, def.permiso)) {
    return `Esa pantalla requiere permiso (${def.permiso}). Pida al administrador que se lo asigne.`;
  }
  return `[${def.etiqueta}](${def.ruta})`;
}

function sanitizarMensajeSunat(raw) {
  let t = String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  if (/-----BEGIN|pfx|password|clave/i.test(t)) return 'Error de envío a SUNAT (detalle oculto).';
  return t;
}

function extraerBusquedaProducto(texto) {
  const t = String(texto || '');
  const m =
    t.match(/\b(?:stock|existencia|kardex|hay|queda)\s+(?:de\s+|del\s+)?["']?([a-zA-ZÁÉÍÓÚÑáéíóúñ0-9][\wÁÉÍÓÚÑáéíóúñ0-9 .-]{1,40})/i) ||
    t.match(/\bproducto\s+["']?([a-zA-ZÁÉÍÓÚÑáéíóúñ0-9][\wÁÉÍÓÚÑáéíóúñ0-9 .-]{1,40})/i);
  if (!m) return '';
  return String(m[1] || '')
    .replace(/\?+$/, '')
    .trim()
    .slice(0, 40);
}

function parsearComprobante(raw) {
  const t = String(raw || '').trim();
  const m = t.match(/^([FBT][A-Z0-9]{1,4})[-\s]?(\d{1,8})$/i);
  if (!m) return null;
  return { serie: m[1].toUpperCase(), numero: parseInt(m[2], 10), comp: `${m[1].toUpperCase()}-${parseInt(m[2], 10)}` };
}

function extraerCompVenta(texto) {
  const t = String(texto || '');
  const m = t.match(/\b([FBT][A-Z0-9]{1,4})[-\s]?(\d{1,8})\b/i);
  if (!m) return '';
  return `${m[1].toUpperCase()}-${parseInt(m[2], 10)}`.slice(0, 20);
}

/**
 * Elige 0–2 consultas según la pregunta y la ruta. Nunca las 5 de golpe.
 */
function elegirConsultas(texto, ruta) {
  const t = String(texto || '');
  const r = String(ruta || '');
  const out = [];
  const add = (id) => {
    if (!out.includes(id) && out.length < 2) out.push(id);
  };

  if (/\b(caja|no (me )?deja (cobrar|vender|registrar)|cobrar deshabilit|abrir caja)\b/i.test(t) || /\/ventas\/(rapida|create)/i.test(r) && /\bno (me )?deja\b/i.test(t)) {
    add('caja');
  }
  if (/\b(sunat|rechaz|invocar el servicio|no emite|cdr|billService|e-beta)\b/i.test(t)) {
    add('sunat');
  }
  if (
    extraerBusquedaProducto(t) &&
    (/\b(stock|existencia|kardex|hay|queda)\b/i.test(t) || /\/inventario\//i.test(r))
  ) {
    add('stock');
  }
  if (/\b(cr[eé]dito|cuota|saldo|pag[oó]|cobranza)\b/i.test(t) && extraerCompVenta(t)) {
    add('venta');
  } else if (extraerCompVenta(t) && /\b(estado|pagad|pendiente|cr[eé]dito)\b/i.test(t)) {
    add('venta');
  }
  if (/\b(gu[ií]a(s)?|gre|remisi[oó]n)\b/i.test(t) || /\/facturacion\/(emision-guias|guias)/i.test(r) && /\bpuedo\b/i.test(t)) {
    add('guias');
  }
  return out;
}

function textoFicha(ficha) {
  if (!ficha) return 'FICHA: no disponible.';
  const p = ficha.puede || {};
  const fac = ficha.facturacion || {};
  const caja = ficha.caja || {};
  const guias = ficha.guias || {};
  return [
    'FICHA DE LA EMPRESA (sin secretos ni montos):',
    `- Rubro: ${ficha.rubro || 'no indicado'}. Gestora: ${ficha.esGestora ? 'sí' : 'no'}. Hotel: ${ficha.esHotel ? 'sí' : 'no'}.`,
    `- Rol: ${ficha.rol || 'usuario'}. Permisos clave: config=${p.configuracion ? 'sí' : 'no'}, ventas=${p.ventas ? 'sí' : 'no'}, caja=${p.caja ? 'sí' : 'no'}, créditos=${p.creditos ? 'sí' : 'no'}, inventario=${p.inventario ? 'sí' : 'no'}.`,
    `- Facturación: certificado=${fac.tieneCertificado ? 'sí' : 'no'}, usuario SOL=${fac.tieneUsuarioSunat ? 'sí' : 'no'}, serie factura=${fac.tieneSerieFactura ? 'sí' : 'no'}, serie boleta=${fac.tieneSerieBoleta ? 'sí' : 'no'}, URL beta=${fac.urlEsBeta ? 'sí' : 'no'}, resumen diario boletas=${fac.usaResumenDiario ? 'sí' : 'no'}.`,
    `- Caja: alguna abierta=${caja.algunaAbierta ? 'sí' : 'no'}. En sucursales del usuario: ${caja.abiertaEnUsuario ? 'sí' : caja.abiertaEnUsuario === false ? 'no' : 'no asignadas'}. Nombres sucursal con caja abierta: ${(caja.sucursalesAbiertas || []).join(', ') || 'ninguna'}.`,
    `- Guías: remitente=${guias.remitente ? 'sí' : 'no'}, transportista=${guias.transportista ? 'sí' : 'no'}.`,
    `- Productos activos: ${ficha.productos != null ? (ficha.productos > 0 ? 'sí' : 'no') : '?'}.`,
    'Si puede.X es no, NO indiques esa ruta; dile que pida el permiso al administrador.',
    'NUNCA inventes ni cites montos (S/, totales, saldos). Si hay deuda o un crédito, manda a la pantalla de créditos o de la venta.'
  ].join('\n');
}

function textoConsulta(id, data, ficha) {
  if (!data) return '';
  if (data.sinPermiso) {
    return data.mensaje || 'No tiene permiso para ese dato. Pida al administrador.';
  }
  if (id === 'caja') {
    const abiertas = (data.abiertas || []).join(', ') || 'ninguna';
    const enlace = enlaceSiPuede(ficha, 'caja');
    if (data.abiertaEnUsuario) {
      return `Caja: hay caja abierta en su sucursal (${abiertas}). Puede cobrar.`;
    }
    return `Caja: no hay caja abierta en su sucursal. Ábrala en ${enlace}. Sucursales con caja abierta en la empresa: ${abiertas}.`;
  }
  if (id === 'sunat') {
    const enlaceVentas = enlaceSiPuede(ficha, 'ventas');
    const enlaceCfg = enlaceSiPuede(ficha, 'configuracion');
    if (!data.encontrado) {
      return `No hay un rechazo SUNAT reciente. Revise el historial en ${enlaceVentas}.`;
    }
    const msg = sanitizarMensajeSunat(data.mensaje);
    const esInvocar = /invocar el servicio|timeout|ECONN|unavailable|soap/i.test(msg);
    const extra = esInvocar
      ? 'Eso no es un código SUNAT de negocio: no llegó a hablar con SUNAT (red, URL o certificado). Reintente en unos minutos.'
      : 'Ese texto es la respuesta de SUNAT; el cliente no ve XML.';
    const cfg = (ficha && ficha.puede && ficha.puede.configuracion) ? ` Si persiste y tiene permiso: ${enlaceCfg}.` : '';
    return `SUNAT ${data.comp || ''}: estado=${data.estado || '?'} código=${data.codigo || 's/c'}. Mensaje: ${msg || 'sin detalle'}. ${extra} Vea el comprobante en ${enlaceVentas}.${cfg}`;
  }
  if (id === 'stock') {
    const enlace = enlaceSiPuede(ficha, 'kardex');
    const stock = enlaceSiPuede(ficha, 'inventario');
    if (!data.encontrado) {
      return `No encontré un producto con ese nombre. Búsquelo en ${stock} o ${enlace}.`;
    }
    const con = data.sucursalesConStock || [];
    const sin = data.sucursalesSinStock || [];
    if (!con.length && !sin.length) {
      return `Producto «${data.descripcion}»: no hay lotes registrados. Revise ${stock} o ${enlace}.`;
    }
    return `Producto «${data.descripcion}»: hay existencias en ${con.join(', ') || 'ninguna sucursal'}. Sin existencias en ${sin.join(', ') || 'ninguna'}. Cantidades exactas: ${stock} o ${enlace}.`;
  }
  if (id === 'venta') {
    if (!data.encontrado) {
      return `No encontré esa venta. Búsquela en ${enlaceSiPuede(ficha, 'ventas')}.`;
    }
    const credito = data.esCredito ? 'es al crédito' : 'no está marcada al crédito';
    const pago = data.estadoPago || 'estado de pago no leído';
    const sunat = data.estadoSunat ? ` SUNAT: ${data.estadoSunat}.` : '';
    const dest = data.esCredito || /pendiente|crédito|credito/i.test(pago)
      ? enlaceSiPuede(ficha, 'creditos')
      : enlaceSiPuede(ficha, 'ventas');
    return `Venta ${data.comp}: ${credito}; pago: ${pago}.${sunat} Montos y cuotas: véalos en ${dest}.`;
  }
  if (id === 'guias') {
    if (!data.remitente) {
      const cfg = enlaceSiPuede(ficha, 'configuracion');
      return `Guías electrónicas no están habilitadas en esta empresa. Si tiene permiso: ${cfg} (Facturación). Si no, pida al administrador.`;
    }
    const extra = data.transportista ? 'También puede guía transportista.' : 'Guía transportista no aplica (sin vehículos o no habilitada).';
    return `Sí puede emitir guía remitente. ${extra} Vaya a ${enlaceSiPuede(ficha, 'guias')}.`;
  }
  return '';
}

module.exports = {
  PERMISO_RUTA,
  tienePermiso,
  enlaceSiPuede,
  sanitizarMensajeSunat,
  extraerBusquedaProducto,
  extraerCompVenta,
  parsearComprobante,
  elegirConsultas,
  textoFicha,
  textoConsulta
};
