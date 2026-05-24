const { withPool } = require('../utils/dbPool.util');
const whatsappProvider = require('./whatsappProvider.service');
const empresaWhatsAppRepository = require('../repositories/empresaWhatsApp.repository');
const whatsappBotLogRepository = require('../repositories/whatsappBotLog.repository');
const whatsappBotConfigRepository = require('../repositories/whatsappBotConfig.repository');
const whatsappBotDialogo = require('./whatsappBotDialogo.service');
const whatsappBotCatalogo = require('./whatsappBotCatalogo.service');
const whatsappBotSinonimoRepository = require('../repositories/whatsappBotSinonimo.repository');
const factilizaRepository = require('../repositories/factiliza.repository');
const { normalizarTelefonoWhatsApp } = require('../utils/telefonoWhatsApp.util');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOMBRE_SERVICIO_WHATSAPP_BOT = 'Factiliza WHATSAPP BOT';

function validarUuid(idEmpresa) {
  if (!idEmpresa || !UUID_REGEX.test(String(idEmpresa).trim())) {
    throw new Error('idEmpresa invalido');
  }
}

async function assertEmpresaBaileysActiva(idEmpresa) {
  const row = await withPool((pool) => empresaWhatsAppRepository.getByEmpresa(pool, idEmpresa));
  if (!row || !row.activo) {
    throw new Error('WhatsApp no activo para esta empresa');
  }
  if (String(row.proveedor).toLowerCase() !== 'baileys') {
    throw new Error('El bot entrante solo aplica con proveedor baileys');
  }
  return row;
}

async function empresaPuedeUsarBot(idEmpresa) {
  return withPool((pool) =>
    factilizaRepository.puedeUsarServicio(pool, idEmpresa, NOMBRE_SERVICIO_WHATSAPP_BOT)
  );
}

async function assertEmpresaPuedeUsarBot(idEmpresa) {
  const ok = await empresaPuedeUsarBot(idEmpresa);
  if (!ok) {
    const err = new Error('Bot WhatsApp no autorizado para esta empresa');
    err.code = 'FORBIDDEN';
    throw err;
  }
}

async function registrarLog(idEmpresa, direccion, telefonoCliente, messageId, texto) {
  await withPool((pool) =>
    whatsappBotLogRepository.insertar(pool, idEmpresa, {
      direccion,
      telefonoCliente,
      messageId,
      texto: String(texto || '').slice(0, 2000)
    })
  );
}

async function getConfig(idEmpresa) {
  const autorizado = await empresaPuedeUsarBot(idEmpresa);
  const row = await withPool((pool) => whatsappBotConfigRepository.getOrCreate(pool, idEmpresa));
  return {
    ...row,
    activoBot: autorizado ? !!row.activoBot : false,
    servicioAutorizado: autorizado
  };
}

async function updateConfig(idEmpresa, data) {
  const autorizado = await empresaPuedeUsarBot(idEmpresa);
  const payload = { ...(data || {}) };
  if (!autorizado) {
    if (payload.activoBot === true || payload.activoBot === 1) {
      const err = new Error('Bot WhatsApp no autorizado para esta empresa');
      err.code = 'FORBIDDEN';
      throw err;
    }
    payload.activoBot = false;
  }
  await withPool((pool) => whatsappBotConfigRepository.upsert(pool, idEmpresa, payload));
  return getConfig(idEmpresa);
}

async function syncCatalogo(idEmpresa) {
  validarUuid(idEmpresa);
  await assertEmpresaPuedeUsarBot(idEmpresa);
  return whatsappBotCatalogo.syncCatalogo(idEmpresa);
}

async function catalogoStatus(idEmpresa) {
  validarUuid(idEmpresa);
  await assertEmpresaPuedeUsarBot(idEmpresa);
  return whatsappBotCatalogo.statusCatalogo(idEmpresa);
}

async function listarSinonimos(idEmpresa) {
  await assertEmpresaPuedeUsarBot(idEmpresa);
  return withPool((pool) => whatsappBotSinonimoRepository.listarPorEmpresa(pool, idEmpresa));
}

async function crearSinonimo(idEmpresa, terminoEntrada, terminoBusqueda) {
  await assertEmpresaPuedeUsarBot(idEmpresa);
  if (!terminoEntrada || !terminoBusqueda) {
    throw new Error('terminoEntrada y terminoBusqueda son requeridos');
  }
  await withPool((pool) =>
    whatsappBotSinonimoRepository.insertar(pool, idEmpresa, terminoEntrada, terminoBusqueda)
  );
  return listarSinonimos(idEmpresa);
}

async function eliminarSinonimo(idEmpresa, idSinonimo) {
  await assertEmpresaPuedeUsarBot(idEmpresa);
  await withPool((pool) => whatsappBotSinonimoRepository.eliminar(pool, idEmpresa, idSinonimo));
  return listarSinonimos(idEmpresa);
}

async function listarLogs(idEmpresa, limite) {
  await assertEmpresaPuedeUsarBot(idEmpresa);
  return withPool((pool) => whatsappBotLogRepository.listar(pool, idEmpresa, limite));
}

async function procesarInbound(payload) {
  const { idEmpresa, from, messageId, text, timestamp } = payload || {};
  validarUuid(idEmpresa);
  const tel = normalizarTelefonoWhatsApp(from);
  if (!tel.destino) throw new Error('Telefono de origen requerido');

  const textoEntrada = String(text || '').trim();
  if (!textoEntrada) throw new Error('Mensaje de texto vacio');

  await assertEmpresaPuedeUsarBot(idEmpresa);
  await assertEmpresaBaileysActiva(idEmpresa);
  const config = await getConfig(idEmpresa);
  if (!config.activoBot) {
    throw new Error('Bot WhatsApp desactivado para esta empresa');
  }

  await registrarLog(idEmpresa, 'in', tel.logId, messageId, textoEntrada);

  const stats = await whatsappBotCatalogo.statusCatalogo(idEmpresa);
  if (!stats.total || Number(stats.total) === 0) {
    await syncCatalogo(idEmpresa).catch((err) => {
      console.error('whatsappBot auto-sync catalogo:', err.message);
    });
  }

  const turno = await whatsappBotDialogo.procesarTurno({
    idEmpresa,
    telefonoLog: tel.logId,
    digitosCelular: tel.digitos,
    textoEntrada,
    config
  });

  const { respuesta, conv, adjunto } = turno;

  await whatsappBotDialogo.persistirConversacion(idEmpresa, tel.logId, conv);

  const envio = await whatsappProvider.sendText(idEmpresa, tel.destino, respuesta);
  if (!envio.success) {
    throw new Error(envio.message || 'No se pudo enviar la respuesta');
  }

  await registrarLog(idEmpresa, 'out', tel.logId, null, respuesta);

  if (adjunto?.pdfBase64 && adjunto?.filename) {
    const media = await whatsappProvider.sendMedia(
      idEmpresa,
      tel.destino,
      'document',
      adjunto.pdfBase64,
      adjunto.filename,
      adjunto.caption || 'Cotizacion'
    );
    if (!media.success) {
      console.error('whatsappBot envio PDF:', media.message);
    } else {
      await registrarLog(idEmpresa, 'out', tel.logId, null, `[PDF] ${adjunto.filename}`);
    }
  }

  return {
    ok: true,
    idEmpresa,
    from: tel.destino,
    messageId: messageId || null,
    timestamp: timestamp || null,
    respuesta,
    pdfEnviado: Boolean(adjunto?.pdfBase64)
  };
}

module.exports = {
  procesarInbound,
  getConfig,
  updateConfig,
  syncCatalogo,
  catalogoStatus,
  listarSinonimos,
  crearSinonimo,
  eliminarSinonimo,
  listarLogs,
  NOMBRE_SERVICIO_WHATSAPP_BOT
};
