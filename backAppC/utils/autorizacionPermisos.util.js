const permisosService = require('../services/permisos.service');

/**
 * Lanza NO_ACCESS si no hay usuario, NO_PERMISSIONS si no es Administrador
 * y no tiene ninguno de los permisos indicados (OR).
 * @param {import('mssql').ConnectionPool} pool
 * @param {object} user - req.user (JWT)
 * @param {...string} nombresPermiso - nombres en tabla Permisos.nombre
 */
async function assertAlgunoPermiso(pool, user, ...nombresPermiso) {
  if (!user) throw new Error('NO_ACCESS');
  const lista = (nombresPermiso || []).filter(Boolean);
  if (lista.length === 0) throw new Error('NO_PERMISSIONS');
  if (user.rol === 'Administrador') return;
  for (const nombre of lista) {
    if (await permisosService.verificarPermisoUsuario(pool, nombre, user)) return;
  }
  throw new Error('NO_PERMISSIONS');
}

/**
 * @returns {Promise<boolean>}
 */
async function tieneAlgunoPermiso(pool, user, ...nombresPermiso) {
  if (!user) return false;
  const lista = (nombresPermiso || []).filter(Boolean);
  if (lista.length === 0) return false;
  if (user.rol === 'Administrador') return true;
  for (const nombre of lista) {
    if (await permisosService.verificarPermisoUsuario(pool, nombre, user)) return true;
  }
  return false;
}

module.exports = {
  assertAlgunoPermiso,
  tieneAlgunoPermiso
};
