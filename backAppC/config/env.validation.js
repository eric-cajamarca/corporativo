/**
 * Validaciones al arranque. Falla antes de escuchar el puerto si la config es insegura.
 */
function assertProductionEnv() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }
  const jwt = process.env.JWT_SECRET;
  if (!jwt || !String(jwt).trim()) {
    console.error('context:', 'NODE_ENV=production requiere JWT_SECRET definido y no vacío');
    process.exit(1);
  }
}

module.exports = { assertProductionEnv };
