const gestoresRepository = require('../repositories/gestores.repository');
const sucursalRepository = require('../repositories/sucursal.repository');
const CajaRepository = require('../repositories/caja.repository');
const documentoService = require('./documento.service');
const tablassunatService = require('./tablassunat.service');
const ventasOrquestacion = require('./ventasOrquestacion.service');
const { idsSucursalesFiltroCatalogo } = require('../utils/sucursalUsuarioScope.util');

/**
 * Datos iniciales para pantallas de venta (completa / rápida) en una sola petición.
 */
exports.obtenerBootstrapVenta = async (pool, user) => {
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
    cajasRaw,
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
    CajaRepository.obtenerCajasRepo(pool, idEmpresa).catch(() => []),
    tablassunatService.obtenerMoneda(pool).catch(() => []),
    tablassunatService.obtenerEstadoPago(pool).catch(() => []),
    tablassunatService.obtenerEstadosPedidos(pool).catch(() => []),
    tablassunatService.obtenerMediosPago(pool).catch(() => []),
    documentoService.listarFormasPago(pool, user).catch(() => []),
    ventasOrquestacion.getConfigDefaults(pool, idEmpresa)
  ]);

  const cajas = (cajasRaw || []).filter((c) => c && (Number(c.cajaAbierta) === 1));

  return {
    configuracion: configuracion || [],
    sucursales: sucursales || [],
    documentos: documentos || [],
    cajas,
    monedas: monedas || [],
    estadosPago: estadosPago || [],
    estadosPedido: estadosPedido || [],
    mediosPago: mediosPago || [],
    formasPago: formasPago || [],
    configDefaults: configDefaults || {},
    esGestora,
    esEmpresaGestionada
  };
};
