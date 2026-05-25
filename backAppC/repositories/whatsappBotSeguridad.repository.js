const sql = require('mssql');
const { SQL_CELULAR_NORM } = require('../utils/telefonoWhatsApp.util');

function bindCelularVariantes(req, variantes, prefix = 'cel') {
  const vars = (variantes || []).filter(Boolean);
  const conds = vars.map((v, i) => {
    const p = `${prefix}${i}`;
    req.input(p, sql.VarChar(20), v);
    return `${SQL_CELULAR_NORM} LIKE '%' + @${p}`;
  });
  return { conds, vars };
}

async function contarCotizacionesHoyPorCelular(pool, idEmpresa, variantesCelular) {
  const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  const { conds } = bindCelularVariantes(req, variantesCelular);
  if (!conds.length) return 0;
  const r = await req.query(`
    SELECT COUNT(1) AS total
    FROM Cotizaciones c
    INNER JOIN Clientes cl ON cl.idCliente = c.idCliente AND cl.idEmpresa = c.idEmpresa
    WHERE c.idEmpresa = @idEmpresa
      AND CONVERT(date, c.fEmision) = CONVERT(date, GETDATE())
      AND (${conds.join(' OR ')})
  `);
  return Number(r.recordset?.[0]?.total || 0);
}

async function contarCotizacionesHoyPorCliente(pool, idEmpresa, idCliente) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, idCliente)
    .query(`
      SELECT COUNT(1) AS total
      FROM Cotizaciones
      WHERE idEmpresa = @idEmpresa AND idCliente = @idCliente
        AND CONVERT(date, fEmision) = CONVERT(date, GETDATE())
    `);
  return Number(r.recordset?.[0]?.total || 0);
}

module.exports = {
  contarCotizacionesHoyPorCelular,
  contarCotizacionesHoyPorCliente
};
