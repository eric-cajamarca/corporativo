const sql = require('mssql');

/**
 * Cuota de comprobante de compra SUNAT (crédito proveedor).
 * @param {import('mssql').ConnectionPool|import('mssql').Transaction} executor
 */
exports.insertar = async (executor, row) => {
  const saldo = row.saldoPendiente != null ? row.saldoPendiente : row.montoCuota;
  const req = executor.request()
    .input('idCuota', sql.UniqueIdentifier, row.idCuota)
    .input('idComprobanteCompraSunat', sql.UniqueIdentifier, row.idComprobanteCompraSunat)
    .input('numeroCuota', sql.Int, row.numeroCuota)
    .input('fechaVencimiento', sql.VarChar(10), row.fechaVencimiento)
    .input('montoCuota', sql.Decimal(18, 6), row.montoCuota)
    .input('saldoPendiente', sql.Decimal(18, 6), saldo);

  await req.query(`
    INSERT INTO dbo.CuotasCompraSunat (
      idCuota, idComprobanteCompraSunat, numeroCuota, fechaVencimiento, montoCuota, saldoPendiente
    ) VALUES (
      @idCuota, @idComprobanteCompraSunat, @numeroCuota, CAST(@fechaVencimiento AS DATE), @montoCuota, @saldoPendiente
    )
  `);
};
