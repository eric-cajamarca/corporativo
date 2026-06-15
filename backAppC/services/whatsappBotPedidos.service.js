const { withPool } = require('../utils/dbPool.util');
const whatsappBotConsultasRepository = require('../repositories/whatsappBotConsultas.repository');
const ventasRepository = require('../repositories/ventas.repository');
const pdfBackendClient = require('./pdfBackend.client');
const { numeroALetras } = require('../utils/numeroALetras.util');
const { formatearPrecio } = require('../utils/whatsappBotTexto.util');
const copy = require('./whatsappBot.copy');
const { getFechaHoyApp } = require('../utils/fechaDisplay.util');

const PEDIDOS_TOP = 5;
const PDF_MAX_DIA = parseInt(process.env.WHATSAPP_BOT_PEDIDO_PDF_MAX_DIA, 10) || 3;
const pdfPedidosPorDia = new Map();

function esEstadoPedido(estado) {
  return String(estado || '').startsWith('pedido_');
}

function compPedido(p) {
  return `${p.serie || ''}-${p.numero || ''}`.replace(/^-/, '');
}

function clavePdfDia(idEmpresa, telefonoLog) {
  return `${String(idEmpresa).toLowerCase()}:${telefonoLog}:${getFechaHoyApp()}`;
}

function puedeEnviarPdfPedido(idEmpresa, telefonoLog) {
  const n = pdfPedidosPorDia.get(clavePdfDia(idEmpresa, telefonoLog)) || 0;
  return n < PDF_MAX_DIA;
}

function registrarPdfPedido(idEmpresa, telefonoLog) {
  const key = clavePdfDia(idEmpresa, telefonoLog);
  pdfPedidosPorDia.set(key, (pdfPedidosPorDia.get(key) || 0) + 1);
}

function requiereCliente(config, resCliente) {
  if (resCliente.encontrado) return null;
  if (resCliente.ambiguo) {
    return 'Encontramos más de un cliente con tu número. Por favor contacta a la empresa para actualizar tus datos.';
  }
  return config.mensajeNoRegistrado || 'No encontramos tu número registrado.';
}

function marcaPago(idEstadoPago) {
  if (idEstadoPago === 1) return 'PENDIENTE PAGO';
  if (idEstadoPago === 3) return 'VENCIDO';
  if (idEstadoPago === 2) return 'PAGADO';
  if (idEstadoPago === 4) return 'ANULADO';
  return '—';
}

function formatearListaPedidos(pedidos) {
  const lineas = pedidos.map((p, i) => {
    const comp = compPedido(p);
    const pago = marcaPago(p.idEstadoPago);
    return `${i + 1}. ${comp} | ${p.fEmision || ''} | ${formatearPrecio(p.total)} | ${p.estadoPedido || '—'} | _${pago}_`;
  });
  const pendientes = pedidos.filter((p) => p.idEstadoPago === 1 || p.idEstadoPago === 3).length;
  const aviso = pendientes > 0
    ? `_Tienes ${pendientes} pedido(s) pendiente(s) de pago._`
    : '_Todos tus pedidos están pagados._ ✅';
  return [
    '*Tus últimos pedidos:*',
    '',
    ...lineas,
    '',
    aviso,
    '',
    'Responde el *número* del pedido (1-5) para ver el detalle.'
  ].join('\n');
}

function formatearResumenPedido(pedido) {
  const comp = compPedido(pedido);
  const pago = marcaPago(pedido.idEstadoPago);
  return [
    `*Pedido ${comp}*`,
    `Fecha: ${pedido.fEmision || '—'}`,
    `Total: ${formatearPrecio(pedido.total)}`,
    `Estado pedido: ${pedido.estadoPedido || '—'}`,
    `Estado pago: ${pago}`,
    '',
    '¿Qué deseas?',
    '*PRODUCTOS* — ver ítems del pedido',
    '*PDF* — recibir comprobante en PDF'
  ].join('\n');
}

function formatearProductosPedido(pedido, items) {
  const comp = compPedido(pedido);
  if (!items.length) {
    return `El pedido ${comp} no tiene productos registrados.\n\nEscribe *PDF* para el comprobante o *MENÚ*.`;
  }
  const lineas = items.map((it, i) => {
    const desc = String(it.descripcion || it.descripcionProducto || 'Producto').trim();
    const cod = it.codigo ? ` (${it.codigo})` : '';
    return `${i + 1}. ${desc}${cod} x${Number(it.cantidad || 0)} = ${formatearPrecio(it.total)}`;
  });
  return [
    `*Productos del pedido ${comp}:*`,
    '',
    ...lineas,
    '',
    `Total: ${formatearPrecio(pedido.total)}`,
    '',
    'Escribe *PDF* para recibir el comprobante.'
  ].join('\n');
}

async function listarPedidos(idEmpresa, idCliente) {
  return withPool((pool) =>
    whatsappBotConsultasRepository.listarPedidosRecientes(pool, idEmpresa, idCliente, PEDIDOS_TOP)
  );
}

async function obtenerPedidoSeleccionado(idEmpresa, idCliente, candidatos, idx) {
  const pedido = candidatos[idx];
  if (!pedido?.idVenta) return null;
  return withPool((pool) =>
    whatsappBotConsultasRepository.obtenerVentaDeCliente(
      pool,
      idEmpresa,
      pedido.idVenta,
      idCliente
    )
  );
}

async function generarPdfPedido(idEmpresa, idVenta, idCliente) {
  if (!pdfBackendClient.isConfigured()) {
    throw new Error('Servicio PDF no configurado (PDF_BACKEND_URL)');
  }
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  const pdfData = await withPool(async (pool) => {
    const venta = await whatsappBotConsultasRepository.obtenerVentaDeCliente(
      pool,
      idEmpresa,
      idVenta,
      idCliente
    );
    if (!venta) return null;
    return ventasRepository.obtenerComprobanteParaPdf(pool, idVenta, [idEmpresa], baseUrl);
  });
  if (!pdfData) {
    throw new Error('No se pudo obtener el comprobante del pedido.');
  }
  const total = Number(pdfData?.venta?.total ?? 0);
  const comp = pdfData?.venta?.compVenta || `pedido-${idVenta}`;
  const nombreArchivo = `pedido-${String(comp).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const buffer = await pdfBackendClient.generarPdfComprobanteVenta(
    {
      ...pdfData,
      cantidadLetras: numeroALetras(total),
      nombreArchivo,
      esCotizacion: false
    },
    'A4'
  );
  return { pdfBase64: buffer.toString('base64'), filename: nombreArchivo, caption: `Pedido ${comp}` };
}

/**
 * Flujo: listar pedidos -> elegir numero -> PRODUCTOS o PDF.
 */
async function intentarProcesar(ctx, conv, nlu, config, resCliente) {
  const { idEmpresa, telefonoLog } = ctx;
  const estado = conv.estado || 'menu';
  const slots = { ...(conv.slots || {}) };

  if (nlu.intencion === 'pedido' && !esEstadoPedido(estado)) {
    const msg = requiereCliente(config, resCliente);
    if (msg) {
      return { respuesta: msg, conv: { estado: 'menu', slots: {}, candidatos: [] } };
    }
    const pedidos = await listarPedidos(idEmpresa, resCliente.cliente.idCliente);
    if (!pedidos.length) {
      return {
        respuesta: 'No encontré pedidos recientes a tu nombre.',
        conv: { estado: 'menu', slots: {}, candidatos: [] }
      };
    }
    return {
      respuesta: formatearListaPedidos(pedidos),
      conv: {
        estado: 'pedido_eligiendo',
        slots: { idCliente: resCliente.cliente.idCliente },
        candidatos: pedidos
      }
    };
  }

  if (estado === 'pedido_eligiendo') {
    if (nlu.intencion === 'menu') {
      return { respuesta: 'Volviendo al menú.', conv: { estado: 'menu', slots: {}, candidatos: [] } };
    }
    if (nlu.intencion === 'pedido') {
      const pedidos = await listarPedidos(idEmpresa, slots.idCliente || resCliente.cliente?.idCliente);
      if (!pedidos.length) {
        return {
          respuesta: 'No encontré pedidos recientes a tu nombre.',
          conv: { estado: 'menu', slots: {}, candidatos: [] }
        };
      }
      return {
        respuesta: formatearListaPedidos(pedidos),
        conv: {
          estado: 'pedido_eligiendo',
          slots: { idCliente: slots.idCliente || resCliente.cliente.idCliente },
          candidatos: pedidos
        }
      };
    }
    if (nlu.intencion !== 'seleccion_numero') {
      return {
        respuesta: 'Responde el *número* del pedido de la lista (1-5) o escribe *MENÚ*.',
        conv
      };
    }
    const idx = Number(nlu.entidades.numero) - 1;
    const candidatos = conv.candidatos || [];
    const idCliente = slots.idCliente || resCliente.cliente?.idCliente;
    if (idx < 0 || idx >= candidatos.length || !idCliente) {
      return {
        respuesta: copy.v('opcionInvalida'),
        conv
      };
    }
    const pedido = await obtenerPedidoSeleccionado(idEmpresa, idCliente, candidatos, idx);
    if (!pedido) {
      return {
        respuesta: 'No pude acceder a ese pedido. Escribe *MENÚ* para volver.',
        conv: { estado: 'menu', slots: {}, candidatos: [] }
      };
    }
    return {
      respuesta: formatearResumenPedido(pedido),
      conv: {
        estado: 'pedido_opciones',
        slots: { idCliente, idVenta: pedido.idVenta, pedido },
        candidatos: []
      }
    };
  }

  if (estado === 'pedido_opciones') {
    if (nlu.intencion === 'menu') {
      return { respuesta: 'Volviendo al menú.', conv: { estado: 'menu', slots: {}, candidatos: [] } };
    }
    const idCliente = slots.idCliente || resCliente.cliente?.idCliente;
    const idVenta = slots.idVenta;
    const pedido = slots.pedido;
    if (!idCliente || !idVenta || !pedido) {
      return {
        respuesta: copy.v('sesionExpirada'),
        conv: { estado: 'menu', slots: {}, candidatos: [] }
      };
    }

    if (nlu.intencion === 'productos_pedido') {
      const items = await withPool((pool) =>
        whatsappBotConsultasRepository.listarDetallePedido(pool, idEmpresa, idVenta, idCliente)
      );
      return {
        respuesta: formatearProductosPedido(pedido, items),
        conv: {
          estado: 'pedido_opciones',
          slots: { idCliente, idVenta, pedido },
          candidatos: []
        }
      };
    }

    if (nlu.intencion === 'pdf_pedido') {
      if (!puedeEnviarPdfPedido(idEmpresa, telefonoLog)) {
        return {
          respuesta: `Solo puedes solicitar ${PDF_MAX_DIA} PDF de pedidos por día desde este número.\n\nEscribe *PRODUCTOS* o *MENÚ*.`,
          conv: {
            estado: 'pedido_opciones',
            slots: { idCliente, idVenta, pedido },
            candidatos: []
          }
        };
      }
      try {
        const adjunto = await generarPdfPedido(idEmpresa, idVenta, idCliente);
        registrarPdfPedido(idEmpresa, telefonoLog);
        return {
          respuesta: [`Listo, te envío el PDF del pedido ${compPedido(pedido)} 📄`],
          conv: { estado: 'menu', slots: {}, candidatos: [] },
          adjunto: {
            pdfBase64: adjunto.pdfBase64,
            filename: adjunto.filename,
            caption: adjunto.caption
          }
        };
      } catch (err) {
        console.error('whatsappBotPedidos PDF:', err.message);
        return {
          respuesta: 'No pude generar el PDF en este momento. Intenta más tarde o escribe *PRODUCTOS*.',
          conv: {
            estado: 'pedido_opciones',
            slots: { idCliente, idVenta, pedido },
            candidatos: []
          }
        };
      }
    }

    return {
      respuesta: 'Escribe *PRODUCTOS* para ver los ítems o *PDF* para recibir el comprobante.',
      conv: {
        estado: 'pedido_opciones',
        slots: { idCliente, idVenta, pedido },
        candidatos: []
      }
    };
  }

  if (esEstadoPedido(estado)) {
    return {
      respuesta: copy.v('sesionExpirada'),
      conv: { estado: 'menu', slots: {}, candidatos: [] }
    };
  }

  return null;
}

module.exports = {
  intentarProcesar,
  esEstadoPedido
};
