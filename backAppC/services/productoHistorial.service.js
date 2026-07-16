// services/productoHistorial.service.js
const gestoresRepository = require('../repositories/gestores.repository');
const permisosService = require('./permisos.service');
const productoHistorialRepository = require('../repositories/productoHistorial.repository');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolverIdsEmpresa(pool, user) {
  const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
  if (esGestora) {
    const empresasGestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, user.empresa);
    return [user.empresa, ...(empresasGestionadas || []).map((e) => e.idEmpresa).filter(Boolean)];
  }
  return [user.empresa];
}

async function assertPuedeVerHistorialVentas(pool, user) {
  if (!user || !user.empresa) {
    throw new Error('NO_ACCESS');
  }
  const esAdmin = user.rol === 'Administrador';
  const puede =
    esAdmin ||
    (await permisosService.verificarPermisoUsuario(pool, 'CREAR_VENTAS', user)) ||
    (await permisosService.verificarPermisoUsuario(pool, 'VER_VENTAS', user)) ||
    (await permisosService.verificarPermisoUsuario(pool, 'VER_PRODUCTOS', user));
  if (!puede) {
    throw new Error('NO_PERMISSIONS');
  }
}

function assertEsAdministrador(user) {
  if (!user || !user.empresa) {
    throw new Error('NO_ACCESS');
  }
  if (String(user.rol || '').trim() !== 'Administrador') {
    const err = new Error('SOLO_ADMINISTRADOR');
    throw err;
  }
}

function parseIdProducto(idProducto) {
  const id = String(idProducto || '').trim();
  if (!UUID_RE.test(id)) {
    throw new Error('ID_PRODUCTO_INVALIDO');
  }
  return id;
}

/**
 * Historial de ventas del producto (cualquier rol con permiso de ventas/productos).
 */
exports.obtenerHistorialVentasProducto = async (pool, user, idProducto, query = {}) => {
  await assertPuedeVerHistorialVentas(pool, user);
  const id = parseIdProducto(idProducto);
  const idsEmpresa = await resolverIdsEmpresa(pool, user);
  return productoHistorialRepository.listarHistorialVentasProducto(pool, {
    idsEmpresa,
    idProducto: id,
    limite: query.limite,
    idCliente: query.idCliente,
    fechaDesde: query.fechaDesde
  });
};

/**
 * Historial de compras del producto — solo rol Administrador.
 */
exports.obtenerHistorialComprasProducto = async (pool, user, idProducto, query = {}) => {
  assertEsAdministrador(user);
  const id = parseIdProducto(idProducto);
  const idsEmpresa = await resolverIdsEmpresa(pool, user);
  return productoHistorialRepository.listarHistorialComprasProducto(pool, {
    idsEmpresa,
    idProducto: id,
    limite: query.limite,
    fechaDesde: query.fechaDesde
  });
};
