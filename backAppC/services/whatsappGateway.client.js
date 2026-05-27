const axios = require('axios');

const BASE_URL = (process.env.WHATSAPP_GATEWAY_URL || 'http://127.0.0.1:3010').replace(/\/$/, '');
const API_KEY = process.env.WHATSAPP_GATEWAY_API_KEY || '';
const TIMEOUT_MS = Number(process.env.WHATSAPP_GATEWAY_TIMEOUT_MS) || 60000;

function headers() {
  if (!API_KEY) throw new Error('WHATSAPP_GATEWAY_API_KEY no configurada en el servidor');
  return { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };
}

function client() {
  return axios.create({ baseURL: BASE_URL, timeout: TIMEOUT_MS, validateStatus: () => true });
}

async function startSession(idEmpresa, nombreDispositivo) {
  const body = {};
  if (nombreDispositivo != null && String(nombreDispositivo).trim() !== '') {
    body.nombreDispositivo = String(nombreDispositivo).trim();
  }
  const res = await client().post(`/v1/tenants/${idEmpresa}/session`, body, { headers: headers() });
  return res.data;
}

async function getSessionStatus(idEmpresa) {
  const res = await client().get(`/v1/tenants/${idEmpresa}/session/status`, { headers: headers() });
  return res.data;
}

async function logoutSession(idEmpresa) {
  const res = await client().delete(`/v1/tenants/${idEmpresa}/session`, { headers: headers() });
  return res.data;
}

function authHeaders(options = {}) {
  const h = headers();
  if (options.skipThrottle) h['X-Bot-Reply'] = '1';
  return h;
}

async function sendText(idEmpresa, number, text, options = {}) {
  const body = { number, text, skipThrottle: !!options.skipThrottle };
  const res = await client().post(
    `/v1/tenants/${idEmpresa}/messages/text`,
    body,
    { headers: authHeaders(options) }
  );
  const data = res.data || {};
  return {
    status: data.status != null ? data.status : res.status,
    success: data.success === true,
    message: data.message != null ? String(data.message) : (res.status >= 200 && res.status < 300 ? 'OK' : 'Error en gateway WhatsApp')
  };
}

async function sendMedia(idEmpresa, number, mediatype, media, filename, caption, options = {}) {
  const body = { number, mediatype, media, skipThrottle: !!options.skipThrottle };
  if (filename != null) body.filename = filename;
  if (caption != null) body.caption = caption;
  const res = await client().post(
    `/v1/tenants/${idEmpresa}/messages/media`,
    body,
    { headers: authHeaders(options) }
  );
  const data = res.data || {};
  return {
    status: data.status != null ? data.status : res.status,
    success: data.success === true,
    message: data.message != null ? String(data.message) : (res.status >= 200 && res.status < 300 ? 'OK' : 'Error en gateway WhatsApp')
  };
}

/**
 * Envia un "estado de presencia" al chat (composing, paused, recording, available, unavailable).
 * Best-effort: si el gateway esta caido o no soporta el endpoint, NO debe romper la respuesta.
 * Por eso devuelve { ok:false } en lugar de lanzar.
 */
async function sendPresence(idEmpresa, number, type) {
  try {
    const res = await client().post(
      `/v1/tenants/${idEmpresa}/messages/presence`,
      { number, type },
      { headers: authHeaders({ skipThrottle: true }) }
    );
    const data = res.data || {};
    return {
      success: data.success === true,
      status: data.status != null ? data.status : res.status,
      message: data.message || ''
    };
  } catch (err) {
    return { success: false, status: 0, message: err.message };
  }
}

/**
 * Reacciona al mensaje del cliente con un emoji (ej. '👋', '✅', '🛒').
 * Best-effort: silencia errores; las reacciones son cosmeticas.
 */
async function sendReaction(idEmpresa, number, messageId, emoji) {
  if (!messageId) return { success: false, message: 'messageId requerido' };
  try {
    const res = await client().post(
      `/v1/tenants/${idEmpresa}/messages/reaction`,
      { number, messageId, emoji: emoji || '' },
      { headers: authHeaders({ skipThrottle: true }) }
    );
    const data = res.data || {};
    return {
      success: data.success === true,
      status: data.status != null ? data.status : res.status,
      message: data.message || ''
    };
  } catch (err) {
    return { success: false, status: 0, message: err.message };
  }
}

function isConfigured() {
  return Boolean(API_KEY && BASE_URL);
}

module.exports = {
  startSession,
  getSessionStatus,
  logoutSession,
  sendText,
  sendMedia,
  sendPresence,
  sendReaction,
  isConfigured
};
