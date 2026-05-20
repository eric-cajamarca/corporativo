/**
 * Logger de depuración del agente.
 *
 * Por defecto NO escribe a disco (no-op) para evitar I/O innecesario en
 * caliente (5+ escrituras por PDF generado).
 *
 * Para reactivar en desarrollo: DEBUG_AGENT_LOG=1 en .env.
 * Cuando se activa, escribe asíncronamente en <repo>/debug-agent.log.
 */
const fs = require('fs');
const path = require('path');

const ENABLED = process.env.DEBUG_AGENT_LOG === '1';
const LOG_PATH = path.join(__dirname, '..', '..', 'debug-agent.log');

function appendAgentDebugNdjson({ hypothesisId, runId, location, message, data }) {
  if (!ENABLED) return;
  try {
    const line = JSON.stringify({
      sessionId: 'agent',
      timestamp: Date.now(),
      hypothesisId: hypothesisId || null,
      runId: runId || null,
      location: location || '',
      message: message || '',
      data: data || {}
    });
    fs.appendFile(LOG_PATH, line + '\n', () => {});
  } catch (_) {
  }
}

module.exports = { appendAgentDebugNdjson };
