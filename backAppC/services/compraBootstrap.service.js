const documentoService = require('./documento.service');
const comprobantesService = require('./comprobantes.service');
const tablassunatService = require('./tablassunat.service');
const sucursalRepository = require('../repositories/sucursal.repository');
const comprasRepository = require('../repositories/compras.repository');
const { idsSucursalesFiltroCatalogo } = require('../utils/sucursalUsuarioScope.util');

/**
 * Datos iniciales para registro de compras en una sola petición.
 */
exports.obtenerBootstrapCompra = async (pool, user) => {
  if (!user?.empresa) throw new Error('NO_EMPRESA');
  const idEmpresa = user.empresa;
  const esAdmin = user.rol === 'Administrador' || user.rol === 'superAdmin';
  const idsSucUsuario = esAdmin ? null : await idsSucursalesFiltroCatalogo(pool, user);

  const [comprobantes, monedas, estadosPago, mediosPago, formasPago, sucursales, correlativos] = await Promise.all([
    comprobantesService.obtenerComprobantes(pool, user, 'compra', null).catch(() => []),
    tablassunatService.obtenerMoneda(pool).catch(() => []),
    tablassunatService.obtenerEstadoPago(pool).catch(() => []),
    tablassunatService.obtenerMediosPago(pool).catch(() => []),
    documentoService.listarFormasPago(pool, user).catch(() => []),
    sucursalRepository.listarTodosPorEmpresa(pool, idEmpresa, true, idsSucUsuario),
    comprasRepository.listarCorrelativos(pool, idEmpresa).catch(() => [])
  ]);

  return {
    comprobantes: comprobantes || [],
    monedas: monedas || [],
    estadosPago: estadosPago || [],
    mediosPago: mediosPago || [],
    formasPago: formasPago || [],
    sucursales: sucursales || [],
    correlativos: correlativos || []
  };
};
