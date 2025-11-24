const rolRepository = require('../repositories/rol.repository');
const { v4: uuidv4 } = require('uuid');

/**
 * Valida si el usuario es administrador
 */
function validarAdmin(usuario) {
  if (!usuario || usuario.rol !== 'Administrador') {
    throw new Error('PERMISO_DENEGADO');
  }
}

/**
 * Crea un rol (solo admins)
 */
exports.crearRol = async (pool, descripcion, usuarioAutenticado) => {
  // 1. Validar permisos
  validarAdmin(usuarioAutenticado);

  // 2. Verificar si el rol ya existe
  const rolExiste = await rolRepository.existeRolPorDescripcion(pool, descripcion, usuarioAutenticado.empresa);
  if (rolExiste) {
    throw new Error('ROL_EXISTE');
  }

  // 3. Crear datos del rol
  const datosRol = {
    idRol: uuidv4(),
    descripcion,
    idEmpresa: usuarioAutenticado.empresa
  };

  // 4. Guardar en BD
  const rowsAffected = await rolRepository.crearRol(pool, datosRol);

  return {
    message: 'Rol creado correctamente',
    rowsAffected
  };
}

exports.obtenerRoles = async (pool, usuarioAutenticado) => {
  // 1. Validar permisos
  validarAdmin(usuarioAutenticado);

  // 2. Obtener roles del repository
  const roles = await rolRepository.obtenerRolesPorEmpresa(pool, usuarioAutenticado.empresa);

  // 3. Retornar datos
  return {
    data: roles
  };
}

/**
 * Obtiene un rol por ID (solo admins)
 */
exports.obtenerRolPorId = async (pool,idRol, usuarioAutenticado) => {
  // 1. Validar permisos
//   validarAdmin(usuarioAutenticado);

  // 2. Obtener rol del repository (con filtro de empresa por seguridad)
  const rol = await rolRepository.obtenerRolPorId(pool, idRol, usuarioAutenticado.empresa);

  // 3. Verificar si el rol existe
  if (!rol) {
    throw new Error('ROL_NO_EXISTE');
  }

  return {
    data: rol
  };
}

exports.actualizarRoll = async (pool, )=>{}

/**
 * Actualiza un rol (solo admins)
 */
exports.actualizarRol = async (pool, idRol, descripcion, usuarioAutenticado) => {
  // 1. Validar permisos
//   validarAdmin(usuarioAutenticado);

  // 2. Verificar que no exista OTRO rol con la misma descripción
  const existeOtro = await rolRepository.existeOtroRolConDescripcion(pool, idRol, descripcion, usuarioAutenticado.empresa);
  if (existeOtro) {
    throw new Error('ROL_DUPLICADO');
  }

  // 3. Actualizar el rol
  const rowsAffected = await rolRepository.actualizarRol(pool, idRol, descripcion);

  return {
    message: 'Rol actualizado correctamente',
    rowsAffected
  };
}

