/**
 * Job en segundo plano: envío automático a SUNAT cada X minutos.
 * Solo procesa empresas con envioAutomatico = 1 y ruta del Facturador configurada.
 */

const sql = require("mssql");
const dbConfig = require("../dbconfig");
const FacturacionServices = require("../services/facturacion.service");

const INTERVALO_MS = 10 * 60 * 1000; // 10 minutos

let intervaloId = null;

async function ejecutarEnvio() {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const resultados = await FacturacionServices.ejecutarEnvioAutomaticoService(pool);
    const conEnvio = resultados.filter((r) => r.enviados > 0 || r.errores > 0);
    if (conEnvio.length > 0) {
      console.error("Envío automático SUNAT:", JSON.stringify(conEnvio));
    }
  } catch (err) {
    console.error("Job envío automático SUNAT:", err.message);
  } finally {
    // No cerrar pool; mssql usa pool compartido
  }
}

function iniciar() {
  if (intervaloId) return;
  intervaloId = setInterval(ejecutarEnvio, INTERVALO_MS);
  console.error("Job envío automático SUNAT: iniciado (cada 10 min)");
}

function detener() {
  if (intervaloId) {
    clearInterval(intervaloId);
    intervaloId = null;
    console.error("Job envío automático SUNAT: detenido");
  }
}

module.exports = { iniciar, detener, ejecutarEnvio };
