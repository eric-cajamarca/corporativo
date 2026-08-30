/**
 * Calificador comercial (estilo LAIA) solo para el WhatsApp de la empresa principal.
 * Gemini entiende el mensaje, rellena ficha y pide el dato que falta.
 */
const geminiClient = require('../utils/gemini.client');
const ficha = require('../utils/whatsappBotComercial.conocimiento');
const { trace } = require('../utils/whatsappBotTrace.util');

const MAX_TEXTO = 800;
const MAX_HISTORIAL = 8;
const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = 20;
const ventanas = new Map();

const ACCIONES = new Set([
  'preguntar',
  'ofrecer_demo',
  'ofrecer_llamada',
  'enviar_planes',
  'enviar_guia',
  'listo'
]);

function sanitizar(v, max = MAX_TEXTO) {
  return String(v || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max);
}

function assertRateLimit(clave) {
  const now = Date.now();
  const prev = ventanas.get(clave) || [];
  const vivos = prev.filter((t) => now - t < VENTANA_MS);
  if (vivos.length >= MAX_POR_VENTANA) {
    const e = new Error('Demasiadas consultas comerciales. Espere un momento.');
    e.code = 'RATE_LIMIT';
    throw e;
  }
  vivos.push(now);
  ventanas.set(clave, vivos);
}

function parseJsonModelo(texto) {
  const raw = String(texto || '').trim();
  const cerca = raw.match(/\{[\s\S]*\}/);
  if (!cerca) return null;
  try {
    return JSON.parse(cerca[0]);
  } catch {
    return null;
  }
}

function mergeFicha(prev, incoming, textoEntrada) {
  const out = { ...(prev || {}) };
  const src = incoming && typeof incoming === 'object' ? incoming : {};
  const campos = ['rubro', 'rubroLibre', 'necesidad', 'mejorHorario'];
  for (const k of campos) {
    const v = sanitizar(src[k], 160);
    if (v) out[k] = v;
  }
  if (ficha.esNombrePersona(src.nombre)) {
    out.nombre = sanitizar(src.nombre, 80);
  } else if (src.nombre && !ficha.esNombrePersona(out.nombre)) {
    delete out.nombre;
  }
  const celFicha = ficha.extraerCelularPeru(src.celular || src.celularWeb || '');
  if (celFicha) out.celular = celFicha;

  const encaja = String(src.encaja || out.encaja || 'indefinido');
  out.encaja = ['si', 'no', 'parcial', 'indefinido'].includes(encaja) ? encaja : 'indefinido';
  const intent = String(src.intencionCompra || out.intencionCompra || 'baja');
  out.intencionCompra = ['baja', 'media', 'alta'].includes(intent) ? intent : 'baja';

  const detectado = ficha.detectarRubro(textoEntrada);
  if (detectado) {
    if (!out.rubro) out.rubro = detectado.etiqueta;
    if (out.encaja === 'indefinido') out.encaja = detectado.encaja;
  }
  const horario = ficha.extraerHorario(textoEntrada);
  if (horario) out.mejorHorario = horario;
  const nom = ficha.extraerNombrePersona(textoEntrada);
  if (nom) out.nombre = nom;
  const cel = ficha.extraerCelularPeru(textoEntrada);
  if (cel) out.celular = cel;
  if (!ficha.esNombrePersona(out.nombre)) delete out.nombre;
  return out;
}

function confirmarLlamada(comercial, opts = {}) {
  return {
    respuesta: ficha.textoConfirmarLlamada(comercial.nombre, comercial.mejorHorario, {
      ...opts,
      celular: comercial.celular || comercial.celularWeb
    }),
    comercial: {
      ...comercial,
      quiereLlamada: true,
      esperandoDatosLlamada: false,
      sugirioCambioDia: false,
      intencionCompra: 'alta',
      aceptoFueraHorario: Boolean(opts.fueraHorario)
    },
    accion: 'ofrecer_llamada',
    slugFlayer: null,
    quiereLlamada: true
  };
}

function pedirDatosOConfirmar(comercial, textoEntrada, requiereCelular) {
  comercial = { ...comercial, requiereCelular: Boolean(requiereCelular) };
  const miss = ficha.faltantesCita(comercial, { requiereCelular });
  if (miss.length) {
    return {
      respuesta: ficha.textoPedirDatosCita(miss, comercial),
      comercial: {
        ...comercial,
        quiereLlamada: true,
        esperandoDatosLlamada: true,
        intencionCompra: 'alta'
      },
      accion: 'ofrecer_llamada',
      slugFlayer: null,
      quiereLlamada: true
    };
  }
  return confirmarOAjustarLlamada(comercial, textoEntrada);
}

function parecePedidoLlamada(texto, nlu, comercial) {
  if (comercial?.esperandoDatosLlamada || comercial?.quiereLlamada) return true;
  if (nlu?.intencion === 'agendar_llamada') return true;
  return /\b(ll[aá]men|ll[aá]mada|agendar|que me llamen|quiero que me llam)/i.test(String(texto || ''));
}

function confirmarOAjustarLlamada(comercial, textoEntrada) {
  if (!ficha.esNombrePersona(comercial?.nombre) || !String(comercial?.mejorHorario || '').trim()) {
    return pedirDatosOConfirmar(comercial, textoEntrada, Boolean(comercial?.requiereCelular));
  }
  if (comercial.sugirioCambioDia) {
    if (ficha.pareceAceptaSugerido(textoEntrada) && comercial.horarioSugerido) {
      return confirmarLlamada({
        ...comercial,
        mejorHorario: comercial.horarioSugerido
      });
    }
    const cita = ficha.extraerNombreHorario(textoEntrada);
    const evInsiste = cita ? ficha.evaluarCitaLaborable(cita.mejorHorario) : { ok: true };
    if (ficha.pareceInsisteFueraHorario(textoEntrada) || (cita && !evInsiste.ok)) {
      const horario = (cita && !evInsiste.ok) ? cita.mejorHorario : (comercial.horarioPedido || comercial.mejorHorario);
      return confirmarLlamada({
        ...comercial,
        nombre: comercial.nombre,
        mejorHorario: horario
      }, { fueraHorario: true });
    }
    if (cita && evInsiste.ok) {
      return confirmarLlamada({ ...comercial, nombre: cita.nombre || comercial.nombre, mejorHorario: cita.mejorHorario });
    }
  }

  const ev = ficha.evaluarCitaLaborable(comercial.mejorHorario);
  if (!ev.ok) {
    return {
      respuesta: ficha.textoSugerirDiaHabil(comercial.nombre, ev),
      comercial: {
        ...comercial,
        quiereLlamada: true,
        esperandoDatosLlamada: true,
        sugirioCambioDia: true,
        horarioPedido: ev.horarioPedido,
        horarioSugerido: ev.horarioSugerido,
        intencionCompra: 'alta'
      },
      accion: 'ofrecer_llamada',
      slugFlayer: null,
      quiereLlamada: false
    };
  }
  return confirmarLlamada(comercial);
}

function extraerJsonTurno(data) {
  const parts = geminiClient.extraerPartes(data);
  const texto = parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('\n');
  return parseJsonModelo(texto);
}

function fallbackReglas(textoEntrada, comercial, nlu) {
  const merged = mergeFicha(comercial, {}, textoEntrada);
  const t = String(textoEntrada || '');
  if (comercial.sugirioCambioDia && comercial.nombre) {
    return confirmarOAjustarLlamada({ ...comercial, ...merged, nombre: merged.nombre || comercial.nombre }, t);
  }
  if (parecePedidoLlamada(t, nlu, comercial)) {
    return pedirDatosOConfirmar(merged, t, Boolean(comercial.requiereCelular));
  }
  if (/\b(configur|quien me ayuda|quien me acompaña|me ayudan a)\b/i.test(t)) {
    return {
      respuesta: [
        'Sí: un *asesor de BUSINESS SOFT COMPANY S.A.C.* te acompaña a dejarlo listo para tu empresa (sobre todo SUNAT).',
        'Horario: lun–vie 9:00 a 18:00 (Perú). Dentro del sistema, el *asistente de la plataforma* es para guiarte en el uso del sistema.',
        'Si quieres, escribe *LLAMADA* y tu nombre + horario.'
      ].join('\n'),
      comercial: { ...merged, intencionCompra: 'media' },
      accion: 'listo',
      slugFlayer: null,
      quiereLlamada: false
    };
  }
  if (/\bdemo\b|14 dias|prueba/i.test(t)) {
    return {
      respuesta: [
        'En la demo entras al *sistema real* 14 días, sin tarjeta: cargas productos, vendes, ves stock y créditos.',
        `Regístrate aquí: ${ficha.urlPublica('/suscribirse/demo')}`,
        'Cuando contrates, un asesor te acompaña con SUNAT. ¿Quieres el enlace o que te llamemos?'
      ].join('\n'),
      comercial: { ...merged, intencionCompra: 'media' },
      accion: 'ofrecer_demo',
      slugFlayer: null,
      quiereLlamada: false
    };
  }
  if (nlu?.intencion === 'planes_saas' || /^(planes)$/i.test(t.trim())) {
    return {
      respuesta: ficha.textoPlanes(),
      comercial: { ...merged, intencionCompra: 'alta' },
      accion: 'enviar_planes',
      slugFlayer: null,
      quiereLlamada: false
    };
  }
  if (merged.encaja === 'si') {
    return {
      respuesta: [
        `Para *${merged.rubro || 'tu rubro'}* sí te encaja: ventas, stock, créditos y SUNAT.`,
        `Prueba 14 días: ${ficha.urlPublica('/suscribirse/demo')}`,
        '¿Qué te duele más hoy: inventario, cobranzas o facturación?'
      ].join('\n'),
      comercial: { ...merged, intencionCompra: merged.intencionCompra === 'baja' ? 'media' : merged.intencionCompra },
      accion: 'ofrecer_demo',
      slugFlayer: null,
      quiereLlamada: false
    };
  }
  if (merged.encaja === 'no' || merged.encaja === 'parcial') {
    return {
      respuesta: [
        merged.encaja === 'parcial'
          ? 'En ese rubro hay que evaluarlo con calma (no es el caso típico de ferretería/repuestos/pinturas/ropa/librería).'
          : 'Ese rubro no es el que EFAFERP atiende de forma típica. No quiero venderte algo que no te sirva.',
        '',
        ficha.textoLlamadaSoporte(false, merged, { requiereCelular: Boolean(comercial.requiereCelular) })
      ].join('\n'),
      comercial: { ...merged, quiereLlamada: true, esperandoDatosLlamada: true },
      accion: 'ofrecer_llamada',
      slugFlayer: null,
      quiereLlamada: true
    };
  }
  return {
    respuesta: 'Para decirte si EFAFERP te sirve, ¿a qué se dedica tu negocio? (ferretería, repuestos, pinturas, ropa, librería u otro)',
    comercial: merged,
    accion: 'preguntar',
    slugFlayer: null,
    quiereLlamada: false
  };
}

async function llamarGemini(textoEntrada, comercial, historial, nlu) {
  const apiKey = geminiClient.resolverApiKeyBot();
  if (!apiKey) {
    const e = new Error('Bot comercial sin GEMINI_API_KEY');
    e.code = 'GEMINI_NO_CONFIG';
    throw e;
  }
  const fichaLimpia = { ...comercial };
  delete fichaLimpia.historial;
  delete fichaLimpia.avisoLlamadaEnviado;
  delete fichaLimpia.avisoAltaEnviado;

  const contents = [];
  for (const h of historial) {
    const role = h.role === 'model' ? 'model' : 'user';
    const text = sanitizar(h.text, 400);
    if (text) contents.push({ role, parts: [{ text }] });
  }
  contents.push({ role: 'user', parts: [{ text: sanitizar(textoEntrada) }] });
  trace('4a.CONSULTA_GEMINI', { nlu: nlu?.intencion, ficha: fichaLimpia, texto: textoEntrada });

  const { data } = await geminiClient.generateConHerramientas({
    apiKey,
    systemInstruction: ficha.promptPreventaIa(fichaLimpia, nlu?.intencion),
    contents,
    generationConfig: { temperature: 0.4, maxOutputTokens: 700 }
  });
  const parsed = extraerJsonTurno(data);
  if (!parsed || !parsed.respuesta) {
    throw new Error('Respuesta comercial IA no válida');
  }
  trace('4b.INTERPRETACION_GEMINI', {
    accion: parsed.accion,
    encaja: parsed.ficha?.encaja,
    intencionCompra: parsed.ficha?.intencionCompra,
    quiereLlamada: parsed.quiereLlamada,
    respuesta: parsed.respuesta
  });
  return parsed;
}

/**
 * @returns {Promise<{respuesta:string, comercial:object, accion:string, slugFlayer:string|null, quiereLlamada:boolean}>}
 */
async function procesarTurnoIa({ textoEntrada, slots, nlu, claveRateLimit, canal }) {
  const comercial = { ...(slots?.comercial || {}) };
  comercial.requiereCelular = canal === 'web' || Boolean(comercial.requiereCelular);
  const requiereCelular = Boolean(comercial.requiereCelular);
  const historial = Array.isArray(comercial.historial) ? comercial.historial.slice(-MAX_HISTORIAL) : [];
  const texto = sanitizar(textoEntrada);
  if (claveRateLimit) {
    try {
      assertRateLimit(String(claveRateLimit));
    } catch (err) {
      if (err.code === 'RATE_LIMIT') {
        return {
          respuesta: 'Dame un momento y escribe de nuevo, o pide *LLAMADA* para que te contacte soporte.',
          comercial,
          accion: 'preguntar',
          slugFlayer: null,
          quiereLlamada: false
        };
      }
      throw err;
    }
  }

  const mergedEarly = mergeFicha(comercial, {}, texto);
  if (parecePedidoLlamada(texto, nlu, comercial)) {
    const outCita = pedirDatosOConfirmar(mergedEarly, texto, requiereCelular);
    const histCita = historial.concat([
      { role: 'user', text: texto.slice(0, 400) },
      { role: 'model', text: String(outCita.respuesta || '').slice(0, 400) }
    ]).slice(-MAX_HISTORIAL);
    outCita.comercial = { ...outCita.comercial, requiereCelular, historial: histCita };
    trace('4.BACKEND_SIN_GEMINI', { motivo: 'cita_datos', accion: outCita.accion, faltantes: ficha.faltantesCita(outCita.comercial, { requiereCelular }) });
    trace('4c.RESPUESTA_BACKEND', { texto: outCita.respuesta });
    return outCita;
  }

  let out;
  try {
    const parsed = await llamarGemini(texto, comercial, historial, nlu);
    const accion = ACCIONES.has(parsed.accion) ? parsed.accion : 'preguntar';
    const merged = mergeFicha(comercial, parsed.ficha, texto);
    const quiereLlamada = Boolean(parsed.quiereLlamada) || accion === 'ofrecer_llamada';
    if (quiereLlamada) merged.quiereLlamada = true;
    let respuesta = sanitizar(ficha.sanitizarAlucinacionesComercial(parsed.respuesta), 1200);
    if (accion === 'enviar_planes' && !/businesssoft\.net\/planes/i.test(respuesta)) {
      respuesta = `${respuesta}\n${ficha.urlPublica('/planes')}`;
    }
    if (accion === 'ofrecer_demo' && !/suscribirse\/demo/i.test(respuesta)) {
      respuesta = `${respuesta}\n${ficha.urlPublica('/suscribirse/demo')}`;
    }
    let slugFlayer = parsed.slugFlayer || null;
    if (accion === 'enviar_guia' && !slugFlayer) {
      slugFlayer = ficha.resolverFlayer(texto)?.slug || null;
    }
    out = { respuesta, comercial: merged, accion, slugFlayer, quiereLlamada };
  } catch (err) {
    if (err.code !== 'GEMINI_NO_CONFIG') {
      console.error('whatsappBotComercialIa:', err.message);
    }
    out = fallbackReglas(texto, { ...comercial, requiereCelular }, nlu);
    trace('4.BACKEND_SIN_GEMINI', { motivo: err.code || err.message, accion: out.accion });
  }

  if (out.quiereLlamada || out.accion === 'ofrecer_llamada' || parecePedidoLlamada(texto, nlu, out.comercial)) {
    out = pedirDatosOConfirmar(out.comercial, texto, requiereCelular);
  }

  const hist = historial.concat([
    { role: 'user', text: texto.slice(0, 400) },
    { role: 'model', text: String(out.respuesta || '').slice(0, 400) }
  ]).slice(-MAX_HISTORIAL);
  out.comercial = { ...out.comercial, requiereCelular, historial: hist };
  trace('4c.RESPUESTA_BACKEND', {
    accion: out.accion,
    quiereLlamada: out.quiereLlamada,
    texto: out.respuesta
  });
  return out;
}

module.exports = {
  procesarTurnoIa,
  fallbackReglas,
  mergeFicha,
  parseJsonModelo
};
