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

function ahoraIso() { return getAhoraAppIsoLocal(); }

function ofuscarTel(tel) {
  const s = String(tel || '').replace(/\D/g, '');
  if (s.length <= 4) return '****';
  return `${s.slice(0, 3)}****${s.slice(-3)}`;
}

function resolverNumeroVendedor(config, telefonoVinculadoBot) {
  const fromConfig = String(config?.numeroEscalamiento || '').replace(/\D/g, '');
  if (fromConfig.length >= 9) return fromConfig;
  const fromBot = String(telefonoVinculadoBot || '').replace(/\D/g, '');
  if (fromBot.length >= 9) return fromBot;
  return null;
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

module.exports = {
  estaEscalada,
  limpiarEscaladaExpirada,
  marcarEscalada,
  desescalar,
  notificarVendedor,
  resolverNumeroVendedor,
  ofuscarTel
};
