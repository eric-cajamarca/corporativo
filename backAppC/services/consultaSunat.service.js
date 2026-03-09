/**
 * Consulta a SUNAT: CDR (billConsultService getStatusCdr) y validez (billValidService getStatus).
 * Usa WS-Security UsernameToken igual que el BillService de envío.
 * Referencia: manual programador, WSDL billConsultService / billValidService.
 */

const axios = require("axios");
const JSZip = require("jszip");
const envioDirectoSunat = require("./envioDirectoSunat.service");

const NS_SOAP = "http://schemas.xmlsoap.org/soap/envelope/";
const NS_WS = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd";
const NS_WSU = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd";
const NS_SUNAT = "http://service.sunat.gob.pe";

const URL_CONSULTA_CDR_PROD = "https://e-factura.sunat.gob.pe/ol-it-wsconscpegem/billConsultService";
const URL_CONSULTA_CDR_BETA = "https://e-beta.sunat.gob.pe/ol-it-wsconscpegem-beta/billConsultService";
const URL_VALIDEZ_PROD = "https://e-factura.sunat.gob.pe/ol-it-wsconsvalidcpe/billValidService";
const URL_VALIDEZ_BETA = "https://e-beta.sunat.gob.pe/ol-it-wsconsvalidcpe-beta/billValidService";

function escXml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Construye el SOAP para getStatusCdr (billConsultService).
 * Estructura según manual del programador: Envelope ser="http://service.sunat.gob.pe",
 * Header wsse:Security/UsernameToken, Body ser:getStatusCdr (rucComprobante, tipoComprobante, serieComprobante, numeroComprobante).
 * Respuesta esperada: getStatusCdrResponse > statusCdr > statusCode, content, statusMessage.
 */
function buildGetStatusCdrSoap(usuarioSOAP, claveSOAP, rucComprobante, tipoComprobante, serieComprobante, numeroComprobante) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:ser="${NS_SUNAT}">
  <soapenv:Header>
    <wsse:Security soapenv:mustUnderstand="1" xmlns:wsse="${NS_WS}" xmlns:wsu="${NS_WSU}">
      <wsse:UsernameToken wsu:Id="UsernameToken-1">
        <wsse:Username>${escXml(usuarioSOAP)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escXml(claveSOAP)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ser:getStatusCdr>
      <rucComprobante>${escXml(rucComprobante)}</rucComprobante>
      <tipoComprobante>${escXml(tipoComprobante)}</tipoComprobante>
      <serieComprobante>${escXml(serieComprobante)}</serieComprobante>
      <numeroComprobante>${escXml(numeroComprobante)}</numeroComprobante>
    </ser:getStatusCdr>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Construye el SOAP para getStatus (billValidService - validez).
 * Mismos parámetros que getStatusCdr.
 */
function buildGetStatusValidezSoap(usuarioSOAP, claveSOAP, rucComprobante, tipoComprobante, serieComprobante, numeroComprobante) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:ser="${NS_SUNAT}">
  <soapenv:Header>
    <wsse:Security soapenv:mustUnderstand="1" xmlns:wsse="${NS_WS}" xmlns:wsu="${NS_WSU}">
      <wsse:UsernameToken wsu:Id="UsernameToken-1">
        <wsse:Username>${escXml(usuarioSOAP)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escXml(claveSOAP)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ser:getStatus>
      <rucComprobante>${escXml(rucComprobante)}</rucComprobante>
      <tipoComprobante>${escXml(tipoComprobante)}</tipoComprobante>
      <serieComprobante>${escXml(serieComprobante)}</serieComprobante>
      <numeroComprobante>${escXml(numeroComprobante)}</numeroComprobante>
    </ser:getStatus>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function extraerFault(soapXml) {
  const m = soapXml.match(/<[^>]*faultstring[^>]*>([^<]*)<\//i);
  return m && m[1] ? m[1].trim() : null;
}

/**
 * Consulta el CDR de un comprobante en SUNAT (getStatusCdr).
 * @param {string} rucComprobante - RUC del emisor
 * @param {string} tipoComprobante - 01, 03, 07, 08, etc.
 * @param {string} serieComprobante - Ej. F001, B001
 * @param {string} numeroComprobante - Número (puede ser 1 o 00000001)
 * @param {string} usuarioSOAP - Usuario secundario SOL (RUC+USER o solo USER)
 * @param {string} claveSOAP - Clave SOL
 * @param {string} urlConsulta - URL del billConsultService (producción o beta)
 * @returns {Promise<{ ok: boolean, idEstadoSunat?: number, codigoRespuesta?: string, descripcionRespuesta?: string, cdr?: string, error?: string }>}
 */
async function consultarCdrSunat(rucComprobante, tipoComprobante, serieComprobante, numeroComprobante, usuarioSOAP, claveSOAP, urlConsulta) {
  const url = (urlConsulta || URL_CONSULTA_CDR_PROD).trim().replace(/\?wsdl$/i, "");
  const numeroNorm = String(numeroComprobante ?? "").replace(/\D/g, "").padStart(8, "0");
  const soapBody = buildGetStatusCdrSoap(usuarioSOAP, claveSOAP, rucComprobante, tipoComprobante, serieComprobante, numeroNorm);

  let response;
  try {
    response = await axios.post(url, soapBody, {
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "urn:getStatusCdr" },
      timeout: 30000,
      validateStatus: () => true
    });
  } catch (err) {
    console.error("consultaSunat.consultarCdrSunat: error de conexión", err.message);
    return { ok: false, error: err.message || "No se pudo conectar con SUNAT" };
  }

  const responseXml = response.data && typeof response.data === "string" ? response.data : String(response.data || "");
  const faultMsg = extraerFault(responseXml);
  if (faultMsg) {
    return { ok: false, error: faultMsg };
  }
  if (response.status >= 400) {
    return { ok: false, error: faultMsg || `SUNAT respondió con HTTP ${response.status}` };
  }

  // Respuesta esperada: getStatusCdrResponse > statusCdr > statusCode, content, statusMessage
  const contentMatch = responseXml.match(/<content[^>]*>([^<]*)<\/content>/i);
  const content = contentMatch && contentMatch[1] ? contentMatch[1].trim().replace(/\s/g, "") : null;
  const statusCodeMatch = responseXml.match(/<statusCode[^>]*>([^<]*)<\/statusCode>/i);
  const statusCode = statusCodeMatch && statusCodeMatch[1] !== undefined ? statusCodeMatch[1].trim() : null;
  const statusMessageMatch = responseXml.match(/<statusMessage[^>]*>([^<]*)<\/statusMessage>/i);
  const statusMessage = statusMessageMatch && statusMessageMatch[1] !== undefined ? statusMessageMatch[1].trim() : null;

  if (!content) {
    const msg = statusCode === "98"
      ? "Comprobante aún en proceso. Reintente en unos minutos."
      : (statusMessage || "SUNAT no devolvió CDR en la respuesta.");
    return { ok: false, error: msg };
  }

  try {
    const zipBuffer = Buffer.from(content, "base64");
    const cdr = await envioDirectoSunat.extraerCdrDeZipBuffer(zipBuffer);
    if (!cdr) {
      return { ok: false, error: "El ZIP de respuesta no contiene un CDR válido." };
    }
    const idEstadoSunat = envioDirectoSunat.responseCodeToIdEstadoSunat(cdr.codigo);
    return {
      ok: idEstadoSunat === 1 || idEstadoSunat === 3,
      idEstadoSunat,
      codigoRespuesta: cdr.codigo,
      descripcionRespuesta: cdr.descripcion,
      cdr: cdr.xml
    };
  } catch (err) {
    console.error("consultaSunat.consultarCdrSunat: error al procesar CDR", err.message);
    return { ok: false, error: err.message || "Error al procesar la respuesta de SUNAT" };
  }
}

/**
 * Consulta la validez de un comprobante en SUNAT (billValidService getStatus).
 * @param {string} rucComprobante - RUC del emisor
 * @param {string} tipoComprobante - 01, 03, 07, 08, etc.
 * @param {string} serieComprobante - Ej. F001, B001
 * @param {string} numeroComprobante - Número
 * @param {string} usuarioSOAP - Usuario SOL
 * @param {string} claveSOAP - Clave SOL
 * @param {string} urlConsultaValidez - URL del billValidService
 * @returns {Promise<{ valido: boolean, mensaje?: string, statusCode?: string, error?: string }>}
 */
async function consultarValidezSunat(rucComprobante, tipoComprobante, serieComprobante, numeroComprobante, usuarioSOAP, claveSOAP, urlConsultaValidez) {
  const url = (urlConsultaValidez || URL_VALIDEZ_PROD).trim().replace(/\?wsdl$/i, "");
  const numeroNorm = String(numeroComprobante ?? "").replace(/\D/g, "").padStart(8, "0");
  const soapBody = buildGetStatusValidezSoap(usuarioSOAP, claveSOAP, rucComprobante, tipoComprobante, serieComprobante, numeroNorm);

  let response;
  try {
    response = await axios.post(url, soapBody, {
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "urn:getStatus" },
      timeout: 30000,
      validateStatus: () => true
    });
  } catch (err) {
    console.error("consultaSunat.consultarValidezSunat: error de conexión", err.message);
    return { valido: false, error: err.message || "No se pudo conectar con SUNAT" };
  }

  const responseXml = response.data && typeof response.data === "string" ? response.data : String(response.data || "");
  const faultMsg = extraerFault(responseXml);
  if (faultMsg) {
    return { valido: false, mensaje: faultMsg, error: faultMsg };
  }
  if (response.status >= 400) {
    return { valido: false, error: faultMsg || `SUNAT respondió con HTTP ${response.status}` };
  }

  const statusCodeMatch = responseXml.match(/<statusCode[^>]*>([^<]*)<\/statusCode>/i);
  const statusCode = statusCodeMatch && statusCodeMatch[1] !== undefined ? statusCodeMatch[1].trim() : null;
  const contentMatch = responseXml.match(/<content[^>]*>([^<]*)<\/content>/i);
  const content = contentMatch && contentMatch[1] ? contentMatch[1].trim() : null;

  if (statusCode === "0") {
    return { valido: true, statusCode: "0", mensaje: "Comprobante aceptado" };
  }
  if (statusCode === "1" || statusCode === "2") {
    return { valido: true, statusCode, mensaje: "Comprobante aceptado con observaciones" };
  }
  if (statusCode === "99" || statusCode === "98") {
    return { valido: false, statusCode, mensaje: content || (statusCode === "98" ? "En proceso" : "Rechazado o no encontrado") };
  }
  return { valido: false, statusCode: statusCode || null, mensaje: content || "Comprobante no válido o no encontrado" };
}

module.exports = {
  consultarCdrSunat,
  consultarValidezSunat,
  URL_CONSULTA_CDR_PROD,
  URL_CONSULTA_CDR_BETA,
  URL_VALIDEZ_PROD,
  URL_VALIDEZ_BETA
};
