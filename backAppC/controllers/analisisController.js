const dbConfig = require('../dbconfig');
const sql = require('mssql');
const AnalisisServices = require('../services/analisis.service');
const GastosService = require('../services/gastos.service');

// Obtener dashboard ejecutivo
const obtenerDashboardEjecutivo = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const dashboard = await AnalisisServices.obtenerDashboardEjecutivoService(pool, req.user);

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

    const pool = await sql.connect(dbConfig);
    const balance = await AnalisisServices.obtenerBalanceGeneralService(pool, req.user, periodo);

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

    const pool = await sql.connect(dbConfig);
    const estadoResultados = await AnalisisServices.obtenerEstadoResultadosService(pool, req.user, {
      periodoInicio: periodoInicioRes,
      periodoFin: periodoFinRes,
      fechaDesde: fechaDesde || null,
      fechaHasta: fechaHasta || null
    });

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
    const pool = await sql.connect(dbConfig);
    const ratios = await AnalisisServices.obtenerRatiosFinancierosService(pool, req.user);

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

// Obtener análisis de rentabilidad
const obtenerAnalisisRentabilidad = async (req, res) => {
  try {
    const { tipo } = req.query; // 'producto', 'categoria'

    const pool = await sql.connect(dbConfig);
    const rentabilidad = await AnalisisServices.obtenerAnalisisRentabilidadService(pool, req.user, tipo);

    res.status(200).send({ data: rentabilidad });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener análisis rentabilidad:", error);
    res.status(500).send({
      message: "Error al obtener el análisis de rentabilidad",
      data: undefined
    });
  }
};

// Obtener flujo de efectivo
const obtenerFlujoEfectivo = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const flujo = await AnalisisServices.obtenerFlujoEfectivoService(pool, req.user);

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

// Obtener análisis de eficiencia operativa
const obtenerEficienciaOperativa = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const eficiencia = await AnalisisServices.obtenerEficienciaOperativaService(pool, req.user);

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

// Obtener proyección de ventas
const obtenerProyeccionVentas = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const proyeccion = await AnalisisServices.obtenerProyeccionVentasService(pool, req.user);

    res.status(200).send({ data: proyeccion });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener proyección ventas:", error);
    res.status(500).send({
      message: "Error al obtener la proyección de ventas",
      data: undefined
    });
  }
};

// Obtener análisis de punto de equilibrio
const obtenerPuntoEquilibrio = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const puntoEquilibrio = await AnalisisServices.obtenerPuntoEquilibrioService(pool, req.user);

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

// Obtener diagnóstico financiero completo
const obtenerDiagnosticoFinanciero = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const diagnostico = await AnalisisServices.obtenerDiagnosticoFinancieroService(pool, req.user);

    res.status(200).send({ data: diagnostico });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener diagnóstico financiero:", error);
    res.status(500).send({
      message: "Error al obtener el diagnóstico financiero",
      data: undefined
    });
  }
};

// Gastos (para análisis financiero: gastos operativos por período)
const listarGastos = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta } = req.query;
    const pool = await sql.connect(dbConfig);
    const list = await GastosService.listarPorPeriodo(pool, req.user, fechaDesde, fechaHasta);
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
    const pool = await sql.connect(dbConfig);
    const row = await GastosService.crear(pool, req.user, req.body);
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
    const pool = await sql.connect(dbConfig);
    await GastosService.eliminar(pool, req.user, idGasto);
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