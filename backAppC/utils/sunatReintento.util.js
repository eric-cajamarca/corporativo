/**
 * Clasifica respuestas de envío a SUNAT (directo SOAP o Facturador) para decidir reintento vs rechazo definitivo.
 */

function textoUnificado(result) {
  if (!result) return "";
  const partes = [result.error, result.mensaje, result.descripcionRespuesta].filter(
    (x) => x != null && String(x).trim() !== ""
  );
  return partes.join(" | ").toLowerCase();
}

/** Rechazo de documento (SUNAT procesó y devolvió CDR / código de negocio). No reintentar envío automático. */
function esRechazoDocumentoSunat(result) {
  if (!result || result.ok) return false;
  if (Number(result.idEstadoSunat) === 4) return true;
  const cod = String(result.codigoRespuesta ?? "").trim();
  if (cod === "0100") return false;
  if (cod && !["0", "1", "2"].includes(cod) && /^\d+$/.test(cod)) {
    const msg = textoUnificado(result);
    if (msg.includes("rechaz")) return true;
    if (result.cdr && /<cbc:ResponseCode>/i.test(String(result.cdr))) return true;
  }
  return false;
}

/**
 * Fallo transitorio: conectividad, SUNAT no disponible, invocación SOAP, sin CDR aún, etc.
 * No incluye errores de validación de negocio / XML que SUNAT rechaza de forma estable.
 */
function esErrorReintentableEnvioSunat(result) {
  if (!result || result.ok) return false;
  if (esRechazoDocumentoSunat(result)) return false;

  const msg = textoUnificado(result);

  const noReintentar = [
    "no autorizado",
    "no autorizada",
    "no existe el certificado",
    "certificado digital",
    "signature",
    "firma del documento",
    "error al firmar",
    "schema",
    "dtd",
    "numeracion",
    "numeración",
    "ya fue informado",
    "ya existe",
    "no esta registrado",
    "no está registrado",
    "ruc del receptor",
    "debe indicar",
    "invalido",
    "inválido",
    "no coincide el total",
    "error al comprimir el xml"
  ];
  if (noReintentar.some((p) => msg.includes(p))) return false;

  const siReintentar = [
    "invocar el servicio",
    "error al invocar",
    "no se pudo conectar",
    "conectar con sunat",
    "econnrefused",
    "etimedout",
    "enotfound",
    "econnreset",
    "socket hang up",
    "network",
    "timeout",
    "no puede responder",
    "0100",
    "http 500",
    "http 502",
    "http 503",
    "http 504",
    "devolvió la petición",
    "no devolvió cdr",
    "sin cdr",
    "no se encontró applicationresponse",
    "no encontró applicationresponse",
    "servicio sunat",
    "servidor)",
    "temporalmente",
    "availability",
    "soap",
    "faultstring",
    "generar xml falló",
    "enviar xml falló",
    "cdr no encontrado",
    "no encontró cdr",
    "posible error del servidor",
    "ruta esperada"
  ];
  if (siReintentar.some((p) => msg.includes(p))) return true;

  return false;
}

module.exports = {
  textoUnificado,
  esRechazoDocumentoSunat,
  esErrorReintentableEnvioSunat
};
