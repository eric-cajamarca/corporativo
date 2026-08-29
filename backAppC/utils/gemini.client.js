/**
 * Cliente REST de Gemini (sin SDK). La API key nunca se registra en logs.
 */

function resolverApiKey() {
  const a = String(process.env.GEMINI_API_KEY_ASISTENTE || '').trim();
  const g = String(process.env.GEMINI_API_KEY || '').trim();
  return a || g;
}

function modelosCandidatos() {
  const preferido = String(process.env.GEMINI_MODEL || '').trim();
  const lista = [preferido, 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];
  return [...new Set(lista.filter(Boolean))];
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
 * @param {{ systemInstruction: string, contents: object[], tools?: object[] }} opts
 */
async function generateConHerramientas(opts) {
  const apiKey = resolverApiKey();
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
      maxOutputTokens: 1024
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
      const st = Number(err.status) || 0;
      if (st === 404 || st === 400) continue;
      throw err;
    }
  }
  throw lastErr || new Error('No se pudo contactar Gemini.');
}

module.exports = {
  resolverApiKey,
  generateConHerramientas,
  extraerPartes
};
