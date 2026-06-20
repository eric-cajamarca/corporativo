const { getDeploymentMode } = require('../config/deployment.config');
const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const empresaSuscripcionUsoRepository = require('../repositories/empresaSuscripcionUso.repository');
const suscripcionCheckoutRepository = require('../repositories/suscripcionCheckout.repository');
const saasPlanesService = require('./saasPlanes.service');
const saasPlanLimitesService = require('./saasPlanLimites.service');
const { construirAlertasPlan } = require('../utils/saasPlanAlertas.util');
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
    const maxProd = Number(planCatalogo.maxProductosActivos ?? 0);
    const maxBot = Number(planCatalogo.maxBotConversacionesSimultaneas ?? 0);
    const compU = banderas
      ? Number(banderas.comprobantesSunatAceptados)
      : await saasContadorComprobantesSunatService.obtenerUsadosComprobantesSunatEfectivo(pool, idEmpresa);
    const compNorm = Number.isFinite(compU) ? Math.max(0, Math.floor(compU)) : 0;
    const prodU = Number(uso.productosActivos) || 0;
    const botU = banderas ? Number(banderas.botConversacionesActivas) || 0 : 0;
    if (deploymentMode === 'saas' && suscripcion) {
      await empresaSuscripcionRepository.actualizarContadorSunatSiInferior(pool, idEmpresa, compNorm);
    }
    const limComp = Number.isFinite(maxCompSunat) && maxCompSunat > 0;
    const limProd = Number.isFinite(maxProd) && maxProd > 0;
    const limBot = Number.isFinite(maxBot) && maxBot > 0;
    const alertasPlan =
      banderas && Array.isArray(banderas.alertasPlan)
        ? banderas.alertasPlan
        : construirAlertasPlan({
            comprobantesSunat: compNorm,
            maxComprobantesSunat: maxCompSunat,
            usuariosOcupados: uso.usuariosPlazas,
            maxUsuarios: maxU,
            sucursales: uso.sucursales,
            maxSucursales: maxS,
            productosActivos: prodU,
            maxProductos: maxProd,
            botConversacionesActivas: botU,
            maxBotConversaciones: maxBot
          });
    limitesUso = {
      maxUsuarios: maxU,
      maxSucursales: maxS,
      maxDireccionesEmpresa: maxS,
      maxComprobantesSunatAceptados: maxCompSunat,
      maxProductosActivos: maxProd,
      maxBotConversacionesSimultaneas: maxBot,
      comprobantesSunatAceptados: compNorm,
      productosActivos: prodU,
      botConversacionesActivas: botU,
      usuariosActivos: uso.usuariosActivos,
      usuariosOcupados: uso.usuariosPlazas,
      sucursales: uso.sucursales,
      direccionesEmpresa: uso.direccionesEmpresa,
      excedeUsuarios: maxU > 0 && uso.usuariosPlazas >= maxU,
      excedeSucursales: maxS > 0 && uso.sucursales >= maxS,
      excedeDirecciones: maxS > 0 && uso.direccionesEmpresa >= maxS,
      excedeComprobantesSunat: limComp && compNorm >= maxCompSunat,
      excedeProductos: limProd && prodU >= maxProd,
      excedeBotConversaciones: limBot && botU >= maxBot,
      puedeCrearUsuario: banderas == null ? true : banderas.puedeCrearUsuario,
      puedeCrearSucursal: banderas == null ? true : banderas.puedeCrearSucursal,
      puedeAgregarDireccionEmpresa: banderas == null ? true : banderas.puedeAgregarDireccionEmpresa,
      puedeCrearProducto: banderas == null ? true : banderas.puedeCrearProducto,
      puedeCrearVentaPorCuotaSunat:
        banderas == null ? !limComp || compNorm < maxCompSunat : banderas.puedeCrearVentaPorCuotaSunat,
      alertasPlan
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
