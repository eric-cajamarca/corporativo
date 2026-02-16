/**
 * Utilidad para guardar JSON de comprobantes en la carpeta DATA del Facturador SUNAT.
 * La ruta base se configura por empresa en ConfiguracionFacturacionElectronica.rutaCarpetaFacturadorSunat.
 * Estructura fija: [rutaBase]/sunat_archivos/sfs/DATA/ (según instructivo del Facturador Sunat).
 */

const path = require("path");
const fs = require("fs");

const SUBRUTA_DATA = path.join("sunat_archivos", "sfs", "DATA");
const SUBRUTA_RPTA = path.join("sunat_archivos", "sfs", "RPTA");
const SUBRUTA_FIRMA = path.join("sunat_archivos", "sfs", "Firma");

/**
 * Obtiene la ruta absoluta de la carpeta DATA del Facturador para la ruta base dada.
 * @param {string} rutaCarpetaFacturadorSunat - Ruta de la carpeta padre del facturador (ej: D:\SFS_v1.2)
 * @returns {string|null} Ruta absoluta a .../sunat_archivos/sfs/DATA o null si ruta base vacía
 */
function getRutaDataFacturador(rutaCarpetaFacturadorSunat) {
  if (!rutaCarpetaFacturadorSunat || typeof rutaCarpetaFacturadorSunat !== "string") {
    return null;
  }
  const ruta = rutaCarpetaFacturadorSunat.trim();
  if (ruta.length === 0) return null;
  return path.join(ruta, SUBRUTA_DATA);
}

/**
 * Asegura que exista la carpeta DATA (y sus padres). No lanza si la ruta base es inválida.
 * @param {string} rutaCarpetaFacturadorSunat - Ruta de la carpeta padre del facturador
 * @returns {string|null} Ruta absoluta a DATA o null
 */
function asegurarCarpetaData(rutaCarpetaFacturadorSunat) {
  const rutaData = getRutaDataFacturador(rutaCarpetaFacturadorSunat);
  if (!rutaData) return null;
  try {
    fs.mkdirSync(rutaData, { recursive: true });
    return rutaData;
  } catch (err) {
    console.error("facturadorSunat.util: error al crear carpeta DATA:", err);
    return null;
  }
}

/**
 * Genera el nombre de archivo según especificación SUNAT: RUC-TT-SERIE-NUMERO.json
 * Para resumen diario (RC) o comunicación de baja (RA): RUC-TT-YYYYMMDD-CORREL.json
 * @param {object} opts - { ruc, tipoComprobante, serie, numero } o { ruc, tipoResumen, fechaYYYYMMDD, correlativo }
 * @returns {string} Nombre del archivo con extensión .json
 */
function nombreArchivoComprobante(opts) {
  const { ruc } = opts;
  if (!ruc) return "";
  const rucStr = String(ruc).trim().padStart(11, "0");
  if (opts.tipoResumen) {
    const tt = opts.tipoResumen; // RC | RA
    const fecha = opts.fechaYYYYMMDD || "";
    const correl = String(opts.correlativo ?? 1).padStart(5, "0");
    return `${rucStr}-${tt}-${fecha}-${correl}.json`;
  }
  const tt = opts.tipoComprobante || "01";
  const serie = String(opts.serie || "").trim();
  const numero = String(opts.numero ?? "").replace(/\D/g, "").padStart(8, "0");
  return `${rucStr}-${tt}-${serie}-${numero}.json`;
}

/**
 * Escribe el JSON del comprobante en la carpeta DATA del Facturador.
 * Mantiene la estructura de carpetas: [rutaBase]/sunat_archivos/sfs/DATA/[nombreArchivo].
 * @param {string} rutaCarpetaFacturadorSunat - Ruta de la carpeta padre del facturador
 * @param {string} nombreArchivo - Nombre del archivo (ej: 20100066603-01-F001-1.json)
 * @param {object} datosJson - Objeto a serializar como JSON (sin _comentario si se desea)
 * @returns {{ ok: boolean, rutaEscrita?: string, error?: string }}
 */
function escribirComprobanteJson(rutaCarpetaFacturadorSunat, nombreArchivo, datosJson) {
  const rutaData = asegurarCarpetaData(rutaCarpetaFacturadorSunat);
  if (!rutaData) {
    return { ok: false, error: "Ruta del Facturador no configurada o inválida" };
  }
  if (!nombreArchivo || !datosJson) {
    return { ok: false, error: "Faltan nombre de archivo o datos JSON" };
  }
  const nombre = nombreArchivo.endsWith(".json") ? nombreArchivo : `${nombreArchivo}.json`;
  const rutaCompleta = path.join(rutaData, nombre);
  try {
    const contenido = JSON.stringify(datosJson, null, 2);
    fs.writeFileSync(rutaCompleta, contenido, { encoding: "utf8" });
    return { ok: true, rutaEscrita: rutaCompleta };
  } catch (err) {
    console.error("facturadorSunat.util: error al escribir JSON:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * Escribe los archivos planos (.CAB, .DET, .TRI, .LEY, .ACA, .DPA, .PAG) en la carpeta DATA del Facturador SFS.
 * @param {string} rutaCarpetaFacturadorSunat - Ruta de la carpeta padre del facturador
 * @param {string} base - Nombre base sin extensión (ej: 20614636930-03-B001-00000008)
 * @param {{ cab?, det?, tri?, ley?, aca?, dpa?, pag? }} contenidos - Contenido de cada archivo
 * @returns {{ ok: boolean, error?: string }}
 */
function escribirArchivosPlanos(rutaCarpetaFacturadorSunat, base, contenidos) {
  const rutaData = asegurarCarpetaData(rutaCarpetaFacturadorSunat);
  if (!rutaData) return { ok: false, error: "Ruta del Facturador no configurada o inválida" };
  if (!base || !contenidos) return { ok: false, error: "Faltan base o contenidos" };
  const nombreBase = base.endsWith(".json") ? base.replace(/\.json$/i, "") : base;
  const ext = [".CAB", ".DET", ".TRI", ".LEY", ".ACA", ".DPA", ".PAG"];
  const keys = ["cab", "det", "tri", "ley", "aca", "dpa", "pag"];
  try {
    for (let i = 0; i < ext.length; i++) {
      const contenido = contenidos[keys[i]];
      if (contenido == null) continue;
      const rutaCompleta = path.join(rutaData, nombreBase + ext[i]);
      fs.writeFileSync(rutaCompleta, String(contenido), { encoding: "utf8" });
    }
    return { ok: true };
  } catch (err) {
    console.error("facturadorSunat.util: error al escribir archivos planos:", err.message);
    return { ok: false, error: err.message };
  }
}

function getRutaRptaFacturador(rutaCarpetaFacturadorSunat) {
  if (!rutaCarpetaFacturadorSunat || typeof rutaCarpetaFacturadorSunat !== "string") return null;
  const ruta = rutaCarpetaFacturadorSunat.trim();
  if (ruta.length === 0) return null;
  return path.join(ruta, SUBRUTA_RPTA);
}

/**
 * Ruta de la carpeta Firma del Facturador (XML generados y firmados).
 */
function getRutaFirmaFacturador(rutaCarpetaFacturadorSunat) {
  if (!rutaCarpetaFacturadorSunat || typeof rutaCarpetaFacturadorSunat !== "string") return null;
  const ruta = rutaCarpetaFacturadorSunat.trim();
  if (ruta.length === 0) return null;
  return path.join(ruta, SUBRUTA_FIRMA);
}

/**
 * Asegura que exista la carpeta Firma (donde se guardan los XML firmados).
 * @param {string} rutaCarpetaFacturadorSunat - Ruta de la carpeta padre del facturador
 * @returns {string|null} Ruta absoluta a Firma o null
 */
function asegurarCarpetaFirma(rutaCarpetaFacturadorSunat) {
  const rutaFirma = getRutaFirmaFacturador(rutaCarpetaFacturadorSunat);
  if (!rutaFirma) return null;
  try {
    fs.mkdirSync(rutaFirma, { recursive: true });
    return rutaFirma;
  } catch (err) {
    console.error("facturadorSunat.util: error al crear carpeta Firma:", err.message);
    return null;
  }
}

/**
 * Escribe el XML del comprobante en la carpeta Firma del Facturador.
 * El Facturador puede enviar a SUNAT el XML que esté en esta carpeta.
 * @param {string} rutaCarpetaFacturadorSunat - Ruta base del Facturador
 * @param {string} base - Nombre base sin extensión (ej: 20100066603-01-F001-00000001)
 * @param {string} contenidoXml - Contenido del XML (UBL 2.1 firmado o no)
 * @returns {{ ok: boolean, rutaEscrita?: string, error?: string }}
 */
function escribirXmlFirma(rutaCarpetaFacturadorSunat, base, contenidoXml) {
  const rutaFirma = asegurarCarpetaFirma(rutaCarpetaFacturadorSunat);
  if (!rutaFirma) return { ok: false, error: "Ruta del Facturador no configurada o inválida" };
  if (!base || contenidoXml == null) return { ok: false, error: "Faltan base o contenido XML" };
  const nombreBase = base.endsWith(".xml") ? base.replace(/\.xml$/i, "") : base;
  const nombre = `${nombreBase}.xml`;
  const rutaCompleta = path.join(rutaFirma, nombre);
  try {
    fs.writeFileSync(rutaCompleta, String(contenidoXml), { encoding: "utf8" });
    return { ok: true, rutaEscrita: rutaCompleta };
  } catch (err) {
    console.error("facturadorSunat.util: error al escribir XML en Firma:", err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Lee el contenido del XML del comprobante desde la carpeta Firma.
 * @param {string} rutaCarpetaFacturadorSunat - Ruta base del Facturador
 * @param {string} base - Nombre base sin extensión (ej: 20100066603-01-F001-00000001)
 * @returns {{ ok: boolean, contenido?: string, error?: string }}
 */
function leerXmlComprobante(rutaCarpetaFacturadorSunat, base) {
  const rutaFirma = getRutaFirmaFacturador(rutaCarpetaFacturadorSunat);
  if (!rutaFirma) return { ok: false, error: "Ruta del Facturador no configurada" };
  const nombre = base.endsWith(".xml") ? base : `${base}.xml`;
  const rutaCompleta = path.join(rutaFirma, nombre);
  if (!fs.existsSync(rutaCompleta)) return { ok: false, error: "Archivo XML no encontrado" };
  try {
    const contenido = fs.readFileSync(rutaCompleta, "utf8");
    return { ok: true, contenido };
  } catch (err) {
    console.error("facturadorSunat.util: error al leer XML:", err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  getRutaDataFacturador,
  getRutaRptaFacturador,
  getRutaFirmaFacturador,
  asegurarCarpetaData,
  asegurarCarpetaFirma,
  nombreArchivoComprobante,
  escribirComprobanteJson,
  escribirArchivosPlanos,
  escribirXmlFirma,
  leerXmlComprobante,
  SUBRUTA_DATA,
  SUBRUTA_RPTA,
  SUBRUTA_FIRMA
};
