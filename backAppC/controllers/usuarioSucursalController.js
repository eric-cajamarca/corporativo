// NUNCA pongas lógica de negocio en controllers (regla 1.1)
const { withPool } = require('../utils/dbPool.util');
const usuarioSucursalService = require('../services/usuarioSucursal.service');

/**
 * Obtiene las sucursales de un usuario específico
 */
const obtener_sucursales_usuario = async function (req, res) {
    const { idUsuario } = req.params;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            usuarioSucursalService.obtenerSucursalesUsuario(pool, idUsuario, req.user)
        );

        res.status(200).json({
            message: 'Sucursales obtenidas correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en obtener_sucursales_usuario:', error.message);

        if (error.message === 'PERMISO_DENEGADO') {
            return res.status(403).json({
                message: 'No tiene permisos para ver las sucursales de este usuario',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al obtener sucursales',
            data: undefined
        });
    }
};

/**
 * Obtiene las sucursales del usuario actual
 */
const obtener_mis_sucursales = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            usuarioSucursalService.obtenerMisSucursales(pool, req.user)
        );

        res.status(200).json({
            message: 'Sucursales obtenidas correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en obtener_mis_sucursales:', error.message);
        res.status(500).json({
            message: 'Error al obtener sucursales',
            data: undefined
        });
    }
};

/**
 * Obtiene los usuarios de una sucursal
 */
const obtener_usuarios_sucursal = async function (req, res) {
    const { idSucursal } = req.params;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            usuarioSucursalService.obtenerUsuariosSucursal(pool, idSucursal, req.user)
        );

        res.status(200).json({
            message: 'Usuarios obtenidos correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en obtener_usuarios_sucursal:', error.message);

        if (error.message === 'PERMISO_DENEGADO') {
            return res.status(403).json({
                message: 'No tiene permisos para esta acción',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al obtener usuarios',
            data: undefined
        });
    }
};

/**
 * Asigna un usuario a una sucursal
 */
const asignar_usuario_sucursal = async function (req, res) {
    const { idUsuario, idSucursal, esDefault } = req.body;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            usuarioSucursalService.asignarUsuarioSucursal(
                pool,
                idUsuario,
                idSucursal,
                esDefault,
                req.user
            )
        );

        res.status(200).json({
            message: 'Usuario asignado correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en asignar_usuario_sucursal:', error.message);

        if (error.message === 'PERMISO_DENEGADO') {
            return res.status(403).json({
                message: 'No tiene permisos para esta acción',
                data: undefined
            });
        }

        if (error.message === 'DATOS_REQUERIDOS') {
            return res.status(400).json({
                message: 'Debe especificar usuario y sucursal',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al asignar usuario',
            data: undefined
        });
    }
};

/**
 * Desasigna un usuario de una sucursal
 */
const desasignar_usuario_sucursal = async function (req, res) {
    const { idUsuarioSucursal } = req.params;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            usuarioSucursalService.desasignarUsuarioSucursal(
                pool,
                idUsuarioSucursal,
                req.user
            )
        );

        res.status(200).json({
            message: 'Usuario desasignado correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en desasignar_usuario_sucursal:', error.message);
        res.status(500).json({
            message: 'Error al desasignar usuario',
            data: undefined
        });
    }
};

/**
 * Establece la sucursal default del usuario actual
 */
const establecer_sucursal_default = async function (req, res) {
    const { idSucursal } = req.body;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            usuarioSucursalService.establecerSucursalDefault(pool, idSucursal, req.user)
        );

        res.status(200).json({
            message: 'Sucursal default establecida correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en establecer_sucursal_default:', error.message);

        if (error.message === 'SIN_ACCESO_SUCURSAL') {
            return res.status(403).json({
                message: 'No tiene acceso a esta sucursal',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al establecer sucursal default',
            data: undefined
        });
    }
};

/**
 * Verifica acceso a una sucursal
 */
const verificar_acceso = async function (req, res) {
    const { idSucursal } = req.params;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const tieneAcceso = await withPool(async (pool) =>
            usuarioSucursalService.verificarAcceso(pool, idSucursal, req.user)
        );

        res.status(200).json({
            message: tieneAcceso ? 'Tiene acceso' : 'Sin acceso',
            data: { tieneAcceso }
        });

    } catch (error) {
        console.error('Error en verificar_acceso:', error.message);
        res.status(500).json({
            message: 'Error al verificar acceso',
            data: undefined
        });
    }
};

/**
 * Obtiene la sucursal default del usuario actual
 */
const obtener_sucursal_default = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            usuarioSucursalService.obtenerSucursalDefault(pool, req.user)
        );

        res.status(200).json({
            message: 'Sucursal default obtenida',
            data: resultado
        });

    } catch (error) {
        console.error('Error en obtener_sucursal_default:', error.message);
        res.status(500).json({
            message: 'Error al obtener sucursal default',
            data: undefined
        });
    }
};

/**
 * Actualiza las asignaciones de un usuario
 */
const actualizar_asignaciones = async function (req, res) {
    const { idUsuario, sucursalesIds } = req.body;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            usuarioSucursalService.actualizarAsignaciones(
                pool,
                idUsuario,
                sucursalesIds,
                req.user
            )
        );

        res.status(200).json({
            message: 'Asignaciones actualizadas correctamente',
            data: { asignaciones: resultado }
        });

    } catch (error) {
        console.error('Error en actualizar_asignaciones:', error.message);

        if (error.message === 'PERMISO_DENEGADO') {
            return res.status(403).json({
                message: 'No tiene permisos para esta acción',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al actualizar asignaciones',
            data: undefined
        });
    }
};

/**
 * Obtiene sucursales con información de asignación
 */
const obtener_sucursales_con_asignacion = async function (req, res) {
    const { idUsuario } = req.params;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            usuarioSucursalService.obtenerSucursalesConAsignacion(
                pool,
                idUsuario,
                req.user
            )
        );

        res.status(200).json({
            message: 'Sucursales obtenidas correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en obtener_sucursales_con_asignacion:', error.message);

        if (error.message === 'PERMISO_DENEGADO') {
            return res.status(403).json({
                message: 'No tiene permisos para esta acción',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al obtener sucursales',
            data: undefined
        });
    }
};

module.exports = {
    obtener_sucursales_usuario,
    obtener_mis_sucursales,
    obtener_usuarios_sucursal,
    asignar_usuario_sucursal,
    desasignar_usuario_sucursal,
    establecer_sucursal_default,
    verificar_acceso,
    obtener_sucursal_default,
    actualizar_asignaciones,
    obtener_sucursales_con_asignacion
};
