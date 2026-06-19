const gestoresRepository = require('../repositories/gestores.repository');
const sucursalRepository = require('../repositories/sucursal.repository');
const CajaRepository = require('../repositories/caja.repository');
const documentoService = require('./documento.service');
const tablassunatService = require('./tablassunat.service');
const ventasOrquestacion = require('./ventasOrquestacion.service');
const { idsSucursalesFiltroCatalogo } = require('../utils/sucursalUsuarioScope.util');
const cache = require('../cache/redis.client');
const { parseTtlSeconds } = require('../utils/cacheSkip.util');

function bootstrapCacheKey(user) {
  const emp = String(user?.empresa || '').trim().toLowerCase();
  const uid = String(user?.idUsuario || user?.id || '').trim().toLowerCase();
  const rol = String(user?.rol || '').trim().toLowerCase();
  return `venta:bootstrap:v1:${emp}:${uid}:${rol}`;
}

async function obtenerCajasAbiertas(pool, idEmpresa) {
  const cajasRaw = await CajaRepository.obtenerCajasRepo(pool, idEmpresa).catch(() => []);
  return (cajasRaw || []).filter((c) => c && Number(c.cajaAbierta) === 1);
}

async function obtenerBootstrapVentaSinCajas(pool, user) {
  if (!user?.empresa) throw new Error('NO_EMPRESA');
  const idEmpresa = user.empresa;
  const esAdmin = user.rol === 'Administrador' || user.rol === 'superAdmin';
  const idsSucUsuario = esAdmin ? null : await idsSucursalesFiltroCatalogo(pool, user);

  let esGestora = false;
  let esEmpresaGestionada = false;
  try {
    esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, idEmpresa);
    if (!esGestora) {
      esEmpresaGestionada = await gestoresRepository.esEmpresaGestionadaActiva(pool, idEmpresa);
    }
  } catch (_) {
    esGestora = false;
    esEmpresaGestionada = false;
  }

  const [
    configuracion,
    sucursales,
    documentos,
    monedas,
    estadosPago,
    estadosPedido,
    mediosPago,
    formasPago,
    configDefaults
  ] = await Promise.all([
    gestoresRepository.obtenerConfiguracionEmpresa(pool, idEmpresa),
    sucursalRepository.listarTodosPorEmpresa(pool, idEmpresa, true, idsSucUsuario),
    documentoService.listarDocumentos(pool, user).catch(() => []),
    tablassunatService.obtenerMoneda(pool).catch(() => []),
    tablassunatService.obtenerEstadoPago(pool).catch(() => []),
    tablassunatService.obtenerEstadosPedidos(pool).catch(() => []),
    tablassunatService.obtenerMediosPago(pool).catch(() => []),
    documentoService.listarFormasPago(pool, user).catch(() => []),
    ventasOrquestacion.getConfigDefaults(pool, idEmpresa)
  ]);

  return {
    configuracion: configuracion || [],
    sucursales: sucursales || [],
    documentos: documentos || [],
    monedas: monedas || [],
    estadosPago: estadosPago || [],
    estadosPedido: estadosPedido || [],
    mediosPago: mediosPago || [],
    formasPago: formasPago || [],
    configDefaults: configDefaults || {},
    esGestora,
    esEmpresaGestionada
  };
}

/**
 * Datos iniciales para pantallas de venta (completa / rápida) en una sola petición.
 * Catálogos estables en Redis; cajas siempre frescas (apertura/cierre).
 */
exports.obtenerBootstrapVenta = async (pool, user, options = {}) => {
  if (!user?.empresa) throw new Error('NO_EMPRESA');
  const idEmpresa = user.empresa;
  const skipCache = options.skipCache === true;
  const ttlSeconds = parseTtlSeconds('REDIS_BOOTSTRAP_TTL_SECONDS', 90, 30);

  let base;
  if (skipCache) {
    base = await obtenerBootstrapVentaSinCajas(pool, user);
  } else {
    const cacheKey = bootstrapCacheKey(user);
    base = await cache.getCached(
      cacheKey,
      () => obtenerBootstrapVentaSinCajas(pool, user),
      ttlSeconds
    );
  }

  const cajas = await obtenerCajasAbiertas(pool, idEmpresa);
  return {
    ...base,
    cajas
  };
};
