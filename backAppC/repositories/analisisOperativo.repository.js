const sql = require('mssql');
const {
  periodoARango,
  calcularResumenFinancieroPeriodo,
  obtenerGastosAgrupadosPorMes,
  SQL_VENTAS_AJUSTADAS_BASE,
  SQL_COSTO_POR_VENTA
} = require('../utils/kpisFinancierosOperativo.util');
const {
  resolverRangoConsultaAnalisis,
  listarPeriodosMensuales,
  rangoPeriodoAnterior
} = require('../utils/analisisPeriodo.util');
const { obtenerFlujoCajaPeriodo } = require('../utils/flujoCajaAnalisis.util');
const { partesAhoraApp } = require('../utils/fechaDisplay.util');
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

/** Cuentas por pagar: suma de Compras con idEstadoPago = 1 (Pendiente) emitidas hasta fechaCorte si se especifica. */
async function obtenerCxPRepo(pool, idEmpresa, fechaCorte = null) {
  try {
    const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    let whereFecha = '';
    if (fechaCorte) {
      req.input('fechaCorte', sql.Date, fechaCorte);
      whereFecha = 'AND CONVERT(DATE, c.fEmision) <= @fechaCorte';
    }
    const r = await req.query(`
      SELECT ISNULL(SUM(c.total), 0) AS saldo
      FROM Compras c
      WHERE c.idEmpresa = @idEmpresa AND c.idEstadoPago = 1
      ${whereFecha}
    `);
    return Number((r.recordset[0] || {}).saldo || 0);
  } catch (e) {
    return 0;
  }
}

/** Cuentas por cobrar: saldo vivo al corte de fechaCorte (excluye créditos posteriores). */
async function obtenerCuentasPorCobrarRepo(pool, idEmpresa, fechaCorte = null) {
  try {
    const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    let sqlQuery = '';
    if (fechaCorte) {
      req.input('fechaCorte', sql.Date, fechaCorte);
      sqlQuery = `
        SELECT ISNULL(SUM(cu.montoCuota - ISNULL(pagado.totalPagado, 0)), 0) AS saldo
        FROM CuotasCredito cu
        INNER JOIN CreditosClientes cc ON cc.idCredito = cu.idCredito AND cc.idEmpresa = cu.idEmpresa
        OUTER APPLY (
          SELECT SUM(pc.montoPagado) AS totalPagado
          FROM PagosCuotas pc
          WHERE pc.idCuota = cu.idCuota AND CONVERT(DATE, pc.fechaPago) <= @fechaCorte
        ) pagado
        WHERE cu.idEmpresa = @idEmpresa
          AND CONVERT(DATE, ISNULL(cc.fechaCredito, cu.fechaVencimiento)) <= @fechaCorte
          AND (cu.montoCuota - ISNULL(pagado.totalPagado, 0)) > 0.01
      `;
    } else {
      sqlQuery = `
        SELECT ISNULL(SUM(cu.saldoPendiente), 0) AS saldo
        FROM CuotasCredito cu
        WHERE cu.idEmpresa = @idEmpresa AND cu.estado IN ('PENDIENTE', 'VENCIDO', 'PARCIAL')
      `;
    }
    const r = await req.query(sqlQuery);
    return Number((r.recordset[0] || {}).saldo || 0);
  } catch (_) {
    return 0;
  }
}

/**
 * Patrimonio simplificado al cierre del período consultado.
 * Flujo de caja del período (sin aperturas) + inventario + CxC − CxP a la fecha de corte.
 */
async function obtenerSituacionPatrimonialRepo(pool, idEmpresa, fechaInicio, fechaFin) {
  const [inventarioTotal, cuentasPorCobrar, cuentasPorPagar, flujo] = await Promise.all([
    InventarioRepository.obtenerInventarioValorizadoEmpresa(pool, idEmpresa),
    obtenerCuentasPorCobrarRepo(pool, idEmpresa, fechaFin),
    obtenerCxPRepo(pool, idEmpresa, fechaFin),
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
  // Si pasivoCorriente es 0, el ratio de liquidez no tiene denominador (null), no inventar 99.
  const ratioLiquidez =
    sit.pasivoCorriente > 0
      ? sit.activoCorriente / sit.pasivoCorriente
      : null;
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
        CONCAT(YEAR(base.fechaEmision), '-', RIGHT('0' + CAST(MONTH(base.fechaEmision) AS VARCHAR(2)), 2)) AS periodo,
        ISNULL(SUM(base.ingresosNetos), 0) AS ingresos,
        ISNULL(SUM(base.igvAjuste), 0) AS igvTotal,
        ISNULL(SUM(base.totalAjuste), 0) AS totalFacturado,
        ISNULL(SUM(base.signo * ISNULL(cost.costo, 0)), 0) AS costoVentas,
        ISNULL(SUM(base.ingresosNetos), 0) - ISNULL(SUM(base.signo * ISNULL(cost.costo, 0)), 0) AS utilidadBruta
      FROM (${SQL_VENTAS_AJUSTADAS_BASE}) base
      LEFT JOIN (${SQL_COSTO_POR_VENTA}) cost ON cost.idVenta = base.idVenta
      GROUP BY YEAR(base.fechaEmision), MONTH(base.fechaEmision)
      ORDER BY YEAR(base.fechaEmision), MONTH(base.fechaEmision)
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
    const igvTotal = Number(r.igvTotal || 0);
    const costoVentas = Number(r.costoVentas || 0);
    const utilidadBruta = ingresos - costoVentas;
    const gastosOperacion = gastosPorPeriodo[periodo] != null ? gastosPorPeriodo[periodo] : 0;
    const gastosFinancieros = 0;
    const utilidadOperacion = utilidadBruta - gastosOperacion;
    const utilidadAntesImpuestos = utilidadOperacion - gastosFinancieros;
    const impuestos = igvTotal;
    const utilidadNeta = utilidadAntesImpuestos;
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
 * Ratios financieros calculados sobre datos reales del período consultado.
 */
async function obtenerRatiosFinancierosRepo(pool, idEmpresa, filtros = {}) {
  const rango = resolverRangoConsultaAnalisis(filtros);
  const { fechaInicio, fechaFin, periodoEtiqueta } = rango;

  const [balance, estado, inventarioValor, cxcSaldo, cxpSaldo, ventasCreditoMes, comprasCreditoMes] = await Promise.all([
    obtenerBalanceGeneralRepo(pool, idEmpresa, { periodo: filtros.periodo || 'MES_ACTUAL', fechaDesde: fechaInicio, fechaHasta: fechaFin }),
    obtenerEstadoResultadosRepo(pool, idEmpresa, { fechaDesde: fechaInicio, fechaHasta: fechaFin }),
    InventarioRepository.obtenerInventarioValorizadoEmpresa(pool, idEmpresa),
    obtenerCuentasPorCobrarRepo(pool, idEmpresa, fechaFin),
    obtenerCxPRepo(pool, idEmpresa, fechaFin),
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
  const pasivoCorriente = Number(bg.pasivoCorriente || 0);
  const activoTotal = Number(bg.activoTotal || (activoCorriente + (Number(bg.activoFijo) || 0)));
  const patrimonio = Number(bg.patrimonio || 0);
  const inventarioVal = Number(inventarioValor || 0);
  const cxcPromedio = Number(cxcSaldo || 0);
  const cxpPromedio = Number(cxpSaldo || 0);
  const ventasCredito = Number(ventasCreditoMes || 0);
  const comprasCredito = Number(comprasCreditoMes || 0);

  // Ratios de liquidez: si el pasivo corriente es 0, no hay división entre 1 ni números inventados
  const ratioLiquidezCorriente = pasivoCorriente > 0 ? activoCorriente / pasivoCorriente : null;
  const ratioLiquidezAcida = pasivoCorriente > 0 ? (activoCorriente - inventarioVal) / pasivoCorriente : null;
  const ratioLiquidezInmediata = ratioLiquidezAcida;

  const pasivoTotal = Number(bg.pasivoTotal || 0);
  const totalPasivoPatrimonio = pasivoTotal + patrimonio;
  const ratioDeudaTotal = totalPasivoPatrimonio > 0 ? pasivoTotal / totalPasivoPatrimonio : 0;
  const ratioDeudaPatrimonio = patrimonio > 0 ? pasivoTotal / patrimonio : 0;

  const margenBruto = ingresos > 0 ? utilidadBruta / ingresos : 0;
  const margenOperativo = ingresos > 0 ? (utilidadBruta - Number(er.gastosOperacion || 0)) / ingresos : 0;
  const margenNeto = ingresos > 0 ? utilidadNeta / ingresos : 0;
  const ROA = activoTotal > 0 ? utilidadNeta / activoTotal : 0;
  const ROE = patrimonio > 0 ? utilidadNeta / patrimonio : 0;

  // Días del período consultado (para mensual 30 días aprox.)
  const diasPeriodo = Math.max(1, Math.round((new Date(fechaFin) - new Date(fechaInicio)) / (1000 * 60 * 60 * 24)) + 1);
  const diasPeriodoBase = Number.isFinite(diasPeriodo) && diasPeriodo > 0 ? diasPeriodo : 30;

  // Rotación y días de inventario según el período consultado
  const rotacionInventario = inventarioVal > 0 ? costoVentas / inventarioVal : 0;
  const diasInventario = costoVentas > 0 ? Math.round((inventarioVal / costoVentas) * diasPeriodoBase) : 0;

  // Días de cobro y pago
  const rotacionCuentasCobrar = cxcPromedio > 0 ? (ventasCredito / cxcPromedio) : 0;
  const diasCobro = ventasCredito > 0 ? Math.round((cxcPromedio / ventasCredito) * diasPeriodoBase) : 0;

  const rotacionCuentasPagar = cxpPromedio > 0 ? (comprasCredito / cxpPromedio) : 0;
  const diasPago = comprasCredito > 0 ? Math.round((cxpPromedio / comprasCredito) * diasPeriodoBase) : 0;

  const cicloConversionEfectivo = Math.round(diasInventario + diasCobro - diasPago);

  return {
    periodo: periodoEtiqueta,
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
    diasInventario,
    diasCobro,
    diasPago,
    cicloConversionEfectivo
  };
}

/**
 * Diagnóstico financiero: salud, puntuación, fortalezas, debilidades, recomendaciones, ratios críticos.
 */
async function obtenerDiagnosticoFinancieroRepo(pool, idEmpresa, filtros = {}) {
  const ratios = await obtenerRatiosFinancierosRepo(pool, idEmpresa, filtros);
  const lc = ratios.ratioLiquidezCorriente;
  const mn = ratios.margenNeto || 0;
  const endeudamiento = ratios.ratioDeudaTotal || 0;
  const ciclo = ratios.cicloConversionEfectivo || 0;

  let puntuacion = 0;
  // Sin pasivo corriente (lc == null): liquidez plena a corto plazo
  if (lc == null || lc >= 2) puntuacion += 25;
  else if (lc >= 1.5) puntuacion += 20;
  else if (lc >= 1) puntuacion += 10;

  if (mn >= 0.1) puntuacion += 25;
  else if (mn >= 0.05) puntuacion += 15;
  else if (mn >= 0.02) puntuacion += 5;

  if (endeudamiento <= 0.6) puntuacion += 25;
  else if (endeudamiento <= 0.7) puntuacion += 15;
  else if (endeudamiento <= 0.8) puntuacion += 5;

  if (ciclo <= 60) puntuacion += 25;
  else if (ciclo <= 90) puntuacion += 15;
  else if (ciclo <= 120) puntuacion += 5;

  let saludFinanciera = 'DEFICIENTE';
  if (puntuacion >= 80) saludFinanciera = 'EXCELENTE';
  else if (puntuacion >= 60) saludFinanciera = 'BUENA';
  else if (puntuacion >= 40) saludFinanciera = 'REGULAR';

  const fortalezas = [];
  const debilidades = [];
  if (lc == null) {
    fortalezas.push('Sin pasivos corrientes pendientes: no existe presión de deuda a corto plazo.');
  } else if (lc >= 1.5) {
    fortalezas.push('Buena liquidez para cubrir obligaciones a corto plazo.');
  } else {
    debilidades.push('Liquidez baja: riesgo de no cubrir deudas corrientes.');
  }

  if (mn >= 0.05) {
    fortalezas.push('Rentabilidad aceptable sobre ventas.');
  } else if (mn > 0) {
    debilidades.push('Margen neto bajo: margen sobre ventas reducido.');
  } else {
    debilidades.push('Sin rentabilidad en el período seleccionado.');
  }

  if (endeudamiento <= 0.6) fortalezas.push('Endeudamiento controlado.');
  else debilidades.push('Alto endeudamiento: monitorear capacidad de pago.');

  if (ciclo <= 90) fortalezas.push('Ciclo de conversión de efectivo eficiente.');
  else debilidades.push('Ciclo de efectivo largo: mejorar cobros e inventarios.');

  const recomendaciones = [];
  if (lc != null && lc < 1.5) recomendaciones.push('Mejorar liquidez: acelerar cobros a clientes y reducir inventarios innecesarios.');
  if (mn < 0.05) recomendaciones.push('Aumentar rentabilidad: optimizar costos y revisar precios de venta.');
  if (endeudamiento > 0.7) recomendaciones.push('Reducir endeudamiento: generar utilidades retenidas o amortizar pasivos.');
  if (ciclo > 90) recomendaciones.push('Optimizar ciclo operativo: mejorar gestión de inventarios y acelerar cobros.');
  if (recomendaciones.length === 0) recomendaciones.push('Mantener las buenas prácticas actuales y continuar monitoreando indicadores.');

  const ratioEstado = (valor, optimo) => {
    if (valor == null) return 'OPTIMO';
    return (valor >= optimo ? 'OPTIMO' : valor >= optimo * 0.7 ? 'ACEPTABLE' : valor >= optimo * 0.4 ? 'PREOCUPANTE' : 'CRITICO');
  };

  const ratiosCriticos = [
    { nombre: 'Liquidez Corriente', valor: lc, rangoOptimo: '> 1.5', estado: lc != null ? ratioEstado(lc, 1.5) : 'OPTIMO' },
    { nombre: 'Margen Neto', valor: mn, rangoOptimo: '> 10%', estado: ratioEstado(mn, 0.1) },
    { nombre: 'Endeudamiento', valor: endeudamiento, rangoOptimo: '< 60%', estado: endeudamiento <= 0.6 ? 'OPTIMO' : endeudamiento <= 0.7 ? 'ACEPTABLE' : endeudamiento <= 0.8 ? 'PREOCUPANTE' : 'CRITICO' },
    { nombre: 'Ciclo Conversión (días)', valor: ciclo, rangoOptimo: '< 60', estado: ciclo <= 60 ? 'OPTIMO' : ciclo <= 90 ? 'ACEPTABLE' : ciclo <= 120 ? 'PREOCUPANTE' : 'CRITICO' }
  ];

  return {
    periodo: ratios.periodo,
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
