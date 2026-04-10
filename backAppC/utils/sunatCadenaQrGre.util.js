const { extraerCodigoHashDesdeXmlFirmado } = require("./sunatCodigoHash.util");

/**
 * Datos para el QR de representación impresa de GRE (SUNAT).
 * Formato típico de la cadena:
 * RUC|tipoDoc(09|31)|serie|numero|fecha(YYYY-MM-DD)|tipoDocDest|nroDocDest|DigestValueBase64
 *
 * @param {object} row - Fila de guía con xmlFirmado, tipoDocumento, serie, numero, fechaEmision, datosGuia
 * @returns {{ codigoHashSunat: string, cadenaQrSunat: string }}
 */
function construirDatosQrRepresentacionImpresaGre(row) {
  const codigoHashSunat = extraerCodigoHashDesdeXmlFirmado(row?.xmlFirmado);
  const d = row?.datosGuia && typeof row.datosGuia === "object" ? row.datosGuia : {};
  let rucEmisor = String(d.emisorRuc || "")
    .replace(/\D/g, "")
    .slice(0, 11);
  if (rucEmisor.length !== 11 && String(d.rucEmisor || "").trim()) {
    rucEmisor = String(d.rucEmisor || "")
      .replace(/\D/g, "")
      .slice(0, 11);
  }
  const tipoRaw = String(row?.tipoDocumento ?? "09").replace(/\D/g, "") || "09";
  const tipo = tipoRaw.length <= 2 ? tipoRaw.padStart(2, "0") : tipoRaw;
  const serie = String(row?.serie || "").trim();
  const numero = String(row?.numero || "").trim();
  const fecha = String(row?.fechaEmision || "").slice(0, 10);
  const tipoDocDest = String(d.tipoDocDestinatario || "").trim();
  const numDocDest = String(d.numDocDestinatario || "").trim();

  if (!rucEmisor || rucEmisor.length !== 11 || !serie || !numero || !fecha) {
    return { codigoHashSunat, cadenaQrSunat: "" };
  }

  const cadenaQrSunat = [rucEmisor, tipo, serie, numero, fecha, tipoDocDest, numDocDest, codigoHashSunat].join("|");
  return { codigoHashSunat, cadenaQrSunat };
}

module.exports = {
  construirDatosQrRepresentacionImpresaGre
};
