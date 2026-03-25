/**
 * Tras confirmar cobro de una venta: marca comprobantes electrónicos y dispara envío inmediato (modo 1).
 */
const FacturacionRepository = require("../repositories/facturacion.repository");
const facturacionService = require("./facturacion.service");

/**
 * @param {import("mssql").ConnectionPool} pool
 * @param {number} idVenta
 * @param {string} idEmpresa UUID
 */
exports.procesarTrasConfirmarPago = async (pool, idVenta, idEmpresa) => {
  let config;
  try {
    config = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, idEmpresa);
  } catch (err) {
    console.error("sunatPostPago: obtenerConfig", err.message);
    return;
  }
  if (!config) return;

  const usaDirecto =
    config.envioDirectoSunat &&
    config.urlEnvio &&
    String(config.urlEnvio).trim() &&
    config.usuarioSunat &&
    config.claveSunat;
  const usaFacturador =
    config.rutaCarpetaFacturadorSunat && String(config.rutaCarpetaFacturadorSunat).trim() !== "";
  if (!usaDirecto && !usaFacturador) return;

  const modo = Number(config.modoEnvioSunat) || 2;
  const minutos = Math.max(1, Number(config.minutosEnvioAutomatico) || 10);

  if (modo === 1) {
    const ids = await FacturacionRepository.listarIdsComprobantePendientePorVentaRepo(pool, idVenta, idEmpresa);
    for (const idCE of ids) {
      try {
        const result = await facturacionService.enviarComprobanteSunatPorEmpresaService(pool, idEmpresa, idCE);
        if (!result?.ok) {
          await FacturacionRepository.registrarFalloIntentoEnvioRepo(pool, idCE, idEmpresa);
        }
      } catch (e) {
        console.error("sunatPostPago envío inmediato:", idCE, e.message);
        try {
          await FacturacionRepository.registrarFalloIntentoEnvioRepo(pool, idCE, idEmpresa);
        } catch (_) {
          /* ignore */
        }
      }
    }
    return;
  }

  try {
    await FacturacionRepository.marcarPagoComprobantesElectronicosPorVentaRepo(pool, idVenta, idEmpresa, {
      modoEnvioSunat: modo,
      minutosEspera: minutos
    });
  } catch (err) {
    console.error("sunatPostPago: marcarPago", err.message);
  }
};

/**
 * Ejecuta en segundo plano tras responder el HTTP del cobro (no bloquea la respuesta).
 * @param {import("mssql").ConnectionPool} pool
 * @param {number} idVenta
 * @param {string} idEmpresa
 */
exports.encolarTrasConfirmarPago = (pool, idVenta, idEmpresa) => {
  setImmediate(() => {
    exports
      .procesarTrasConfirmarPago(pool, idVenta, idEmpresa)
      .catch((e) => console.error("sunatPostPago encolar:", e.message));
  });
};
