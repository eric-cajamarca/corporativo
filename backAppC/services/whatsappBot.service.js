const { withPool } = require('../utils/dbPool.util');
const whatsappGatewayClient = require('./whatsappGateway.client');
const whatsappBotLogRepository = require('../repositories/whatsappBotLog.repository');
const whatsappBotConfigRepository = require('../repositories/whatsappBotConfig.repository');
const whatsappBotDialogo = require('./whatsappBotDialogo.service');
const whatsappBotCatalogo = require('./whatsappBotCatalogo.service');
const whatsappBotSinonimoRepository = require('../repositories/whatsappBotSinonimo.repository');
const whatsappBotInboundContext = require('./whatsappBotInboundContext.service');
const whatsappBotConversacionRepository = require('../repositories/whatsappBotConversacion.repository');
const factilizaRepository = require('../repositories/factiliza.repository');
const { normalizarTelefonoWhatsApp } = require('../utils/telefonoWhatsApp.util');
const copy = require('./whatsappBot.copy');

/**
 * Envia una o varias "burbujas" simulando que un humano escribe:
 *   1) reacciona al mensaje del usuario (si aplica),
 *   2) por cada burbuja: presence:composing -> sleep(delaySegunLargo) -> sendText
 *   3) cierra con presence:paused.
 *
 * Si el gateway no responde a presence/react (versiones viejas) no falla:
 * los helpers del cliente devuelven { success:false } sin lanzar.
 */
async function enviarRespuestaConTyping(idEmpresa, destino, respuestas, options = {}) {
  const arr = Array.isArray(respuestas) ? respuestas : [respuestas];
  const burbujas = arr.map((x) => String(x || '').trim()).filter(Boolean);
  if (!burbujas.length) {
    throw new Error('No hay respuesta que enviar');
  }
  const usarTyping = options.usarTyping !== false;
  const delayMaxMs = Number.isFinite(options.delayMaxMs) ? options.delayMaxMs : 3000;
  const unirEnUnaBurbuja = options.unirEnUnaBurbuja === true;

  // Si la empresa desactivo la humanizacion, juntamos todas las burbujas en una
  // sola para que el cliente reciba la respuesta completa de una sola vez.
  const finales = unirEnUnaBurbuja && burbujas.length > 1
    ? [burbujas.join('\n\n')]
    : burbujas;

  for (let i = 0; i < finales.length; i++) {
    const txt = finales[i];
    if (usarTyping) {
      whatsappGatewayClient.sendPresence(idEmpresa, destino, 'composing').catch(() => {});
      const baseDelay = copy.delaySegunLargo(txt);
      const delay = Math.min(baseDelay, delayMaxMs);
      if (delay > 0) await copy.sleep(delay);
    }
    const r = await whatsappGatewayClient.sendText(idEmpresa, destino, txt, { skipThrottle: true });
    if (!r.success) {
      throw new Error(r.message || 'No se pudo enviar la respuesta');
    }
    if (i < finales.length - 1) {
      await copy.sleep(copy.delayEntreBurbujas());
    }
  }

  if (usarTyping) {
    whatsappGatewayClient.sendPresence(idEmpresa, destino, 'paused').catch(() => {});
  }
  return finales;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOMBRE_SERVICIO_WHATSAPP_BOT = whatsappBotInboundContext.NOMBRE_SERVICIO_WHATSAPP_BOT;

/** Evita reprocesar el mismo messageId si el gateway reintenta el webhook. */
const mensajesProcesados = new Map();
const DEDUP_TTL_MS = 10 * 60 * 1000;

function validarUuid(idEmpresa) {
  if (!idEmpresa || !UUID_REGEX.test(String(idEmpresa).trim())) {
    throw new Error('idEmpresa invalido');
  }
}

function esDuplicado(idEmpresa, messageId) {
  if (!messageId) return false;
  const key = `${String(idEmpresa).toLowerCase()}:${messageId}`;
  const now = Date.now();
  if (mensajesProcesados.has(key)) return true;
  mensajesProcesados.set(key, now);
  if (mensajesProcesados.size > 2000) {
    for (const [k, t] of mensajesProcesados) {
      if (now - t > DEDUP_TTL_MS) mensajesProcesados.delete(k);
    }
  }
  return false;
}

function registrarLogAsync(idEmpresa, direccion, telefonoCliente, messageId, texto) {
  withPool((pool) =>
    whatsappBotLogRepository.insertar(pool, idEmpresa, {
      direccion,
      telefonoCliente,
      messageId,
      texto: String(texto || '').slice(0, 2000)
    })
  ).catch((err) => console.error('whatsappBot registrarLog:', err.message));
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

async function listarEscaladas(idEmpresa) {
  await assertEmpresaPuedeUsarBot(idEmpresa);
  const filas = await withPool((pool) =>
    whatsappBotConversacionRepository.listarEscaladas(pool, idEmpresa)
  );
  return filas.map((f) => ({
    telefonoCliente: f.telefonoCliente,
    motivo: f.slots?.escalada?.motivo || null,
    numeroVendedor: f.slots?.escalada?.numeroVendedor || null,
    fEscalado: f.slots?.escalada?.fEscalado || null,
    expiraEn: f.slots?.escalada?.hasta || f.fExpira || null,
    fActualizacion: f.fActualizacion
  }));
}

async function desescalarManual(idEmpresa, telefonoCliente) {
  await assertEmpresaPuedeUsarBot(idEmpresa);
  const tel = String(telefonoCliente || '').replace(/\D/g, '');
  if (!tel) throw new Error('telefonoCliente requerido');
  await withPool(async (pool) => {
    const conv = await whatsappBotConversacionRepository.obtener(pool, idEmpresa, tel);
    if (!conv) throw new Error('No hay conversacion activa para ese cliente');
    const slots = { ...(conv.slots || {}) };
    delete slots.escalada;
    delete slots.ofreciendoAgente;
    await whatsappBotConversacionRepository.guardar(pool, idEmpresa, tel, {
      estado: 'menu',
      slots,
      candidatos: []
    });
  });
  return { ok: true, telefonoCliente: tel };
}

async function procesarInbound(payload) {
  const t0 = Date.now();
  const { idEmpresa, from, messageId, text, timestamp } = payload || {};
  validarUuid(idEmpresa);

  if (esDuplicado(idEmpresa, messageId)) {
    return { ok: true, duplicate: true, idEmpresa, messageId: messageId || null };
  }

  const tel = normalizarTelefonoWhatsApp(from);
  if (!tel.destino) throw new Error('Telefono de origen requerido');

  const textoEntrada = String(text || '').trim();
  if (!textoEntrada) throw new Error('Mensaje de texto vacio');

  const precarga = await whatsappBotInboundContext.precargar(idEmpresa, tel.logId, tel.digitos);

  if (!precarga.autorizado) {
    const err = new Error('Bot WhatsApp no autorizado para esta empresa');
    err.code = 'FORBIDDEN';
    throw err;
  }
  const wa = precarga.waRow;
  if (!wa || !wa.activo) {
    throw new Error('WhatsApp no activo para esta empresa');
  }
  if (String(wa.proveedor).toLowerCase() !== 'baileys') {
    throw new Error('El bot entrante solo aplica con proveedor baileys');
  }
  if (!precarga.config.activoBot) {
    throw new Error('Bot WhatsApp desactivado para esta empresa');
  }

  if (!precarga.catStats?.total || Number(precarga.catStats.total) === 0) {
    syncCatalogo(idEmpresa).catch((err) => {
      console.error('whatsappBot auto-sync catalogo:', err.message);
    });
  }

  const turno = await whatsappBotDialogo.procesarTurno(
    {
      idEmpresa,
      telefonoLog: tel.logId,
      digitosCelular: tel.digitos,
      textoEntrada,
      config: precarga.config,
      telefonoVinculadoBot: wa.telefonoVinculado || null
    },
    precarga
  );
  const { respuesta, conv, adjunto, limpiarHistorial, reaccion, suprimirRespuesta } = turno;

  if (!limpiarHistorial) {
    registrarLogAsync(idEmpresa, 'in', tel.logId, messageId, textoEntrada);
  }

  // Si el dialogo decidio que el bot debe quedarse callado (conversacion escalada),
  // solo persistimos el contexto y no enviamos nada al cliente.
  if (suprimirRespuesta) {
    withPool((pool) =>
      whatsappBotInboundContext.persistirTurno(
        pool,
        idEmpresa,
        tel.logId,
        conv,
        precarga.convNueva
      )
    ).catch((err) => console.error('whatsappBot persistir conversacion:', err.message));

    return {
      ok: true,
      idEmpresa,
      from: tel.destino,
      messageId: messageId || null,
      timestamp: timestamp || null,
      respuesta: '',
      burbujas: 0,
      pdfEnviado: false,
      escalada: true,
      elapsedMs: Date.now() - t0
    };
  }

  // Aplicamos tono (tu / usted) y filtramos emojis si la empresa no los quiere.
  const opcionesTexto = {
    tonoFormal: precarga.config?.tonoFormal === true,
    usarEmojis: precarga.config?.usarEmojis !== false
  };
  const respuestaArr = Array.isArray(respuesta) ? respuesta : [respuesta];
  const respuestaAdaptada = respuestaArr.map((b) => copy.adaptarTexto(b, opcionesTexto));

  // Si la empresa desactivo la humanizacion, no mandamos reaccion ni typing.
  const humanizar = precarga.config?.humanizar !== false;
  if (humanizar && reaccion && messageId && opcionesTexto.usarEmojis) {
    whatsappGatewayClient
      .sendReaction(idEmpresa, tel.destino, messageId, reaccion)
      .catch(() => {});
  }

  const burbujasEnviadas = await enviarRespuestaConTyping(idEmpresa, tel.destino, respuestaAdaptada, {
    usarTyping: humanizar,
    unirEnUnaBurbuja: !humanizar,
    delayMaxMs: precarga.config?.delayMaxMs ?? 3000
  });
  const respuestaPlana = burbujasEnviadas.join('\n\n');

  if (limpiarHistorial) {
    try {
      await withPool(async (pool) => {
        await whatsappBotLogRepository.eliminarPorTelefono(pool, idEmpresa, tel.logId);
        await whatsappBotConversacionRepository.eliminar(pool, idEmpresa, tel.logId);
      });
    } catch (err) {
      console.error('whatsappBot limpiar historial:', err.message);
    }
  } else {
    registrarLogAsync(idEmpresa, 'out', tel.logId, null, respuestaPlana);

    withPool((pool) =>
      whatsappBotInboundContext.persistirTurno(
        pool,
        idEmpresa,
        tel.logId,
        conv,
        precarga.convNueva
      )
    ).catch((err) => console.error('whatsappBot persistir conversacion:', err.message));
  }

  if (adjunto?.pdfBase64 && adjunto?.filename) {
    whatsappGatewayClient
      .sendMedia(
        idEmpresa,
        tel.destino,
        'document',
        adjunto.pdfBase64,
        adjunto.filename,
        adjunto.caption || 'Cotizacion',
        { skipThrottle: true }
      )
      .then((media) => {
        if (!media.success) {
          console.error('whatsappBot envio PDF:', media.message);
        } else {
          registrarLogAsync(idEmpresa, 'out', tel.logId, null, `[PDF] ${adjunto.filename}`);
        }
      })
      .catch((err) => console.error('whatsappBot envio PDF:', err.message));
  }

  const ms = Date.now() - t0;
  if (ms > 3000) {
    console.error(`whatsappBot inbound lento: ${ms}ms idEmpresa=${idEmpresa} texto="${textoEntrada.slice(0, 30)}"`);
  }

  return {
    ok: true,
    idEmpresa,
    from: tel.destino,
    messageId: messageId || null,
    timestamp: timestamp || null,
    respuesta: respuestaPlana,
    burbujas: burbujasEnviadas.length,
    pdfEnviado: Boolean(adjunto?.pdfBase64),
    elapsedMs: ms
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
  listarEscaladas,
  desescalarManual,
  NOMBRE_SERVICIO_WHATSAPP_BOT
};
