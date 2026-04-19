/**
 * Job en segundo plano: consulta periódicamente los tickets de GRE pendientes.
 *
 * Flujo:
 *   1. Cada INTERVALO_MS busca guías con idEstadoSunat = 2 (EN_PROCESO) y ticketSunat != null.
 *   2. Para cada guía, obtiene token OAuth2 y llama:
 *      GET {urlBase}/v1/contribuyente/gem/comprobantes/envios/{numTicket}
 *   3. codRespuesta "98" → sigue en proceso, no hace nada.
 *      codRespuesta "0"  → actualiza a ACEPTADO (1).
 *      codRespuesta "99" → actualiza a ERROR (98) con descripción del error.
 */

const axios    = require("axios");
const { withPool } = require("../utils/dbPool.util");
const guiaRepo = require("../repositories/guiaElectronica.repository");
const { descifrar } = require("../utils/cifradoClaveCertificado.util");
const { normalizarRucSunatGre } = require("../utils/rucSunatGre.util");
const guiaElectronicaService = require("../services/guiaElectronica.service");

const INTERVALO_MS       = 30 * 1000; // 30 segundos
const SUNAT_TIMEOUT      = 15000;

const ESTADO_EN_PROCESO  = 2;
const ESTADO_ACEPTADO    = 1;
const ESTADO_ERROR       = 98;

let intervaloId = null;

async function procesarTicket(pool, guia) {
  const { idGuiaElectronica, idEmpresa, serie, numero, ticketSunat,
          urlBaseApiGuias, idApiGuias, claveApiGuias, ruc } = guia;

  // claveApiGuias viene cifrada de la BD con prefijo "enc:"
  const clientSecretDescifrado = descifrar(claveApiGuias || "") || "";

  let token;
  try {
    console.error("[GRE TICKET] OAuth2 RUC referencia:", normalizarRucSunatGre(ruc) || String(ruc || "").trim(), "| raw BD:", String(ruc || "").trim());
    token = await guiaElectronicaService.obtenerTokenGreConConfig(
      pool,
      ruc,
      idApiGuias,
      clientSecretDescifrado,
      idEmpresa
    );
  } catch (err) {
    console.error(`[GRE TICKET] OAuth2 error guía ${serie}-${numero}:`, err.message);
    return; // Reintentará en la siguiente vuelta
  }

  const url  = `${urlBaseApiGuias.replace(/\/$/, "")}/v1/contribuyente/gem/comprobantes/envios/${ticketSunat}`;
  let resp;
  try {
    const t = String(token || "").trim();
    const opts = { timeout: SUNAT_TIMEOUT, validateStatus: () => true };
    resp = await axios.get(url, { ...opts, headers: { Authorization: `Bearer ${t}`, Accept: "application/json" } });
    if (resp.status === 401) {
      resp = await axios.get(url, { ...opts, headers: { Authorization: `JWT ${t}`, Accept: "application/json" } });
    }
  } catch (err) {
    console.error(`[GRE TICKET] Red error guía ${serie}-${numero}:`, err.message);
    return;
  }

  const { codRespuesta, error } = resp.data || {};

  if (String(codRespuesta) === "98") {
    // Todavía en proceso, no hacemos nada
    return;
  }

  if (String(codRespuesta) === "0") {
    await guiaRepo.actualizarEstadoGuiaRepo(pool, idGuiaElectronica, idEmpresa, {
      idEstadoSunat    : ESTADO_ACEPTADO,
      descripcionEstado: "ACEPTADO por SUNAT",
      ticketSunat
    });
    console.error(`[GRE TICKET] Guía ${serie}-${numero} ACEPTADA por SUNAT.`);
    return;
  }

  if (String(codRespuesta) === "99") {
    const numError = error?.numError || "";
    const desError = error?.desError || "";
    await guiaRepo.actualizarEstadoGuiaRepo(pool, idGuiaElectronica, idEmpresa, {
      idEstadoSunat    : ESTADO_ERROR,
      descripcionEstado: `${numError}: ${desError}`.slice(0, 200),
      ticketSunat
    });
    console.error(`[GRE TICKET] Guía ${serie}-${numero} ERROR SUNAT: ${numError} - ${desError}`);
    return;
  }

  console.error(`[GRE TICKET] Respuesta inesperada guía ${serie}-${numero}: HTTP ${resp.status}`, resp.data);
}

async function ejecutar() {
  try {
    await withPool(async (pool) => {
      const pendientes = await guiaRepo.listarGuiasPendientesTicketRepo(pool);

      if (pendientes.length === 0) return;

      console.error(`[GRE TICKET] Consultando ${pendientes.length} ticket(s) pendiente(s)...`);

      for (const guia of pendientes) {
        await procesarTicket(pool, guia);
      }
    });
  } catch (err) {
    console.error("[GRE TICKET] Error en job guiasTicket:", err.message);
  }
}

function iniciar() {
  if (intervaloId) return;
  intervaloId = setInterval(() => {
    ejecutar().catch(err => console.error("[GRE TICKET] Error inesperado:", err.message));
  }, INTERVALO_MS);
  console.error("[GRE TICKET] Job guiasTicket iniciado. Intervalo:", INTERVALO_MS / 1000, "seg");
}

function detener() {
  if (intervaloId) {
    clearInterval(intervaloId);
    intervaloId = null;
  }
}

module.exports = { iniciar, detener };
