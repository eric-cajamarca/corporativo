const { withPool } = require("../utils/dbPool.util");
const vehiculosService = require("../services/vehiculos.service");

const guardarVehiculoYSoat = async (req, res) => {
  try {
    const idEmpresa = req.user?.empresa;
    if (!idEmpresa) {
      return res.status(401).json({ message: "No autorizado: falta empresa en token" });
    }
    const { vehiculo, soat } = req.body || {};
    const result = await withPool(async (pool) =>
      vehiculosService.guardarVehiculoYSoatService(pool, idEmpresa, { vehiculo, soat })
    );
    return res.status(200).json({ message: "Vehículo y SOAT guardados", data: result });
  } catch (err) {
    console.error("vehiculosController.guardarVehiculoYSoat:", err?.message || err);
    return res.status(err?.message?.includes("Placa es obligatoria") ? 400 : 500).json({
      message: err?.message || "Error al guardar vehículo y SOAT"
    });
  }
};

const listarVehiculos = async (req, res) => {
  try {
    if (!req.user?.empresa) {
      return res.status(401).json({ message: "No autorizado: falta empresa en token" });
    }
    const consolidado = String(req.query.alcance || "").toLowerCase() === "gestora";
    const idEmpresaQ =
      req.query.idEmpresa != null && String(req.query.idEmpresa).trim() !== ""
        ? String(req.query.idEmpresa).trim()
        : null;
    if (consolidado && idEmpresaQ) {
      return res.status(400).json({ message: "No use idEmpresa junto con alcance=gestora" });
    }
    const list = await withPool(async (pool) =>
      vehiculosService.listarVehiculosService(pool, req.user, {
        consolidadoGestora: consolidado,
        idEmpresa: idEmpresaQ
      })
    );
    return res.status(200).json({ data: list });
  } catch (err) {
    if (err.message === "NO_ACCESS") return res.status(401).json({ message: "No autorizado" });
    if (err.message === "NO_PERMISSIONS") return res.status(403).json({ message: "No tiene permisos" });
    if (err.message === "NO_ES_GESTORA") {
      return res.status(403).json({ message: "Solo empresas gestoras activas pueden listar de forma consolidada" });
    }
    console.error("vehiculosController.listarVehiculos:", err?.message || err);
    return res.status(500).json({ message: err?.message || "Error al listar vehículos" });
  }
};

const listarVehiculosSoatVencido = async (req, res) => {
  try {
    const idEmpresa = req.user?.empresa;
    if (!idEmpresa) {
      return res.status(401).json({ message: "No autorizado: falta empresa en token" });
    }
    const list = await withPool(async (pool) =>
      vehiculosService.listarVehiculosSoatVencidoService(pool, idEmpresa)
    );
    return res.status(200).json({ data: list });
  } catch (err) {
    console.error("vehiculosController.listarVehiculosSoatVencido:", err?.message || err);
    return res.status(500).json({ message: err?.message || "Error al listar vehículos con SOAT vencido" });
  }
};

const eliminarVehiculo = async (req, res) => {
  try {
    const idEmpresa = req.user?.empresa;
    const { idVehiculo } = req.params;
    if (!idEmpresa) {
      return res.status(401).json({ message: "No autorizado: falta empresa en token" });
    }
    if (!idVehiculo) {
      return res.status(400).json({ message: "idVehiculo es obligatorio" });
    }
    const ok = await withPool(async (pool) => vehiculosService.eliminarVehiculoService(pool, idEmpresa, idVehiculo));
    if (!ok) {
      return res.status(404).json({ message: "Vehículo no encontrado" });
    }
    return res.status(200).json({ message: "Vehículo eliminado" });
  } catch (err) {
    console.error("vehiculosController.eliminarVehiculo:", err?.message || err);
    return res.status(500).json({ message: err?.message || "Error al eliminar vehículo" });
  }
};

module.exports = {
  guardarVehiculoYSoat,
  listarVehiculos,
  listarVehiculosSoatVencido,
  eliminarVehiculo
};
