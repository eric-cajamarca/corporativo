/**
 * Convierte un número a letras en español para monto (ej: 1500.00 → "MIL QUINIENTOS CON 00/100 SOLES").
 * Formato SUNAT: XXX CON DD/100 SOLES.
 */
function convertirEnteros(num) {
  if (num === 0) return "cero";
  const unidades = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
  const decenas = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  const especiales = { 11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince", 16: "dieciseis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve" };
  const centenas = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
  const n = Math.floor(num);
  if (n < 10) return unidades[n];
  if (n < 20 && n >= 11) return especiales[n] || unidades[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return (decenas[d] + (u ? " y " + unidades[u] : "")).trim();
  }
  if (n < 1000) {
    const c = Math.floor(n / 100);
    const resto = n % 100;
    if (n === 100) return "cien";
    return (centenas[c] + (resto ? " " + convertirEnteros(resto) : "")).trim();
  }
  if (n < 1000000) {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    return (miles === 1 ? "mil" : convertirEnteros(miles) + " mil") + (resto ? " " + convertirEnteros(resto) : "");
  }
  return String(n);
}

function numeroALetras(num) {
  const enteros = Math.floor(num);
  const decimales = Math.round((num - enteros) * 100);
  const letrasEnteros = convertirEnteros(enteros);
  const sufijo = decimales > 0 ? ` CON ${String(decimales).padStart(2, "0")}/100` : " CON 00/100";
  return (letrasEnteros + sufijo + " SOLES").replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = { numeroALetras };
