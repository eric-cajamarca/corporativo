const { withPool } = require('../utils/dbPool.util');
const AnalisisServices = require('../services/analisis.service');
const GastosService = require('../services/gastos.service');

// Obtener dashboard ejecutivo
const obtenerDashboardEjecutivo = async (req, res) => {
  try {
    const dashboard = await withPool(async (pool) =>
      AnalisisServices.obtenerDashboardEjecutivoService(pool, req.user)
    );

    res.status(200).send({ data: dashboard });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener dashboard ejecutivo:", error);
    res.status(500).send({
      message: "Error al obtener el dashboard ejecutivo",
      data: undefined
    });
  }
};

// Obtener balance general
const obtenerBalanceGeneral = async (req, res) => {
  try {
    const { periodo } = req.query;

    const balance = await withPool(async (pool) =>
      AnalisisServices.obtenerBalanceGeneralService(pool, req.user, periodo)
    );

    res.status(200).send({ data: balance });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener balance general:", error);
    res.status(500).send({
      message: "Error al obtener el balance general",
      data: undefined
    });
  }
};

// Obtener estado de resultados
const obtenerEstadoResultados = async (req, res) => {
  try {
    const { periodoInicio, periodoFin, fechaDesde, fechaHasta } = req.query;
    const periodoInicioRes = periodoInicio || (fechaDesde ? String(fechaDesde).substring(0, 7) : null);
    const periodoFinRes = periodoFin || (fechaHasta ? String(fechaHasta).substring(0, 7) : null);

    const estadoResultados = await withPool(async (pool) =>
      AnalisisServices.obtenerEstadoResultadosService(pool, req.user, {
        periodoInicio: periodoInicioRes,
        periodoFin: periodoFinRes,
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null
      })
    );

    res.status(200).send({ data: estadoResultados });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener estado de resultados:", error);
    res.status(500).send({
      message: "Error al obtener el estado de resultados",
      data: undefined
    });
  }
};

// Obtener ratios financieros
const obtenerRatiosFinancieros = async (req, res) => {
  try {
    const ratios = await withPool(async (pool) =>
      AnalisisServices.obtenerRatiosFinancierosService(pool, req.user)
    );

    res.status(200).send({ data: ratios });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener ratios financieros:", error);
    res.status(500).send({
      message: "Error al obtener los ratios financieros",
      data: undefined
    });
  }
};

// Obtener an?lisis de rentabilidad
const obtenerAnalisisRentabilidad = async (req, res) => {
  try {
    const { tipo } = req.query; // 'producto', 'categoria'

    const rentabilidad = await withPool(async (pool) =>
      AnalisisServices.obtenerAnalisisRentabilidadService(pool, req.user, tipo)
    );

    res.status(200).send({ data: rentabilidad });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener an?lisis rentabilidad:", error);
    res.status(500).send({
      message: "Error al obtener el an?lisis de rentabilidad",
      data: undefined
    });
  }
};

// Obtener flujo de efectivo
const obtenerFlujoEfectivo = async (req, res) => {
  try {
    const flujo = await withPool(async (pool) =>
      AnalisisServices.obtenerFlujoEfectivoService(pool, req.user)
    );

    res.status(200).send({ data: flujo });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener flujo de efectivo:", error);
    res.status(500).send({
      message: "Error al obtener el flujo de efectivo",
      data: undefined
    });
  }
};

// Obtener an?lisis de eficiencia operativa
const obtenerEficienciaOperativa = async (req, res) => {
  try {
    const eficiencia = await withPool(async (pool) =>
      AnalisisServices.obtenerEficienciaOperativaService(pool, req.user)
    );

    res.status(200).send({ data: eficiencia });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener eficiencia operativa:", error);
    res.status(500).send({
      message: "Error al obtener la eficiencia operativa",
      data: undefined
    });
  }
};

// Obtener proyecci?n de ventas
const obtenerProyeccionVentas = async (req, res) => {
  try {
    const proyeccion = await withPool(async (pool) =>
      AnalisisServices.obtenerProyeccionVentasService(pool, req.user)
    );

    res.status(200).send({ data: proyeccion });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener proyecci?n ventas:", error);
    res.status(500).send({
      message: "Error al obtener la proyecci?n de ventas",
      data: undefined
    });
  }
};

// Obtener an?lisis de punto de equilibrio
const obtenerPuntoEquilibrio = async (req, res) => {
  try {
    const puntoEquilibrio = await withPool(async (pool) =>
      AnalisisServices.obtenerPuntoEquilibrioService(pool, req.user)
    );

    res.status(200).send({ data: puntoEquilibrio });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener punto de equilibrio:", error);
    res.status(500).send({
      message: "Error al obtener el punto de equilibrio",
      data: undefined
    });
  }
};

// Obtener diagn?stico financiero completo
const obtenerDiagnosticoFinanciero = async (req, res) => {
  try {
    const diagnostico = await withPool(async (pool) =>
      AnalisisServices.obtenerDiagnosticoFinancieroService(pool, req.user)
    );

    res.status(200).send({ data: diagnostico });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener diagn?stico financiero:", error);
    res.status(500).send({
      message: "Error al obtener el diagn?stico financiero",
      data: undefined
    });
  }
};

// Gastos (para an?lisis financiero: gastos operativos por per?odo)
const listarGastos = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta } = req.query;
    const list = await withPool(async (pool) =>
      GastosService.listarPorPeriodo(pool, req.user, fechaDesde, fechaHasta)
    );
    res.status(200).send({ data: list });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    console.error('Error listar gastos:', error);
    res.status(500).send({ message: 'Error al listar gastos', data: undefined });
  }
};

const crearGasto = async (req, res) => {
  try {
    const row = await withPool(async (pool) => GastosService.crear(pool, req.user, req.body));
    res.status(201).send({ data: row });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message && error.message.includes('monto')) {
      return res.status(400).send({ message: error.message, data: undefined });
    }
    console.error('Error crear gasto:', error);
    res.status(500).send({ message: 'Error al registrar gasto', data: undefined });
  }
};

const eliminarGasto = async (req, res) => {
  try {
    const { idGasto } = req.params;
    await withPool(async (pool) => GastosService.eliminar(pool, req.user, idGasto));
    res.status(200).send({ message: 'Gasto eliminado' });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    console.error('Error eliminar gasto:', error);
    res.status(500).send({ message: 'Error al eliminar gasto', data: undefined });
  }
};

module.exports = {
  obtenerDashboardEjecutivo,
  obtenerBalanceGeneral,
  obtenerEstadoResultados,
  obtenerRatiosFinancieros,
  obtenerAnalisisRentabilidad,
  obtenerFlujoEfectivo,
  obtenerEficienciaOperativa,
  obtenerProyeccionVentas,
  obtenerPuntoEquilibrio,
  obtenerDiagnosticoFinanciero,
  listarGastos,
  crearGasto,
  eliminarGasto
};
