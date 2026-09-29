const sql = require('mssql');

async function insertarCabecera(transaction, row) {
  const result = await transaction
    .request()
    .input('idReceta', sql.UniqueIdentifier, row.idReceta)
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('idVenta', sql.Int, row.idVenta)
    .input('tipo', sql.VarChar(20), row.tipo)
    .input('pacienteNombre', sql.VarChar(150), row.pacienteNombre)
    .input('pacienteDoc', sql.VarChar(20), row.pacienteDoc)
    .input('medicoNombre', sql.VarChar(150), row.medicoNombre)
    .input('cmp', sql.VarChar(20), row.cmp)
    .input('numeroReceta', sql.VarChar(40), row.numeroReceta)
    .input('fechaReceta', sql.Date, row.fechaReceta)
    .input('idUsuario', sql.UniqueIdentifier, row.idUsuario || null)
    .query(`
      INSERT INTO RecetaVenta (
        idReceta, idEmpresa, idVenta, tipo, pacienteNombre, pacienteDoc,
        medicoNombre, cmp, numeroReceta, fechaReceta, idUsuario
      )
      VALUES (
        @idReceta, @idEmpresa, @idVenta, @tipo, @pacienteNombre, @pacienteDoc,
        @medicoNombre, @cmp, @numeroReceta, @fechaReceta, @idUsuario
      )
    `);
  return result;
}

async function insertarDetalle(transaction, row) {
  return transaction
    .request()
    .input('idRecetaDetalle', sql.UniqueIdentifier, row.idRecetaDetalle)
    .input('idReceta', sql.UniqueIdentifier, row.idReceta)
    .input('idDetalle', sql.Int, row.idDetalle != null ? Number(row.idDetalle) : null)
    .input('idProducto', sql.UniqueIdentifier, row.idProducto)
    .input('idLote', sql.UniqueIdentifier, row.idLote || null)
    .input('cantidad', sql.Decimal(18, 6), row.cantidad)
    .query(`
      INSERT INTO RecetaVentaDetalle (
        idRecetaDetalle, idReceta, idDetalle, idProducto, idLote, cantidad
      )
      VALUES (
        @idRecetaDetalle, @idReceta, @idDetalle, @idProducto, @idLote, @cantidad
      )
    `);
}

module.exports = {
  insertarCabecera,
  insertarDetalle
};
