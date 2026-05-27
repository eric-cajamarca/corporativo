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
  aclararProducto: [
    'Indícame qué producto buscas, por ejemplo: *pintura látex*.',
    '¿Qué producto necesitas? Escríbeme el nombre, por ejemplo: *taladro*.',
    'Dime el nombre del producto que buscas. Por ejemplo: *cemento bolsa 42.5 kg*.'
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

module.exports = {
  pick,
  sleep,
  saludoPorHora,
  nombreCorto,
  delaySegunLargo,
  delayEntreBurbujas,
  saludoPersonalizado,
  adjuntarCierre,
  reaccionPorIntencion,
  v,
  VARIANTES
};
