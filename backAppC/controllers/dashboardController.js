const { withPool } = require("../utils/dbPool.util");
const DashboardServices = require("../services/dashboard.service");

const obtenerResumenDashboard = async (req, res) => {
  try {
    const { periodo, fechaReferencia } = req.query;
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(403).send({
        message: "No autorizado: falta empresa",
        data: undefined
      });
    }
    const data = await withPool(async (pool) =>
      DashboardServices.obtenerResumenDashboardService(pool, req.user, periodo || "Hoy", fechaReferencia)
    );
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener resumen dashboard:", error);
    res.status(500).send({
      message: "Error al obtener el resumen del dashboard",
      data: undefined
    });
  }
};

const obtenerResumenConsolidadoGestora = async (req, res) => {
  try {
    const { periodo, fechaReferencia } = req.query;
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(403).send({
        message: "No autorizado: falta empresa",
        data: undefined
      });
    }
    const data = await withPool(async (pool) =>
      DashboardServices.obtenerResumenConsolidadoGestoraService(pool, req.user, periodo || "Este Mes", fechaReferencia)
    );
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_ES_GESTORA") {
      return res.status(403).send({
        message: "Solo disponible para empresa gestora",
        data: undefined
      });
    }
    console.error("Error obtener resumen consolidado dashboard:", error);
    res.status(500).send({
      message: "Error al obtener el resumen consolidado",
      data: undefined
    });
  }
};

const obtenerResumenDiario = async (req, res) => {
  try {
    const { fechaReferencia } = req.query;
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(403).send({
        message: "No autorizado: falta empresa",
        data: undefined
      });
    }
    const data = await withPool(async (pool) =>
      DashboardServices.obtenerResumenDiarioService(pool, req.user, fechaReferencia)
    );
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener resumen diario:", error);
    res.status(500).send({
      message: "Error al obtener el resumen diario",
      data: undefined
    });
  }
};

module.exports = {
  obtenerResumenDashboard,
  obtenerResumenConsolidadoGestora,
  obtenerResumenDiario
};
