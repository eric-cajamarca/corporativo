/**
 * Job en segundo plano: envío automático a SUNAT cada X minutos.
 * Solo procesa empresas con envioAutomatico = 1 y ruta del Facturador configurada.
 * Evita solapamiento: si un ciclo aún corre, el siguiente tick se omite.
 */

const { withPool } = require("../utils/dbPool.util");
const FacturacionServices = require("../services/facturacion.service");
const debugSunatLog = require("../utils/debugSunatLog.util");

const INTERVALO_MS = Math.max(
  30_000,
  parseInt(process.env.ENVIO_SUNAT_JOB_INTERVAL_MS || String(60 * 1000), 10) || 60 * 1000
);

let intervaloId = null;
let ejecucionEnCurso = false;

async function ejecutarEnvio() {
  if (ejecucionEnCurso) {
    console.error("[SUNAT] envioSunat.job: ciclo anterior aún en curso; omiso");
    return;
  }
  ejecucionEnCurso = true;
  console.error("[SUNAT] envioSunat.job: ejecutarEnvio inicio");
  debugSunatLog.write({ location: "envioSunat.job.ejecutarEnvio", message: "inicio", data: { intervaloMs: INTERVALO_MS } });
  try {
    await withPool(async (pool) => {
      const resultados = await FacturacionServices.ejecutarEnvioAutomaticoService(pool);
      const conEnvio = resultados.filter((r) => r.enviados > 0 || r.errores > 0);
      const pendientesReintento = resultados.filter((r) => r.reintentosProgramados > 0);
      const jobData = {
        total: resultados.length,
        conEnvio: conEnvio.length,
        pendientesReintento: pendientesReintento.length,
        resultados
      };
      console.error("[SUNAT] envioSunat.job: resultados", jobData);
      debugSunatLog.write({ location: "envioSunat.job.ejecutarEnvio", message: "resultados", data: jobData });
      if (conEnvio.length > 0 || pendientesReintento.length > 0) {
        console.error("Envío automático SUNAT:", JSON.stringify(jobData));
      }
    });
  } catch (err) {
    console.error("contexto: Job envío automático SUNAT:", err);
  } finally {
    ejecucionEnCurso = false;
  }
}

function iniciar() {
  if (intervaloId) return;
  intervaloId = setInterval(ejecutarEnvio, INTERVALO_MS);
  console.error(`Job envío automático SUNAT: iniciado (cada ${INTERVALO_MS / 1000}s, ENVIO_SUNAT_JOB_INTERVAL_MS)`);
}

function detener() {
  if (intervaloId) {
    clearInterval(intervaloId);
    intervaloId = null;
    console.error("Job envío automático SUNAT: detenido");
  }
}

module.exports = { iniciar, detener, ejecutarEnvio };
