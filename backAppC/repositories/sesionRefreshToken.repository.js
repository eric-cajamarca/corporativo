const sql = require('mssql');

exports.insertar = async (pool, row) => {
  const {
    idRefresh,
    idUsuario,
    idEmpresa,
    tokenHash,
    expira,
    ipCrear = null,
    userAgentCrear = null
  } = row;

  await pool
    .request()
    .input('idRefresh', sql.UniqueIdentifier, idRefresh)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('tokenHash', sql.Char(64), tokenHash)
    .input('expira', sql.DateTime2, expira)
    .input('ipCrear', sql.VarChar(45), ipCrear)
    .input('userAgentCrear', sql.NVarChar(400), userAgentCrear)
    .query(`
      INSERT INTO SesionRefreshToken (idRefresh, idUsuario, idEmpresa, tokenHash, expira, ipCrear, userAgentCrear)
      VALUES (@idRefresh, @idUsuario, @idEmpresa, @tokenHash, @expira, @ipCrear, @userAgentCrear)
    `);
};

exports.buscarActivoPorHash = async (pool, tokenHash) => {
  const r = await pool
    .request()
    .input('tokenHash', sql.Char(64), tokenHash)
    .query(`
      SELECT idRefresh, idUsuario, idEmpresa, expira
      FROM SesionRefreshToken
      WHERE tokenHash = @tokenHash AND revocado = 0 AND expira > GETDATE()
    `);
  return r.recordset.length ? r.recordset[0] : null;
};

/** Fila revocada con ese hash (reuso de refresh ya rotado = posible replay). */
exports.buscarRevocadoPorHash = async (pool, tokenHash) => {
  const r = await pool
    .request()
    .input('tokenHash', sql.Char(64), tokenHash)
    .query(`
      SELECT TOP 1 idRefresh, idUsuario, idEmpresa
      FROM SesionRefreshToken
      WHERE tokenHash = @tokenHash AND revocado = 1
      ORDER BY creado DESC
    `);
  return r.recordset.length ? r.recordset[0] : null;
};

exports.listarActivosPorUsuarioEmpresa = async (pool, idUsuario, idEmpresa) => {
  const r = await pool
    .request()
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        idRefresh,
        tokenHash,
        CONVERT(VARCHAR(19), expira, 120) AS expira,
        CONVERT(VARCHAR(19), creado, 120) AS creado,
        ipCrear,
        userAgentCrear
      FROM SesionRefreshToken
      WHERE idUsuario = @idUsuario AND idEmpresa = @idEmpresa
        AND revocado = 0 AND expira > GETDATE()
      ORDER BY creado DESC
    `);
  return r.recordset;
};

exports.obtenerActivoPorIdRefreshUsuario = async (pool, idRefresh, idUsuario, idEmpresa) => {
  const r = await pool
    .request()
    .input('idRefresh', sql.UniqueIdentifier, idRefresh)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT idRefresh, tokenHash
      FROM SesionRefreshToken
      WHERE idRefresh = @idRefresh AND idUsuario = @idUsuario AND idEmpresa = @idEmpresa
        AND revocado = 0 AND expira > GETDATE()
    `);
  return r.recordset.length ? r.recordset[0] : null;
};

exports.revocarPorIdRefreshSiPertenece = async (pool, idRefresh, idUsuario, idEmpresa) => {
  const r = await pool
    .request()
    .input('idRefresh', sql.UniqueIdentifier, idRefresh)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      UPDATE SesionRefreshToken SET revocado = 1
      WHERE idRefresh = @idRefresh AND idUsuario = @idUsuario AND idEmpresa = @idEmpresa AND revocado = 0
    `);
  return r.rowsAffected[0] || 0;
};

/** Revoca todas las sesiones activas del usuario en la empresa excepto la del hash indicado. */
exports.revocarActivosExceptoHash = async (pool, idUsuario, idEmpresa, tokenHashMantener) => {
  await pool
    .request()
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('tokenHash', sql.Char(64), tokenHashMantener)
    .query(`
      UPDATE SesionRefreshToken SET revocado = 1
      WHERE idUsuario = @idUsuario AND idEmpresa = @idEmpresa AND revocado = 0 AND expira > GETDATE()
        AND tokenHash <> @tokenHash
    `);
};

exports.marcarRevocado = async (pool, idRefresh) => {
  await pool
    .request()
    .input('idRefresh', sql.UniqueIdentifier, idRefresh)
    .query(`UPDATE SesionRefreshToken SET revocado = 1 WHERE idRefresh = @idRefresh`);
};

exports.revocarTodosUsuarioEmpresa = async (pool, idUsuario, idEmpresa) => {
  await pool
    .request()
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      UPDATE SesionRefreshToken SET revocado = 1
      WHERE idUsuario = @idUsuario AND idEmpresa = @idEmpresa AND revocado = 0
    `);
};

/** Tras cambio de contraseña de acceso de empresa: invalida todas las sesiones (todos los usuarios de esa empresa). */
exports.revocarTodosPorEmpresa = async (pool, idEmpresa) => {
  await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      UPDATE SesionRefreshToken SET revocado = 1
      WHERE idEmpresa = @idEmpresa AND revocado = 0
    `);
};
