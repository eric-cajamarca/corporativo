const sql = require("mssql");
const AnalisisOperativo = require("./analisisOperativo.repository");

exports.obtenerDashboardEjecutivoRepo = async (pool, idEmpresa, filtros = {}) => {
  const data = await AnalisisOperativo.obtenerDashboardEjecutivoRepo(pool, idEmpresa, filtros);
  return [data];
};

exports.obtenerBalanceGeneralRepo = async (pool, idEmpresa, filtros = {}) => {
  return AnalisisOperativo.obtenerBalanceGeneralRepo(pool, idEmpresa, filtros);
};

exports.obtenerEstadoResultadosRepo = async (pool, idEmpresa, filtros) => {
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