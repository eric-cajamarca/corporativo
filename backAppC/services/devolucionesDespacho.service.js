const devolucionesDespachoRepository = require('../repositories/devolucionesDespacho.repository');
const despachosRepository = require('../repositories/despachos.repository');

exports.crearDevolucionDespachoService = async (pool, user, payload) => {
  if (!user || !user.empresa || !user.sub) throw new Error('NO_ACCESS');
  if (user.rol !== 'Administrador' && user.rol !== 'Vendedor') throw new Error('NO_PERMISSIONS');

  const { idDespacho, items } = payload;
  if (!idDespacho || !Array.isArray(items) || items.length === 0) {
    throw new Error('DATOS_INVALIDOS');
  }

  const despachoValido = await despachosRepository.validarDespachoEmpresaRepo(pool, idDespacho, user.empresa);
  if (!despachoValido) throw new Error('DESPACHO_NO_ENCONTRADO');

  return await devolucionesDespachoRepository.crearDevolucionDespachoRepo(
    pool,
    user.empresa,
    user.sub,
    payload
  );
};

exports.listarDevolucionesPorDespachoService = async (pool, user, idDespacho) => {
  if (!user || !user.empresa) throw new Error('NO_ACCESS');
  return await devolucionesDespachoRepository.listarDevolucionesPorDespachoRepo(pool, user.empresa, idDespacho);
};

exports.obtenerDetalleDevolucionService = async (pool, user, idDevolucionDespacho) => {
  if (!user || !user.empresa) throw new Error('NO_ACCESS');
  return await devolucionesDespachoRepository.obtenerDetalleDevolucionRepo(pool, user.empresa, idDevolucionDespacho);
};
