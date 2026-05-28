const pdfBackendClient = require('./pdfBackend.client');
const whatsappBotCatalogo = require('./whatsappBotCatalogo.service');
const { formatearPrecio } = require('../utils/whatsappBotTexto.util');

const MAX_BYTES = Number(process.env.WHATSAPP_BOT_MAX_ATTACHMENT_BYTES) || 4 * 1024 * 1024;
const MAX_FILAS = Number(process.env.WHATSAPP_BOT_LISTA_MAX_FILAS) || 200;

function mensajeErrorParse(code) {
  const map = {
    ARCHIVO_DEMASIADO_GRANDE: 'El archivo es demasiado grande. Máximo ~4 MB.',
    EXCEL_SIN_DATOS: 'No encontré productos en el Excel. Usa columnas *Producto* y *Cantidad*.',
    EXCEL_INVALIDO: 'El Excel no es válido. Envía un archivo .xlsx.',
    PDF_SIN_TEXTO:
      'El PDF no tiene texto seleccionable (puede ser una foto escaneada). Envía Excel o un PDF exportado desde Excel.',
    PDF_INVALIDO: 'No pude leer el PDF. Verifica que no esté dañado.',
    TIPO_ARCHIVO_NO_SOPORTADO: 'Solo acepto archivos *Excel (.xlsx)* o *PDF con texto*.',
    ARCHIVO_REQUERIDO: 'No recibí el archivo correctamente.',
    DEMASIADAS_FILAS: `La lista supera el máximo de ${MAX_FILAS} productos.`
  };
  return map[code] || 'No pude procesar el archivo. Intenta con Excel o PDF con texto.';
}

async function resolverPropuestaProducto(idEmpresa, item) {
  const codigo = String(item.codigo || '').trim();
  if (codigo) {
    const { items } = await whatsappBotCatalogo.buscar(idEmpresa, [codigo], 5);
    const exacto = items.find((p) => String(p.codigo || '').toLowerCase() === codigo.toLowerCase());
    if (exacto) return { propuesta: exacto, candidatos: items };
    if (items.length === 1) return { propuesta: items[0], candidatos: items };
    if (items.length > 1) return { propuesta: items[0], candidatos: items };
  }

  const res = await whatsappBotCatalogo.buscarMejorCoincidencia(idEmpresa, item.descripcion, 8, {
    desdeLista: true
  });
  return {
    propuesta: res.propuesta || res.producto || (res.candidatos && res.candidatos[0]) || null,
    candidatos: res.candidatos || []
  };
}

async function extraerItemsDeArchivo(buffer, fileName) {
  if (!pdfBackendClient.isConfigured()) {
    throw new Error('PDF_BACKEND_NO_CONFIGURADO');
  }
  if (buffer.length > MAX_BYTES) {
    const e = new Error('ARCHIVO_DEMASIADO_GRANDE');
    e.code = 'ARCHIVO_DEMASIADO_GRANDE';
    throw e;
  }
  return pdfBackendClient.parsearListaCotizacion(buffer, {
    fileName,
    maxBytes: MAX_BYTES,
    maxFilas: MAX_FILAS
  });
}

/**
 * Arma propuestas para confirmar (no agrega al carrito hasta que el usuario diga SI).
 */
async function armarPropuestasDesdeArchivo(idEmpresa, items) {
  const propuestas = [];
  const noEncontrados = [];

  for (const item of items) {
    const cantidad = Number(item.cantidad) || 1;
    const { propuesta, candidatos } = await resolverPropuestaProducto(idEmpresa, item);
    if (propuesta) {
      propuestas.push({
        linea: item.linea,
        textoArchivo: item.descripcion,
        cantidad,
        producto: propuesta,
        candidatos: candidatos || []
      });
    } else {
      noEncontrados.push({ linea: item.linea, descripcion: item.descripcion });
    }
  }

  return { propuestas, noEncontrados };
}

function formatearMensajeConfirmacionLista(propuestas, noEncontrados, source) {
  const bloques = [
    `*Lista leída* (${source === 'pdf' ? 'PDF' : 'Excel'}) 📋`,
    'Encontré estos productos en tu catálogo. Revisa y confirma:',
    ''
  ];

  propuestas.forEach((p, i) => {
    bloques.push(
      `${i + 1}. *${p.textoArchivo}*`,
      `   → ${p.producto.descripcion} (${p.producto.codigo}) x${p.cantidad} — ${formatearPrecio(p.producto.precioLista)} c/u`
    );
    if (p.candidatos.length > 1) {
      const alt = p.candidatos
        .slice(1, 3)
        .map((c) => c.descripcion)
        .join(' | ');
      bloques.push(`   _Otras opciones: ${alt}_`);
    }
    bloques.push('');
  });

  if (noEncontrados.length) {
    bloques.push('*Sin coincidencia en catálogo:*');
    noEncontrados.forEach((n) => {
      bloques.push(`• Línea ${n.linea}: ${n.descripcion}`);
    });
    bloques.push('');
  }

  bloques.push(
    'Responde *SI* para agregar todo al carrito.',
    'Responde *NO* para cancelar.',
    'O escribe el *número de línea* (ej. *2*) para elegir otra opción de esa fila.'
  );
  return bloques.join('\n');
}

function aplicarPropuestasAlCarrito(propuestas, carrito, agregarAlCarrito) {
  let lista = Array.isArray(carrito) ? [...carrito] : [];
  const agregados = [];
  for (const p of propuestas) {
    lista = agregarAlCarrito(lista, p.producto, p.cantidad);
    agregados.push({
      descripcion: p.producto.descripcion,
      codigo: p.producto.codigo,
      cantidad: p.cantidad
    });
  }
  return { carrito: lista, agregados };
}

/**
 * Confirma o cancela lista pendiente (estado cotiz_confirmar_lista).
 * Retorna null si no aplica.
 */
function procesarConfirmacionLista(ctx, conv, helpers) {
  if (conv.estado !== 'cotiz_confirmar_lista') return null;

  const slots = { ...(conv.slots || {}), carrito: Array.isArray(conv.slots?.carrito) ? [...conv.slots.carrito] : [] };
  const propuestas = Array.isArray(slots.listaPendiente) ? slots.listaPendiente : [];
  const texto = String(ctx.textoEntrada || '').trim().toLowerCase();

  if (/^(no|cancelar|cancel)$/i.test(texto)) {
    delete slots.listaPendiente;
    return {
      respuesta: 'Importación cancelada. Tu carrito no cambió. Escribe *MENÚ* o sigue agregando productos.',
      conv: { estado: 'cotiz_activa', slots, candidatos: [] }
    };
  }

  if (/^(si|sí|ok|dale|confirmar|agregar|yes)$/i.test(texto)) {
    if (!propuestas.length) {
      delete slots.listaPendiente;
      return {
        respuesta: 'No hay propuestas pendientes. Envía el archivo de nuevo.',
        conv: { estado: 'cotiz_activa', slots, candidatos: [] }
      };
    }
    const { carrito, agregados } = aplicarPropuestasAlCarrito(
      propuestas,
      slots.carrito,
      helpers.agregarAlCarrito
    );
    slots.carrito = carrito;
    delete slots.listaPendiente;

    const lineas = agregados.map(
      (a, i) => `${i + 1}. ${a.descripcion} (${a.codigo}) x${a.cantidad}`
    );
    return {
      respuesta: [
        `*${agregados.length} producto(s) agregado(s) al carrito.* ✅`,
        '',
        ...lineas,
        '',
        helpers.formatearCarrito(slots.carrito),
        '',
        'Cuando termines escribe *CONFIRMAR* para generar la cotización.'
      ].join('\n'),
      conv: { estado: 'cotiz_activa', slots, candidatos: [] },
      reaccion: '🛒'
    };
  }

  const num = Number(texto);
  if (Number.isFinite(num) && num >= 1 && num <= propuestas.length) {
    const p = propuestas[num - 1];
    if ((p.candidatos || []).length <= 1) {
      return {
        respuesta: `Línea ${num}: solo hay una coincidencia (${p.producto.descripcion}). Responde *SI* para agregar todo.`,
        conv: { ...conv, slots }
      };
    }
    return {
      respuesta: [
        `*Línea ${num}:* ${p.textoArchivo}`,
        '',
        ...p.candidatos.map((c, i) => `${i + 1}. ${c.descripcion} (${c.codigo}) — ${formatearPrecio(c.precioLista)}`),
        '',
        'Responde el número de la opción correcta (ej. *1*).'
      ].join('\n'),
      conv: {
        estado: 'cotiz_lista_elegir_opcion',
        slots: { ...slots, listaLineaElegir: num - 1 },
        candidatos: p.candidatos
      }
    };
  }

  return {
    respuesta: 'Responde *SI* para agregar la lista al carrito, *NO* para cancelar, o el número de línea a corregir.',
    conv: { ...conv, slots }
  };
}

function procesarElegirOpcionLista(ctx, conv, helpers) {
  if (conv.estado !== 'cotiz_lista_elegir_opcion') return null;

  const slots = { ...(conv.slots || {}), carrito: Array.isArray(conv.slots?.carrito) ? [...conv.slots.carrito] : [] };
  const propuestas = Array.isArray(slots.listaPendiente) ? slots.listaPendiente : [];
  const idxLinea = slots.listaLineaElegir;
  const candidatos = conv.candidatos || [];
  const num = Number(String(ctx.textoEntrada || '').trim());

  if (!Number.isFinite(num) || num < 1 || num > candidatos.length) {
    return {
      respuesta: `Indica un número entre 1 y ${candidatos.length}, o *SI* para confirmar el resto.`,
      conv: { ...conv, slots }
    };
  }

  if (idxLinea >= 0 && idxLinea < propuestas.length) {
    propuestas[idxLinea].producto = candidatos[num - 1];
  }
  delete slots.listaLineaElegir;

  return {
    respuesta: [
      `Actualicé la línea ${idxLinea + 1} → *${candidatos[num - 1].descripcion}* (${candidatos[num - 1].codigo}).`,
      '',
      'Responde *SI* para agregar todo al carrito o *NO* para cancelar.'
    ].join('\n'),
    conv: {
      estado: 'cotiz_confirmar_lista',
      slots,
      candidatos: []
    }
  };
}

async function procesarAdjuntoCotizacion(ctx, conv, resCliente, helpers) {
  const adj = ctx.adjuntoEntrada;
  if (!adj?.base64) return null;

  const mime = String(adj.mimeType || '').toLowerCase();
  const fileName = String(adj.fileName || '').toLowerCase();
  const esImagen = adj.kind === 'image' || mime.startsWith('image/');
  if (esImagen) {
    return {
      respuesta: [
        'Por ahora no leo fotos de listas.',
        'Envía un archivo *Excel (.xlsx)* o un *PDF con texto* (exportado desde Excel).',
        'También puedes escribir los productos uno por uno.'
      ].join('\n'),
      conv: { estado: conv.estado || 'cotiz_activa', slots: conv.slots || {}, candidatos: conv.candidatos || [] }
    };
  }

  const esPdf = fileName.endsWith('.pdf') || mime === 'application/pdf';
  const esXlsx =
    fileName.endsWith('.xlsx') ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  if (!esPdf && !esXlsx) {
    return {
      respuesta:
        'Formato no soportado. Envía *Excel (.xlsx)* o *PDF con texto* (no escaneado).',
      conv: { estado: conv.estado || 'cotiz_activa', slots: conv.slots || {}, candidatos: [] }
    };
  }

  const { idEmpresa } = ctx;
  const slots = {
    ...(conv.slots || {}),
    carrito: Array.isArray(conv.slots?.carrito) ? [...conv.slots.carrito] : []
  };

  if (!helpers.esEstadoCotizacion(conv.estado) && conv.estado !== 'menu') {
    const reg = await helpers.solicitarRegistroOIniciarCotizacion(resCliente);
    if (!helpers.esEstadoCotizacion(reg.conv?.estado)) {
      const msg = Array.isArray(reg.respuesta) ? reg.respuesta.join('\n\n') : reg.respuesta;
      return {
        respuesta: [msg, '', 'Cuando estés en cotización, envía tu Excel o PDF con la lista.'].join('\n'),
        conv: reg.conv
      };
    }
    conv.estado = reg.conv.estado;
    slots.carrito = reg.conv.slots?.carrito || slots.carrito;
    slots.idCliente = reg.conv.slots?.idCliente || slots.idCliente;
  }

  let buffer;
  try {
    buffer = Buffer.from(adj.base64, 'base64');
  } catch {
    return {
      respuesta: 'No pude leer el archivo. Intenta enviarlo de nuevo.',
      conv: { estado: 'cotiz_activa', slots, candidatos: [] }
    };
  }

  let parsed;
  try {
    parsed = await extraerItemsDeArchivo(buffer, adj.fileName || (esPdf ? 'lista.pdf' : 'lista.xlsx'));
  } catch (err) {
    console.error('whatsappBotListaArchivo parse:', err.message);
    return {
      respuesta: mensajeErrorParse(err.code),
      conv: { estado: 'cotiz_activa', slots, candidatos: [] }
    };
  }

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  if (!items.length) {
    return {
      respuesta: mensajeErrorParse('EXCEL_SIN_DATOS'),
      conv: { estado: 'cotiz_activa', slots, candidatos: [] }
    };
  }

  const stats = await whatsappBotCatalogo.statusCatalogo(idEmpresa);
  if (!stats?.total || Number(stats.total) === 0) {
    return {
      respuesta: [
        'Leí tu archivo correctamente, pero el catálogo del bot está vacío.',
        'Un administrador debe sincronizar el catálogo en *Configuración → Bot WhatsApp* y volver a intentar.'
      ].join('\n'),
      conv: { estado: 'cotiz_activa', slots, candidatos: [] }
    };
  }

  const { propuestas, noEncontrados } = await armarPropuestasDesdeArchivo(idEmpresa, items);

  if (!propuestas.length) {
    const muestra = items
      .slice(0, 4)
      .map((it) => `• ${it.descripcion}`)
      .join('\n');
    return {
      respuesta: [
        `Leí *${items.length}* línea(s) pero no ubiqué productos en el catálogo (${stats.total} indexados).`,
        '',
        '*Lo que leí:*',
        muestra,
        '',
        'Usa nombres más parecidos a los del sistema o escribe producto por producto.'
      ].join('\n'),
      conv: { estado: 'cotiz_activa', slots, candidatos: [] }
    };
  }

  slots.listaPendiente = propuestas;

  return {
    respuesta: formatearMensajeConfirmacionLista(propuestas, noEncontrados, parsed.source),
    conv: { estado: 'cotiz_confirmar_lista', slots, candidatos: [] },
    reaccion: '📋'
  };
}

module.exports = {
  extraerItemsDeArchivo,
  armarPropuestasDesdeArchivo,
  aplicarPropuestasAlCarrito,
  procesarAdjuntoCotizacion,
  procesarConfirmacionLista,
  procesarElegirOpcionLista,
  formatearMensajeConfirmacionLista,
  MAX_BYTES
};
