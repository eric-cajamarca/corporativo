/**
 * Cobro de venta agrupada: detalle de pago y movimientos de caja repartidos por empresa/comprobante.
 */
const sql = require('mssql');
const CajaRepository = require('../repositories/caja.repository');
const ventasRepository = require('../repositories/ventas.repository');
const { repartirDetallePagoEntreComprobantes, round2 } = require('../utils/ventaAgrupadaPago.util');
const ventaCreditoPostVentaService = require('./ventaCreditoPostVenta.service');
const { normalizarDetallePagoIdMediosPago } = require('../utils/detallePagoNormalizar.util');

/**
 * Resuelve apertura de caja abierta para registrar el ingreso de una línea de comprobante.
 * Si la línea es de la empresa cobradora (gestora) y viene idAperturaGestoraOpcional válido, se usa.
 */
async function obtenerIdAperturaParaEmpresaVenta(pool, linea, opts) {
  const { idEmpresaCobradora, idAperturaGestoraOpcional, idSucursalGestoraFallback } = opts;
  const esGestora = String(linea.idEmpresa) === String(idEmpresaCobradora);

  if (esGestora && idAperturaGestoraOpcional) {
    const r = await pool
      .request()
      .input('idApertura', sql.UniqueIdentifier, idAperturaGestoraOpcional)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresaCobradora)
      .query(`
        SELECT TOP 1 ac.idApertura, ac.idSucursal
        FROM AperturasCaja ac
        WHERE ac.idApertura = @idApertura AND ac.idEmpresa = @idEmpresa AND ac.estado = 1
      `);
    if (r.recordset && r.recordset[0]) {
      return {
        idApertura: r.recordset[0].idApertura,
        idSucursal: r.recordset[0].idSucursal,
      };
    }
  }

  let idSucursal = linea.idSucursal || idSucursalGestoraFallback;
  if (idSucursal) {
    const ap = await CajaRepository.obtenerAperturaAbiertaPorSucursalRepo(pool, linea.idEmpresa, idSucursal);
    if (ap && ap.idApertura) {
      return { idApertura: ap.idApertura, idSucursal: ap.idSucursal || idSucursal };
    }
  }

  const cualquier = await CajaRepository.obtenerCualquierAperturaAbiertaRepo(pool, linea.idEmpresa);
  if (cualquier && cualquier.idApertura) {
    return { idApertura: cualquier.idApertura, idSucursal: cualquier.idSucursal };
  }

  return null;
}

/**
 * Inserta DetallePagoVenta por cada comprobante (montos repartidos) y registra MovimientosCaja en la empresa de cada venta.
 *
 * @param {import('mssql').ConnectionPool} pool
 * @param {import('mssql').Transaction} transaction
 * @param {{
 *   lineasVenta: { idVenta: number, idEmpresa: string, compVenta?: string, total: number, idSucursal?: string|null }[],
 *   detallePago: { idMediosPago?: number, monto: number }[],
 *   idEmpresaCobradora: string,
 *   idUsuario: string,
 *   compVentaVA: string,
 *   idAperturaGestoraOpcional?: string|null,
 *   idSucursalGestoraFallback?: string|null
 * }} payload
 */
exports.aplicarCobroVentasAgrupadasMulticompania = async (pool, transaction, payload) => {
  const {
    lineasVenta,
    detallePago,
    idEmpresaCobradora,
    idUsuario,
    compVentaVA,
    idAperturaGestoraOpcional,
    idSucursalGestoraFallback,
  } = payload;

  for (const l of lineasVenta) {
    if (l.idVenta == null || !Number.isFinite(Number(l.idVenta))) {
      throw new Error('Un comprobante de la venta agrupada no tiene idVenta válido; no se puede registrar el cobro.');
    }
  }

  const detalleNorm = await normalizarDetallePagoIdMediosPago(transaction, detallePago);
  const reparto = repartirDetallePagoEntreComprobantes(lineasVenta, detalleNorm);

  const idsCredito = await ventaCreditoPostVentaService.idsMediosPagoCredito(transaction);

  const conceptoBase = compVentaVA && String(compVentaVA).trim() ? String(compVentaVA).trim() : 'S/N';
  const conceptoVa = `Cobro VA ${conceptoBase}`;

  for (const linea of reparto) {
    await ventasRepository.insertarDetallePagoVenta(transaction, linea.idVenta, linea.detallePago);

    const detalleCaja = (linea.detallePago || []).filter((p) => !idsCredito.has(Number(p.idMediosPago)));
    const montoCaja = round2(detalleCaja.reduce((s, p) => s + (Number(p.monto) || 0), 0));
    if (montoCaja <= 0.001) {
      continue;
    }

    const apInfo = await obtenerIdAperturaParaEmpresaVenta(pool, linea, {
      idEmpresaCobradora,
      idAperturaGestoraOpcional,
      idSucursalGestoraFallback,
    });

    if (!apInfo || !apInfo.idApertura) {
      throw new Error(
        `No hay caja abierta para registrar cobros al contado del comprobante ${linea.compVenta || linea.idVenta}. ` +
          'El importe en crédito no ingresa a caja; abra caja si la venta incluye efectivo u otros medios.'
      );
    }

    const compHijo = linea.compVenta && String(linea.compVenta).trim() ? String(linea.compVenta).trim() : '';
    let conceptoVentaCaja = compHijo ? `${conceptoVa} (${compHijo})` : conceptoVa;
    if (conceptoVentaCaja.length > 100) {
      conceptoVentaCaja = conceptoVentaCaja.substring(0, 100);
    }

    await CajaRepository.registrarMovimientosVentaContadoRepo(transaction, {
      idApertura: apInfo.idApertura,
      idEmpresa: linea.idEmpresa,
      idSucursal: apInfo.idSucursal,
      idUsuario,
      idVenta: linea.idVenta,
      compVenta: compHijo || 'S/N',
      conceptoVentaCaja,
      detallePago: detalleCaja,
      fechaMovimiento: linea.fEmision || null,
    });
  }
};
