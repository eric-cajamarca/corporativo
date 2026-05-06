// SIEMPRE valida reglas de negocio aquí (regla 1.3)
const usuarioSucursalRepository = require('../repositories/usuarioSucursal.repository');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');

/**
 * Obtiene las sucursales asignadas a un usuario
 */
const obtenerSucursalesUsuario = async (pool, idUsuario, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    const idSelf = user.sub || user.idUsuario;
    if (String(idUsuario) !== String(idSelf)) {
        await assertAlgunoPermiso(pool, user, 'EDITAR_USUARIOS', 'GESTIONAR_ROLES', 'GESTIONAR_SUCURSALES');
    }

    return await usuarioSucursalRepository.obtenerSucursalesUsuario(pool, idUsuario, user.empresa);
};

/**
 * Obtiene las sucursales activas del usuario actual
 */
const obtenerMisSucursales = async (pool, user) => {
    if (!user || !user.empresa || !user.idUsuario) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    return await usuarioSucursalRepository.obtenerSucursalesActivasUsuario(pool, user.idUsuario, user.empresa);
};

/**
 * Obtiene los usuarios asignados a una sucursal
 */
const obtenerUsuariosSucursal = async (pool, idSucursal, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    await assertAlgunoPermiso(pool, user, 'EDITAR_USUARIOS', 'GESTIONAR_ROLES', 'GESTIONAR_SUCURSALES');

    return await usuarioSucursalRepository.obtenerUsuariosSucursal(pool, idSucursal, user.empresa);
};

/**
 * Asigna un usuario a una sucursal
 */
const asignarUsuarioSucursal = async (pool, idUsuario, idSucursal, esDefault, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    await assertAlgunoPermiso(pool, user, 'EDITAR_USUARIOS', 'GESTIONAR_ROLES', 'GESTIONAR_SUCURSALES');

    if (!idUsuario || !idSucursal) {
        throw new Error('DATOS_REQUERIDOS');
    }

    return await usuarioSucursalRepository.asignarUsuarioSucursal(pool, idUsuario, idSucursal, esDefault);
};

/**
 * Desasigna un usuario de una sucursal
 */
const desasignarUsuarioSucursal = async (pool, idUsuarioSucursal, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    await assertAlgunoPermiso(pool, user, 'EDITAR_USUARIOS', 'GESTIONAR_ROLES', 'GESTIONAR_SUCURSALES');

    return await usuarioSucursalRepository.desasignarUsuarioSucursal(pool, idUsuarioSucursal);
};

/**
 * Establece una sucursal como default
 */
const establecerSucursalDefault = async (pool, idSucursal, user) => {
    if (!user || !user.empresa || !user.idUsuario) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    // Verificar que el usuario tenga acceso a la sucursal
    const tieneAcceso = await usuarioSucursalRepository.verificarAccesoSucursal(
        pool, 
        user.idUsuario, 
        idSucursal
    );

    if (!tieneAcceso) {
        throw new Error('SIN_ACCESO_SUCURSAL');
    }

    return await usuarioSucursalRepository.establecerSucursalDefault(
        pool, 
        user.idUsuario, 
        idSucursal, 
        user.empresa
    );
};

/**
 * Verifica si el usuario tiene acceso a una sucursal
 */
const verificarAcceso = async (pool, idSucursal, user) => {
    if (!user || !user.idUsuario) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    // Admin tiene acceso a todas las sucursales
    if (user.rol === 'Administrador') {
        return true;
    }

    return await usuarioSucursalRepository.verificarAccesoSucursal(pool, user.idUsuario, idSucursal);
};

/**
 * Obtiene la sucursal default del usuario actual
 */
const obtenerSucursalDefault = async (pool, user) => {
    if (!user || !user.empresa || !user.idUsuario) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    return await usuarioSucursalRepository.obtenerSucursalDefault(pool, user.idUsuario, user.empresa);
};

/**
 * Actualiza las sucursales asignadas a un usuario
 */
const actualizarAsignaciones = async (pool, idUsuario, sucursalesIds, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    await assertAlgunoPermiso(pool, user, 'EDITAR_USUARIOS', 'GESTIONAR_ROLES', 'GESTIONAR_SUCURSALES');

    if (!idUsuario || !Array.isArray(sucursalesIds)) {
        throw new Error('DATOS_REQUERIDOS');
    }

    return await usuarioSucursalRepository.actualizarAsignacionesMasivo(
        pool, 
        idUsuario, 
        sucursalesIds, 
        user.empresa
    );
};

/**
 * Obtiene sucursales con información de asignación
 */
const obtenerSucursalesConAsignacion = async (pool, idUsuario, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    await assertAlgunoPermiso(pool, user, 'EDITAR_USUARIOS', 'GESTIONAR_ROLES', 'GESTIONAR_SUCURSALES');

    return await usuarioSucursalRepository.obtenerSucursalesConAsignacion(pool, idUsuario, user.empresa);
};

module.exports = {
    obtenerSucursalesUsuario,
    obtenerMisSucursales,
    obtenerUsuariosSucursal,
    asignarUsuarioSucursal,
    desasignarUsuarioSucursal,
    establecerSucursalDefault,
    verificarAcceso,
    obtenerSucursalDefault,
    actualizarAsignaciones,
    obtenerSucursalesConAsignacion
};
