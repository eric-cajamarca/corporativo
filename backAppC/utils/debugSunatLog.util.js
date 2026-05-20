/**
 * Logger de depuración para flujo SUNAT.
 *
 * Por defecto NO escribe a disco (no-op) para evitar bloqueos del event loop
 * por uso de fs.appendFileSync en caliente y archivos de log de gran tamaño.
 *
 * Para reactivar en desarrollo: DEBUG_SUNAT_LOG=1 en .env.
 * Cuando se activa, escribe asíncronamente (fs.appendFile) en
 * <repo>/debug-sunat.log para no bloquear el bucle de eventos.
 */
const path = require("path");
const fs = require("fs");

const ENABLED = process.env.DEBUG_SUNAT_LOG === "1";
const LOG_PATH = path.join(__dirname, "..", "..", "debug-sunat.log");

function write(payload) {
  if (!ENABLED) return;
  try {
    const line =
      JSON.stringify({
        sessionId: "sunat",
        timestamp: Date.now(),
        ...payload,
      }) + "\n";
    fs.appendFile(LOG_PATH, line, () => {});
  } catch (_) {
  }
}

module.exports = { write };
