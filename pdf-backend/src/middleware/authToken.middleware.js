const TOKEN = process.env.PDF_BACKEND_TOKEN;
const REQUIRE = String(process.env.PDF_BACKEND_REQUIRE_TOKEN || '').toLowerCase() === 'true';

if (!TOKEN) {
  console.error('pdf-backend: AVISO PDF_BACKEND_TOKEN no configurado. Aceptando solo loopback (127.0.0.1, ::1).');
}

function ipLoopback(req) {
  const ip = String(req.ip || '').trim();
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function tokenFromReq(req) {
  const h = req.get('X-Pdf-Backend-Token');
  if (h) return String(h).trim();
  const auth = req.get('Authorization');
  if (auth && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  return '';
}

function requirePdfBackendToken(req, res, next) {
  if (TOKEN) {
    const provided = tokenFromReq(req);
    if (provided && provided === TOKEN) return next();
    if (ipLoopback(req) && !REQUIRE) return next();
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (ipLoopback(req)) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

module.exports = { requirePdfBackendToken };
