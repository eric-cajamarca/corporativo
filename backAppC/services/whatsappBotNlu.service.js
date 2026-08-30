const { normalizarTexto, tokenizar, extraerComprobante } = require('../utils/whatsappBotTexto.util');

const PATRONES = {
  menu: /\b(menu|ayuda|inicio|opciones)\b/i,
  hola: /\b(hola|buenos dias|buenas tardes|buenas noches|saludos)\b/i,
  ping: /\bping\b/i,
  pedido: /\b(pedido|pedidos|mis pedidos|mi pedido|orden|ordenes)\b/i,
  deuda: /\b(deuda|debo|saldo|credito|creditos|cuanto debo|pendiente de pago)\b/i,
  stock: /\b(stock|disponible|disponibilidad|hay|tienen|queda|quedan|existencia)\b/i,
  precio: /\b(precio|precios|cuanto cuesta|cuanto cuestan|valor|vale)\b/i,
  cotizar: /\b(cotizar|cotizacion|cotizaciones|presupuesto|presupuestar|quiero pedir|quiero comprar|hacer un pedido)\b/i,
  agregarACotizacion: /\b(agregar al carrito|agregar a la cotizacion|agregar a cotizacion|agregar este producto|cotizar este producto|anadir al carrito|añadir al carrito|poner en el carrito|sumar al carrito|meter al carrito)\b/i,
  confirmar: /\b(confirmar|confirmo|finalizar|enviar cotizacion|registrar cotizacion|hacer pedido|pedir ahora|confirmar pedido|cerrar pedido)\b/i,
  cancelar: /\b(cancelar|anular|vaciar carrito|borrar carrito)\b/i,
  carrito: /\b(carrito|mi lista|ver lista|mi cotizacion)\b/i,
  quitar: /\b(quitar|eliminar|sacar|remover)\b/i,
  identidad: /\b(quien eres|quien sos|que eres|que sos|presentate|presentacion|sobre (ustedes|la empresa|ti)|about us)\b/i,
  productosDestacados: /\b(que productos vendes|que productos venden|productos mas vendidos|productos destacados|que venden ustedes|que venden ellos|lista de productos)\b/i,
  queVendes: /\b(que vendes|que venden|que comercializ|que ofrecen|que productos tienen|que lineas manejan|que categorias|que marcas)\b/i,
  ubicacion: /\b(direccion|donde estan|donde queda|donde quedan|ubicacion|ubicados|donde son|como llegar)\b/i,
  contacto: /\b(telefono|celular|correo|email|e mail|como contact|datos de contacto|numero de contacto)\b/i,
  despedida: /\b(gracias|muchas gracias|mil gracias|te agradezco|ok gracias|listo gracias|hasta pronto|hasta luego|nos vemos|chau|chao|adios|bye|hasta manana|nada mas|eso es todo|fue un gusto)\b/i,
  productosPedido: /\b(productos|producto|detalle|items|que trae|que incluye|lista|ver pedido)\b/i,
  pdfPedido: /\b(pdf|comprobante|documento|recibo|boleta|factura)\b/i,
  // Solicitud explicita de hablar con un humano (escalamiento Fase 3).
  solicitarAgente: /\b(agente|asesor|asesora|humano|humana|persona real|alguien real|hablar con alguien|hablar con un|atencion humana|vendedor|vendedora|representante|operador|operadora|ayuda humana)\b/i,
  infoSistema: /\b(efaferp|business soft|sistema de ventas|software de ventas|\berp\b|me conviene|conviene el sistema|me sirve|para mi ferreteria|para mi negocio|el sistema efaferp|comprar el sistema|quiero el sistema|contratar( el)? sistema|\bdemo\b|prueba (gratis|de 14)|14 dias|configurar(lo| la empresa| el sistema)|cuenta demo)\b/i,
  planesSaas: /\b(planes|plan mensual|plan anual|suscripcion|precio del sistema|cuanto cuesta (el )?sistema|cuanto cuesta efaferp|cuanto vale el sistema)\b/i,
  solicitarDemo: /^(demo|prueba)$/i,
  solicitarDemoLargo: /\b(demo|cuenta demo|activar demo|prueba(r)?( (gratis|el sistema|14|de 14))?|14 d[ií]as|quiero probar|probar (el )?sistema|(me )?quiero registrar(me)?|registrarme|registr(ar|o) (mi )?(empresa|cuenta)|crear (mi )?(empresa|cuenta))\b/i,
  contratarPlan: /^(pagar|contratar)$/i,
  contratarPlanLargo: /\b(contratar|pagar( el)?( plan)?|quiero (el )?plan|comprar (el )?(plan|sistema)|plan emprendedor|plan profesional|\byape\b|\bplin\b|dep[oó]sito bcp)\b/i,
  dudaPagoRegistro: /\b(ruc|sunat|validaci[oó]n|c[oó]digo de (6|seis)|no me llega (el )?c[oó]digo|contrase[nñ]a|voucher|chk-|activar (la )?(demo|cuenta))\b/i,
  agendarLlamada: /\b(agendar( una)? llamada|quiero( una)? llamada|que me llamen|llamenme|llámenme|llamame|llámame|^llamada$)\b/i,
  consultaComercial: /\b(mi rubro|mi negocio|tengo una|tengo un|somos una|nos dedicamos|a que se dedica|me ayuda (el |con el )?sistema|sirve para|encaja (en|con)|ferreter|repuestos?|pinturer|librer|ropa deport|zapatill|calzado|minimarket|bodega|grifo|restaurant|cevicher|hotel|peluquer|taller mecan)/i,
  flayerComercial: /\b(flayer|flyer|folleto|guias|guia gratuita|robos internos|robo interno|utilidad por producto|control de inventario|cobranzas|\binventario\b|\brobos?\b|\butilidad\b)\b/i,
  soporteAsistente: /\b(asistente de (ayuda|efaferp|la plataforma)|como se usa el sistema|aprender el sistema|tutoriales del sistema)\b/i,
  // Confirmar/negar oferta de derivar (cuando el bot pregunta).
  afirmacion: /\b(si|sí|sip|claro|por favor|ok|okay|dale|bueno|de acuerdo|deseo|quiero)\b/i,
  negacion: /\b(no|nop|nope|negativo|todavia no|aun no|prefiero no|gracias no)\b/i
};

function aplicarSinonimos(tokens, sinonimosMap) {
  if (!sinonimosMap || sinonimosMap.size === 0) return tokens;
  return tokens.map((t) => sinonimosMap.get(t) || t);
}

function esEstadoCotiz(estado) {
  return String(estado || '').startsWith('cotiz_');
}

function esEstadoPedido(estado) {
  return String(estado || '').startsWith('pedido_');
}

function detectarIdentidad(textoNorm, t) {
  const upper = t.toUpperCase();
  if (upper === 'QUIEN ERES' || upper === 'QUE ERES' || upper === 'CONTACTO' || upper === 'DIRECCION') {
    if (upper === 'QUIEN ERES' || upper === 'QUE ERES') return 'identidad';
    if (upper === 'CONTACTO') return 'contacto';
    if (upper === 'DIRECCION') return 'ubicacion';
  }
  if (upper === 'QUE VENDES') return 'que_vendes';
  if (upper === 'QUE PRODUCTOS VENDES') return 'productos_destacados';
  if (PATRONES.productosDestacados.test(textoNorm)) return 'productos_destacados';
  if (PATRONES.identidad.test(textoNorm)) return 'identidad';
  if (PATRONES.queVendes.test(textoNorm)) return 'que_vendes';
  if (PATRONES.ubicacion.test(textoNorm)) return 'ubicacion';
  if (PATRONES.contacto.test(textoNorm)) return 'contacto';
  return null;
}

function detectarIntencion(textoNorm, mensajeRaw, contexto) {
  const t = String(mensajeRaw || '').trim();
  const estado = contexto?.estado || 'menu';
  if (estado === 'registro_documento') {
    if (PATRONES.menu.test(textoNorm) || t.toUpperCase() === 'MENU') return 'menu';
    if (PATRONES.despedida.test(textoNorm)) return 'despedida';
    if (PATRONES.cancelar.test(textoNorm) || t.toUpperCase() === 'CANCELAR') return 'cancelar_cotizacion';
    const doc = String(t).replace(/\D/g, '');
    if (/^\d{8}$/.test(doc) || /^\d{11}$/.test(doc)) return 'documento_identidad';
    return 'documento_invalido';
  }

  if (estado === 'cotiz_entrega') {
    if (PATRONES.menu.test(textoNorm) || t.toUpperCase() === 'MENU') return 'menu';
    if (PATRONES.cancelar.test(textoNorm) || t.toUpperCase() === 'CANCELAR') return 'cancelar_cotizacion';
    if (PATRONES.solicitarAgente.test(textoNorm)) return 'solicitar_agente';
    if (PATRONES.carrito.test(textoNorm) || t.toUpperCase() === 'CARRITO') return 'carrito';
    if (/\benvio\b|\benvío\b|\bdelivery\b|\bdomicilio\b|\benviar\b/.test(textoNorm) || t === '2') {
      return 'entrega_envio';
    }
    if (/\brecojo\b|\btienda\b|\brecoger\b|\blocal\b|\bpaso\b/.test(textoNorm) || t === '1') {
      return 'entrega_recojo';
    }
    return 'entrega_invalida';
  }

  if (PATRONES.ping.test(textoNorm)) return 'ping';
  if (PATRONES.solicitarAgente.test(textoNorm)) return 'solicitar_agente';

  if (!esEstadoCotiz(contexto.estado) && !esEstadoPedido(contexto.estado)) {
    if (t.toUpperCase() === 'DEMO' || PATRONES.solicitarDemo.test(t) || PATRONES.solicitarDemoLargo.test(textoNorm)) {
      return 'solicitar_demo';
    }
    if (t.toUpperCase() === 'PAGAR' || PATRONES.contratarPlan.test(t) || PATRONES.contratarPlanLargo.test(textoNorm)) {
      return 'contratar_plan';
    }
    if (PATRONES.dudaPagoRegistro.test(textoNorm)) return 'duda_pago_registro';
    if (t.toUpperCase() === 'SISTEMA' || PATRONES.infoSistema.test(textoNorm)) return 'info_sistema';
    if (t.toUpperCase() === 'PLANES' || PATRONES.planesSaas.test(textoNorm)) return 'planes_saas';
    if (t.toUpperCase() === 'LLAMADA' || PATRONES.agendarLlamada.test(textoNorm)) return 'agendar_llamada';
    if (PATRONES.consultaComercial.test(textoNorm)) return 'consulta_comercial';
    if (t.toUpperCase() === 'GUIAS' || t.toUpperCase() === 'GUÍAS' || PATRONES.flayerComercial.test(textoNorm)) {
      return 'flayer_comercial';
    }
    if (PATRONES.soporteAsistente.test(textoNorm)) return 'soporte_asistente';
  }

  if (PATRONES.menu.test(textoNorm)) return 'menu';
  if (PATRONES.hola.test(textoNorm)) return 'hola';
  if (PATRONES.despedida.test(textoNorm)) return 'despedida';

  const identidad = detectarIdentidad(textoNorm, t);
  if (identidad && !esEstadoCotiz(contexto.estado)) return identidad;

  if (PATRONES.confirmar.test(textoNorm) || t.toUpperCase() === 'CONFIRMAR') return 'confirmar_cotizacion';
  if (PATRONES.cancelar.test(textoNorm) || t.toUpperCase() === 'CANCELAR') return 'cancelar_cotizacion';
  if (PATRONES.agregarACotizacion.test(textoNorm)) return 'agregar_a_cotizacion';
  if (t.toUpperCase() === 'CARRITO' || (PATRONES.carrito.test(textoNorm) && !PATRONES.agregarACotizacion.test(textoNorm))) {
    return 'carrito';
  }
  if (PATRONES.cotizar.test(textoNorm) || t.toUpperCase() === 'COTIZAR') {
    if (t.toUpperCase() !== 'COTIZAR' && /\b(sistema|efaferp|erp|negocio|rubro)\b/i.test(textoNorm)) {
      return 'info_sistema';
    }
    return 'cotizar';
  }
  if (PATRONES.quitar.test(textoNorm)) return 'quitar_carrito';
  if (PATRONES.pedido.test(textoNorm)) return 'pedido';
  if (PATRONES.deuda.test(textoNorm)) return 'deuda';
  if (PATRONES.precio.test(textoNorm)) return 'precio';
  if (PATRONES.stock.test(textoNorm)) return 'stock';
  if (esEstadoPedido(contexto.estado)) return 'pedido_opcion_invalida';
  if (esEstadoCotiz(contexto.estado)) return 'producto';
  return 'producto';
}

/**
 * Hook principal NLU (reglas). Futuro: delegar a LLM si WHATSAPP_BOT_LLM_ENABLED.
 */
function interpretar(mensaje, contexto = {}) {
  const textoNorm = normalizarTexto(mensaje);
  const sinonimosMap = contexto.sinonimosMap || new Map();
  const estado = contexto.estado || 'menu';
  const slots = contexto.slots || {};
  const t = String(mensaje || '').trim();

  // Pistas en slots: mas fiable que el estado persistido si el usuario responde rapido.
  if (slots.productoPendiente && /^\d+([.,]\d+)?$/.test(t)) {
    const cantidad = parseCantidadTexto(t);
    return {
      intencion: 'cantidad',
      terminosBusqueda: [],
      entidades: { cantidad },
      textoNorm
    };
  }
  if (slots.esperandoEntrega && /^\d+$/.test(t)) {
    const n = Number(t);
    let intencionEnt = 'entrega_invalida';
    if (n === 2) intencionEnt = 'entrega_envio';
    else if (n === 1) intencionEnt = 'entrega_recojo';
    return {
      intencion: intencionEnt,
      terminosBusqueda: [],
      entidades: { numero: n },
      textoNorm
    };
  }
  if (slots.esperandoFlayer && /^\d{1,2}$/.test(t)) {
    return {
      intencion: 'flayer_comercial',
      terminosBusqueda: [],
      entidades: { numero: Number(t) },
      textoNorm
    };
  }
  if (slots.esperandoMedioPago && /^\d+$/.test(t)) {
    const n = Number(t);
    return {
      intencion: 'medio_pago',
      terminosBusqueda: [],
      entidades: { numero: n },
      textoNorm
    };
  }
  if (slots.esperandoMedioPago || estado === 'cotiz_medio_pago') {
    const tlow = t.toLowerCase();
    if (/\befectivo\b|\btransfer|\byape\b|\bplin\b|\btarjeta\b|\botro\b|\bcredito\b|\bcrédito\b|\bfiado\b/.test(tlow)) {
      return {
        intencion: 'medio_pago',
        terminosBusqueda: [],
        entidades: {},
        textoNorm
      };
    }
  }

  if (/^\d+$/.test(t) && estado === 'pedido_eligiendo') {
    return {
      intencion: 'seleccion_numero',
      terminosBusqueda: [],
      entidades: { numero: Number(t) },
      textoNorm
    };
  }

  if (estado === 'pedido_opciones') {
    if (PATRONES.menu.test(textoNorm) || t.toUpperCase() === 'MENU') {
      return { intencion: 'menu', terminosBusqueda: [], entidades: {}, textoNorm };
    }
    if (PATRONES.pdfPedido.test(textoNorm) || t.toUpperCase() === 'PDF') {
      return { intencion: 'pdf_pedido', terminosBusqueda: [], entidades: {}, textoNorm };
    }
    if (PATRONES.productosPedido.test(textoNorm) || t.toUpperCase() === 'PRODUCTOS') {
      return { intencion: 'productos_pedido', terminosBusqueda: [], entidades: {}, textoNorm };
    }
  }

  if (/^\d+$/.test(t) && (estado === 'eligiendo_candidato' || estado === 'cotiz_eligiendo')) {
    return {
      intencion: 'seleccion_numero',
      terminosBusqueda: [],
      entidades: { numero: Number(t) },
      textoNorm
    };
  }

  if (/^\d+$/.test(t) && estado === 'cotiz_entrega') {
    const n = Number(t);
    let intencionEnt = 'entrega_invalida';
    if (n === 2) intencionEnt = 'entrega_envio';
    else if (n === 1) intencionEnt = 'entrega_recojo';
    return {
      intencion: intencionEnt,
      terminosBusqueda: [],
      entidades: { numero: n },
      textoNorm
    };
  }

  if (/^\d+$/.test(t) && estado === 'cotiz_medio_pago') {
    return {
      intencion: 'medio_pago',
      terminosBusqueda: [],
      entidades: { numero: Number(t) },
      textoNorm
    };
  }

  if (/^\d+$/.test(t) && estado === 'cotiz_cantidad') {
    return {
      intencion: 'cantidad',
      terminosBusqueda: [],
      entidades: { cantidad: Number(t) },
      textoNorm
    };
  }

  let intencion = detectarIntencion(textoNorm, mensaje, contexto);
  const entidades = { comprobante: extraerComprobante(mensaje) };

  if (/^\d+$/.test(t) && estado === 'menu') {
    const n = Number(t);
    entidades.menuNumero = n;
    if (n === 1) intencion = 'pedido';
    else if (n === 2) intencion = 'deuda';
    else if (n === 3) intencion = 'producto';
    else     if (n === 4) intencion = 'cotizar';
    else if (n === 5) intencion = 'info_sistema';
    else intencion = 'menu_numero';
  }

  if (intencion === 'quitar_carrito') {
    const m = t.match(/\b(\d+)\s*$/);
    if (m) entidades.numero = Number(m[1]);
  }

  let terminos = tokenizar(mensaje);
  terminos = aplicarSinonimos(terminos, sinonimosMap);

  const sinTerminos = [
    'pedido', 'deuda', 'menu', 'hola', 'ping', 'seleccion_numero',
    'cotizar', 'confirmar_cotizacion', 'cancelar_cotizacion', 'carrito',
    'quitar_carrito', 'medio_pago', 'cantidad', 'menu_numero',
    'entrega_recojo', 'entrega_envio', 'entrega_invalida',
    'identidad', 'que_vendes', 'productos_destacados', 'ubicacion', 'contacto',
    'documento_identidad', 'documento_invalido', 'despedida',
    'productos_pedido', 'pdf_pedido', 'pedido_opcion_invalida',
    'solicitar_agente', 'agregar_a_cotizacion',
    'info_sistema', 'planes_saas', 'flayer_comercial', 'soporte_asistente',
    'consulta_comercial', 'agendar_llamada', 'solicitar_demo', 'contratar_plan',
    'duda_pago_registro'
  ];

  if (sinTerminos.includes(intencion)) {
    return { intencion, terminosBusqueda: terminos, entidades, textoNorm };
  }

  if (terminos.length === 0 && ['precio', 'stock', 'producto'].includes(intencion)) {
    return { intencion: 'aclarar_producto', terminosBusqueda: [], entidades, textoNorm };
  }

  return { intencion, terminosBusqueda: terminos, entidades, textoNorm };
}

function parseCantidadTexto(t) {
  const n = Number(String(t || '').trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1000) / 1000;
}

module.exports = { interpretar, detectarIntencion };
