const sql = require('mssql');

/**
 * Obtiene utilidades agrupadas por período (día, mes, año o rango).
 * Utiliza Ventas.total como ingresos y DetalleVenta.costoTotal para costos.
 * @param {object} pool - Pool de conexión
 * @param {string} idEmpresa - UUID de la empresa (del token)
 * @param {string} tipo - 'dia' | 'mes' | 'anio' | 'rango'
 * @param {string} fechaInicio - YYYY-MM-DD
 * @param {string} fechaFin - YYYY-MM-DD
 */
async function obtenerUtilidades(pool, idEmpresa, tipo, fechaInicio, fechaFin) {
  const req = pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fechaInicio', sql.Date, fechaInicio)
    .input('fechaFin', sql.Date, fechaFin);

  if (tipo === 'rango') {
    const rs = await req.query(`
      SELECT
        ISNULL(SUM(v.total), 0) AS ingresos,
        ISNULL(SUM(dv.costoTotal), 0) AS costos,
        ISNULL(SUM(v.total), 0) - ISNULL(SUM(dv.costoTotal), 0) AS utilidadBruta
      FROM Ventas v
      LEFT JOIN DetalleVenta dv ON dv.idVenta = v.idVenta
      WHERE v.idEmpresa = @idEmpresa
        AND CONVERT(DATE, v.fEmision) >= @fechaInicio
        AND CONVERT(DATE, v.fEmision) <= @fechaFin
    `);
    const r = (rs.recordset && rs.recordset[0]) ? rs.recordset[0] : {};
    return [{
      periodo: `Rango ${fechaInicio} a ${fechaFin}`,
      ingresos: Number(r.ingresos || 0),
      costos: Number(r.costos || 0),
      utilidadBruta: Number((r.utilidadBruta != null ? r.utilidadBruta : (r.ingresos || 0) - (r.costos || 0))),
    }];
  }

  if (tipo === 'dia') {
    const rs = await req.query(`
      SELECT
        CONVERT(DATE, v.fEmision) AS fecha,
        ISNULL(SUM(v.total), 0) AS ingresos,
        ISNULL(SUM(dv.costoTotal), 0) AS costos,
        ISNULL(SUM(v.total), 0) - ISNULL(SUM(dv.costoTotal), 0) AS utilidadBruta
      FROM Ventas v
      LEFT JOIN DetalleVenta dv ON dv.idVenta = v.idVenta
      WHERE v.idEmpresa = @idEmpresa
        AND CONVERT(DATE, v.fEmision) >= @fechaInicio
        AND CONVERT(DATE, v.fEmision) <= @fechaFin
      GROUP BY CONVERT(DATE, v.fEmision)
      ORDER BY CONVERT(DATE, v.fEmision)
    `);
    return (rs.recordset || []).map((r) => ({
      periodo: r.fecha ? formatFecha(r.fecha) : '',
      ingresos: Number(r.ingresos || 0),
      costos: Number(r.costos || 0),
      utilidadBruta: Number(r.utilidadBruta != null ? r.utilidadBruta : (r.ingresos || 0) - (r.costos || 0)),
    }));
  }

  if (tipo === 'mes') {
    const rs = await req.query(`
      SELECT
        CONCAT(YEAR(v.fEmision), '-', RIGHT('0' + CAST(MONTH(v.fEmision) AS VARCHAR(2)), 2)) AS periodo,
        ISNULL(SUM(v.total), 0) AS ingresos,
        ISNULL(SUM(dv.costoTotal), 0) AS costos,
        ISNULL(SUM(v.total), 0) - ISNULL(SUM(dv.costoTotal), 0) AS utilidadBruta
      FROM Ventas v
      LEFT JOIN DetalleVenta dv ON dv.idVenta = v.idVenta
      WHERE v.idEmpresa = @idEmpresa
        AND CONVERT(DATE, v.fEmision) >= @fechaInicio
        AND CONVERT(DATE, v.fEmision) <= @fechaFin
      GROUP BY YEAR(v.fEmision), MONTH(v.fEmision)
      ORDER BY YEAR(v.fEmision), MONTH(v.fEmision)
    `);
    return (rs.recordset || []).map((r) => ({
      periodo: String(r.periodo || ''),
      ingresos: Number(r.ingresos || 0),
      costos: Number(r.costos || 0),
      utilidadBruta: Number(r.utilidadBruta != null ? r.utilidadBruta : (r.ingresos || 0) - (r.costos || 0)),
    }));
  }

  if (tipo === 'anio') {
    const rs = await req.query(`
      SELECT
        CAST(YEAR(v.fEmision) AS VARCHAR(4)) AS periodo,
        ISNULL(SUM(v.total), 0) AS ingresos,
        ISNULL(SUM(dv.costoTotal), 0) AS costos,
        ISNULL(SUM(v.total), 0) - ISNULL(SUM(dv.costoTotal), 0) AS utilidadBruta
      FROM Ventas v
      LEFT JOIN DetalleVenta dv ON dv.idVenta = v.idVenta
      WHERE v.idEmpresa = @idEmpresa
        AND CONVERT(DATE, v.fEmision) >= @fechaInicio
        AND CONVERT(DATE, v.fEmision) <= @fechaFin
      GROUP BY YEAR(v.fEmision)
      ORDER BY YEAR(v.fEmision)
    `);
    return (rs.recordset || []).map((r) => ({
      periodo: String(r.periodo || ''),
      ingresos: Number(r.ingresos || 0),
      costos: Number(r.costos || 0),
      utilidadBruta: Number(r.utilidadBruta != null ? r.utilidadBruta : (r.ingresos || 0) - (r.costos || 0)),
    }));
  }

  return [];
}

/**
 * Obtiene utilidades a nivel detalle: una fila por línea de DetalleVenta.
 * Incluye idVenta para abrir el comprobante.
 * @param {object} pool
 * @param {string} idEmpresa
 * @param {string} fechaInicio - YYYY-MM-DD
 * @param {string} fechaFin - YYYY-MM-DD
 */
async function obtenerUtilidadesDetalle(pool, idEmpresa, fechaInicio, fechaFin) {
  let rs;
  try {
    rs = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('fechaInicio', sql.Date, fechaInicio)
      .input('fechaFin', sql.Date, fechaFin)
      .query(`
      SELECT
        v.idVenta,
        ISNULL(v.compVenta, ISNULL(v.serie, '') + '-' + ISNULL(CAST(v.numero AS VARCHAR(20)), '')) AS comprobante,
        CONVERT(VARCHAR(19), v.fEmision, 120) AS fechaVenta,
        p.descripcion AS nombreProducto,
        ISNULL(dv.total, dv.subtotal) AS precioVenta,
        ISNULL(dv.costoTotal, 0) AS costo,
        ISNULL(dv.total, dv.subtotal) - ISNULL(dv.costoTotal, 0) AS utilidadBruta
      FROM DetalleVenta dv
      INNER JOIN Ventas v ON dv.idVenta = v.idVenta AND v.idEmpresa = @idEmpresa
      INNER JOIN Productos p ON dv.idProducto = p.idProducto AND p.idEmpresa = @idEmpresa
      WHERE CONVERT(DATE, v.fEmision) >= @fechaInicio
        AND CONVERT(DATE, v.fEmision) <= @fechaFin
      ORDER BY v.fEmision, v.idVenta
    `);
  } catch (repoErr) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '486b2c' }, body: JSON.stringify({ sessionId: '486b2c', location: 'utilidades.repository.js:obtenerUtilidadesDetalle:catch', message: 'repo error', data: { errorMessage: repoErr?.message }, timestamp: Date.now(), hypothesisId: 'H4' }) }).catch(() => {});
    // #endregion
    throw repoErr;
  }
  // #region agent log
  const recordsetLength = (rs.recordset || []).length;
  fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '486b2c' }, body: JSON.stringify({ sessionId: '486b2c', location: 'utilidades.repository.js:obtenerUtilidadesDetalle', message: 'query result', data: { recordsetLength, fechaInicio, fechaFin }, timestamp: Date.now(), hypothesisId: 'H2' }) }).catch(() => {});
  // #endregion
  const rows = (rs.recordset || []).map((r) => ({
    idVenta: r.idVenta,
    comprobante: String(r.comprobante || ''),
    fechaVenta: r.fechaVenta ? formatFecha(r.fechaVenta) : '',
    nombreProducto: String(r.nombreProducto || ''),
    precioVenta: Number(r.precioVenta || 0),
    costo: Number(r.costo || 0),
    utilidadBruta: Number(r.utilidadBruta != null ? r.utilidadBruta : (r.precioVenta || 0) - (r.costo || 0)),
  }));
  return rows;
}

function formatFecha(val) {
  if (!val) return '';
  const d = new Date(val);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = {
  obtenerUtilidades,
  obtenerUtilidadesDetalle,
};
