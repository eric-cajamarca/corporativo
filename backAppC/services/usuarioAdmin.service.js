const moment = require('moment');
const usuarioRepository = require('../repositories/usuario.repository');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');

async function obtenerColaboradorConRol(pool, user, idUsuario) {
  if (!user) throw new Error('NO_PERM');
  await assertAlgunoPermiso(pool, user, 'GESTIONAR_ROLES', 'EDITAR_USUARIOS', 'VER_USUARIOS');
  const rows = await usuarioRepository.obtenerUsuarioConRolPorIdUsuario(pool, idUsuario, user.empresa);
  if (!rows.length) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const row = { ...rows[0] };
  if (row.fregistro) {
    row.fregistro = moment(row.fregistro).format('DD-MM-YYYY');
  }
  return row;
}

async function eliminarUsuarioWebLegacy(pool, id, idEmpresa) {
  const result = await usuarioRepository.eliminarUsuarioWebLegacyPorIdYEmpresa(pool, parseInt(id, 10), idEmpresa);
  if (!result.rowsAffected[0]) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }
}

async function obtenerUsuarioWebLegacyPorId(pool, id) {
  return usuarioRepository.obtenerUsuarioWebLegacyPorId(pool, parseInt(id, 10));
}

async function cambiarEstadoUsuarioWebLegacy(pool, id, data) {
  const nuevoEstado = data.estado ? false : true;
  return usuarioRepository.actualizarEstadoUsuarioWebLegacyPorId(pool, parseInt(id, 10), nuevoEstado);
}

async function eliminarUsuarioWebLegacySinEmpresa(pool, id) {
  return usuarioRepository.eliminarUsuarioWebLegacyPorId(pool, parseInt(id, 10));
}

module.exports = {
  obtenerColaboradorConRol,
  eliminarUsuarioWebLegacy,
  eliminarUsuarioWebLegacySinEmpresa,
  obtenerUsuarioWebLegacyPorId,
  cambiarEstadoUsuarioWebLegacy
};
