/**
 * Cliente Redis para cache. Si REDIS_URL / REDIS_HOST no están configurados,
 * get devuelve null y set no hace nada (fallback sin Redis para entornos locales).
 */
require("dotenv").config();

const Redis = require("ioredis");

let client = null;

function createClient() {
  const url = process.env.REDIS_URL && process.env.REDIS_URL.trim();
  if (url) {
    return new Redis(url, { maxRetriesPerRequest: 2, retryStrategy: () => null, lazyConnect: true });
  }
  const host = process.env.REDIS_HOST && process.env.REDIS_HOST.trim();
  if (host) {
    const port = parseInt(process.env.REDIS_PORT || "6379", 10);
    const password = process.env.REDIS_PASSWORD && process.env.REDIS_PASSWORD.trim() ? process.env.REDIS_PASSWORD : undefined;
    return new Redis({ host, port, password, maxRetriesPerRequest: 2, retryStrategy: () => null, lazyConnect: true });
  }
  return null;
}

try {
  client = createClient();
  if (client) {
    client.on("error", (err) => {
      console.error("Redis error:", err.message);
    });
  }
} catch (e) {
  console.error("Redis init:", e.message);
  client = null;
}

/**
 * Obtiene un valor desde Redis.
 * @param {string} key - Clave
 * @returns {Promise<string|null>} Valor o null si no hay cache o Redis no está disponible
 */
async function get(key) {
  if (!client) return null;
  try {
    return await client.get(key);
  } catch (err) {
    console.error("Redis get:", err.message);
    return null;
  }
}

/**
 * Guarda un valor en Redis con TTL.
 * @param {string} key - Clave
 * @param {string} value - Valor (usar JSON.stringify para objetos)
 * @param {number} ttlSeconds - TTL en segundos
 * @returns {Promise<void>}
 */
async function set(key, value, ttlSeconds) {
  if (!client) return;
  try {
    if (ttlSeconds > 0) {
      await client.setex(key, ttlSeconds, value);
    } else {
      await client.set(key, value);
    }
  } catch (err) {
    console.error("Redis set:", err.message);
  }
}

/**
 * Obtiene desde cache o ejecuta fetchFn y guarda el resultado (cache-aside).
 * @param {string} key - Clave de cache
 * @param {() => Promise<any>} fetchFn - Función que devuelve el valor si hay miss
 * @param {number} ttlSeconds - TTL en segundos
 * @returns {Promise<any>}
 */
async function getCached(key, fetchFn, ttlSeconds) {
  const cached = await get(key);
  if (cached != null) {
    try {
      return JSON.parse(cached);
    } catch (_) {
      return fetchFn();
    }
  }
  const value = await fetchFn();
  await set(key, JSON.stringify(value), ttlSeconds);
  return value;
}

async function del(key) {
  if (!client) return;
  try {
    await client.del(key);
  } catch (err) {
    console.error("Redis del:", err.message);
  }
}

module.exports = {
  get,
  set,
  getCached,
  del,
  get client() {
    return client;
  }
};
