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

const TEXTO_MENU = [
  '*Menu*',
  '1. Mis pedidos',
  '2. Mi deuda',
  '3. Buscar producto',
  '4. Cotizar (armar lista y recibir PDF)',
  '',
  'Tambien puede escribir el nombre del producto o COTIZAR.',
  'Pregunte: QUIEN ERES | QUE VENDES | QUE PRODUCTOS VENDES | DIRECCION | CONTACTO',
  '_Escriba MENU para ver este menu._'
].join('\n');

const TEXTO_PING = 'PONG - Bot activo.';
const TEXTO_NO_ENTIENDO = 'No entendi su consulta. Escriba MENU o el nombre del producto.';
const TEXTO_ACLARAR = 'Indique que producto busca, por ejemplo: pintura latex';
const TEXTO_DESPEDIDA = [
  'Gracias por escribirnos.',
  'Hasta pronto.',
  '',
  'Cuando necesite algo, escriba *MENU*.'
].join('\n');

function formatearProducto(p, idx) {
  const n = idx != null ? `${idx}. ` : '';
  return `${n}*${p.descripcion}* (${p.codigo})\n   Precio: ${formatearPrecio(p.precioLista)} | Stock: ${Number(p.stockTotal || 0)}`;
}

function formatearDetalleProducto(p) {
  return [
    `*${p.descripcion}*`,
    `Codigo: ${p.codigo}`,
    `Precio: ${formatearPrecio(p.precioLista)}`,
    `Stock total: ${Number(p.stockTotal || 0)}`,
    '',
    'Escriba MENU para volver al menu.'
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
      '*Mi deuda*',
      'No registra pedidos pendientes de pago ni creditos activos.',
      '',
      'Escriba MENU para volver.'
    ].join('\n');
  }

  const bloques = ['*Mi deuda*', `Total general: ${formatearPrecio(totalGeneral)}`, ''];

  if (ventasPendientes.length) {
    bloques.push('*Pedidos pendientes de pago:*');
    ventasPendientes.slice(0, 5).forEach((v, i) => {
      const venc = v.fVencimiento ? ` | Vence: ${v.fVencimiento}` : '';
      const etiqueta = v.idEstadoPago === 3 ? 'VENCIDO' : 'PENDIENTE';
      bloques.push(`${i + 1}. ${compVenta(v)} | ${v.fEmision || ''} | ${formatearPrecio(v.total)} | _${etiqueta}_${venc}`);
    });
    if (ventasPendientes.length > 5) {
      bloques.push(`...y ${ventasPendientes.length - 5} mas.`);
    }
    bloques.push(`Subtotal pedidos: ${formatearPrecio(totalVentas)}`);
    bloques.push('');
  } else {
    bloques.push('_Sin pedidos pendientes de pago._');
    bloques.push('');
  }

  if (creditos.length) {
    bloques.push('*Creditos activos:*');
    creditos.slice(0, 5).forEach((c, i) => {
      const comp = c.comprobante || '—';
      bloques.push(`${i + 1}. ${comp} | Saldo: ${formatearPrecio(c.saldoPendiente)}`);
    });
    if (creditos.length > 5) {
      bloques.push(`...y ${creditos.length - 5} mas.`);
    }
    bloques.push(`Subtotal creditos: ${formatearPrecio(totalCreditos)}`);
    bloques.push('');
  } else {
    bloques.push('_Sin creditos activos._');
    bloques.push('');
  }

  bloques.push('Escriba *1* para ver sus pedidos o MENU para volver.');
  return bloques.join('\n');
}

async function buscarYResponder(idEmpresa, terminos, intencion) {
  const { total, items } = await whatsappBotCatalogo.buscar(idEmpresa, terminos, 5);
  if (total === 0) {
    return { texto: 'No encontramos productos con esos terminos. Escriba MENU o intente con mas detalle.', candidatos: [], estado: 'buscando_producto' };
  }
  if (total === 1) {
    return { texto: formatearDetalleProducto(items[0]), candidatos: items, estado: 'menu' };
  }
  const lineas = items.map((p, i) => formatearProducto(p, i + 1));
  const prefijo = intencion === 'precio' ? 'Estos productos coinciden (precio/stock):' : 'Encontre varios productos:';
  return {
    texto: [prefijo, ...lineas, '', 'Responda el numero (1-5) o escriba mas detalle.'].join('\n'),
    candidatos: items,
    estado: 'eligiendo_candidato'
  };
}

async function requiereCliente(config, resCliente) {
  if (resCliente.encontrado) return null;
  if (resCliente.ambiguo) {
    return 'Encontramos mas de un cliente con ese numero. Contacte a la empresa para actualizar sus datos.';
  }
  return config.mensajeNoRegistrado || 'No encontramos su numero registrado.';
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

  if (nlu.intencion === 'despedida') {
    return {
      respuesta: TEXTO_DESPEDIDA,
      conv: { estado: 'menu', slots: {}, candidatos: [] },
      limpiarHistorial: true
    };
  }

  const pedidosTurno = await whatsappBotPedidos.intentarProcesar(ctx, conv, nlu, config, resCliente);
  if (pedidosTurno) {
    return pedidosTurno;
  }

  const cotizacionTurno = await whatsappBotCotizacion.intentarProcesar(ctx, conv, nlu, config, resCliente);
  if (cotizacionTurno) {
    return cotizacionTurno;
  }

  if (whatsappBotIdentidad.INTENCIONES_IDENTIDAD.has(nlu.intencion)) {
    const respuesta = await whatsappBotIdentidad.getRespuesta(idEmpresa, nlu.intencion);
    return { respuesta, conv: { estado: 'menu', slots: {}, candidatos: [] } };
  }

  if (nlu.intencion === 'ping') {
    return { respuesta: TEXTO_PING, conv: { estado: 'menu', slots: {}, candidatos: [] } };
  }

  if (nlu.intencion === 'menu' || nlu.intencion === 'hola') {
    const bienvenida = config.mensajeBienvenida || TEXTO_MENU;
    const respuesta = nlu.intencion === 'hola' ? `${bienvenida}\n\n${TEXTO_MENU}` : TEXTO_MENU;
    return { respuesta, conv: { estado: 'menu', slots: {}, candidatos: [] } };
  }

  if (conv.estado === 'eligiendo_candidato' && nlu.intencion === 'seleccion_numero') {
    const idx = Number(nlu.entidades.numero) - 1;
    const candidatos = conv.candidatos || [];
    if (idx >= 0 && idx < candidatos.length) {
      return {
        respuesta: formatearDetalleProducto(candidatos[idx]),
        conv: { estado: 'menu', slots: {}, candidatos: [] }
      };
    }
    return { respuesta: 'Opcion invalida. Responda un numero de la lista o escriba MENU.', conv };
  }

  if (nlu.intencion === 'deuda') {
    const msg = await requiereCliente(config, resCliente);
    if (msg) return { respuesta: msg, conv: { estado: 'menu', slots: {}, candidatos: [] } };
    const respuesta = await resumenDeuda(idEmpresa, resCliente.cliente.idCliente);
    return { respuesta, conv: { estado: 'menu', slots: {}, candidatos: [] } };
  }

  if (nlu.intencion === 'aclarar_producto') {
    return { respuesta: TEXTO_ACLARAR, conv: { estado: 'buscando_producto', slots: {}, candidatos: [] } };
  }

  if (['producto', 'precio', 'stock'].includes(nlu.intencion) && nlu.terminosBusqueda.length > 0) {
    const r = await buscarYResponder(idEmpresa, nlu.terminosBusqueda, nlu.intencion);
    return { respuesta: r.texto, conv: { estado: r.estado, slots: {}, candidatos: r.candidatos } };
  }

  if (conv.estado === 'buscando_producto' && nlu.terminosBusqueda.length > 0) {
    const r = await buscarYResponder(idEmpresa, nlu.terminosBusqueda, 'producto');
    return { respuesta: r.texto, conv: { estado: r.estado, slots: {}, candidatos: r.candidatos } };
  }

  return { respuesta: TEXTO_NO_ENTIENDO, conv: { estado: conv.estado || 'menu', slots: conv.slots || {}, candidatos: conv.candidatos || [] } };
}

async function persistirConversacion(idEmpresa, telefonoLog, conv) {
  await withPool((pool) =>
    whatsappBotConversacionRepository.guardar(pool, idEmpresa, telefonoLog, conv)
  );
}

module.exports = {
  procesarTurno,
  persistirConversacion,
  TEXTO_MENU
};
