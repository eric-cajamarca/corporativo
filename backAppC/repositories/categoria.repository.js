const sql = require('mssql');

async function listarPorEmpresa(pool, idEmpresa) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT * FROM Categorias WHERE idEmpresa = @idEmpresa');
  return result.recordset;
}

async function obtenerPorId(pool, idEmpresa, idCategoria) {
  const result = await pool
    .request()
    .input('idCategoria', sql.Int, idCategoria)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT * FROM Categorias WHERE idCategoria = @idCategoria AND idEmpresa = @idEmpresa');
  return result.recordset;
}

async function insertar(pool, idEmpresa, { nombre, descripcion, estado }) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('nombre', sql.VarChar(200), nombre)
    .input('descripcion', sql.VarChar(200), descripcion)
    .input('estado', sql.Bit, estado)
    .query(
      'INSERT INTO Categorias (idEmpresa,nombre,descripcion,estado) VALUES (@idEmpresa,@nombre,@descripcion,@estado)'
    );
  return result.rowsAffected;
}

async function actualizar(pool, idEmpresa, idCategoria, { nombre, descripcion }) {
  const result = await pool
    .request()
    .input('idCategoria', sql.Int, idCategoria)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('nombre', sql.VarChar(200), nombre)
    .input('descripcion', sql.VarChar(200), descripcion)
    .query(
      'UPDATE Categorias SET nombre=@nombre, descripcion = @descripcion WHERE idCategoria = @idCategoria AND idEmpresa = @idEmpresa'
    );
  return result.rowsAffected;
}

async function actualizarEstado(pool, idEmpresa, idCategoria, estado) {
  const result = await pool
    .request()
    .input('idCategoria', sql.Int, idCategoria)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('estado', sql.Bit, estado)
    .query(
      'UPDATE Categorias SET estado=@estado WHERE idCategoria = @idCategoria AND idEmpresa = @idEmpresa'
    );
  return result.rowsAffected;
}

async function eliminar(pool, idEmpresa, idCategoria) {
  const result = await pool
    .request()
    .input('idCategoria', sql.Int, idCategoria)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('DELETE FROM Categorias WHERE idCategoria = @idCategoria AND idEmpresa = @idEmpresa');
  return result.rowsAffected;
}

module.exports = {
  listarPorEmpresa,
  obtenerPorId,
  insertar,
  actualizar,
  actualizarEstado,
  eliminar
};
