/**
 * Envío directo a SUNAT vía WebService SOAP BillService (método sendBill).
 * No usa el Facturador SFS. Requiere: XML UBL firmado, UsernameToken (Clave SOL).
 * Referencia: otros/manual_programador.pdf (RS 097-2012/SUNAT) — §2.1 URLs, §2.3 Beta, §2.5 sendBill, §2.6 CDR.
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const {
  esFalloInfraestructuraSunat,
  MAX_REINTENTOS,
  delay,
  DELAYS_MS
} = require("../utils/sunatEnvioReintentos.util");

/** Carpeta donde se guardan el ZIP y la respuesta SOAP de SUNAT para depuración. */
const CARPETA_RESPUESTAS_SUNAT = path.join(process.cwd(), "sunat_respuestas");
/** XML firmado enviado por sendSummary (RC/RA), mismo criterio que comprobantes. */
const CARPETA_XML_FIRMADOS_SUNAT = path.join(process.cwd(), "xml_firmados_sunat");

const NS_SOAP = "http://schemas.xmlsoap.org/soap/envelope/";
const NS_WS = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd";
const NS_WSU = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd";
/** Manual del programador SEE: sendBill, sendSummary, getStatus usan xmlns:ser="http://service.sunat.gob.pe" */
const NS_SUNAT_SERVICE = "http://service.sunat.gob.pe";

/** URLs BillService SUNAT según manual programador §2.1 (Factura, Notas vinculadas, Resumen, etc.). */
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
 * Construye el envelope SOAP para sendBill (manual del programador: fileName + contentFile en bytes/base64).
 * Parámetros: fileName (ej. 20100066603-01-F001-1.ZIP), contentFile (contenido ZIP en base64).
 */
function buildSendBillSoap(usuarioSOAP, claveSOAP, fileNameZip, zipBase64) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:ser="${NS_SUNAT_SERVICE}">
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
 * Extrae el CDR (ApplicationResponse) del ZIP de respuesta.
 * Estructura SUNAT: ar:ApplicationResponse > cac:DocumentResponse > cac:Response >
 *   cbc:ReferenceID, cbc:ResponseCode, cbc:Description.
 * Solo el CDR tiene ResponseCode (0=aceptado, 1/2=observaciones, 3+=rechazado); el Invoice no.
 */
async function extraerCdrDeZipBuffer(zipBuffer) {
  const zip = await JSZip.loadAsync(zipBuffer);
  const names = Object.keys(zip.files).filter((n) => n.toLowerCase().endsWith(".xml"));
  for (const xmlName of names) {
    const xmlContent = await zip.files[xmlName].async("string");
    // ResponseCode puede tener prefijo cbc: o otro (namespace)
    const codeMatch = xmlContent.match(/<[^>]*ResponseCode[^>]*>([^<]*)<\//);
    if (!codeMatch) continue;
    const codigo = codeMatch[1].trim();
    // Description del CDR: la primera Description que va después de ResponseCode (en cac:Response)
    const afterCode = xmlContent.substring(xmlContent.indexOf(codeMatch[0]) + codeMatch[0].length);
    const descMatch = afterCode.match(/<[^>]*Description[^>]*>([^<]*)<\//);
    return {
      codigo,
      descripcion: descMatch ? descMatch[1].trim() : "Sin descripción",
      xml: xmlContent
    };
  }
  return null;
}

/**
 * Parsea la respuesta SOAP de sendBillResponse: fileName del ZIP y base64 del CDR.
 * Solo extrae de applicationResponse o return (respuesta válida). No usar contentFile: en la petición es nuestro ZIP enviado; si el servidor devuelve eco (ej. HTTP 500), contentFile sería nuestro propio ZIP.
 */
function parsearRespuestaSendBill(soapResponseXml) {
  const fileNameMatch = soapResponseXml.match(/<fileName[^>]*>([^<]*)<\/fileName>/i);
  const fileName = fileNameMatch && fileNameMatch[1] ? fileNameMatch[1].trim() : null;
  let match = soapResponseXml.match(/<applicationResponse[^>]*>([^<]*)<\/applicationResponse>/i);
  let matchedTag = "applicationResponse";
  if (!match || !match[1]) {
    match = soapResponseXml.match(/<return[^>]*>([^<]*)<\/return>/i);
    matchedTag = "return";
  }
  // No usar contentFile: en sendBill es lo que enviamos; si la respuesta es eco, contentFile sería nuestro ZIP
  if (!match || !match[1]) return { fileName: fileName || null, base64: null, matchedTag: null };
  const base64 = match[1].trim().replace(/\s/g, "");
  return { fileName: fileName || null, base64, matchedTag };
}

/**
 * Construye el envelope SOAP para sendSummary (manual: fileName + contentFile; retorna ticket para getStatus).
 */
function buildSendSummarySoap(usuarioSOAP, claveSOAP, fileNameZip, zipBase64) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:ser="${NS_SUNAT_SERVICE}">
  <soapenv:Header>
    <wsse:Security soapenv:mustUnderstand="1" xmlns:wsse="${NS_WS}" xmlns:wsu="${NS_WSU}">
      <wsse:UsernameToken wsu:Id="UsernameToken-1">
        <wsse:Username>${escXml(usuarioSOAP)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escXml(claveSOAP)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ser:sendSummary>
      <fileName>${escXml(fileNameZip)}</fileName>
      <contentFile>${zipBase64}</contentFile>
    </ser:sendSummary>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Construye el envelope SOAP para getStatus (manual: ticket; retorna statusCode 0/98/99 y content ZIP si 0 ó 99).
 */
function buildGetStatusSoap(usuarioSOAP, claveSOAP, ticket) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:ser="${NS_SUNAT_SERVICE}">
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
      <ticket>${escXml(ticket)}</ticket>
    </ser:getStatus>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Envía resumen diario (RC) o comunicación de baja (RA) con sendSummary.
 * Respuesta: ticket para luego consultar con getStatus (proceso asíncrono).
 * @returns {Promise<{ ok: boolean, ticket?: string, error?: string }>}
 */
async function enviarResumenDirectoSunat(xmlFirmado, nombreBase, usuarioSOAP, claveSOAP, urlBillService) {
  const url = (urlBillService || URL_BETA).trim().replace(/\?wsdl$/i, "");
  // Lineamiento SUNAT: ZIP con carpeta dummy (vacía) + XML; ej. 20100066603-RC-20110522-1.ZIP
  const fileNameZip = `${nombreBase}.ZIP`;

  // #region agent log
  fetch('http://127.0.0.1:7846/ingest/a2bad43c-6b04-4aa9-9882-ff32cc25e5d5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c9704a'},body:JSON.stringify({sessionId:'c9704a',location:'envioDirectoSunat.service.js:167',message:'ENTRADA enviarResumenDirectoSunat',data:{nombreBase,fileNameZip,xmlFirmadoLength:xmlFirmado?.length||0,xmlFirmadoFirst200:xmlFirmado?.substring(0,200)||'',xmlFirmadoLast100:xmlFirmado?.substring(xmlFirmado.length-100)||'',urlBillService:url},timestamp:Date.now(),hypothesisId:'A,B,D'})}).catch(()=>{});
  // #endregion

  let zipBase64;
  let zipBuffer;
  try {
    const zip = new JSZip();
    // NOTA: Para VoidedDocuments (RA) NO se usa carpeta dummy según pruebas actualizadas
    // Solo el XML dentro del ZIP, igual que sendBill
    const xmlFileName = `${nombreBase}.XML`;
    // Usar Buffer directamente para evitar problemas de encoding
    const xmlBuffer = Buffer.from(xmlFirmado, 'utf8');
    zip.file(xmlFileName, xmlBuffer, { binary: true });
    zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
    zipBase64 = zipBuffer.toString("base64");

    // #region agent log - verificación post-ZIP
    const zipVerify = await JSZip.loadAsync(zipBuffer);
    const zipFilesVerify = Object.keys(zipVerify.files);
    let extractedXmlLength = 0;
    let extractedXmlFirst200 = '';
    let extractedXmlLast100 = '';
    for (const fn of zipFilesVerify) {
      if (fn.toLowerCase().endsWith('.xml')) {
        const extractedContent = await zipVerify.files[fn].async('string');
        extractedXmlLength = extractedContent.length;
        extractedXmlFirst200 = extractedContent.substring(0, 200);
        extractedXmlLast100 = extractedContent.substring(extractedContent.length - 100);
      }
    }
    fetch('http://127.0.0.1:7846/ingest/a2bad43c-6b04-4aa9-9882-ff32cc25e5d5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c9704a'},body:JSON.stringify({sessionId:'c9704a',location:'envioDirectoSunat.service.js:180',message:'ZIP generado y verificado',data:{xmlFileName,zipFilesVerify,zipBufferLength:zipBuffer?.length||0,zipBase64Length:zipBase64?.length||0,originalXmlLength:xmlFirmado?.length||0,extractedXmlLength,extractedXmlFirst200,extractedXmlLast100,xmlsMatch:xmlFirmado?.length===extractedXmlLength},timestamp:Date.now(),hypothesisId:'A,B,C,D'})}).catch(()=>{});
    // #endregion
  } catch (err) {
    console.error("envioDirectoSunat: sendSummary error al comprimir:", err.message);
    return { ok: false, error: "Error al comprimir el XML para envío" };
  }

  const soapBody = buildSendSummarySoap(usuarioSOAP, claveSOAP, fileNameZip, zipBase64);

  // #region agent log
  fetch('http://127.0.0.1:7846/ingest/a2bad43c-6b04-4aa9-9882-ff32cc25e5d5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c9704a'},body:JSON.stringify({sessionId:'c9704a',location:'envioDirectoSunat.service.js:190',message:'SOAP body generado',data:{soapBodyLength:soapBody?.length||0,soapBodyFirst300:soapBody?.substring(0,300)||'',soapBodyContainsContentFile:soapBody?.includes('<contentFile>')},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});

  try {
    if (!fs.existsSync(CARPETA_XML_FIRMADOS_SUNAT)) fs.mkdirSync(CARPETA_XML_FIRMADOS_SUNAT, { recursive: true });
    const rutaXml = path.join(CARPETA_XML_FIRMADOS_SUNAT, `${nombreBase}.xml`);
    fs.writeFileSync(rutaXml, xmlFirmado, "utf8");
    console.error("envioDirectoSunat: XML sendSummary guardado:", rutaXml);
  } catch (err) {
    console.error("envioDirectoSunat: no se pudo guardar XML sendSummary:", err.message);
  }

  let response;
  try {
    response = await axios.post(url, soapBody, {
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "urn:sendSummary" },
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: () => true
    });
  } catch (err) {
    console.error("envioDirectoSunat: sendSummary error de conexión:", err.message);
    return { ok: false, error: err.message || "No se pudo conectar con SUNAT" };
  }

  const responseXml = response.data && typeof response.data === "string" ? response.data : String(response.data || "");

  // #region agent log
  fetch('http://127.0.0.1:7846/ingest/a2bad43c-6b04-4aa9-9882-ff32cc25e5d5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c9704a'},body:JSON.stringify({sessionId:'c9704a',location:'envioDirectoSunat.service.js:220',message:'Respuesta SUNAT recibida',data:{httpStatus:response?.status,responseXmlLength:responseXml?.length||0,responseXmlContent:responseXml?.substring(0,1000)||''},timestamp:Date.now(),hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
  // #endregion

  try {
    if (!fs.existsSync(CARPETA_RESPUESTAS_SUNAT)) fs.mkdirSync(CARPETA_RESPUESTAS_SUNAT, { recursive: true });
    const rutaSoap = path.join(CARPETA_RESPUESTAS_SUNAT, `${nombreBase}-sendSummary-respuesta-soap.xml`);
    fs.writeFileSync(rutaSoap, responseXml, "utf8");
    console.error("envioDirectoSunat: sendSummary respuesta SOAP guardada:", rutaSoap);
  } catch (err) {
    console.error("envioDirectoSunat: no se pudo guardar SOAP sendSummary:", err.message);
  }

  const faultMatch = responseXml.match(/<faultstring[^>]*>([^<]*)<\/faultstring>/i);
  if (faultMatch) {
    const faultMsg = faultMatch[1].trim();
    console.error("envioDirectoSunat: sendSummary fault SUNAT:", faultMsg);
    return { ok: false, error: faultMsg };
  }

  const ticketMatch = responseXml.match(/<ticket[^>]*>([^<]*)<\/ticket>/i) || responseXml.match(/<return[^>]*>([^<]*)<\/return>/i);
  const ticket = ticketMatch && ticketMatch[1] ? ticketMatch[1].trim().replace(/\s/g, "") : null;
  if (!ticket) {
    console.error("envioDirectoSunat: sendSummary no devolvió ticket");
    return { ok: false, error: "SUNAT no devolvió ticket en la respuesta" };
  }
  return { ok: true, ticket };
}

/**
 * Consulta estado de un resumen/baja enviado con sendSummary (getStatus).
 * statusCode: 0 = procesado (content tiene ZIP con CDR), 98 = en proceso, 99 = error.
 * @returns {Promise<{ statusCode: number, content?: string, error?: string }>}
 */
async function consultarEstadoResumenSunat(ticket, usuarioSOAP, claveSOAP, urlBillService) {
  const url = (urlBillService || URL_BETA).trim().replace(/\?wsdl$/i, "");

  const soapBody = buildGetStatusSoap(usuarioSOAP, claveSOAP, ticket);

  let response;
  try {
    response = await axios.post(url, soapBody, {
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "urn:getStatus" },
      timeout: 30000,
      validateStatus: () => true
    });
  } catch (err) {
    console.error("envioDirectoSunat: getStatus error de conexión:", err.message);
    return { statusCode: -1, error: err.message, responseXml: undefined };
  }

  const responseXml = response.data && typeof response.data === "string" ? response.data : String(response.data || "");

  try {
    if (!fs.existsSync(CARPETA_RESPUESTAS_SUNAT)) fs.mkdirSync(CARPETA_RESPUESTAS_SUNAT, { recursive: true });
    const safeTicket = String(ticket || "sin-ticket").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    const rutaSoap = path.join(CARPETA_RESPUESTAS_SUNAT, `getStatus-${safeTicket}-respuesta-soap.xml`);
    fs.writeFileSync(rutaSoap, responseXml, "utf8");
    console.error("envioDirectoSunat: getStatus respuesta SOAP guardada:", rutaSoap);
  } catch (err) {
    console.error("envioDirectoSunat: no se pudo guardar SOAP getStatus:", err.message);
  }

  const faultMatch = responseXml.match(/<faultstring[^>]*>([^<]*)<\/faultstring>/i);
  if (faultMatch) {
    return { statusCode: 99, error: faultMatch[1].trim(), responseXml };
  }

  const statusMatch = responseXml.match(/<statusCode[^>]*>([^<]*)<\/statusCode>/i);
  const statusCode = statusMatch && statusMatch[1] !== undefined ? parseInt(statusMatch[1].trim(), 10) : -1;

  const contentMatch = responseXml.match(/<content[^>]*>([^<]*)<\/content>/i);
  const content = contentMatch && contentMatch[1] ? contentMatch[1].trim().replace(/\s/g, "") : undefined;

  return { statusCode, content, responseXml };
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
  // sendBill: un único comprobante por ZIP. Solo el XML (sin carpeta dummy) para evitar 0158 "demasiados comprobantes".
  const fileNameZip = `${nombreBase}.ZIP`;

  let zipBase64;
  try {
    const zip = new JSZip();
    zip.file(`${nombreBase}.XML`, xmlFirmado, { binary: false });
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
        SOAPAction: "urn:sendBill"
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

  /** Extrae mensaje de error de un SOAP Fault (faultstring, faultcode o contenido de Fault). */
  function extraerFaultMessage(xml) {
    let m = xml.match(/<[^>]*faultstring[^>]*>([^<]*)<\//i);
    if (m && m[1]) return m[1].trim().replace(/\s+/g, " ");
    m = xml.match(/<[^>]*faultcode[^>]*>([^<]*)<\//i);
    if (m && m[1]) return m[1].trim().replace(/\s+/g, " ");
    const faultBlock = xml.match(/<[^>]*:?Fault[^>]*>([\s\S]*?)<\/[^>]*:?Fault>/i);
    if (faultBlock && faultBlock[1]) {
      const inner = faultBlock[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (inner.length > 0 && inner.length < 500) return inner;
    }
    return null;
  }

  const hasSendBill = /<[^>]*:?sendBill[^>]*>/.test(responseXml) && !/<[^>]*:?sendBillResponse[^>]*>/.test(responseXml);
  const hasSendBillResponse = /<[^>]*:?sendBillResponse[^>]*>/.test(responseXml);

  // Si SUNAT devuelve 500 (u otro error HTTP), extraer fault y guardar respuesta para depuración.
  // Para error 0100 ("El sistema no puede responder...") ver docs/ERROR_0100_SUNAT.md (URL, credenciales SOL, certificado, formato UBL, reintento).
  if (response.status >= 400) {
    const faultMsg = extraerFaultMessage(responseXml);
    try {
      if (!fs.existsSync(CARPETA_RESPUESTAS_SUNAT)) fs.mkdirSync(CARPETA_RESPUESTAS_SUNAT, { recursive: true });
      const nombreError = `${nombreBase}-error-${response.status}-soap.xml`;
      const rutaError = path.join(CARPETA_RESPUESTAS_SUNAT, nombreError);
      fs.writeFileSync(rutaError, responseXml, "utf8");
      console.error("envioDirectoSunat: respuesta SOAP de error guardada:", rutaError);
    } catch (err) {
      console.error("envioDirectoSunat: no se pudo guardar SOAP de error:", err.message);
    }
    console.error("envioDirectoSunat: HTTP error", response.status, faultMsg || "(sin faultstring; revise el XML guardado)");
    return {
      ok: false,
      error: faultMsg || `SUNAT respondió con HTTP ${response.status}. Revise credenciales SOL, certificado y que el comprobante sea válido.`,
      idEstadoSunat: 6
    };
  }

  // Si el cuerpo es la petición (sendBill sin sendBillResponse), es eco por error; no extraer contentFile
  if (hasSendBill && !hasSendBillResponse) {
    console.error("envioDirectoSunat: el cuerpo recibido es la petición (eco), no la respuesta con CDR");
    return {
      ok: false,
      error: "SUNAT devolvió la petición en lugar del CDR (posible error del servidor). Intente de nuevo o verifique con SUNAT.",
      idEstadoSunat: 6
    };
  }

  // Guardar respuesta SOAP completa para depuración
  try {
    if (!fs.existsSync(CARPETA_RESPUESTAS_SUNAT)) fs.mkdirSync(CARPETA_RESPUESTAS_SUNAT, { recursive: true });
    const nombreSoap = `${nombreBase}-respuesta-soap.xml`;
    const rutaSoap = path.join(CARPETA_RESPUESTAS_SUNAT, nombreSoap);
    fs.writeFileSync(rutaSoap, responseXml, "utf8");
    console.error("envioDirectoSunat: respuesta SOAP guardada:", rutaSoap);
  } catch (err) {
    console.error("envioDirectoSunat: no se pudo guardar SOAP:", err.message);
  }

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

  const { fileName: fileNameSunat, base64: base64Zip } = parsearRespuestaSendBill(responseXml);
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

    // Guardar el ZIP con el nombre que devuelve SUNAT (ej. R10456333538-01-F001-00000001.zip) o uno por defecto
    try {
      if (!fs.existsSync(CARPETA_RESPUESTAS_SUNAT)) fs.mkdirSync(CARPETA_RESPUESTAS_SUNAT, { recursive: true });
      const nombreZip = (fileNameSunat && fileNameSunat.toLowerCase().endsWith(".zip")) ? fileNameSunat : `R${nombreBase}.zip`;
      const rutaZip = path.join(CARPETA_RESPUESTAS_SUNAT, nombreZip);
      fs.writeFileSync(rutaZip, zipBuffer);
      console.error("envioDirectoSunat: ZIP de respuesta guardado:", rutaZip);
    } catch (err) {
      console.error("envioDirectoSunat: no se pudo guardar ZIP:", err.message);
    }

    const cdr = await extraerCdrDeZipBuffer(zipBuffer);
    if (!cdr) {
      console.error("envioDirectoSunat: el ZIP no contiene CDR (ApplicationResponse con ResponseCode); puede ser comprobante devuelto");
      return {
        ok: false,
        error: "SUNAT devolvió un ZIP sin CDR. Verifique que la respuesta sea el CDR (ApplicationResponse) y no el comprobante.",
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

/**
 * Envío sendBill con reintentos ante fallos de red o SUNAT transitorios.
 */
async function enviarComprobanteDirectoSunatConReintentos(xmlFirmado, nombreBase, usuarioSOAP, claveSOAP, urlBillService) {
  let ultimo = null;
  for (let i = 0; i < MAX_REINTENTOS; i++) {
    try {
      ultimo = await enviarComprobanteDirectoSunat(xmlFirmado, nombreBase, usuarioSOAP, claveSOAP, urlBillService);
    } catch (err) {
      console.error("envioDirectoSunat: intento", i + 1, "excepción:", err.message);
      ultimo = { ok: false, error: err.message || "Error al enviar comprobante a SUNAT", idEstadoSunat: 6 };
    }
    if (ultimo.ok || (ultimo && ultimo.idEstadoSunat === 4) || !esFalloInfraestructuraSunat(ultimo, null)) {
      return ultimo;
    }
    if (i < MAX_REINTENTOS - 1) {
      const ms = DELAYS_MS[i] != null ? DELAYS_MS[i] : DELAYS_MS[DELAYS_MS.length - 1];
      console.error("envioDirectoSunat: reintento por infraestructura, espera", ms, "ms (intento", i + 1, ")");
      await delay(ms);
    }
  }
  return ultimo;
}

/** Extrae CDR desde content base64 de getStatus (ZIP). */
async function extraerCdrDesdeContentBase64(contentBase64) {
  if (!contentBase64 || typeof contentBase64 !== "string") return null;
  try {
    const zipBuffer = Buffer.from(contentBase64, "base64");
    return await extraerCdrDeZipBuffer(zipBuffer);
  } catch (err) {
    console.error("envioDirectoSunat: extraerCdrDesdeContentBase64:", err.message);
    return null;
  }
}

module.exports = {
  enviarComprobanteDirectoSunat,
  enviarComprobanteDirectoSunatConReintentos,
  enviarResumenDirectoSunat,
  consultarEstadoResumenSunat,
  extraerCdrDeZipBuffer,
  extraerCdrDesdeContentBase64,
  URL_BETA,
  URL_PRODUCCION,
  responseCodeToIdEstadoSunat
};
