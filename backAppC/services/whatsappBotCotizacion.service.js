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

const MEDIOS_PAGO = {
  1: 'Efectivo',
  2: 'Transferencia bancaria',
  3: 'Yape / Plin',
  4: 'Tarjeta',
  5: 'Otro'
};

const TEXTO_MEDIOS_PAGO = [
  '*Medio de pago preferido:*',
  '1. Efectivo',
  '2. Transferencia bancaria',
  '3. Yape / Plin',
  '4. Tarjeta',
  '5. Otro',
  '',
  'Responda con el numero (1-5) o escriba el medio de pago.'
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
  const prefijo = mensajeExtra ? [`${mensajeExtra}`, ''] : [];
  return {
    respuesta: [
      ...prefijo,
      '*Modo cotizacion*',
      'Escriba el nombre del producto que desea agregar.',
      'Comandos: CARRITO | CONFIRMAR | CANCELAR | MENU',
      '',
      formatearCarrito([])
    ].join('\n'),
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
        'Encontramos mas de un cliente con su numero.',
        'Indique su *DNI* o *RUC* para identificarse y cotizar.',
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
    return 'Su carrito esta vacio.\n\nEscriba el nombre de un producto para agregarlo, o MENU para volver.';
  }
  const lineas = carrito.map((it, i) =>
    `${i + 1}. ${it.descripcion} (${it.codigo}) x${it.cantidad} = ${formatearPrecio(it.total)}`
  );
  return [
    '*Su cotizacion:*',
    ...lineas,
    '',
    `*Total: ${formatearPrecio(totalCarrito(carrito))}*`,
    '',
    'Comandos: AGREGAR otro producto | QUITAR [n] | CONFIRMAR | CANCELAR'
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
  return new Date().toISOString().slice(0, 10);
}

function vencimientoIso(dias = 7) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
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
    if (nlu.intencion === 'menu') {
      return {
        respuesta: 'Registro cancelado. Escriba MENU para ver opciones.',
        conv: { estado: 'menu', slots: {}, candidatos: [] }
      };
    }
    if (nlu.intencion === 'cancelar_cotizacion') {
      return {
        respuesta: 'Registro cancelado. Escriba MENU para ver opciones.',
        conv: { estado: 'menu', slots: {}, candidatos: [] }
      };
    }
    if (nlu.intencion === 'documento_invalido') {
      return {
        respuesta: [
          'Documento invalido.',
          'Ingrese *DNI* (8 digitos) o *RUC* (11 digitos). Solo numeros.',
          '',
          'Escriba MENU para volver al inicio.'
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
            'Verifique su DNI o RUC e intente de nuevo, o escriba MENU para volver.'
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

  if (!esEstadoCotizacion(conv.estado) && nlu.intencion !== 'carrito' && nlu.intencion !== 'confirmar_cotizacion') {
    if (nlu.intencion === 'cancelar_cotizacion' && !carritoVacio(slots)) {
      return solicitarRegistroOIniciarCotizacion(resCliente);
    }
    return null;
  }

  if (nlu.intencion === 'cancelar_cotizacion' || (nlu.intencion === 'menu' && conv.estado !== 'cotiz_medio_pago')) {
    return {
      respuesta: 'Cotizacion cancelada. Escriba MENU para ver opciones.',
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
      return { respuesta: 'Su carrito esta vacio. Agregue productos antes de confirmar.', conv: { ...conv, slots } };
    }
    const idCliente = resolverIdCliente(slots, resCliente);
    if (!idCliente) {
      return solicitarRegistroOIniciarCotizacion(resCliente);
    }
    slots.idCliente = idCliente;
    return {
      respuesta: [
        formatearCarrito(slots.carrito),
        '',
        TEXTO_MEDIOS_PAGO,
        '',
        '_Un vendedor lo contactara para confirmar el pago._'
      ].join('\n'),
      conv: { estado: 'cotiz_medio_pago', slots: { ...slots, idCliente }, candidatos: [] }
    };
  }

  if (conv.estado === 'cotiz_medio_pago') {
    const medioPago = resolverMedioPago(texto, nlu);
    if (!medioPago) {
      return { respuesta: 'Medio de pago no valido.\n\n' + TEXTO_MEDIOS_PAGO, conv: { ...conv, slots } };
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
          respuesta: `${limErr.message} Escriba MENU para volver al inicio.`,
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
          caption: `Cotizacion ${serieNumero}`
        };
      } catch (pdfErr) {
        console.error('whatsappBotCotizacion PDF:', pdfErr.message);
      }
      const respuesta = [
        `*Cotizacion registrada*`,
        `Numero: *${serieNumero}*`,
        `Total: ${formatearPrecio(totalCarrito(slots.carrito))}`,
        `Medio de pago indicado: ${medioPago}`,
        '',
        adjunto
          ? 'Le enviamos el PDF de su cotizacion. Un vendedor lo llamara pronto para confirmar el pago.'
          : 'Su cotizacion fue registrada. Un vendedor lo llamara pronto para confirmar el pago.',
        '',
        'Escriba MENU para volver al inicio.'
      ].join('\n');
      return {
        respuesta,
        conv: { estado: 'menu', slots: {}, candidatos: [] },
        adjunto,
        meta: { idCotizacion, serieNumero, medioPago }
      };
    } catch (err) {
      console.error('whatsappBotCotizacion crear:', err.message);
      return {
        respuesta: `No pudimos registrar la cotizacion: ${err.message}. Intente de nuevo o contacte a la empresa.`,
        conv: { estado: 'cotiz_activa', slots, candidatos: [] }
      };
    }
  }

  if ((conv.estado === 'cotiz_cantidad' || nlu.intencion === 'cantidad') && slots.productoPendiente) {
    const cantidad = parseCantidad(nlu.intencion === 'cantidad' ? String(nlu.entidades?.cantidad ?? texto) : texto);
    if (!cantidad) {
      return {
        respuesta: 'Indique una cantidad valida (ej. 1, 2, 10.5).',
        conv: { ...conv, slots }
      };
    }
    const carrito = agregarAlCarrito(slots.carrito, slots.productoPendiente, cantidad);
    const prod = slots.productoPendiente;
    delete slots.productoPendiente;
    slots.carrito = carrito;
    return {
      respuesta: [
        `Agregado: *${prod.descripcion}* x${cantidad}`,
        '',
        formatearCarrito(carrito)
      ].join('\n'),
      conv: { estado: 'cotiz_activa', slots, candidatos: [] }
    };
  }

  if (conv.estado === 'cotiz_eligiendo' && nlu.intencion === 'seleccion_numero') {
    const idx = Number(nlu.entidades.numero) - 1;
    const candidatos = conv.candidatos || [];
    if (idx < 0 || idx >= candidatos.length) {
      return { respuesta: 'Opcion invalida. Responda 1-5 o escriba otro termino.', conv };
    }
    slots.productoPendiente = candidatos[idx];
    return {
      respuesta: `*${candidatos[idx].descripcion}*\nPrecio: ${formatearPrecio(candidatos[idx].precioLista)}\n\n¿Cuantas unidades desea?`,
      conv: { estado: 'cotiz_cantidad', slots, candidatos: [] }
    };
  }

  if (nlu.intencion === 'quitar_carrito') {
    const n = Number(nlu.entidades.numero);
    if (!n || carritoVacio(slots)) {
      return { respuesta: 'Indique QUITAR seguido del numero de linea (ej. QUITAR 1).', conv: { ...conv, slots } };
    }
    const nuevo = quitarDelCarrito(slots.carrito, n);
    if (!nuevo) {
      return { respuesta: 'Linea invalida. Use CARRITO para ver la lista.', conv: { ...conv, slots } };
    }
    slots.carrito = nuevo;
    return {
      respuesta: ['Producto quitado.', '', formatearCarrito(nuevo)].join('\n'),
      conv: { estado: 'cotiz_activa', slots, candidatos: [] }
    };
  }

  if (esEstadoCotizacion(conv.estado) && nlu.terminosBusqueda.length > 0 && nlu.intencion !== 'confirmar_cotizacion') {
    const { items } = await whatsappBotCatalogo.buscar(idEmpresa, nlu.terminosBusqueda, 5);
    if (!items.length) {
      return {
        respuesta: 'No encontramos ese producto. Intente con otro nombre o escriba CARRITO.',
        conv: { estado: 'cotiz_activa', slots, candidatos: [] }
      };
    }
    if (items.length === 1) {
      slots.productoPendiente = items[0];
      return {
        respuesta: `*${items[0].descripcion}*\nPrecio: ${formatearPrecio(items[0].precioLista)}\n\n¿Cuantas unidades desea?`,
        conv: { estado: 'cotiz_cantidad', slots, candidatos: [] }
      };
    }
    const lineas = items.map((p, i) =>
      `${i + 1}. *${p.descripcion}* (${p.codigo}) - ${formatearPrecio(p.precioLista)}`
    );
    return {
      respuesta: ['Productos encontrados:', ...lineas, '', 'Responda el numero para agregar al carrito.'].join('\n'),
      conv: { estado: 'cotiz_eligiendo', slots, candidatos: items }
    };
  }

  if (esEstadoCotizacion(conv.estado)) {
    return {
      respuesta: [
        'En modo cotizacion puede:',
        '- Escribir el producto a buscar',
        '- CARRITO ver lista',
        '- CONFIRMAR para registrar',
        '- CANCELAR para salir'
      ].join('\n'),
      conv: { ...conv, slots }
    };
  }

  return null;
}

module.exports = {
  intentarProcesar,
  esEstadoCotizacion,
  MEDIOS_PAGO,
  TEXTO_MEDIOS_PAGO
};
