const geminiClient = require('../utils/gemini.client');
const {
  GUIA_EFAFERP,
  pareceDiagnostico,
  textoDiagnostico,
  respuestaGuiaLocal,
  sanitizarFotoPantalla,
  redactarMensajeUsuario,
  armarContextoGuia
} = require('../utils/asistenteDueno.conocimiento');
const diagnosticoRepo = require('../repositories/asistenteDuenoDiagnostico.repository');
const { withPool } = require('../utils/dbPool.util');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MENSAJE = 2000;
const MAX_HISTORIAL = 10;
const MAX_RONDAS_TOOLS = 3;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'diagnosticar_empresa',
        description:
          'Revisa qué le falta a la empresa del usuario (productos, sucursales, certificado SUNAT, usuario SOL, series). Usar cuando el usuario no sabe qué está mal o pregunta por configuración.',
        parameters: {
          type: 'OBJECT',
          properties: {
            motivo: {
              type: 'STRING',
              description: 'Qué reporta el usuario (opcional).'
            }
          }
        }
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

async function ejecutarTool(nombre, idEmpresa) {
  if (nombre === 'diagnosticar_empresa') {
    return withPool((pool) => diagnosticoRepo.diagnosticarEmpresa(pool, idEmpresa));
  }
  return { error: 'Herramienta no permitida' };
}

function textoDePartes(parts) {
  return parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('\n')
    .trim();
}

async function responderConGuiaLocal(idEmpresa, texto, ruta, foto, historial) {
  if (pareceDiagnostico(texto)) {
    const diag = await withPool((pool) => diagnosticoRepo.diagnosticarEmpresa(pool, idEmpresa));
    return { respuesta: textoDiagnostico(diag), origen: 'local' };
  }
  return { respuesta: respuestaGuiaLocal(texto, ruta, foto, historial), origen: 'local' };
}

async function responderConGemini(idEmpresa, texto, historial, ruta, titulo, foto) {
  const contextoPantalla = armarContextoGuia(foto, ruta, titulo, texto, historial);
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
      const resultado = await ejecutarTool(nombre, idEmpresa);
      fnParts.push({
        functionResponse: {
          name: nombre,
          response: resultado
        }
      });
    }
    contents.push({ role: 'user', parts: fnParts });
  }

  const respuesta =
    textoDePartes(lastParts) || 'No pude armar una respuesta. Intente de nuevo o abra el Centro de ayuda.';
  return { respuesta, origen: 'gemini' };
}

async function chat(idEmpresa, { mensaje, historial, rutaActual, tituloPagina, fotoPantalla }) {
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

  if (!geminiClient.resolverApiKey()) {
    return responderConGuiaLocal(idEmpresa, texto, ruta, foto, historial);
  }
  try {
    return await responderConGemini(idEmpresa, texto, historial, ruta, titulo, foto);
  } catch (err) {
    if (err.code !== 'GEMINI_NO_CONFIG') {
      console.error('asistenteDueno.gemini:', err.message);
    }
    return responderConGuiaLocal(idEmpresa, texto, ruta, foto, historial);
  }
}

function estadoConfig() {
  const gemini = !!geminiClient.resolverApiKey();
  return { configurado: true, gemini };
}

module.exports = { chat, estadoConfig };
