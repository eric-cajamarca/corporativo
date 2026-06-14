/**
 * Tras crear comprobantes hijos de una venta agrupada: genera CreditosClientes/CuotasCredito
 * según líneas de detalle cuyo MediosPago se identifica como crédito (descripción contiene "credito").
 */
const creditosRepository = require("../repositories/creditos.repository");
const { repartirDetallePagoEntreComprobantes, round2 } = require("../utils/ventaAgrupadaPago.util");
const { getFechaSoloSQLString, getFechaHoyLocal } = require("../utils/fechaHoraLocal.util");
const { normalizarDetallePagoIdMediosPago } = require("../utils/detallePagoNormalizar.util");

async function idsMediosPagoCredito(transaction) {
  const r = await transaction.request().query(`
    SELECT idMediosPago FROM MediosPago
    WHERE RTRIM(LTRIM(ISNULL(codigo, ''))) IN ('010', '10')
       OR (
            (LOWER(ISNULL(descripcion, '')) LIKE '%credito%' OR LOWER(ISNULL(descripcion, '')) LIKE N'%crédito%')
            AND LOWER(ISNULL(descripcion, '')) NOT LIKE '%tarjeta%'
          )
  `);
  return new Set((r.recordset || []).map((x) => Number(x.idMediosPago)).filter(Number.isFinite));
}

function sumaCreditoEnDetalle(detallePago, idsCredito) {
  return round2(
    (detallePago || []).reduce((s, p) => {
      const id = Number(p.idMediosPago);
      if (!idsCredito.has(id)) return s;
      return s + (Number(p.monto) || 0);
    }, 0)
  );
}

/**
 * @param {import('mssql').Transaction} transaction
 * @param {{
 *   ventasEmpresa: { idVenta: number, idEmpresa: string, idCliente: number, codigoComprobante: string, compVenta?: string, total: number, idSucursal?: string|null }[],
 *   detallePago: { idMediosPago?: number, monto: number }[],
 *   cuotasCredito?: { monto: number, fechaVencimiento: string }[],
 *   userSub: string,
 *   fVencimientoCabecera?: string|Date|null
 * }} opts
 */
exports.crearCreditosDesdeVentaAgrupada = async (transaction, opts) => {
  const { ventasEmpresa, detallePago, cuotasCredito, userSub, fVencimientoCabecera } = opts;
  if (!ventasEmpresa || ventasEmpresa.length === 0) return;
  if (!detallePago || detallePago.length === 0) return;

  const detalleNormalizado = await normalizarDetallePagoIdMediosPago(transaction, detallePago);

  const idsCredito = await idsMediosPagoCredito(transaction);
  if (idsCredito.size === 0) return;

  const totalCredit = sumaCreditoEnDetalle(detalleNormalizado, idsCredito);
  if (totalCredit <= 0.02) return;

  const lineasReparto = ventasEmpresa.map((v) => ({
    idVenta: v.idVenta,
    idEmpresa: v.idEmpresa,
    compVenta: v.compVenta,
    total: v.total,
    idSucursal: v.idSucursal,
  }));

  const reparto = repartirDetallePagoEntreComprobantes(lineasReparto, detalleNormalizado);

  const fvDefault =
    getFechaSoloSQLString(fVencimientoCabecera) || getFechaHoyLocal();

  for (const linea of reparto) {
    const creditMonto = sumaCreditoEnDetalle(linea.detallePago, idsCredito);
    if (creditMonto <= 0.02) continue;

    const meta = ventasEmpresa.find(
      (v) =>
        v.idVenta === linea.idVenta &&
        String(v.idEmpresa).toLowerCase() === String(linea.idEmpresa).toLowerCase()
    );
    if (!meta || meta.idCliente == null) continue;

    const codigo = String(meta.codigoComprobante || "").trim().toUpperCase();
    let cuotasLinea;

    if (codigo === "01" || codigo === "03") {
      if (!cuotasCredito || !Array.isArray(cuotasCredito) || cuotasCredito.length === 0) {
        throw new Error(
          "Las ventas con factura o boleta a crédito requieren un plan de cuotas (montos y fechas)."
        );
      }
      const sumPlan = round2(cuotasCredito.reduce((s, c) => s + (Number(c.monto) || 0), 0));
      if (Math.abs(sumPlan - totalCredit) > 0.05) {
        throw new Error(
          `La suma de cuotas (${sumPlan}) debe coincidir con el total al crédito (${totalCredit}).`
        );
      }
      const factor = creditMonto / totalCredit;
      cuotasLinea = cuotasCredito.map((c, idx) => {
        const m = round2((Number(c.monto) || 0) * factor);
        const fv = (c.fechaVencimiento || "").toString().trim().slice(0, 10);
        return {
          numeroCuota: idx + 1,
          monto: m,
          fechaVencimiento: fv || fvDefault,
        };
      });
      const sumL = round2(cuotasLinea.reduce((s, c) => s + c.monto, 0));
      const adj = round2(creditMonto - sumL);
      if (cuotasLinea.length && Math.abs(adj) > 0.001) {
        cuotasLinea[cuotasLinea.length - 1].monto = round2(cuotasLinea[cuotasLinea.length - 1].monto + adj);
      }
    } else {
      cuotasLinea = [{ numeroCuota: 1, monto: creditMonto, fechaVencimiento: fvDefault }];
    }

    await creditosRepository.crearCreditoYCuotasExplicitasEnTransaccion(transaction, {
      idEmpresa: linea.idEmpresa,
      idCliente: meta.idCliente,
      idVenta: linea.idVenta,
      idUsuarioCredito: userSub,
      montoTotal: creditMonto,
      cuotas: cuotasLinea,
      fechaCredito: meta.fEmision,
      observaciones: `Crédito venta ${linea.compVenta || linea.idVenta}`,
    });
  }
};

exports.idsMediosPagoCredito = idsMediosPagoCredito;
exports.sumaCreditoEnDetalle = sumaCreditoEnDetalle;
