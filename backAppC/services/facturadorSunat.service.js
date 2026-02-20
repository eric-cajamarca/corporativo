/**
 * Servicio para interactuar con el Facturador SUNAT (SFS): actualizar bandeja, generar XML, enviar a SUNAT y leer CDR.
 * Basado en la lógica de EnvioSunat/enviaSunatFiltro.js.
 */

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const axios = require("axios");
const JSZip = require("jszip");
const { getRutaRptaFacturador } = require("../utils/facturadorSunat.util");
const debugSunatLog = require("../utils/debugSunatLog.util");

const URL_FACTURADOR_DEFAULT = "http://localhost:9000";

const ENDPOINTS = {
  "00": { A: "/api/ActualizarPantalla.htm" },
  "01": { S: "/api/GenerarComprobante.htm", M: "/api/GenerarComprobante.htm", M1: "/api/enviarXML.htm" },
  "03": { S: "/api/GenerarComprobante.htm", M: "/api/GenerarComprobante.htm", M1: "/api/enviarXML.htm" },
  "07": { S: "/api/GenerarComprobante.htm", M: "/api/GenerarComprobante.htm", M1: "/api/enviarXML.htm" },
  "08": { S: "/api/GenerarComprobante.htm", M: "/api/GenerarComprobante.htm", M1: "/api/enviarXML.htm" }
};

function getUrlFacturador(baseUrl, tipoDoc, modo) {
  const urlBase = (baseUrl || URL_FACTURADOR_DEFAULT).replace(/\/$/, "");
  const e = ENDPOINTS[tipoDoc] || ENDPOINTS["01"];
  const ep = e[modo] || e.M1;
  return `${urlBase}${ep}`;
}

function bodyJSON(ruc, tipoDoc, serie, numero) {
  const rucStr = String(ruc).trim().padStart(11, "0");
  const tipStr = String(tipoDoc).trim();
  const serieStr = String(serie || "").trim();
  const numeroStr = String(numero ?? "").replace(/\D/g, "").padStart(8, "0");
  return {
    num_ruc: rucStr,
    tip_docu: tipStr,
    num_docu: `${serieStr}-${numeroStr}`
  };
}

/**
 * Mapea ResponseCode del CDR a idEstadoSunat (EstadosSunat).
 * 1 Aceptado, 2 Enviado a SUNAT, 3 Aceptado con observaciones, 4 Rechazado, 6 Error de envío.
 */
function responseCodeToIdEstadoSunat(code) {
  const c = String(code).trim();
  if (c === "0") return 1; // Aceptado
  if (c === "1" || c === "2") return 3; // Aceptado con observaciones (advertencias)
  return 4; // Rechazado u otro
}

const NOMBRE_BAT_FACTURADOR = "EjecutarSFS.bat";
const SEGUNDOS_ESPERA_DESPUES_BAT = 15;

/**
 * Ejecuta EjecutarSFS.bat en la carpeta raíz del Facturador SUNAT (inicia el Facturador si no está corriendo).
 * @param {string} rutaCarpetaFacturadorSunat - Ruta completa de la carpeta del Facturador
 * @returns {Promise<boolean>} true si se lanzó el bat correctamente
 */
function ejecutarFacturadorBat(rutaCarpetaFacturadorSunat) {
  if (!rutaCarpetaFacturadorSunat || typeof rutaCarpetaFacturadorSunat !== "string") return Promise.resolve(false);
  const ruta = path.resolve(rutaCarpetaFacturadorSunat.trim());
  const batPath = path.join(ruta, NOMBRE_BAT_FACTURADOR);
  if (!fs.existsSync(batPath)) {
    console.error("facturadorSunat.service: no se encontró", NOMBRE_BAT_FACTURADOR, "en", ruta);
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const child = spawn("cmd.exe", ["/c", batPath], {
      cwd: ruta,
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    console.error("facturadorSunat.service: se ejecutó", NOMBRE_BAT_FACTURADOR, "en", ruta);
    resolve(true);
  });
}

/**
 * Actualiza la bandeja del Facturador. Devuelve la respuesta para inspeccionar errores (ej. Error al firma).
 * @returns {Promise<{ listaBandejaFacturador?: Array }>}
 */
async function actualizarBandeja(baseUrl) {
  const url = getUrlFacturador(baseUrl, "00", "A");
  const res = await axios.post(url, {}, { timeout: 15000, validateStatus: () => true });
  if (res.status !== 200) {
    console.error("facturadorSunat.service: actualizarBandeja status", res.status, res.data);
  }
  return res.data || {};
}

/**
 * Genera el XML del comprobante en el Facturador.
 */
async function generarXml(baseUrl, ruc, tipoDoc, serie, numero) {
  const url = getUrlFacturador(baseUrl, tipoDoc, "M");
  const body = bodyJSON(ruc, tipoDoc, serie, numero);
  if (process.env.DEBUG_FACTURADOR) {
    console.error("facturadorSunat.service: generarXml", url, body);
  }
  const res = await axios.post(url, body, { timeout: 30000, headers: { "Content-Type": "application/json" } });
  if (res.status < 200 || res.status >= 300) {
    console.error("facturadorSunat.service: generarXml status", res.status, res.data);
    throw new Error(res.data?.message || res.data?.Message || `Generar XML falló: ${res.status}`);
  }
  return res.data;
}

/**
 * Envía el XML a SUNAT desde el Facturador.
 */
async function enviarXml(baseUrl, ruc, tipoDoc, serie, numero) {
  const url = getUrlFacturador(baseUrl, tipoDoc, "M1");
  const body = bodyJSON(ruc, tipoDoc, serie, numero);
  if (process.env.DEBUG_FACTURADOR) {
    console.error("facturadorSunat.service: enviarXml", url, body);
  }
  const res = await axios.post(url, body, { timeout: 60000, headers: { "Content-Type": "application/json" } });
  if (res.status < 200 || res.status >= 300) {
    console.error("facturadorSunat.service: enviarXml status", res.status, res.data);
    throw new Error(res.data?.message || res.data?.Message || `Enviar XML falló: ${res.status}`);
  }
  return res.data;
}

/**
 * Lee el CDR desde la carpeta RPTA (archivo R{base}.zip).
 * Prueba primero RPTA y luego RPTA/cdr/ (Facturador SFS v1.4 escribe en subcarpeta cdr).
 * @returns {Promise<{ codigo: string, descripcion: string, xml?: string } | null>}
 */
async function leerCDR(rutaCarpetaFacturadorSunat, base) {
  const rptaDir = getRutaRptaFacturador(rutaCarpetaFacturadorSunat);
  if (!rptaDir) return null;
  const partes = base.split("-");
  const ultimo = partes[partes.length - 1];
  const baseCorto = ultimo ? partes.slice(0, -1).join("-") + "-" + String(Number(ultimo) || ultimo) : base;
  const candidatos = [
    path.join(rptaDir, `R${base}.zip`),
    path.join(rptaDir, "cdr", `R${base}.zip`),
    path.join(rptaDir, `R${baseCorto}.zip`),
    path.join(rptaDir, "cdr", `R${baseCorto}.zip`)
  ];
  let zipPath = null;
  for (const p of candidatos) {
    if (fs.existsSync(p)) {
      zipPath = p;
      break;
    }
  }
  if (!zipPath) return null;

  try {
    const buffer = fs.readFileSync(zipPath);
    const zip = await JSZip.loadAsync(buffer);
    const names = Object.keys(zip.files);
    const xmlName = names.find((n) => n.endsWith(".xml"));
    if (!xmlName) return null;
    const xmlContent = await zip.files[xmlName].async("string");
    const codeMatch = xmlContent.match(/<cbc:ResponseCode>(.*?)<\/cbc:ResponseCode>/);
    const descMatch = xmlContent.match(/<cbc:Description>(.*?)<\/cbc:Description>/);
    return {
      codigo: codeMatch ? codeMatch[1].trim() : "???",
      descripcion: descMatch ? descMatch[1].trim() : "Sin descripción",
      xml: xmlContent
    };
  } catch (err) {
    console.error("facturadorSunat.service: error al leer CDR:", err.message);
    return null;
  }
}

/**
 * Flujo completo: actualizar bandeja, generar XML, enviar a SUNAT, leer CDR.
 * @param {object} opts - { baseUrl, rutaCarpetaFacturadorSunat, ruc, tipoComprobante, serie, numero }
 * @returns {Promise<{ ok: boolean, idEstadoSunat?: number, codigoRespuesta?: string, descripcionRespuesta?: string, cdr?: string, error?: string }>}
 */
/**
 * Si la bandeja indica "Error al firma" para el comprobante (base), devuelve mensaje explicando causa y alternativas.
 * El error lo reporta la aplicación Facturador SFS (local): no tiene certificado configurado o la clave es incorrecta.
 * @param {{ listaBandejaFacturador?: Array }} bandeja - Respuesta de actualizarBandeja
 * @param {string} base - Nombre base del comprobante (ej: 20614636930-03-B001-00000030)
 * @returns {string|null} Mensaje de error o null si no aplica
 */
function mensajeErrorFirmaFacturador(bandeja, base) {
  const lista = bandeja?.listaBandejaFacturador;
  if (!Array.isArray(lista)) return null;
  const item = lista.find((i) => (i.nom_arch || "").trim() === base);
  const desObs = (item?.des_obse || "").trim();
  if (!desObs || (!desObs.toLowerCase().includes("firma") && !desObs.includes("Error al firma"))) return null;
  return (
    "El Facturador SFS (aplicación local) no pudo firmar el XML (" +
    desObs +
    "). Suele deberse a que el certificado digital no está configurado en el Facturador o la contraseña es incorrecta. " +
    "Solución 1: Abra el programa Facturador SFS, vaya a su configuración y asigne el certificado digital (.pfx) y su clave. " +
    "Solución 2: Cargue el certificado en esta aplicación (Configuración > Facturación) y use la opción 'Enviar con XML firmado por la aplicación' si está disponible en la pantalla de envío."
  );
}

function esErrorConexionFacturador(err) {
  const code = err.code || "";
  const msg = (err.message || "").toLowerCase();
  return (
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    msg.includes("conexión") ||
    msg.includes("connection") ||
    msg.includes("network")
  );
}

async function ejecutarFlujoEnvio(baseUrl, rutaCarpetaFacturadorSunat, ruc, tipoComprobante, serie, numero) {
  const rucStr = String(ruc).trim().padStart(11, "0");
  const tipoStr = String(tipoComprobante).trim();
  const serieStr = String(serie || "").trim();
  const numeroStr = String(numero ?? "").replace(/\D/g, "").padStart(8, "0");
  const base = `${rucStr}-${tipoStr}-${serieStr}-${numeroStr}`;
  if (process.env.DEBUG_FACTURADOR) {
    console.error("facturadorSunat.service: base comprobante", base);
  }
  await actualizarBandeja(baseUrl);
  await generarXml(baseUrl, rucStr, tipoStr, serieStr, numeroStr);
  const bandejaDespuesGenerar = await actualizarBandeja(baseUrl);
  const errorFirma = mensajeErrorFirmaFacturador(bandejaDespuesGenerar, base);
  if (errorFirma) {
    return { ok: false, error: errorFirma, idEstadoSunat: 6 };
  }
  await enviarXml(baseUrl, rucStr, tipoStr, serieStr, numeroStr);
  await actualizarBandeja(baseUrl);
  const resultado = await leerYDevolverCDR(rutaCarpetaFacturadorSunat, base);
  if (resultado.ok) await actualizarBandeja(baseUrl);
  return resultado;
}

/**
 * Flujo cuando el XML ya está en la carpeta Firma (generado por nuestro módulo UBL).
 * Solo actualiza bandeja, envía el XML a SUNAT y lee el CDR. No genera XML desde DATA.
 */
async function ejecutarFlujoSoloEnvio(baseUrl, rutaCarpetaFacturadorSunat, ruc, tipoComprobante, serie, numero) {
  const rucStr = String(ruc).trim().padStart(11, "0");
  const tipoStr = String(tipoComprobante).trim();
  const serieStr = String(serie || "").trim();
  const numeroStr = String(numero ?? "").replace(/\D/g, "").padStart(8, "0");
  const base = `${rucStr}-${tipoStr}-${serieStr}-${numeroStr}`;
  if (process.env.DEBUG_FACTURADOR) {
    console.error("facturadorSunat.service: flujo solo envío (XML en Firma)", base);
  }
  await actualizarBandeja(baseUrl);
  await enviarXml(baseUrl, rucStr, tipoStr, serieStr, numeroStr);
  await actualizarBandeja(baseUrl);
  const resultado = await leerYDevolverCDR(rutaCarpetaFacturadorSunat, base);
  if (resultado.ok) await actualizarBandeja(baseUrl);
  return resultado;
}

async function leerYDevolverCDR(rutaCarpetaFacturadorSunat, base) {
  const rptaDir = getRutaRptaFacturador(rutaCarpetaFacturadorSunat);
  const zipNombre = `R${base}.zip`;
  let cdr = null;
  for (let intento = 0; intento < 4; intento++) {
    await new Promise((r) => setTimeout(r, intento === 0 ? 5000 : 3000));
    cdr = await leerCDR(rutaCarpetaFacturadorSunat, base);
    if (cdr) break;
  }
  if (!cdr) {
    const zipPath = rptaDir ? path.join(rptaDir, zipNombre) : zipNombre;
    let contenidoRpta = [];
    if (rptaDir && fs.existsSync(rptaDir)) {
      try {
        contenidoRpta = fs.readdirSync(rptaDir);
      } catch (_) {
        contenidoRpta = ["(error al listar)"];
      }
    } else {
      contenidoRpta = ["(carpeta RPTA no existe)"];
    }
    console.error("facturadorSunat.service: CDR no encontrado. Ruta esperada:", zipPath, "| Contenido RPTA:", contenidoRpta.slice(0, 20));
    // #region agent log
    debugSunatLog.write({
      location: "facturadorSunat.service.leerYDevolverCDR",
      message: "CDR no encontrado",
      data: { zipPath, rptaDir, contenidoRpta: contenidoRpta.slice(0, 30), base }
    });
    // #endregion
    const errorDetalle = `No se encontró CDR después del envío. Ruta esperada: ${zipPath}. Carpeta RPTA: ${(contenidoRpta.length > 0 ? contenidoRpta.slice(0, 10).join(", ") : "vacía o inaccesible")}.`;
    return {
      ok: false,
      error: errorDetalle,
      idEstadoSunat: 6
    };
  }
  const idEstadoSunat = responseCodeToIdEstadoSunat(cdr.codigo);
  return {
    ok: true,
    idEstadoSunat,
    codigoRespuesta: cdr.codigo,
    descripcionRespuesta: cdr.descripcion,
    cdr: cdr.xml
  };
}

async function enviarComprobanteAlFacturador(opts) {
  const {
    baseUrl = URL_FACTURADOR_DEFAULT,
    rutaCarpetaFacturadorSunat,
    ruc,
    tipoComprobante,
    serie,
    numero,
    xmlYaEnFirma = false
  } = opts;

  if (!ruc || !tipoComprobante || !serie || numero === undefined) {
    return { ok: false, error: "Faltan ruc, tipoComprobante, serie o numero" };
  }

  const flujo = xmlYaEnFirma ? ejecutarFlujoSoloEnvio : ejecutarFlujoEnvio;
  try {
    return await flujo(baseUrl, rutaCarpetaFacturadorSunat, ruc, tipoComprobante, serie, numero);
  } catch (err) {
    if (esErrorConexionFacturador(err) && rutaCarpetaFacturadorSunat) {
      const lanzado = await ejecutarFacturadorBat(rutaCarpetaFacturadorSunat);
      if (lanzado) {
        await new Promise((r) => setTimeout(r, SEGUNDOS_ESPERA_DESPUES_BAT * 1000));
        try {
          return await flujo(baseUrl, rutaCarpetaFacturadorSunat, ruc, tipoComprobante, serie, numero);
        } catch (retryErr) {
          const msg = retryErr.response?.data?.message || retryErr.message || "Error de conexión con el Facturador";
          console.error("facturadorSunat.service: envío fallido tras iniciar Facturador:", msg);
          return { ok: false, error: msg, idEstadoSunat: 6 };
        }
      }
    }
    const msg = err.response?.data?.message || err.message || "Error de conexión con el Facturador";
    console.error("facturadorSunat.service: envío fallido:", msg);
    return {
      ok: false,
      error: msg,
      idEstadoSunat: 6
    };
  }
}

module.exports = {
  actualizarBandeja,
  generarXml,
  enviarXml,
  leerCDR,
  enviarComprobanteAlFacturador,
  ejecutarFlujoSoloEnvio,
  responseCodeToIdEstadoSunat,
  URL_FACTURADOR_DEFAULT
};
