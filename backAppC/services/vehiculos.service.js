const vehiculosRepository = require("../repositories/vehiculos.repository");
const gestoresRepository = require("../repositories/gestores.repository");
const { assertAlgunoPermiso } = require("../utils/autorizacionPermisos.util");

async function puedeUsuarioOperarEmpresaVehiculos(pool, user, idEmpresaDestino) {
  if (!user?.empresa || !idEmpresaDestino) return false;
  if (String(user.empresa).toLowerCase() === String(idEmpresaDestino).toLowerCase()) return true;
  return gestoresRepository.verificarGestorGestionaEmpresa(pool, user.empresa, idEmpresaDestino);
}

async function idsEmpresasGestoraMasGestionadas(pool, idEmpresaJwt) {
  const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresaJwt);
  return [...new Set([String(idEmpresaJwt), ...gestionadas.map((g) => String(g.idEmpresa))])];
}

exports.guardarVehiculoYSoatService = async (pool, idEmpresa, body) => {
  if (!idEmpresa) throw new Error("idEmpresa es obligatorio");
  return vehiculosRepository.guardarVehiculoYSoatRepo(pool, idEmpresa, body);
};

/**
 * @param {object} user - JWT (req.user)
 * @param {{ consolidadoGestora?: boolean, idEmpresa?: string | null }} opts
 */
exports.listarVehiculosService = async (pool, user, opts = {}) => {
  if (!user?.empresa) throw new Error("NO_ACCESS");
  const consolidado = !!opts.consolidadoGestora;
  const idEmpresaQ =
    opts.idEmpresa != null && String(opts.idEmpresa).trim() !== "" ? String(opts.idEmpresa).trim() : null;

  if (consolidado) {
    await assertAlgunoPermiso(pool, user, "VER_ENVIOS", "VER_DESPACHOS", "CREAR_DESPACHOS", "EDITAR_DESPACHOS");
    const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
    if (!esGestora) throw new Error("NO_ES_GESTORA");
    const ids = await idsEmpresasGestoraMasGestionadas(pool, user.empresa);
    return vehiculosRepository.listarVehiculosConsolidadoGestoraRepo(pool, ids);
  }

  const idEmpresaEfectiva = idEmpresaQ || String(user.empresa);
  if (idEmpresaQ && idEmpresaQ.toLowerCase() !== String(user.empresa).toLowerCase()) {
    await assertAlgunoPermiso(pool, user, "VER_ENVIOS", "VER_DESPACHOS", "CREAR_DESPACHOS", "EDITAR_DESPACHOS");
  }
  if (!(await puedeUsuarioOperarEmpresaVehiculos(pool, user, idEmpresaEfectiva))) {
    throw new Error("NO_PERMISSIONS");
  }
  return vehiculosRepository.listarVehiculosRepo(pool, idEmpresaEfectiva);
};

exports.listarVehiculosSoatVencidoService = async (pool, idEmpresa) => {
  if (!idEmpresa) throw new Error("idEmpresa es obligatorio");
  return vehiculosRepository.listarVehiculosSoatVencidoRepo(pool, idEmpresa);
};

exports.eliminarVehiculoService = async (pool, idEmpresa, idVehiculo) => {
  if (!idEmpresa) throw new Error("idEmpresa es obligatorio");
  return vehiculosRepository.eliminarVehiculoRepo(pool, idEmpresa, idVehiculo);
};
