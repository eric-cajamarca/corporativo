const sql = require('mssql');

async function contarUsuariosActivos(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) AS total
      FROM dbo.UsuarioWeb
      WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1
    `);
  return Number(r.recordset[0]?.total || 0);
}

async function contarSucursales(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) AS total
      FROM dbo.Sucursal
      WHERE idEmpresa = @idEmpresa
    `);
  return Number(r.recordset[0]?.total || 0);
}

async function contarUso(pool, idEmpresa) {
  const [usuariosActivos, sucursales] = await Promise.all([
    contarUsuariosActivos(pool, idEmpresa),
    contarSucursales(pool, idEmpresa)
  ]);
  return { usuariosActivos, sucursales };
}

module.exports = {
  contarUsuariosActivos,
  contarSucursales,
  contarUso
};
