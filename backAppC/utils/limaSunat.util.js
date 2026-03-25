/**
 * Fecha y hora en zona America/Lima (sin DST) para programación de envío SUNAT.
 */

/** @returns {string} YYYY-MM-DD en Lima */
exports.ymdLima = (d) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d instanceof Date ? d : new Date(d));

/** Minutos desde medianoche (0–1439) en Lima */
exports.minutosDesdeMedianocheLima = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return h * 60 + m;
};

/**
 * @param {Date|string|null|undefined} val - TIME de SQL o "HH:mm" / "HH:mm:ss"
 * @returns {{ horas: number, minutos: number }}
 */
exports.parseHoraEnvioSunat = (val) => {
  if (val == null) return { horas: 9, minutos: 0 };
  if (val instanceof Date) {
    const h = val.getUTCHours();
    const m = val.getUTCMinutes();
    return { horas: h, minutos: m };
  }
  const s = String(val).trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    return { horas: Math.min(23, parseInt(m[1], 10)), minutos: Math.min(59, parseInt(m[2], 10)) };
  }
  return { horas: 9, minutos: 0 };
};

/** Para inputs type="time" en el admin */
exports.formatearHoraEnvioParaInput = (val) => {
  const { horas, minutos } = exports.parseHoraEnvioSunat(val);
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
};
