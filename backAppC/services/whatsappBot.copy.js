/**
 * Catalogo central de variantes de texto del chatbot WhatsApp.
 *
 * Objetivo: que el bot suene mas humano sin usar IA.
 *  - Variantes aleatorias para frases repetitivas (no, fallback, ok, cierres, etc.).
 *  - Saludo dependiente del nombre del cliente y la hora del dia.
 *  - Helpers para typing/delay (sin texto, lo consume el orquestador).
 *
 * Reglas:
 *  - Toda la salida usa tildes/eñes correctas (la NLU normaliza la entrada,
 *    no afecta cambiar la ortografia de la salida).
 *  - Tuteo por defecto. Si en el futuro se hace configurable (config.usarTuteo),
 *    se intercambia la tabla de "voces".
 *  - Las funciones devuelven strings; no envian nada al gateway.
 */

function pick(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, Math.max(0, Number(ms) || 0)));
}

/**
 * Devuelve un saludo segun la hora local del servidor.
 *  - 5:00 a 11:59  -> Buenos dias
 *  - 12:00 a 18:59 -> Buenas tardes
 *  - resto         -> Buenas noches
 */
function saludoPorHora(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const SUFIJOS_RAZON_SOCIAL = new Set([
  'SAC', 'S.A.C.', 'SA', 'S.A.', 'SRL', 'S.R.L.', 'EIRL', 'E.I.R.L.', 'SAA', 'S.A.A.',
  'EMPRESA', 'CIA', 'CIA.', 'COMPANIA', 'COMPAÑIA', 'SOCIEDAD', 'COMERCIAL', 'INDUSTRIAL',
  'SERVICIOS', 'CONSULTORIA', 'CORPORACION', 'GRUPO'
]);

/**
 * Extrae un nombre amigable a partir de una razon social.
 * Para personas (DNI) tomara el nombre de pila. Para RUC, intenta omitir prefijos
 * tipicos ("EMPRESA"), pero si la razon social es totalmente generica devuelve ''.
 *  - "JUAN PEREZ MARTINEZ"     -> "Juan"
 *  - "MARIA ROSA DEL CARMEN"   -> "Maria"
 *  - "EMPRESA AGRICOLA SAC"    -> "Agricola"
 *  - "FERRETERIA EL CONSTRUCTOR S.A.C." -> "Ferretería"
 *  - undefined / ''            -> ''
 */
function nombreCorto(rSocial) {
  if (!rSocial) return '';
  const tokens = String(rSocial).trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return '';
  for (const t of tokens) {
    const upper = t.toUpperCase().replace(/[.,]/g, '');
    if (SUFIJOS_RAZON_SOCIAL.has(upper) || SUFIJOS_RAZON_SOCIAL.has(upper.replace(/\.$/, ''))) {
      continue;
    }
    return capitalizar(t);
  }
  return capitalizar(tokens[0]);
}

function capitalizar(palabra) {
  const p = String(palabra || '').toLowerCase();
  if (!p) return '';
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/**
 * Calcula un delay "humano" para simular tiempo de tipeo segun el largo del texto.
 *  - base 600ms + 18ms por caracter (cap 3000ms) + jitter 0-400ms.
 */
function delaySegunLargo(texto) {
  const len = String(texto || '').length;
  const base = 600;
  const perChar = 18;
  const max = 3000;
  const ms = Math.min(max, base + len * perChar);
  return ms + Math.floor(Math.random() * 400);
}

/** Delay corto entre burbujas consecutivas. */
function delayEntreBurbujas() {
  return 250 + Math.floor(Math.random() * 250);
}

const VARIANTES = {
  // Saludos contextualizados (se concatenan con el saludoPorHora + nombre).
  preguntaSaludo: [
    '¿En qué te ayudo hoy?',
    '¿Qué necesitas?',
    '¿Cómo te puedo ayudar?',
    '¿En qué te puedo apoyar hoy?'
  ],

  // Cuando no entiende ni en menu ni en estado especifico.
  noEntendi: [
    'No te entendí del todo. ¿Puedes reformularlo? Si prefieres, escribe *MENÚ*.',
    'Disculpa, no logré entenderte. Intenta con el nombre del producto o escribe *MENÚ*.',
    '¿Puedes escribirlo de otra forma? Si quieres, escribe *MENÚ* y te muestro las opciones.'
  ],

  // Pedir mas detalle de un producto cuando intencion=precio/stock sin terminos.
  // Usar mensajeAclararProducto(nombreEjemplo) en lugar de v('aclararProducto').
  aclararProductoSinEjemplo: [
    'Indícame qué producto buscas y lo busco en el catálogo.',
    '¿Qué producto necesitas? Escríbeme el nombre.',
    'Dime el nombre del producto que buscas.'
  ],

  // Bus queda sin resultados.
  noEncontrado: [
    'Hmm, no encontré productos con esos términos. ¿Puedes describirlo de otra forma?',
    'No apareció nada con esa búsqueda. Intenta con otro nombre o escribe *MENÚ*.',
    'No tengo coincidencias para esa búsqueda. Prueba con otra palabra clave.'
  ],

  // Mensajes "buscando" antes de mostrar resultados (futuro: se enviarian como burbuja extra).
  buscando: ['Déjame ver…', 'Un momento, busco eso…', 'Buscando en el catálogo…'],

  // Confirmaciones cortas tras una accion.
  okBreve: ['Listo.', 'Perfecto.', '¡Anotado!', 'Hecho.'],

  // Despedidas (variante dependiendo del momento).
  despedida: [
    '¡Gracias por escribirnos!\nHasta pronto. Cuando necesites algo, escribe *MENÚ*.',
    '¡Hasta pronto!\nCualquier duda escríbenos cuando quieras. *MENÚ* para volver.',
    '¡Que tengas un excelente día!\nAquí estaremos para cuando nos necesites.'
  ],

  // Cierres rotativos para reemplazar el "Escriba MENU para volver" repetitivo.
  cierres: [
    'Si necesitas algo más, escribe *MENÚ*.',
    '¿Algo más en lo que te ayude? Escribe *MENÚ* para ver las opciones.',
    'Aquí estoy si necesitas otra cosa. *MENÚ* para volver al inicio.',
    null,    // a veces ningun cierre
    null
  ],

  // Cuando elige una opcion invalida del menu numerico.
  opcionInvalida: [
    'Esa opción no la reconozco. Responde un número de la lista o escribe *MENÚ*.',
    'No identifiqué esa opción. Indica el número de la lista o escribe *MENÚ*.',
    '¿Puedes elegir un número de la lista? También puedes escribir *MENÚ*.'
  ],

  // Sesion expirada (estados pedido_*).
  sesionExpirada: [
    'Tu sesión expiró. Escribe *1* o *mis pedidos* para consultar de nuevo.',
    'Pasó un rato y la sesión se cerró. Escribe *mis pedidos* para volver a consultar.',
    'La sesión ya no está activa. Escribe *1* para listar tus pedidos otra vez.'
  ],

  // Avisos de carrito vacio en cotizacion.
  carritoVacioAviso: [
    'Tu carrito está vacío.\n\nEscribe el nombre de un producto para agregarlo, o *MENÚ* para volver.',
    'Aún no tienes productos en el carrito. Escribe el nombre de uno para empezar.',
    'No hay nada en tu carrito todavía. Escribe el producto que quieras cotizar.'
  ],

  // Confirmacion final cotizacion (sin numero, lo agrega el caller).
  cotizConfirmacion: [
    'Listo, registramos tu cotización.',
    '¡Cotización guardada!',
    'Perfecto, tu cotización quedó registrada.'
  ],

  // Cancelacion suave.
  cancelado: [
    'Operación cancelada.',
    'Cancelado.',
    'Listo, cancelé esa operación.'
  ]
};

/**
 * Toma una variante aleatoria de una clave conocida. Si no existe, retorna ''.
 */
function v(key) {
  const arr = VARIANTES[key];
  if (!arr) return '';
  return pick(arr) || '';
}

/**
 * Mensaje para pedir el nombre del producto a buscar.
 * Si se pasa nombreEjemplo (p. ej. el mas vendido de la empresa), lo usa en la variante.
 */
function mensajeAclararProducto(nombreEjemplo) {
  const ej = String(nombreEjemplo || '').trim();
  if (!ej) return v('aclararProductoSinEjemplo');
  const variantes = [
    `Indícame qué producto buscas, por ejemplo: *${ej}*.`,
    `¿Qué producto necesitas? Escríbeme el nombre, por ejemplo: *${ej}*.`,
    `Dime el nombre del producto que buscas. Por ejemplo: *${ej}*.`
  ];
  return pick(variantes) || variantes[0];
}

/**
 * Frase corta con ejemplo de busqueda para incrustar en otros mensajes.
 */
function fraseEjemploBusqueda(nombreEjemplo) {
  const ej = String(nombreEjemplo || '').trim();
  if (!ej) return 'Escríbeme el nombre del producto que buscas y lo busco en el catálogo.';
  return `Escríbeme el nombre del producto que buscas (por ejemplo, *${ej}*) y lo busco en el catálogo.`;
}

/** Mensaje al elegir opcion 3 del menu (Buscar producto). */
function mensajeBuscarProductoMenu(nombreEjemplo) {
  const ej = String(nombreEjemplo || '').trim();
  if (!ej) {
    return 'Escribe el nombre del producto que buscas y te muestro precio y stock.';
  }
  return [
    'Escribe el nombre del producto que buscas.',
    `Por ejemplo: *${ej}*`
  ].join('\n');
}

/**
 * Adjunta un cierre rotativo al texto. A veces no agrega nada (variante null).
 * Pasar { forzar:true } si la respuesta DEBE recordarle al usuario como volver.
 */
function adjuntarCierre(texto, opts = {}) {
  const c = pick(VARIANTES.cierres);
  if (!c) {
    if (opts.forzar) return `${texto}\n\n${pick(VARIANTES.cierres.filter(Boolean))}`;
    return texto;
  }
  return `${texto}\n\n${c}`;
}

/**
 * Construye el saludo personalizado:
 *   - "¡Buenas tardes, Juan! ¿En qué te ayudo hoy?"
 *   - "¡Buenas tardes! ¿En qué te ayudo hoy?" (si no hay nombre)
 */
function saludoPersonalizado(rSocial) {
  const saludo = saludoPorHora();
  const nombre = nombreCorto(rSocial);
  const pregunta = v('preguntaSaludo');
  return nombre
    ? `¡${saludo}, ${nombre}! ${pregunta}`
    : `¡${saludo}! ${pregunta}`;
}

/**
 * Convierte un texto en tuteo a forma "usted" reemplazando algunos verbos y
 * pronombres de uso frecuente del bot. NO es traduccion completa: cubre los
 * casos repetidos (escribe, dime, te, tu/tus, gracias, eres, etc.).
 *
 * Si tonoFormal=false (default), retorna el texto sin cambios.
 */
function aplicarTono(texto, tonoFormal) {
  if (!tonoFormal || !texto) return texto || '';
  let s = String(texto);

  // Pares ordenados (regex global, case-sensitive en mayuscula inicial).
  const pares = [
    [/\bEscríbeme\b/g, 'Escríbame'],
    [/\bescríbeme\b/g, 'escríbame'],
    [/\bEscríbele\b/g, 'Escríbale'],
    [/\bescríbele\b/g, 'escríbale'],
    [/\bEscribe\b/g, 'Escriba'],
    [/\bescribe\b/g, 'escriba'],
    [/\bIndícame\b/g, 'Indíqueme'],
    [/\bindícame\b/g, 'indíqueme'],
    [/\bIndica\b/g, 'Indique'],
    [/\bindica\b/g, 'indique'],
    [/\bDime\b/g, 'Dígame'],
    [/\bdime\b/g, 'dígame'],
    [/\bResponde\b/g, 'Responda'],
    [/\bresponde\b/g, 'responda'],
    [/\bElige\b/g, 'Elija'],
    [/\belige\b/g, 'elija'],
    [/\bConfirma\b/g, 'Confirme'],
    [/\bconfirma\b/g, 'confirme'],
    [/\bIntenta\b/g, 'Intente'],
    [/\bintenta\b/g, 'intente'],
    [/\bVerifica\b/g, 'Verifique'],
    [/\bverifica\b/g, 'verifique'],
    [/\bAgrega\b/g, 'Agregue'],
    [/\bagrega\b/g, 'agregue'],
    [/\bPrueba\b/g, 'Pruebe'],
    [/\bprueba\b/g, 'pruebe'],
    [/\bScríbeme\b/g, 'Escríbame'],
    [/\bDescríbelo\b/g, 'Descríbalo'],
    [/\bdescríbelo\b/g, 'descríbalo'],

    // Posesivos / pronombres
    [/\bte ayudo\b/g, 'le ayudo'],
    [/\bTe ayudo\b/g, 'Le ayudo'],
    [/\bte envío\b/g, 'le envío'],
    [/\bTe envío\b/g, 'Le envío'],
    [/\bte derivo\b/g, 'le derivo'],
    [/\bTe derivo\b/g, 'Le derivo'],
    [/\bte identifiqué\b/g, 'le identifiqué'],
    [/\bTe identifiqué\b/g, 'Le identifiqué'],
    [/\bte registré\b/g, 'le registré'],
    [/\bTe registré\b/g, 'Le registré'],
    [/\bte llamará\b/g, 'le llamará'],
    [/\bte contactará\b/g, 'le contactará'],

    [/\btu ([a-záéíóúñ]+)/g, 'su $1'],
    [/\bTu ([a-záéíóúñ]+)/g, 'Su $1'],
    [/\btus ([a-záéíóúñ]+)/g, 'sus $1'],
    [/\bTus ([a-záéíóúñ]+)/g, 'Sus $1'],

    // saludos comunes
    [/\b¿En qué te ayudo\b/g, '¿En qué le ayudo'],
    [/\b¿En qué te puedo ayudar\b/g, '¿En qué le puedo ayudar'],
    [/\b¿Cómo te puedo ayudar\b/g, '¿Cómo le puedo ayudar'],
    [/\b¿Cómo te ayudo\b/g, '¿Cómo le ayudo'],
    [/\b¿Qué necesitas\b/g, '¿Qué necesita'],
    [/\bcontacta a la empresa\b/g, 'contacte a la empresa']
  ];
  for (const [re, rep] of pares) s = s.replace(re, rep);
  return s;
}

/**
 * Quita emojis del texto si la empresa no quiere usarlos.
 * Usa un rango UNICODE amplio que cubre la mayoria de pictogramas.
 */
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|\uFE0F|\u200D/gu;
function quitarEmojis(texto) {
  if (!texto) return texto || '';
  return String(texto).replace(EMOJI_REGEX, '').replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
}

/**
 * Aplica tono y emojis a un texto (helper que combina ambos).
 */
function adaptarTexto(texto, opts = {}) {
  let s = aplicarTono(texto, opts.tonoFormal === true);
  if (opts.usarEmojis === false) s = quitarEmojis(s);
  return s;
}

/**
 * Reaccion (emoji) sugerida segun la intencion. Devuelve null si no aplica
 * (no toda intencion deberia recibir reaccion).
 */
function reaccionPorIntencion(intencion) {
  switch (intencion) {
    case 'hola':
    case 'menu':
      return '👋';
    case 'cotizar':
    case 'menu_numero':
      return '🛒';
    case 'pedido':
      return '📦';
    case 'deuda':
      return '💳';
    case 'despedida':
      return '👋';
    case 'producto':
    case 'precio':
    case 'stock':
      return '🔍';
    case 'confirmar_cotizacion':
      return '✅';
    case 'identidad':
    case 'que_vendes':
    case 'productos_destacados':
    case 'ubicacion':
    case 'contacto':
      return null;
    default:
      return null;
  }
}

/** Variantes adicionales para el flujo de escalamiento Fase 3. */
VARIANTES.escalamiento = {
  ofrecerAgente: [
    'Veo que no estoy logrando ayudarte como necesitas. ¿Quieres que te derive con un asesor humano? (responde *SÍ* o *NO*)',
    'Parece que esto se complicó por aquí. ¿Te gustaría hablar con un asesor humano? (*SÍ* / *NO*)',
    'Para que recibas mejor atención, ¿prefieres que te conecte con un asesor de la empresa? (*SÍ* / *NO*)'
  ],
  confirmaEscalada: [
    '¡Listo! Te derivo con un asesor humano. En breve te contactará por aquí mismo. 🙋',
    'Perfecto, ya avisé a un asesor. Te escribirá pronto en este chat. 🙋',
    'Hecho. Un asesor te atenderá en este chat en unos momentos. 🙋'
  ],
  enModoEscalada: [
    'Tu conversación está siendo atendida por un asesor humano. Cuando termine la consulta, escríbeme *MENÚ* para volver al bot.',
    'En este momento te está atendiendo un asesor. Si quieres volver al bot, escribe *MENÚ*.',
    'Un asesor humano está revisando tu caso. Para volver al bot escribe *MENÚ*.'
  ],
  desescaladoManual: [
    'Volvemos a la atención automática. ¿En qué te puedo ayudar? Escribe *MENÚ* para ver opciones.',
    'Listo, retomo la atención. Escribe *MENÚ* o el producto que necesites.',
    'Ya estoy de vuelta. ¿Qué necesitas?'
  ],
  rechazaAgente: [
    'Sin problema. Sigamos por aquí. Si quieres, escribe *MENÚ* o cuéntame qué necesitas.',
    'Perfecto, seguimos. Cuando quieras, escribe *MENÚ* para ver opciones.'
  ]
};

module.exports = {
  pick,
  sleep,
  saludoPorHora,
  nombreCorto,
  delaySegunLargo,
  delayEntreBurbujas,
  saludoPersonalizado,
  adjuntarCierre,
  aplicarTono,
  quitarEmojis,
  adaptarTexto,
  reaccionPorIntencion,
  mensajeAclararProducto,
  mensajeBuscarProductoMenu,
  fraseEjemploBusqueda,
  v,
  VARIANTES
};
