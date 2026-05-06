const ChoferesRepository = require('../repositories/choferes.repository');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');

exports.listarChoferesService = async (pool, user) => {
  if (!user) throw new Error('NO_ACCESS');
  if (!user.empresa) throw new Error('NO_ACCESS');

  await assertAlgunoPermiso(pool, user, 'VER_ENVIOS', 'VER_DESPACHOS', 'CREAR_DESPACHOS', 'EDITAR_DESPACHOS');

  return await ChoferesRepository.listarChoferesRepo(pool, user.empresa);
};

exports.listarUsuariosChoferRolService = async (pool, user) => {
  if (!user) throw new Error('NO_ACCESS');
  if (!user.empresa) throw new Error('NO_ACCESS');
  await assertAlgunoPermiso(pool, user, 'VER_ENVIOS', 'VER_DESPACHOS', 'CREAR_DESPACHOS', 'EDITAR_DESPACHOS');

  return await ChoferesRepository.listarUsuariosChoferRolRepo(pool, user.empresa);
};

exports.crearOActualizarChoferService = async (pool, user, { idUsuarioChofer, idVehiculo }) => {
  if (!user) throw new Error('NO_ACCESS');
  if (!user.empresa) throw new Error('NO_ACCESS');
  await assertAlgunoPermiso(pool, user, 'VER_ENVIOS', 'CREAR_DESPACHOS', 'EDITAR_DESPACHOS');

  // Validar que el usuario existe y pertenece a la empresa.
  const usuarioValido = await ChoferesRepository.validarUsuarioChoferEmpresaRepo(pool, user.empresa, idUsuarioChofer);
  if (!usuarioValido) throw new Error('USUARIO_CHOFER_NO_ENCONTRADO');

  // Validar que el vehículo (si existe) pertenece a la empresa
  if (idVehiculo) {
    const vehiculoValido = await ChoferesRepository.validarVehiculoEmpresaRepo(pool, user.empresa, idVehiculo);
    if (!vehiculoValido) throw new Error('VEHICULO_NO_ENCONTRADO');
  }

  return await ChoferesRepository.crearOActualizarChoferRepo(pool, user.empresa, idUsuarioChofer, idVehiculo);
};

