const sql = require('mssql');

/**
 * @param {object} params
 * @param {string} params.tipo - LOGIN_OK, LOGIN_FAIL, LOGOUT, REFRESH_TOKEN, etc.
 */
exports.insertar = async (pool, params) => {
  const {
    idEmpresa = null,
    idUsuario = null,
    tipo,
    detalle = null,
    ipCliente = null,
    userAgent = null
  } = params;

  await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('tipo', sql.VarChar(40), tipo)
    .input('detalle', sql.NVarChar(500), detalle ? String(detalle).slice(0, 500) : null)
    .input('ipCliente', sql.VarChar(45), ipCliente ? String(ipCliente).slice(0, 45) : null)
    .input('userAgent', sql.NVarChar(500), userAgent ? String(userAgent).slice(0, 500) : null)
    .query(`
      INSERT INTO SeguridadAuditoria (idEmpresa, idUsuario, tipo, detalle, ipCliente, userAgent)
      VALUES (@idEmpresa, @idUsuario, @tipo, @detalle, @ipCliente, @userAgent)
    `);
};
