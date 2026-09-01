/**
 * Calificador comercial (estilo LAIA) solo para el WhatsApp de la empresa principal.
 * Gemini entiende el mensaje, rellena ficha y pide el dato que falta.
 */
const geminiClient = require('../utils/gemini.client');
const ficha = require('../utils/whatsappBotComercial.conocimiento');
const pubDatos = require('./whatsappBotComercialPublico.datos');
const { trace } = require('../utils/whatsappBotTrace.util');

const MAX_TEXTO = 800;
const MAX_HISTORIAL = 8;
const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = 20;
const ventanas = new Map();

const ACCIONES = new Set([
  'preguntar',
  'ofrecer_demo',
  'acompanar_demo',
  'acompanar_pago',
  'sugerir_llamada',
  'ofrecer_llamada',
  'enviar_planes',
  'enviar_guia',
  'aviso_pago_manual',
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

  const detectado = ficha.detectarRubro(`${textoEntrada} ${out.rubro || ''} ${out.rubroLibre || ''}`);
  if (detectado) {
    out.rubro = detectado.etiqueta;
    out.rubroLibre = detectado.etiqueta;
    if (out.encaja === 'indefinido') out.encaja = detectado.encaja;
    out.esperandoRubro = false;
  } else {
    const libre = ficha.extraerRubroLibre(textoEntrada, out);
    if (libre) {
      if (!out.rubro && libre.rubro) out.rubro = libre.rubro;
      if (!out.rubroLibre) out.rubroLibre = libre.rubroLibre;
      if (out.encaja === 'indefinido' && libre.encaja) out.encaja = libre.encaja;
      out.esperandoRubro = false;
    }
  }
  if (out.rubroLibre) {
    const limpio = ficha.resumirEtiquetaRubro(out.rubroLibre);
    if (limpio) out.rubroLibre = limpio;
  }
  const horario = ficha.extraerHorario(textoEntrada);
  if (horario) out.mejorHorario = horario;
  const nom = ficha.extraerNombrePersona(textoEntrada);
  if (nom) out.nombre = nom;
  const cel = ficha.extraerCelularPeru(textoEntrada);
  if (cel) out.celular = cel;
  if (!ficha.esNombrePersona(out.nombre)) delete out.nombre;
  if (['demo', 'pago', 'registro'].includes(src.flujo)) out.flujo = src.flujo;
  else if (['demo', 'pago', 'registro'].includes(prev?.flujo)) out.flujo = prev.flujo;
  if (src.planCode || prev?.planCode) out.planCode = sanitizar(src.planCode || prev.planCode, 40);
  if (src.billingCycle || prev?.billingCycle) out.billingCycle = sanitizar(src.billingCycle || prev.billingCycle, 20);
  if (prev?.acompanamientoEnviado) out.acompanamientoEnviado = true;
  if (prev?.rutaActual) out.rutaActual = prev.rutaActual;
  if (prev?.pasoRegistro) out.pasoRegistro = prev.pasoRegistro;
  if (prev?.errorPantalla) out.errorPantalla = prev.errorPantalla;
  if (prev?.pagoReportado || src.pagoReportado) out.pagoReportado = true;
  if (prev?.avisoPagoOk) out.avisoPagoOk = true;
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

function parecePedidoLlamadaEsteTurno(texto, nlu) {
  if (ficha.parecePreguntaModulo(texto) || parecePausaCita(texto)) return false;
  if (nlu?.intencion === 'agendar_llamada') return true;
  if (nlu?.intencion === 'solicitar_agente') return true;
  return /\b(ll[aá]men|ll[aá]mada|agendar|que me llamen|quiero que me llam)\b/i.test(String(texto || ''));
}

function parecePausaCita(texto) {
  const t = String(texto || '');
  if (ficha.parecePreguntaModulo(t)) return true;
  if (/[¿?]/.test(t) && t.length > 15) return true;
  return /\b(antes de (pasar|darte|dar(te)?|pasarte|entregar)(me|te)? (mis |los |mis)?datos|expl[ií]ca(me)?|h[aá]blame|de qu[eé] se trata|c[oó]mo (es|funciona)|no (quiero|deseo) (la )?llamada|ahora no|despu[eé]s te (paso|doy))\b/i.test(
    t
  );
}

function pareceDatoCita(texto) {
  const t = String(texto || '').trim();
  if (!t || parecePausaCita(t)) return false;
  if (ficha.extraerCelularPeru(t)) return true;
  if (ficha.extraerNombreHorario(t)) return true;
  if (ficha.extraerHorario(t)) return true;
  if (ficha.extraerNombrePersona(t) && t.split(/\s+/).length <= 5 && !/[¿?]/.test(t)) return true;
  return /^(si|sí|ok|okay|dale|bueno|de acuerdo|claro|va)$/i.test(t);
}

function parecePedidoLlamada(texto, nlu, comercial) {
  if (parecePausaCita(texto)) return false;
  if (parecePedidoLlamadaEsteTurno(texto, nlu)) return true;
  if (comercial?.esperandoDatosLlamada && pareceDatoCita(texto)) return true;
  return false;
}

function resolverFlujoTurno(texto, nlu, comercial, ruta) {
  const pideDemo = nlu?.intencion === 'solicitar_demo' || ficha.pareceSolicitarDemo(texto);
  const pidePago = nlu?.intencion === 'contratar_plan' || ficha.pareceSolicitarPago(texto);
  if (pidePago && !(pideDemo && /\bdemo\b/i.test(texto))) return 'pago';
  if (pideDemo) return 'demo';
  if (['demo', 'pago', 'registro'].includes(comercial?.flujo)) return comercial.flujo;
  return ficha.inferirFlujoDesdeRuta(ruta);
}

function limpiarDatosEfimeros(com) {
  if (!com) return com;
  const out = { ...com };
  delete out.publicDatos;
  delete out.publicDatosTxt;
  return out;
}

function conHistorial(out, historial, texto, requiereCelular) {
  const hist = historial.concat([
    { role: 'user', text: texto.slice(0, 400) },
    { role: 'model', text: String(out.respuesta || '').slice(0, 400) }
  ]).slice(-MAX_HISTORIAL);
  out.comercial = { ...limpiarDatosEfimeros(out.comercial), requiereCelular, historial: hist };
  return out;
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

function turnoDatoPublico(texto, nlu, comercial, publicDatos) {
  if (!publicDatos) return null;
  const base = { slugFlayer: null, quiereLlamada: false };
  if (pubDatos.pareceConfirmaPago(texto, nlu)) {
    return {
      ...base,
      respuesta: pubDatos.textoConfirmaPagoCliente(),
      comercial: { ...comercial, intencionCompra: 'alta', pagoReportado: true },
      accion: 'aviso_pago_manual'
    };
  }
  if (pubDatos.parecePreguntaYape(texto) && !pubDatos.parecePreguntaPlin(texto)) {
    return {
      ...base,
      respuesta: pubDatos.textoYapePlin(publicDatos, 'yape'),
      comercial: { ...comercial, intencionCompra: 'alta' },
      accion: 'acompanar_pago'
    };
  }
  if (pubDatos.parecePreguntaPlin(texto)) {
    return {
      ...base,
      respuesta: pubDatos.textoYapePlin(publicDatos, 'plin'),
      comercial: { ...comercial, intencionCompra: 'alta' },
      accion: 'acompanar_pago'
    };
  }
  if (pubDatos.parecePreguntaCuenta(texto)) {
    return {
      ...base,
      respuesta: pubDatos.textoCuentaBancaria(publicDatos),
      comercial: { ...comercial, intencionCompra: 'alta' },
      accion: 'acompanar_pago'
    };
  }
  if (pubDatos.parecePreguntaMediosPago(texto)) {
    return {
      ...base,
      respuesta: pubDatos.textoMediosPago(publicDatos),
      comercial: { ...comercial, intencionCompra: 'alta' },
      accion: 'acompanar_pago'
    };
  }
  if (pubDatos.parecePreguntaPlanes(texto, nlu)) {
    return {
      ...base,
      respuesta: pubDatos.textoPlanesReales(publicDatos),
      comercial: { ...comercial, intencionCompra: 'alta' },
      accion: 'enviar_planes'
    };
  }
  return null;
}

function extraerJsonTurno(data) {
  const parts = geminiClient.extraerPartes(data);
  const texto = parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('\n').trim();
  const parsed = parseJsonModelo(texto);
  if (parsed && (parsed.respuesta || parsed.plantilla)) return parsed;
  if (texto && !texto.startsWith('{')) {
    return {
      respuesta: texto.slice(0, 1200),
      plantilla: 'ninguna',
      pedirDato: '',
      ficha: {},
      accion: 'listo',
      slugFlayer: null,
      quiereLlamada: false
    };
  }
  return parsed;
}

const PLANTILLAS = new Set([
  'ninguna',
  'whatsapp',
  'bot_pedidos',
  'asistente',
  'planes',
  'yape',
  'plin',
  'cuenta',
  'medios_pago',
  'demo',
  'registro',
  'pitch_rubro',
  'cita',
  'pago_confirmado',
  'guias'
]);

const PLANTILLAS_FORZAR_BLOQUE = new Set([
  'planes',
  'yape',
  'plin',
  'cuenta',
  'medios_pago',
  'pago_confirmado',
  'demo',
  'registro'
]);

function normalizarPlantilla(v) {
  const id = String(v || 'ninguna').toLowerCase().trim();
  return PLANTILLAS.has(id) ? id : 'ninguna';
}

function accionDesdePlantilla(plantilla, accionParsed) {
  const map = {
    whatsapp: 'listo',
    bot_pedidos: 'listo',
    asistente: 'listo',
    planes: 'enviar_planes',
    yape: 'acompanar_pago',
    plin: 'acompanar_pago',
    cuenta: 'acompanar_pago',
    medios_pago: 'acompanar_pago',
    demo: 'acompanar_demo',
    registro: 'acompanar_demo',
    pitch_rubro: 'ofrecer_demo',
    cita: 'ofrecer_llamada',
    pago_confirmado: 'aviso_pago_manual',
    guias: 'enviar_guia'
  };
  if (map[plantilla]) return map[plantilla];
  return ACCIONES.has(accionParsed) ? accionParsed : 'listo';
}

function fichaParaPrompt(comercial) {
  const f = { ...(comercial || {}) };
  delete f.historial;
  delete f.avisoLlamadaEnviado;
  delete f.avisoAltaEnviado;
  delete f.publicDatos;
  delete f.publicDatosTxt;
  const cel = String(f.celular || f.celularWeb || '').replace(/\D/g, '');
  if (cel.length >= 9) {
    f.tieneCelular = true;
    f.celularHint = cel.slice(-4);
  }
  delete f.celular;
  delete f.celularWeb;
  return f;
}

function bloquePlantilla(id, comercial, publicDatos) {
  switch (normalizarPlantilla(id)) {
    case 'whatsapp':
      return ficha.textoWhatsAppVinculado();
    case 'bot_pedidos':
      return ficha.textoBotPedidos();
    case 'asistente':
      return ficha.textoSoporteAsistente();
    case 'planes':
      return publicDatos ? pubDatos.textoPlanesReales(publicDatos) : ficha.textoPlanes();
    case 'yape':
      return publicDatos ? pubDatos.textoYapePlin(publicDatos, 'yape') : null;
    case 'plin':
      return publicDatos ? pubDatos.textoYapePlin(publicDatos, 'plin') : null;
    case 'cuenta':
      return publicDatos ? pubDatos.textoCuentaBancaria(publicDatos) : null;
    case 'medios_pago':
      return publicDatos ? pubDatos.textoMediosPago(publicDatos) : null;
    case 'demo':
      return ficha.textoAcompanarDemo(comercial, comercial?.rutaActual);
    case 'registro':
      return ficha.textoAcompanarRegistro(comercial?.rutaActual, comercial?.pasoRegistro);
    case 'pitch_rubro':
      return ficha.tieneRubro(comercial) ? ficha.textoPitchRubroYDemo(comercial) : null;
    case 'cita':
      return ficha.textoLlamadaSoporte(true, comercial, { requiereCelular: Boolean(comercial?.requiereCelular) });
    case 'pago_confirmado':
      return pubDatos.textoConfirmaPagoCliente();
    case 'guias':
      return ficha.textoListaFlayers();
    default:
      return null;
  }
}

function inyectarMarcadores(texto, comercial, publicDatos) {
  let r = String(texto || '');
  const mapa = {
    '[[PLANES]]': publicDatos ? pubDatos.textoPlanesReales(publicDatos) : ficha.textoPlanes(),
    '[[YAPE]]': publicDatos ? pubDatos.textoYapePlin(publicDatos, 'yape') : '',
    '[[PLIN]]': publicDatos ? pubDatos.textoYapePlin(publicDatos, 'plin') : '',
    '[[CUENTA]]': publicDatos ? pubDatos.textoCuentaBancaria(publicDatos) : '',
    '[[MEDIOS]]': publicDatos ? pubDatos.textoMediosPago(publicDatos) : '',
    '[[DEMO]]': ficha.urlDemo(),
    '[[WHATSAPP]]': ficha.textoWhatsAppVinculado(),
    '[[BOT]]': ficha.textoBotPedidos(),
    '[[ASISTENTE]]': ficha.textoSoporteAsistente(),
    '[[PITCH]]': ficha.tieneRubro(comercial) ? ficha.textoPitchRubroYDemo(comercial) : '',
    '[[GUIAS]]': ficha.textoListaFlayers()
  };
  for (const [k, v] of Object.entries(mapa)) {
    if (r.includes(k)) r = r.split(k).join(v || '');
  }
  return r.replace(/\n{3,}/g, '\n\n').trim();
}

function pedirDatoTexto(dato) {
  switch (String(dato || '').toLowerCase()) {
    case 'rubro':
      return 'Para orientarte: ¿a qué se dedica tu negocio? (qué vendes).';
    case 'nombre':
      return '¿Cómo te llamas?';
    case 'celular':
      return 'Pásame tu celular de 9 dígitos (empieza en 9).';
    case 'horario':
      return '¿En qué horario te queda una llamada? (lun–vie 9:00 a 18:00, Perú).';
    default:
      return '';
  }
}

function empiezaIgual(a, b, n = 28) {
  const x = String(a || '').replace(/\s+/g, ' ').trim();
  const y = String(b || '').replace(/\s+/g, ' ').trim();
  if (!x || !y) return false;
  return x.includes(y.slice(0, n)) || y.includes(x.slice(0, n));
}

function inferirPlantillaDatoReal(plantilla, texto, nlu, parsed) {
  if (plantilla !== 'ninguna') return plantilla;
  if (parsed.accion === 'enviar_planes') return 'planes';
  if (parsed.accion === 'aviso_pago_manual' || pubDatos.pareceConfirmaPago(texto, nlu)) return 'pago_confirmado';
  if (pubDatos.parecePreguntaYape(texto) && !pubDatos.parecePreguntaPlin(texto)) return 'yape';
  if (pubDatos.parecePreguntaPlin(texto)) return 'plin';
  if (pubDatos.parecePreguntaCuenta(texto)) return 'cuenta';
  if (pubDatos.parecePreguntaMediosPago(texto)) return 'medios_pago';
  if (pubDatos.parecePreguntaPlanes(texto, nlu)) return 'planes';
  if (parsed.accion === 'ofrecer_llamada' || parsed.quiereLlamada) return 'cita';
  if (parsed.accion === 'acompanar_demo') return 'demo';
  if (parsed.accion === 'enviar_guia') return 'guias';
  return plantilla;
}

function componerGestor(parsed, comercial, publicDatos) {
  const plantilla = normalizarPlantilla(parsed.plantilla);
  let respuesta = inyectarMarcadores(
    sanitizar(ficha.sanitizarAlucinacionesComercial(parsed.respuesta), 1200),
    comercial,
    publicDatos
  );
  const bloque = bloquePlantilla(plantilla, comercial, publicDatos);
  if (bloque) {
    if (!respuesta) {
      respuesta = bloque;
    } else if (PLANTILLAS_FORZAR_BLOQUE.has(plantilla) && !empiezaIgual(respuesta, bloque)) {
      respuesta = `${respuesta}\n\n${bloque}`.trim();
    } else if (plantilla === 'pitch_rubro' && !/suscribirse\/demo/i.test(respuesta) && !empiezaIgual(respuesta, bloque)) {
      respuesta = `${respuesta}\n\n${bloque}`.trim();
    } else if (plantilla === 'cita' && respuesta.length < 120) {
      respuesta = `${respuesta}\n\n${bloque}`.trim();
    }
  }
  const pedirDato = String(parsed.pedirDato || '').toLowerCase();
  const extra = pedirDatoTexto(pedirDato);
  if (extra && !empiezaIgual(respuesta, extra, 18)) {
    respuesta = `${respuesta}\n\n${extra}`.trim();
  }
  return { respuesta, plantilla, pedirDato };
}

function fallbackReglas(textoEntrada, comercial, nlu) {
  const merged = mergeFicha(comercial, {}, textoEntrada);
  const t = String(textoEntrada || '');
  if (comercial.sugirioCambioDia && comercial.nombre) {
    return confirmarOAjustarLlamada({ ...comercial, ...merged, nombre: merged.nombre || comercial.nombre }, t);
  }
  if (parecePedidoLlamada(t, nlu, comercial) && !ficha.textoRespuestaModulo(t)) {
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
  const modulo = ficha.textoRespuestaModulo(t);
  if (modulo) {
    return {
      respuesta: modulo,
      comercial: {
        ...merged,
        intencionCompra: 'media',
        esperandoDatosLlamada: false,
        quiereLlamada: false
      },
      accion: 'listo',
      slugFlayer: null,
      quiereLlamada: false
    };
  }
  const pubFb = turnoDatoPublico(t, nlu, merged, comercial.publicDatos);
  if (pubFb) return pubFb;
  const flujoFb = resolverFlujoTurno(t, nlu, comercial, comercial.rutaActual);
  if (flujoFb) {
    const acomp = ficha.turnoAcompanamiento({
      texto: t,
      flujo: flujoFb,
      ruta: comercial.rutaActual,
      comercial: merged,
      iniciar: true
    });
    if (acomp) return acomp;
  }
  if (
    (nlu?.intencion === 'planes_saas' || /^(planes)$/i.test(t.trim()))
    && pubDatos.parecePreguntaPlanes(t, nlu)
  ) {
    return {
      respuesta: comercial.publicDatos
        ? pubDatos.textoPlanesReales(comercial.publicDatos)
        : ficha.textoPlanes(),
      comercial: { ...merged, intencionCompra: 'alta' },
      accion: 'enviar_planes',
      slugFlayer: null,
      quiereLlamada: false
    };
  }
  const rubroNuevoEsteTurno = !ficha.tieneRubro(comercial) && ficha.tieneRubro(merged);
  if (rubroNuevoEsteTurno && !ficha.parecePreguntaModulo(t)) {
    return {
      respuesta: ficha.textoPitchRubroYDemo(merged),
      comercial: {
        ...merged,
        esperandoRubro: false,
        ofrecioDemo: true,
        intencionCompra: merged.intencionCompra === 'baja' ? 'media' : merged.intencionCompra
      },
      accion: merged.encaja === 'no' ? 'sugerir_llamada' : 'ofrecer_demo',
      slugFlayer: null,
      quiereLlamada: false
    };
  }
  if (ficha.tieneRubro(merged)) {
    return {
      respuesta: 'Dime la duda concreta (WhatsApp, facturas, bot, planes o demo) y te respondo con eso. No hace falta repetir el rubro.',
      comercial: { ...merged, esperandoRubro: false },
      accion: 'listo',
      slugFlayer: null,
      quiereLlamada: false
    };
  }
  return {
    respuesta: 'Para orientarte: ¿a qué se dedica tu negocio? (qué vendes o tu rubro).',
    comercial: { ...merged, esperandoRubro: true },
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
  const fichaLimpia = fichaParaPrompt(comercial);

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
  if (!parsed || !(parsed.respuesta || parsed.plantilla)) {
    throw new Error('Respuesta comercial IA no válida');
  }
  trace('4b.INTERPRETACION_GEMINI', {
    accion: parsed.accion,
    plantilla: parsed.plantilla,
    pedirDato: parsed.pedirDato,
    encaja: parsed.ficha?.encaja,
    intencionCompra: parsed.ficha?.intencionCompra,
    quiereLlamada: parsed.quiereLlamada,
    respuesta: parsed.respuesta
  });
  return parsed;
}

function aplicarCierreComercial(out) {
  if (!out || !out.comercial) return out;
  const com = out.comercial;
  if (!ficha.tieneRubro(com)) {
    if (out.pedirDato === 'rubro' || (out.accion === 'preguntar' && ficha.parecePreguntaRubro(out.respuesta))) {
      com.esperandoRubro = true;
    }
    return out;
  }
  com.esperandoRubro = false;
  if (/suscribirse\/demo/i.test(String(out.respuesta || '')) || out.plantilla === 'pitch_rubro' || out.plantilla === 'demo') {
    com.ofrecioDemo = true;
    if (com.intencionCompra === 'baja') com.intencionCompra = 'media';
  }
  return out;
}

/**
 * @returns {Promise<{respuesta:string, comercial:object, accion:string, slugFlayer:string|null, quiereLlamada:boolean}>}
 */
async function procesarTurnoIa({ textoEntrada, slots, nlu, claveRateLimit, canal, rutaActual, pasoRegistro, errorPantalla, publicDatos }) {
  const comercial = { ...(slots?.comercial || {}) };
  comercial.requiereCelular = canal === 'web' || Boolean(comercial.requiereCelular);
  comercial.publicDatos = publicDatos || null;
  if (rutaActual) comercial.rutaActual = sanitizar(rutaActual, 200);
  if (pasoRegistro) comercial.pasoRegistro = sanitizar(pasoRegistro, 40);
  if (errorPantalla) comercial.errorPantalla = sanitizar(errorPantalla, 200);
  else if (ficha.enPasoRuc(comercial.pasoRegistro, comercial.rutaActual)) {
    comercial.errorPantalla = comercial.errorPantalla || '';
  }
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
          comercial: limpiarDatosEfimeros(comercial),
          accion: 'preguntar',
          slugFlayer: null,
          quiereLlamada: false
        };
      }
      throw err;
    }
  }

  const mergedEarly = mergeFicha(comercial, {}, texto);
  mergedEarly.rutaActual = comercial.rutaActual;
  mergedEarly.flujo = comercial.flujo;
  mergedEarly.pasoRegistro = comercial.pasoRegistro;
  mergedEarly.errorPantalla = comercial.errorPantalla;
  mergedEarly.acompanamientoEnviado = comercial.acompanamientoEnviado;
  mergedEarly.planCode = comercial.planCode;
  mergedEarly.billingCycle = comercial.billingCycle;

  if (parecePausaCita(texto) && (comercial.esperandoDatosLlamada || mergedEarly.esperandoDatosLlamada)) {
    comercial.esperandoDatosLlamada = false;
    comercial.quiereLlamada = false;
    mergedEarly.esperandoDatosLlamada = false;
    mergedEarly.quiereLlamada = false;
  }

  if (mergedEarly.esperandoDatosLlamada && pareceDatoCita(texto)) {
    const outCita = pedirDatosOConfirmar(mergedEarly, texto, requiereCelular);
    trace('4.BACKEND_SIN_GEMINI', { motivo: 'cita_relleno', accion: outCita.accion, faltantes: ficha.faltantesCita(outCita.comercial, { requiereCelular }) });
    trace('4c.RESPUESTA_BACKEND', { texto: outCita.respuesta });
    return conHistorial(outCita, historial, texto, requiereCelular);
  }

  const flujo = resolverFlujoTurno(texto, nlu, mergedEarly, comercial.rutaActual);
  if (flujo) mergedEarly.flujo = flujo;

  let out;
  try {
    const parsed = await llamarGemini(texto, comercial, historial, nlu);
    const merged = mergeFicha(comercial, parsed.ficha, texto);
    if (flujo) merged.flujo = flujo;
    parsed.plantilla = inferirPlantillaDatoReal(normalizarPlantilla(parsed.plantilla), texto, nlu, parsed);
    const compuesto = componerGestor(parsed, merged, comercial.publicDatos);
    let { respuesta, plantilla, pedirDato } = compuesto;
    let accion = accionDesdePlantilla(plantilla, parsed.accion);

    const rubroNuevoEsteTurno = !ficha.tieneRubro(comercial) && ficha.tieneRubro(merged);
    if (rubroNuevoEsteTurno && plantilla === 'ninguna' && !ficha.parecePreguntaModulo(texto) && !pubDatos.parecePreguntaPlanes(texto, nlu)) {
      const pitch = ficha.textoPitchRubroYDemo(merged);
      if (!empiezaIgual(respuesta, pitch)) {
        respuesta = `${respuesta}\n\n${pitch}`.trim();
      }
      plantilla = 'pitch_rubro';
      accion = merged.encaja === 'no' ? 'sugerir_llamada' : 'ofrecer_demo';
    }

    const pidioLlamada = parecePedidoLlamadaEsteTurno(texto, nlu);
    const quiereLlamada = pidioLlamada || (plantilla === 'cita' && Boolean(parsed.quiereLlamada)) || (accion === 'ofrecer_llamada' && Boolean(parsed.quiereLlamada) && pidioLlamada);
    if (quiereLlamada || plantilla === 'cita') {
      merged.quiereLlamada = Boolean(quiereLlamada || parsed.quiereLlamada || pidioLlamada);
    }
    if (plantilla === 'cita' || (merged.quiereLlamada && ['nombre', 'celular', 'horario'].includes(pedirDato))) {
      if (pidioLlamada || merged.esperandoDatosLlamada || parsed.quiereLlamada) {
        merged.esperandoDatosLlamada = true;
        merged.quiereLlamada = true;
        accion = 'ofrecer_llamada';
        const miss = ficha.faltantesCita(merged, { requiereCelular });
        if (!miss.length) {
          out = confirmarOAjustarLlamada(merged, texto);
          out.plantilla = 'cita';
          out.pedirDato = '';
          out = aplicarCierreComercial(out);
          trace('4c.RESPUESTA_BACKEND', { accion: out.accion, plantilla: 'cita', texto: out.respuesta });
          return conHistorial(out, historial, texto, requiereCelular);
        }
        if (!respuesta || respuesta.length < 20) {
          respuesta = ficha.textoPedirDatosCita(miss, merged);
        }
      }
    }
    if (accion === 'sugerir_llamada') {
      merged.quiereLlamada = false;
      if (!/\bLLAMADA\b/i.test(respuesta)) {
        respuesta = `${respuesta}\n\n${ficha.textoSugerirLlamadaSoporte()}`;
      }
    }
    if (accion === 'aviso_pago_manual' || plantilla === 'pago_confirmado') {
      merged.pagoReportado = true;
      merged.intencionCompra = 'alta';
      accion = 'aviso_pago_manual';
    }
    if (['planes', 'yape', 'plin', 'cuenta', 'medios_pago'].includes(plantilla)) {
      merged.intencionCompra = 'alta';
    }
    if (pedirDato === 'rubro') {
      merged.esperandoRubro = true;
      if (accion === 'listo') accion = 'preguntar';
    }
    let slugFlayer = parsed.slugFlayer || null;
    if (accion === 'enviar_guia' && !slugFlayer) {
      slugFlayer = ficha.resolverFlayer(texto)?.slug || null;
    }
    out = {
      respuesta,
      comercial: merged,
      accion,
      slugFlayer,
      quiereLlamada: Boolean(merged.quiereLlamada && (plantilla === 'cita' || accion === 'ofrecer_llamada')),
      plantilla,
      pedirDato
    };
  } catch (err) {
    if (err.code !== 'GEMINI_NO_CONFIG') {
      console.error('whatsappBotComercialIa:', err.message);
    }
    out = fallbackReglas(texto, { ...comercial, requiereCelular }, nlu);
    out.plantilla = out.plantilla || 'ninguna';
    out.pedirDato = out.pedirDato || '';
    trace('4.BACKEND_SIN_GEMINI', { motivo: err.code || err.message, accion: out.accion });
  }

  out = aplicarCierreComercial(out);

  if (out.accion === 'sugerir_llamada') {
    out.quiereLlamada = false;
    if (out.comercial) out.comercial.quiereLlamada = false;
  }

  trace('4c.RESPUESTA_BACKEND', {
    accion: out.accion,
    plantilla: out.plantilla,
    pedirDato: out.pedirDato,
    quiereLlamada: out.quiereLlamada,
    texto: out.respuesta
  });
  return conHistorial(out, historial, texto, requiereCelular);
}

module.exports = {
  procesarTurnoIa,
  fallbackReglas,
  mergeFicha,
  parseJsonModelo
};
