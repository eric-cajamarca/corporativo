const sql = require('mssql');

/**
 * Lista códigos de módulo de menú permitidos para un plan (tabla SaasPlanModulo).
 */
async function listarModulosPorPlan(pool, planCode) {
  const pc = (planCode || '').toString().trim().toLowerCase();
  if (!pc) return [];
  try {
    const r = await pool
      .request()
      .input('planCode', sql.VarChar(30), pc)
      .query(`
        SELECT LTRIM(RTRIM(moduloCodigo)) AS moduloCodigo
        FROM dbo.SaasPlanModulo
        WHERE LOWER(LTRIM(RTRIM(planCode))) = @planCode
      `);
    return (r.recordset || []).map((x) => String(x.moduloCodigo || '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * ¿El plan incluye el servicio Factiliza (por nombre exacto en FactilizaConfig)?
 */
async function planPermiteFactilizaServicioNombre(pool, planCode, nombreServicio) {
  const pc = (planCode || '').toString().trim().toLowerCase();
  const nom = (nombreServicio || '').toString().trim();
  if (!pc || !nom) return false;
  if (pc === 'enterprise') return true;

  try {
    const cnt = await pool.request().query(`SELECT COUNT(*) AS c FROM dbo.SaasPlanFactilizaServicio`);
    if (!cnt.recordset?.length || Number(cnt.recordset[0].c) === 0) {
      return true;
    }

    const r = await pool
      .request()
      .input('planCode', sql.VarChar(30), pc)
      .input('nombre', sql.NVarChar(100), nom)
      .query(`
        SELECT 1 AS ok
        FROM dbo.SaasPlanFactilizaServicio p
        INNER JOIN dbo.FactilizaConfig f ON f.idFactilizaConfig = p.idFactilizaConfig AND f.estado = 1
        WHERE LOWER(LTRIM(RTRIM(p.planCode))) = @planCode AND f.nombre = @nombre
      `);
    return (r.recordset || []).length > 0;
  } catch {
    return true;
  }
}

module.exports = {
  listarModulosPorPlan,
  planPermiteFactilizaServicioNombre
};
