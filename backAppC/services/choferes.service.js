const ChoferesRepository = require('../repositories/choferes.repository');
const gestoresRepository = require('../repositories/gestores.repository');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');

async function puedeUsuarioOperarEmpresaChoferes(pool, user, idEmpresaDestino) {
  if (!user?.empresa || !idEmpresaDestino) return false;
  if (String(user.empresa).toLowerCase() === String(idEmpresaDestino).toLowerCase()) return true;
  return gestoresRepository.verificarGestorGestionaEmpresa(pool, user.empresa, idEmpresaDestino);
}

async function idsEmpresasGestoraMasGestionadas(pool, idEmpresaJwt) {
  const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresaJwt);
  return [...new Set([String(idEmpresaJwt), ...gestionadas.map((g) => String(g.idEmpresa))])];
}

exports.listarChoferesService = async (pool, user, idEmpresaOpcional, consolidadoGestora) => {
  if (!user) throw new Error('NO_ACCESS');
  if (!user.empresa) throw new Error('NO_ACCESS');

  await assertAlgunoPermiso(pool, user, 'VER_ENVIOS', 'VER_DESPACHOS', 'CREAR_DESPACHOS', 'EDITAR_DESPACHOS');

  if (consolidadoGestora) {
    const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
    if (!esGestora) throw new Error('NO_ES_GESTORA');
    const ids = await idsEmpresasGestoraMasGestionadas(pool, user.empresa);
    return await ChoferesRepository.listarChoferesConsolidadoGestoraRepo(pool, ids);
  }

  const idEmp =
    idEmpresaOpcional != null && String(idEmpresaOpcional).trim() !== ''
      ? String(idEmpresaOpcional).trim()
      : String(user.empresa);
  if (!(await puedeUsuarioOperarEmpresaChoferes(pool, user, idEmp))) {
    throw new Error('NO_PERMISSIONS');
  }

  return await ChoferesRepository.listarChoferesRepo(pool, idEmp);
};

exports.listarUsuariosChoferRolService = async (pool, user, idEmpresaOpcional, consolidadoGestora) => {
  if (!user) throw new Error('NO_ACCESS');
  if (!user.empresa) throw new Error('NO_ACCESS');
  await assertAlgunoPermiso(pool, user, 'VER_ENVIOS', 'VER_DESPACHOS', 'CREAR_DESPACHOS', 'EDITAR_DESPACHOS');

  if (consolidadoGestora) {
    const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
    if (!esGestora) throw new Error('NO_ES_GESTORA');
    const ids = await idsEmpresasGestoraMasGestionadas(pool, user.empresa);
    return await ChoferesRepository.listarUsuariosChoferRolConsolidadoGestoraRepo(pool, ids);
  }

  const idEmp =
    idEmpresaOpcional != null && String(idEmpresaOpcional).trim() !== ''
      ? String(idEmpresaOpcional).trim()
      : String(user.empresa);
  if (!(await puedeUsuarioOperarEmpresaChoferes(pool, user, idEmp))) {
    throw new Error('NO_PERMISSIONS');
  }

  return await ChoferesRepository.listarUsuariosChoferRolRepo(pool, idEmp);
};

exports.crearOActualizarChoferService = async (pool, user, { idUsuarioChofer, idVehiculo, idEmpresa }) => {
  if (!user) throw new Error('NO_ACCESS');
  if (!user.empresa) throw new Error('NO_ACCESS');
  await assertAlgunoPermiso(pool, user, 'VER_ENVIOS', 'CREAR_DESPACHOS', 'EDITAR_DESPACHOS');

  let idEmpresaOperativa = String(user.empresa);
  if (idEmpresa != null && String(idEmpresa).trim() !== '') {
    idEmpresaOperativa = String(idEmpresa).trim();
  }
  if (!(await puedeUsuarioOperarEmpresaChoferes(pool, user, idEmpresaOperativa))) {
    throw new Error('NO_PERMISSIONS');
  }

  const usuarioValido = await ChoferesRepository.validarUsuarioChoferEmpresaRepo(pool, idEmpresaOperativa, idUsuarioChofer);
  if (!usuarioValido) throw new Error('USUARIO_CHOFER_NO_ENCONTRADO');

  if (idVehiculo) {
    const vehiculoValido = await ChoferesRepository.validarVehiculoEmpresaRepo(pool, idEmpresaOperativa, idVehiculo);
    if (!vehiculoValido) throw new Error('VEHICULO_NO_ENCONTRADO');
  }

  return await ChoferesRepository.crearOActualizarChoferRepo(pool, idEmpresaOperativa, idUsuarioChofer, idVehiculo);
};

