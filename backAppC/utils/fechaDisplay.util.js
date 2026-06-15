const DEFAULT_TZ = 'America/Lima';

/**
 * Zona horaria del despliegue (alertas, jobs, respaldos cuando el cliente no envía hora).
 * Definir en .env: APP_TIMEZONE=America/Lima
 */
function getAppTimezone() {
  const tz = String(process.env.APP_TIMEZONE || DEFAULT_TZ).trim();
  return tz || DEFAULT_TZ;
}

/**
 * Partes de fecha/hora en una zona IANA.
 * @param {Date|string|number} d
 * @param {string} timeZone
 */
function partesFechaHoraEnTz(d, timeZone) {
  const date = d instanceof Date ? d : new Date(d);
  const base = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(base);
  const pick = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  let h = pick('hour');
  if (h === '24') h = '00';
  return {
    y: pick('year'),
    m: pick('month'),
    d: pick('day'),
    h,
    min: pick('minute'),
    s: pick('second')
  };
}

function partesAhoraApp() {
  return partesFechaHoraEnTz(new Date(), getAppTimezone());
}

/** Fecha de hoy en APP_TIMEZONE: YYYY-MM-DD */
function getFechaHoyApp() {
  const { y, m, d } = partesAhoraApp();
  return `${y}-${m}-${d}`;
}

/** Ahora en APP_TIMEZONE para SQL: YYYY-MM-DD HH:mm:ss.sss */
function getAhoraAppSqlString() {
  const { y, m, d, h, min, s } = partesAhoraApp();
  const ms = String(new Date().getMilliseconds()).padStart(3, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}.${ms}`;
}

/** Ahora en APP_TIMEZONE: YYYY-MM-DDTHH:mm:ss (sin Z) */
function getAhoraAppIsoLocal() {
  const { y, m, d, h, min, s } = partesAhoraApp();
  return `${y}-${m}-${d}T${h}:${min}:${s}`;
}

/** Ahora en APP_TIMEZONE legible: YYYY-MM-DD HH:mm:ss */
function getAhoraAppYmdHms() {
  const { y, m, d, h, min, s } = partesAhoraApp();
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

/** Fecha dada + hora actual en APP_TIMEZONE → SQL VARCHAR(23) */
function getFechaEmisionAppSqlString(parteFecha) {
  const { h, min, s } = partesAhoraApp();
  const ms = String(new Date().getMilliseconds()).padStart(3, '0');
  return `${parteFecha} ${h}:${min}:${s}.${ms}`;
}

/**
 * Muestra fecha/hora en APP_TIMEZONE (es-PE).
 * @param {Date|string|null|undefined} val
 * @returns {string|null}
 */
function formatearFechaHoraApp(val) {
  if (val == null || val === '') return null;
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return String(val).trim();
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: getAppTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
    .format(d)
    .replace(',', '');
}

/** Solo fecha YYYY-MM-DD en APP_TIMEZONE */
function formatearFechaApp(val) {
  if (val == null || val === '') return null;
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return String(val).trim().slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: getAppTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/** @deprecated alias — usar formatearFechaHoraApp */
const formatearFechaHoraLima = formatearFechaHoraApp;

module.exports = {
  getAppTimezone,
  TZ: getAppTimezone(),
  partesFechaHoraEnTz,
  partesAhoraApp,
  getFechaHoyApp,
  getAhoraAppSqlString,
  getAhoraAppIsoLocal,
  getAhoraAppYmdHms,
  getFechaEmisionAppSqlString,
  formatearFechaHoraApp,
  formatearFechaApp,
  formatearFechaHoraLima
};
