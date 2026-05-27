const { withPool } = require('../utils/dbPool.util');
const whatsappBotNlu = require('./whatsappBotNlu.service');
const whatsappBotCatalogo = require('./whatsappBotCatalogo.service');
const whatsappBotCliente = require('./whatsappBotCliente.service');
const whatsappBotConversacionRepository = require('../repositories/whatsappBotConversacion.repository');
const whatsappBotConsultasRepository = require('../repositories/whatsappBotConsultas.repository');
const whatsappBotSinonimoRepository = require('../repositories/whatsappBotSinonimo.repository');
const whatsappBotCotizacion = require('./whatsappBotCotizacion.service');
const whatsappBotPedidos = require('./whatsappBotPedidos.service');
const whatsappBotIdentidad = require('./whatsappBotIdentidad.service');
const { formatearPrecio } = require('../utils/whatsappBotTexto.util');
const copy = require('./whatsappBot.copy');

const TEXTO_MENU_BASE = [
  '*Menú*',
  '1. Mis pedidos',
  '2. Mi deuda',
  '3. Buscar producto',
  '4. Cotizar (armar lista y recibir PDF)',
  '',
  'También puedes escribir el nombre del producto o *COTIZAR*.',
  'Pregúntame: *QUIÉN ERES* | *QUÉ VENDES* | *QUÉ PRODUCTOS VENDES* | *DIRECCIÓN* | *CONTACTO*'
].join('\n');

const TEXTO_PING = '¡Aquí estoy! Todo en orden. ¿En qué te puedo ayudar?';

function formatearProducto(p, idx) {
  const n = idx != null ? `${idx}. ` : '';
  return `${n}*${p.descripcion}* (${p.codigo})\n   Precio: ${formatearPrecio(p.precioLista)} | Stock: ${Number(p.stockTotal || 0)}`;
}

function formatearDetalleProducto(p) {
  return [
    `*${p.descripcion}*`,
    `Código: ${p.codigo}`,
    `Precio: ${formatearPrecio(p.precioLista)}`,
    `Stock disponible: ${Number(p.stockTotal || 0)}`
  ].join('\n');
}

function compVenta(v) {
  return `${v.serie || ''}-${v.numero || ''}`.replace(/^-/, '');
}

async function resumenDeuda(idEmpresa, idCliente) {
  const [{ creditos, saldoTotal }, ventasPendientes] = await withPool((pool) =>
    Promise.all([
      whatsappBotConsultasRepository.resumenDeudaCliente(pool, idEmpresa, idCliente),
      whatsappBotConsultasRepository.listarVentasPendientesPago(pool, idEmpresa, idCliente)
    ])
  );

  const totalVentas = ventasPendientes.reduce((s, v) => s + Number(v.total || 0), 0);
  const totalCreditos = Number(saldoTotal || 0);
  const totalGeneral = totalVentas + totalCreditos;

  if (!ventasPendientes.length && !creditos.length) {
    return [
      '*Tu deuda*',
      'No tienes pedidos pendientes de pago ni créditos activos. ✅'
    ].join('\n');
  }

  const bloques = ['*Tu deuda*', `Total general: ${formatearPrecio(totalGeneral)}`, ''];

  if (ventasPendientes.length) {
    bloques.push('*Pedidos pendientes de pago:*');
    ventasPendientes.slice(0, 5).forEach((v, i) => {
      const venc = v.fVencimiento ? ` | Vence: ${v.fVencimiento}` : '';
      const etiqueta = v.idEstadoPago === 3 ? 'VENCIDO' : 'PENDIENTE';
      bloques.push(`${i + 1}. ${compVenta(v)} | ${v.fEmision || ''} | ${formatearPrecio(v.total)} | _${etiqueta}_${venc}`);
    });
    if (ventasPendientes.length > 5) {
      bloques.push(`…y ${ventasPendientes.length - 5} más.`);
    }
    bloques.push(`Subtotal pedidos: ${formatearPrecio(totalVentas)}`);
    bloques.push('');
  } else {
    bloques.push('_Sin pedidos pendientes de pago._');
    bloques.push('');
  }

  if (creditos.length) {
    bloques.push('*Créditos activos:*');
    creditos.slice(0, 5).forEach((c, i) => {
      const comp = c.comprobante || '—';
      bloques.push(`${i + 1}. ${comp} | Saldo: ${formatearPrecio(c.saldoPendiente)}`);
    });
    if (creditos.length > 5) {
      bloques.push(`…y ${creditos.length - 5} más.`);
    }
    bloques.push(`Subtotal créditos: ${formatearPrecio(totalCreditos)}`);
    bloques.push('');
  } else {
    bloques.push('_Sin créditos activos._');
    bloques.push('');
  }

  bloques.push('Escribe *1* para ver tus pedidos.');
  return bloques.join('\n');
}

/**
 * Busca productos y arma la respuesta. Devuelve estado para guardar en conv.slots.ultimaBusqueda.
 */
async function buscarYResponder(idEmpresa, terminos, intencion) {
  const { total, items } = await whatsappBotCatalogo.buscar(idEmpresa, terminos, 5);
  if (total === 0) {
    return {
      texto: copy.v('noEncontrado'),
      candidatos: [],
      estado: 'buscando_producto',
      ultimaBusqueda: null
    };
  }
  if (total === 1) {
    return {
      texto: formatearDetalleProducto(items[0]),
      candidatos: items,
      estado: 'menu',
      ultimaBusqueda: { terminos, candidatos: items, intencion }
    };
  }
  const lineas = items.map((p, i) => formatearProducto(p, i + 1));
  const prefijo = intencion === 'precio'
    ? 'Estos productos coinciden (con precio y stock):'
    : 'Encontré varios productos que pueden interesarte:';
  return {
    texto: [prefijo, '', ...lineas, '', 'Responde el número (1-5) para ver el detalle, o escríbeme con más detalle.'].join('\n'),
    candidatos: items,
    estado: 'eligiendo_candidato',
    ultimaBusqueda: { terminos, candidatos: items, intencion }
  };
}

async function requiereCliente(config, resCliente) {
  if (resCliente.encontrado) return null;
  if (resCliente.ambiguo) {
    return 'Encontramos más de un cliente con tu número. Por favor contacta a la empresa para actualizar tus datos.';
  }
  return config.mensajeNoRegistrado || 'No encontramos tu número registrado.';
}

/**
 * Conserva slots utiles entre turnos (memoria a corto plazo, sin IA).
 *  - ultimaBusqueda: tokens + candidatos del ultimo producto preguntado.
 *  - ultimoCandidato: si hubo seleccion N de una lista, guarda el item.
 * Permite que "¿y el precio?" tras "taladro" no caiga en aclarar_producto.
 */
function conservarMemoria(prevSlots, nuevoEstado, nuevosSlots = {}) {
  const out = { ...nuevosSlots };
  if (prevSlots?.ultimaBusqueda && !out.ultimaBusqueda) {
    out.ultimaBusqueda = prevSlots.ultimaBusqueda;
  }
  return out;
}

async function procesarTurno(ctx, precarga = null) {
  const { idEmpresa, telefonoLog, textoEntrada, config } = ctx;
  const sinonimosMap =
    precarga?.sinonimosMap ??
    (await withPool((pool) => whatsappBotSinonimoRepository.mapaPorEmpresa(pool, idEmpresa)));

  let conv = precarga?.conv;
  if (!conv) {
    conv = await withPool((pool) =>
      whatsappBotConversacionRepository.obtener(pool, idEmpresa, telefonoLog)
    );
    if (!conv) {
      conv = { estado: 'menu', slots: {}, candidatos: [] };
    }
  }

  const nlu = whatsappBotNlu.interpretar(textoEntrada, {
    estado: conv.estado,
    sinonimosMap
  });

  const resCliente =
    precarga?.resCliente ?? (await whatsappBotCliente.resolverCliente(idEmpresa, ctx.digitosCelular));
  const nombreClienteCorto = copy.nombreCorto(resCliente?.cliente?.rSocial);
  const reaccion = copy.reaccionPorIntencion(nlu.intencion);

  if (nlu.intencion === 'despedida') {
    return {
      respuesta: copy.v('despedida'),
      conv: { estado: 'menu', slots: {}, candidatos: [] },
      limpiarHistorial: true,
      reaccion
    };
  }

  const pedidosTurno = await whatsappBotPedidos.intentarProcesar(ctx, conv, nlu, config, resCliente);
  if (pedidosTurno) {
    if (!pedidosTurno.reaccion && reaccion) pedidosTurno.reaccion = reaccion;
    return pedidosTurno;
  }

  const cotizacionTurno = await whatsappBotCotizacion.intentarProcesar(ctx, conv, nlu, config, resCliente);
  if (cotizacionTurno) {
    if (!cotizacionTurno.reaccion && reaccion) cotizacionTurno.reaccion = reaccion;
    return cotizacionTurno;
  }

  if (whatsappBotIdentidad.INTENCIONES_IDENTIDAD.has(nlu.intencion)) {
    const respuesta = await whatsappBotIdentidad.getRespuesta(idEmpresa, nlu.intencion);
    return {
      respuesta,
      conv: { estado: 'menu', slots: conservarMemoria(conv.slots), candidatos: [] },
      reaccion
    };
  }

  if (nlu.intencion === 'ping') {
    return {
      respuesta: TEXTO_PING,
      conv: { estado: 'menu', slots: conservarMemoria(conv.slots), candidatos: [] }
    };
  }

  if (nlu.intencion === 'menu' || nlu.intencion === 'hola') {
    if (nlu.intencion === 'hola') {
      const burbujas = [];
      const saludo = copy.saludoPersonalizado(resCliente?.cliente?.rSocial);
      burbujas.push(saludo);
      const bienvenida = config.mensajeBienvenida && config.mensajeBienvenida.trim();
      if (bienvenida && !/menú|menu/i.test(bienvenida)) {
        burbujas.push(bienvenida);
      }
      burbujas.push(TEXTO_MENU_BASE);
      return {
        respuesta: burbujas,
        conv: { estado: 'menu', slots: conservarMemoria(conv.slots), candidatos: [] },
        reaccion
      };
    }
    return {
      respuesta: TEXTO_MENU_BASE,
      conv: { estado: 'menu', slots: conservarMemoria(conv.slots), candidatos: [] },
      reaccion
    };
  }

  if (conv.estado === 'eligiendo_candidato' && nlu.intencion === 'seleccion_numero') {
    const idx = Number(nlu.entidades.numero) - 1;
    const candidatos = conv.candidatos || [];
    if (idx >= 0 && idx < candidatos.length) {
      const elegido = candidatos[idx];
      const slots = conservarMemoria(conv.slots, 'menu', { ultimoCandidato: elegido });
      return {
        respuesta: formatearDetalleProducto(elegido),
        conv: { estado: 'menu', slots, candidatos: [] }
      };
    }
    return { respuesta: copy.v('opcionInvalida'), conv };
  }

  if (nlu.intencion === 'deuda') {
    const msg = await requiereCliente(config, resCliente);
    if (msg) return { respuesta: msg, conv: { estado: 'menu', slots: {}, candidatos: [] } };
    const respuesta = await resumenDeuda(idEmpresa, resCliente.cliente.idCliente);
    return {
      respuesta,
      conv: { estado: 'menu', slots: conservarMemoria(conv.slots), candidatos: [] },
      reaccion
    };
  }

  // aclarar_producto: si hay memoria de la ultima busqueda, reusarla en lugar
  // de pedir al usuario que repita. "¿y el precio?" tras "taladro" funciona.
  if (nlu.intencion === 'aclarar_producto') {
    const ult = conv.slots?.ultimaBusqueda;
    if (ult && Array.isArray(ult.candidatos) && ult.candidatos.length > 0) {
      const r = await buscarYResponder(idEmpresa, ult.terminos, nlu.intencion === 'aclarar_producto' ? 'precio' : nlu.intencion);
      const slots = conservarMemoria(conv.slots, r.estado, { ultimaBusqueda: r.ultimaBusqueda });
      return {
        respuesta: r.texto,
        conv: { estado: r.estado, slots, candidatos: r.candidatos },
        reaccion: '🔍'
      };
    }
    return {
      respuesta: copy.v('aclararProducto'),
      conv: { estado: 'buscando_producto', slots: conservarMemoria(conv.slots), candidatos: [] }
    };
  }

  if (['producto', 'precio', 'stock'].includes(nlu.intencion) && nlu.terminosBusqueda.length > 0) {
    const r = await buscarYResponder(idEmpresa, nlu.terminosBusqueda, nlu.intencion);
    const slots = conservarMemoria(conv.slots, r.estado, { ultimaBusqueda: r.ultimaBusqueda });
    return {
      respuesta: r.texto,
      conv: { estado: r.estado, slots, candidatos: r.candidatos },
      reaccion: '🔍'
    };
  }

  if (conv.estado === 'buscando_producto' && nlu.terminosBusqueda.length > 0) {
    const r = await buscarYResponder(idEmpresa, nlu.terminosBusqueda, 'producto');
    const slots = conservarMemoria(conv.slots, r.estado, { ultimaBusqueda: r.ultimaBusqueda });
    return {
      respuesta: r.texto,
      conv: { estado: r.estado, slots, candidatos: r.candidatos },
      reaccion: '🔍'
    };
  }

  return {
    respuesta: copy.v('noEntendi'),
    conv: {
      estado: conv.estado || 'menu',
      slots: conservarMemoria(conv.slots, conv.estado, conv.slots || {}),
      candidatos: conv.candidatos || []
    },
    reaccion: '🤔'
  };
}

async function persistirConversacion(idEmpresa, telefonoLog, conv) {
  await withPool((pool) =>
    whatsappBotConversacionRepository.guardar(pool, idEmpresa, telefonoLog, conv)
  );
}

module.exports = {
  procesarTurno,
  persistirConversacion,
  TEXTO_MENU: TEXTO_MENU_BASE
};
