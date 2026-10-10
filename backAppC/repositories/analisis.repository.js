const sql = require("mssql");
const AnalisisOperativo = require("./analisisOperativo.repository");

exports.obtenerDashboardEjecutivoRepo = async (pool, idEmpresa, filtros = {}) => {
  try {
    const result = await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT * FROM vw_DashboardFinanciero
        WHERE idEmpresa = @idEmpresa
        ORDER BY periodo DESC
      `);
    const row = result.recordset && result.recordset[0];
    if (row) return [row];
  } catch (err) {
    if (err.number === 208 || /Invalid object name|vw_DashboardFinanciero/.test(String(err.message))) {
      const data = await AnalisisOperativo.obtenerDashboardEjecutivoRepo(pool, idEmpresa, filtros);
      return [data];
    }
    throw err;
  }
  const data = await AnalisisOperativo.obtenerDashboardEjecutivoRepo(pool, idEmpresa, filtros);
  return [data];
};

exports.obtenerBalanceGeneralRepo = async (pool, idEmpresa, filtros = {}) => {
  try {
    let query = "SELECT * FROM vw_BalanceGeneral WHERE idEmpresa = @idEmpresa";
    if (filtros.periodo) query += " AND periodo = @periodo";
    query += " ORDER BY periodo DESC";
    const result = await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .input("periodo", sql.VarChar, filtros.periodo || null)
      .query(query);
    if (result.recordset && result.recordset.length > 0) {
      return result.recordset.map((row) => ({
        periodo: row.periodo,
        inventarioTotal: Number(row.inventarioTotal || 0),
        cuentasPorCobrar: Number(row.cuentasPorCobrar || 0),
        cuentasPorPagar: Number(row.cuentasPorPagar || 0),
        flujoNetoCaja: Number(row.flujoNetoCaja || 0),
        activoCorriente: Number(row.activoCorriente || 0),
        activoFijo: Number(row.activoNoCorriente || row.activoFijo || 0),
        activoTotal: Number(row.totalActivo || row.activoTotal || 0),
        pasivoCorriente: Number(row.pasivoCorriente || 0),
        pasivoLargoPlazo: Number(row.pasivoNoCorriente || row.pasivoLargoPlazo || 0),
        pasivoTotal: Number(row.totalPasivo || row.pasivoTotal || 0),
        patrimonio: Number(row.patrimonio || 0),
        ratioLiquidez: row.ratioLiquidez != null ? Number(row.ratioLiquidez) : 0,
        ratioEndeudamiento: row.ratioEndeudamiento != null ? Number(row.ratioEndeudamiento) : 0
      }));
    }
  } catch (err) {
    if (err.number === 208 || /Invalid object name|vw_BalanceGeneral/.test(String(err.message))) {
      return AnalisisOperativo.obtenerBalanceGeneralRepo(pool, idEmpresa, filtros);
    }
    throw err;
  }
  return AnalisisOperativo.obtenerBalanceGeneralRepo(pool, idEmpresa, filtros);
};

exports.obtenerEstadoResultadosRepo = async (pool, idEmpresa, filtros) => {
  try {
    let query = "SELECT * FROM vw_EstadoResultados WHERE idEmpresa = @idEmpresa";
    if (filtros.periodoInicio) query += " AND periodo >= @periodoInicio";
    if (filtros.periodoFin) query += " AND periodo <= @periodoFin";
    query += " ORDER BY periodo DESC";
    const result = await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .input("periodoInicio", sql.VarChar, filtros.periodoInicio || null)
      .input("periodoFin", sql.VarChar, filtros.periodoFin || null)
      .query(query);
    if (result.recordset && result.recordset.length > 0) {
      return result.recordset.map((r) => ({
        periodo: r.periodo,
        ingresos: Number(r.totalIngresos || r.ingresos || 0),
        costoVentas: Number(r.costoVentas || 0),
        utilidadBruta: Number(r.utilidadBruta != null ? r.utilidadBruta : (r.totalIngresos || r.ingresos || 0) - (r.costoVentas || 0)),
        gastosOperacion: Number(r.gastosAdministracion || 0) + Number(r.gastosVentas || 0),
        utilidadOperacion: Number(r.utilidadOperacional != null ? r.utilidadOperacional : r.utilidadBruta),
        gastosFinancieros: Number(r.gastosFinancieros || 0),
        utilidadAntesImpuestos: Number(r.utilidadNeta != null ? r.utilidadNeta : r.utilidadBruta),
        impuestos: 0,
        utilidadNeta: Number(r.utilidadNeta != null ? r.utilidadNeta : r.utilidadBruta)
      }));
    }
  } catch (err) {
    if (err.number === 208 || /Invalid object name|vw_EstadoResultados/.test(String(err.message))) {
      return AnalisisOperativo.obtenerEstadoResultadosRepo(pool, idEmpresa, filtros);
    }
    throw err;
  }
  return AnalisisOperativo.obtenerEstadoResultadosRepo(pool, idEmpresa, filtros);
};

exports.obtenerRatiosFinancierosRepo = async (pool, idEmpresa, filtros = {}) => {
  return AnalisisOperativo.obtenerRatiosFinancierosRepo(pool, idEmpresa, filtros);
};

exports.obtenerAnalisisRentabilidadRepo = async (pool, idEmpresa, tipo) => {
  let query;

  if (tipo === 'categoria') {
    query = `
      SELECT * FROM vw_RentabilidadCategoria
      WHERE idEmpresa = @idEmpresa
      ORDER BY margenContribucion DESC
    `;
  } else {
    query = `
      SELECT TOP 20 * FROM vw_RentabilidadProducto
      WHERE idEmpresa = @idEmpresa
      ORDER BY margenContribucion DESC
    `;
  }

  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(query);

  return result.recordset;
};

exports.obtenerFlujoCajaRepo = async (pool, idEmpresa, filtros = {}) => {
  return AnalisisOperativo.obtenerFlujoCajaAnalisisRepo(pool, idEmpresa, filtros);
};

exports.obtenerFlujoCajaSerieRepo = async (pool, idEmpresa, filtros = {}) => {
  return AnalisisOperativo.obtenerFlujoCajaSerieMensualRepo(pool, idEmpresa, filtros);
};

exports.obtenerEficienciaOperativaRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT * FROM vw_RatiosRotacion
      WHERE idEmpresa = @idEmpresa
      ORDER BY periodo DESC
    `);

  return result.recordset;
};

exports.obtenerProyeccionVentasRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        'PREDICCIÓN VENTAS' AS tipo,
        AVG(totalIngresos) AS promedioMensual,
        AVG(totalIngresos) * 1.05 AS proyeccionOptimista,
        AVG(totalIngresos) * 0.95 AS proyeccionConservadora,
        CASE
          WHEN AVG(totalIngresos) > LAG(AVG(totalIngresos)) OVER (ORDER BY YEAR(GETDATE()) * 100 + MONTH(GETDATE())) THEN 'CRECIENTE'
          ELSE 'ESTABLE'
        END AS tendencia
      FROM vw_EstadoResultados
      WHERE idEmpresa = @idEmpresa
        AND periodo LIKE '%2025%'
      GROUP BY YEAR(GETDATE()) * 100 + MONTH(GETDATE())
    `);

  return result.recordset[0];
};

exports.obtenerPuntoEquilibrioRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        periodo,
        totalIngresos AS ventasReales,
        costoVentas,
        gastosAdministracion + gastosVentas AS gastosFijos,
        totalIngresos - costoVentas - (gastosAdministracion + gastosVentas) AS utilidadOperativa,
        CASE
          WHEN totalIngresos > 0 AND costoVentas + gastosAdministracion + gastosVentas > 0 THEN
            (gastosAdministracion + gastosVentas) / ((totalIngresos - costoVentas) / totalIngresos)
          ELSE 0
        END AS puntoEquilibrio
      FROM vw_EstadoResultados
      WHERE idEmpresa = @idEmpresa
      ORDER BY periodo DESC
    `);

  return result.recordset;
};

exports.obtenerDiagnosticoFinancieroRepo = async (pool, idEmpresa, filtros = {}) => {
  return AnalisisOperativo.obtenerDiagnosticoFinancieroRepo(pool, idEmpresa, filtros);
};

// Funciones auxiliares para evaluación
function calcularSaludFinanciera(ratios) {
  const { liquidezCorriente = 0, margenNeto = 0, endeudamientoTotal = 0, cicloConversionEfectivo = 0 } = ratios;
  const margenPct = margenNeto <= 1 && margenNeto >= 0 ? margenNeto * 100 : margenNeto;

  let puntuacion = 0;

  if (liquidezCorriente >= 2) puntuacion += 25;
  else if (liquidezCorriente >= 1.5) puntuacion += 20;
  else if (liquidezCorriente >= 1) puntuacion += 10;

  if (margenPct >= 10) puntuacion += 25;
  else if (margenPct >= 5) puntuacion += 15;
  else if (margenPct >= 2) puntuacion += 5;

  if (endeudamientoTotal <= 0.6) puntuacion += 25;
  else if (endeudamientoTotal <= 0.7) puntuacion += 15;
  else if (endeudamientoTotal <= 0.8) puntuacion += 5;

  if (cicloConversionEfectivo <= 60) puntuacion += 25;
  else if (cicloConversionEfectivo <= 90) puntuacion += 15;
  else if (cicloConversionEfectivo <= 120) puntuacion += 5;

  if (puntuacion >= 80) return "EXCELENTE";
  if (puntuacion >= 60) return "BUENA";
  if (puntuacion >= 40) return "ACEPTABLE";
  return "REQUIERE ATENCIÓN";
}

function evaluarLiquidez(liquidezCorriente) {
  if (liquidezCorriente >= 2) return "Excelente capacidad de pago";
  if (liquidezCorriente >= 1.5) return "Buena liquidez";
  if (liquidezCorriente >= 1) return "Liquidez aceptable";
  return "Riesgo de insolvencia - mejorar cobros o reducir inventarios";
}

function evaluarRentabilidad(margenNeto, roe) {
  if (margenNeto >= 10 && roe >= 15) return "Rentabilidad excelente";
  if (margenNeto >= 5 && roe >= 10) return "Buena rentabilidad";
  if (margenNeto >= 2 && roe >= 5) return "Rentabilidad aceptable";
  return "Rentabilidad insuficiente - revisar precios y costos";
}

function evaluarEndeudamiento(endeudamientoTotal) {
  if (endeudamientoTotal <= 0.6) return "Nivel de endeudamiento saludable";
  if (endeudamientoTotal <= 0.7) return "Endeudamiento moderado";
  if (endeudamientoTotal <= 0.8) return "Alto endeudamiento - monitorear capacidad de pago";
  return "Endeudamiento excesivo - reducir deuda o mejorar rentabilidad";
}

function evaluarEficiencia(cicloConversion) {
  if (cicloConversion <= 60) return "Excelente gestión del capital de trabajo";
  if (cicloConversion <= 90) return "Buena eficiencia operativa";
  if (cicloConversion <= 120) return "Eficiencia aceptable";
  return "Ineficiente - mejorar gestión de inventarios y cobros";
}

function generarRecomendaciones(ratios) {
  const recomendaciones = [];

  if ((ratios.liquidezCorriente || 0) < 1.5) {
    recomendaciones.push("Mejorar liquidez: acelerar cobros a clientes y reducir inventarios innecesarios");
  }

  if ((ratios.margenNeto || 0) < 5) {
    recomendaciones.push("Aumentar rentabilidad: revisar precios de venta y controlar costos operativos");
  }

  if ((ratios.endeudamientoTotal || 0) > 0.7) {
    recomendaciones.push("Reducir endeudamiento: generar más utilidades retenidas o vender activos no productivos");
  }

  if ((ratios.cicloConversionEfectivo || 0) > 90) {
    recomendaciones.push("Optimizar ciclo operativo: mejorar gestión de inventarios y acelerar cobros");
  }

  if (recomendaciones.length === 0) {
    recomendaciones.push("Mantener las buenas prácticas actuales y continuar monitoreando indicadores");
  }

  return recomendaciones;
}