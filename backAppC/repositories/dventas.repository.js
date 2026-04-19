const sql = require('mssql');

async function listarDetalleVentaPorEmpresa(pool, idEmpresa) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT dv.* FROM DetalleVenta dv
      INNER JOIN Ventas v ON dv.idVenta = v.idVenta
      WHERE v.idEmpresa = @idEmpresa
    `);
  return result.recordset;
}

async function obtenerDetalleVentasPorCompDestino(pool, idEmpresa, compVentas, destino) {
  const destNum = parseInt(destino, 10);
  if (!idEmpresa || Number.isNaN(destNum)) {
    return [];
  }
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('CompVentas', sql.VarChar(30), String(compVentas).trim())
    .input('Destino', sql.Int, destNum)
    .query(`
      SELECT dv.*
      FROM DetalleVentas dv
      INNER JOIN Ventas v ON v.idEmpresa = @idEmpresa
        AND LTRIM(RTRIM(ISNULL(CAST(v.compVenta AS VARCHAR(40)), ''))) = LTRIM(RTRIM(ISNULL(CAST(dv.CompVentas AS VARCHAR(40)), '')))
      WHERE dv.CompVentas = @CompVentas AND dv.Destino = @Destino
    `);
  return result.recordset;
}

async function obtenerCantEntregado(pool, id) {
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('SELECT CantEntregado FROM DetalleVentas WHERE Id = @id');
  return result.recordset?.[0]?.CantEntregado;
}

async function actualizarCantEntregado(pool, id, cantEntregado) {
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('CantEntregado', sql.Decimal(18, 4), cantEntregado)
    .query('UPDATE DetalleVentas SET CantEntregado = @CantEntregado WHERE Id = @id');
  return result.rowsAffected;
}

async function obtenerFilaDetalleParaEliminar(transaction, idDetalle, idEmpresa) {
  const result = await transaction
    .request()
    .input('idDetalle', sql.Int, idDetalle)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT dv.idDetalle, dv.idVenta, dv.idProducto, dv.cantidad, ISNULL(dv.costoUnitario, 0) AS costoUnitario,
        v.idSucursal, v.idEstadoSunat, v.compVenta, v.idComprobante, v.idUsuario, ISNULL(v.eliminado, 0) AS eliminado,
        UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) AS codigoComprobante
      FROM DetalleVenta dv
      INNER JOIN Ventas v ON dv.idVenta = v.idVenta AND v.idEmpresa = @idEmpresa
      LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
      WHERE dv.idDetalle = @idDetalle
    `);
  return result.recordset?.[0] || null;
}

async function eliminarDetalleVentaPorId(transaction, idDetalle) {
  await transaction
    .request()
    .input('idDetalle', sql.Int, idDetalle)
    .query('DELETE FROM DetalleVenta WHERE idDetalle = @idDetalle');
}

module.exports = {
  listarDetalleVentaPorEmpresa,
  obtenerDetalleVentasPorCompDestino,
  obtenerCantEntregado,
  actualizarCantEntregado,
  obtenerFilaDetalleParaEliminar,
  eliminarDetalleVentaPorId
};
