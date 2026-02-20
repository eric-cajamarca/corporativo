/**
 * Escribe una línea NDJSON en debug-39a89e.log para depuración del flujo SUNAT.
 * Uso: debugSunatLog({ location, message, data })
 */
const path = require("path");
const fs = require("fs");

const LOG_PATH = path.join(__dirname, "..", "..", "debug-39a89e.log");

function write(payload) {
  try {
    const line =
      JSON.stringify({
        sessionId: "39a89e",
        timestamp: Date.now(),
        ...payload
      }) + "\n";
    fs.appendFileSync(LOG_PATH, line);
  } catch (_) {
    // Ignorar si no se puede escribir (ej. permisos)
  }
}

module.exports = { write };
