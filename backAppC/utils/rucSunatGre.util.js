/**
 * RUC para URLs SUNAT GRE (OAuth y path de comprobante): solo dígitos, sin guiones ni espacios.
 */
function normalizarRucSunatGre(val) {
  if (val == null || String(val).trim() === "") return "";
  const solo = String(val).replace(/\D/g, "");
  if (solo.length !== 11) {
    console.error("[GRE RUC] Valor sin 11 dígitos tras quitar no numéricos:", {
      original: String(val).trim(),
      soloDigitos: solo,
      longitud: solo.length
    });
  }
  return solo;
}

module.exports = { normalizarRucSunatGre };
