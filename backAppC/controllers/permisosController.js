// NUNCA pongas lógica de negocio en controllers (regla 1.1)
const sql = require('mssql');
const dbConfig = require('../dbconfig');
const permisosService = require('../services/permisos.service');

/**
 * Obtiene los permisos del usuario autenticado
 */
const obtener_permisos_usuario = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const pool = await sql.connect(dbConfig);
        const resultado = await permisosService.obtenerPermisosUsuario(pool, req.user);

        res.status(200).json({
            message: 'Permisos obtenidos correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en obtener_permisos_usuario:', error.message);

        if (error.message === 'USUARIO_NO_VALIDO') {
            return res.status(403).json({
                message: 'Usuario no válido',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al obtener permisos',
            data: undefined
        });
    }
};

/**
 * Obtiene todos los permisos de la empresa
 */
const obtener_permisos_empresa = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const pool = await sql.connect(dbConfig);
        const resultado = await permisosService.obtenerPermisosEmpresa(pool, req.user);

        res.status(200).json({
            message: 'Permisos de empresa obtenidos correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en obtener_permisos_empresa:', error.message);

        if (error.message === 'PERMISO_DENEGADO') {
            return res.status(403).json({
                message: 'No tiene permisos para realizar esta acción',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al obtener permisos de empresa',
            data: undefined
        });
    }
};

/**
 * Obtiene los permisos de un rol específico
 */
const obtener_permisos_rol = async function (req, res) {
    const { idRol } = req.params;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const pool = await sql.connect(dbConfig);
        const resultado = await permisosService.obtenerPermisosRol(pool, idRol, req.user);

        res.status(200).json({
            message: 'Permisos del rol obtenidos correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en obtener_permisos_rol:', error.message);

        if (error.message === 'PERMISO_DENEGADO') {
            return res.status(403).json({
                message: 'No tiene permisos para realizar esta acción',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al obtener permisos del rol',
            data: undefined
        });
    }
};

/**
 * Crea un nuevo permiso
 */
const crear_permiso = async function (req, res) {
    const { nombre, descripcion, modulo } = req.body;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const pool = await sql.connect(dbConfig);
        const resultado = await permisosService.crearPermiso(pool, nombre, descripcion, modulo, req.user);

        res.status(200).json({
            message: 'Permiso creado correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en crear_permiso:', error.message);

        if (error.message === 'PERMISO_DENEGADO') {
            return res.status(403).json({
                message: 'No tiene permisos para realizar esta acción',
                data: undefined
            });
        }

        if (error.message === 'NOMBRE_REQUERIDO') {
            return res.status(400).json({
                message: 'El nombre del permiso es requerido',
                data: undefined
            });
        }

        if (error.message === 'MODULO_REQUERIDO') {
            return res.status(400).json({
                message: 'El módulo es requerido',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al crear permiso',
            data: undefined
        });
    }
};

/**
 * Actualiza los permisos de un rol
 */
const actualizar_permisos_rol = async function (req, res) {
    const { idRol } = req.params;
    const { permisos } = req.body;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const pool = await sql.connect(dbConfig);
        const resultado = await permisosService.actualizarPermisosRol(pool, idRol, permisos, req.user);

        res.status(200).json({
            message: 'Permisos del rol actualizados correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en actualizar_permisos_rol:', error.message);

        if (error.message === 'PERMISO_DENEGADO') {
            return res.status(403).json({
                message: 'No tiene permisos para realizar esta acción',
                data: undefined
            });
        }

        if (error.message === 'PERMISOS_INVALIDOS') {
            return res.status(400).json({
                message: 'Los permisos proporcionados no son válidos',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al actualizar permisos del rol',
            data: undefined
        });
    }
};

/**
 * Obtiene los módulos disponibles
 */
const obtener_modulos = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const pool = await sql.connect(dbConfig);
        const resultado = await permisosService.obtenerModulos(pool, req.user);

        res.status(200).json({
            message: 'Módulos obtenidos correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en obtener_modulos:', error.message);

        res.status(500).json({
            message: 'Error al obtener módulos',
            data: undefined
        });
    }
};

/**
 * Inicializa los permisos por defecto
 */
const inicializar_permisos = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const pool = await sql.connect(dbConfig);
        const resultado = await permisosService.inicializarPermisos(pool, req.user);

        res.status(200).json({
            message: 'Permisos inicializados correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en inicializar_permisos:', error.message);

        if (error.message === 'PERMISO_DENEGADO') {
            return res.status(403).json({
                message: 'No tiene permisos para realizar esta acción',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al inicializar permisos',
            data: undefined
        });
    }
};

/**
 * Obtiene la navegación del sidebar basada en permisos
 */
const obtener_navegacion_sidebar = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const pool = await sql.connect(dbConfig);
        const resultado = await permisosService.obtenerNavegacionSidebar(pool, req.user);

        res.status(200).json({
            message: 'Navegación obtenida correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en obtener_navegacion_sidebar:', error.message);

        res.status(500).json({
            message: 'Error al obtener navegación',
            data: undefined
        });
    }
};

module.exports = {
    obtener_permisos_usuario,
    obtener_permisos_empresa,
    obtener_permisos_rol,
    crear_permiso,
    actualizar_permisos_rol,
    obtener_modulos,
    inicializar_permisos,
    obtener_navegacion_sidebar
};
