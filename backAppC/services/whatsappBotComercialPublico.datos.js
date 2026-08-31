/**
 * Datos reales de /planes y del checkout (Yape / Plin / BCP).
 * El bot comercial los cita; no inventa montos ni cuentas.
 */
const { withPool } = require('../utils/dbPool.util');
const saasPlanesService = require('./saasPlanes.service');
const { getPagoManualSuscripcionConfig } = require('../config/pagoManualSuscripcion.config');

const CACHE_MS = 3 * 60 * 1000;
let cache = { at: 0, datos: null };

function soles(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return `S/ ${x.toFixed(2).replace(/\.00$/, '')}`;
}

function ultimo9(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  return d.slice(-9) || '';
}

async function cargarDatos() {
  const now = Date.now();
  if (cache.datos && now - cache.at < CACHE_MS) return cache.datos;
  try {
    const datos = await withPool(async (pool) => {
      const planes = await saasPlanesService.listarPlanesCatalogoAsync(pool);
      const pago = await getPagoManualSuscripcionConfig(pool);
      return { planes: Array.isArray(planes) ? planes : [], pago: pago || {} };
    });
    cache = { at: now, datos };
    return datos;
  } catch (err) {
    console.error('whatsappBotComercialPublico.datos:', err.message);
    return cache.datos || { planes: [], pago: {} };
  }
}

function textoPlanesReales(datos) {
  const planes = (datos?.planes || []).filter((p) => String(p.planCode || '').toLowerCase() !== 'enterprise');
  if (!planes.length) {
    return [
      'Te paso los planes en un momento, o escríbelos en la web.',
      'También puedes pedir *LLAMADA* y soporte te los detalla.'
    ].join('\n');
  }
  const lineas = ['Planes públicos vigentes (los mismos de la web):', ''];
  for (const p of planes) {
    const code = String(p.planCode || '').toLowerCase();
    if (code === 'demo') {
      lineas.push(`• *${p.nombre || 'Demo'}*: 14 días, *sin costo* y sin tarjeta.`);
      continue;
    }
    const m = soles(p.precioMensualPen);
    const a = soles(p.precioAnualPen);
    const precios = [m && `mensual ${m}`, a && `anual ${a}`].filter(Boolean).join(' · ');
    lineas.push(`• *${p.nombre || p.planCode}*${precios ? `: ${precios}` : ''}`);
    if (p.descripcionCorta) lineas.push(`  ${String(p.descripcionCorta).slice(0, 160)}`);
  }
  lineas.push('', 'La *demo* es 14 días gratis. El pago (tarjeta, Yape, Plin o depósito) se hace en la web; yo no cobro.');
  lineas.push('Si quieres un plan, dímelo y te doy el enlace o los datos de pago.');
  return lineas.join('\n');
}

function textoYapePlin(datos, medio) {
  const num = ultimo9(datos?.pago?.yapePlin);
  const etiqueta = medio === 'plin' ? 'Plin' : 'Yape';
  if (!num) {
    return [
      `Te paso el *${etiqueta}* por el checkout del plan, o escribe *LLAMADA* y soporte te lo confirma.`
    ].join('\n');
  }
  return [
    `*${etiqueta}* (el mismo del checkout público): *${num}*`,
    'Paga ese monto del plan que elegiste. Luego reporta el voucher en el checkout o avísame aquí *ya pagué*.',
    'Yo no cobro ni activo el plan: un administrador valida el pago.'
  ].join('\n');
}

function lineaCuenta(cta) {
  const partes = [
    cta.banco && `*${cta.banco}*`,
    cta.tipoCuenta && `(${cta.tipoCuenta})`,
    cta.moneda,
    cta.cuenta && `cta *${cta.cuenta}*`,
    cta.cci && `CCI *${cta.cci}*`
  ].filter(Boolean);
  return `• ${partes.join(' · ')}`;
}

function textoCuentaBancaria(datos) {
  const cuentas = Array.isArray(datos?.pago?.cuentas) ? datos.pago.cuentas.filter((c) => c?.cuenta || c?.cci) : [];
  const b = datos?.pago?.bcp || {};
  const lineas = ['Datos de depósito:'];
  if (b.titular) lineas.push(`• Titular: *${b.titular}*`);
  if (cuentas.length) {
    for (const cta of cuentas) lineas.push(lineaCuenta(cta));
  } else if (b.cuenta || b.cci) {
    lineas.push(lineaCuenta(b));
  } else {
    return [
      'Puedes pagar con *Yape* o *Plin* (pídemelo) o escribir *LLAMADA* y te pasan la cuenta.'
    ].join('\n');
  }
  lineas.push('', 'Después avísame *ya pagué*. Un administrador valida; yo no activo el plan.');
  return lineas.join('\n');
}

function textoMediosPago(datos) {
  const yape = ultimo9(datos?.pago?.yapePlin);
  const b = datos?.pago?.bcp || {};
  const lineas = [
    'Puedes pagar así:',
    '• *Tarjeta:* Culqi en la pantalla de suscripción (nunca me envíes el número de tarjeta).'
  ];
  if (yape) lineas.push(`• *Yape / Plin:* ${yape}`);
  const cuentas = Array.isArray(datos?.pago?.cuentas) ? datos.pago.cuentas.filter((c) => c?.cuenta) : [];
  if (cuentas.length) {
    if (b.titular) lineas.push(`• Titular depósito: ${b.titular}`);
    for (const cta of cuentas) lineas.push(lineaCuenta(cta));
  } else if (b.cuenta) {
    lineas.push(`• *Depósito ${b.banco || 'BCP'}:* cuenta ${b.cuenta}${b.cci ? ` · CCI ${b.cci}` : ''}`);
    if (b.titular) lineas.push(`  Titular: ${b.titular}`);
  }
  lineas.push('', 'Cuando pagues, escribe *ya pagué* y aviso al administrador. El plan lo habilita él, no este chat.');
  return lineas.join('\n');
}

function textoConfirmaPagoCliente() {
  return [
    'Quedó anotado: *dijiste que ya pagaste*. Aviso ahora al administrador de BUSINESS SOFT para que lo valide.',
    'Eso no activa el plan automáticamente (igual que en el checkout).',
    'Si pagaste por Yape/Plin/depósito, ten a mano el voucher.',
    'Si aún no registraste la empresa, te guío en el RUC cuando quieras.'
  ].join('\n');
}

function snapshotParaPrompt(datos) {
  const planes = (datos?.planes || []).map((p) => {
    const code = String(p.planCode || '');
    if (code.toLowerCase() === 'demo') return `${p.nombre || 'Demo'}: 14 días, S/ 0`;
    const m = soles(p.precioMensualPen);
    const a = soles(p.precioAnualPen);
    return `${p.nombre || code}: mensual ${m || 'n/d'} / anual ${a || 'n/d'}`;
  });
  const yape = ultimo9(datos?.pago?.yapePlin);
  const b = datos?.pago?.bcp || {};
  return {
    planesTxt: planes.length ? planes.join('; ') : '(catálogo no disponible)',
    yapePlin: yape || '',
    bcpTxt: (Array.isArray(datos?.pago?.cuentas) && datos.pago.cuentas.length
      ? datos.pago.cuentas.map((c) => [c.banco, c.cuenta && `cta ${c.cuenta}`, c.cci && `CCI ${c.cci}`].filter(Boolean).join(' '))
      : [[b.banco, b.titular, b.cuenta && `cta ${b.cuenta}`, b.cci && `CCI ${b.cci}`].filter(Boolean).join(' · ')]
    ).filter(Boolean).join('; ') || ''
  };
}

function parecePreguntaPlanes(texto, nlu) {
  if (nlu?.intencion === 'planes_saas') return true;
  return /\b(planes|qu[eé] planes|con qu[eé] planes|cu[aá]les son los planes|precio(s)?|cu[aá]nto (cuesta|vale)|plan mensual|plan anual)\b/i.test(
    String(texto || '')
  );
}

function parecePreguntaYape(texto) {
  return /\b(yape|n[uú]mero yape|al yape)\b/i.test(String(texto || ''));
}

function parecePreguntaPlin(texto) {
  return /\bplin\b/i.test(String(texto || ''));
}

function parecePreguntaCuenta(texto) {
  return /\b(a qu[eé] cuenta|n[uú]mero de cuenta|cuenta (bcp|bancaria)|dep[oó]sito|cci|transferencia bancaria|donde (pago|deposito)|a d[oó]nde (pago|deposito))\b/i.test(
    String(texto || '')
  );
}

function parecePreguntaMediosPago(texto) {
  return /\b(c[oó]mo (puedo )?pag(o|ar)|con qu[eé] (puedo )?pag|medios de pago|formas de pago)\b/i.test(
    String(texto || '')
  );
}

function pareceConfirmaPago(texto, nlu) {
  if (nlu?.intencion === 'confirma_pago_manual') return true;
  return /\b(ya pagu[eé]|ya yap[eé]|ya transfer[ií]|ya deposit[eé]|acabo de pagar|pagu[eé] (ya|ahora|hace|con|por)|realic[eé] el (pago|yape|dep[oó]sito)|envi[eé] (el )?voucher|ya envi[eé] el voucher|ya hice el (pago|dep[oó]sito|yape))\b/i.test(
    String(texto || '')
  );
}

module.exports = {
  cargarDatos,
  textoPlanesReales,
  textoYapePlin,
  textoCuentaBancaria,
  textoMediosPago,
  textoConfirmaPagoCliente,
  snapshotParaPrompt,
  parecePreguntaPlanes,
  parecePreguntaYape,
  parecePreguntaPlin,
  parecePreguntaCuenta,
  parecePreguntaMediosPago,
  pareceConfirmaPago
};
