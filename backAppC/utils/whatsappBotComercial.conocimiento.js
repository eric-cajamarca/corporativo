const { getAppTimezone } = require('./fechaDisplay.util');
const flayersCatalogo = require('./whatsappBotFlayers.catalogo');
const { isSaas } = require('../config/deployment.config');

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
    'Si te encaja el rubro (tienda con stock y SUNAT: ferretería, repuestos, pinturas, ropa, librería, tecnología, abarrotes…) y quieres controlar ventas, créditos y facturación, *sí te conviene* probar.',
    '',
    'Lo que no está en la web y sí importa al contratar:',
    '• *Asistente de la plataforma:* al entrar a EFAFERP (sesión iniciada) te guía en el uso del sistema (SUNAT, productos, etc.). No guarda el historial. No le pegues claves ni el certificado.',
    '• *WhatsApp de tu tienda:* cuando ya eres cliente, tus compradores consultan stock y piden por *tu* número. Este chat es el de Business Soft.',
    '• *Precios de planes:* están en:',
    urlPublica('/planes'),
    '• *Demo 14 días* (sin tarjeta) o *contratar:* solo si lo pides. Escribe *DEMO* o *PAGAR* y te acompaño paso a paso.',
    '',
    'Si quieres una guía (inventario, robos, utilidad, cobranzas), escribe *GUÍAS*.',
    'Si buscas un *producto* de nuestro catálogo, escribe el nombre.',
    'Si prefieres hablar con una persona, escribe *AGENTE*.'
  ].join('\n');
}

function textoPlanes() {
  return [
    'Los planes y precios vigentes están aquí:',
    urlPublica('/planes'),
    '',
    'Si quieres *probar 14 días* (sin tarjeta), escribe *DEMO* y te acompaño. Si quieres *pagar un plan*, escribe *PAGAR*.',
    '',
    'Al contratar, un asesor te acompaña con SUNAT (usuario SOL, certificado, series). Horario en la web: lun–vie 9:00 a 18:00 (Perú).',
    'Dentro del sistema, el *asistente de la plataforma* es para guiarte en el uso del sistema.'
  ].join('\n');
}

function textoSoporteAsistente() {
  return [
    'Hay *tres* cosas distintas, para no confundirlas:',
    '',
    '1. *Este chat* (el de la web/WhatsApp de Business Soft): te orienta *antes* de contratar. No crea tu cuenta.',
    '2. *Asistente de la plataforma:* cuando ya entras a EFAFERP (sesión iniciada). Te guía a usar el sistema (ventas, SUNAT, productos). No guarda el historial.',
    '3. *WhatsApp de tu tienda:* vinculas *tu* número en Configuración. Desde el plan *Básico* envías boletas/facturas desde EFAFERP, sin abrir WhatsApp Web en el navegador cada vez (el celular queda vinculado). El *bot de pedidos* para que *tus clientes* consulten stock es desde el plan *Emprendedor*.',
    '',
    'Si quieres probar: *demo* 14 días sin tarjeta.'
  ].join('\n');
}

function textoWhatsAppVinculado() {
  return [
    'Sí. En el plan *Básico* vinculas *tu* WhatsApp en el sistema y envías la boleta/factura *desde EFAFERP*.',
    'No tienes que abrir WhatsApp Web en el navegador para cada envío: el número queda vinculado (el celular debe estar en línea).',
    'Eso es distinto del *bot de pedidos* (para que *tus clientes* te escriban): ese es desde *Emprendedor*.',
    'Si quieres probarlo: *demo* 14 días sin tarjeta.'
  ].join('\n');
}

function textoBotPedidos() {
  return [
    'El *bot de pedidos* (tus clientes consultan stock y piden por *tu* WhatsApp) entra desde el plan *Emprendedor*.',
    'En el plan *Básico* sí puedes *vincular tu WhatsApp* para *enviar boletas/facturas* desde EFAFERP, sin abrir WhatsApp Web cada vez.',
    'El *asistente de la plataforma* (dentro del sistema, con sesión) lo tienes al ser cliente, para aprender a usar EFAFERP.',
    'Si quieres, te paso el enlace de *demo* 14 días o *planes*.'
  ].join('\n');
}

function parecePreguntaModulo(texto) {
  return /\b(whats?app|vincular|bot( de pedidos| asistente)?|asistente( vendedor)?|factura|boletas?|comprobantes?|enviar (las )?(facturas|boletas)|whatsapp web|sin (tener que )?abrir|consiste|expl[ií]ca(me)?|h[aá]blame (sobre|del|de))\b/i.test(
    String(texto || '')
  );
}

function textoRespuestaModulo(texto) {
  const t = String(texto || '');
  if (!parecePreguntaModulo(t)) return null;
  const hablaAsistente = /\b(asistente|bot asistente|como es eso)\b/i.test(t) && !/\b(vincular|enviar (las )?facturas|whatsapp web)\b/i.test(t);
  const hablaBotPedidos = /\b(bot de pedidos|el bot|bot que ofrece|consiste el bot|sobre el bot|bot para (mis |mi )?(clientes|empresa)|usar( lo)? yo para mi empresa)\b/i.test(t);
  const hablaWa = /\b(whats?app|vincular|factura|boleta|comprobante|whatsapp web)\b/i.test(t);
  if (hablaAsistente && !hablaWa) return textoSoporteAsistente();
  if (hablaBotPedidos && !hablaWa) return textoBotPedidos();
  if (hablaWa) return textoWhatsAppVinculado();
  return textoSoporteAsistente();
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
  return 'Cuéntame a qué se dedica tu negocio y te digo si EFAFERP te sirve. Si ya quieres probar: *demo 14 días* sin tarjeta.';
}

const RUBROS_ENCAJAN = [
  { id: 'ferreteria', re: /\b(ferreter|torniller|agroferreter|materiales de construccion)/i, etiqueta: 'ferretería' },
  { id: 'repuestos', re: /\b(repuestos?|automotriz)/i, etiqueta: 'repuestos' },
  { id: 'pinturas', re: /\b(pinturer|pinturas?)/i, etiqueta: 'pinturas' },
  { id: 'ropa', re: /\b(ropa|zapatill|zapatos|calzado|confeccion|boutique|deportiv)/i, etiqueta: 'ropa' },
  { id: 'libreria', re: /\b(librer|utiles escolares|papeler)/i, etiqueta: 'librería' },
  { id: 'tecnologia', re: /\b(tecnolog|computador|laptops?|notebooks?|celulares?|smartphones?|electr[oó]nic)/i, etiqueta: 'tecnología' },
  { id: 'abarrotes', re: /\b(abarrotes|minimarket|bodega)\b/i, etiqueta: 'abarrotes' },
  { id: 'farmacia', re: /\b(farmacia|botica)\b/i, etiqueta: 'farmacia' },
  { id: 'grifo', re: /\b(grifo|estacion de servicio|gasolinera)\b/i, etiqueta: 'grifo' },
  { id: 'lubricantes', re: /\b(lubricantes?|aceites?( motoriz| de motor| automotrices)?)\b/i, etiqueta: 'lubricantes' }
];

const RUBROS_NO_TIPICOS = [
  { id: 'restaurante', re: /\b(restaurant|cevicher|poller|fuente de soda|comida rapida)/i },
  { id: 'consultorio', re: /\b(consultorio|clinica|dental|medico)/i },
  { id: 'colegio', re: /\b(colegio|academia|instituto educativo)/i }
];

const RE_NO_ES_RUBRO = /^(hola|buenas|buenos dias|buenas tardes|ok|okay|si|sí|no|gracias|planes|demo|pagar|sistema|guias|guías|llamada|agente|menu|menú|info|\d+)$/i;

function detectarRubro(texto) {
  const t = String(texto || '');
  const si = RUBROS_ENCAJAN.find((r) => r.re.test(t));
  if (si) return { id: si.id, etiqueta: si.etiqueta, encaja: 'si' };
  const no = RUBROS_NO_TIPICOS.find((r) => r.re.test(t));
  if (no) return { id: no.id, etiqueta: no.id, encaja: 'no' };
  if (/\b(hotel|hospedaje|hostal)\b/i.test(t)) return { id: 'hotel', etiqueta: 'hotel', encaja: 'parcial' };
  if (/\b(taller|mec[aá]nica)\b/i.test(t)) return { id: 'taller', etiqueta: 'taller', encaja: 'parcial' };
  return null;
}

function pareceComercioInventario(texto) {
  return /\b(vendo|revendo|reventa|tienda|stock|inventario|productos?|computador|laptops?|tecnolog|celular|electr[oó]nic|abarrotes|farmacia|repuesto|ferreter|pintur|ropa|librer|calzado|minimarket|bodega|grifo|lubricantes?|aceites?)\b/i.test(
    String(texto || '')
  );
}

function pareceDescripcionNegocio(texto) {
  const t = String(texto || '').trim();
  if (t.length < 3 || t.length > 280) return false;
  if (RE_NO_ES_RUBRO.test(t)) return false;
  if (pareceSolicitarDemo(t) || pareceSolicitarPago(t)) return false;
  if (/^(qu[eé]|c[oó]mo|cu[aá]nto|d[oó]nde|por qu[eé])\b/i.test(t)) return false;
  return (
    pareceComercioInventario(t)
    || /\b(negocio|rubro|me dedico|se dedica|somos|tengo una?|mi (tienda|negocio|empresa))\b/i.test(t)
  );
}

/** Etiqueta corta para hablar del rubro. Nunca el mensaje completo del cliente. */
function resumirEtiquetaRubro(texto) {
  let t = String(texto || '').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(hola|buenas|buenos d[ií]as|buenas tardes|buenas noches)[.,!¡]?\s+/i, '');
  t = t.replace(/[¿?].*$/g, ' ').trim();
  t = t.replace(/\b(crees que|piensas que|me (puede|podr[ií]a) ayudar|tu sistema|les sirve).*$/i, '').trim();
  const deNegocio = t.match(/\b(?:negocio|tienda|empresa|local|venta)\s+de\s+(.+)$/i);
  if (deNegocio) t = deNegocio[1].trim();
  const vendo = t.match(/\b(?:vendo|revendo|vendemos|comercializo)\s+(.+)$/i);
  if (vendo) t = vendo[1].trim();
  const dedico = t.match(/\b(?:me dedico a|nos dedicamos a|se dedica a)\s+(.+)$/i);
  if (dedico) t = dedico[1].trim();
  t = t.replace(/^(tengo una?|tenemos una?|somos una?|es un[ae]?)\s+/i, '');
  t = t.replace(/^(un|una|el|la|mi)\s+negocio\s+de\s+/i, '');
  t = t.replace(/[.,;:]+$/g, '').trim();
  if (t.length > 48) t = t.slice(0, 48).replace(/\s+\S*$/, '').trim();
  if (!t || RE_NO_ES_RUBRO.test(t) || t.split(/\s+/).length > 8) return '';
  return t;
}

function extraerRubroLibre(texto, prev) {
  const detectado = detectarRubro(texto);
  if (detectado) {
    return { rubro: detectado.etiqueta, rubroLibre: detectado.etiqueta, encaja: detectado.encaja };
  }
  const t = String(texto || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
  if (!t || RE_NO_ES_RUBRO.test(t)) return null;
  const etiqueta = resumirEtiquetaRubro(t);
  const esperando = Boolean(prev?.esperandoRubro);
  if (esperando) {
    if (/^(qu[eé]|c[oó]mo|cu[aá]nto|d[oó]nde)\b/i.test(t) || t.length < 3) return null;
    const rubroLibre = etiqueta || t.slice(0, 48);
    return { rubroLibre, encaja: pareceComercioInventario(t) ? 'si' : 'parcial' };
  }
  if (!pareceDescripcionNegocio(t) && !etiqueta) return null;
  if (!pareceDescripcionNegocio(t) && !pareceComercioInventario(etiqueta)) return null;
  if (!etiqueta) return null;
  return { rubroLibre: etiqueta, encaja: pareceComercioInventario(t) ? 'si' : 'parcial' };
}

function tieneRubro(com) {
  return Boolean(String(com?.rubro || '').trim() || String(com?.rubroLibre || '').trim());
}

function etiquetaRubro(com) {
  const catalogo = detectarRubro(`${com?.rubro || ''} ${com?.rubroLibre || ''}`);
  if (catalogo) return catalogo.etiqueta;
  const limpio = resumirEtiquetaRubro(com?.rubro || com?.rubroLibre || '');
  return limpio || 'tu negocio';
}

function parecePreguntaRubro(texto) {
  return /\b(a qu[eé] se dedica|qu[eé] rubro|orientarte|dedica tu negocio)\b/i.test(String(texto || ''));
}

function textoPitchRubroYDemo(com) {
  const nombre = etiquetaRubro(com);
  const encaja = String(com?.encaja || 'indefinido');
  if (encaja === 'no') {
    return [
      `Anoté *${nombre}*. No es el caso típico de EFAFERP (tiendas con stock y SUNAT).`,
      'Si igual vendes productos y quieres facturar, puedes *probar 14 días* sin tarjeta:',
      urlDemo(),
      'O pide una *llamada* y te contacta un asesor.'
    ].join('\n');
  }
  const linea =
    encaja === 'parcial'
      ? `En *${nombre}* no es el caso más típico, pero si manejas *stock y facturación SUNAT* sí te puede servir.`
      : `Para *${nombre}* te sirve: ventas, stock, créditos y boleta/factura SUNAT.`;
  return [
    linea,
    '',
    '¿Quieres *probar 14 días* (sin tarjeta) o que te llame un asesor?',
    `Demo: ${urlDemo()}`,
    'Si te trabas al registrarte, dime aquí.'
  ].join('\n');
}

function pareceConsultaComercial(texto, nlu, estado) {
  if (estado === 'comercial_ia') return true;
  const int = nlu?.intencion;
  if ([
    'info_sistema',
    'consulta_comercial',
    'agendar_llamada',
    'solicitar_demo',
    'contratar_plan',
    'duda_pago_registro'
  ].includes(int)) return true;
  const t = String(texto || '');
  if (t.length >= 50 && /\b(negocio|rubro|sistema|software|factur|sunat)\b/i.test(t)) return true;
  return false;
}

function last9Celular(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  const nueve = d.slice(-9);
  return /^9\d{8}$/.test(nueve) ? nueve : '';
}

function urlDemo() {
  return `${urlPublica('/suscribirse/demo')}?billing=none&origen=bot`;
}

function urlPlanes() {
  return urlPublica('/planes');
}

function urlSuscribirsePlan(planCode, ciclo) {
  const code = String(planCode || 'emprendedor').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'emprendedor';
  const billing = ciclo === 'yearly' || ciclo === 'anual' ? 'yearly' : 'monthly';
  return `${urlPublica(`/suscribirse/${code}`)}?billing=${billing}`;
}

function urlCrearEmpresaPrefill(opts = {}) {
  const q = new URLSearchParams();
  const cel = last9Celular(opts.celular);
  if (cel) q.set('celular', cel);
  if (isSaas()) {
    q.set('billing', 'none');
    q.set('origen', 'bot');
    const qs = q.toString();
    return `${urlPublica('/suscribirse/demo')}${qs ? `?${qs}` : ''}`;
  }
  const qs = q.toString();
  return urlPublica('/crear-empresa') + (qs ? `?${qs}` : '');
}

function paginaRegistro(ruta) {
  const r = String(ruta || '').toLowerCase().split('?')[0];
  return /\/(suscribirse|crear-empresa|verificar-empresa)(\/|$)/.test(r);
}

function inferirFlujoDesdeRuta(ruta) {
  const r = String(ruta || '').toLowerCase().split('?')[0];
  if (r.includes('/suscribirse/demo')) return 'demo';
  if (/\/suscribirse\/[a-z0-9_-]+/.test(r)) return 'pago';
  if (r.includes('/crear-empresa') || r.includes('/verificar-empresa')) return 'registro';
  return null;
}

const PASOS_REGISTRO = new Set(['demo', 'pago', 'ruc', 'datos', 'credenciales', 'codigo']);

function inferirPasoRegistro(ruta, paso, errorPantalla) {
  const p = String(paso || '').toLowerCase();
  if (PASOS_REGISTRO.has(p)) return p;
  const r = String(ruta || '').toLowerCase().split('?')[0];
  if (r.includes('/verificar-empresa')) return 'codigo';
  if (r.includes('/crear-empresa')) return 'ruc';
  if (r.includes('/suscribirse/demo')) return 'demo';
  if (/\/suscribirse\/[a-z0-9_-]+/.test(r)) return 'pago';
  if (/ruc_sunat|validaci[oó]n|sunat/i.test(String(errorPantalla || ''))) return 'ruc';
  return null;
}

function enPasoRuc(paso, ruta) {
  if (paso === 'ruc') return true;
  if (paso === 'codigo' || paso === 'credenciales' || paso === 'datos') return false;
  return String(ruta || '').toLowerCase().includes('/crear-empresa');
}

function pareceSolicitarDemo(texto) {
  const t = String(texto || '');
  if (pareceSolicitarPago(t) && !/\bdemo\b/i.test(t) && !/\bprueba\b/i.test(t)) return false;
  return (
    /^(demo|prueba)$/i.test(t.trim())
    || /\b(demo|cuenta demo|activar demo|prueba(r)?( (gratis|el sistema|14|de 14))?|14 d[ií]as|quiero probar|probar (el )?sistema|(me )?quiero registrar(me)?|registrarme|registr(ar|o) (mi )?(empresa|cuenta)|crear (mi )?(empresa|cuenta)|activar (la )?cuenta)\b/i.test(t)
  );
}

function pareceSolicitarPago(texto) {
  const t = String(texto || '');
  if (/\b(cu[aá]nto cuesta|precio(s)? (del|de el)|ver planes|^planes$)\b/i.test(t)
    && !/\b(pagar|contratar|yape|plin|dep[oó]sito)\b/i.test(t)) {
    return false;
  }
  return (
    /^(pagar|contratar)$/i.test(t.trim())
    || /\b(contratar|pagar( el)?( plan)?|quiero (el )?plan|comprar (el )?(plan|sistema)|plan emprendedor|plan profesional|plan enterprise|\byape\b|\bplin\b|culqi|tarjeta de cr[eé]dito|dep[oó]sito bcp|suscribirme)\b/i.test(t)
  );
}

function pareceDudaPagoRegistro(texto) {
  const t = String(texto || '');
  return /\b(ruc|sunat|validaci[oó]n|conectar|servicio de valid|c[oó]digo de (6|seis)|no me llega( el)?( c[oó]digo)?|contrase[nñ]a|yape|plin|voucher|culqi|tarjeta|pol[ií]ticas|chk-|activar (la )?(demo|cuenta|empresa)|correo|email|celular)\b/i.test(t);
}

function detectarPlanYCiclo(texto) {
  const t = String(texto || '').toLowerCase();
  let plan = null;
  if (/\bemprendedor\b/.test(t)) plan = 'emprendedor';
  else if (/\bprofesional\b/.test(t)) plan = 'profesional';
  else if (/\benterprise\b/.test(t)) plan = 'enterprise';
  let ciclo = null;
  if (/\b(anual|yearly|a[nñ]o)\b/.test(t)) ciclo = 'yearly';
  else if (/\b(mensual|monthly|al mes)\b/.test(t)) ciclo = 'monthly';
  return { plan, ciclo };
}

function textoAcompanarDemo(com, ruta) {
  const r = String(ruta || '').toLowerCase().split('?')[0];
  if (r.includes('/suscribirse/demo')) {
    return [
      'Estás en la pantalla de la *demo*. Acepta las políticas y pulsa *activar demo* (14 días, *sin tarjeta*).',
      'Luego te pide el *RUC* (11 dígitos), correo, celular y contraseña. El código de 6 dígitos llega por WhatsApp y correo.',
      'Si te trabas, dime el paso (políticas, RUC, correo o código). No cierres este chat.'
    ].join('\n');
  }
  if (r.includes('/crear-empresa') || r.includes('/verificar-empresa')) {
    return textoAcompanarRegistro(ruta, com?.pasoRegistro);
  }
  return [
    'Perfecto. Te acompaño a crear la *demo* (14 días, *sin tarjeta*).',
    '',
    '1. Abre este enlace y acepta las políticas:',
    urlDemo(),
    '2. Pulsa *activar demo* (no se cobra).',
    '3. La web te lleva a registrar tu empresa (RUC, correo, celular y contraseña).',
    '4. Te llega un *código de 6 dígitos* por WhatsApp y correo. Lo ingresas en verificar empresa.',
    '',
    'Si te trabas (RUC, correo, código, contraseña), escríbeme aquí. No me envíes la contraseña ni datos de tarjeta.'
  ].join('\n');
}

function textoAcompanarPago(com, ruta) {
  const r = String(ruta || '').toLowerCase().split('?')[0];
  const elegido = detectarPlanYCiclo(`${com?.planCode || ''} ${com?.billingCycle || ''}`);
  const plan = com?.planCode || elegido.plan;
  const ciclo = com?.billingCycle || elegido.ciclo || 'monthly';
  if (r.includes('/suscribirse/') && !r.includes('/suscribirse/demo')) {
    return [
      'Estás en el *pago del plan*.',
      '• *Tarjeta:* Culqi en esta misma pantalla. *Nunca* me envíes el número de tarjeta aquí.',
      '• *Yape / Plin / depósito BCP:* elige esa opción. Si quieres el número o la cuenta, pídemelos aquí.',
      'Luego registras la empresa (RUC, correo, celular, contraseña) y activas con el código de 6 dígitos.',
      'Dime si te traba el medio de pago, el voucher o el registro. Precios vigentes solo en:',
      urlPlanes()
    ].join('\n');
  }
  if (r.includes('/crear-empresa') || r.includes('/verificar-empresa')) {
    return textoAcompanarRegistro(ruta, com?.pasoRegistro);
  }
  const lineas = [
    'Te acompaño a *contratar*. No cobro ni registro la empresa desde este chat: te guío en la web.',
    '',
    '1. Elige el plan (precios vigentes; no los invento):',
    urlPlanes()
  ];
  if (plan && plan !== 'enterprise') {
    lineas.push(`2. Directo a *${plan}* (${ciclo === 'yearly' ? 'anual' : 'mensual'}):`, urlSuscribirsePlan(plan, ciclo));
  } else {
    lineas.push('2. Elige *mensual* o *anual*. El más usado es *Emprendedor*.');
    lineas.push(`   Emprendedor mensual: ${urlSuscribirsePlan('emprendedor', 'monthly')}`);
  }
  lineas.push(
    '3. Paga con *tarjeta* (Culqi) o *Yape / Plin / depósito BCP*. El número y la cuenta los tienes en el checkout; también te los doy aquí si los pides.',
    '4. Si es Yape/Plin, reporta el *voucher* en esa pantalla; un asesor valida. Si ya pagaste, escribe *ya pagué*.',
    '5. Luego registras tu empresa (RUC, correo, celular, contraseña) y el código de 6 dígitos.',
    '',
    'Dudas de pago o registro, escríbeme. No me envíes contraseñas ni números de tarjeta.'
  );
  return lineas.join('\n');
}

function textoAcompanarRegistro(ruta, paso) {
  const p = inferirPasoRegistro(ruta, paso);
  const r = String(ruta || '').toLowerCase().split('?')[0];
  if (p === 'codigo' || r.includes('/verificar-empresa')) {
    return [
      'Estás en *verificar empresa*. Ingresa el *código de 6 dígitos* que te llegó por WhatsApp o correo.',
      'Si no llega: revisa spam, que el celular (9 dígitos) y el correo estén bien, y pide reenvío en esa pantalla.',
      'No me envíes el código aquí si puedes ingresarlo en el formulario. Si te sigue fallando, dime qué ves.'
    ].join('\n');
  }
  if (p === 'credenciales') {
    return [
      'Estás en *credenciales*. Completa correo, celular (9 dígitos) y contraseña.',
      'La contraseña: mín. 8, mayúscula, minúscula, número y símbolo. *No me la escribas aquí.*',
      'El código de 6 dígitos llega *después* de registrar, por WhatsApp y correo.'
    ].join('\n');
  }
  if (p === 'datos') {
    return 'Revisa razón social y dirección que trajo SUNAT. Si están bien, pulsa *Continuar* para correo, celular y contraseña.';
  }
  return [
    'Estás en *Verificar RUC* (paso 1). Escribe los *11 dígitos* y pulsa *Verificar*.',
    'SUNAT completa razón social y dirección. Todavía *no* hay código de WhatsApp: ese llega al final, después de correo y contraseña.',
    'Si el aviso rojo dice que no se pudo consultar el RUC, espera unos segundos y pulsa *Verificar* otra vez.'
  ].join('\n');
}

function textoDudaRucSunat(errorPantalla) {
  return [
    'Estás en el *paso 1: Verificar RUC*. No es el código de 6 dígitos (ese llega después, por WhatsApp y correo).',
    'Escribe el RUC de 11 dígitos y pulsa *Verificar* para que SUNAT complete los datos.',
    /ruc_sunat|conectar|validaci/i.test(String(errorPantalla || ''))
      ? 'El formulario no pudo consultar SUNAT. Espera un momento y pulsa *Verificar* de nuevo. No escribas ningún código aquí.'
      : 'Si no carga, reintenta. Si sigue el aviso rojo, dime el texto exacto (sin pegar contraseñas).'
  ].join('\n');
}

function textoDudaPagoRegistro(texto, flujo, ruta, paso, errorPantalla) {
  const t = String(texto || '');
  const p = inferirPasoRegistro(ruta, paso, errorPantalla);
  if (enPasoRuc(p, ruta) || /\b(ruc|sunat|validaci[oó]n|conectar|servicio de valid)\b/i.test(t)) {
    if (p !== 'codigo') {
      return textoDudaRucSunat(errorPantalla || t);
    }
  }
  if (p === 'codigo' || /\b(c[oó]digo de (6|seis)|no me llega( el)?( c[oó]digo)?|reenv[ií]o)\b/i.test(t)) {
    return [
      'El código son *6 dígitos*. Llega por *WhatsApp* y *correo* *después* de registrar la empresa.',
      `Ingrésalo en: ${urlPublica('/verificar-empresa')}`,
      'Si no llega: spam, celular de 9 dígitos empezando en 9, y reenvío en esa pantalla.'
    ].join('\n');
  }
  if (/\b(contrase[nñ]a|password|clave)\b/i.test(t)) {
    return [
      'La contraseña: *mínimo 8 caracteres*, con mayúscula, minúscula, número y un símbolo (ej. @ # !).',
      '*No me la escribas en este chat.* Úsala solo en el formulario de registro.'
    ].join('\n');
  }
  if (/\b(yape|plin|voucher|dep[oó]sito|bcp)\b/i.test(t)) {
    return [
      'Puedo pasarte el *Yape/Plin* o la *cuenta BCP*. Escríbelo así: *YAPE*, *PLIN* o *CUENTA*.',
      `Elige el plan aquí: ${urlPlanes()}`,
      'Paga y *adjunta el voucher en el checkout*. Si ya pagaste, escribe *ya pagué* y aviso al administrador.',
      'Después registras la empresa (RUC, correo, celular, contraseña).'
    ].join('\n');
  }
  if (/\b(tarjeta|culqi|cr[eé]dito|d[eé]bito)\b/i.test(t)) {
    return [
      'La *tarjeta* se paga con *Culqi* en la pantalla de suscripción. *Nunca* me envíes el número, CVV ni vencimiento aquí.',
      `Elige el plan y paga ahí: ${urlPlanes()}`,
      'La demo de 14 días *no pide tarjeta*.'
    ].join('\n');
  }
  if (/\b(correo|email|e-mail|celular|whatsapp)\b/i.test(t) && !/\b(yape|plin|tarjeta)\b/i.test(t)) {
    return [
      'Usa un *correo* al que tengas acceso: ahí llega el código y con ese correo entrarás.',
      'El *celular* es de 9 dígitos Perú (empieza en 9). Ahí llega el código por WhatsApp.',
      'Si ya los pusiste y no llega el código, revisa spam y pide reenvío en verificar empresa.'
    ].join('\n');
  }
  if (/\b(pol[ií]tica|t[eé]rminos|aceptar)\b/i.test(t)) {
    return 'Marca que aceptas las políticas en esa misma pantalla y sigue. Sin eso no se activa la demo ni el pago. Si el botón no habilita, recarga y vuelve a marcar.';
  }
  if (/\b(cu[aá]nto cuesta|precio|cu[aá]nto vale|plan)\b/i.test(t)) {
    return [
      'No cito precios de memoria para no equivocarme. Están actualizados aquí:',
      urlPlanes(),
      flujo === 'demo'
        ? 'La *demo* es 14 días *sin tarjeta* y sin cobro.'
        : 'Si ya sabes el plan (Emprendedor/Profesional) y mensual o anual, te armo el enlace de pago.'
    ].filter(Boolean).join('\n');
  }
  if (/\b(gratis|cobra|cobran|tarjeta)\b/i.test(t) && (flujo === 'demo' || /\bdemo\b/i.test(t))) {
    return `La *demo* son 14 días del sistema real, *sin tarjeta* y *sin cobro*. Enlace: ${urlDemo()}`;
  }
  if (!pareceDudaPagoRegistro(t)) return null;
  const donde = flujo === 'pago' ? 'pago (Yape/tarjeta), voucher, RUC, correo o código' : 'políticas, activar demo, RUC, correo, celular o código de 6 dígitos';
  return `Sigo aquí. Dime en qué paso estás: ${donde}.`;
}

function turnoAcompanamiento({ texto, flujo, ruta, comercial, iniciar }) {
  const planCiclo = detectarPlanYCiclo(texto);
  const paso = inferirPasoRegistro(ruta, comercial?.pasoRegistro, comercial?.errorPantalla);
  const next = {
    ...comercial,
    flujo,
    pasoRegistro: paso || comercial?.pasoRegistro,
    errorPantalla: comercial?.errorPantalla,
    intencionCompra: 'alta',
    planCode: planCiclo.plan || comercial?.planCode,
    billingCycle: planCiclo.ciclo || comercial?.billingCycle
  };
  if (iniciar && !comercial?.acompanamientoEnviado) {
    let respuesta;
    if (flujo === 'pago') respuesta = textoAcompanarPago(next, ruta);
    else if (flujo === 'registro') respuesta = textoAcompanarRegistro(ruta, paso);
    else respuesta = textoAcompanarDemo(next, ruta);
    return {
      respuesta,
      comercial: { ...next, acompanamientoEnviado: true },
      accion: flujo === 'pago' ? 'acompanar_pago' : 'acompanar_demo',
      slugFlayer: null,
      quiereLlamada: false
    };
  }
  if (planCiclo.plan && flujo === 'pago') {
    return {
      respuesta: [
        `Plan *${planCiclo.plan}* (${(planCiclo.ciclo || next.billingCycle) === 'yearly' ? 'anual' : 'mensual'}):`,
        urlSuscribirsePlan(planCiclo.plan, planCiclo.ciclo || next.billingCycle || 'monthly'),
        'Acepta políticas y paga ahí. Si te trabas, dime el medio (Yape, Plin o tarjeta).'
      ].join('\n'),
      comercial: { ...next, acompanamientoEnviado: true },
      accion: 'acompanar_pago',
      slugFlayer: null,
      quiereLlamada: false
    };
  }
  const duda = textoDudaPagoRegistro(texto, flujo, ruta, paso, comercial?.errorPantalla);
  if (duda) {
    return {
      respuesta: duda,
      comercial: { ...next, acompanamientoEnviado: true },
      accion: flujo === 'pago' ? 'acompanar_pago' : 'acompanar_demo',
      slugFlayer: null,
      quiereLlamada: false
    };
  }
  return null;
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

function textoSugerirLlamadaSoporte() {
  return [
    'Si quieres, te lo confirma soporte en una *llamada* (lun–vie 9:00 a 18:00, Perú).',
    'Escribe *LLAMADA* y tu *nombre*, *celular* y un *horario*.'
  ].join('\n');
}

function promptPreventaIa(fichaActual, nluIntencion) {
  const site = SITE();
  const fichaTxt = JSON.stringify(fichaActual || {});
  return `
Eres el GESTOR de la conversación de preventa de BUSINESS SOFT COMPANY S.A.C. (Perú).
Hablas como persona: natural, breve y al grano. No menciones IA, Gemini ni proveedores.
No eres el asistente de la plataforma (ese es solo con sesión iniciada).

ROL (obligatorio):
- Interpreta el mensaje, elige si encaja una PLANTILLA y ORDENA la respuesta al cliente.
- NO consultas bases de datos, NO tienes precios, números de Yape/Plin, CCI ni cuentas. El backend los inyecta.
- NO creas cuentas, NO activas demos, NO cobras, NO confirmes que un plan “ya está activo”.
- PROHIBIDO inventar precios, plazos, módulos, descuentos o integraciones. Si no está en los hechos de abajo, plantilla=cita o accion=sugerir_llamada (quiereLlamada=false). NUNCA digas “no está publicado” ni “no invento”.
- Responde *esta* pregunta. No pegues planes ni el pitch de rubro si preguntaron WhatsApp, bot, asistente o facturas.

Cómo trabajas cada turno:
1) Entiende qué pide.
2) Elige UNA plantilla (o ninguna).
3) Si te falta un dato para avanzar, pedirDato (el backend completa o pregunta).
4) Escribe "respuesta": 2 a 4 líneas de hilo. Si necesitas un bloque real (precios, Yape, cuenta, demo), NO lo escribas: usa plantilla o estos marcadores que el backend sustituye:
[[PLANES]] [[YAPE]] [[PLIN]] [[CUENTA]] [[MEDIOS]] [[DEMO]] [[WHATSAPP]] [[BOT]] [[ASISTENTE]] [[PITCH]] [[GUIAS]]

plantilla (una):
ninguna | whatsapp | bot_pedidos | asistente | planes | yape | plin | cuenta | medios_pago | demo | registro | pitch_rubro | cita | pago_confirmado | guias

pedirDato (uno o vacío): "" | rubro | nombre | celular | horario
- rubro: aún no sabes a qué se dedica y lo necesitas para orientar.
- nombre/celular/horario: SOLO si pidió o aceptó una llamada y falta ese dato.
No pidas nombre/celular si solo preguntó por el producto.

EFAFERP encaja en tiendas con *stock* y SUNAT: ferretería, agroferretería, repuestos, pinturas, ropa, librerías, tecnología, abarrotes, farmacia, grifo, lubricantes/aceites.
Sirve para: ventas, stock, créditos/cobranzas, utilidad y facturación SUNAT.
Si describe su negocio (aunque no esté en la lista) y vende productos: encaja=si. rubroLibre = etiqueta CORTA (2 a 5 palabras, p. ej. "lubricantes"). PROHIBIDO copiar el mensaje entero en rubro, rubroLibre o en la respuesta.
Hotel: encaje parcial. Restaurante/consultorio: encaja=no, honesto, sin insistir.
PROHIBIDO: tienda virtual, e-commerce, marketplace. Hoy no se vende.

Cuando YA hay rubro en la ficha: NUNCA preguntes otra vez a qué se dedica.
Si *en este mensaje* acaba de decir el rubro: plantilla=pitch_rubro.
Si hace *otra* pregunta: respóndela (plantilla whatsapp/bot_pedidos/asistente/planes/…); no repitas el pitch.

Hechos (sin montos ni cuentas):
- Demo: 14 días, sistema real, sin tarjeta. Marcador [[DEMO]] o plantilla=demo. Web: ${site}/suscribirse/demo?billing=none
- Planes y precios: plantilla=planes o [[PLANES]]. Nunca inventes un monto.
- Pago: Culqi (tarjeta, solo en la web) o Yape / Plin / depósito. plantilla=yape|plin|cuenta|medios_pago. Tú no cobras. Si dice *ya pagué*: plantilla=pago_confirmado (no digas que el plan está activo).
- Registro: primero elige *demo* o un *plan* en la web. Luego ${site}/crear-empresa — RUC 11 dígitos, correo, celular, contraseña, código 6 dígitos. En paso RUC, “Verificar” es el RUC, no el código. plantilla=registro si está en esa pantalla o se traba.
- Asesor de BUSINESS SOFT acompaña la puesta en marcha (SUNAT). Lun–vie 9:00 a 18:00 (Perú).
- WhatsApp vinculado (plan Básico): envía boletas/facturas desde EFAFERP. plantilla=whatsapp o [[WHATSAPP]]
- Bot de pedidos (plan Emprendedor): *sus* clientes consultan stock por el WhatsApp de *su* tienda. plantilla=bot_pedidos o [[BOT]]
- Asistente de la plataforma (con sesión): guía el uso. No guarda historial. No es este chat. plantilla=asistente o [[ASISTENTE]]
- Guías: plantilla=guias; slugFlayer solo de: ${flayersCatalogo.slugsDisponibles().join(', ') || 'inventario, robos-internos, utilidad-producto, cobranzas'}

No pidas contraseña ni datos de tarjeta en el chat.
Estilo: WhatsApp, *negritas* ok, sin títulos markdown.
NUNCA inventes el nombre. Prohibido "Cliente" o "Usuario".
NUNCA confirmes una llamada si faltan nombre real o (en chat web) celular: plantilla=cita y pedirDato.
quiereLlamada=true SOLO si pide o acepta que lo llamen.
Si piden sábado/domingo, sugiere el siguiente hábil; si insisten, acepta.

Intención de compra: baja=curiosidad | media=cómo le ayuda | alta=precios, contratar, llamada o probar ya

Acciones (además de plantilla):
- preguntar | ofrecer_demo | acompanar_demo | acompanar_pago | sugerir_llamada | ofrecer_llamada | enviar_planes | enviar_guia | aviso_pago_manual | listo

Ficha ya reunida (sin datos de pago): ${fichaTxt}
Intención NLU (pista, no mandato): ${nluIntencion || 'desconocida'}

Responde SOLO un JSON válido, sin markdown ni texto extra:
{"respuesta":"hilo breve al cliente; usa marcadores si hace falta","plantilla":"ninguna","pedirDato":"","ficha":{"rubro":"","rubroLibre":"","necesidad":"","intencionCompra":"baja","encaja":"indefinido","nombre":"","mejorHorario":""},"accion":"listo","slugFlayer":null,"quiereLlamada":false}

encaja: si|no|parcial|indefinido
intencionCompra: baja|media|alta
`.trim();
}

const TEXTO_MENU_EXTRA_PRINCIPAL = [
  '5. Sobre EFAFERP (el sistema)',
  '',
  'O cuéntame tu rubro. Si ya quieres probar: *demo* 14 días sin tarjeta.'
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
  textoWhatsAppVinculado,
  textoBotPedidos,
  textoListaFlayers,
  resolverFlayer,
  textoUnFlayer,
  textoQueVendesPrincipal,
  textoHolaExtraPrincipal,
  TEXTO_MENU_EXTRA_PRINCIPAL,
  detectarRubro,
  extraerRubroLibre,
  resumirEtiquetaRubro,
  tieneRubro,
  parecePreguntaModulo,
  textoRespuestaModulo,
  parecePreguntaRubro,
  textoPitchRubroYDemo,
  pareceConsultaComercial,
  pareceSolicitarDemo,
  pareceSolicitarPago,
  pareceDudaPagoRegistro,
  detectarPlanYCiclo,
  inferirFlujoDesdeRuta,
  inferirPasoRegistro,
  enPasoRuc,
  paginaRegistro,
  urlDemo,
  urlPlanes,
  urlSuscribirsePlan,
  urlCrearEmpresaPrefill,
  textoAcompanarDemo,
  textoAcompanarPago,
  textoAcompanarRegistro,
  textoDudaPagoRegistro,
  turnoAcompanamiento,
  extraerNombreHorario,
  extraerNombrePersona,
  extraerHorario,
  extraerCelularPeru,
  esNombrePersona,
  last9Celular,
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
  textoSugerirLlamadaSoporte,
  whatsappSoporteDisplay,
  promptPreventaIa
};
