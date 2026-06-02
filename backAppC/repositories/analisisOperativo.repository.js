const sql = require('mssql');
const {
  periodoARango,
  calcularResumenFinancieroPeriodo,
  obtenerGastosAgrupadosPorMes
} = require('../utils/kpisFinancierosOperativo.util');
const {
  resolverRangoConsultaAnalisis,
  listarPeriodosMensuales,
  rangoPeriodoAnterior
} = require('../utils/analisisPeriodo.util');
const { obtenerFlujoCajaPeriodo } = require('../utils/flujoCajaAnalisis.util');
const InventarioRepository = require('./inventario.repository');

/**
 * Resuelve período nominal a YYYY-MM usando la fecha actual.
 */
function resolverPeriodo(periodo) {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  switch (String(periodo || '').toUpperCase()) {
    case 'MES_ACTUAL':
      return `${y}-${String(m + 1).padStart(2, '0')}`;
    case 'MES_ANTERIOR': {
      const prev = new Date(y, m - 1, 1);
      return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    }
    case 'TRIMESTRE':
    case 'ANO_ACTUAL':
      return `${y}-${String(m + 1).padStart(2, '0')}`;
    default:
      return periodo || `${y}-${String(m + 1).padStart(2, '0')}`;
  }
}

/** Cuentas por pagar: suma de Compras con idEstadoPago = 1 (Pendiente). */
async function obtenerCxPRepo(pool, idEmpresa) {
  try {
    const r = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT ISNULL(SUM(c.total), 0) AS saldo
        FROM Compras c
        WHERE c.idEmpresa = @idEmpresa AND c.idEstadoPago = 1
      `);
    return Number((r.recordset[0] || {}).saldo || 0);
  } catch (e) {
    return 0;
  }
}

async function obtenerCuentasPorCobrarRepo(pool, idEmpresa) {
  try {
    const r = await pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa).query(`
      SELECT ISNULL(SUM(cu.saldoPendiente), 0) AS saldo
      FROM CuotasCredito cu
      WHERE cu.idEmpresa = @idEmpresa AND cu.estado IN ('PENDIENTE', 'VENCIDO')
    `);
    return Number((r.recordset[0] || {}).saldo || 0);
  } catch (_) {
    return 0;
  }
}

/**
 * Patrimonio simplificado al cierre del período consultado.
 * Flujo de caja del período (sin aperturas) + inventario + CxC − CxP.
 */
async function obtenerSituacionPatrimonialRepo(pool, idEmpresa, fechaInicio, fechaFin) {
  const [inventarioTotal, cuentasPorCobrar, cuentasPorPagar, flujo] = await Promise.all([
    InventarioRepository.obtenerInventarioValorizadoEmpresa(pool, idEmpresa),
    obtenerCuentasPorCobrarRepo(pool, idEmpresa),
    obtenerCxPRepo(pool, idEmpresa),
    obtenerFlujoCajaPeriodo(pool, idEmpresa, fechaInicio, fechaFin)
  ]);

  const flujoNetoCaja = Number(flujo.flujoNeto || 0);
  const activoCorriente = inventarioTotal + cuentasPorCobrar + flujoNetoCaja;
  const pasivoCorriente = cuentasPorPagar;
  const patrimonio = activoCorriente - pasivoCorriente;

  return {
    inventarioTotal,
    cuentasPorCobrar,
    cuentasPorPagar,
    flujoNetoCaja,
    ingresosEfectivo: Number(flujo.ingresosEfectivo || 0),
    egresosEfectivo: Number(flujo.egresosEfectivo || 0),
    flujoNetoEfectivo: Number(flujo.flujoNetoEfectivo || 0),
    totalIngresosCaja: Number(flujo.totalIngresos || 0),
    totalEgresosCaja: Number(flujo.totalEgresos || 0),
    activoCorriente,
    pasivoCorriente,
    patrimonio
  };
}

function mapBalanceDesdePatrimonio(periodo, sit) {
  const activoFijo = 0;
  const activoTotal = sit.activoCorriente + activoFijo;
  const pasivoLargoPlazo = 0;
  const pasivoTotal = sit.pasivoCorriente + pasivoLargoPlazo;
  const ratioLiquidez =
    sit.pasivoCorriente > 0
      ? sit.activoCorriente / sit.pasivoCorriente
      : (sit.activoCorriente > 0 ? 99 : 0);
  const totalPasivoPatrimonio = pasivoTotal + sit.patrimonio;
  const ratioEndeudamiento =
    totalPasivoPatrimonio > 0 ? pasivoTotal / totalPasivoPatrimonio : 0;

  return {
    periodo,
    inventarioTotal: sit.inventarioTotal,
    cuentasPorCobrar: sit.cuentasPorCobrar,
    cuentasPorPagar: sit.cuentasPorPagar,
    flujoNetoCaja: sit.flujoNetoCaja,
    activoCorriente: sit.activoCorriente,
    activoFijo,
    activoTotal,
    pasivoCorriente: sit.pasivoCorriente,
    pasivoLargoPlazo,
    pasivoTotal,
    patrimonio: sit.patrimonio,
    ratioLiquidez,
    ratioEndeudamiento
  };
}

/**
 * Dashboard ejecutivo: KPIs del período + patrimonio según rango consultado.
 */
async function obtenerDashboardEjecutivoRepo(pool, idEmpresa, filtros = {}) {
  const rango = resolverRangoConsultaAnalisis(filtros);
  const { fechaInicio, fechaFin, periodoEtiqueta } = rango;
  const ant = rangoPeriodoAnterior(fechaInicio, fechaFin);

  const [kpisFin, sit] = await Promise.all([
    calcularResumenFinancieroPeriodo(pool, idEmpresa, fechaInicio, fechaFin, ant),
    obtenerSituacionPatrimonialRepo(pool, idEmpresa, fechaInicio, fechaFin)
  ]);

  const {
    ventasTotales,
    costoVentas,
    utilidadBruta,
    gastosOperativos,
    utilidadNeta,
    utilidadOperativa,
    margenBruto,
    margenOperativo,
    margenNeto,
    crecimientoVentas
  } = kpisFin;

  const activo = sit.activoCorriente;
  const patrimonio = sit.patrimonio;

  return {
    periodo: periodoEtiqueta,
    fechaInicio,
    fechaFin,
    ventasTotales,
    costoVentas,
    utilidadBruta,
    gastosOperativos,
    utilidadOperativa,
    utilidadNeta,
    margenBruto,
    margenOperativo,
    margenNeto,
    crecimientoVentas,
    roi: activo > 0 ? utilidadNeta / activo : 0,
    inventarioTotal: sit.inventarioTotal,
    cuentasPorCobrar: sit.cuentasPorCobrar,
    cuentasPorPagar: sit.cuentasPorPagar,
    flujoCaja: sit.flujoNetoCaja,
    flujoNetoEfectivo: sit.flujoNetoEfectivo,
    ingresosEfectivo: sit.ingresosEfectivo,
    patrimonio
  };
}

/**
 * Balance general por período: patrimonio con flujo de caja real del rango (sin aperturas).
 * ANO_ACTUAL o rango multi-mes devuelve un registro por mes.
 */
async function obtenerBalanceGeneralRepo(pool, idEmpresa, filtros = {}) {
  const periodoNom = String(filtros.periodo || 'MES_ACTUAL').toUpperCase();
  const rango = resolverRangoConsultaAnalisis(filtros);
  const { fechaInicio, fechaFin } = rango;

  const periodosMensuales = listarPeriodosMensuales(fechaInicio, fechaFin);
  const desgloseMensual =
    periodoNom === 'ANO_ACTUAL' ||
    (filtros.agruparMensual && periodosMensuales.length > 1);

  if (desgloseMensual && periodosMensuales.length > 1) {
    const filas = await Promise.all(
      periodosMensuales.map(async (p) => {
        const { fechaInicio: fi, fechaFin: ff } = periodoARango(p);
        const sit = await obtenerSituacionPatrimonialRepo(pool, idEmpresa, fi, ff);
        return mapBalanceDesdePatrimonio(p, sit);
      })
    );
    const sitAnual = await obtenerSituacionPatrimonialRepo(pool, idEmpresa, fechaInicio, fechaFin);
    return [
      ...filas,
      mapBalanceDesdePatrimonio(String(rango.periodoEtiqueta), sitAnual)
    ];
  }

  const sit = await obtenerSituacionPatrimonialRepo(pool, idEmpresa, fechaInicio, fechaFin);
  return [mapBalanceDesdePatrimonio(rango.periodoEtiqueta, sit)];
}

/** Flujo de caja del período (alineado al arqueo, sin APERTURA_CAJA). */
async function obtenerFlujoCajaAnalisisRepo(pool, idEmpresa, filtros = {}) {
  const rango = resolverRangoConsultaAnalisis(filtros);
  const flujo = await obtenerFlujoCajaPeriodo(
    pool,
    idEmpresa,
    rango.fechaInicio,
    rango.fechaFin
  );
  const sit = await obtenerSituacionPatrimonialRepo(
    pool,
    idEmpresa,
    rango.fechaInicio,
    rango.fechaFin
  );
  return {
    periodo: rango.periodoEtiqueta,
    fechaInicio: rango.fechaInicio,
    fechaFin: rango.fechaFin,
    ...flujo,
    patrimonioEstimado: sit.patrimonio,
    inventarioTotal: sit.inventarioTotal,
    cuentasPorCobrar: sit.cuentasPorCobrar,
    cuentasPorPagar: sit.cuentasPorPagar
  };
}

/** Serie mensual de flujo de caja (reporte anual). */
async function obtenerFlujoCajaSerieMensualRepo(pool, idEmpresa, filtros = {}) {
  const rango = resolverRangoConsultaAnalisis(filtros);
  const periodos = listarPeriodosMensuales(rango.fechaInicio, rango.fechaFin);
  const serie = await Promise.all(
    periodos.map(async (p) => {
      const { fechaInicio, fechaFin } = periodoARango(p);
      const flujo = await obtenerFlujoCajaPeriodo(pool, idEmpresa, fechaInicio, fechaFin);
      const sit = await obtenerSituacionPatrimonialRepo(pool, idEmpresa, fechaInicio, fechaFin);
      return {
        periodo: p,
        fechaInicio,
        fechaFin,
        totalIngresos: flujo.totalIngresos,
        totalEgresos: flujo.totalEgresos,
        flujoNeto: flujo.flujoNeto,
        ingresosEfectivo: flujo.ingresosEfectivo,
        flujoNetoEfectivo: flujo.flujoNetoEfectivo,
        patrimonio: sit.patrimonio
      };
    })
  );
  return { periodo: rango.periodoEtiqueta, serie };
}

/**
 * Estado de resultados por período (mes) con datos reales. Gastos operativos desde tabla Gastos.
 */
async function obtenerEstadoResultadosRepo(pool, idEmpresa, filtros) {
  let fechaInicio, fechaFin;
  if (filtros.fechaDesde && filtros.fechaHasta) {
    fechaInicio = filtros.fechaDesde;
    fechaFin = filtros.fechaHasta;
  } else if (filtros.periodoInicio && filtros.periodoFin) {
    const r1 = periodoARango(filtros.periodoInicio);
    const r2 = periodoARango(filtros.periodoFin);
    fechaInicio = r1.fechaInicio;
    fechaFin = r2.fechaFin;
  } else {
    const d = new Date();
    const r = periodoARango(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    fechaInicio = r.fechaInicio;
    fechaFin = r.fechaFin;
  }

  const rs = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fechaInicio', sql.Date, fechaInicio)
    .input('fechaFin', sql.Date, fechaFin)
    .query(`
      SELECT
        CONCAT(YEAR(v.fEmision), '-', RIGHT('0' + CAST(MONTH(v.fEmision) AS VARCHAR(2)), 2)) AS periodo,
        ISNULL(SUM(v.total), 0) AS ingresos,
        ISNULL(SUM(dv.costoTotal), 0) AS costoVentas,
        ISNULL(SUM(v.total), 0) - ISNULL(SUM(dv.costoTotal), 0) AS utilidadBruta
      FROM Ventas v
      LEFT JOIN DetalleVenta dv ON dv.idVenta = v.idVenta
      WHERE v.idEmpresa = @idEmpresa
        AND CONVERT(DATE, v.fEmision) >= @fechaInicio AND CONVERT(DATE, v.fEmision) <= @fechaFin
      GROUP BY YEAR(v.fEmision), MONTH(v.fEmision)
      ORDER BY YEAR(v.fEmision), MONTH(v.fEmision)
    `);

  const gastosPorPeriodo = await obtenerGastosAgrupadosPorMes(
    pool,
    idEmpresa,
    fechaInicio,
    fechaFin
  );

  return (rs.recordset || []).map((r) => {
    const periodo = String(r.periodo || '');
    const ingresos = Number(r.ingresos || 0);
    const costoVentas = Number(r.costoVentas || 0);
    const utilidadBruta = ingresos - costoVentas;
    const gastosOperacion = gastosPorPeriodo[periodo] != null ? gastosPorPeriodo[periodo] : 0;
    const gastosFinancieros = 0;
    const utilidadOperacion = utilidadBruta - gastosOperacion;
    const utilidadAntesImpuestos = utilidadOperacion - gastosFinancieros;
    const impuestos = 0;
    const utilidadNeta = utilidadAntesImpuestos - impuestos;
    return {
      periodo,
      ingresos,
      costoVentas,
      utilidadBruta,
      gastosOperacion,
      utilidadOperacion,
      gastosFinancieros,
      utilidadAntesImpuestos,
      impuestos,
      utilidadNeta
    };
  });
}

/**
 * Ventas a crédito del período: CreditosClientes generados en el mes, o Ventas pendientes de cobro emitidas en el mes.
 */
async function obtenerVentasCreditoPeriodoRepo(pool, idEmpresa, fechaInicio, fechaFin) {
  try {
    const r = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('fechaInicio', sql.Date, fechaInicio)
      .input('fechaFin', sql.Date, fechaFin)
      .query(`
        SELECT ISNULL(SUM(cc.montoTotal), 0) AS total
        FROM CreditosClientes cc
        WHERE cc.idEmpresa = @idEmpresa
          AND CONVERT(DATE, cc.fechaCredito) >= @fechaInicio AND CONVERT(DATE, cc.fechaCredito) <= @fechaFin
      `);
    const desdeCreditos = Number((r.recordset[0] || {}).total || 0);
    if (desdeCreditos > 0) return desdeCreditos;
  } catch (_) {}
  try {
    const r = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('fechaInicio', sql.Date, fechaInicio)
      .input('fechaFin', sql.Date, fechaFin)
      .query(`
        SELECT ISNULL(SUM(
          CASE
            WHEN (
              v.total - ISNULL((
                SELECT SUM(vnc.total)
                FROM Ventas vnc
                INNER JOIN Comprobantes cnc ON cnc.idComprobante = vnc.idComprobante AND cnc.idEmpresa = vnc.idEmpresa
                INNER JOIN ComprobantesElectronicos ce ON ce.idVenta = vnc.idVenta AND ce.idEmpresa = vnc.idEmpresa
                WHERE vnc.idEmpresa = v.idEmpresa
                  AND ISNULL(vnc.eliminado, 0) = 0
                  AND UPPER(LTRIM(RTRIM(ISNULL(cnc.codigo, '')))) IN ('F7','B7','07')
                  AND ce.tipoComprobante = '07'
                  AND ce.idEstadoSunat IN (1, 2, 3)
                  AND RTRIM(LTRIM(UPPER(ISNULL(vnc.compRelacionado, '')))) = RTRIM(LTRIM(UPPER(ISNULL(v.compVenta, ''))))
              ), 0)
            ) < 0 THEN 0
            ELSE (
              v.total - ISNULL((
                SELECT SUM(vnc.total)
                FROM Ventas vnc
                INNER JOIN Comprobantes cnc ON cnc.idComprobante = vnc.idComprobante AND cnc.idEmpresa = vnc.idEmpresa
                INNER JOIN ComprobantesElectronicos ce ON ce.idVenta = vnc.idVenta AND ce.idEmpresa = vnc.idEmpresa
                WHERE vnc.idEmpresa = v.idEmpresa
                  AND ISNULL(vnc.eliminado, 0) = 0
                  AND UPPER(LTRIM(RTRIM(ISNULL(cnc.codigo, '')))) IN ('F7','B7','07')
                  AND ce.tipoComprobante = '07'
                  AND ce.idEstadoSunat IN (1, 2, 3)
                  AND RTRIM(LTRIM(UPPER(ISNULL(vnc.compRelacionado, '')))) = RTRIM(LTRIM(UPPER(ISNULL(v.compVenta, ''))))
              ), 0)
            )
          END
        ), 0) AS total
        FROM Ventas v
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        WHERE v.idEmpresa = @idEmpresa AND v.idEstadoPago = 1
          AND ISNULL(v.eliminado, 0) = 0
          AND UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) NOT IN ('F7','B7','F8','B8','07','08')
          AND CONVERT(DATE, v.fEmision) >= @fechaInicio AND CONVERT(DATE, v.fEmision) <= @fechaFin
      `);
    return Number((r.recordset[0] || {}).total || 0);
  } catch (e) {
    return 0;
  }
}

/**
 * Compras a crédito del período (Compras con idEstadoPago=1 en el mes).
 */
async function obtenerComprasCreditoPeriodoRepo(pool, idEmpresa, fechaInicio, fechaFin) {
  try {
    const r = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('fechaInicio', sql.Date, fechaInicio)
      .input('fechaFin', sql.Date, fechaFin)
      .query(`
        SELECT ISNULL(SUM(c.total), 0) AS total
        FROM Compras c
        WHERE c.idEmpresa = @idEmpresa AND c.idEstadoPago = 1
          AND CONVERT(DATE, c.fEmision) >= @fechaInicio AND CONVERT(DATE, c.fEmision) <= @fechaFin
      `);
    return Number((r.recordset[0] || {}).total || 0);
  } catch (e) {
    return 0;
  }
}

/**
 * Ratios financieros del último período con datos reales (CxP, efectivo, rotaciones reales).
 */
async function obtenerRatiosFinancierosRepo(pool, idEmpresa) {
  const ahora = new Date();
  const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  const { fechaInicio, fechaFin } = periodoARango(mesActual);

  const [balance, estado, inventarioValor, cxcSaldo, cxpSaldo, ventasCreditoMes, comprasCreditoMes] = await Promise.all([
    obtenerBalanceGeneralRepo(pool, idEmpresa, 'MES_ACTUAL'),
    obtenerEstadoResultadosRepo(pool, idEmpresa, { periodoInicio: mesActual, periodoFin: mesActual }),
    InventarioRepository.obtenerInventarioValorizadoEmpresa(pool, idEmpresa),
    pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa).query(`
      SELECT ISNULL(SUM(cu.saldoPendiente), 0) AS saldo
      FROM CuotasCredito cu
      WHERE cu.idEmpresa = @idEmpresa AND cu.estado IN ('PENDIENTE', 'VENCIDO')
    `).catch(() => ({ recordset: [{ saldo: 0 }] })),
    obtenerCxPRepo(pool, idEmpresa),
    obtenerVentasCreditoPeriodoRepo(pool, idEmpresa, fechaInicio, fechaFin),
    obtenerComprasCreditoPeriodoRepo(pool, idEmpresa, fechaInicio, fechaFin)
  ]);

  const bg = balance[0] || {};
  const er = (estado[0] || {});
  const ingresos = Number(er.ingresos || 0);
  const costoVentas = Number(er.costoVentas || 0);
  const utilidadBruta = ingresos - costoVentas;
  const utilidadNeta = Number(er.utilidadNeta || 0);
  const activoCorriente = Number(bg.activoCorriente || 0);
  const pasivoCorriente = Number(bg.pasivoCorriente || 0) || 1;
  const activoTotal = Number(bg.activoTotal || 0) || 1;
  const patrimonio = Number(bg.patrimonio || 0) || 1;
  const inventarioVal = Number(inventarioValor || 0);
  const cxcPromedio = Number((cxcSaldo.recordset[0] || {}).saldo || 0);
  const cxpPromedio = Number(cxpSaldo);
  const ventasCredito = Number(ventasCreditoMes);
  const comprasCredito = Number(comprasCreditoMes);

  const ratioLiquidezCorriente = activoCorriente / pasivoCorriente;
  const ratioLiquidezAcida = (activoCorriente - inventarioVal) / pasivoCorriente;
  const ratioLiquidezInmediata = ratioLiquidezAcida;
  const pasivoTotal = Number(bg.pasivoTotal || 0);
  const ratioDeudaTotal = (pasivoTotal + patrimonio) > 0 ? pasivoTotal / (pasivoTotal + patrimonio) : 0;
  const ratioDeudaPatrimonio = patrimonio > 0 ? pasivoTotal / patrimonio : 0;
  const margenBruto = ingresos > 0 ? utilidadBruta / ingresos : 0;
  const margenOperativo = ingresos > 0 ? (utilidadBruta - Number(er.gastosOperacion || 0)) / ingresos : 0;
  const margenNeto = ingresos > 0 ? utilidadNeta / ingresos : 0;
  const ROA = activoTotal > 0 ? utilidadNeta / activoTotal : 0;
  const ROE = patrimonio > 0 ? utilidadNeta / patrimonio : 0;
  const rotacionInventario = inventarioVal > 0 ? costoVentas / inventarioVal : 0;
  const rotacionCuentasCobrar = cxcPromedio > 0 ? (ventasCredito * 12) / cxcPromedio : 12;
  const rotacionCuentasPagar = cxpPromedio > 0 ? (comprasCredito * 12) / cxpPromedio : 12;
  const diasInventario = rotacionInventario > 0 ? 365 / rotacionInventario : 0;
  const diasCobro = rotacionCuentasCobrar > 0 ? 365 / rotacionCuentasCobrar : 30;
  const diasPago = rotacionCuentasPagar > 0 ? 365 / rotacionCuentasPagar : 30;
  const cicloConversionEfectivo = Math.round(diasInventario + diasCobro - diasPago);

  return {
    ratioLiquidezCorriente,
    ratioLiquidezAcida,
    ratioLiquidezInmediata,
    ratioDeudaTotal,
    ratioDeudaPatrimonio,
    nivelEndeudamiento: ratioDeudaTotal,
    coberturaIntereses: 0,
    margenBruto,
    margenOperativo,
    margenNeto,
    ROA,
    ROE,
    ROI: ROE,
    rotacionInventario,
    rotacionCuentasCobrar,
    rotacionCuentasPagar,
    cicloConversionEfectivo
  };
}

/**
 * Diagnóstico financiero: salud, puntuación, fortalezas, debilidades, recomendaciones, ratios críticos.
 */
async function obtenerDiagnosticoFinancieroRepo(pool, idEmpresa) {
  const ratios = await obtenerRatiosFinancierosRepo(pool, idEmpresa);
  const lc = ratios.ratioLiquidezCorriente || 0;
  const mn = ratios.margenNeto || 0;
  const endeudamiento = ratios.ratioDeudaTotal || 0;
  const ciclo = ratios.cicloConversionEfectivo || 0;

  let puntuacion = 0;
  if (lc >= 2) puntuacion += 25; else if (lc >= 1.5) puntuacion += 20; else if (lc >= 1) puntuacion += 10;
  if (mn >= 0.1) puntuacion += 25; else if (mn >= 0.05) puntuacion += 15; else if (mn >= 0.02) puntuacion += 5;
  if (endeudamiento <= 0.6) puntuacion += 25; else if (endeudamiento <= 0.7) puntuacion += 15; else if (endeudamiento <= 0.8) puntuacion += 5;
  if (ciclo <= 60) puntuacion += 25; else if (ciclo <= 90) puntuacion += 15; else if (ciclo <= 120) puntuacion += 5;

  let saludFinanciera = 'DEFICIENTE';
  if (puntuacion >= 80) saludFinanciera = 'EXCELENTE';
  else if (puntuacion >= 60) saludFinanciera = 'BUENA';
  else if (puntuacion >= 40) saludFinanciera = 'REGULAR';

  const fortalezas = [];
  const debilidades = [];
  if (lc >= 1.5) fortalezas.push('Buena liquidez para cubrir obligaciones a corto plazo.');
  else debilidades.push('Liquidez baja: riesgo de no cubrir deudas corrientes.');
  if (mn >= 0.05) fortalezas.push('Rentabilidad aceptable sobre ventas.');
  else debilidades.push('Margen neto bajo: revisar precios y costos.');
  if (endeudamiento <= 0.6) fortalezas.push('Endeudamiento controlado.');
  else debilidades.push('Alto endeudamiento: monitorear capacidad de pago.');
  if (ciclo <= 90) fortalezas.push('Ciclo de conversión de efectivo eficiente.');
  else debilidades.push('Ciclo de efectivo largo: mejorar cobros e inventarios.');
  if (fortalezas.length === 0) fortalezas.push('La empresa opera con datos registrados; complete información para un diagnóstico más completo.');

  const recomendaciones = [];
  if (lc < 1.5) recomendaciones.push('Mejorar liquidez: acelerar cobros a clientes y reducir inventarios innecesarios.');
  if (mn < 0.05) recomendaciones.push('Aumentar rentabilidad: revisar precios de venta y controlar costos operativos.');
  if (endeudamiento > 0.7) recomendaciones.push('Reducir endeudamiento: generar más utilidades retenidas o optimizar estructura de deuda.');
  if (ciclo > 90) recomendaciones.push('Optimizar ciclo operativo: mejorar gestión de inventarios y acelerar cobros.');
  if (recomendaciones.length === 0) recomendaciones.push('Mantener las buenas prácticas actuales y continuar monitoreando indicadores.');

  const ratioEstado = (valor, optimo) => (valor >= optimo ? 'OPTIMO' : valor >= optimo * 0.7 ? 'ACEPTABLE' : valor >= optimo * 0.4 ? 'PREOCUPANTE' : 'CRITICO');
  const ratiosCriticos = [
    { nombre: 'Liquidez Corriente', valor: lc, rangoOptimo: '> 1.5', estado: ratioEstado(lc, 1.5) },
    { nombre: 'Margen Neto', valor: mn, rangoOptimo: '> 10%', estado: ratioEstado(mn, 0.1) },
    { nombre: 'Endeudamiento', valor: endeudamiento, rangoOptimo: '< 60%', estado: endeudamiento <= 0.6 ? 'OPTIMO' : endeudamiento <= 0.7 ? 'ACEPTABLE' : endeudamiento <= 0.8 ? 'PREOCUPANTE' : 'CRITICO' },
    { nombre: 'Ciclo Conversión (días)', valor: ciclo, rangoOptimo: '< 60', estado: ciclo <= 60 ? 'OPTIMO' : ciclo <= 90 ? 'ACEPTABLE' : ciclo <= 120 ? 'PREOCUPANTE' : 'CRITICO' }
  ];

  return {
    saludFinanciera,
    puntuacion,
    fortalezas,
    debilidades,
    recomendaciones,
    ratiosCriticos
  };
}

module.exports = {
  obtenerDashboardEjecutivoRepo,
  obtenerBalanceGeneralRepo,
  obtenerFlujoCajaAnalisisRepo,
  obtenerFlujoCajaSerieMensualRepo,
  obtenerSituacionPatrimonialRepo,
  obtenerEstadoResultadosRepo,
  obtenerRatiosFinancierosRepo,
  obtenerDiagnosticoFinancieroRepo,
  resolverPeriodo,
  periodoARango
};
