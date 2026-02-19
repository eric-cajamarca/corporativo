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

module.exports = {
  getNowLocal,
  getNowLocalISOString,
  getNowLocalSQLString,
  getFechaEmisionSQLString,
  getFechaSoloSQLString,
  getFechaHoyLocal
};
