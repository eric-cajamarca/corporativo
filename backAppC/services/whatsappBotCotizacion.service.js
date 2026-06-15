const sql = require('mssql');
const { withPool } = require('../utils/dbPool.util');
const cotizacionesService = require('./cotizaciones.service');
const cotizacionesRepository = require('../repositories/cotizaciones.repository');
const whatsappBotCatalogo = require('./whatsappBotCatalogo.service');
const whatsappBotCotizacionRepository = require('../repositories/whatsappBotCotizacion.repository');
const whatsappBotRegistroCliente = require('./whatsappBotRegistroCliente.service');
const whatsappBotLimites = require('./whatsappBotLimites.service');
const pdfBackendClient = require('./pdfBackend.client');
const { numeroALetras } = require('../utils/numeroALetras.util');
const { formatearPrecio } = require('../utils/whatsappBotTexto.util');
const copy = require('./whatsappBot.copy');
const { getFechaHoyApp, formatearFechaApp } = require('../utils/fechaDisplay.util');

const MEDIOS_PAGO = {
  1: 'Efectivo',
  2: 'Transferencia bancaria',
  3: 'Yape / Plin',
  4: 'Tarjeta',
  5: 'Otro'
};

const TEXTO_MEDIOS_PAGO = [
  '*¿Cuál es tu medio de pago preferido?*',
  '1. Efectivo',
  '2. Transferencia bancaria',
  '3. Yape / Plin',
  '4. Tarjeta',
  '5. Otro',
  '',
  'Responde con el número (1-5) o escribe el medio de pago.'
].join('\n');

function esEstadoCotizacion(estado) {
  return String(estado || '').startsWith('cotiz_');
}

function esEstadoRegistroDocumento(estado) {
  return estado === 'registro_documento';
}

function resolverIdCliente(slots, resCliente) {
  return slots?.idCliente || resCliente?.cliente?.idCliente || null;
}

function entrarModoCotizacion(idCliente, mensajeExtra) {
  const burbujas = [];
  if (mensajeExtra) burbujas.push(mensajeExtra);
  burbujas.push([
    '*Modo cotización* 🛒',
    'Escríbeme el nombre del producto que quieres agregar al carrito.',
    '',
    'Comandos: *CARRITO* | *CONFIRMAR* | *CANCELAR* | *MENÚ*'
  ].join('\n'));
  return {
    respuesta: burbujas,
    conv: {
      estado: 'cotiz_activa',
      slots: { carrito: [], idCliente },
      candidatos: []
    }
  };
}

async function solicitarRegistroOIniciarCotizacion(resCliente) {
  if (resCliente.encontrado && !resCliente.ambiguo) {
    return entrarModoCotizacion(resCliente.cliente.idCliente);
  }
  if (resCliente.ambiguo) {
    return {
      respuesta: [
        'Encontramos más de un cliente con tu número.',
        'Indícame tu *DNI* o *RUC* para identificarte y cotizar.',
        '',
        whatsappBotRegistroCliente.TEXTO_SOLICITAR_DOCUMENTO.split('\n').slice(2).join('\n')
      ].join('\n'),
      conv: { estado: 'registro_documento', slots: {}, candidatos: [] }
    };
  }
  return {
    respuesta: whatsappBotRegistroCliente.TEXTO_SOLICITAR_DOCUMENTO,
    conv: { estado: 'registro_documento', slots: {}, candidatos: [] }
  };
}

function carritoVacio(slots) {
  return !Array.isArray(slots?.carrito) || slots.carrito.length === 0;
}

function totalCarrito(carrito) {
  return (carrito || []).reduce((s, it) => s + Number(it.total || 0), 0);
}

function formatearCarrito(carrito) {
  if (!carrito?.length) {
    return copy.v('carritoVacioAviso');
  }
  const lineas = carrito.map((it, i) =>
    `${i + 1}. ${it.descripcion} (${it.codigo}) x${it.cantidad} = ${formatearPrecio(it.total)}`
  );
  return [
    '*Tu cotización:*',
    '',
    ...lineas,
    '',
    `*Total: ${formatearPrecio(totalCarrito(carrito))}*`,
    '',
    'Comandos: *AGREGAR* otro producto | *QUITAR n* | *CONFIRMAR* | *CANCELAR*'
  ].join('\n');
}

function parseCantidad(texto) {
  const n = Number(String(texto || '').trim().replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1000) / 1000;
}

function agregarAlCarrito(carrito, producto, cantidad) {
  const lista = Array.isArray(carrito) ? [...carrito] : [];
  const pVenta = Number(producto.precioLista) || 0;
  const total = Math.round(cantidad * pVenta * 100) / 100;
  const idx = lista.findIndex((x) => x.idProducto === producto.idProducto);
  if (idx >= 0) {
    const nuevaCant = Math.round((lista[idx].cantidad + cantidad) * 1000) / 1000;
    lista[idx] = {
      ...lista[idx],
      cantidad: nuevaCant,
      total: Math.round(nuevaCant * pVenta * 100) / 100
    };
  } else {
    lista.push({
      idProducto: producto.idProducto,
      codigo: producto.codigo,
      descripcion: producto.descripcion,
      pVenta,
      cantidad,
      total
    });
  }
  return lista;
}

function quitarDelCarrito(carrito, indice) {
  const lista = Array.isArray(carrito) ? [...carrito] : [];
  const idx = indice - 1;
  if (idx < 0 || idx >= lista.length) return null;
  lista.splice(idx, 1);
  return lista;
}

function resolverMedioPago(texto, nlu) {
  const t = String(texto || '').trim().toLowerCase();
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    if (MEDIOS_PAGO[n]) return MEDIOS_PAGO[n];
  }
  if (/\befectivo\b/.test(t)) return MEDIOS_PAGO[1];
  if (/\btransfer/.test(t)) return MEDIOS_PAGO[2];
  if (/\byape\b|\bplin\b/.test(t)) return MEDIOS_PAGO[3];
  if (/\btarjeta\b/.test(t)) return MEDIOS_PAGO[4];
  if (nlu?.intencion === 'medio_pago_otro') return MEDIOS_PAGO[5];
  if (t.length >= 3) return texto.trim();
  return null;
}

function hoyIso() {
  return getFechaHoyApp();
}

function vencimientoIso(dias = 7) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return formatearFechaApp(d);
}

async function mapPresentacionPorProductos(pool, idEmpresa, carrito) {
  const map = new Map();
  const ids = [...new Set((carrito || []).map((it) => it.idProducto).filter(Boolean))];
  for (const idProducto of ids) {
    const r = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .query(`
        SELECT ISNULL(idPresentacion, 1) AS idPresentacion
        FROM Productos
        WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto
      `);
    const row = r.recordset?.[0];
    if (row) map.set(String(idProducto), row.idPresentacion);
  }
  return map;
}

async function crearCotizacionDesdeCarrito(idEmpresa, idCliente, carrito, medioPago) {
  return withPool(async (pool) => {
    const comprobante = await whatsappBotCotizacionRepository.obtenerComprobanteCotizacion(pool, idEmpresa);
    if (!comprobante?.idComprobante) {
      throw new Error('No hay comprobante CT configurado para esta empresa');
    }
    const idUsuario = await whatsappBotCotizacionRepository.obtenerUsuarioBot(pool, idEmpresa);
    if (!idUsuario) {
      throw new Error('No hay usuario activo para registrar cotizaciones');
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const idComprobante = Number(comprobante.idComprobante);
      const presMap = await mapPresentacionPorProductos(pool, idEmpresa, carrito);
      const detalles = carrito.map((it) => ({
        cantidad: it.cantidad,
        pVenta: it.pVenta,
        subtotal: it.total,
        total: it.total,
        descuento: 0,
        igv: 0,
        isc: 0,
        codigo: it.codigo,
        descripcion: it.descripcion,
        idPresentacion: presMap.get(String(it.idProducto)) || 1,
        idProducto: it.idProducto
      }));
      const total = Math.round(totalCarrito(carrito) * 100) / 100;
      const idCotizacion = await cotizacionesService.crearCotizacion(
        transaction,
        {
          cotizacion: {
            idComprobante,
            serie: String(comprobante.serie || '0000').slice(0, 4),
            fEmision: hoyIso(),
            fVencimiento: vencimientoIso(7),
            idDocumento: '1',
            idCliente,
            total,
            esCotizacionAgrupada: false
          },
          detalles
        },
        idEmpresa,
        idUsuario
      );
      await transaction.commit();

      const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
      const pdfData = await cotizacionesRepository.obtenerParaPdf(pool, idCotizacion, idEmpresa, baseUrl);
      return { idCotizacion, pdfData, serieNumero: pdfData?.venta?.compVenta || `CT-${idCotizacion}`, medioPago };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  });
}

async function generarPdfBase64(pdfData) {
  if (!pdfBackendClient.isConfigured()) {
    throw new Error('Servicio PDF no configurado (PDF_BACKEND_URL)');
  }
  const total = Number(pdfData?.venta?.total ?? 0);
  const nombreArchivo = `cotizacion-${String(pdfData?.venta?.compVenta || 'cotizacion').replace(/-/g, '_')}.pdf`;
  const payload = {
    ...pdfData,
    cantidadLetras: numeroALetras(total),
    nombreArchivo,
    esCotizacion: true
  };
  const buffer = await pdfBackendClient.generarPdfComprobanteVenta(payload, 'A4');
  return { base64: buffer.toString('base64'), nombreArchivo };
}

/**
 * Procesa turnos del flujo de cotizacion. Retorna null si no aplica.
 */
async function intentarProcesar(ctx, conv, nlu, config, resCliente) {
  const { idEmpresa, textoEntrada, digitosCelular } = ctx;
  const texto = String(textoEntrada || '').trim();
  const slots = { ...(conv.slots || {}), carrito: Array.isArray(conv.slots?.carrito) ? [...conv.slots.carrito] : [] };

  if (esEstadoRegistroDocumento(conv.estado)) {
    if (nlu.intencion === 'menu' || nlu.intencion === 'cancelar_cotizacion') {
      return {
        respuesta: 'Registro cancelado. Escribe *MENÚ* para ver las opciones.',
        conv: { estado: 'menu', slots: {}, candidatos: [] }
      };
    }
    if (nlu.intencion === 'documento_invalido') {
      return {
        respuesta: [
          'Ese documento no parece válido.',
          'Ingresa *DNI* (8 dígitos) o *RUC* (11 dígitos), solo números.'
        ].join('\n'),
        conv: { estado: 'registro_documento', slots: {}, candidatos: [] }
      };
    }
    if (nlu.intencion === 'documento_identidad') {
      const idClientePrevio = resolverIdCliente(slots, resCliente);
      const registro = await whatsappBotRegistroCliente.registrarPorDocumento(
        idEmpresa,
        digitosCelular,
        texto,
        idClientePrevio
      );
      if (!registro.ok) {
        return {
          respuesta: [
            registro.mensaje,
            '',
            'Verifica tu DNI o RUC e inténtalo de nuevo, o escribe *MENÚ* para volver.'
          ].join('\n'),
          conv: { estado: 'registro_documento', slots: {}, candidatos: [] }
        };
      }
      return entrarModoCotizacion(registro.cliente.idCliente, registro.mensaje);
    }
    return {
      respuesta: whatsappBotRegistroCliente.TEXTO_SOLICITAR_DOCUMENTO,
      conv: { estado: 'registro_documento', slots: {}, candidatos: [] }
    };
  }

  if (nlu.intencion === 'cotizar' || (nlu.intencion === 'menu_numero' && Number(nlu.entidades?.menuNumero) === 4)) {
    return solicitarRegistroOIniciarCotizacion(resCliente);
  }

  if (nlu.intencion === 'agregar_a_cotizacion') {
    const agregar = await intentarAgregarDesdeBusquedaGeneral(ctx, conv, nlu, resCliente);
    if (agregar) return agregar;
  }

  if (!esEstadoCotizacion(conv.estado) && nlu.intencion !== 'carrito' && nlu.intencion !== 'confirmar_cotizacion') {
    if (nlu.intencion === 'cancelar_cotizacion' && !carritoVacio(slots)) {
      return solicitarRegistroOIniciarCotizacion(resCliente);
    }
    return null;
  }

  if (nlu.intencion === 'cancelar_cotizacion' || (nlu.intencion === 'menu' && conv.estado !== 'cotiz_medio_pago')) {
    return {
      respuesta: 'Cotización cancelada. Escribe *MENÚ* para ver las opciones.',
      conv: { estado: 'menu', slots: {}, candidatos: [] }
    };
  }

  if (nlu.intencion === 'carrito' || texto.toUpperCase() === 'CARRITO') {
    return {
      respuesta: formatearCarrito(slots.carrito),
      conv: { estado: conv.estado || 'cotiz_activa', slots, candidatos: conv.candidatos || [] }
    };
  }

  if (nlu.intencion === 'confirmar_cotizacion') {
    if (carritoVacio(slots)) {
      return { respuesta: 'Tu carrito está vacío. Agrega productos antes de confirmar.', conv: { ...conv, slots } };
    }
    const idCliente = resolverIdCliente(slots, resCliente);
    if (!idCliente) {
      return solicitarRegistroOIniciarCotizacion(resCliente);
    }
    slots.idCliente = idCliente;
    slots.esperandoMedioPago = true;
    return {
      respuesta: [
        formatearCarrito(slots.carrito),
        TEXTO_MEDIOS_PAGO,
        '_Un vendedor te contactará para confirmar el pago._'
      ],
      conv: { estado: 'cotiz_medio_pago', slots: { ...slots, idCliente }, candidatos: [] }
    };
  }

  if (conv.estado === 'cotiz_medio_pago' || (nlu.intencion === 'medio_pago' && !carritoVacio(slots))) {
    const medioPago = resolverMedioPago(texto, nlu);
    if (!medioPago) {
      return { respuesta: 'Ese medio de pago no lo reconozco.\n\n' + TEXTO_MEDIOS_PAGO, conv: { ...conv, slots } };
    }
    const idClienteConfirm = resolverIdCliente(slots, resCliente);
    if (!idClienteConfirm) {
      return solicitarRegistroOIniciarCotizacion(resCliente);
    }
    try {
      try {
        await whatsappBotLimites.assertLimiteCotizacionesDia(idEmpresa, digitosCelular, idClienteConfirm);
      } catch (limErr) {
        return {
          respuesta: `${limErr.message} Escribe *MENÚ* para volver al inicio.`,
          conv: { estado: 'menu', slots: {}, candidatos: [] }
        };
      }
      const { idCotizacion, pdfData, serieNumero } = await crearCotizacionDesdeCarrito(
        idEmpresa,
        idClienteConfirm,
        slots.carrito,
        medioPago
      );
      let adjunto = null;
      try {
        const pdf = await generarPdfBase64(pdfData);
        adjunto = {
          pdfBase64: pdf.base64,
          filename: pdf.nombreArchivo,
          caption: `Cotización ${serieNumero}`
        };
      } catch (pdfErr) {
        console.error('whatsappBotCotizacion PDF:', pdfErr.message);
      }
      const burbujas = [
        `${copy.v('cotizConfirmacion')} ✅`,
        [
          `*Cotización ${serieNumero}*`,
          `Total: ${formatearPrecio(totalCarrito(slots.carrito))}`,
          `Medio de pago: ${medioPago}`
        ].join('\n'),
        adjunto
          ? 'Te envío el PDF de tu cotización 📄. Un vendedor te llamará pronto para confirmar el pago.'
          : 'Tu cotización quedó registrada. Un vendedor te llamará pronto para confirmar el pago.'
      ];
      delete slots.esperandoMedioPago;
      return {
        respuesta: burbujas,
        conv: { estado: 'menu', slots: {}, candidatos: [] },
        adjunto,
        reaccion: '✅',
        meta: { idCotizacion, serieNumero, medioPago }
      };
    } catch (err) {
      console.error('whatsappBotCotizacion crear:', err.message);
      return {
        respuesta: 'No pude registrar la cotización en este momento. Por favor intenta de nuevo en un minuto o contacta a la empresa.',
        conv: { estado: 'cotiz_activa', slots, candidatos: [] }
      };
    }
  }

  if (slots.productoPendiente && (conv.estado === 'cotiz_cantidad' || nlu.intencion === 'cantidad')) {
    const cantidad = parseCantidad(nlu.intencion === 'cantidad' ? String(nlu.entidades?.cantidad ?? texto) : texto);
    if (!cantidad) {
      return {
        respuesta: 'Indícame una cantidad válida, por ejemplo: *1*, *2*, *10.5*.',
        conv: { ...conv, slots }
      };
    }
    const carrito = agregarAlCarrito(slots.carrito, slots.productoPendiente, cantidad);
    const prod = slots.productoPendiente;
    delete slots.productoPendiente;
    slots.carrito = carrito;
    return {
      respuesta: [
        `${copy.v('okBreve')} Agregado: *${prod.descripcion}* x${cantidad}`,
        formatearCarrito(carrito)
      ],
      conv: { estado: 'cotiz_activa', slots, candidatos: [] },
      reaccion: '🛒'
    };
  }

  if (conv.estado === 'cotiz_eligiendo' && nlu.intencion === 'seleccion_numero') {
    const idx = Number(nlu.entidades.numero) - 1;
    const candidatos = conv.candidatos || [];
    if (idx < 0 || idx >= candidatos.length) {
      return { respuesta: copy.v('opcionInvalida'), conv };
    }
    slots.productoPendiente = candidatos[idx];
    return {
      respuesta: `*${candidatos[idx].descripcion}*\nPrecio: ${formatearPrecio(candidatos[idx].precioLista)}\n\n¿Cuántas unidades deseas?`,
      conv: { estado: 'cotiz_cantidad', slots, candidatos: [] }
    };
  }

  if (nlu.intencion === 'quitar_carrito') {
    const n = Number(nlu.entidades.numero);
    if (!n || carritoVacio(slots)) {
      return { respuesta: 'Indícame *QUITAR* seguido del número de línea (por ejemplo *QUITAR 1*).', conv: { ...conv, slots } };
    }
    const nuevo = quitarDelCarrito(slots.carrito, n);
    if (!nuevo) {
      return { respuesta: 'Línea no válida. Escribe *CARRITO* para ver la lista actualizada.', conv: { ...conv, slots } };
    }
    slots.carrito = nuevo;
    return {
      respuesta: [`${copy.v('okBreve')} Quité ese producto.`, formatearCarrito(nuevo)],
      conv: { estado: 'cotiz_activa', slots, candidatos: [] }
    };
  }

  if (esEstadoCotizacion(conv.estado) && nlu.terminosBusqueda.length > 0 && nlu.intencion !== 'confirmar_cotizacion') {
    const limite = whatsappBotCatalogo.LIMITE_OPCIONES_CHAT;
    const { totalEncontrados, hayMas, items } = await whatsappBotCatalogo.buscar(
      idEmpresa,
      nlu.terminosBusqueda,
      limite
    );
    if (!items.length) {
      return {
        respuesta: 'No encontré ese producto. Intenta con otro nombre o escribe *CARRITO*.',
        conv: { estado: 'cotiz_activa', slots, candidatos: [] }
      };
    }
    if (items.length === 1) {
      slots.productoPendiente = items[0];
      return {
        respuesta: `*${items[0].descripcion}*\nPrecio: ${formatearPrecio(items[0].precioLista)}\n\n¿Cuántas unidades deseas?`,
        conv: { estado: 'cotiz_cantidad', slots, candidatos: [] }
      };
    }
    const lineas = items.map((p, i) =>
      `${i + 1}. *${p.descripcion}* (${p.codigo}) — ${formatearPrecio(p.precioLista)}`
    );
    const pie = ['Responde el número para agregarlo al carrito.'];
    if (hayMas) {
      pie.unshift(
        `Hay ${totalEncontrados} coincidencias; muestro las ${items.length} más relevantes. Escribe más detalle para afinar.`
      );
    }
    return {
      respuesta: ['Encontré estos productos:', '', ...lineas, '', ...pie].join('\n'),
      conv: { estado: 'cotiz_eligiendo', slots, candidatos: items },
      reaccion: '🔍'
    };
  }

  if (esEstadoCotizacion(conv.estado)) {
    return {
      respuesta: [
        'En modo cotización puedes:',
        '— Escribir el nombre del producto a buscar',
        '— *CARRITO* para ver tu lista',
        '— *CONFIRMAR* para registrar',
        '— *CANCELAR* para salir'
      ].join('\n'),
      conv: { ...conv, slots }
    };
  }

  return null;
}

/**
 * Desde busqueda general (sin haber entrado a "COTIZAR"): agrega el producto
 * mostrado o el de la lista segun ultima seleccion / numero en el mensaje.
 */
async function intentarAgregarDesdeBusquedaGeneral(ctx, conv, nlu, resCliente) {
  const registro = await solicitarRegistroOIniciarCotizacion(resCliente);
  if (registro.conv.estado === 'registro_documento') {
    return registro;
  }

  const idCliente = resolverIdCliente(registro.conv.slots, resCliente);
  const slots = {
    ...(registro.conv.slots || {}),
    carrito: Array.isArray(registro.conv.slots?.carrito) ? [...registro.conv.slots.carrito] : []
  };
  if (idCliente) slots.idCliente = idCliente;

  let producto = null;

  if (nlu.intencion === 'seleccion_numero' && conv.candidatos?.length) {
    const idx = Number(nlu.entidades?.numero) - 1;
    if (idx >= 0 && idx < conv.candidatos.length) producto = conv.candidatos[idx];
  }

  if (!producto && conv.slots?.ultimoCandidato) {
    producto = conv.slots.ultimoCandidato;
  }

  if (!producto && conv.slots?.ultimaBusqueda?.candidatos?.length === 1) {
    producto = conv.slots.ultimaBusqueda.candidatos[0];
  }

  if (!producto && conv.candidatos?.length === 1) {
    producto = conv.candidatos[0];
  }

  if (!producto && conv.candidatos?.length > 1) {
    const lineas = conv.candidatos.map((p, i) =>
      `${i + 1}. *${p.descripcion}* (${p.codigo}) — ${formatearPrecio(p.precioLista)}`
    );
    return {
      respuesta: [
        'Para agregar a la cotización, responde con el *número* del producto de la lista:',
        '',
        ...lineas
      ].join('\n'),
      conv: {
        estado: 'cotiz_eligiendo',
        slots: { ...slots, ultimaBusqueda: conv.slots?.ultimaBusqueda },
        candidatos: conv.candidatos
      },
      reaccion: '🛒'
    };
  }

  if (!producto) {
    return {
      respuesta: [
        'Primero dime qué producto quieres cotizar (escribe el nombre) o elige uno de una lista.',
        'También puedes escribir *COTIZAR* para entrar al modo cotización.'
      ].join('\n'),
      conv: { estado: 'cotiz_activa', slots, candidatos: [] }
    };
  }

  slots.productoPendiente = producto;
  return {
    respuesta: `*${producto.descripcion}*\nPrecio: ${formatearPrecio(producto.precioLista)}\n\n¿Cuántas unidades deseas?`,
    conv: { estado: 'cotiz_cantidad', slots, candidatos: [] },
    reaccion: '🛒'
  };
}

module.exports = {
  intentarProcesar,
  intentarAgregarDesdeBusquedaGeneral,
  esEstadoCotizacion,
  MEDIOS_PAGO,
  TEXTO_MEDIOS_PAGO
};
