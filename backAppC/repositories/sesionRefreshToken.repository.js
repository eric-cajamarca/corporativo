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
