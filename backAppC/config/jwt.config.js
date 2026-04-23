/**
 * Secreto JWT: en producción debe existir en entorno (sin fallback en runtime).
 */
function getJwtSecret() {
  const raw = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!raw || !String(raw).trim()) {
      throw new Error('JWT_SECRET es obligatorio cuando NODE_ENV=production');
    }
    return String(raw).trim();
  }
  return raw && String(raw).trim()
    ? String(raw).trim()
    : 'LOCAL_DEV_JWT_FALLBACK_SET_JWT_SECRET_IN_ENV_NOT_FOR_PRODUCTION';
}

module.exports = { getJwtSecret };
