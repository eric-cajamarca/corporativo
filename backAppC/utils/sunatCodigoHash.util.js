/**
 * Código hash para representación impresa / QR SUNAT (noveno campo de la cadena del QR).
 * Corresponde al DigestValue en Base64 del Reference al documento (URI vacío) dentro de ds:Signature.
 * @param {string} xml - XML UBL ya firmado
 * @returns {string} Hash o cadena vacía si no se encuentra
 */
function extraerCodigoHashDesdeXmlFirmado(xml) {
  if (!xml || typeof xml !== "string") {
    return "";
  }
  const s = xml.replace(/^\uFEFF/, "").trim();
  // Primer DigestValue típico: referencia al documento (Invoice, DespatchAdvice, etc.)
  // xml-crypto puede dejar el Base64 en varias líneas; [^<\s]+ truncaba el hash.
  const re = /<(?:ds:)?DigestValue>\s*([\s\S]*?)<\/(?:ds:)?DigestValue>/i;
  const m = s.match(re);
  if (!m || !m[1]) {
    return "";
  }
  return String(m[1]).replace(/\s+/g, "").trim().slice(0, 200);
}

module.exports = {
  extraerCodigoHashDesdeXmlFirmado
};
