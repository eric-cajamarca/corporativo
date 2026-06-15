const sql = require('mssql');
const { partesAhoraApp, partesFechaHoraEnTz, getAppTimezone } = require('./fechaDisplay.util');

/**
 * KPIs financieros operativos compartidos (Inicio /dashboard y Análisis /analisis).
 * Ventas y costo desde Ventas + DetalleVenta; gastos operativos solo tabla Gastos
 * (evita doble conteo con egresos de caja que suelen duplicar gastos ya registrados).
 */

function fmtYmd(d) {
  const p = partesFechaHoraEnTz(d, getAppTimezone());
  return `${p.y}-${p.m}-${p.d}`;
}

function periodoARango(periodo) {
  if (!periodo || periodo.length < 6) {
    const { y, m } = partesAhoraApp();
    periodo = `${y}-${m}`;
  }
  const [y, m] = periodo.split('-').map(Number);
  const inicio = new Date(y, m - 1, 1);
  const fin = new Date(y, m, 0);
  return { fechaInicio: fmtYmd(inicio), fechaFin: fmtYmd(fin) };
}

function rangoMesActualYAnterior() {
  let yN = Number(partesAhoraApp().y);
  let mN = Number(partesAhoraApp().m);
  const mesActual = `${yN}-${String(mN).padStart(2, '0')}`;
  mN -= 1;
  if (mN < 1) {
    mN = 12;
    yN -= 1;
  }
  const periodoAnterior = `${yN}-${String(mN).padStart(2, '0')}`;
  const actual = periodoARango(mesActual);
  const anterior = periodoARango(periodoAnterior);
  return {
    mesActual,
    periodoAnterior,
    fechaInicio: actual.fechaInicio,
    fechaFin: actual.fechaFin,
    fechaInicioAnterior: anterior.fechaInicio,
    fechaFinAnterior: anterior.fechaFin
  };
}

async function obtenerVentasYCostoPeriodo(pool, idEmpresa, fechaInicio, fechaFin) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fechaInicio', sql.Date, fechaInicio)
    .input('fechaFin', sql.Date, fechaFin)
    .query(`
      SELECT
        ISNULL(SUM(
          CASE
            WHEN UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) IN ('F7','B7','07') THEN -ABS(v.total)
            ELSE v.total
          END
        ), 0) AS ventasTotales,
        ISNULL(SUM(
          CASE
            WHEN UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) IN ('F7','B7','07') THEN -ABS(ISNULL(dv.costoTotal, 0))
            ELSE ISNULL(dv.costoTotal, 0)
          END
        ), 0) AS costoVentas
      FROM Ventas v
      LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
      LEFT JOIN DetalleVenta dv ON dv.idVenta = v.idVenta
      WHERE v.idEmpresa = @idEmpresa
        AND ISNULL(v.eliminado, 0) = 0
        AND CONVERT(DATE, v.fEmision) >= @fechaInicio
        AND CONVERT(DATE, v.fEmision) <= @fechaFin
    `);
  const row = r.recordset[0] || {};
  return {
    ventasTotales: Number(row.ventasTotales || 0),
    costoVentas: Number(row.costoVentas || 0)
  };
}

async function obtenerVentasPeriodo(pool, idEmpresa, fechaInicio, fechaFin) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fechaInicio', sql.Date, fechaInicio)
    .input('fechaFin', sql.Date, fechaFin)
    .query(`
      SELECT ISNULL(SUM(
          CASE
            WHEN UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) IN ('F7','B7','07') THEN -ABS(v.total)
            ELSE v.total
          END
        ), 0) AS ventasTotales
      FROM Ventas v
      LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
      WHERE v.idEmpresa = @idEmpresa
        AND ISNULL(v.eliminado, 0) = 0
        AND CONVERT(DATE, v.fEmision) >= @fechaInicio
        AND CONVERT(DATE, v.fEmision) <= @fechaFin
    `);
  return Number((r.recordset[0] || {}).ventasTotales || 0);
}

/** Gastos operativos del período (solo tabla Gastos). */
async function obtenerGastosOperativosPeriodo(pool, idEmpresa, fechaInicio, fechaFin) {
  try {
    const r = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('fechaInicio', sql.Date, fechaInicio)
      .input('fechaFin', sql.Date, fechaFin)
      .query(`
        SELECT ISNULL(SUM(monto), 0) AS total
        FROM Gastos
        WHERE idEmpresa = @idEmpresa
          AND fecha >= @fechaInicio AND fecha <= @fechaFin
      `);
    return Number((r.recordset[0] || {}).total || 0);
  } catch (_) {
    return 0;
  }
}

/** Gastos agrupados por mes (YYYY-MM) en un rango de fechas. */
async function obtenerGastosAgrupadosPorMes(pool, idEmpresa, fechaInicio, fechaFin) {
  const gastosPorPeriodo = {};
  try {
    const rg = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('fechaInicio', sql.Date, fechaInicio)
      .input('fechaFin', sql.Date, fechaFin)
      .query(`
        SELECT
          CONCAT(YEAR(fecha), '-', RIGHT('0' + CAST(MONTH(fecha) AS VARCHAR(2)), 2)) AS periodo,
          ISNULL(SUM(monto), 0) AS gastos
        FROM Gastos
        WHERE idEmpresa = @idEmpresa
          AND fecha >= @fechaInicio AND fecha <= @fechaFin
        GROUP BY YEAR(fecha), MONTH(fecha)
      `);
    (rg.recordset || []).forEach((row) => {
      gastosPorPeriodo[row.periodo] = Number(row.gastos || 0);
    });
  } catch (_) {}
  return gastosPorPeriodo;
}

function calcularMargenesYVariaciones({
  ventasTotales,
  costoVentas,
  gastosOperativos,
  ventasTotalesAnterior,
  utilidadNetaAnterior
}) {
  const ingresos = ventasTotales;
  const costos = costoVentas;
  const utilidadBruta = ingresos - costos;
  const utilidadNeta = utilidadBruta - gastosOperativos;
  const utilidadOperativa = utilidadBruta - gastosOperativos;

  const ventasVariacion =
    ventasTotalesAnterior > 0
      ? ((ventasTotales - ventasTotalesAnterior) / ventasTotalesAnterior) * 100
      : (ventasTotales > 0 ? 100 : 0);

  const utilidadVariacion =
    utilidadNetaAnterior > 0
      ? ((utilidadNeta - utilidadNetaAnterior) / utilidadNetaAnterior) * 100
      : (utilidadNeta > 0 ? 100 : 0);

  const margenBruto = ventasTotales > 0 ? utilidadBruta / ventasTotales : 0;
  const margenOperativo = ventasTotales > 0 ? utilidadOperativa / ventasTotales : 0;
  const margenNeto = ventasTotales > 0 ? utilidadNeta / ventasTotales : 0;
  const roiPctVentas = ventasTotales > 0 ? (utilidadNeta / ventasTotales) * 100 : 0;
  const crecimientoVentas =
    ventasTotalesAnterior > 0
      ? (ventasTotales - ventasTotalesAnterior) / ventasTotalesAnterior
      : 0;

  return {
    ingresos,
    costos,
    costoVentas: costos,
    utilidadBruta,
    gastosOperativos,
    utilidadOperativa,
    utilidadNeta,
    ventasVariacion,
    utilidadVariacion,
    margenBruto,
    margenOperativo,
    margenNeto,
    roiPctVentas,
    crecimientoVentas
  };
}

/**
 * Resumen financiero del período con variación vs período anterior (misma lógica en home y análisis).
 */
async function calcularResumenFinancieroPeriodo(
  pool,
  idEmpresa,
  fechaInicio,
  fechaFin,
  opciones = {}
) {
  const { fechaInicioAnterior, fechaFinAnterior } = opciones;
  const [{ ventasTotales, costoVentas }, gastosOperativos] = await Promise.all([
    obtenerVentasYCostoPeriodo(pool, idEmpresa, fechaInicio, fechaFin),
    obtenerGastosOperativosPeriodo(pool, idEmpresa, fechaInicio, fechaFin)
  ]);

  let ventasTotalesAnterior = 0;
  let utilidadNetaAnterior = 0;
  if (fechaInicioAnterior && fechaFinAnterior) {
    const [ventasAnt, costoAnt, gastosAnt] = await Promise.all([
      obtenerVentasPeriodo(pool, idEmpresa, fechaInicioAnterior, fechaFinAnterior),
      obtenerVentasYCostoPeriodo(pool, idEmpresa, fechaInicioAnterior, fechaFinAnterior).then(
        (x) => x.costoVentas
      ),
      obtenerGastosOperativosPeriodo(pool, idEmpresa, fechaInicioAnterior, fechaFinAnterior)
    ]);
    ventasTotalesAnterior = ventasAnt;
    utilidadNetaAnterior = ventasAnt - costoAnt - gastosAnt;
  }

  return {
    ventasTotales,
    ...calcularMargenesYVariaciones({
      ventasTotales,
      costoVentas,
      gastosOperativos,
      ventasTotalesAnterior,
      utilidadNetaAnterior
    })
  };
}

module.exports = {
  periodoARango,
  rangoMesActualYAnterior,
  obtenerVentasYCostoPeriodo,
  obtenerVentasPeriodo,
  obtenerGastosOperativosPeriodo,
  obtenerGastosAgrupadosPorMes,
  calcularResumenFinancieroPeriodo,
  calcularMargenesYVariaciones
};
