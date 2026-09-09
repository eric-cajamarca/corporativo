const suscripcionCatalogoAdminService = require('../services/suscripcionCatalogoAdmin.service');
const rolRepository = require('../repositories/rol.repository');

const NOMBRES_RESERVADOS = new Set([
  'superadmin',
  'superusuario',
  'super usuario',
  'super_usuario',
  'super-usuario'
]);

function normalizarNombreRol(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function esNombreRolReservadoPlataforma(descripcion) {
  return NOMBRES_RESERVADOS.has(normalizarNombreRol(descripcion));
}

async function assertNombreRolPermitido(pool, user, descripcion) {
  if (!esNombreRolReservadoPlataforma(descripcion)) {
    return;
  }
  const esPrincipal = await suscripcionCatalogoAdminService.usuarioEsEmpresaPrincipal(pool, user);
  if (!esPrincipal) {
    throw new Error('ROL_NO_DISPONIBLE');
  }
}

async function assertIdRolAsignable(pool, user, idRol) {
  const idEmpresa = user?.empresa || user?.idEmpresa;
  if (!idRol || !idEmpresa) {
    throw new Error('ROL_NO_EXISTE');
  }
  const rol = await rolRepository.obtenerRolPorId(pool, idRol, idEmpresa);
  if (!rol) {
    throw new Error('ROL_NO_EXISTE');
  }
  await assertNombreRolPermitido(pool, user, rol.descripcion);
}

async function filtrarRolesListables(pool, user, roles) {
  const esPrincipal = await suscripcionCatalogoAdminService.usuarioEsEmpresaPrincipal(pool, user);
  if (esPrincipal) {
    return roles || [];
  }
  return (roles || []).filter((r) => !esNombreRolReservadoPlataforma(r.descripcion));
}

module.exports = {
  esNombreRolReservadoPlataforma,
  assertNombreRolPermitido,
  assertIdRolAsignable,
  filtrarRolesListables
};
