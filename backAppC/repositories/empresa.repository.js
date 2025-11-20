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
    .query('SELECT idEmpresa, razon_Social FROM Empresas WHERE ruc = @ruc');
  
  return result.recordset.length > 0 ? result.recordset[0] : null;
};