const sql = require('mssql');

async function insertar(pool, row) {
  return pool
    .request()
    .input('idProducto', sql.UniqueIdentifier, row.idProducto)
    .input('cUnitario', sql.Decimal(18, 4), row.cUnitario)
    .input('mayorista', sql.Decimal(18, 4), row.mayorista ?? 0)
    .input('cliente', sql.Decimal(18, 4), row.cliente ?? 0)
    .input('transeunte', sql.Decimal(18, 4), row.transeunte ?? 0)
    .query(
      'INSERT INTO PreciosV (idProducto, cUnitario, mayorista, cliente, transeunte) VALUES (@idProducto, @cUnitario, @mayorista, @cliente, @transeunte)'
    );
}

async function obtenerPorId(pool, idPreciosV) {
  const r = await pool
    .request()
    .input('idPreciosV', sql.Int, idPreciosV)
    .query('SELECT * FROM PreciosV WHERE idPreciosV = @idPreciosV');
  return r.recordset;
}

async function listarTodos(pool) {
  const r = await pool.request().query('SELECT * FROM PreciosV');
  return r.recordset;
}

async function actualizar(pool, row) {
  return pool
    .request()
    .input('idPreciosV', sql.Int, row.idPreciosV)
    .input('idProducto', sql.UniqueIdentifier, row.idProducto)
    .input('cUnitario', sql.Decimal(18, 4), row.cUnitario)
    .input('mayorista', sql.Decimal(18, 4), row.mayorista)
    .input('cliente', sql.Decimal(18, 4), row.cliente)
    .input('transeunte', sql.Decimal(18, 4), row.transeunte)
    .query(
      'UPDATE PreciosV SET idProducto = @idProducto, cUnitario = @cUnitario, mayorista = @mayorista, cliente = @cliente, transeunte = @transeunte WHERE idPreciosV = @idPreciosV'
    );
}

module.exports = {
  insertar,
  obtenerPorId,
  listarTodos,
  actualizar
};
