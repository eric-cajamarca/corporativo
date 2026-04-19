const { getDeploymentMode } = require('../config/deployment.config');
const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const empresaSuscripcionUsoRepository = require('../repositories/empresaSuscripcionUso.repository');
const saasPlanesService = require('./saasPlanes.service');

async function obtenerMiEstado(pool, idEmpresa) {
  const suscripcion = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
  const planCatalogo = suscripcion?.planCode
    ? await saasPlanesService.obtenerResumenPlanAsync(pool, suscripcion.planCode)
    : null;

  let limitesUso = null;
  if (planCatalogo) {
    const uso = await empresaSuscripcionUsoRepository.contarUso(pool, idEmpresa);
    const maxU = Number(planCatalogo.maxUsuarios);
    const maxS = Number(planCatalogo.maxSucursales);
    limitesUso = {
      maxUsuarios: maxU,
      maxSucursales: maxS,
      usuariosActivos: uso.usuariosActivos,
      sucursales: uso.sucursales,
      excedeUsuarios: maxU > 0 && uso.usuariosActivos > maxU,
      excedeSucursales: maxS > 0 && uso.sucursales > maxS
    };
  }

  return {
    deploymentMode: getDeploymentMode(),
    suscripcion,
    planCatalogo,
    limitesUso
  };
}

module.exports = {
  obtenerMiEstado
};
