/**
 * Nombre de archivo SUNAT: RUC-TT-SERIE-NUMERO.json
 * El envío directo usa el mismo nombre sin .json para el XML en xml_firmados_sunat.
 * Resumen diario (RC) o comunicación de baja (RA): RUC-TT-YYYYMMDD-CORREL.json
 * @param {object} opts - { ruc, tipoComprobante, serie, numero } o { ruc, tipoResumen, fechaYYYYMMDD, correlativo }
 * @returns {string}
 */
function nombreArchivoComprobante(opts) {
  const { ruc } = opts;
  if (!ruc) return "";
  const rucStr = String(ruc).trim().padStart(11, "0");
  if (opts.tipoResumen) {
    const tt = opts.tipoResumen;
    const fecha = opts.fechaYYYYMMDD || "";
    const correl = String(opts.correlativo ?? 1).padStart(5, "0");
    return `${rucStr}-${tt}-${fecha}-${correl}.json`;
  }
  const tt = opts.tipoComprobante || "01";
  const serie = String(opts.serie || "").trim();
  const numero = String(opts.numero ?? "").replace(/\D/g, "").padStart(8, "0");
  return `${rucStr}-${tt}-${serie}-${numero}.json`;
}

module.exports = { nombreArchivoComprobante };
