/**
 * Fecha y hora del servidor según APP_TIMEZONE (.env).
 * Operaciones de negocio con usuario en pantalla deben preferir la hora enviada por el cliente.
 */

const {
  getAppTimezone,
  getAhoraAppSqlString,
  getAhoraAppIsoLocal,
  getFechaHoyApp,
  getFechaEmisionAppSqlString,
  partesAhoraApp,
  partesFechaHoraEnTz,
  formatearFechaApp
} = require('./fechaDisplay.util');

/**
 * Devuelve un Date con componentes de APP_TIMEZONE (útil legacy con drivers SQL).
 * @returns {Date}
 */
function getNowLocal() {
  const { y, m, d, h, min, s } = partesAhoraApp();
  return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s));
}

/** YYYY-MM-DDTHH:mm:ss en APP_TIMEZONE */
function getNowLocalISOString() {
  return getAhoraAppIsoLocal();
}

/** YYYY-MM-DD HH:mm:ss.sss en APP_TIMEZONE */
function getNowLocalSQLString() {
  return getAhoraAppSqlString();
}

/** Parte fecha + hora actual en APP_TIMEZONE */
function getFechaEmisionSQLString(parteFecha) {
  return getFechaEmisionAppSqlString(parteFecha);
}

/**
 * Medianoche en APP_TIMEZONE para la fecha indicada.
 * @param {string|Date} valor
 * @returns {string|null}
 */
function getFechaSoloSQLString(valor) {
  if (valor == null) return null;
  if (typeof valor === 'string') {
    const str = valor.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
    return `${str} 00:00:00.000`;
  }
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    const { y, m, d } = partesFechaHoraEnTz(valor, getAppTimezone());
    return `${y}-${m}-${d} 00:00:00.000`;
  }
  return null;
}

/** Hoy en APP_TIMEZONE: YYYY-MM-DD */
function getFechaHoyLocal() {
  return getFechaHoyApp();
}

/**
 * Convierte fEmision ya guardada (Date de mssql o string) a "YYYY-MM-DD HH:mm:ss".
 * @param {string|Date} valor
 * @returns {string}
 */
function fEmisionRowALocalYmdHms(valor) {
  if (valor == null) return '';
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    const { y, m, d, h, min, s } = partesFechaHoraEnTz(valor, getAppTimezone());
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }
  const str = String(valor).trim().replace('T', ' ');
  const m = str.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (m) return `${m[1]} ${m[2]}`;
  const solo = str.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(solo)) return `${solo} 00:00:00`;
  return '';
}

/**
 * Normaliza cabecera.fEmision a VARCHAR(23) "YYYY-MM-DD HH:mm:ss.000".
 * @param {string|Date|null|undefined} valor
 * @returns {string|null}
 */
function parseFEmisionCabeceraSQL(valor) {
  if (valor == null) return null;
  const raw = String(valor).trim();
  if (!raw) return null;
  const conHora = /[T ]\d{2}:\d{2}:\d{2}/.test(raw);
  if (!conHora) {
    return getFechaSoloSQLString(raw);
  }
  const norm = raw.replace('T', ' ').replace(/\.\d{3}Z?$/, '');
  const m = norm.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (m) {
    return `${m[1]} ${m[2]}.000`;
  }
  return getFechaSoloSQLString(raw);
}

function mergeFEmisionNvCtSiMedianocheInnecessario(fEmisionSql23, fEmisionExistente) {
  if (!fEmisionSql23 || fEmisionExistente == null) return fEmisionSql23;
  const exStr = fEmisionRowALocalYmdHms(fEmisionExistente);
  if (exStr.length < 19) return fEmisionSql23;
  const exDate = exStr.slice(0, 10);
  const exTime = exStr.slice(11, 19);
  const nuDate = fEmisionSql23.slice(0, 10);
  const nuTime = fEmisionSql23.length >= 19 ? fEmisionSql23.slice(11, 19) : '00:00:00';
  if (nuDate === exDate && nuTime === '00:00:00' && exTime !== '00:00:00') {
    return `${nuDate} ${exTime}.000`;
  }
  return fEmisionSql23;
}

/**
 * Parte fecha YYYY-MM-DD desde entrada de venta.
 * @param {string|Date|null|undefined} fEmision
 * @returns {string|null}
 */
function parteFechaDesdeFEmisionInput(fEmision) {
  if (fEmision == null) return null;
  if (fEmision instanceof Date && !isNaN(fEmision.getTime())) {
    return formatearFechaApp(fEmision);
  }
  const str = String(fEmision).trim();
  if (!str) return null;
  const solo = str.slice(0, 10);
  const esSoloFecha = /^\d{4}-\d{2}-\d{2}$/.test(solo) && !/[Tt]/.test(str) && !str.endsWith('Z');
  if (esSoloFecha) return solo;
  if (/[Tt]/.test(str) || str.endsWith('Z')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return formatearFechaApp(d);
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(solo)) return solo;
  return null;
}

/**
 * Fecha/hora del cliente → SQL. Si falta, respaldo con APP_TIMEZONE.
 * @param {string|Date|null|undefined} valor
 * @param {boolean} [usarServidorSiFalta=true]
 * @returns {string|null}
 */
function resolveFechaHoraClienteSql(valor, usarServidorSiFalta = true) {
  const parsed = parseFEmisionCabeceraSQL(valor);
  if (parsed) return parsed;
  return usarServidorSiFalta ? getNowLocalSQLString() : null;
}

module.exports = {
  getNowLocal,
  getNowLocalISOString,
  getNowLocalSQLString,
  getFechaEmisionSQLString,
  getFechaSoloSQLString,
  getFechaHoyLocal,
  fEmisionRowALocalYmdHms,
  parseFEmisionCabeceraSQL,
  resolveFechaHoraClienteSql,
  mergeFEmisionNvCtSiMedianocheInnecessario,
  parteFechaDesdeFEmisionInput
};
