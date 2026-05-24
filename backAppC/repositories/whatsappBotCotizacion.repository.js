const sql = require('mssql');

async function obtenerComprobanteCotizacion(pool, idEmpresa) {
  const r = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1 idComprobante, ISNULL(serie, '0000') AS serie
      FROM Comprobantes
      WHERE idEmpresa = @idEmpresa AND UPPER(LTRIM(RTRIM(ISNULL(codigo, '')))) = 'CT'
      ORDER BY idComprobante
    `);
  return r.recordset[0] || null;
}

async function obtenerUsuarioBot(pool, idEmpresa) {
  const r = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1 idUsuario
      FROM UsuarioWeb
      WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1
      ORDER BY idUsuario
    `);
  return r.recordset[0]?.idUsuario || null;
}

module.exports = { obtenerComprobanteCotizacion, obtenerUsuarioBot };
