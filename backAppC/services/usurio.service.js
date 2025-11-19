// services/usuario.service.js
const usuarioRepository = require('../repositories/usuario.repository');

exports.getAdmin = async (pool, idEmpresa) => {
  // El repository solo ejecuta la query y devuelve datos
  return await usuarioRepository.obtenerUsuariosAdmin(pool, idEmpresa);
};