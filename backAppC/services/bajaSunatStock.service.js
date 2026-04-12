/**
 * Inventario cuando una comunicación de baja (RA) queda aceptada por SUNAT:
 * - Factura (01): devuelve el stock de la venta (equivalente a anular el comprobante).
 *   Boleta (03) no entra en el flujo RA habitual; si en el futuro se incluye en una baja aceptada, usar el mismo bloque que 01.
 * - Nota de crédito (07): si el motivo implicó devolución física y SUNAT aceptó la NC antes,
 *   al anular la NC se revierte esa entrada (descuento de stock).
 */
const sql = require("mssql");
const stockRepository = require("../repositories/stock.repository");
const inventarioRepository = require("../repositories/inventario.repository");

/** Mismo criterio que notaCreditoSunatStock: catálogo 09 motivos con retorno de mercadería. */
const MOTIVOS_NC_DEVUELVEN_STOCK = new Set(["01", "06", "07"]);

function esEstadoPrevioAceptadoOEnProcesoSunat(id) {
  const n = Number(id);
  return n === 1 || n === 2 || n === 3;
}

/** Nota de crédito: el stock solo se había devuelto si SUNAT aceptó (1 o 3), no en proceso (2). */
function esEstadoPrevioNcConStockYaDevuelto(id) {
  const n = Number(id);
  return n === 1 || n === 3;
}

function normalizarMotivoNotaCredito(val) {
  const s = String(val != null ? val : "01").trim();
  const n = parseInt(s.replace(/\D/g, "") || "1", 10);
  if (!Number.isFinite(n) || n < 1 || n > 13) return "01";
  return String(n).padStart(2, "0");
}

/**
 * @param {import('mssql').Transaction} transaction
 * @param {string} idComprobanteElectronico
 * @param {number|null|undefined} idEstadoAnterior - estado CE antes de pasar a baja aceptada
 * @param {string|null|undefined} idUsuarioEjecutor - usuario logueado (JWT sub) si Ventas.idUsuario viene vacío
 */
exports.aplicarStockPorComunicacionBajaAceptadaSiCorresponde = async (
  transaction,
  idComprobanteElectronico,
  idEstadoAnterior,
  idUsuarioEjecutor = null
) => {
  const cabRs = await transaction
    .request()
    .input("id", sql.UniqueIdentifier, idComprobanteElectronico)
    .query(`
      SELECT ce.idEmpresa, ce.tipoComprobante, v.idVenta, v.idSucursal, v.compVenta,
             v.codigoMotivoNotaCredito, v.idComprobante, v.idUsuario
      FROM ComprobantesElectronicos ce
      INNER JOIN Ventas v ON v.idVenta = ce.idVenta AND v.idEmpresa = ce.idEmpresa
      WHERE ce.idComprobanteElectronico = @id
    `);
  const cab = cabRs.recordset && cabRs.recordset[0];
  if (!cab) return;

  const tipo = String(cab.tipoComprobante || "").trim();

  if (tipo === "07") {
    if (!esEstadoPrevioNcConStockYaDevuelto(idEstadoAnterior)) return;
  } else if (!esEstadoPrevioAceptadoOEnProcesoSunat(idEstadoAnterior)) {
    return;
  }

  const detRs = await transaction
    .request()
    .input("idVenta", sql.Int, cab.idVenta)
    .query(`
      SELECT idProducto, cantidad, ISNULL(costoUnitario, 0) AS costoUnitario
      FROM DetalleVenta
      WHERE idVenta = @idVenta
    `);
  const detalles = detRs.recordset || [];

  if (tipo === "01") {
    for (const d of detalles) {
      const cant = parseFloat(d.cantidad) || 0;
      if (cant <= 0 || !d.idProducto) continue;

      await stockRepository.restaurarStockEnLotes(transaction, {
        idEmpresa: cab.idEmpresa,
        idSucursal: cab.idSucursal,
        idProducto: d.idProducto,
        cantidad: cant
      });

      const idUsuarioMov = cab.idUsuario || idUsuarioEjecutor;
      if (idUsuarioMov) {
        await inventarioRepository.insertarFilaMovimiento(transaction, {
          idEmpresa: cab.idEmpresa,
          idSucursal: cab.idSucursal,
          idProducto: d.idProducto,
          tipoMovimiento: "EN",
          cantidad: cant,
          docRelacionado: cab.compVenta,
          idComprobante: cab.idComprobante,
          idUsuario: idUsuarioMov,
          observaciones: "Baja aceptada SUNAT (RA) — devolución de stock",
          costoUnitario: d.costoUnitario != null ? Number(d.costoUnitario) : 0,
          idLote: null
        });
      }
    }
    return;
  }

  if (tipo === "07") {
    const motivo = normalizarMotivoNotaCredito(cab.codigoMotivoNotaCredito);
    if (!MOTIVOS_NC_DEVUELVEN_STOCK.has(motivo)) return;

    for (const d of detalles) {
      const cant = parseFloat(d.cantidad) || 0;
      if (cant <= 0 || !d.idProducto) continue;

      await stockRepository.descontarDesdeLotes(
        transaction,
        {
          idEmpresa: cab.idEmpresa,
          idSucursal: cab.idSucursal,
          idProducto: d.idProducto,
          cantidad: cant
        },
        { controlUbicaciones: true }
      );

      const idUsuarioMovNc = cab.idUsuario || idUsuarioEjecutor;
      if (idUsuarioMovNc) {
        await inventarioRepository.insertarFilaMovimiento(transaction, {
          idEmpresa: cab.idEmpresa,
          idSucursal: cab.idSucursal,
          idProducto: d.idProducto,
          tipoMovimiento: "SA",
          cantidad: cant,
          docRelacionado: cab.compVenta,
          idComprobante: cab.idComprobante,
          idUsuario: idUsuarioMovNc,
          observaciones: "Baja aceptada SUNAT (RA) — reversión stock por anulación de nota de crédito",
          costoUnitario: d.costoUnitario != null ? Number(d.costoUnitario) : 0,
          idLote: null
        });
      }
    }
  }
};
