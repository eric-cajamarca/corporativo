/**
 * Indica si la petición debe omitir caché Redis (botón Buscar / anti-caché del SPA).
 */
function shouldSkipRedisCache(query) {
  if (!query || typeof query !== 'object') {
    return false;
  }
  if (query.refresh === '1' || query.evitarCache === '1') {
    return true;
  }
  const antiCache = query._;
  return antiCache != null && String(antiCache).trim() !== '';
}

function parseTtlSeconds(envName, defaultSeconds, minSeconds = 15) {
  const raw = parseInt(process.env[envName] || String(defaultSeconds), 10);
  if (Number.isNaN(raw)) {
    return defaultSeconds;
  }
  return Math.max(minSeconds, raw);
}

module.exports = {
  shouldSkipRedisCache,
  parseTtlSeconds
};
