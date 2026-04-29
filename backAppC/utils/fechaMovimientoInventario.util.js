/**
 * Literal de fecha/hora para MovimientosInventario.fMovimiento sin desfase del driver mssql (Date → UTC).
 * Devuelve 'YYYY-MM-DD HH:mm:ss' o null (el INSERT usará GETDATE()).
 * Acepta cadenas sin zona: 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:mm:ss' / espacio.
 */
function normalizarFechaMovimientoParaSql(value) {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) {
      return null;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return `${s} 00:00:00`;
    }
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
    if (m) {
      return `${m[1]} ${m[2]}:${m[3]}:${m[4]}`;
    }
    return null;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    const p = (n) => String(n).padStart(2, '0');
    const d = value;
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  return null;
}

module.exports = {
  normalizarFechaMovimientoParaSql
};
