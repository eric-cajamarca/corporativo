const sql = require('mssql');

async function listarPorEmpresa(pool, idEmpresa) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT * FROM UndPorCaja WHERE idEmpresa = @idEmpresa');
  return result.recordset;
}

async function actualizar(pool, { idEmpresa, idUndPorCaja, unidxCaja, pesoUnidad, pesoCaja }) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idUndPorCaja', sql.Int, idUndPorCaja)
    .input('unidxCaja', sql.Int, unidxCaja)
    .input('pesoUnidad', sql.Decimal(10, 2), pesoUnidad)
    .input('pesoCaja', sql.Decimal(10, 2), pesoCaja)
    .query(
      'UPDATE UndPorCaja SET unidxCaja = @unidxCaja, pesoUnidad = @pesoUnidad, pesoCaja = @pesoCaja WHERE idUndPorCaja = @idUndPorCaja AND idEmpresa = @idEmpresa'
    );
  return result.recordset;
}

module.exports = {
  listarPorEmpresa,
  actualizar
};
