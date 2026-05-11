const sql = require('mssql');

async function listarPorEmpresa(pool, idEmpresa) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT * FROM Marcas WHERE idEmpresa = @idEmpresa');
  return result.recordset;
}

async function obtenerPorId(pool, idEmpresa, idMarca) {
  const result = await pool
    .request()
    .input('idMarca', sql.Int, idMarca)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT * FROM Marcas WHERE idMarca = @idMarca AND idEmpresa = @idEmpresa');
  return result.recordset;
}

async function insertar(pool, idEmpresa, payload) {
  const { nombre, descripcion, contacto, paginaWeb } = payload;
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('nombre', sql.VarChar(50), nombre)
    .input('descripcion', sql.VarChar(200), descripcion ?? '')
    .input('contacto', sql.VarChar(100), contacto ?? '')
    .input('paginaWeb', sql.VarChar(100), paginaWeb ?? '')
    .query(`
      INSERT INTO Marcas (idEmpresa, nombre, descripcion, contacto, paginaWeb, estado)
      OUTPUT INSERTED.idMarca AS idMarca
      VALUES (@idEmpresa, @nombre, @descripcion, @contacto, @paginaWeb, 1)
    `);
  return result.recordset?.[0] || null;
}

async function actualizar(pool, idEmpresa, idMarca, payload) {
  const { nombre, descripcion, contacto, paginaWeb } = payload;
  const result = await pool
    .request()
    .input('idMarca', sql.Int, idMarca)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('nombre', sql.VarChar(50), nombre)
    .input('descripcion', sql.VarChar(200), descripcion ?? '')
    .input('contacto', sql.VarChar(100), contacto ?? '')
    .input('paginaWeb', sql.VarChar(100), paginaWeb ?? '')
    .query(
      'UPDATE Marcas SET nombre = @nombre, descripcion = @descripcion, contacto = @contacto, paginaWeb = @paginaWeb WHERE idMarca = @idMarca AND idEmpresa = @idEmpresa'
    );
  return result.rowsAffected;
}

async function actualizarEstado(pool, idEmpresa, idMarca, estado) {
  const result = await pool
    .request()
    .input('idMarca', sql.Int, idMarca)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('estado', sql.Bit, estado)
    .query('UPDATE Marcas SET estado = @estado WHERE idMarca = @idMarca AND idEmpresa = @idEmpresa');
  return result.rowsAffected;
}

module.exports = {
  listarPorEmpresa,
  obtenerPorId,
  insertar,
  actualizar,
  actualizarEstado
};
