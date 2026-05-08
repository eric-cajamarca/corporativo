const gestoresRepository = require('../repositories/gestores.repository');
const usuarioSucursalRepository = require('../repositories/usuarioSucursal.repository');

function idUsuarioDesdeUser(user) {
  return user?.sub || user?.idUsuario || null;
}

/**
 * IDs de sucursales activas asignadas al usuario en la empresa del token.
 * null = no aplicar filtro (usuario sin asignaciones, o contexto exento).
 */
async function idsSucursalesUsuarioAsignadas(pool, user) {
  const idU = idUsuarioDesdeUser(user);
  if (!user?.empresa || !idU) return null;
  const rows = await usuarioSucursalRepository.obtenerSucursalesActivasUsuario(pool, idU, user.empresa);
  if (!rows || rows.length === 0) return null;
  const ids = [...new Set(rows.map((r) => r.idSucursal).filter(Boolean))];
  return ids.length > 0 ? ids : null;
}

/**
 * Acotar catálogos (productos/stock/sucursales operativas) por sucursales del usuario.
 * No aplica en empresa gestionada (Gestores_Empresas como destino) ni en empresa gestora activa.
 */
async function debeFiltrarCatalogoPorSucursalesUsuario(pool, user) {
  if (!user?.empresa) return false;
  if (await gestoresRepository.esEmpresaGestionadaActiva(pool, user.empresa)) return false;
  if (await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa)) return false;
  const ids = await idsSucursalesUsuarioAsignadas(pool, user);
  return Array.isArray(ids) && ids.length > 0;
}

/**
 * null si no hay que filtrar; array de UUIDs si solo debe verse stock/listados de esas sucursales.
 */
async function idsSucursalesFiltroCatalogo(pool, user) {
  const aplicar = await debeFiltrarCatalogoPorSucursalesUsuario(pool, user);
  if (!aplicar) return null;
  return idsSucursalesUsuarioAsignadas(pool, user);
}

/**
 * Valida que idSucursal pertenezca a la empresa y, si aplica filtro por usuario, esté asignada.
 */
async function assertSucursalPermitidaParaUsuario(pool, user, idSucursal) {
  if (!idSucursal || !user?.empresa) {
    throw new Error('BAD_REQUEST');
  }
  const sucursalRepository = require('../repositories/sucursal.repository');
  const existe = await sucursalRepository.existeSucursalEnEmpresa(pool, idSucursal, user.empresa);
  if (!existe) {
    throw new Error('NOT_FOUND');
  }
  const permitidas = await idsSucursalesFiltroCatalogo(pool, user);
  if (!permitidas || permitidas.length === 0) return;
  const ok = permitidas.some((id) => String(id).toLowerCase() === String(idSucursal).toLowerCase());
  if (!ok) {
    throw new Error('SUCURSAL_NO_PERMITIDA');
  }
}

module.exports = {
  idsSucursalesUsuarioAsignadas,
  debeFiltrarCatalogoPorSucursalesUsuario,
  idsSucursalesFiltroCatalogo,
  assertSucursalPermitidaParaUsuario
};
