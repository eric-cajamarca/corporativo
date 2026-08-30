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
const whatsappBotEscalamiento = require('./whatsappBotEscalamiento.service');
const whatsappBotComercial = require('./whatsappBotComercial.service');
const whatsappBotLogRepository = require('../repositories/whatsappBotLog.repository');
const { formatearPrecio } = require('../utils/whatsappBotTexto.util');
const copy = require('./whatsappBot.copy');
const { trace } = require('../utils/whatsappBotTrace.util');

const TEXTO_MENU_BASE = [
  '*Menú*',
  '1. Mis pedidos',
  '2. Mi deuda',
  '3. Buscar producto',
  '4. Hacer un pedido',
  '',
  'También puedes escribir el nombre del producto, *COTIZAR* o *CONFIRMAR* para pedir.',
  'Pregúntame: *QUIÉN ERES* | *QUÉ VENDES* | *QUÉ PRODUCTOS VENDES* | *DIRECCIÓN* | *CONTACTO*'
].join('\n');

const TEXTO_PING = '¡Aquí estoy! Todo en orden. ¿En qué te puedo ayudar?';

function textoMenu(esPrincipal) {
  if (esPrincipal) {
    return whatsappBotComercial.textoMenu(TEXTO_MENU_BASE);
  }
  return TEXTO_MENU_BASE;
}

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
  const limite = whatsappBotCatalogo.LIMITE_OPCIONES_CHAT;
  const { totalEncontrados, hayMas, items } = await whatsappBotCatalogo.buscar(idEmpresa, terminos, limite);
  if (!items.length) {
    return {
      texto: copy.v('noEncontrado'),
      candidatos: [],
      estado: 'buscando_producto',
      ultimaBusqueda: null
    };
  }
  if (items.length === 1) {
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
  const pie = [`Responde el número (1-${items.length}) para ver el detalle, o escribe una búsqueda más específica.`];
  if (hayMas) {
    pie.unshift(
      `Hay *${totalEncontrados}* coincidencias. Te muestro las *${items.length}* más relevantes; agrega marca, código o modelo para afinar.`
    );
  }
  return {
    texto: [prefijo, '', ...lineas, '', ...pie].join('\n'),
    candidatos: items,
    estado: 'eligiendo_candidato',
    ultimaBusqueda: { terminos, candidatos: items, intencion }
  };
}

function clienteIdentificado(resCliente) {
  return Boolean(resCliente?.encontrado && resCliente?.cliente?.idCliente);
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
  conv = whatsappBotEscalamiento.limpiarEscaladaExpirada(conv);

  if (ctx.adjuntoEntrada?.base64) {
    const msgArchivo =
      (config.mensajeArchivosNoPermitidos && String(config.mensajeArchivosNoPermitidos).trim()) ||
      'Por seguridad no aceptamos archivos adjuntos (Excel, PDF u otros documentos). Escribe el nombre del producto o escribe *MENÚ*.';
    return {
      respuesta: msgArchivo,
      conv: { estado: conv.estado || 'menu', slots: conservarMemoria(conv.slots), candidatos: [] },
      reaccion: '🛡️'
    };
  }

  const nlu = whatsappBotNlu.interpretar(textoEntrada, {
    estado: conv.estado,
    sinonimosMap,
    slots: conv.slots || {}
  });

  const resCliente =
    precarga?.resCliente ?? (await whatsappBotCliente.resolverCliente(idEmpresa, ctx.digitosCelular));
  const nombreClienteCorto = copy.nombreCorto(resCliente?.cliente?.rSocial);
  const reaccion = copy.reaccionPorIntencion(nlu.intencion);
  const esPrincipal = await whatsappBotComercial.esEmpresaPrincipal(idEmpresa);
  trace('2.NLU_BACKEND', {
    intencion: nlu.intencion,
    estado: conv.estado,
    esPrincipal,
    cliente: resCliente?.encontrado ? 'registrado' : 'no_registrado'
  });
  trace('3.CONSULTA_BACKEND', {
    empresaPrincipal: esPrincipal,
    convEstado: conv.estado,
    slotsComercial: Boolean(conv.slots?.comercial)
  });

  // -----------------------------------------------------------------------
  // Fase 3: si la conversacion esta escalada a un humano, el bot guarda
  // silencio salvo que el cliente pida volver con MENU explicitamente.
  // -----------------------------------------------------------------------
  if (whatsappBotEscalamiento.estaEscalada(conv)) {
    // MENU, hola o ping: el cliente quiere retomar el bot (no solo la palabra MENU).
    if (nlu.intencion === 'menu' || nlu.intencion === 'hola' || nlu.intencion === 'ping') {
      const desesc = whatsappBotEscalamiento.desescalar(conv);
      const burbujas = [];
      if (nlu.intencion === 'hola') {
        burbujas.push(copy.saludoPersonalizado(resCliente?.cliente?.rSocial));
      }
      if (nlu.intencion === 'ping') {
        burbujas.push(TEXTO_PING);
      } else {
        burbujas.push(copy.pick(copy.VARIANTES.escalamiento.desescaladoManual));
      }
      burbujas.push(textoMenu(esPrincipal));
      return {
        respuesta: burbujas.filter(Boolean),
        conv: desesc,
        reaccion: '✅'
      };
    }
    // Cualquier otro mensaje: silencio para no interferir con el asesor humano.
    return { respuesta: null, conv, suprimirRespuesta: true };
  }

  // Si el cliente solicita explicitamente un agente humano.
  if (nlu.intencion === 'solicitar_agente' && config.escalamientoActivo !== false) {
    return iniciarEscalamiento(ctx, conv, config, resCliente, 'cliente');
  }

  // Si esta en estado 'ofreciendo_agente' y responde si/no.
  if (conv.slots?.ofreciendoAgente) {
    const t = String(textoEntrada || '').trim().toLowerCase();
    const esSi = /^(si|sí|sip|claro|por favor|ok|okay|dale|bueno|de acuerdo|deseo|quiero)\b/i.test(t);
    const esNo = /^(no|nop|nope|negativo|todavia no|aun no|prefiero no|gracias no)\b/i.test(t);
    if (esSi) {
      return iniciarEscalamiento(ctx, conv, config, resCliente, 'umbral');
    }
    if (esNo) {
      const slots = { ...(conv.slots || {}) };
      delete slots.ofreciendoAgente;
      slots.noEntiendoConsecutivos = 0;
      return {
        respuesta: copy.pick(copy.VARIANTES.escalamiento.rechazaAgente),
        conv: { estado: 'menu', slots, candidatos: [] }
      };
    }
    // Si no respondio si/no claro, dejamos que el flujo continue normal pero
    // limpiamos el flag para no quedarnos atascados en la oferta.
    const slots = { ...(conv.slots || {}) };
    delete slots.ofreciendoAgente;
    conv = { ...conv, slots };
  }

  if (nlu.intencion === 'despedida') {
    const textoDespedida = config.mensajeDespedida && String(config.mensajeDespedida).trim() !== ''
      ? String(config.mensajeDespedida).trim()
      : copy.v('despedida');
    return {
      respuesta: textoDespedida,
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

  const comercialTurno = await whatsappBotComercial.intentarProcesar(idEmpresa, conv, nlu, textoEntrada, ctx);
  if (comercialTurno) {
    if (!comercialTurno.reaccion && reaccion) comercialTurno.reaccion = reaccion;
    return comercialTurno;
  }
  if (whatsappBotComercial.INTENCIONES.has(nlu.intencion) && !esPrincipal) {
    return {
      respuesta: textoMenu(esPrincipal),
      conv: { estado: 'menu', slots: conservarMemoria(conv.slots), candidatos: [] },
      reaccion
    };
  }

  if (whatsappBotIdentidad.INTENCIONES_IDENTIDAD.has(nlu.intencion)) {
    const respuesta = await whatsappBotIdentidad.getRespuesta(idEmpresa, nlu.intencion);
    if (esPrincipal && nlu.intencion === 'que_vendes') {
      return {
        respuesta: [whatsappBotComercial.textoQueVendesPrincipal, respuesta],
        conv: { estado: 'menu', slots: conservarMemoria(conv.slots), candidatos: [] },
        reaccion
      };
    }
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
      const nombreEmpresa = await whatsappBotIdentidad.obtenerNombreEmpresa(idEmpresa);
      burbujas.push(copy.presentacionVendedor(nombreEmpresa, resCliente?.cliente?.rSocial));
      const bienvenida = config.mensajeBienvenida && config.mensajeBienvenida.trim();
      if (bienvenida && !/menú|menu/i.test(bienvenida) && !/asistente de ventas/i.test(bienvenida)) {
        burbujas.push(bienvenida);
      }
      if (esPrincipal) {
        burbujas.push(whatsappBotComercial.textoHolaExtra);
      }
      burbujas.push(textoMenu(esPrincipal));
      return {
        respuesta: burbujas,
        conv: { estado: 'menu', slots: conservarMemoria(conv.slots), candidatos: [] },
        reaccion
      };
    }
    return {
      respuesta: textoMenu(esPrincipal),
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
    if (!clienteIdentificado(resCliente)) {
      return {
        respuesta: ['*Tu deuda*', 'No tienes pedidos pendientes de pago ni créditos activos. ✅'].join('\n'),
        conv: { estado: 'menu', slots: conservarMemoria(conv.slots), candidatos: [] },
        reaccion
      };
    }
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
    const ejemplo = await whatsappBotIdentidad.obtenerNombreProductoEjemplo(idEmpresa);
    const desdeMenuBuscar = Number(nlu.entidades?.menuNumero) === 3;
    return {
      respuesta: desdeMenuBuscar
        ? copy.mensajeBuscarProductoMenu(ejemplo)
        : copy.mensajeAclararProducto(ejemplo),
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

  return manejarNoEntendi(ctx, conv, config);
}

/**
 * Fallback "no entendí" con escalamiento automático cuando se alcanza el umbral.
 */
function manejarNoEntendi(ctx, conv, config) {
  const slotsBase = conservarMemoria(conv.slots, conv.estado, conv.slots || {});
  const umbral = Number(config?.umbralNoEntiendoEscalar) || 0;
  const escalamientoActivo = config?.escalamientoActivo !== false;
  const numeroVendedor = whatsappBotEscalamiento.resolverNumeroVendedor(
    config,
    ctx.telefonoVinculadoBot
  );
  const previo = Number(slotsBase.noEntiendoConsecutivos || 0);
  const siguiente = previo + 1;

  if (escalamientoActivo && umbral > 0 && siguiente >= umbral && numeroVendedor) {
    const slots = { ...slotsBase, noEntiendoConsecutivos: 0, ofreciendoAgente: true };
    return {
      respuesta: copy.pick(copy.VARIANTES.escalamiento.ofrecerAgente),
      conv: { estado: 'ofreciendo_agente', slots, candidatos: [] },
      reaccion: '🙋'
    };
  }

  return {
    respuesta: copy.v('noEntendi'),
    conv: {
      estado: conv.estado || 'menu',
      slots: { ...slotsBase, noEntiendoConsecutivos: siguiente },
      candidatos: conv.candidatos || []
    },
    reaccion: '🤔'
  };
}

/**
 * Marca la conversacion como escalada y notifica al vendedor por WhatsApp.
 * Persiste el contexto y devuelve la respuesta de confirmacion al cliente.
 */
async function iniciarEscalamiento(ctx, conv, config, resCliente, motivo) {
  const numeroVendedor = whatsappBotEscalamiento.resolverNumeroVendedor(
    config,
    ctx.telefonoVinculadoBot
  );

  if (!numeroVendedor) {
    // Sin numero configurado, fallback graceful: respondemos como "no entendí" + aviso.
    return {
      respuesta: 'Por ahora no podemos derivarte con un asesor humano (no hay vendedor disponible). Sigamos por aquí: escribe *MENÚ* o cuéntame lo que necesitas.',
      conv: { estado: 'menu', slots: conservarMemoria(conv.slots), candidatos: [] }
    };
  }

  const timeoutMin = Math.max(1, Math.min(1440, Number(config?.escalamientoTimeoutMin) || 60));

  // Snapshot reciente de mensajes para que el vendedor tenga contexto.
  let ultimosMensajes = [];
  try {
    ultimosMensajes = await withPool((pool) =>
      whatsappBotLogRepository.listarPorTelefono(pool, ctx.idEmpresa, ctx.telefonoLog, 6)
    );
  } catch (e) {
    // Si el repo no expone listarPorTelefono o falla, seguimos igual.
  }

  // Notificacion best-effort al vendedor (no bloqueante para la respuesta del bot).
  whatsappBotEscalamiento.notificarVendedor(ctx.idEmpresa, {
    numeroVendedor,
    telefonoCliente: ctx.telefonoLog,
    nombreCliente: copy.nombreCorto(resCliente?.cliente?.rSocial),
    motivo,
    ultimosMensajes,
    minutosBloqueo: timeoutMin
  }).catch((err) => {
    console.error('whatsappBotDialogo iniciarEscalamiento notificar:', err.message);
  });

  const nueva = whatsappBotEscalamiento.marcarEscalada(conv, {
    timeoutMin,
    motivo,
    numeroVendedor
  });

  return {
    respuesta: copy.pick(copy.VARIANTES.escalamiento.confirmaEscalada),
    conv: nueva,
    reaccion: '🙋'
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
