// repositories/empresa.repository.js
const sql = require('mssql');

exports.obtenerRazonSocial = async (pool, userData) => {
  const empresaResult = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, userData.empresa)
    .query('SELECT razon_Social FROM Empresas WHERE idEmpresa = @idEmpresa');
  
  return empresaResult.recordset.length > 0 ? empresaResult.recordset[0] : null;
};

exports.buscarPorRuc = async (pool, ruc) => {
  const result = await pool
    .request()
    .input('ruc', sql.VarChar(20), ruc)
    .input('estado', sql.Bit, 1)
    .query('SELECT idEmpresa, razon_Social, correo, password FROM Empresas WHERE ruc = @ruc AND estado = @estado');

  return result.recordset.length > 0 ? result.recordset[0] : null;
};

/**
 * Actualiza solo la contraseña de la empresa (para recuperación)
 */
exports.actualizarPassword = async (pool, idEmpresa, passwordHash) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('password', sql.VarChar(255), passwordHash)
    .query('UPDATE Empresas SET password = @password WHERE idEmpresa = @idEmpresa');
  return result.rowsAffected[0];
};