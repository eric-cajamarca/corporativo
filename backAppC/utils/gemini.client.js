/**
 * Cliente REST de Gemini (sin SDK). La API key nunca se registra en logs.
 */

function resolverApiKey() {
  const a = String(process.env.GEMINI_API_KEY_ASISTENTE || '').trim();
  const g = String(process.env.GEMINI_API_KEY || '').trim();
  return a || g;
}

/** Preventa WhatsApp (empresa principal). Puede ser la misma key u otra. */
function resolverApiKeyBot() {
  const b = String(process.env.GEMINI_API_KEY_BOT || '').trim();
  return b || resolverApiKey();
}

function modelosCandidatos() {
  const preferido = String(process.env.GEMINI_MODEL || '').trim();
  const lista = [
    preferido,
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite'
  ];
  return [...new Set(lista.filter(Boolean))];
}

function esSaturacionOModeloInvalido(err) {
  const st = Number(err.status) || 0;
  const msg = String(err.message || '').toLowerCase();
  if (st === 404 || st === 429 || st === 503) return true;
  if (msg.includes('no longer available') || msg.includes('not found') || msg.includes('not supported')) {
    return true;
  }
  if (msg.includes('high demand') || msg.includes('try again later') || msg.includes('unavailable')) {
    return true;
  }
  if (st === 400) return true;
  return false;
}

async function postGenerate(model, apiKey, payload) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(payload)
  });
  const raw = await res.text();
  let json;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    json = { error: { message: raw.slice(0, 300) } };
  }
  if (!res.ok) {
    const msg = json.error?.message || `Gemini HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return json;
}

function extraerPartes(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts : [];
}

/**
 * @param {{ systemInstruction: string, contents: object[], tools?: object[], apiKey?: string, generationConfig?: object }} opts
 */
async function generateConHerramientas(opts) {
  const apiKey = String(opts.apiKey || resolverApiKey()).trim();
  if (!apiKey) {
    const e = new Error('Asistente no configurado: falta GEMINI_API_KEY en el servidor.');
    e.code = 'GEMINI_NO_CONFIG';
    throw e;
  }
  const payload = {
    systemInstruction: { parts: [{ text: opts.systemInstruction }] },
    contents: opts.contents,
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 1024,
      ...(opts.generationConfig || {})
    }
  };
  if (opts.tools && opts.tools.length) {
    payload.tools = opts.tools;
  }

  let lastErr = null;
  for (const model of modelosCandidatos()) {
    try {
      const data = await postGenerate(model, apiKey, payload);
      return { data, model };
    } catch (err) {
      lastErr = err;
      if (esSaturacionOModeloInvalido(err)) {
        console.error('gemini.client modelo no disponible, siguiente:', model, err.message);
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('No se pudo contactar Gemini.');
}

module.exports = {
  resolverApiKey,
  resolverApiKeyBot,
  generateConHerramientas,
  extraerPartes
};
