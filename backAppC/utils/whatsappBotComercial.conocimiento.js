const { getAppTimezone } = require('./fechaDisplay.util');
const flayersCatalogo = require('./whatsappBotFlayers.catalogo');

/**
 * Preventa EFAFERP solo para el WhatsApp de la empresa principal.
 * No copia el home: rubros, 14 días, problemas, planes y SUNAT ya están en
 * https://businesssoft.net — aquí va lo que el interesado no ve en la web.
 */
const SITE = () => String(process.env.PUBLIC_SITE_URL || 'https://businesssoft.net').replace(/\/$/, '');

function listarFlayers() {
  return flayersCatalogo.listar();
}

function urlPublica(ruta) {
  return `${SITE()}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
}

function textoFichaConviene() {
  return [
    'Si te encaja el rubro (ferretería, repuestos, pinturas, ropa o librería) y quieres controlar ventas, stock y créditos con SUNAT, *sí te conviene* probar.',
    '',
    'Lo que no está en la web y sí importa al contratar:',
    '• *Asistente de la plataforma:* al entrar a EFAFERP (sesión iniciada) te guía en el uso del sistema (SUNAT, productos, etc.). No guarda el historial. No le pegues claves ni el certificado.',
    '• *WhatsApp de tu tienda:* cuando ya eres cliente, tus compradores consultan stock y piden por *tu* número. Este chat es el de Business Soft.',
    '• *Precios de planes:* no los invento aquí. Están actualizados en:',
    urlPublica('/planes'),
    '• *Probar 14 días* (sin tarjeta):',
    urlPublica('/suscribirse/demo'),
    '',
    'Si quieres una guía (inventario, robos, utilidad, cobranzas), escribe *GUÍAS*.',
    'Si buscas un *producto* de nuestro catálogo, escribe el nombre.',
    'Si prefieres hablar con una persona, escribe *AGENTE*.'
  ].join('\n');
}

function textoPlanes() {
  return [
    'Los planes y precios vigentes están en la web (no los cito de memoria para no equivocarme):',
    urlPublica('/planes'),
    '',
    `Prueba 14 días sin tarjeta: ${urlPublica('/suscribirse/demo')}`,
    '',
    'Al contratar, un asesor te acompaña con SUNAT (usuario SOL, certificado, series). Horario en la web: lun–vie 9:00 a 18:00 (Perú).',
    'Dentro del sistema, el *asistente de la plataforma* es para guiarte en el uso del sistema.'
  ].join('\n');
}

function textoSoporteAsistente() {
  return [
    'Cuando ya tienes cuenta, el *asistente de la plataforma* es para guiarte en el uso del sistema. No guarda la conversación.',
    '',
    'La puesta en marcha de SUNAT la hace un asesor por WhatsApp, como dice la web.',
    'Si aún no eres cliente y quieres el sistema, escribe *SISTEMA* o entra a',
    urlPublica('/suscribirse/demo')
  ].join('\n');
}

function textoListaFlayers() {
  const items = listarFlayers();
  const maxLista = 10;
  const visibles = items.slice(0, maxLista);
  const lineas = visibles.map((f, i) => {
    const extra = f.tieneImagen ? ' (imagen)' : '';
    return `${i + 1}. *${f.titulo}*${extra}`;
  });
  if (items.length > maxLista) {
    lineas.push(`… y ${items.length - maxLista} más. Escribe el tema (ej. inventario, testimonio).`);
  }
  const hasta = Math.min(items.length, maxLista);
  return [
    'Guías que tenemos:',
    '',
    ...lineas,
    '',
    `Responde *1* a *${hasta}* o el tema.`,
    `Todas en la web: ${urlPublica('/flayers/index.html')}`
  ].join('\n');
}

function resolverFlayer(texto) {
  return flayersCatalogo.resolver(texto);
}

function textoUnFlayer(flayer, conImagen) {
  const lineas = [`*${flayer.titulo}*`];
  if (conImagen && flayer.url) {
    lineas.push('Si no ves la imagen, ábrela aquí:', urlPublica(flayer.url));
  } else if (flayer.url) {
    lineas.push('Ábrelo en la web:', urlPublica(flayer.url));
  } else if (conImagen) {
    lineas.push('Te mando la imagen de la guía.');
  } else {
    lineas.push('Esa guía aún no está publicada en la web. Un asesor te la puede enviar.');
  }
  lineas.push('', 'Si quieres otra, escribe *GUÍAS*.', `Planes: ${urlPublica('/planes')}`);
  return lineas.join('\n');
}

function textoQueVendesPrincipal() {
  return [
    'Aquí atendemos *dos cosas*:',
    '1. *EFAFERP*, el sistema (escribe *SISTEMA* o *PLANES*).',
    '2. *Productos de nuestro catálogo* (escribe el nombre o *3*).'
  ].join('\n');
}

function textoHolaExtraPrincipal() {
  return 'Si te interesa *EFAFERP*, cuéntame a qué se dedica tu negocio o escribe *SISTEMA*, *PLANES* o *GUÍAS*. Si buscas un producto nuestro, escribe el nombre.';
}

const RUBROS_ENCAJAN = [
  { id: 'ferreteria', re: /\b(ferreter|torniller|agroferreter|materiales de construccion)/i, etiqueta: 'ferretería' },
  { id: 'repuestos', re: /\b(repuestos?|automotriz)/i, etiqueta: 'repuestos' },
  { id: 'pinturas', re: /\b(pinturer|pinturas?)/i, etiqueta: 'pinturas' },
  { id: 'ropa', re: /\b(ropa|zapatill|zapatos|calzado|confeccion|boutique|deportiv)/i, etiqueta: 'ropa' },
  { id: 'libreria', re: /\b(librer|utiles escolares|papeler)/i, etiqueta: 'librería' }
];

const RUBROS_NO_TIPICOS = [
  { id: 'restaurante', re: /\b(restaurant|cevicher|poller|fuente de soda|comida rapida)/i },
  { id: 'consultorio', re: /\b(consultorio|clinica|dental|medico)/i },
  { id: 'colegio', re: /\b(colegio|academia|instituto educativo)/i }
];

function detectarRubro(texto) {
  const t = String(texto || '');
  const si = RUBROS_ENCAJAN.find((r) => r.re.test(t));
  if (si) return { id: si.id, etiqueta: si.etiqueta, encaja: 'si' };
  const no = RUBROS_NO_TIPICOS.find((r) => r.re.test(t));
  if (no) return { id: no.id, etiqueta: no.id, encaja: 'no' };
  if (/\b(hotel|hospedaje|hostal)\b/i.test(t)) return { id: 'hotel', etiqueta: 'hotel', encaja: 'parcial' };
  if (/\b(minimarket|bodega|grifo|taller)\b/i.test(t)) {
    return { id: 'comercio', etiqueta: 'comercio', encaja: 'parcial' };
  }
  return null;
}

function pareceConsultaComercial(texto, nlu, estado) {
  if (estado === 'comercial_ia') return true;
  const int = nlu?.intencion;
  if (['info_sistema', 'consulta_comercial', 'agendar_llamada'].includes(int)) return true;
  const t = String(texto || '');
  if (t.length >= 50 && /\b(negocio|rubro|sistema|software|factur|sunat)\b/i.test(t)) return true;
  return false;
}

function whatsappSoporteDisplay() {
  const raw = String(process.env.PAGO_MANUAL_WHATSAPP || '993289440').replace(/\D/g, '');
  if (raw.length === 9) return `${raw.slice(0, 3)} ${raw.slice(3, 6)} ${raw.slice(6)}`;
  return raw || '993 289 440';
}

const NOMBRES_FALSOS = new Set([
  'cliente', 'el cliente', 'la cliente', 'usuario', 'interesado', 'visitante',
  'anonimo', 'anónimo', 'dueño', 'dueno', 'señor', 'senor', 'señora', 'amiga',
  'amigo', 'hola', 'ok', 'okay', 'si', 'sí', 'no', 'listo', 'perfecto', 'gracias',
  'ferreteria', 'ferretería', 'ferretero', 'repuestos', 'negocio', 'empresa',
  'administrador', 'asesor', 'soporte'
]);

function esNombrePersona(nombre) {
  const n = String(nombre || '').replace(/\s+/g, ' ').trim();
  if (n.length < 2 || n.length > 40) return false;
  if (NOMBRES_FALSOS.has(n.toLowerCase())) return false;
  if (!/^[a-záéíóúñü]+(\s+[a-záéíóúñü]+)?$/i.test(n)) return false;
  if (/\b(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|mañana|manana|hoy|llamada|sistema|inventario|interesa)\b/i.test(n)) {
    return false;
  }
  return true;
}

function extraerHorario(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const hora = t.match(/\b(\d{1,2}([:.,]\d{2})?\s*(h|hrs?|am|pm|a\.?m\.?|p\.?m\.?)?)\b/i);
  const dia = t.match(/\b(mañana|manana|hoy|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/i);
  const horario = [dia && dia[0], hora && hora[0]].filter(Boolean).join(' ');
  return horario || null;
}

function extraerCelularPeru(texto) {
  const compact = String(texto || '').replace(/[\s\-().]/g, '');
  const m = compact.match(/(?:\+?51)?9\d{8}/);
  if (!m) return null;
  const d = m[0].replace(/\D/g, '');
  return d.length === 9 ? `51${d}` : d;
}

function celularValido(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  return (d.length === 11 && d.startsWith('519')) || (d.length === 9 && d.startsWith('9'));
}

function extraerNombrePersona(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const mNom = t.match(/(?:mi nombre es|me llamo)\s+([a-záéíóúñü]+(?:\s+[a-záéíóúñü]+)?)/i);
  if (mNom && esNombrePersona(mNom[1].trim())) return mNom[1].trim();
  const mSoy = t.match(/^soy\s+([a-záéíóúñü]+(?:\s+[a-záéíóúñü]+)?)$/i);
  if (mSoy && esNombrePersona(mSoy[1].trim())) return mSoy[1].trim();
  if (esNombrePersona(t)) return t;
  const cabeza = t.split(/[,\n]/)[0].trim();
  if (esNombrePersona(cabeza)) return cabeza;
  return null;
}

function extraerNombreHorario(texto) {
  const nombre = extraerNombrePersona(texto);
  const horario = extraerHorario(texto);
  if (nombre && horario) return { nombre, mejorHorario: horario };
  return null;
}

function faltantesCita(com, opts = {}) {
  const c = com || {};
  const miss = [];
  if (!c.rubro && !c.rubroLibre) miss.push('rubro');
  if (!esNombrePersona(c.nombre)) miss.push('nombre');
  if (opts.requiereCelular && !celularValido(c.celular || c.celularWeb)) miss.push('celular');
  if (!String(c.mejorHorario || '').trim()) miss.push('horario');
  return miss;
}

function textoPedirDatosCita(faltantes, com) {
  const c = com || {};
  const pedidos = [];
  if (faltantes.includes('nombre')) pedidos.push('tu *nombre*');
  if (faltantes.includes('celular')) pedidos.push('tu *celular* (9 dígitos)');
  if (faltantes.includes('rubro')) pedidos.push('el *rubro* de tu negocio');
  if (faltantes.includes('horario')) pedidos.push('un *horario* (lun–vie 9:00 a 18:00)');
  const ya = [];
  if (esNombrePersona(c.nombre)) ya.push(`nombre *${c.nombre}*`);
  if (c.rubro || c.rubroLibre) ya.push(`rubro *${c.rubro || c.rubroLibre}*`);
  if (c.mejorHorario) ya.push(`horario *${c.mejorHorario}*`);
  if (celularValido(c.celular || c.celularWeb)) ya.push('celular');
  const lineas = [
    `Para coordinar la llamada me faltan ${pedidos.join(', ')}.`,
    ya.length ? `Ya tengo: ${ya.join(', ')}.` : null,
    faltantes.includes('celular')
      ? 'Ejemplo: Ana, 993289440.'
      : 'Ejemplo: Ana, ferretería, lunes 10 am.'
  ];
  return lineas.filter(Boolean).join('\n');
}

const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function diaSemanaLima(ahora) {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: getAppTimezone(),
    weekday: 'short'
  }).format(ahora instanceof Date ? ahora : new Date());
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

function extraerSoloHora(horario) {
  const m = String(horario || '').match(/\b(\d{1,2}([:.,]\d{2})?\s*(h|hrs?|am|pm|a\.?m\.?|p\.?m\.?)?)\b/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function resolverDiaPedido(horario, ahora) {
  const t = String(horario || '').toLowerCase();
  const hoy = diaSemanaLima(ahora);
  if (/\bhoy\b/.test(t)) return { dow: hoy, etiqueta: 'hoy' };
  if (/\bmañana|\bmanana\b/.test(t)) return { dow: (hoy + 1) % 7, etiqueta: 'mañana' };
  const nombres = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    miércoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
    sábado: 6
  };
  for (const [nom, dow] of Object.entries(nombres)) {
    if (t.includes(nom)) {
      let delta = (dow - hoy + 7) % 7;
      if (delta === 0 && dow !== hoy) delta = 7;
      return { dow, etiqueta: NOMBRES_DIA[dow], delta };
    }
  }
  return null;
}

function siguienteHabil(dow) {
  let d = dow;
  while (d === 0 || d === 6) d = (d + 1) % 7;
  return { dow: d, etiqueta: NOMBRES_DIA[d] };
}

function evaluarCitaLaborable(mejorHorario, ahora) {
  const ref = ahora instanceof Date ? ahora : new Date();
  const dia = resolverDiaPedido(mejorHorario, ref);
  if (!dia) return { ok: true, horario: mejorHorario };
  if (dia.dow !== 0 && dia.dow !== 6) return { ok: true, horario: mejorHorario, dia };
  const hab = siguienteHabil(dia.dow);
  const hora = extraerSoloHora(mejorHorario) || '10 am';
  const pedidoEtiqueta = dia.etiqueta === 'mañana' ? `mañana (${NOMBRES_DIA[dia.dow]})` : dia.etiqueta;
  return {
    ok: false,
    horarioPedido: mejorHorario,
    horarioSugerido: `${hab.etiqueta} ${hora}`,
    diaPedidoEtiqueta: pedidoEtiqueta,
    hora
  };
}

function pareceAceptaSugerido(texto) {
  const t = String(texto || '').trim();
  return /^(si|sí|ok|okay|dale|va|perfecto|de acuerdo|lunes|martes|miércoles|miercoles|jueves|viernes)\b/i.test(t)
    || /\b(mejor el lunes|el lunes|lunes (a las|a la))\b/i.test(t);
}

function pareceInsisteFueraHorario(texto) {
  return /\b(igual|insisto|domingo|sábado|sabado|así|asi lo quiero|igual mañana|mañana igual|aunque sea)\b/i.test(
    String(texto || '')
  );
}

function textoSugerirDiaHabil(nombre, evalCita) {
  const quien = nombre ? `*${nombre}*, ` : '';
  return [
    `${quien}${evalCita.diaPedidoEtiqueta} no hay atención: BUSINESS SOFT atiende *lunes a viernes*, 9:00 a 18:00 (Perú).`,
    `¿Te parece el *${evalCita.horarioSugerido}*?`,
    'Si igual quieres ese día (domingo/sábado o mañana), escríbelo de nuevo y lo dejamos como pediste.'
  ].join('\n');
}

function sanitizarAlucinacionesComercial(texto) {
  const raw = String(texto || '');
  if (!/\b(tienda virtual|tienda online|tienda en l[ií]nea|e-?commerce|ecommerce|marketplace)\b/i.test(raw)) {
    return raw;
  }
  return raw
    .replace(/[^.]*\b(tienda virtual|tienda online|tienda en l[ií]nea|e-?commerce|ecommerce|marketplace)[^.]*\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function textoConfirmarLlamada(nombre, horario, opts = {}) {
  const celRaw = String(opts.celular || '').replace(/\D/g, '');
  const celTxt = celRaw.length >= 9 ? ` al *${celRaw.slice(-9)}*` : '';
  if (opts.fueraHorario) {
    return [
      `Listo, *${nombre}*. Quedó anotado para *${horario}*, como pediste.`,
      `El horario de oficina es lun–vie 9:00 a 18:00; un asesor te contactará${celTxt} lo antes posible.`,
      'Si quieres cambiarlo, escríbelo de nuevo.'
    ].join('\n');
  }
  return [
    `Listo, *${nombre}*. Coordinamos la llamada para *${horario}*.`,
    `Un asesor de *BUSINESS SOFT COMPANY S.A.C.* te contactará${celTxt} en ese horario (lun–vie 9:00 a 18:00).`,
    'Si quieres cambiarlo, escríbelo de nuevo.'
  ].join('\n');
}

function textoLlamadaSoporte(_conNombre, com = {}, opts = {}) {
  const miss = faltantesCita(com, { requiereCelular: Boolean(opts.requiereCelular) });
  if (!miss.length) {
    return textoConfirmarLlamada(com.nombre, com.mejorHorario, { celular: com.celular || com.celularWeb });
  }
  return textoPedirDatosCita(miss, com);
}

function promptPreventaIa(fichaActual, nluIntencion) {
  const site = SITE();
  const fichaTxt = JSON.stringify(fichaActual || {});
  return `
Eres un asesor comercial de WhatsApp de BUSINESS SOFT COMPANY S.A.C. (Perú). Hablas como persona: natural, breve y al grano. Vendes EFAFERP.
No eres el asistente de la plataforma (ese es solo con sesión iniciada). No menciones IA, Gemini ni proveedores.

REGLA DE ORO: responde *esta* pregunta. No pegues el mismo bloque de planes/precios/demo si no te lo pidieron. No repitas el mensaje anterior.

EFAFERP encaja bien en: ferreterías, agroferretería, repuestos, pinturas, ropa (incl. zapatillas/deportiva) y librerías.
Sirve para: ventas, stock, créditos/cobranzas, utilidad y facturación SUNAT.
Cuando ya son clientes, *sus compradores* pueden pedir por el WhatsApp *de su tienda* (el bot de pedidos de EFAFERP). Eso no es una tienda virtual ni un e-commerce.
PROHIBIDO inventar productos: no digas tienda virtual, tienda online, e-commerce, marketplace, implementación web conectada al inventario, ni “próximamente” de eso. Hoy no se vende. Si preguntan, di que hoy no lo ofrecemos.
Hotel: encaje parcial; ofrécelo a evaluar en una llamada.
Restaurante/cocina/POS de mesas: no es el caso típico; sé honesto y ofrece llamada de soporte.

Datos para responder (usa solo lo que pregunten):
- Demo: 14 días, sistema real, sin tarjeta. Pueden cargar productos, vender, ver stock y créditos. Enlace: ${site}/suscribirse/demo
- Quién configura: un asesor de BUSINESS SOFT te acompaña (sobre todo SUNAT: usuario SOL, certificado, series). Lun–vie 9:00 a 18:00 (Perú).
- Dentro del sistema, el *asistente de la plataforma* es para guiarte en el uso del sistema. No digas “estrellas” ni “aprender las pantallas”.
- Precios: no los inventes. Solo si preguntan planes/precio, enlaza ${site}/planes
Guías (usa slugFlayer solo si encaja el tema; no inventes slugs): ${flayersCatalogo.slugsDisponibles().join(', ') || 'inventario, robos-internos, utilidad-producto, cobranzas'}

Estilo: 2 a 4 líneas, como WhatsApp. *Negritas* ok. Sin títulos markdown.
NUNCA inventes el nombre. Prohibido poner "Cliente", "Usuario" o cualquier nombre que el visitante no haya escrito. Si no lo dijo, deja nombre vacío.
NUNCA confirmes una llamada si faltan nombre real, rubro o (en chat web) celular. Pide solo lo que falte.
Si pide que lo llamen, quiereLlamada=true aunque aún falten datos. No digas “coordinamos” ni “un asesor te llamará” hasta tener esos datos.
Atención de BUSINESS SOFT: solo lunes a viernes, 9:00 a 18:00 (Perú). Si piden mañana y cae sábado/domingo, sugiere el siguiente día hábil con la misma hora. Si insisten en domingo/mañana, acepta el horario que pidieron.
No busques productos ni pidas de nuevo el rubro.
Si ya sabes el rubro, no lo vuelvas a preguntar. Una sola pregunta extra, solo si hace falta.

Intención de compra:
- baja: solo curiosidad
- media: pregunta cómo le ayuda, pide demo o guía
- alta: quiere precios, contratar, que lo llamen, probar ya

Acciones:
- preguntar: falta un dato clave
- ofrecer_demo: encaja y ya puedes orientar
- ofrecer_llamada: no encaja, es dudoso, o el cliente quiere hablar con soporte
- enviar_planes: pidió precios/planes
- enviar_guia: pidió un tema de guía (slugFlayer = uno de los slugs de arriba)
- listo: ya respondiste y no hace falta más

Ficha ya reunida (no vuelvas a preguntar lo que ya está): ${fichaTxt}
Intención NLU de este turno: ${nluIntencion || 'desconocida'}

Responde SOLO un JSON válido, sin markdown ni texto extra:
{"respuesta":"texto al cliente","ficha":{"rubro":"","rubroLibre":"","necesidad":"","intencionCompra":"baja","encaja":"indefinido","nombre":"","mejorHorario":""},"accion":"preguntar","slugFlayer":null,"quiereLlamada":false}

encaja: si|no|parcial|indefinido
intencionCompra: baja|media|alta
quiereLlamada: true si pide o acepta que lo llamen.
`.trim();
}

const TEXTO_MENU_EXTRA_PRINCIPAL = [
  '5. Sobre EFAFERP (el sistema)',
  '',
  'También: *SISTEMA* | *PLANES* | *GUÍAS* | *LLAMADA*'
].join('\n');

module.exports = {
  listarFlayers,
  get FLAYERS() {
    return listarFlayers();
  },
  urlPublica,
  textoFichaConviene,
  textoPlanes,
  textoSoporteAsistente,
  textoListaFlayers,
  resolverFlayer,
  textoUnFlayer,
  textoQueVendesPrincipal,
  textoHolaExtraPrincipal,
  TEXTO_MENU_EXTRA_PRINCIPAL,
  detectarRubro,
  pareceConsultaComercial,
  extraerNombreHorario,
  extraerNombrePersona,
  extraerHorario,
  extraerCelularPeru,
  esNombrePersona,
  celularValido,
  faltantesCita,
  textoPedirDatosCita,
  evaluarCitaLaborable,
  pareceAceptaSugerido,
  pareceInsisteFueraHorario,
  textoSugerirDiaHabil,
  sanitizarAlucinacionesComercial,
  textoConfirmarLlamada,
  textoLlamadaSoporte,
  whatsappSoporteDisplay,
  promptPreventaIa
};
