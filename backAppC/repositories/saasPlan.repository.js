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
      ISNULL(maxComprobantesSunatAceptados, 0) AS maxComprobantesSunatAceptados,
      ISNULL(maxProductosActivos, 0) AS maxProductosActivos,
      ISNULL(maxBotConversacionesSimultaneas, 0) AS maxBotConversacionesSimultaneas,
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
        ISNULL(maxComprobantesSunatAceptados, 0) AS maxComprobantesSunatAceptados,
        ISNULL(maxProductosActivos, 0) AS maxProductosActivos,
        ISNULL(maxBotConversacionesSimultaneas, 0) AS maxBotConversacionesSimultaneas,
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

/**
 * Solo filas del catálogo público (tarjetas /planes). Devuelve filas afectadas (0 = plan no editable en BD).
 */
async function actualizarCatalogoEditable(pool, planCode, patch) {
  const code = (planCode || '').toString().trim().toLowerCase();
  if (!code) return 0;
  try {
    const r = await pool
      .request()
      .input('planCode', sql.VarChar(30), code)
      .input('descripcionCorta', sql.NVarChar(300), patch.descripcionCorta)
      .input('precioMensualPen', sql.Decimal(18, 2), patch.precioMensualPen)
      .input('precioAnualPen', sql.Decimal(18, 2), patch.precioAnualPen)
      .input('maxUsuarios', sql.Int, patch.maxUsuarios)
      .input('maxSucursales', sql.Int, patch.maxSucursales)
      .query(`
        UPDATE dbo.SaasPlan
        SET
          descripcionCorta = @descripcionCorta,
          precioMensualPen = @precioMensualPen,
          precioAnualPen = @precioAnualPen,
          maxUsuarios = @maxUsuarios,
          maxSucursales = @maxSucursales
        WHERE planCode = @planCode
          AND activo = 1
          AND visibleEnCatalogoPublico = 1
      `);
    return r.rowsAffected[0] || 0;
  } catch (err) {
    if (esTablaInexistente(err)) return 0;
    console.error('contexto: saasPlan.repository actualizarCatalogoEditable', err);
    throw err;
  }
}

module.exports = {
  listarCatalogoPublico,
  obtenerPorPlanCode,
  actualizarCatalogoEditable
};
