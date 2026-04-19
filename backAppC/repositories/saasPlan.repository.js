const sql = require('mssql');

function esTablaInexistente(err) {
  return err && (err.code === 'EREQUEST' || err.number === 208);
}

async function listarCatalogoPublico(pool) {
  try {
  const r = await pool.request().query(`
    SELECT
      planCode,
      nombre,
      descripcionCorta,
      beneficiosJson,
      precioMensualPen,
      precioAnualPen,
      maxUsuarios,
      maxSucursales,
      orden
    FROM dbo.SaasPlan
    WHERE activo = 1 AND visibleEnCatalogoPublico = 1
    ORDER BY orden ASC, planCode ASC
  `);
  return r.recordset || [];
  } catch (err) {
    if (esTablaInexistente(err)) return [];
    console.error('contexto: saasPlan.repository listarCatalogoPublico', err);
    throw err;
  }
}

async function obtenerPorPlanCode(pool, planCode) {
  const code = (planCode || '').toString().trim().toLowerCase();
  if (!code) return null;
  try {
  const r = await pool
    .request()
    .input('planCode', sql.VarChar(30), code)
    .query(`
      SELECT TOP 1
        planCode,
        nombre,
        descripcionCorta,
        beneficiosJson,
        precioMensualPen,
        precioAnualPen,
        maxUsuarios,
        maxSucursales,
        activo,
        visibleEnCatalogoPublico,
        orden
      FROM dbo.SaasPlan
      WHERE planCode = @planCode AND activo = 1
    `);
  return r.recordset[0] || null;
  } catch (err) {
    if (esTablaInexistente(err)) return null;
    console.error('contexto: saasPlan.repository obtenerPorPlanCode', err);
    throw err;
  }
}

module.exports = {
  listarCatalogoPublico,
  obtenerPorPlanCode
};
