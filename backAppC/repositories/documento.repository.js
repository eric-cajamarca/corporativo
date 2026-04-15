const sql = require('mssql');

async function insertar(pool, { idDocumento, nombre, descripcion }) {
  const result = await pool
    .request()
    .input('idDocumento', sql.VarChar(10), idDocumento)
    .input('nombre', sql.VarChar(20), nombre)
    .input('descripcion', sql.VarChar(200), descripcion)
    .query(
      'INSERT INTO Documentos (idDocumento,nombre,descripcion) VALUES (@idDocumento,@nombre,@descripcion)'
    );
  return result.recordset;
}

async function listarDocumentos(pool) {
  const result = await pool.request().query('SELECT * FROM Documentos');
  return result.recordset;
}

async function actualizar(pool, { idDocumento, nombre, descripcion }) {
  const result = await pool
    .request()
    .input('idDocumento', sql.VarChar(10), idDocumento)
    .input('nombre', sql.VarChar(20), nombre)
    .input('descripcion', sql.VarChar(200), descripcion)
    .query(
      'UPDATE Documentos SET nombre = @nombre, descripcion = @descripcion WHERE idDocumento = @idDocumento'
    );
  return result.recordset;
}

async function eliminar(pool, idDocumento) {
  const result = await pool
    .request()
    .input('idDocumento', sql.VarChar(10), idDocumento)
    .query('DELETE FROM Documentos WHERE idDocumento = @idDocumento');
  return result.recordset;
}

async function listarFormasPago(pool) {
  const result = await pool.request().query('SELECT * FROM formasPago');
  return result.recordset;
}

module.exports = {
  insertar,
  listarDocumentos,
  actualizar,
  eliminar,
  listarFormasPago
};
