const { normalizarTexto, tokenizar, extraerComprobante } = require('../utils/whatsappBotTexto.util');

const PATRONES = {
  menu: /\b(menu|ayuda|inicio|opciones)\b/i,
  hola: /\b(hola|buenos dias|buenas tardes|buenas noches|saludos)\b/i,
  ping: /\bping\b/i,
  pedido: /\b(pedido|pedidos|mis pedidos|mi pedido|orden|ordenes)\b/i,
  deuda: /\b(deuda|debo|saldo|credito|creditos|cuanto debo|pendiente de pago)\b/i,
  stock: /\b(stock|disponible|disponibilidad|hay|tienen|queda|quedan|existencia)\b/i,
  precio: /\b(precio|precios|cuanto cuesta|cuanto cuestan|valor|vale)\b/i,
  cotizar: /\b(cotizar|cotizacion|cotizaciones|presupuesto|presupuestar)\b/i,
  confirmar: /\b(confirmar|confirmo|finalizar|enviar cotizacion|registrar cotizacion)\b/i,
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

  if (PATRONES.ping.test(textoNorm)) return 'ping';
  if (PATRONES.solicitarAgente.test(textoNorm)) return 'solicitar_agente';
  if (PATRONES.menu.test(textoNorm)) return 'menu';
  if (PATRONES.hola.test(textoNorm)) return 'hola';
  if (PATRONES.despedida.test(textoNorm)) return 'despedida';

  const identidad = detectarIdentidad(textoNorm, t);
  if (identidad && !esEstadoCotiz(contexto.estado)) return identidad;

  if (PATRONES.confirmar.test(textoNorm) || t.toUpperCase() === 'CONFIRMAR') return 'confirmar_cotizacion';
  if (PATRONES.cancelar.test(textoNorm) || t.toUpperCase() === 'CANCELAR') return 'cancelar_cotizacion';
  if (PATRONES.carrito.test(textoNorm) || t.toUpperCase() === 'CARRITO') return 'carrito';
  if (PATRONES.cotizar.test(textoNorm) || t.toUpperCase() === 'COTIZAR') return 'cotizar';
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
  const t = String(mensaje || '').trim();

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
    else if (n === 4) intencion = 'cotizar';
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
    'identidad', 'que_vendes', 'productos_destacados', 'ubicacion', 'contacto',
    'documento_identidad', 'documento_invalido', 'despedida',
    'productos_pedido', 'pdf_pedido', 'pedido_opcion_invalida',
    'solicitar_agente'
  ];

  if (sinTerminos.includes(intencion)) {
    return { intencion, terminosBusqueda: terminos, entidades, textoNorm };
  }

  if (terminos.length === 0 && ['precio', 'stock', 'producto'].includes(intencion)) {
    return { intencion: 'aclarar_producto', terminosBusqueda: [], entidades, textoNorm };
  }

  return { intencion, terminosBusqueda: terminos, entidades, textoNorm };
}

module.exports = { interpretar, detectarIntencion };
