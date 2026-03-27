/**
 * IP del cliente (proxy: X-Forwarded-For primero hop). Máx. 45 caracteres (IPv6).
 */
function obtenerIpCliente(req) {
  if (!req) return null;
  const fwd = req.headers && req.headers['x-forwarded-for'];
  if (fwd) {
    const first = String(fwd).split(',')[0].trim();
    if (first) return first.slice(0, 45);
  }
  const raw = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
  if (!raw) return null;
  return String(raw)
    .replace(/^::ffff:/i, '')
    .slice(0, 45);
}

module.exports = { obtenerIpCliente };
