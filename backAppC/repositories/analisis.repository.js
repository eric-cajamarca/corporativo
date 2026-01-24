const sql = require("mssql");

exports.obtenerDashboardEjecutivoRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT * FROM vw_DashboardFinanciero
      WHERE idEmpresa = @idEmpresa
      ORDER BY periodo DESC
    `);

  return result.recordset;
};

exports.obtenerBalanceGeneralRepo = async (pool, idEmpresa, periodo) => {
  let query = "SELECT * FROM vw_BalanceGeneral WHERE idEmpresa = @idEmpresa";

  if (periodo) {
    query += " AND periodo = @periodo";
  }

  query += " ORDER BY periodo DESC";

  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("periodo", sql.VarChar, periodo || null)
    .query(query);

  return result.recordset;
};

exports.obtenerEstadoResultadosRepo = async (pool, idEmpresa, filtros) => {
  let query = "SELECT * FROM vw_EstadoResultados WHERE idEmpresa = @idEmpresa";

  if (filtros.periodoInicio) {
    query += " AND periodo >= @periodoInicio";
  }

  if (filtros.periodoFin) {
    query += " AND periodo <= @periodoFin";
  }

  query += " ORDER BY periodo DESC";

  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("periodoInicio", sql.VarChar, filtros.periodoInicio || null)
    .input("periodoFin", sql.VarChar, filtros.periodoFin || null)
    .query(query);

  return result.recordset;
};

exports.obtenerRatiosFinancierosRepo = async (pool, idEmpresa) => {
  // Obtener tanto ratios de liquidez como rentabilidad
  const liquidezResult = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT * FROM vw_RatiosLiquidez
      WHERE idEmpresa = @idEmpresa
      ORDER BY periodo DESC
    `);

  const rentabilidadResult = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT * FROM vw_RatiosRentabilidad
      WHERE idEmpresa = @idEmpresa
      ORDER BY periodo DESC
    `);

  const rotacionResult = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT * FROM vw_RatiosRotacion
      WHERE idEmpresa = @idEmpresa
      ORDER BY periodo DESC
    `);

  return {
    liquidez: liquidezResult.recordset,
    rentabilidad: rentabilidadResult.recordset,
    rotacion: rotacionResult.recordset
  };
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

exports.obtenerFlujoEfectivoRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT * FROM vw_FlujoEfectivo
      WHERE idEmpresa = @idEmpresa
      ORDER BY periodo DESC
    `);

  return result.recordset;
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

exports.obtenerDiagnosticoFinancieroRepo = async (pool, idEmpresa) => {
  // Obtener el último período disponible
  const ultimoPeriodoResult = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1 periodo
      FROM vw_EstadoResultados
      WHERE idEmpresa = @idEmpresa
      ORDER BY periodo DESC
    `);

  if (ultimoPeriodoResult.recordset.length === 0) {
    return { mensaje: "No hay datos financieros disponibles" };
  }

  const ultimoPeriodo = ultimoPeriodoResult.recordset[0].periodo;

  // Obtener ratios del último período
  const ratiosResult = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("periodo", sql.VarChar, ultimoPeriodo)
    .query(`
      SELECT TOP 1
        rl.liquidezCorriente,
        rl.endeudamientoTotal,
        rr.margenNeto,
        rr.ROE,
        rot.cicloConversionEfectivo
      FROM vw_RatiosLiquidez rl
      LEFT JOIN vw_RatiosRentabilidad rr ON rl.idEmpresa = rr.idEmpresa AND rl.periodo = rr.periodo
      LEFT JOIN vw_RatiosRotacion rot ON rl.idEmpresa = rot.idEmpresa AND rl.periodo = rot.periodo
      WHERE rl.idEmpresa = @idEmpresa AND rl.periodo = @periodo
    `);

  const ratios = ratiosResult.recordset[0] || {};

  // Generar diagnóstico
  const diagnostico = {
    periodoAnalizado: ultimoPeriodo,
    saludFinanciera: calcularSaludFinanciera(ratios),
    liquidez: {
      corriente: ratios.liquidezCorriente || 0,
      evaluacion: evaluarLiquidez(ratios.liquidezCorriente || 0)
    },
    rentabilidad: {
      margenNeto: ratios.margenNeto || 0,
      ROE: ratios.ROE || 0,
      evaluacion: evaluarRentabilidad(ratios.margenNeto || 0, ratios.ROE || 0)
    },
    endeudamiento: {
      total: ratios.endeudamientoTotal || 0,
      evaluacion: evaluarEndeudamiento(ratios.endeudamientoTotal || 0)
    },
    eficiencia: {
      cicloConversion: ratios.cicloConversionEfectivo || 0,
      evaluacion: evaluarEficiencia(ratios.cicloConversionEfectivo || 0)
    },
    recomendaciones: generarRecomendaciones(ratios)
  };

  return diagnostico;
};

// Funciones auxiliares para evaluación
function calcularSaludFinanciera(ratios) {
  const { liquidezCorriente = 0, margenNeto = 0, endeudamientoTotal = 0, cicloConversionEfectivo = 0 } = ratios;

  let puntuacion = 0;

  if (liquidezCorriente >= 2) puntuacion += 25;
  else if (liquidezCorriente >= 1.5) puntuacion += 20;
  else if (liquidezCorriente >= 1) puntuacion += 10;

  if (margenNeto >= 10) puntuacion += 25;
  else if (margenNeto >= 5) puntuacion += 15;
  else if (margenNeto >= 2) puntuacion += 5;

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