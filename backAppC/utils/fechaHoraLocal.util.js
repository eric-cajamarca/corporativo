/**
 * Fecha y hora según la configuración de la máquina donde corre el servidor.
 * Todo registro de fecha/hora debe usar esta utilidad o GETDATE() en SQL
 * para que sea consistente con la PC del servidor.
 */

/**
 * Devuelve la fecha y hora actual del servidor (configuración local de la máquina)
 * como objeto Date. Usar para pasar a sql.DateTime en repositorios.
 * @returns {Date}
 */
function getNowLocal() {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  );
}

/**
 * Devuelve la fecha y hora actual en formato ISO local YYYY-MM-DDTHH:mm:ss
 * (sin Z, para que se interprete como hora local).
 * @returns {string}
 */
function getNowLocalISOString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}:${s}`;
}

/**
 * Devuelve la fecha y hora actual en formato SQL VARCHAR(23): YYYY-MM-DD HH:mm:ss.sss
 * Para insertar en SQL Server sin que el driver convierta a UTC.
 * @returns {string}
 */
function getNowLocalSQLString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}.${ms}`;
}

/**
 * Devuelve fecha de emisión en formato SQL (YYYY-MM-DD HH:mm:ss.sss) usando la parte fecha dada
 * y la hora actual del servidor. Evita que el driver mssql convierta Date a UTC al guardar.
 * @param {string} parteFecha - "YYYY-MM-DD"
 * @returns {string}
 */
function getFechaEmisionSQLString(parteFecha) {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${parteFecha} ${h}:${min}:${s}.${ms}`;
}

/**
 * Extrae la parte fecha (YYYY-MM-DD) de un valor ISO o string y devuelve formato SQL medianoche local.
 * @param {string|Date} valor - ISO string o Date
 * @returns {string|null} "YYYY-MM-DD 00:00:00.000" o null
 */
function getFechaSoloSQLString(valor) {
  if (valor == null) return null;
  const str = typeof valor === 'string' ? valor.trim().slice(0, 10) : (valor instanceof Date ? valor.toISOString().slice(0, 10) : '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  return `${str} 00:00:00.000`;
}

/**
 * Devuelve la fecha de hoy en zona local como YYYY-MM-DD (para filtros "hoy" sin usar UTC).
 * @returns {string}
 */
function getFechaHoyLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convierte fEmision ya guardada (Date de mssql o string) a "YYYY-MM-DD HH:mm:ss" (19 chars, hora local).
 * @param {string|Date} valor
 * @returns {string}
 */
function fEmisionRowALocalYmdHms(valor) {
  if (valor == null) return '';
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    const y = valor.getFullYear();
    const mo = String(valor.getMonth() + 1).padStart(2, '0');
    const d = String(valor.getDate()).padStart(2, '0');
    const h = String(valor.getHours()).padStart(2, '0');
    const mi = String(valor.getMinutes()).padStart(2, '0');
    const s = String(valor.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
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
 * Si viene solo fecha (sin reloj), medianoche. Si viene con hora (T o espacio), la conserva.
 * Importante: no usar solo getFechaSoloSQLString cuando hay hora, porque anula la hora real.
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

/**
 * NV/CT: si la edición envía la misma fecha con 00:00:00 y en BD había otra hora, conservar la hora de BD.
 * @param {string|null} fEmisionSql23
 * @param {string|Date|null|undefined} fEmisionExistente
 * @returns {string|null}
 */
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
 * Parte fecha YYYY-MM-DD desde entrada de venta (ISO UTC, solo fecha o Date).
 * No usar slice(0,10) de ISO con Z: en UTC-5, después de las 19:00 local el día UTC ya es mañana.
 * @param {string|Date|null|undefined} fEmision
 * @returns {string|null}
 */
function parteFechaDesdeFEmisionInput(fEmision) {
  if (fEmision == null) return null;
  if (fEmision instanceof Date && !isNaN(fEmision.getTime())) {
    const y = fEmision.getFullYear();
    const mo = String(fEmision.getMonth() + 1).padStart(2, '0');
    const d = String(fEmision.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  const str = String(fEmision).trim();
  if (!str) return null;
  const solo = str.slice(0, 10);
  const esSoloFecha = /^\d{4}-\d{2}-\d{2}$/.test(solo) && !/[Tt]/.test(str) && !str.endsWith('Z');
  if (esSoloFecha) return solo;
  if (/[Tt]/.test(str) || str.endsWith('Z')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${mo}-${day}`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(solo)) return solo;
  return null;
}

/**
 * Fecha/hora enviada por el cliente (navegador) → VARCHAR(23) SQL.
 * Si no viene valor válido, usa hora del servidor como respaldo.
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
