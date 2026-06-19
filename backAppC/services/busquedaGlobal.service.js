const busquedaGlobalRepository = require('../repositories/busquedaGlobal.repository');

exports.buscarGlobal = async (pool, user, q, limit) => {
  if (!user?.empresa) {
    throw new Error('NO_EMPRESA');
  }
  return busquedaGlobalRepository.buscarGlobalRepo(pool, user.empresa, { q, limit });
};
