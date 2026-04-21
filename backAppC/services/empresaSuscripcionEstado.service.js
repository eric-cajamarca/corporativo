const { getDeploymentMode } = require('../config/deployment.config');
const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const empresaSuscripcionUsoRepository = require('../repositories/empresaSuscripcionUso.repository');
const suscripcionCheckoutRepository = require('../repositories/suscripcionCheckout.repository');
const saasPlanesService = require('./saasPlanes.service');
const saasPlanLimitesService = require('./saasPlanLimites.service');
const saasContadorComprobantesSunatService = require('./saasContadorComprobantesSunat.service');

async function obtenerMiEstado(pool, idEmpresa) {
  const deploymentMode = getDeploymentMode();
  const suscripcion = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
  const planCatalogo = suscripcion?.planCode
    ? await saasPlanesService.obtenerResumenPlanAsync(pool, suscripcion.planCode)
    : null;

  let limitesUso = null;
  let onboarding = null;
  if (planCatalogo) {
    const uso = await empresaSuscripcionUsoRepository.contarUso(pool, idEmpresa);
    const banderas = await saasPlanLimitesService.obtenerBanderasPlan(pool, idEmpresa);
    const maxU = Number(planCatalogo.maxUsuarios);
    const maxS = Number(planCatalogo.maxSucursales);
    const maxCompSunat = Number(planCatalogo.maxComprobantesSunatAceptados);
    const compU = banderas
      ? Number(banderas.comprobantesSunatAceptados)
      : await saasContadorComprobantesSunatService.obtenerUsadosComprobantesSunatEfectivo(pool, idEmpresa);
    const compNorm = Number.isFinite(compU) ? Math.max(0, Math.floor(compU)) : 0;
    if (deploymentMode === 'saas' && suscripcion) {
      await empresaSuscripcionRepository.actualizarContadorSunatSiInferior(pool, idEmpresa, compNorm);
    }
    const limComp = Number.isFinite(maxCompSunat) && maxCompSunat > 0;
    limitesUso = {
      maxUsuarios: maxU,
      maxSucursales: maxS,
      maxDireccionesEmpresa: maxS,
      maxComprobantesSunatAceptados: maxCompSunat,
      comprobantesSunatAceptados: compNorm,
      usuariosActivos: uso.usuariosActivos,
      usuariosOcupados: uso.usuariosPlazas,
      sucursales: uso.sucursales,
      direccionesEmpresa: uso.direccionesEmpresa,
      excedeUsuarios: maxU > 0 && uso.usuariosPlazas > maxU,
      excedeSucursales: maxS > 0 && uso.sucursales > maxS,
      excedeDirecciones: maxS > 0 && uso.direccionesEmpresa > maxS,
      excedeComprobantesSunat: limComp && compNorm >= maxCompSunat,
      puedeCrearUsuario: banderas == null ? true : banderas.puedeCrearUsuario,
      puedeCrearSucursal: banderas == null ? true : banderas.puedeCrearSucursal,
      puedeAgregarDireccionEmpresa: banderas == null ? true : banderas.puedeAgregarDireccionEmpresa,
      puedeCrearVentaPorCuotaSunat:
        banderas == null ? !limComp || compNorm < maxCompSunat : banderas.puedeCrearVentaPorCuotaSunat
    };

    const metricas = await empresaSuscripcionUsoRepository.obtenerMetricasOnboarding(pool, idEmpresa);
    const tieneConfigSunat = Number(metricas?.tieneConfigSunat || 0) > 0;
    const fechaPrimerComprobante = metricas?.fechaPrimerComprobante
      ? new Date(metricas.fechaPrimerComprobante)
      : null;
    const fechaInicioSuscripcion = suscripcion?.fechaInicio ? new Date(suscripcion.fechaInicio) : null;
    const minsPrimerComp =
      fechaPrimerComprobante && fechaInicioSuscripcion && !Number.isNaN(fechaPrimerComprobante.getTime())
        ? Math.max(0, Math.round((fechaPrimerComprobante.getTime() - fechaInicioSuscripcion.getTime()) / 60000))
        : null;
    onboarding = {
      tieneConfigSunat,
      fechaPrimerComprobante: fechaPrimerComprobante && !Number.isNaN(fechaPrimerComprobante.getTime())
        ? fechaPrimerComprobante.toISOString()
        : null,
      minutosHastaPrimerComprobante: minsPrimerComp
    };
  }

  let checkoutsOrden = [];
  if (deploymentMode === 'saas') {
    try {
      const idOrigen = suscripcion?.idCheckoutOrigen || null;
      checkoutsOrden = await suscripcionCheckoutRepository.listarPorEmpresaOCheckoutOrigen(
        pool,
        idEmpresa,
        idOrigen
      );
    } catch (err) {
      console.error('contexto: obtenerMiEstado listar checkouts orden', err);
      checkoutsOrden = [];
    }
  }

  return {
    deploymentMode,
    suscripcion,
    planCatalogo,
    limitesUso,
    onboarding,
    checkoutsOrden
  };
}

module.exports = {
  obtenerMiEstado
};
