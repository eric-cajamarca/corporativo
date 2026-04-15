const sql = require('mssql');

async function obtenerPorSerieYDestino(pool, serieNumero, destino) {
  const result = await pool
    .request()
    .input('Serie_Numero', sql.VarChar(20), serieNumero)
    .input('aliasempresa', sql.VarChar(50), destino)
    .query(
      'SELECT * FROM Comp_Ventas WHERE Serie_Numero = @Serie_Numero AND destino = @aliasempresa'
    );
  return result.recordset;
}

async function actualizarEstadosTienda01(pool, serieNumero, estado, estadoPedido, estadoSunat) {
  const result = await pool
    .request()
    .input('Serie_Numero', sql.VarChar(20), serieNumero)
    .input('Estado', sql.VarChar(50), estado)
    .input('EstadoPedido', sql.VarChar(50), estadoPedido)
    .input('EstadoSunat', sql.VarChar(50), estadoSunat)
    .query(
      `UPDATE Comp_VentasTienda01 SET Estado = @Estado, EstadoPedido = @EstadoPedido, EstadoSunat = @EstadoSunat
       WHERE Serie_Numero = @Serie_Numero`
    );
  return result.rowsAffected;
}

async function eliminarPorId(pool, id) {
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('DELETE FROM Comp_Ventas WHERE id = @id');
  return result.rowsAffected[0];
}

module.exports = {
  obtenerPorSerieYDestino,
  actualizarEstadosTienda01,
  eliminarPorId
};
