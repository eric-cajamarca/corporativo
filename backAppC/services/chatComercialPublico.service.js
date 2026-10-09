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
const whatsappBotLeadComercial = require('./whatsappBotLeadComercial.service');
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

function adaptarRespuestaWeb(texto, recienAgendada, com, yaEstabaAgendada = false) {
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

  const tieneCelularValido = ficha.celularValido(com?.celular || com?.celularWeb);

  // Si no hay celular válido en el chat web, NUNCA prometer llamada
  if (!tieneCelularValido) {
    t = t.replace(/\b(te llamamos hoy antes de las 6:00 pm|te llamaremos hoy antes de las 6:00 pm|un asesor te contactar[aá] hoy antes de las 6:00 pm)\b/gi, 'si nos compartes tu celular, un asesor comercial te contactará con gusto');
  }

  // Si la llamada recién se agendó en ESTE turno exacto, emitir el mensaje de confirmación
  if (recienAgendada && com && ficha.esNombrePersona(com.nombre) && tieneCelularValido) {
    const cel = com.celular || com.celularWeb || '';
    const celTxt = cel ? ` al *${cel}*` : '';
    if (com.interesEnterprise) {
      const rubroTxt = (com.rubro || com.rubroLibre) ? ` para tu empresa en el rubro de *${com.rubro || com.rubroLibre}*` : '';
      t = [
        `¡Muchas gracias, *${com.nombre}*! Hemos registrado tu solicitud de cotización para el plan *Enterprise*${rubroTxt}.`,
        '',
        `Un asesor de *BUSINESS SOFT COMPANY* revisará tus requerimientos y te contactará vía *WhatsApp*${celTxt} a la brevedad posible para brindarte la propuesta técnica y comercial a tu medida.`,
        '',
        '¿Tienes alguna duda técnica o requerimiento específico que quieras revisar mientras tanto?'
      ].join('\n');
    } else {
      const horTxt = (com.mejorHorario && com.mejorHorario !== 'Hoy antes de las 6:00 pm')
        ? ` en tu horario preferido (*${com.mejorHorario}*)`
        : '';
      t = [
        `¡Listo, *${com.nombre}*! Hemos registrado tus datos de contacto${celTxt}${horTxt}.`,
        'Un asesor de BUSINESS SOFT se comunicará contigo por llamada o WhatsApp para coordinar.',
        '',
        '¿Tienes alguna duda puntual que quieras revisar mientras tanto, o prefieres ir probando la demo gratis de 14 días?'
      ].join('\n');
    }
  } else if (!yaEstabaAgendada && !recienAgendada && !tieneCelularValido && /te contactará hoy/i.test(t)) {
    t = t.replace(/Un asesor de BUSINESS SOFT te contactará hoy antes de las 6:00 pm\.?/gi, 'Déjanos tu celular si deseas que un asesor te contacte.');
  }

  // Asegurar que si dice "en el siguiente enlace" tenga la URL
  if (/\b(en el siguiente enlace|en este enlace|al siguiente enlace)\b/i.test(t) && !/https?:\/\/[^\s)]+/i.test(t)) {
    const urlExtra = /demo/i.test(t) ? 'https://efaferp.com/suscribirse/demo' : 'https://efaferp.com/planes';
    t = `${t}\n👉 ${urlExtra}`.trim();
  }

  // Deduplicar URLs idénticas en la respuesta para evitar repeticiones
  const urlsVistas = new Set();
  t = t.replace(/https?:\/\/[^\s)]+/g, (match) => {
    const norm = match.replace(/[.,;:!]+$/, '').toLowerCase();
    if (urlsVistas.has(norm)) {
      return '';
    }
    urlsVistas.add(norm);
    return match;
  });

  return t.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
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

const CHIPS_RUBROS = [
  { id: 'avicola', label: '🍗 Avícola', textToSend: 'Tengo una avícola' },
  { id: 'ferreteria', label: '🔧 Ferretería', textToSend: 'Tengo una ferretería' },
  { id: 'abarrotes', label: '📦 Abarrotes / Minimarket', textToSend: 'Tengo un minimarket de abarrotes' },
  { id: 'repuestos', label: '🏍️ Repuestos', textToSend: 'Tengo una tienda de repuestos' },
  { id: 'ropa', label: '👕 Ropa / Calzado', textToSend: 'Tengo una tienda de ropa y calzado' },
  { id: 'botica', label: '💊 Botica / Farmacia', textToSend: 'Tengo una botica o farmacia' },
  { id: 'carniceria', label: '🥩 Carnicería', textToSend: 'Tengo una carnicería' }
];

const CHIPS_POST_PITCH = [
  { id: 'demo', label: '🚀 Probar demo gratis', textToSend: 'Quiero probar la demo gratis de 14 días' },
  { id: 'planes', label: '📋 Planes y precios', textToSend: '¿Cuáles son los planes y precios?' },
  { id: 'sunat', label: '🧾 Facturación SUNAT gratis', textToSend: '¿Cómo funciona la configuración de SUNAT gratis?' },
  { id: 'llamada', label: '📞 Solicitar llamada', textToSend: 'Quiero que un asesor me llame' },
  { id: 'enterprise', label: '🏢 Cotizar Enterprise', textToSend: 'Deseo cotizar el Plan Enterprise' }
];

function resolverChipsTurno(com, turno, agendada, textoRespuesta) {
  // 1. Si la llamada ya está agendada o confirmada, NUNCA mostrar chips
  if (agendada || com?.avisoLlamadaOk || com?.avisoEnterpriseOk || com?.confirmacionLlamadaEnviadaWeb) {
    return [];
  }

  // 2. Si el bot está en flujo de captura de datos (esperando llamada o enterprise):
  if (turno?.accion === 'ofrecer_llamada' || com?.esperandoDatosLlamada || com?.esperandoDatosEnterprise || com?.quiereLlamada) {
    return [];
  }

  const pedirDato = String(turno?.pedirDato || com?.pedirDato || '').toLowerCase();
  if (['nombre', 'celular', 'horario'].includes(pedirDato)) {
    return [];
  }

  // 3. Si el texto del bot pide nombre, teléfono, celular o un horario para contactarlo:
  const t = String(textoRespuesta || '').toLowerCase();
  const pideDatosContacto =
    /\b(compartir.*(nombre|celular|horario|tel[eé]fono|whatsapp)|tu nombre|tu n[uú]mero|tu celular|d[eé]jame tu (nombre|n[uú]mero|celular)|un horario c[oó]modo|en qu[eé] horario|c[oó]mo te llamas|ind[ií]canos tu|br[ií]ndanos tu|facil[ií]tanos tu)\b/i.test(t);
  if (pideDatosContacto) {
    return [];
  }

  // 4. Si aún no tenemos rubro y el mensaje pregunta a qué se dedica:
  const tieneRubro = Boolean(com?.rubro || com?.rubroLibre);
  if (!tieneRubro && (com?.esperandoRubro || pedirDato === 'rubro' || /\b(rubro|a qu[eé] se dedica|qu[eé] vendes|tipo de tienda|tipo de negocio)\b/i.test(t))) {
    return CHIPS_RUBROS;
  }

  // 5. Si acaba de darse el pitch del rubro o se presenta la demo gratuita de su rubro:
  const esPitchRubro = turno?.plantilla === 'pitch_rubro' || /\b(14 d[ií]as gratis|probar el sistema con tu propia informaci[oó]n|probar efaferp gratis)\b/i.test(t);
  if (esPitchRubro) {
    const tieneCel = Boolean(com?.celular || com?.celularWeb);
    return CHIPS_POST_PITCH.filter(c => !tieneCel || c.id !== 'llamada');
  }

  // 6. Por defecto en cualquier otro turno conversacional, pantalla limpia
  return [];
}

function turnoBienvenida(conv) {
  return {
    respuesta: [
      '¡Hola! Qué gusto saludarte. 👋 Soy tu asesor comercial en *EFAFERP* (BUSINESS SOFT COMPANY).',
      '',
      'Estoy aquí para ayudarte a ordenar las ventas, controlar el inventario y facilitar la facturación SUNAT de tu negocio sin complicaciones ni pérdidas de tiempo.',
      '',
      'Para orientarte de la mejor manera: ¿cómo te llamas, cuál es tu número de *WhatsApp* y a qué *rubro* se dedica tu negocio?',
      '',
      '_Si tienes una consulta puntual (precios, funciones, stock o SUNAT), dímela con toda confianza y te respondo de inmediato._ 😊'
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
  const comPrev = conv.slots?.comercial || {};
  const yaEstabaAgendada = Boolean(comPrev.avisoLlamadaOk || comPrev.confirmacionLlamadaEnviadaWeb);

  // 1. Manejo inmediato si el cliente expresa confusión ("no entiendo", "no me queda claro", etc.)
  if (ficha.pareceConfundido(texto)) {
    return {
      sessionId,
      respuesta: ficha.textoClienteConfundido(),
      imagenUrl: null,
      llamadaAgendada: llamadaConfirmada(comPrev),
      avisoEnviado: false,
      chips: []
    };
  }

  // 2. Manejo cordial y no repetitivo para agradecimientos
  if (/^(gracias|muchas gracias|mil gracias|ok gracias|listo gracias)$/i.test(texto)) {
    const nomTxt = ficha.esNombrePersona(comPrev.nombre) ? `, *${comPrev.nombre}*` : '';
    const tieneCel = ficha.celularValido(comPrev.celular || comPrev.celularWeb);
    let resp = '';
    if (tieneCel) {
      resp = `¡Con mucho gusto${nomTxt}! Ya tenemos tus datos de contacto registrados para coordinar. Si tienes cualquier otra duda sobre EFAFERP, aquí sigo para orientarte.`;
    } else {
      resp = `¡Con mucho gusto${nomTxt}! Si tienes cualquier otra duda sobre el sistema o los planes, dime con confianza. Y si deseas que un asesor comercial te llame para coordinar, déjame tu número de WhatsApp y tu nombre.`;
    }
    return {
      sessionId,
      respuesta: resp,
      imagenUrl: null,
      llamadaAgendada: llamadaConfirmada(comPrev),
      avisoEnviado: false,
      chips: []
    };
  }

  // 3. Manejo natural para confirmaciones simples ("ok", "dale", "perfecto")
  if (/^(ok|okay|dale|perfecto|listo|de acuerdo|bueno|bien|entendido)$/i.test(texto)) {
    const nomTxt = ficha.esNombrePersona(comPrev.nombre) ? `, *${comPrev.nombre}*` : '';
    const tieneCel = ficha.celularValido(comPrev.celular || comPrev.celularWeb);
    let resp = `¡Excelente${nomTxt}! ¿Hay alguna función o duda que quisieras revisar (facturación SUNAT, inventario, control de caja o WhatsApp)?`;
    if (!tieneCel) {
      resp += '\n\nTambién puedes dejarnos tu número de celular o WhatsApp si deseas una demostración guiada con un asesor.';
    }
    return {
      sessionId,
      respuesta: resp,
      imagenUrl: null,
      llamadaAgendada: llamadaConfirmada(comPrev),
      avisoEnviado: false,
      chips: []
    };
  }

  const celularTurno = extraerCelularPeru(texto) || comPrev.celularWeb || null;
  const esInteresEnterpriseTurno = ficha.pareceCotizacionEnterprise(texto) || comPrev.interesEnterprise;
  if (celularTurno || esInteresEnterpriseTurno) {
    conv.slots = {
      ...(conv.slots || {}),
      comercial: {
        ...(conv.slots?.comercial || {}),
        ...(celularTurno ? { celularWeb: celularTurno } : {}),
        ...(esInteresEnterpriseTurno ? { interesEnterprise: true, planCode: 'enterprise', intencionCompra: 'alta' } : {})
      }
    };
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
  const com = nextConv.slots?.comercial || {};
  const agendada = llamadaConfirmada(com);
  const recienAgendada = agendada && !yaEstabaAgendada;

  if (agendada) {
    if (!com.mejorHorario) com.mejorHorario = 'Horario de oficina (lun–vie 9:00 a 18:00)';
    com.quiereLlamada = false;
    com.esperandoDatosLlamada = false;
    com.confirmacionLlamadaEnviadaWeb = true;
  }

  let avisoEnviado = Boolean(turno.avisoEnviado || com.avisoLlamadaOk || com.avisoEnterpriseOk);
  const listoParaAvisoEnterprise = com.interesEnterprise && !com.avisoEnterpriseOk && ficha.esNombrePersona(com.nombre) && ficha.celularValido(com.celular || com.celularWeb);
  if ((recienAgendada || listoParaAvisoEnterprise) && !avisoEnviado) {
    const extra = await whatsappBotComercial.avisarSoporteSiCorresponde(
      idEmpresa,
      ctx,
      { quiereLlamada: true, comercial: com },
      nextConv.slots
    );
    avisoEnviado = Boolean(extra?.ok);
    if (com.interesEnterprise) {
      com.avisoEnterpriseOk = true;
    } else {
      com.avisoLlamadaOk = true;
    }
  }

  // Guardar y mantener actualizado el lead en la BD (WhatsAppBotLeadComercial)
  if (com.nombre || com.celular || com.celularWeb || com.rubro || agendada) {
    whatsappBotLeadComercial.registrarDesdeTurno(
      idEmpresa,
      ctx,
      { comercial: com, quiereLlamada: agendada },
      texto
    ).catch((errLead) => {
      console.error('chatComercialPublico registrarLead error:', errLead.message);
    });
  }

  saveConv(sessionId, nextConv);

  const respuestaTextoFinal = adaptarRespuestaWeb(ficha.sanitizarAlucinacionesComercial(turno.respuesta), recienAgendada, com, yaEstabaAgendada);
  const chipsCalculados = resolverChipsTurno(com, turno, agendada, respuestaTextoFinal);

  return {
    sessionId,
    respuesta: respuestaTextoFinal,
    imagenUrl: imagenUrlDeTurno(turno),
    llamadaAgendada: agendada,
    avisoEnviado,
    chips: chipsCalculados
  };
}

module.exports = { procesar };
