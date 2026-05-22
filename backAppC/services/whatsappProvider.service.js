const { withPool } = require('../utils/dbPool.util');
const factilizaRepository = require('../repositories/factiliza.repository');
const empresaWhatsAppRepository = require('../repositories/empresaWhatsApp.repository');
const whatsappFactilizaService = require('./whatsappFactiliza.service');
const whatsappGatewayClient = require('./whatsappGateway.client');

const NOMBRE_SERVICIO_WHATSAPP = 'Factiliza WHATSAPP';

async function assertPuedeUsarWhatsApp(idEmpresa) {
  return withPool(async (pool) => {
    const puedeUsar = await factilizaRepository.puedeUsarServicio(pool, idEmpresa, NOMBRE_SERVICIO_WHATSAPP);
    if (!puedeUsar) {
      const err = new Error('Su empresa no tiene autorizacion para usar WhatsApp');
      err.code = 'FORBIDDEN';
      throw err;
    }
    return pool;
  });
}

async function resolveProveedor(idEmpresa) {
  return withPool(async (pool) => {
    const row = await empresaWhatsAppRepository.getByEmpresa(pool, idEmpresa);
    if (row && row.activo && String(row.proveedor).toLowerCase() === 'baileys') {
      return { proveedor: 'baileys', pool, row };
    }
    return { proveedor: 'factiliza', pool, row };
  });
}

async function getFactilizaConfig(pool) {
  const config = await factilizaRepository.getConfigByNombre(pool, NOMBRE_SERVICIO_WHATSAPP);
  if (!config || !config.tokenDefault) {
    const err = new Error('Servicio WhatsApp no configurado');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  return config;
}

async function sendText(idEmpresa, number, text) {
  await assertPuedeUsarWhatsApp(idEmpresa);
  const { proveedor, pool } = await resolveProveedor(idEmpresa);
  if (proveedor === 'baileys') {
    if (!whatsappGatewayClient.isConfigured()) {
      throw new Error('Gateway WhatsApp no configurado en el servidor');
    }
    return whatsappGatewayClient.sendText(idEmpresa, number, text);
  }
  const config = await getFactilizaConfig(pool);
  return whatsappFactilizaService.sendText(config, number, text);
}

async function sendMedia(idEmpresa, number, mediatype, media, filename, caption) {
  await assertPuedeUsarWhatsApp(idEmpresa);
  const { proveedor, pool } = await resolveProveedor(idEmpresa);
  if (proveedor === 'baileys') {
    if (!whatsappGatewayClient.isConfigured()) {
      throw new Error('Gateway WhatsApp no configurado en el servidor');
    }
    return whatsappGatewayClient.sendMedia(idEmpresa, number, mediatype, media, filename, caption);
  }
  const config = await getFactilizaConfig(pool);
  return whatsappFactilizaService.sendMedia(config, number, mediatype, media, filename, caption);
}

async function startSession(idEmpresa) {
  await assertPuedeUsarWhatsApp(idEmpresa);
  if (!whatsappGatewayClient.isConfigured()) {
    throw new Error('Gateway WhatsApp no configurado en el servidor');
  }
  await withPool((pool) => empresaWhatsAppRepository.setProveedor(pool, idEmpresa, 'baileys'));
  const gw = await whatsappGatewayClient.startSession(idEmpresa);
  const raw = gw.data || {};
  const data = {
    proveedor: 'baileys',
    estadoSesion: raw.estadoSesion || 'conectando',
    telefonoVinculado: raw.telefonoVinculado || null,
    qrDataUrl: raw.qrDataUrl || null,
    mensaje: raw.mensaje || null,
    lastError: raw.lastError || null
  };
  await withPool((pool) =>
    empresaWhatsAppRepository.syncEstadoSesion(
      pool,
      idEmpresa,
      data.estadoSesion,
      data.telefonoVinculado
    )
  );
  return data;
}

async function getSessionStatus(idEmpresa) {
  await assertPuedeUsarWhatsApp(idEmpresa);
  const row = await withPool((pool) => empresaWhatsAppRepository.getByEmpresa(pool, idEmpresa));
  if (!row || String(row.proveedor).toLowerCase() !== 'baileys') {
    return {
      proveedor: row?.proveedor || 'factiliza',
      estadoSesion: row?.estadoSesion || 'desconectado',
      telefonoVinculado: row?.telefonoVinculado || null,
      qrDataUrl: null
    };
  }
  if (!whatsappGatewayClient.isConfigured()) {
    throw new Error('Gateway WhatsApp no configurado en el servidor');
  }
  const gw = await whatsappGatewayClient.getSessionStatus(idEmpresa);
  const data = gw.data || {};
  await withPool((pool) =>
    empresaWhatsAppRepository.syncEstadoSesion(
      pool,
      idEmpresa,
      data.estadoSesion || 'desconectado',
      data.telefonoVinculado || null
    )
  );
  return {
    proveedor: 'baileys',
    estadoSesion: data.estadoSesion,
    telefonoVinculado: data.telefonoVinculado,
    qrDataUrl: data.qrDataUrl || null,
    mensaje: data.mensaje || null,
    lastError: data.lastError || null
  };
}

async function logoutSession(idEmpresa) {
  await assertPuedeUsarWhatsApp(idEmpresa);
  if (whatsappGatewayClient.isConfigured()) {
    await whatsappGatewayClient.logoutSession(idEmpresa);
  }
  await withPool((pool) =>
    empresaWhatsAppRepository.syncEstadoSesion(pool, idEmpresa, 'desconectado', null)
  );
  return { ok: true };
}

async function setProveedor(idEmpresa, proveedor) {
  await assertPuedeUsarWhatsApp(idEmpresa);
  const p = String(proveedor || '').trim().toLowerCase();
  if (!['baileys', 'factiliza'].includes(p)) {
    throw new Error('proveedor debe ser baileys o factiliza');
  }
  if (p === 'factiliza' && whatsappGatewayClient.isConfigured()) {
    await whatsappGatewayClient.logoutSession(idEmpresa).catch(() => {});
  }
  await withPool((pool) => empresaWhatsAppRepository.setProveedor(pool, idEmpresa, p));
  return { proveedor: p };
}

module.exports = {
  sendText,
  sendMedia,
  startSession,
  getSessionStatus,
  logoutSession,
  setProveedor
};
