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
  return raw && String(raw).trim() ? String(raw).trim() : 'erik@./Eog_DEV_CHANGE_IN_PRODUCTION';
}

module.exports = { getJwtSecret };
