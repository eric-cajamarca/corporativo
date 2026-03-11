const vehiculosRepository = require("../repositories/vehiculos.repository");

exports.guardarVehiculoYSoatService = async (pool, idEmpresa, body) => {
  if (!idEmpresa) throw new Error("idEmpresa es obligatorio");
  return vehiculosRepository.guardarVehiculoYSoatRepo(pool, idEmpresa, body);
};

exports.listarVehiculosService = async (pool, idEmpresa) => {
  if (!idEmpresa) throw new Error("idEmpresa es obligatorio");
  return vehiculosRepository.listarVehiculosRepo(pool, idEmpresa);
};

exports.listarVehiculosSoatVencidoService = async (pool, idEmpresa) => {
  if (!idEmpresa) throw new Error("idEmpresa es obligatorio");
  return vehiculosRepository.listarVehiculosSoatVencidoRepo(pool, idEmpresa);
};

exports.eliminarVehiculoService = async (pool, idEmpresa, idVehiculo) => {
  if (!idEmpresa) throw new Error("idEmpresa es obligatorio");
  return vehiculosRepository.eliminarVehiculoRepo(pool, idEmpresa, idVehiculo);
};

