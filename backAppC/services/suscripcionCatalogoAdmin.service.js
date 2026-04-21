const suscripcionRepository = require('../repositories/suscripcion.repository');
const saasPlanRepository = require('../repositories/saasPlan.repository');

function normalizarGuid(v) {
  if (v == null) return '';
  return String(v)
    .trim()
    .replace(/[{}]/g, '')
    .toLowerCase();
}

async function usuarioEsEmpresaPrincipal(pool, user) {
  const idPrincipal = await suscripcionRepository.obtenerIdEmpresaPrincipal(pool);
  if (!idPrincipal) return false;
  const idUser = normalizarGuid(user?.empresa ?? user?.idEmpresa);
  const idP = normalizarGuid(idPrincipal);
  return Boolean(idUser && idP && idUser === idP);
}

function esSuperAdmin(user) {
  return (user?.rol || '').toString() === 'superAdmin';
}

/** Catálogo de planes en BD: solo superAdmin de la empresa marcada como principal (Culqi / operador). */
async function puedeEditarCatalogoPlanes(pool, user) {
  if (!esSuperAdmin(user)) return false;
  return usuarioEsEmpresaPrincipal(pool, user);
}

function validarPayloadCatalogo(body) {
  const descripcionCorta = (body?.descripcionCorta ?? '').toString().trim();
  if (!descripcionCorta) throw new Error('DESCRIPCION_REQUERIDA');
  if (descripcionCorta.length > 300) throw new Error('DESCRIPCION_LARGA');

  const pm = Number(body?.precioMensualPen);
  const pa = Number(body?.precioAnualPen);
  if (!Number.isFinite(pm) || pm < 0) throw new Error('PRECIO_MENSUAL_INVALIDO');
  if (!Number.isFinite(pa) || pa < 0) throw new Error('PRECIO_ANUAL_INVALIDO');

  const maxUsuarios = Math.floor(Number(body?.maxUsuarios));
  const maxSucursales = Math.floor(Number(body?.maxSucursales));
  if (!Number.isFinite(maxUsuarios) || maxUsuarios < 1 || maxUsuarios > 999999) {
    throw new Error('MAX_USUARIOS_INVALIDO');
  }
  if (!Number.isFinite(maxSucursales) || maxSucursales < 1 || maxSucursales > 999999) {
    throw new Error('MAX_SUCURSALES_INVALIDO');
  }

  return { descripcionCorta, precioMensualPen: pm, precioAnualPen: pa, maxUsuarios, maxSucursales };
}

async function actualizarPlanCatalogoPublico(pool, user, planCode, body) {
  const ok = await puedeEditarCatalogoPlanes(pool, user);
  if (!ok) throw new Error('NO_AUTORIZADO_CATALOGO');

  const patch = validarPayloadCatalogo(body);
  const n = await saasPlanRepository.actualizarCatalogoEditable(pool, planCode, patch);
  if (n === 0) throw new Error('PLAN_NO_EDITABLE_EN_BD');
  return patch;
}

module.exports = {
  puedeEditarCatalogoPlanes,
  actualizarPlanCatalogoPublico,
  usuarioEsEmpresaPrincipal,
  esSuperAdmin
};
