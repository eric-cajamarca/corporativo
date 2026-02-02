const sql = require('mssql');

/**
 * Obtiene la configuración global de Factiliza (primera fila activa)
 */
async function getConfig(pool) {
  const result = await pool.request().query(`
    SELECT TOP 1 idFactilizaConfig, nombre, urlApi, tokenDefault, estado
    FROM FactilizaConfig
    WHERE estado = 1
  `);
  return result.recordset.length > 0 ? result.recordset[0] : null;
}

/**
 * Obtiene el acceso Factiliza de una empresa (token, usuario SOL, etc.)
 */
async function getEmpresaFactiliza(pool, idEmpresa) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT idEmpresaFactiliza, idEmpresa, puedeUsar, tokenFactiliza, usuarioSol, passwordSol, rucEmpresa, activo
      FROM EmpresaFactiliza
      WHERE idEmpresa = @idEmpresa AND activo = 1
    `);
  return result.recordset.length > 0 ? result.recordset[0] : null;
}

/**
 * Obtiene token a usar para una empresa: primero el de la empresa, si no el token por defecto de config
 */
async function getTokenParaEmpresa(pool, idEmpresa) {
  const config = await getConfig(pool);
  const empresaFactiliza = await getEmpresaFactiliza(pool, idEmpresa);
  if (!empresaFactiliza || !empresaFactiliza.puedeUsar) return { token: null, puedeUsar: false };
  const token = empresaFactiliza.tokenFactiliza || (config && config.tokenDefault) || null;
  return {
    token,
    puedeUsar: true,
    urlApi: config ? config.urlApi : 'https://api.factiliza.com/v1/sunat/xml',
    usuarioSol: empresaFactiliza.usuarioSol,
    passwordSol: empresaFactiliza.passwordSol,
    rucEmpresa: empresaFactiliza.rucEmpresa
  };
}

module.exports = {
  getConfig,
  getEmpresaFactiliza,
  getTokenParaEmpresa
};
