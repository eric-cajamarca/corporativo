/**
 * Fase 3 - Escalamiento a humano (handoff).
 *
 * Cuando un cliente pide hablar con una persona real (intencion 'solicitar_agente')
 * o el bot supero el umbral de "no entiendo", marcamos la conversacion como
 * 'escalada' y notificamos al vendedor. Mientras la conversacion este escalada
 * el bot guarda silencio (solo loguea inbound) hasta que expire el timeout o
 * un admin la libere.
 *
 * Estado se persiste DENTRO de conv.slots para no requerir nuevas tablas:
 *   slots.escalada = {
 *     hasta: '2026-05-26T22:30:00.000Z',  // ISO timestamp
 *     motivo: 'cliente|umbral|admin',
 *     numeroVendedor: '51999999999',
 *     fEscalado: '...'
 *   }
 */

const whatsappGatewayClient = require('./whatsappGateway.client');
const { getAhoraAppIsoLocal } = require('../utils/fechaDisplay.util');
const { normalizarTelefonoWhatsApp } = require('../utils/telefonoWhatsApp.util');

function ahoraIso() { return getAhoraAppIsoLocal(); }

function ofuscarTel(tel) {
  const s = String(tel || '').replace(/\D/g, '');
  if (s.length <= 4) return '****';
  return `${s.slice(0, 3)}****${s.slice(-3)}`;
}

function destinosPe(valor) {
  const d = normalizarTelefonoWhatsApp(valor).digitos;
  return d.length >= 9 ? d : '';
}

function resolverNumeroVendedor(config, telefonoVinculadoBot, extras = {}) {
  const propio = destinosPe(telefonoVinculadoBot);
  const candidatos = [
    extras.celularEmpresa,
    config?.numeroEscalamiento,
    process.env.PAGO_MANUAL_WHATSAPP,
    telefonoVinculadoBot
  ]
    .map(destinosPe)
    .filter(Boolean);
  const distintoDelBot = candidatos.find((n) => n !== propio);
  return distintoDelBot || candidatos[0] || null;
}

function estaEscalada(conv) {
  const e = conv?.slots?.escalada;
  if (!e || !e.hasta) return false;
  const hasta = Date.parse(e.hasta);
  if (Number.isNaN(hasta)) return false;
  return hasta > Date.now();
}

/**
 * Si la escalada ya vencio (o el slot quedo inconsistente), limpia el estado
 * para que el bot vuelva a responder sin esperar MENU manual.
 */
function limpiarEscaladaExpirada(conv) {
  if (!conv) return conv;
  const e = conv.slots?.escalada;
  const estadoEscalado = conv.estado === 'escalada' || conv.estado === 'ofreciendo_agente';

  if (!e && !estadoEscalado) return conv;

  if (e?.hasta && estaEscalada(conv)) return conv;

  return desescalar(conv);
}

function marcarEscalada(conv, { timeoutMin, motivo, numeroVendedor }) {
  const slots = { ...(conv?.slots || {}) };
  const min = Math.max(1, Math.min(1440, Number(timeoutMin) || 60));
  const hasta = new Date(Date.now() + min * 60 * 1000).toISOString();
  slots.escalada = {
    hasta,
    motivo: String(motivo || 'cliente'),
    numeroVendedor: numeroVendedor || null,
    fEscalado: ahoraIso()
  };
  // Reseteamos el contador de "no entiendo" para no repetir oferta inmediatamente al volver.
  delete slots.noEntiendoConsecutivos;
  return {
    estado: 'escalada',
    slots,
    candidatos: []
  };
}

function desescalar(conv) {
  const slots = { ...(conv?.slots || {}) };
  delete slots.escalada;
  delete slots.ofreciendoAgente;
  return {
    estado: 'menu',
    slots,
    candidatos: []
  };
}

/**
 * Notifica al vendedor por WhatsApp del bot que un cliente pide ayuda humana.
 * Best-effort: si el gateway no responde, registramos pero no rompemos el turno.
 */
async function notificarVendedor(idEmpresa, params) {
  const {
    numeroVendedor,
    telefonoCliente,
    nombreCliente,
    motivo,
    ultimosMensajes,
    minutosBloqueo
  } = params;

  if (!numeroVendedor) {
    console.error('whatsappBotEscalamiento: sin numeroVendedor configurado, alerta omitida');
    return { ok: false, skipped: true };
  }

  const lineas = [
    '*Cliente solicita atención humana* 🆘',
    `Cliente: ${nombreCliente ? `*${nombreCliente}* ` : ''}(+${telefonoCliente})`,
    `Motivo: ${motivo === 'umbral' ? 'el bot no logró entender' : motivo === 'admin' ? 'derivado por admin' : 'el cliente lo pidió'}`,
    `Bot en pausa: ${minutosBloqueo} min en ese chat.`,
    ''
  ];

  if (Array.isArray(ultimosMensajes) && ultimosMensajes.length > 0) {
    lineas.push('*Últimos mensajes:*');
    for (const m of ultimosMensajes.slice(-5)) {
      const flecha = m.direccion === 'in' ? '👤' : '🤖';
      const txt = String(m.texto || '').slice(0, 120).replace(/\n+/g, ' ');
      lineas.push(`${flecha} ${txt}`);
    }
    lineas.push('');
  }

  lineas.push(`Responde directamente al cliente desde tu WhatsApp.`);

  try {
    const r = await whatsappGatewayClient.sendText(idEmpresa, numeroVendedor, lineas.join('\n'), { skipThrottle: true });
    if (!r.success) {
      console.error('whatsappBotEscalamiento: gateway respondio', r.status, r.message);
      return { ok: false, error: r.message };
    }
    return { ok: true };
  } catch (err) {
    console.error('whatsappBotEscalamiento notificarVendedor:', err.message);
    return { ok: false, error: err.message };
  }
}

async function notificarInteresComercial(idEmpresa, params) {
  const {
    numeroVendedor,
    telefonoCliente,
    nombreCliente,
    comercial,
    motivo,
    canal,
    digitosCelular,
    ultimoMensaje
  } = params;

  const destino = destinosPe(numeroVendedor);
  if (!destino) {
    console.error('whatsappBotEscalamiento: interes comercial sin numeroVendedor');
    return { ok: false, skipped: true };
  }

  const f = comercial || {};
  const esWeb = canal === 'web';
  const contacto = esWeb
    ? [
        `Cliente: ${nombreCliente ? `*${nombreCliente}* ` : ''}(chat de la web pública)`,
        digitosCelular
          ? `Celular indicado: +${String(digitosCelular).replace(/\D/g, '')}`
          : 'Celular: no lo dejó en el chat',
        telefonoCliente ? `Sesión: ${String(telefonoCliente).slice(0, 24)}` : null
      ]
    : [`Cliente: ${nombreCliente ? `*${nombreCliente}* ` : ''}(+${telefonoCliente})`];
  const titulo = motivo === 'pago_reportado'
    ? (esWeb
      ? '*Lead web dice que ya pagó el plan* 💸'
      : '*Lead WhatsApp dice que ya pagó el plan* 💸')
    : motivo === 'llamada'
      ? (esWeb
        ? '*Lead web EFAFERP pide llamada de soporte* 📞'
        : '*Interesado EFAFERP pide llamada de soporte* 📞')
      : (esWeb
        ? '*Lead web EFAFERP con alta intención* ✨'
        : '*Interesado EFAFERP con alta intención* ✨');
  const cierre = motivo === 'pago_reportado'
    ? 'Valida el voucher en el checkout. El bot NO activó el plan.'
    : esWeb
      ? 'Contáctalo tú. El visitante no abre WhatsApp desde la web.'
      : 'El bot sigue atendiendo. Contáctalo para agendar o cerrar.';
  const body = [
    titulo,
    ...contacto,
    `Rubro: ${f.rubro || f.rubroLibre || 'no indicado'}`,
    `Encaje: ${f.encaja || 'indefinido'} | Intención: ${f.intencionCompra || 'n/d'}`,
    f.necesidad ? `Necesidad: ${String(f.necesidad).slice(0, 200)}` : null,
    f.nombre ? `Nombre para llamada: ${f.nombre}` : null,
    f.mejorHorario ? `Horario: ${f.mejorHorario}` : null,
    ultimoMensaje ? `Último mensaje: ${String(ultimoMensaje).slice(0, 220)}` : null,
    '',
    cierre
  ].filter(Boolean);

  const texto = body.join('\n');
  try {
    if (whatsappGatewayClient.isConfigured()) {
      const r = await whatsappGatewayClient.sendText(idEmpresa, destino, texto, { skipThrottle: true });
      if (r.success) return { ok: true, destino, canal: 'baileys' };
      console.error('whatsappBotEscalamiento interes comercial baileys:', r.message, 'dest:', destino.slice(0, 5) + '****');
    }
  } catch (err) {
    console.error('whatsappBotEscalamiento notificarInteresComercial baileys:', err.message);
  }

  try {
    const { withPool } = require('../utils/dbPool.util');
    const seguridadAlertas = require('./seguridadAlertas.service');
    const plat = await withPool((pool) => seguridadAlertas.enviarWhatsAppPlataforma(pool, destino, texto));
    if (plat?.ok) return { ok: true, destino, canal: plat.canal || 'plataforma' };
    console.error('whatsappBotEscalamiento interes comercial plataforma:', plat?.error || plat?.message || plat?.reason);
    return { ok: false, error: plat?.error || plat?.message || 'aviso no enviado' };
  } catch (err) {
    console.error('whatsappBotEscalamiento notificarInteresComercial plataforma:', err.message);
    return { ok: false, error: err.message };
  }
}

async function notificarPedidoConfirmado(idEmpresa, params) {
  const {
    numeroVendedor,
    telefonoCliente,
    nombreCliente,
    serieNumero,
    total,
    medioPago,
    tipoEntrega,
    lineas
  } = params;

  if (!numeroVendedor) {
    console.error('whatsappBotEscalamiento: pedido confirmado sin numeroVendedor');
    return { ok: false, skipped: true };
  }

  const entregaTxt = tipoEntrega === 'envio' ? 'Envío (coordinar)' : 'Recojo en tienda';
  const body = [
    '*Pedido confirmado por WhatsApp* ✅',
    `Cliente: ${nombreCliente ? `*${nombreCliente}* ` : ''}(+${telefonoCliente})`,
    `Documento: ${serieNumero}`,
    `Total: ${total}`,
    `Pago: ${medioPago}`,
    `Entrega: ${entregaTxt}`,
    ''
  ];
  if (Array.isArray(lineas) && lineas.length) {
    body.push('*Productos:*');
    for (const ln of lineas.slice(0, 12)) {
      body.push(`• ${ln}`);
    }
    body.push('');
  }
  body.push('El cliente ya confirmó. Atiéndelo para cobrar o despachar.');

  try {
    const r = await whatsappGatewayClient.sendText(idEmpresa, numeroVendedor, body.join('\n'), {
      skipThrottle: true
    });
    if (!r.success) {
      console.error('whatsappBotEscalamiento pedido:', r.message);
      return { ok: false, error: r.message };
    }
    return { ok: true };
  } catch (err) {
    console.error('whatsappBotEscalamiento notificarPedidoConfirmado:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  estaEscalada,
  limpiarEscaladaExpirada,
  marcarEscalada,
  desescalar,
  notificarVendedor,
  notificarInteresComercial,
  notificarPedidoConfirmado,
  resolverNumeroVendedor,
  ofuscarTel
};
