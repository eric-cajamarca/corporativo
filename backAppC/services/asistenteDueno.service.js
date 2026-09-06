const geminiClient = require('../utils/gemini.client');
const {
  GUIA_EFAFERP,
  pareceDiagnostico,
  textoDiagnostico,
  respuestaGuiaLocal,
  sanitizarFotoPantalla,
  redactarMensajeUsuario,
  armarContextoGuia,
  filtrarEnlacesPorPermiso
} = require('../utils/asistenteDueno.conocimiento');
const {
  elegirConsultas,
  textoFicha,
  textoConsulta,
  extraerBusquedaProducto,
  extraerCompVenta
} = require('../utils/asistenteDueno.consultas');
const diagnosticoRepo = require('../repositories/asistenteDuenoDiagnostico.repository');
const consultasRepo = require('../repositories/asistenteDuenoConsultas.repository');
const { withPool } = require('../utils/dbPool.util');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MENSAJE = 2000;
const MAX_HISTORIAL = 10;
const MAX_RONDAS_TOOLS = 3;

const TOOL_A_CONSULTA = {
  consultar_caja: 'caja',
  consultar_error_sunat: 'sunat',
  consultar_stock: 'stock',
  consultar_venta: 'venta',
  consultar_guias: 'guias'
};

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'diagnosticar_empresa',
        description:
          'Revisa huecos de la empresa (productos, sucursales, certificado, SOL, series). Solo si pregunta qué le falta o "no anda" en general. No usar para caja, stock, una venta o un error SUNAT concreto.',
        parameters: {
          type: 'OBJECT',
          properties: {
            motivo: { type: 'STRING', description: 'Qué reporta el usuario (opcional).' }
          }
        }
      },
      {
        name: 'consultar_caja',
        description:
          '¿Hay caja abierta en la sucursal del usuario? Usar solo si no puede cobrar/vender o pregunta por caja abierta. No pide montos.',
        parameters: { type: 'OBJECT', properties: {} }
      },
      {
        name: 'consultar_error_sunat',
        description:
          'Último (o un) rechazo/error SUNAT: serie-número, código y mensaje corto, sin XML/CDR. Usar si rechazó, no emite o "invocar el servicio".',
        parameters: {
          type: 'OBJECT',
          properties: {
            comprobante: { type: 'STRING', description: 'Serie-número, ej. F001-88. Vacío = el más reciente con error.' }
          }
        }
      },
      {
        name: 'consultar_stock',
        description:
          '¿Hay existencias de un producto? Solo sí/no por sucursal, sin cantidades ni costo. Requiere nombre o código.',
        parameters: {
          type: 'OBJECT',
          properties: {
            producto: { type: 'STRING', description: 'Nombre o código del producto.' }
          },
          required: ['producto']
        }
      },
      {
        name: 'consultar_venta',
        description:
          'Estado de una venta (pagada/crédito/pendiente y SUNAT), sin totales. Requiere serie-número.',
        parameters: {
          type: 'OBJECT',
          properties: {
            comprobante: { type: 'STRING', description: 'Serie-número, ej. B001-15.' }
          },
          required: ['comprobante']
        }
      },
      {
        name: 'consultar_guias',
        description:
          '¿Puede emitir GRE remitente o transportista? Usar solo si pregunta por guías de remisión.',
        parameters: { type: 'OBJECT', properties: {} }
      }
    ]
  }
];

/** Rate limit en memoria: 25 mensajes / 10 min por empresa. */
const ventanas = new Map();
const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = 25;

function assertRateLimit(idEmpresa) {
  const now = Date.now();
  const prev = ventanas.get(idEmpresa) || [];
  const vivos = prev.filter((t) => now - t < VENTANA_MS);
  if (vivos.length >= MAX_POR_VENTANA) {
    const e = new Error('Demasiadas consultas al asistente. Espere unos minutos e intente de nuevo.');
    e.code = 'RATE_LIMIT';
    throw e;
  }
  vivos.push(now);
  ventanas.set(idEmpresa, vivos);
}

function sanitizarTexto(v) {
  return redactarMensajeUsuario(v).slice(0, MAX_MENSAJE);
}

function normalizarHistorial(historial) {
  if (!Array.isArray(historial)) return [];
  return historial
    .slice(-MAX_HISTORIAL)
    .map((h) => {
      const role = h?.role === 'model' ? 'model' : 'user';
      const text = sanitizarTexto(h?.text || h?.mensaje || '');
      return text ? { role, parts: [{ text }] } : null;
    })
    .filter(Boolean);
}

function sanitizarDiagnostico(diag) {
  if (!diag) return { error: 'Sin diagnóstico' };
  const fac = diag.facturacion ? { ...diag.facturacion } : {};
  delete fac.urlEnvio;
  return {
    productos: diag.productos,
    sucursales: diag.sucursales,
    clientes: diag.clientes,
    comprobantesVenta: diag.comprobantesVenta,
    facturacion: fac,
    problemas: diag.problemas || []
  };
}

function extrasDeArgs(id, args, texto) {
  const a = args && typeof args === 'object' ? args : {};
  if (id === 'stock') {
    return { busqueda: String(a.producto || extraerBusquedaProducto(texto) || '').slice(0, 40) };
  }
  if (id === 'sunat' || id === 'venta') {
    return { comp: String(a.comprobante || extraerCompVenta(texto) || '').slice(0, 20) };
  }
  return {};
}

async function ejecutarTool(nombre, idEmpresa, ficha, args, texto) {
  if (nombre === 'diagnosticar_empresa') {
    const diag = await withPool((pool) => diagnosticoRepo.diagnosticarEmpresa(pool, idEmpresa));
    return sanitizarDiagnostico(diag);
  }
  const id = TOOL_A_CONSULTA[nombre];
  if (!id) return { error: 'Herramienta no permitida' };
  return withPool((pool) => consultasRepo.ejecutarConsulta(pool, id, idEmpresa, ficha, extrasDeArgs(id, args, texto)));
}

async function resolverConsultasDinámicas(idEmpresa, texto, ruta, ficha, tope) {
  const ids = elegirConsultas(texto, ruta).slice(0, tope);
  const partes = [];
  for (const id of ids) {
    const data = await withPool((pool) =>
      consultasRepo.ejecutarConsulta(pool, id, idEmpresa, ficha, extrasDeArgs(id, {}, texto))
    );
    const linea = textoConsulta(id, data, ficha);
    if (linea) partes.push(linea);
  }
  return partes.join('\n');
}

function textoDePartes(parts) {
  return parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('\n')
    .trim();
}

async function responderConGuiaLocal(idEmpresa, texto, ruta, foto, historial, ficha) {
  const dato = await resolverConsultasDinámicas(idEmpresa, texto, ruta, ficha, 1);
  if (pareceDiagnostico(texto)) {
    const diag = await withPool((pool) => diagnosticoRepo.diagnosticarEmpresa(pool, idEmpresa));
    const cuerpo = [textoDiagnostico(diag, ficha), dato].filter(Boolean).join('\n\n');
    return { respuesta: filtrarEnlacesPorPermiso(cuerpo, ficha), origen: 'local' };
  }
  const guia = respuestaGuiaLocal(texto, ruta, foto, historial);
  const cuerpo = [dato, guia].filter(Boolean).join('\n\n');
  return { respuesta: filtrarEnlacesPorPermiso(cuerpo, ficha), origen: 'local' };
}

async function responderConGemini(idEmpresa, texto, historial, ruta, titulo, foto, ficha) {
  const dato = await resolverConsultasDinámicas(idEmpresa, texto, ruta, ficha, 2);
  const contextoPantalla = armarContextoGuia(foto, ruta, titulo, texto, historial, textoFicha(ficha), dato);
  const contents = [
    ...normalizarHistorial(historial),
    { role: 'user', parts: [{ text: `${contextoPantalla}\n\nPregunta: ${texto}` }] }
  ];

  let ronda = 0;
  let lastParts = [];
  while (ronda < MAX_RONDAS_TOOLS) {
    ronda += 1;
    const { data } = await geminiClient.generateConHerramientas({
      systemInstruction: GUIA_EFAFERP,
      contents,
      tools: TOOLS
    });
    lastParts = geminiClient.extraerPartes(data);
    const calls = lastParts.filter((p) => p.functionCall && p.functionCall.name);
    if (!calls.length) break;

    contents.push({ role: 'model', parts: lastParts });
    const fnParts = [];
    for (const c of calls) {
      const nombre = String(c.functionCall.name || '');
      const args = c.functionCall.args || {};
      const resultado = await ejecutarTool(nombre, idEmpresa, ficha, args, texto);
      fnParts.push({
        functionResponse: {
          name: nombre,
          response: resultado
        }
      });
    }
    contents.push({ role: 'user', parts: fnParts });
  }

  const crudo =
    textoDePartes(lastParts) || 'No pude armar una respuesta. Intente de nuevo o abra el Centro de ayuda.';
  return { respuesta: filtrarEnlacesPorPermiso(crudo, ficha), origen: 'gemini' };
}

async function chat(idEmpresa, { mensaje, historial, rutaActual, tituloPagina, fotoPantalla }, usuario) {
  if (!idEmpresa || !UUID_RE.test(String(idEmpresa))) {
    throw new Error('Empresa no válida.');
  }
  const texto = sanitizarTexto(mensaje);
  if (!texto) {
    throw new Error('Escriba una pregunta.');
  }
  assertRateLimit(String(idEmpresa).toLowerCase());

  const ruta = sanitizarTexto(rutaActual).slice(0, 200);
  const titulo = sanitizarTexto(tituloPagina).slice(0, 120);
  const foto = sanitizarFotoPantalla(fotoPantalla);
  const ficha = await withPool((pool) => consultasRepo.armarFicha(pool, idEmpresa, usuario || {}));

  if (!geminiClient.resolverApiKey()) {
    return responderConGuiaLocal(idEmpresa, texto, ruta, foto, historial, ficha);
  }
  try {
    return await responderConGemini(idEmpresa, texto, historial, ruta, titulo, foto, ficha);
  } catch (err) {
    if (err.code !== 'GEMINI_NO_CONFIG') {
      console.error('asistenteDueno.gemini:', err.message);
    }
    return responderConGuiaLocal(idEmpresa, texto, ruta, foto, historial, ficha);
  }
}

function estadoConfig() {
  const gemini = !!geminiClient.resolverApiKey();
  return { configurado: true, gemini };
}

module.exports = { chat, estadoConfig };
