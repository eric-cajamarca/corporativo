const sql = require('mssql');
const {
  SQL_VENTAS_AJUSTADAS_BASE,
  SQL_COSTO_POR_VENTA
} = require('../utils/kpisFinancierosOperativo.util');

/** Ventas anuladas, rechazadas o con baja SUNAT aceptada no suman en utilidades. */
const FILTRO_VENTA_VALIDA_UTILIDADES = `
  AND ISNULL(v.eliminado, 0) = 0
  AND (v.idEstadoSunat IS NULL OR v.idEstadoSunat NOT IN (4, 8))
`;

function ventaExcluidaDeUtilidades(eliminado, idEstadoSunat) {
  if (eliminado) return true;
  const id = idEstadoSunat != null ? Number(idEstadoSunat) : null;
  return id === 4 || id === 8;
}

function etiquetaEstadoComprobanteUtilidad(eliminado, idEstadoSunat, estadoSunatDesc) {
  if (eliminado) return 'Anulado';
  const id = idEstadoSunat != null ? Number(idEstadoSunat) : null;
  if (id === 4) return 'Rechazado SUNAT';
  if (id === 8) return estadoSunatDesc || 'Baja aceptada';
  return null;
}

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
        ISNULL(SUM(base.totalAjuste), 0) AS ingresos,
        ISNULL(SUM(base.signo * ISNULL(cost.costo, 0)), 0) AS costos,
        ISNULL(SUM(base.totalAjuste), 0) - ISNULL(SUM(base.signo * ISNULL(cost.costo, 0)), 0) AS utilidadBruta
      FROM (
        ${SQL_VENTAS_AJUSTADAS_BASE}
        ${FILTRO_VENTA_VALIDA_UTILIDADES}
      ) base
      LEFT JOIN (${SQL_COSTO_POR_VENTA}) cost ON cost.idVenta = base.idVenta
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
        base.fechaEmision AS fecha,
        ISNULL(SUM(base.totalAjuste), 0) AS ingresos,
        ISNULL(SUM(base.signo * ISNULL(cost.costo, 0)), 0) AS costos,
        ISNULL(SUM(base.totalAjuste), 0) - ISNULL(SUM(base.signo * ISNULL(cost.costo, 0)), 0) AS utilidadBruta
      FROM (
        ${SQL_VENTAS_AJUSTADAS_BASE}
        ${FILTRO_VENTA_VALIDA_UTILIDADES}
      ) base
      LEFT JOIN (${SQL_COSTO_POR_VENTA}) cost ON cost.idVenta = base.idVenta
      GROUP BY base.fechaEmision
      ORDER BY base.fechaEmision
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
        CONCAT(YEAR(base.fechaEmision), '-', RIGHT('0' + CAST(MONTH(base.fechaEmision) AS VARCHAR(2)), 2)) AS periodo,
        ISNULL(SUM(base.totalAjuste), 0) AS ingresos,
        ISNULL(SUM(base.signo * ISNULL(cost.costo, 0)), 0) AS costos,
        ISNULL(SUM(base.totalAjuste), 0) - ISNULL(SUM(base.signo * ISNULL(cost.costo, 0)), 0) AS utilidadBruta
      FROM (
        ${SQL_VENTAS_AJUSTADAS_BASE}
        ${FILTRO_VENTA_VALIDA_UTILIDADES}
      ) base
      LEFT JOIN (${SQL_COSTO_POR_VENTA}) cost ON cost.idVenta = base.idVenta
      GROUP BY YEAR(base.fechaEmision), MONTH(base.fechaEmision)
      ORDER BY YEAR(base.fechaEmision), MONTH(base.fechaEmision)
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
        CAST(YEAR(base.fechaEmision) AS VARCHAR(4)) AS periodo,
        ISNULL(SUM(base.totalAjuste), 0) AS ingresos,
        ISNULL(SUM(base.signo * ISNULL(cost.costo, 0)), 0) AS costos,
        ISNULL(SUM(base.totalAjuste), 0) - ISNULL(SUM(base.signo * ISNULL(cost.costo, 0)), 0) AS utilidadBruta
      FROM (
        ${SQL_VENTAS_AJUSTADAS_BASE}
        ${FILTRO_VENTA_VALIDA_UTILIDADES}
      ) base
      LEFT JOIN (${SQL_COSTO_POR_VENTA}) cost ON cost.idVenta = base.idVenta
      GROUP BY YEAR(base.fechaEmision)
      ORDER BY YEAR(base.fechaEmision)
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
        ISNULL(dv.total, dv.subtotal) - ISNULL(dv.costoTotal, 0) AS utilidadBruta,
        ISNULL(v.eliminado, 0) AS eliminado,
        v.idEstadoSunat,
        ISNULL(es.descripcion, '') AS estadoSunatDesc
      FROM DetalleVenta dv
      INNER JOIN Ventas v ON dv.idVenta = v.idVenta AND v.idEmpresa = @idEmpresa
      INNER JOIN Productos p ON dv.idProducto = p.idProducto AND p.idEmpresa = @idEmpresa
      LEFT JOIN EstadosSunat es ON es.idEstadoSunat = v.idEstadoSunat
      WHERE CONVERT(DATE, v.fEmision) >= @fechaInicio
        AND CONVERT(DATE, v.fEmision) <= @fechaFin
      ORDER BY v.fEmision, v.idVenta
    `);
  } catch (repoErr) {
    throw repoErr;
  }
  const rows = (rs.recordset || []).map((r) => {
    const eliminado = !!r.eliminado;
    const idEstadoSunat = r.idEstadoSunat != null ? Number(r.idEstadoSunat) : null;
    const excluirDeTotales = ventaExcluidaDeUtilidades(eliminado, idEstadoSunat);
    return {
      idVenta: r.idVenta,
      comprobante: String(r.comprobante || ''),
      fechaVenta: r.fechaVenta ? formatFecha(r.fechaVenta) : '',
      nombreProducto: String(r.nombreProducto || ''),
      precioVenta: Number(r.precioVenta || 0),
      costo: Number(r.costo || 0),
      utilidadBruta: Number(r.utilidadBruta != null ? r.utilidadBruta : (r.precioVenta || 0) - (r.costo || 0)),
      eliminado,
      idEstadoSunat,
      excluirDeTotales,
      estadoComprobante: etiquetaEstadoComprobanteUtilidad(eliminado, idEstadoSunat, r.estadoSunatDesc),
    };
  });
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
