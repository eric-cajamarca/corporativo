// repositories/usuario.repository.js
const sql = require('mssql');

exports.obtenerUsuariosAdmin = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input('empresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT * FROM UsuarioWeb UW INNER JOIN Rol R ON UW.idRol = R.idRol WHERE UW.idEmpresa = @empresa');
  
  return result.recordset;
};

exports.buscarPorEmail = async (pool, email, idEmpresa) => {
  const result = await pool
    .request()
    .input('email', sql.VarChar(100), email)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT idUsuario, contraseña, idRol, nombres, apellidos FROM UsuarioWeb WHERE email = @email and idEmpresa = @idEmpresa');
  
  return result.recordset.length > 0 ? result.recordset[0] : null;
};

exports.buscarPorEmailYRuc = async (pool, email, idEmpresa) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('email', sql.VarChar, email)
    .query(`
      SELECT 
        UW.*, 
        R.descripcion as rol
      FROM usuarioWeb UW
      INNER JOIN Rol R ON UW.idRol = R.idRol
      WHERE UW.email = @email AND UW.idEmpresa = @idEmpresa
    `);
  
  return result.recordset.length > 0 ? result.recordset[0] : null;
};