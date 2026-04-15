const sql = require('mssql');

async function insertar(pool, idEmpresa, payload) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, payload.idCliente)
    .input('ubigeo', sql.VarChar(10), payload.ubigeo ?? '')
    .input('codPais', sql.VarChar(10), payload.codPais ?? '')
    .input('region', sql.VarChar(50), payload.region ?? '')
    .input('provincia', sql.VarChar(50), payload.provincia ?? '')
    .input('distrito', sql.VarChar(50), payload.distrito ?? '')
    .input('urbanizacion', sql.VarChar(100), payload.urbanizacion ?? '')
    .input('direccion', sql.VarChar(255), payload.direccion ?? '')
    .input('referencia', sql.VarChar(200), payload.referencia ?? '')
    .input('codLocal', sql.VarChar(10), payload.codLocal ?? '')
    .input('principal', sql.Bit, payload.principal ? 1 : 0)
    .query(
      `INSERT INTO DireccionClientes (idEmpresa,idCliente,ubigeo,codPais,region,provincia,distrito,urbanizacion,direccion,referencia,codLocal, principal)
       VALUES (@idEmpresa,@idCliente,@ubigeo,@codPais,@region,@provincia,@distrito,@urbanizacion,@direccion,@referencia,@codLocal,@principal)`
    );
  return result.rowsAffected;
}

async function listarPorEmpresa(pool, idEmpresa) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT * FROM DireccionClientes WHERE idEmpresa = @idEmpresa');
  return result.recordset;
}

async function listarPorCliente(pool, idEmpresa, idCliente) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, idCliente)
    .query(`
      SELECT *
      FROM DireccionClientes
      WHERE idEmpresa = @idEmpresa AND idCliente = @idCliente
      ORDER BY CASE WHEN principal = 1 THEN 0 ELSE 1 END, idDireccionClientes ASC
    `);
  return result.recordset;
}

async function actualizar(pool, idEmpresa, idDireccionCliente, payload) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idDireccionCliente', sql.Int, idDireccionCliente)
    .input('idCliente', sql.Int, payload.idCliente)
    .input('ubigeo', sql.VarChar(10), payload.ubigeo ?? '')
    .input('codPais', sql.VarChar(10), payload.codPais ?? '')
    .input('region', sql.VarChar(50), payload.region ?? '')
    .input('provincia', sql.VarChar(50), payload.provincia ?? '')
    .input('distrito', sql.VarChar(50), payload.distrito ?? '')
    .input('urbanizacion', sql.VarChar(100), payload.urbanizacion ?? '')
    .input('direccion', sql.VarChar(255), payload.direccion ?? '')
    .input('referencia', sql.VarChar(200), payload.referencia ?? '')
    .input('codLocal', sql.VarChar(10), payload.codLocal ?? '')
    .input('principal', sql.Bit, payload.principal === true || payload.principal === 1 ? 1 : 0)
    .query(
      `UPDATE DireccionClientes SET idCliente = @idCliente, ubigeo = @ubigeo, codPais = @codPais, region = @region,
       provincia = @provincia, distrito = @distrito, urbanizacion = @urbanizacion, direccion = @direccion,
       referencia = @referencia, codLocal = @codLocal, principal = @principal
       WHERE idDireccionClientes = @idDireccionCliente AND idEmpresa = @idEmpresa`
    );
  return result.recordset;
}

async function eliminar(pool, idEmpresa, idDireccionCliente) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idDireccionCliente', sql.Int, idDireccionCliente)
    .query(
      'DELETE FROM DireccionClientes WHERE idDireccionClientes = @idDireccionCliente AND idEmpresa = @idEmpresa'
    );
  return result.recordset;
}

module.exports = {
  insertar,
  listarPorEmpresa,
  listarPorCliente,
  actualizar,
  eliminar
};
