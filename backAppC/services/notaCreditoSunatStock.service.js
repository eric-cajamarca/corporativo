/**
 * Devolución de inventario cuando una Nota de Crédito (07) queda aceptada por SUNAT
 * y el motivo (catálogo 09) implica retorno físico de mercadería.
 */
const sql = require("mssql");
const stockRepository = require("../repositories/stock.repository");
const inventarioRepository = require("../repositories/inventario.repository");

/** Catálogo SUNAT 09: anulación de operación (01), devolución total (06), devolución por ítem (07). */
const MOTIVOS_DEVUELVEN_STOCK = new Set(["01", "06", "07"]);

function esEstadoAceptadoSunat(id) {
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
 * @param {import('mssql').ConnectionPool|import('mssql').Transaction} ctx - pool o transacción activa
 * @param {string} idComprobanteElectronico
 * @param {number|null|undefined} idEstadoAnterior - idEstadoSunat del CE antes de actualizar
 * @param {number|null|undefined} idEstadoNuevo
 */
exports.aplicarStockPorNotaCreditoSiCorresponde = async (ctx, idComprobanteElectronico, idEstadoAnterior, idEstadoNuevo) => {
  if (!esEstadoAceptadoSunat(idEstadoNuevo)) return;
  if (esEstadoAceptadoSunat(idEstadoAnterior)) return;

  const cabRs = await ctx
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
  if (String(cab.tipoComprobante || "").trim() !== "07") return;

  const motivo = normalizarMotivoNotaCredito(cab.codigoMotivoNotaCredito);
  if (!MOTIVOS_DEVUELVEN_STOCK.has(motivo)) return;

  const detRs = await ctx
    .request()
    .input("idVenta", sql.Int, cab.idVenta)
    .query(`
      SELECT idProducto, cantidad, ISNULL(costoUnitario, 0) AS costoUnitario
      FROM DetalleVenta
      WHERE idVenta = @idVenta
    `);
  const detalles = detRs.recordset || [];

  for (const d of detalles) {
    const cant = parseFloat(d.cantidad) || 0;
    if (cant <= 0 || !d.idProducto) continue;

    await stockRepository.restaurarStockEnLotes(ctx, {
      idEmpresa: cab.idEmpresa,
      idSucursal: cab.idSucursal,
      idProducto: d.idProducto,
      cantidad: cant
    });

    if (cab.idUsuario) {
      await inventarioRepository.insertarFilaMovimiento(ctx, {
        idEmpresa: cab.idEmpresa,
        idSucursal: cab.idSucursal,
        idProducto: d.idProducto,
        tipoMovimiento: "EN",
        cantidad: cant,
        docRelacionado: cab.compVenta,
        idComprobante: cab.idComprobante,
        idUsuario: cab.idUsuario,
        observaciones: "Nota de crédito aceptada SUNAT — devolución de stock",
        costoUnitario: d.costoUnitario != null ? Number(d.costoUnitario) : 0,
        idLote: null
      });
    }
  }
};
