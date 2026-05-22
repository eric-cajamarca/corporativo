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
const { toWhatsAppJid } = require('../utils/phone.util');

const tenants = new Map();
const QR_WAIT_MS = Number(process.env.QR_WAIT_MS) || 30000;

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
      lastError: null
    });
  }
  return tenants.get(idEmpresa);
}

function sessionPath(idEmpresa) {
  return path.join(config.sessionsDir, String(idEmpresa));
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
    t.sock.end(undefined);
  } catch (e) {
    console.error('sessionManager destroySocket:', e.message);
  }
  t.sock = null;
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

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: ['EFAF ERP', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false
    });
    t.sock = sock;

    sock.ev.on('creds.update', saveCreds);
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

async function startSession(idEmpresa) {
  await connectTenant(idEmpresa, { forceNew: true });
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
  const sock = requireConnected(idEmpresa);
  await throttleSend(idEmpresa);
  const jid = toWhatsAppJid(number);
  await sock.sendMessage(jid, { text: String(text).trim() });
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
  sendMedia
};
