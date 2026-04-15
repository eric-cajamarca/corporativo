const sql = require('mssql');

/** Catálogo global (tabla Presentacion), mismo comportamiento que el controlador anterior. */
async function listarCatalogo(pool) {
  const result = await pool
    .request()
    .query(
      'SELECT idPresentacion, codigo, Descripcion FROM Presentacion'
    );
  return result.recordset;
}

async function obtenerPorId(pool, idPresentacion) {
  const result = await pool
    .request()
    .input('idPresentacion', sql.Int, idPresentacion)
    .query('SELECT * FROM Presentaciones WHERE idPresentacion = @idPresentacion');
  return result.recordset;
}

async function insertar(pool, { idEmpresa, codigo, descripcion, multiplicador }) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('codigo', sql.VarChar(3), codigo)
    .input('Descripcion', sql.VarChar(50), descripcion)
    .input('Multiplicador', sql.Int, multiplicador)
    .query(
      'INSERT INTO Presentaciones (idEmpresa, codigo, Descripcion, Multiplicador) VALUES (@idEmpresa, @codigo, @Descripcion, @Multiplicador)'
    );
  return result.recordset;
}

async function actualizar(pool, { idPresentacion, codigo, descripcion, multiplicador }) {
  const result = await pool
    .request()
    .input('idPresentacion', sql.Int, idPresentacion)
    .input('codigo', sql.VarChar(3), codigo)
    .input('Descripcion', sql.VarChar(50), descripcion)
    .input('Multiplicador', sql.Int, multiplicador)
    .query(
      'UPDATE Presentaciones SET codigo = @codigo, Descripcion = @Descripcion, Multiplicador = @Multiplicador WHERE idPresentacion = @idPresentacion'
    );
  return result.recordset;
}

async function eliminar(pool, idPresentacion) {
  const result = await pool
    .request()
    .input('idPresentacion', sql.Int, idPresentacion)
    .query('DELETE FROM Presentaciones WHERE idPresentacion = @idPresentacion');
  return result.recordset;
}

module.exports = {
  listarCatalogo,
  obtenerPorId,
  insertar,
  actualizar,
  eliminar
};
