const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const empresaSuscripcionUsoRepository = require('../repositories/empresaSuscripcionUso.repository');

/**
 * Estados que cuentan como "aceptado por SUNAT" para cuota de plan (CDR código 0 u observaciones 1/2).
 * No incluye "en proceso" (p. ej. 2 en otros flujos) ni baja aceptada (08).
 */
function estadoSunatCuentaCuotaAceptacion(idEstadoSunat) {
  const n = idEstadoSunat != null ? Number(idEstadoSunat) : NaN;
  return n === 1 || n === 3;
}

function transicionSumaUnComprobante(idEstadoAnterior, idEstadoNuevo) {
  return (
    estadoSunatCuentaCuotaAceptacion(idEstadoNuevo) &&
    !estadoSunatCuentaCuotaAceptacion(idEstadoAnterior)
  );
}

/**
 * Tras actualizar ComprobantesElectronicos (factura, boleta, NC, ND, etc.).
 */
async function registrarTransicionComprobanteElectronico(poolOrTx, idEmpresa, idEstadoAnterior, idEstadoNuevo) {
  if (!idEmpresa || !transicionSumaUnComprobante(idEstadoAnterior, idEstadoNuevo)) return;
  await empresaSuscripcionRepository.incrementarContadorComprobantesSunatAceptados(poolOrTx, idEmpresa);
}

/**
 * Tras actualizar GuiasElectronicasEmitidas.
 */
async function registrarTransicionGuiaElectronica(poolOrTx, idEmpresa, idEstadoAnterior, idEstadoNuevo) {
  await registrarTransicionComprobanteElectronico(poolOrTx, idEmpresa, idEstadoAnterior, idEstadoNuevo);
}

/**
 * Cabecera de comunicación de baja (RA): un documento SUNAT adicional respecto a los comprobantes ya contados.
 */
async function registrarTransicionComunicacionBaja(poolOrTx, idEmpresa, idEstadoAnterior, idEstadoNuevo) {
  await registrarTransicionComprobanteElectronico(poolOrTx, idEmpresa, idEstadoAnterior, idEstadoNuevo);
}

/**
 * Uso efectivo para cuota: el mayor entre el contador persistido y el recuento desde tablas
 * (incluye comprobantes aceptados antes de existir el contador).
 */
async function obtenerUsadosComprobantesSunatEfectivo(pool, idEmpresa) {
  if (!idEmpresa) return 0;
  const [desdeTablas, row] = await Promise.all([
    empresaSuscripcionUsoRepository.contarComprobantesSunatDesdeTablas(pool, idEmpresa),
    empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa)
  ]);
  const cont = Number(row?.contadorComprobantesSunatAceptados);
  const c = Number.isFinite(cont) ? Math.max(0, Math.floor(cont)) : 0;
  const t = Number.isFinite(desdeTablas) ? Math.max(0, Math.floor(desdeTablas)) : 0;
  return Math.max(c, t);
}

module.exports = {
  estadoSunatCuentaCuotaAceptacion,
  transicionSumaUnComprobante,
  registrarTransicionComprobanteElectronico,
  registrarTransicionGuiaElectronica,
  registrarTransicionComunicacionBaja,
  obtenerUsadosComprobantesSunatEfectivo
};
