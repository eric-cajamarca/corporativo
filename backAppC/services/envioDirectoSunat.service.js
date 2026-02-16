/**
 * Envío directo a SUNAT vía servicio SOAP BillService (sendBill).
 * No usa el Facturador SFS. Requiere: XML firmado, usuario secundario y contraseña del usuario secundario (no Clave SOL).
 * Referencia: Manual de Servicios REST SUNAT, Greenter FE Primer.
 */

const axios = require("axios");
const JSZip = require("jszip");

const NS_SOAP = "http://schemas.xmlsoap.org/soap/envelope/";
const NS_WS = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd";
const NS_WSU = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd";
const NS_BILL = "http://service.gem.factura.comppago.registro.servicio.sunat.gob.pe/";

/** URL BillService BETA (pruebas). Producción: https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService */
const URL_BETA = "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService";
const URL_PRODUCCION = "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService";

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
 * Mapea ResponseCode del CDR a idEstadoSunat (mismo criterio que facturadorSunat.service).
 */
function responseCodeToIdEstadoSunat(code) {
  const c = String(code).trim();
  if (c === "0") return 1; // Aceptado
  if (c === "1" || c === "2") return 3; // Aceptado con observaciones
  return 4; // Rechazado u otro
}

/**
 * Construye el envelope SOAP para sendBill (WS-Security UsernameToken + fileName + contentFile base64).
 */
function buildSendBillSoap(usuarioSOAP, claveSOAP, fileNameZip, zipBase64) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:ser="${NS_BILL}">
  <soapenv:Header>
    <wsse:Security soapenv:mustUnderstand="1" xmlns:wsse="${NS_WS}" xmlns:wsu="${NS_WSU}">
      <wsse:UsernameToken wsu:Id="UsernameToken-1">
        <wsse:Username>${escXml(usuarioSOAP)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escXml(claveSOAP)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ser:sendBill>
      <fileName>${escXml(fileNameZip)}</fileName>
      <contentFile>${zipBase64}</contentFile>
    </ser:sendBill>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Extrae el CDR (XML) del ZIP de respuesta y obtiene ResponseCode y Description.
 */
async function extraerCdrDeZipBuffer(zipBuffer) {
  const zip = await JSZip.loadAsync(zipBuffer);
  const names = Object.keys(zip.files);
  const xmlName = names.find((n) => n.toLowerCase().endsWith(".xml"));
  if (!xmlName) return null;
  const xmlContent = await zip.files[xmlName].async("string");
  const codeMatch = xmlContent.match(/<cbc:ResponseCode[^>]*>([^<]*)<\/cbc:ResponseCode>/);
  const descMatch = xmlContent.match(/<cbc:Description[^>]*>([^<]*)<\/cbc:Description>/);
  return {
    codigo: codeMatch ? codeMatch[1].trim() : "???",
    descripcion: descMatch ? descMatch[1].trim() : "Sin descripción",
    xml: xmlContent
  };
}

/**
 * Parsea la respuesta SOAP de sendBill para obtener applicationResponse (base64 del ZIP con CDR).
 */
function parsearRespuestaSendBill(soapResponseXml) {
  const match = soapResponseXml.match(/<applicationResponse[^>]*>([^<]*)<\/applicationResponse>/i)
    || soapResponseXml.match(/<return[^>]*>([^<]*)<\/return>/i)
    || soapResponseXml.match(/<contentFile[^>]*>([^<]*)<\/contentFile>/i);
  if (!match || !match[1]) return null;
  const base64 = match[1].trim().replace(/\s/g, "");
  return base64;
}

/**
 * Envía el comprobante (XML firmado) directo a SUNAT vía BillService sendBill.
 * @param {string} xmlFirmado - XML UBL 2.1 firmado (string)
 * @param {string} nombreBase - Nombre sin extensión (ej: 20614636930-03-B001-9)
 * @param {string} usuarioSOAP - Usuario SOAP (ej. RUC + usuario secundario: 20123456789MODDATOS)
 * @param {string} claveSOAP - Contraseña del usuario secundario (no Clave SOL)
 * @param {string} urlBillService - URL del BillService (BETA o producción)
 * @returns {Promise<{ ok: boolean, idEstadoSunat?: number, codigoRespuesta?: string, descripcionRespuesta?: string, cdr?: string, error?: string }>}
 */
async function enviarComprobanteDirectoSunat(xmlFirmado, nombreBase, usuarioSOAP, claveSOAP, urlBillService) {
  const url = (urlBillService || URL_BETA).trim().replace(/\?wsdl$/i, "");
  const fileNameZip = `${nombreBase}.zip`;

  let zipBase64;
  try {
    const zip = new JSZip();
    zip.file(`${nombreBase}.xml`, xmlFirmado, { binary: false });
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    zipBase64 = zipBuffer.toString("base64");
  } catch (err) {
    console.error("envioDirectoSunat: error al comprimir XML:", err.message);
    return {
      ok: false,
      error: "Error al comprimir el XML para envío",
      idEstadoSunat: 6
    };
  }

  const soapBody = buildSendBillSoap(usuarioSOAP, claveSOAP, fileNameZip, zipBase64);

  let response;
  try {
    response = await axios.post(url, soapBody, {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: ""
      },
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: () => true
    });
  } catch (err) {
    console.error("envioDirectoSunat: error de conexión:", err.message);
    const msg = err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT" || err.code === "ENOTFOUND"
      ? "No se pudo conectar con SUNAT. Verifique la URL y su conexión."
      : err.message;
    return {
      ok: false,
      error: msg,
      idEstadoSunat: 6
    };
  }

  const responseXml = response.data && typeof response.data === "string" ? response.data : String(response.data || "");
  const faultMatch = responseXml.match(/<faultstring[^>]*>([^<]*)<\/faultstring>/i);
  if (faultMatch) {
    const faultMsg = faultMatch[1].trim();
    console.error("envioDirectoSunat: fault SUNAT:", faultMsg);
    return {
      ok: false,
      error: faultMsg,
      codigoRespuesta: faultMsg.match(/\d{4}/)?.[0] || null,
      descripcionRespuesta: faultMsg,
      idEstadoSunat: 6
    };
  }

  const base64Zip = parsearRespuestaSendBill(responseXml);
  if (!base64Zip) {
    console.error("envioDirectoSunat: no se encontró applicationResponse en la respuesta");
    return {
      ok: false,
      error: "SUNAT no devolvió CDR en la respuesta",
      idEstadoSunat: 6
    };
  }

  try {
    const zipBuffer = Buffer.from(base64Zip, "base64");
    const cdr = await extraerCdrDeZipBuffer(zipBuffer);
    if (!cdr) {
      return {
        ok: false,
        error: "No se pudo extraer el CDR del ZIP de respuesta",
        idEstadoSunat: 6
      };
    }
    const idEstadoSunat = responseCodeToIdEstadoSunat(cdr.codigo);
    return {
      ok: idEstadoSunat === 1 || idEstadoSunat === 3,
      idEstadoSunat,
      codigoRespuesta: cdr.codigo,
      descripcionRespuesta: cdr.descripcion,
      cdr: cdr.xml
    };
  } catch (err) {
    console.error("envioDirectoSunat: error al procesar CDR:", err.message);
    return {
      ok: false,
      error: err.message || "Error al procesar la respuesta de SUNAT",
      idEstadoSunat: 6
    };
  }
}

module.exports = {
  enviarComprobanteDirectoSunat,
  URL_BETA,
  URL_PRODUCCION,
  responseCodeToIdEstadoSunat
};
