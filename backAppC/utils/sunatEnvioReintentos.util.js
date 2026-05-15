/**
 * Clasifica respuestas de envío a SUNAT / Facturador para reintentos vs rechazo definitivo.
 */

const PATRONES_INFRA = [
  /invocar\s+el\s+servicio/i,
  /error\s+al\s+invocar/i,
  /servicio\s+(de\s+)?sunat/i,
  /conexi[oó]n/i,
  /connection/i,
  /timeout/i,
  /econnrefused/i,
  /econnreset/i,
  /etimedout/i,
  /enotfound/i,
  /esocket/i,
  /network/i,
  /socket/i,
  /\b502\b|\b503\b|\b504\b/i,
  /no\s+se\s+pudo\s+conectar/i,
  /java\.net/i,
  /sistema\s+no\s+puede\s+responder/i,
  /\b0100\b/i,
  /sunat\s+respondi[oó]\s+con\s+http\s+5/i,
  /posible\s+error\s+del\s+servidor/i,
  /en\s+lugar\s+del\s+cdr/i,
  /no\s+devolvi[oó]\s+cdr/i,
  /sin\s+cdr/i,
  /no\s+se\s+encontr[oó]\s+cdr/i,
  /zip\s+sin\s+cdr/i
];

/** Texto que sugiere error de datos/certificado (no reintentar ciegamente). */
const PATRONES_NO_REINTENTO = [
  /no\s+cumple/i,
  /schema/i,
  /inv[aá]lido/i,
  /ruc\s+del\s+emisor/i,
  /serie\s+ya\s+fue\s+informada/i,
  /correlativo/i,
  /documento\s+ya\s+existe/i,
  /error\s+al\s+firmar/i,
  /certificado/i,
  /clave\s+sol/i,
  /usuario\s+o\s+clave/i,
  /autentic/i,
  /no\s+tiene\s+acceso/i,
  /comprimir/i,
  /escribir\s+xml/i,
  /archivos\s+planos/i
];

function textoResultado(r, err) {
  if (err) {
    const code = err.code ? String(err.code) : "";
    return `${code} ${err.message || ""} ${err.response?.status || ""}`;
  }
  if (!r) return "";
  return [r.error, r.mensaje, r.descripcionRespuesta, r.message].filter(Boolean).join(" | ");
}

function coincideAlguno(texto, patrones) {
  const t = String(texto || "");
  return patrones.some((re) => re.test(t));
}

/**
 * Error de red / axios antes de respuesta parseada.
 */
function esErrorRed(err) {
  if (!err) return false;
  const code = String(err.code || "");
  if (["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNABORTED"].includes(code)) {
    return true;
  }
  const msg = String(err.message || "").toLowerCase();
  return msg.includes("network") || msg.includes("socket") || msg.includes("timeout");
}

/**
 * Fallo transitorio: conviene dejar el comprobante en pendiente (idEstadoSunat 7) y reintentar luego.
 */
function esFalloInfraestructuraSunat(resultado, err) {
  if (esErrorRed(err)) return true;
  const t = textoResultado(resultado, null);
  if (!t.trim()) return false;
  if (coincideAlguno(t, PATRONES_NO_REINTENTO)) return false;
  if (resultado && resultado.idEstadoSunat === 4) return false;
  if (coincideAlguno(t, PATRONES_INFRA)) return true;
  if (resultado && resultado.idEstadoSunat === 6 && t.trim() && !coincideAlguno(t, PATRONES_NO_REINTENTO)) {
    return true;
  }
  return false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_REINTENTOS = Math.min(8, Math.max(1, parseInt(process.env.SUNAT_ENVIO_MAX_REINTENTOS || "3", 10) || 3));

module.exports = {
  esFalloInfraestructuraSunat,
  esErrorRed,
  textoResultado,
  MAX_REINTENTOS,
  delay,
  DELAYS_MS: [1500, 3500, 7000]
};
