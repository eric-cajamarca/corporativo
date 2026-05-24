const { withPool } = require('../utils/dbPool.util');
const whatsappBotNlu = require('./whatsappBotNlu.service');
const whatsappBotCatalogo = require('./whatsappBotCatalogo.service');
const whatsappBotCliente = require('./whatsappBotCliente.service');
const whatsappBotConversacionRepository = require('../repositories/whatsappBotConversacion.repository');
const whatsappBotConsultasRepository = require('../repositories/whatsappBotConsultas.repository');
const whatsappBotSinonimoRepository = require('../repositories/whatsappBotSinonimo.repository');
const whatsappBotCotizacion = require('./whatsappBotCotizacion.service');
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

async function listarPedidos(idEmpresa, idCliente) {
  const pedidos = await withPool((pool) =>
    whatsappBotConsultasRepository.listarPedidosRecientes(pool, idEmpresa, idCliente, 5)
  );
  if (!pedidos.length) {
    return 'No encontramos pedidos recientes a su nombre.';
  }
  const lineas = pedidos.map((p, i) => {
    const comp = `${p.serie || ''}-${p.numero || ''}`.replace(/^-/, '');
    return `${i + 1}. ${comp} | ${p.fEmision || ''} | ${formatearPrecio(p.total)} | ${p.estadoPedido || '—'}`;
  });
  return ['*Sus ultimos pedidos:*', ...lineas, '', 'Escriba MENU para volver.'].join('\n');
}

async function resumenDeuda(idEmpresa, idCliente) {
  const { creditos, saldoTotal } = await withPool((pool) =>
    whatsappBotConsultasRepository.resumenDeudaCliente(pool, idEmpresa, idCliente)
  );
  if (!creditos.length) {
    return 'No registra creditos activos.';
  }
  const lineas = creditos.slice(0, 5).map((c, i) => {
    const comp = c.comprobante || '—';
    return `${i + 1}. ${comp} | Saldo: ${formatearPrecio(c.saldoPendiente)}`;
  });
  return [
    '*Resumen de deuda:*',
    `Total pendiente: ${formatearPrecio(saldoTotal)}`,
    ...lineas,
    '',
    'Escriba MENU para volver.'
  ].join('\n');
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

async function procesarTurno(ctx) {
  const { idEmpresa, telefonoLog, textoEntrada, config } = ctx;
  const sinonimosMap = await withPool((pool) => whatsappBotSinonimoRepository.mapaPorEmpresa(pool, idEmpresa));

  let conv = await withPool((pool) =>
    whatsappBotConversacionRepository.obtener(pool, idEmpresa, telefonoLog)
  );
  if (!conv) {
    await withPool((pool) => whatsappBotConversacionRepository.reiniciar(pool, idEmpresa, telefonoLog));
    conv = { estado: 'menu', slots: {}, candidatos: [] };
  }

  const nlu = whatsappBotNlu.interpretar(textoEntrada, {
    estado: conv.estado,
    sinonimosMap
  });

  const resCliente = await whatsappBotCliente.resolverCliente(idEmpresa, ctx.digitosCelular);

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

  if (nlu.intencion === 'pedido' || (conv.estado === 'menu' && nlu.intencion === 'pedido')) {
    const msg = await requiereCliente(config, resCliente);
    if (msg) return { respuesta: msg, conv: { estado: 'menu', slots: {}, candidatos: [] } };
    const respuesta = await listarPedidos(idEmpresa, resCliente.cliente.idCliente);
    return { respuesta, conv: { estado: 'menu', slots: {}, candidatos: [] } };
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
