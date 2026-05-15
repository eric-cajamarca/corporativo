/**
 * Logger de depuración para sesión de debug del agente.
 * Append NDJSON al archivo en raíz del workspace: <repo>/debug-4547ec.log
 * No registra PII (RUC completo, direcciones, etc.).
 */
const fs = require('fs');
const path = require('path');

const SESSION_ID = '4547ec';
const LOG_FILENAME = `debug-${SESSION_ID}.log`;
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LOG_PATH = path.join(REPO_ROOT, LOG_FILENAME);

function appendAgentDebugNdjson({ hypothesisId, runId, location, message, data }) {
  try {
    const line = JSON.stringify({
      sessionId: SESSION_ID,
      timestamp: Date.now(),
      hypothesisId: hypothesisId || null,
      runId: runId || null,
      location: location || '',
      message: message || '',
      data: data || {}
    });
    fs.appendFile(LOG_PATH, line + '\n', () => {});
  } catch (_) { /* nunca afectar flujo de negocio */ }
}

module.exports = { appendAgentDebugNdjson };
