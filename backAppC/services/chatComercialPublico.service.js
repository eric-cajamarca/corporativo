/**
 * Chat comercial de la web pública. Mismo cerebro que el WhatsApp de preventa.
 * idEmpresa siempre de Empresas.esPrincipal. Si piden llamada, el backend
 * avisa por WhatsApp al admin de la principal; el navegador no abre WhatsApp.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { withPool } = require('../utils/dbPool.util');
const suscripcionRepository = require('../repositories/suscripcion.repository');
const whatsappBotComercial = require('./whatsappBotComercial.service');
const whatsappBotNlu = require('./whatsappBotNlu.service');
const whatsappBotConfigRepository = require('../repositories/whatsappBotConfig.repository');
const empresaWhatsAppRepository = require('../repositories/empresaWhatsApp.repository');
const ficha = require('../utils/whatsappBotComercial.conocimiento');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TEXTO = 800;
const TTL_MS = 2 * 60 * 60 * 1000;
const INTENCIONES_CATALOGO = new Set(['producto', 'precio', 'stock', 'cotizar', 'pedido', 'deuda']);
const DIR_FLAYER_PUBLICO = path.join(__dirname, '../../adminSPA/public/flayers');

const sesiones = new Map();
let limpiezas = 0;

function sanitizar(v, max = MAX_TEXTO) {
  return String(v || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max);
}

function sessionIdValido(raw) {
  const s = String(raw || '').trim();
  return UUID_RE.test(s) ? s : crypto.randomUUID();
}

function extraerCelularPeru(texto) {
  const compact = String(texto || '').replace(/[\s\-().]/g, '');
  const m = compact.match(/(?:\+?51)?9\d{8}/);
  if (!m) return null;
  const d = m[0].replace(/\D/g, '');
  return d.length === 9 ? `51${d}` : d;
}

function limpiarSesiones() {
  limpiezas += 1;
  if (limpiezas % 40 !== 0) return;
  const now = Date.now();
  for (const [k, v] of sesiones) {
    if (!v || now > v.expira) sesiones.delete(k);
  }
}

function getConv(sessionId) {
  const row = sesiones.get(sessionId);
  if (!row || Date.now() > row.expira) {
    return { estado: 'comercial_ia', slots: {}, candidatos: [] };
  }
  return row.conv;
}

function saveConv(sessionId, conv) {
  sesiones.set(sessionId, { conv, expira: Date.now() + TTL_MS });
}

function adaptarRespuestaWeb(texto, llamadaAgendada, com) {
  let t = String(texto || '')
    .replace(/Si prefieres hablar ahora, escribe \*AGENTE\*\.?/gi, '')
    .replace(/escribe \*AGENTE\*/gi, 'pide una llamada aquí')
    .replace(/WhatsApp de la oficina:\s*[0-9\s]+/gi, '')
    .replace(/(Un asesor te contactará\.\s*){2,}/gi, 'Un asesor te contactará. ')
    .replace(/Quédate en este chat; un asesor te contactará\.?/gi, '')
    .trim();

  // En el chat público web no se publican cuentas bancarias ni "escribe ya pagué"
  const teniaDatosBancarios = /\b(cuenta|cta|cci|dep[oó]sito|banco bcp)\b/i.test(t) && /\b\d{10,20}\b/.test(t);
  if (teniaDatosBancarios || /\b(cuando pagues,? escribe ya pagu[eé]|escribe \*ya pagu[eé]\*)\b/i.test(t)) {
    t = [
      'El pago de tu plan se realiza de forma directa y 100% segura en nuestra web:',
      '👉 *Ver planes y pagar:* https://efaferp.com/planes',
      '',
      'Allí puedes elegir tu plan y pagar con *Yape* o *tarjeta de débito/crédito* con confirmación inmediata en pantalla.'
    ].join('\n');
  }

  // Eliminar referencias a "horario 2" o números solos como horario
  t = t.replace(/\bhorario\s+2\b/gi, 'horario acordado');

  if (llamadaAgendada && com && ficha.esNombrePersona(com.nombre)) {
    const cel = com.celular || com.celularWeb || '';
    const celTxt = cel ? ` al *${cel}*` : '';
    t = [
      `Listo, *${com.nombre}*. Te llamamos hoy antes de las 6:00 pm${celTxt}.`,
      'También te escribiremos por WhatsApp. Un asesor de BUSINESS SOFT se comunicará contigo.'
    ].join('\n');
  } else if (llamadaAgendada && !/te contactará|te llamamos/i.test(t)) {
    t += '\n\nUn asesor de BUSINESS SOFT te contactará hoy antes de las 6:00 pm. No necesitas abrir WhatsApp.';
  }

  return t.replace(/\n{3,}/g, '\n\n').trim();
}

function imagenUrlDeTurno(turno) {
  const file = turno?.adjunto?.imagenes?.[0]?.filename;
  if (file) {
    const publico = path.join(DIR_FLAYER_PUBLICO, path.basename(file));
    if (fs.existsSync(publico)) return `/flayers/${path.basename(file)}`;
  }
  const html = String(turno?.respuesta || '').match(/\/flayers\/[a-z0-9-]+\.html/i);
  return html ? html[0] : null;
}

function nluParaWeb(nlu) {
  const intencion = nlu?.intencion;
  if (INTENCIONES_CATALOGO.has(intencion) || intencion === 'solicitar_agente') {
    return { ...nlu, intencion: intencion === 'solicitar_agente' ? 'agendar_llamada' : 'consulta_comercial' };
  }
  return nlu;
}

function llamadaConfirmada(com) {
  return (
    Boolean(ficha.esNombrePersona(com?.nombre) && ficha.celularValido(com?.celular || com?.celularWeb))
  );
}

async function cargarContextoPrincipal(idEmpresa) {
  return withPool(async (pool) => {
    const config = await whatsappBotConfigRepository.getOrCreate(pool, idEmpresa);
    const wa = await empresaWhatsAppRepository.getByEmpresa(pool, idEmpresa);
    const celularEmpresa = await suscripcionRepository.obtenerCelularEmpresa(pool, idEmpresa);
    const vinculado = wa?.telefonoVinculado || null;
    return { config, telefonoVinculadoBot: vinculado, celularEmpresaPrincipal: celularEmpresa };
  });
}

function turnoBienvenida(conv) {
  return {
    respuesta: [
      '¡Hola! 👋 Soy el asesor comercial de *EFAFERP* (BUSINESS SOFT).',
      '',
      'Para orientarte mejor y brindarte una atención personalizada, ¿me indicas tu *nombre*, tu número de *celular* y a qué *rubro* o tipo de negocio te dedicas?',
      '',
      '(Si prefieres, también puedes hacerme tu consulta directamente).'
    ].join('\n'),
    conv: { estado: 'comercial_ia', slots: conv.slots || {}, candidatos: [] }
  };
}

async function procesar(body) {
  const texto = sanitizar(body?.mensaje);
  if (!texto) {
    const e = new Error('Escribe un mensaje.');
    e.code = 'MENSAJE_VACIO';
    throw e;
  }

  const sessionId = sessionIdValido(body?.sessionId);
  limpiarSesiones();

  const idEmpresa = await whatsappBotComercial.idEmpresaPrincipal();
  if (!idEmpresa) {
    const e = new Error('El chat no está disponible en este momento.');
    e.code = 'NO_PRINCIPAL';
    throw e;
  }

  const conv = getConv(sessionId);
  const celularTurno = extraerCelularPeru(texto) || conv.slots?.comercial?.celularWeb || null;
  if (celularTurno) {
    conv.slots = { ...(conv.slots || {}), comercial: { ...(conv.slots?.comercial || {}), celularWeb: celularTurno } };
  }

  const ctxWa = await cargarContextoPrincipal(idEmpresa);
  const ctx = {
    ...ctxWa,
    telefonoLog: `web:${sessionId.replace(/-/g, '').slice(0, 16)}`,
    digitosCelular: celularTurno,
    canal: 'web',
    rutaActual: sanitizar(body?.rutaActual, 200),
    pasoRegistro: sanitizar(body?.pasoRegistro, 40),
    errorPantalla: sanitizar(body?.errorPantalla, 200)
  };

  let nlu = nluParaWeb(whatsappBotNlu.interpretar(texto, { estado: conv.estado, slots: conv.slots }));
  let turno = await whatsappBotComercial.intentarProcesar(idEmpresa, conv, nlu, texto, ctx);

  if (!turno && (nlu.intencion === 'hola' || nlu.intencion === 'menu' || nlu.intencion === 'ping')) {
    if (conv.slots?.comercial && (conv.slots.comercial.rubro || conv.slots.comercial.nombre || conv.slots.comercial.flujo)) {
      nlu = { ...nlu, intencion: 'consulta_comercial' };
      turno = await whatsappBotComercial.intentarProcesar(
        idEmpresa,
        { ...conv, estado: 'comercial_ia' },
        nlu,
        texto,
        ctx
      );
    } else {
      turno = turnoBienvenida(conv);
    }
  }
  if (!turno) {
    nlu = { ...nlu, intencion: 'consulta_comercial' };
    turno = await whatsappBotComercial.intentarProcesar(
      idEmpresa,
      { ...conv, estado: 'comercial_ia' },
      nlu,
      texto,
      ctx
    );
  }
  if (!turno) {
    turno = turnoBienvenida(conv);
  }

  const nextConv = turno.conv || conv;
  saveConv(sessionId, nextConv);

  const com = nextConv.slots?.comercial || {};
  if (ficha.esNombrePersona(com.nombre) && ficha.celularValido(com.celular || com.celularWeb)) {
    if (!com.mejorHorario) com.mejorHorario = 'Hoy antes de las 6:00 pm';
    com.quiereLlamada = true;
    com.esperandoDatosLlamada = false;
  }
  const agendada = llamadaConfirmada(com);
  let avisoEnviado = Boolean(turno.avisoEnviado || com.avisoLlamadaOk);
  if (agendada && !avisoEnviado) {
    const extra = await whatsappBotComercial.avisarSoporteSiCorresponde(
      idEmpresa,
      ctx,
      { quiereLlamada: true, comercial: com },
      nextConv.slots
    );
    avisoEnviado = Boolean(extra?.ok);
    saveConv(sessionId, nextConv);
  }

  return {
    sessionId,
    respuesta: adaptarRespuestaWeb(ficha.sanitizarAlucinacionesComercial(turno.respuesta), agendada, com),
    imagenUrl: imagenUrlDeTurno(turno),
    llamadaAgendada: agendada,
    avisoEnviado
  };
}

module.exports = { procesar };
