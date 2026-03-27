// repositories/empresa.repository.js
const sql = require('mssql');

exports.obtenerRazonSocial = async (pool, userData) => {
  const empresaResult = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, userData.empresa)
    .query('SELECT razon_Social FROM Empresas WHERE idEmpresa = @idEmpresa');
  
  return empresaResult.recordset.length > 0 ? empresaResult.recordset[0] : null;
};

exports.obtenerBasicaPorId = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT idEmpresa, razon_Social, correo, estado, celular, ruc, adminRequiere2FA
      FROM Empresas
      WHERE idEmpresa = @idEmpresa
    `);
  return result.recordset.length > 0 ? result.recordset[0] : null;
};

exports.buscarPorRuc = async (pool, ruc) => {
  const result = await pool
    .request()
    .input('ruc', sql.VarChar(20), ruc)
    .input('estado', sql.Bit, 1)
    .query(`
      SELECT idEmpresa, razon_Social, correo, password, celular, adminRequiere2FA
      FROM Empresas
      WHERE ruc = @ruc AND estado = @estado
    `);

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

exports.obtenerTotpEmpresa = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT totpSecret, totpEnabled
      FROM Empresas
      WHERE idEmpresa = @idEmpresa
    `);
  return result.recordset.length > 0 ? result.recordset[0] : null;
};

exports.actualizarTotpEmpresa = async (pool, idEmpresa, totpSecret, totpEnabled) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('totpSecret', sql.NVarChar(128), totpSecret)
    .input('totpEnabled', sql.Bit, totpEnabled ? 1 : 0)
    .query(`
      UPDATE Empresas
      SET totpSecret = @totpSecret, totpEnabled = @totpEnabled
      WHERE idEmpresa = @idEmpresa
    `);
  return result.rowsAffected[0];
};

/** Limpia TOTP en fila Empresas (login sintético admin/correo empresa). */
exports.actualizarAdminRequiere2FA = async (pool, idEmpresa, adminRequiere2FA) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('adminRequiere2FA', sql.Bit, adminRequiere2FA ? 1 : 0)
    .query(`
      UPDATE Empresas
      SET adminRequiere2FA = @adminRequiere2FA
      WHERE idEmpresa = @idEmpresa
    `);
  return result.rowsAffected[0];
};

exports.limpiarTotpEmpresaPorId = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      UPDATE Empresas
      SET totpSecret = NULL, totpEnabled = 0
      WHERE idEmpresa = @idEmpresa
    `);
  return result.rowsAffected[0];
};