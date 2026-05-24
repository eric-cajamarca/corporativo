const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const pino = require('pino');
const axios = require('axios');
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const config = require('../config');
const { toWhatsAppJid, jidToPhone, resolveInboundSender, isIndividualChatJid } = require('../utils/phone.util');
const inboundWebhook = require('./inboundWebhook.service');

const tenants = new Map();
const QR_WAIT_MS = Number(process.env.QR_WAIT_MS) || 30000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getTenantState(idEmpresa) {
  if (!tenants.has(idEmpresa)) {
    tenants.set(idEmpresa, {
      sock: null,
      status: 'desconectado',
      qr: null,
      qrDataUrl: null,
      telefonoVinculado: null,
      lastSendAt: 0,
      starting: false,
      lastError: null,
      lidToPhone: new Map(),
      lidToJid: new Map(),
      nombreDispositivo: null,
      suppressMessageIds: new Set(),
      processedMessageIds: new Set()
    });
  }
  return tenants.get(idEmpresa);
}

function sessionPath(idEmpresa) {
  return path.join(config.sessionsDir, String(idEmpresa));
}

function deviceMetaPath(idEmpresa) {
  return path.join(sessionPath(idEmpresa), 'device-meta.json');
}

function sanitizeDeviceName(name) {
  const cleaned = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return cleaned || config.defaultDeviceName || 'EFAF ERP';
}

function buildBrowser(nombreDispositivo) {
  return [sanitizeDeviceName(nombreDispositivo), 'Chrome', '1.0.0'];
}

async function saveDeviceMeta(idEmpresa, nombreDispositivo) {
  const safeName = sanitizeDeviceName(nombreDispositivo);
  await fs.promises.writeFile(
    deviceMetaPath(idEmpresa),
    JSON.stringify({ nombreDispositivo: safeName }),
    'utf8'
  );
  return safeName;
}

async function loadDeviceMeta(idEmpresa) {
  try {
    const raw = await fs.promises.readFile(deviceMetaPath(idEmpresa), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed?.nombreDispositivo ? sanitizeDeviceName(parsed.nombreDispositivo) : null;
  } catch {
    return null;
  }
}

async function resolveDeviceName(idEmpresa, t, options = {}) {
  if (options.nombreDispositivo) {
    t.nombreDispositivo = await saveDeviceMeta(idEmpresa, options.nombreDispositivo);
    return t.nombreDispositivo;
  }
  if (t.nombreDispositivo) return t.nombreDispositivo;
  const cached = await loadDeviceMeta(idEmpresa);
  t.nombreDispositivo = cached || config.defaultDeviceName || 'EFAF ERP';
  return t.nombreDispositivo;
}

async function ensureSessionsDir() {
  await fs.promises.mkdir(config.sessionsDir, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForSessionReady(idEmpresa, timeoutMs = QR_WAIT_MS) {
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const t = getTenantState(idEmpresa);
      if (t.qrDataUrl || t.status === 'conectado' || t.status === 'qr_pendiente') {
        resolve(t);
        return;
      }
      if (t.status === 'error' || t.lastError) {
        resolve(t);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(t);
        return;
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

async function destroySocket(t) {
  if (!t.sock) return;
  try {
    t.sock.ev.removeAllListeners('connection.update');
    t.sock.ev.removeAllListeners('creds.update');
    t.sock.ev.removeAllListeners('messages.upsert');
    t.sock.ev.removeAllListeners('chats.phoneNumberShare');
    t.sock.ev.removeAllListeners('contacts.upsert');
    t.sock.end(undefined);
  } catch (e) {
    console.error('sessionManager destroySocket:', e.message);
  }
  t.sock = null;
}

function extractMessageText(message) {
  const content = message?.message;
  if (!content) return null;
  if (content.conversation) return content.conversation;
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
  return null;
}

function rememberOutboundMessage(t, sentMsg) {
  const id = sentMsg?.key?.id;
  if (!id || !t) return;
  t.suppressMessageIds.add(id);
  setTimeout(() => t.suppressMessageIds.delete(id), 60000);
}

function shouldForwardInbound(message, t) {
  const key = message?.key;
  if (!key) return false;

  const remoteJid = String(key.remoteJid || '');
  if (remoteJid.endsWith('@g.us') || remoteJid.includes('@broadcast')) return false;

  if (key.fromMe) {
    if (key.id && t?.suppressMessageIds?.has(key.id)) return false;
    const chatOk = isIndividualChatJid(remoteJid) || Boolean(key.senderPn);
    if (!chatOk) return false;
  } else if (!isIndividualChatJid(remoteJid)) {
    return false;
  }

  if (key.id && t?.processedMessageIds?.has(key.id)) return false;

  const text = extractMessageText(message);
  if (!text || !String(text).trim()) return false;
  return true;
}

function rememberLidMapping(t, lid, jid) {
  if (!lid || !jid) return;
  t.lidToJid.set(lid, jid);
  const phone = jidToPhone(jid);
  if (phone) t.lidToPhone.set(lid, phone);
}

function bindLidMappingListener(t, sock) {
  sock.ev.on('chats.phoneNumberShare', ({ lid, jid }) => {
    rememberLidMapping(t, lid, jid);
  });

  sock.ev.on('contacts.upsert', (contacts) => {
    for (const contact of contacts || []) {
      if (contact.lid && contact.jid) {
        rememberLidMapping(t, contact.lid, contact.jid);
      }
      if (contact.id && String(contact.id).endsWith('@lid') && contact.jid) {
        rememberLidMapping(t, contact.id, contact.jid);
      }
    }
  });
}

function bindInboundListener(idEmpresa, sock) {
  const t = getTenantState(idEmpresa);
  bindLidMappingListener(t, sock);

  sock.ev.on('messages.upsert', async (event) => {
    if (!event || event.type !== 'notify' || !Array.isArray(event.messages)) return;
    if (!inboundWebhook.isConfigured()) return;

    for (const message of event.messages) {
      if (!shouldForwardInbound(message, t)) continue;

      const resolved = resolveInboundSender(message, t, t.telefonoVinculado);
      if (!resolved?.replyTo) continue;

      const text = String(extractMessageText(message) || '').trim();
      const messageId = message.key.id || null;
      if (messageId) {
        t.processedMessageIds.add(messageId);
        if (t.processedMessageIds.size > 500) t.processedMessageIds.clear();
      }
      const timestamp = message.messageTimestamp
        ? Number(message.messageTimestamp) * 1000
        : Date.now();

      console.error(`sessionManager inbound ${idEmpresa}: ${resolved.logId} -> "${text.slice(0, 40)}"`);

      inboundWebhook.postInbound({
        idEmpresa,
        from: resolved.replyTo,
        messageId,
        text,
        timestamp
      }).catch((err) => {
        console.error(`sessionManager inbound ${idEmpresa}:`, err.message);
      });
    }
  });
}

async function preloadSessions() {
  await ensureSessionsDir();
  let entries = [];
  try {
    entries = await fs.promises.readdir(config.sessionsDir, { withFileTypes: true });
  } catch (e) {
    console.error('sessionManager preloadSessions readdir:', e.message);
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const idEmpresa = entry.name;
    if (!UUID_REGEX.test(idEmpresa)) continue;

    const credsPath = path.join(config.sessionsDir, idEmpresa, 'creds.json');
    try {
      await fs.promises.access(credsPath);
    } catch {
      continue;
    }

    connectTenant(idEmpresa).catch((err) => {
      console.error(`sessionManager preload ${idEmpresa}:`, err.message);
    });
  }
}

async function connectTenant(idEmpresa, options = {}) {
  const forceNew = options.forceNew === true;
  await ensureSessionsDir();
  const t = getTenantState(idEmpresa);

  if (t.starting && !forceNew) {
    await waitForSessionReady(idEmpresa);
    return t;
  }

  if (t.sock && t.status === 'conectado' && !forceNew) {
    return t;
  }

  if (forceNew || (t.sock && t.status !== 'conectado')) {
    await destroySocket(t);
  }

  if (t.sock && !forceNew) {
    return t;
  }

  t.starting = true;
  t.status = 'conectando';
  t.lastError = null;
  t.qr = null;
  t.qrDataUrl = null;

  try {
    const dir = sessionPath(idEmpresa);
    await fs.promises.mkdir(dir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(dir);
    const { version } = await fetchLatestBaileysVersion();
    const logger = pino({ level: config.logLevel });
    const nombreDispositivo = await resolveDeviceName(idEmpresa, t, options);

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: buildBrowser(nombreDispositivo),
      syncFullHistory: false,
      markOnlineOnConnect: false
    });
    t.sock = sock;

    sock.ev.on('creds.update', saveCreds);
    bindInboundListener(idEmpresa, sock);
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin } = update;

      if (qr) {
        t.status = 'qr_pendiente';
        t.qr = qr;
        try {
          t.qrDataUrl = await QRCode.toDataURL(qr);
        } catch (e) {
          console.error('sessionManager QR:', e.message);
          t.qrDataUrl = null;
        }
      }

      if (connection === 'connecting') {
        t.status = 'conectando';
      }

      if (connection === 'open') {
        t.status = 'conectado';
        t.qr = null;
        t.qrDataUrl = null;
        t.lastError = null;
        const me = sock.user?.id || '';
        t.telefonoVinculado = me.split(':')[0].split('@')[0] || null;
        if (isNewLogin) {
          console.error(`sessionManager: nueva sesion vinculada ${idEmpresa} +${t.telefonoVinculado || '?'}`);
        }
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        const restartRequired = code === DisconnectReason.restartRequired;
        t.lastError = lastDisconnect?.error?.message || `codigo ${code}`;
        t.status = loggedOut ? 'desconectado' : 'reconectando';
        await destroySocket(t);
        t.starting = false;

        if (loggedOut) {
          t.qr = null;
          t.qrDataUrl = null;
          t.telefonoVinculado = null;
          return;
        }

        if (restartRequired) {
          setTimeout(() => connectTenant(idEmpresa, { forceNew: true }).catch((err) => {
            console.error('sessionManager restartRequired:', err.message);
          }), 2000);
          return;
        }

        setTimeout(() => connectTenant(idEmpresa).catch((err) => {
          console.error('sessionManager reconnect:', err.message);
        }), 4000);
      }
    });
  } catch (err) {
    t.status = 'error';
    t.lastError = err.message;
    await destroySocket(t);
    console.error('sessionManager connectTenant:', err.message);
    throw err;
  } finally {
    t.starting = false;
  }

  return t;
}

async function startSession(idEmpresa, options = {}) {
  await connectTenant(idEmpresa, { forceNew: true, ...options });
  const t = await waitForSessionReady(idEmpresa);
  const status = getSessionStatus(idEmpresa);
  if (t.status === 'conectando' && !t.qrDataUrl) {
    status.mensaje =
      'No se recibio el codigo QR. Verifique que whatsapp-gateway tenga acceso a internet, pulse Actualizar o Desvincular e intente de nuevo.';
  }
  return status;
}

function getSessionStatus(idEmpresa) {
  const t = getTenantState(idEmpresa);
  return {
    idEmpresa,
    proveedor: 'baileys',
    estadoSesion: t.status,
    telefonoVinculado: t.telefonoVinculado,
    qr: t.qr,
    qrDataUrl: t.qrDataUrl,
    nombreDispositivo: t.nombreDispositivo || null,
    lastError: t.lastError || null
  };
}

async function logoutSession(idEmpresa) {
  const t = getTenantState(idEmpresa);
  await destroySocket(t);
  t.sock = null;
  t.status = 'desconectado';
  t.qr = null;
  t.qrDataUrl = null;
  t.telefonoVinculado = null;
  t.lastError = null;
  t.starting = false;
  const dir = sessionPath(idEmpresa);
  try {
    await fs.promises.rm(dir, { recursive: true, force: true });
  } catch (e) {
    console.error('sessionManager rm session:', e.message);
  }
  tenants.delete(idEmpresa);
  return { ok: true };
}

function requireConnected(idEmpresa) {
  const t = getTenantState(idEmpresa);
  if (!t.sock || t.status !== 'conectado') {
    throw new Error('Sesion WhatsApp no conectada. Escanee el codigo QR en configuracion.');
  }
  return t.sock;
}

async function throttleSend(idEmpresa) {
  const t = getTenantState(idEmpresa);
  const now = Date.now();
  const wait = config.sendMinIntervalMs - (now - t.lastSendAt);
  if (wait > 0) await sleep(wait);
  t.lastSendAt = Date.now();
}

async function sendText(idEmpresa, number, text) {
  const t = getTenantState(idEmpresa);
  const sock = requireConnected(idEmpresa);
  await throttleSend(idEmpresa);
  const jid = toWhatsAppJid(number);
  const sent = await sock.sendMessage(jid, { text: String(text).trim() });
  rememberOutboundMessage(t, sent);
  return { status: 200, success: true, message: 'Mensaje enviado' };
}

async function resolveMediaBuffer(media) {
  const raw = String(media || '').trim();
  if (!raw) throw new Error('El contenido del archivo (media) es requerido');
  if (/^https?:\/\//i.test(raw)) {
    const res = await axios.get(raw, { responseType: 'arraybuffer', timeout: 60000 });
    return Buffer.from(res.data);
  }
  const b64 = raw.replace(/^data:[^;]+;base64,/, '');
  return Buffer.from(b64, 'base64');
}

async function sendMedia(idEmpresa, number, mediatype, media, filename, caption) {
  const sock = requireConnected(idEmpresa);
  await throttleSend(idEmpresa);
  const jid = toWhatsAppJid(number);
  const buffer = await resolveMediaBuffer(media);
  const mt = String(mediatype || 'document').toLowerCase();
  const cap = caption != null && String(caption).trim() !== '' ? String(caption).trim() : undefined;
  const name = filename != null && String(filename).trim() !== '' ? String(filename).trim() : 'archivo';

  let payload;
  if (mt === 'image') {
    payload = { image: buffer, caption: cap };
  } else if (mt === 'video') {
    payload = { video: buffer, caption: cap };
  } else if (mt === 'audio') {
    payload = { audio: buffer, mimetype: 'audio/mpeg' };
  } else {
    const ext = (name.split('.').pop() || 'pdf').toLowerCase();
    const mimeMap = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
    payload = {
      document: buffer,
      mimetype: mimeMap[ext] || 'application/octet-stream',
      fileName: name,
      caption: cap
    };
  }
  await sock.sendMessage(jid, payload);
  return { status: 200, success: true, message: 'Archivo enviado' };
}

module.exports = {
  startSession,
  getSessionStatus,
  logoutSession,
  sendText,
  sendMedia,
  preloadSessions
};
