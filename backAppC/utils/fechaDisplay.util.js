const TZ = process.env.APP_TIMEZONE || 'America/Lima';

/**
 * Muestra fecha/hora de BD en zona Perú (America/Lima).
 * @param {Date|string|null|undefined} val
 * @returns {string|null}
 */
function formatearFechaHoraLima(val) {
  if (val == null || val === '') return null;
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return String(val).trim();
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: TZ,
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

module.exports = { formatearFechaHoraLima, TZ };
