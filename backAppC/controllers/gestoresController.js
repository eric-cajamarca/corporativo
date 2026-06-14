// NUNCA pongas lógica de negocio en controllers (regla 1.1)
const { withPool } = require('../utils/dbPool.util');
const gestoresService = require('../services/gestores.service');

function esErrorPermisoGestores(msg) {
  return msg === 'PERMISO_DENEGADO' || msg === 'NO_PERMISSIONS';
}

/**
 * Obtiene las empresas gestionadas
 */
const obtener_empresas_gestionadas = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            gestoresService.obtenerEmpresasGestionadas(pool, req.user)
        );

        res.status(200).json({
            message: 'Empresas gestionadas obtenidas correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en obtener_empresas_gestionadas:', error.message);

        if (esErrorPermisoGestores(error.message)) {
            return res.status(403).json({
                message: 'No tiene permisos para realizar esta acción',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al obtener empresas gestionadas',
            data: undefined
        });
    }
};

/**
 * Obtiene todos los gestores
 */
const obtener_todos_gestores = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            gestoresService.obtenerTodosGestores(pool, req.user)
        );

        res.status(200).json({
            message: 'Gestores obtenidos correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en obtener_todos_gestores:', error.message);
        if (esErrorPermisoGestores(error.message)) {
            return res.status(403).json({
                message: 'No tiene permisos para realizar esta acción',
                data: undefined
            });
        }
        res.status(500).json({
            message: 'Error al obtener gestores',
            data: undefined
        });
    }
};

/**
 * Busca una empresa por RUC
 */
const buscar_empresa_ruc = async function (req, res) {
    const { ruc } = req.params;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            gestoresService.buscarEmpresaPorRuc(pool, ruc, req.user)
        );

        res.status(200).json({
            message: 'Empresa encontrada',
            data: resultado
        });

    } catch (error) {
        console.error('Error en buscar_empresa_ruc:', error.message);

        if (error.message === 'RUC_INVALIDO') {
            return res.status(400).json({
                message: 'El RUC debe tener 11 dígitos',
                data: undefined
            });
        }

        if (error.message === 'EMPRESA_NO_ENCONTRADA') {
            return res.status(404).json({
                message: 'No se encontró una empresa con ese RUC',
                data: undefined
            });
        }

        if (error.message === 'NO_PUEDE_GESTIONARSE_A_SI_MISMO') {
            return res.status(400).json({
                message: 'No puede asignarse a sí mismo como empresa gestionada',
                data: undefined
            });
        }

        if (esErrorPermisoGestores(error.message)) {
            return res.status(403).json({
                message: 'No tiene permisos para realizar esta acción',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al buscar empresa',
            data: undefined
        });
    }
};

/**
 * Asigna una empresa como gestionada
 */
const asignar_empresa_gestionada = async function (req, res) {
    const { idEmpresaDestino } = req.body;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            gestoresService.asignarEmpresaGestionada(pool, idEmpresaDestino, req.user)
        );

        res.status(200).json({
            message: 'Empresa asignada correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en asignar_empresa_gestionada:', error.message);

        if (error.message === 'EMPRESA_DESTINO_REQUERIDA') {
            return res.status(400).json({
                message: 'Debe especificar la empresa a gestionar',
                data: undefined
            });
        }

        if (error.message === 'NO_PUEDE_GESTIONARSE_A_SI_MISMO') {
            return res.status(400).json({
                message: 'No puede asignarse a sí mismo como empresa gestionada',
                data: undefined
            });
        }

        if (error.message === 'RELACION_YA_EXISTE') {
            return res.status(400).json({
                message: 'Esta empresa ya está asignada como gestionada',
                data: undefined
            });
        }

        if (error.message === 'GESTORA_SOLO_PLAN_ENTERPRISE') {
            return res.status(403).json({
                message: 'La empresa gestora multi-empresa solo está disponible en plan Enterprise.',
                data: undefined
            });
        }

        if (esErrorPermisoGestores(error.message)) {
            return res.status(403).json({
                message: 'No tiene permisos para realizar esta acción',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al asignar empresa',
            data: undefined
        });
    }
};

/**
 * Remueve una empresa gestionada
 */
const remover_empresa_gestionada = async function (req, res) {
    const { idGestor } = req.params;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            gestoresService.removerEmpresaGestionada(pool, idGestor, req.user)
        );

        res.status(200).json({
            message: 'Empresa removida correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en remover_empresa_gestionada:', error.message);
        if (esErrorPermisoGestores(error.message)) {
            return res.status(403).json({
                message: 'No tiene permisos para realizar esta acción',
                data: undefined
            });
        }
        res.status(500).json({
            message: 'Error al remover empresa',
            data: undefined
        });
    }
};

/**
 * Activa una empresa gestionada
 */
const activar_empresa_gestionada = async function (req, res) {
    const { idGestor } = req.params;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            gestoresService.activarEmpresaGestionada(pool, idGestor, req.user)
        );

        res.status(200).json({
            message: 'Empresa activada correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en activar_empresa_gestionada:', error.message);
        if (error.message === 'GESTORA_SOLO_PLAN_ENTERPRISE') {
            return res.status(403).json({
                message: 'La empresa gestora multi-empresa solo está disponible en plan Enterprise.',
                data: undefined
            });
        }
        if (esErrorPermisoGestores(error.message)) {
            return res.status(403).json({
                message: 'No tiene permisos para realizar esta acción',
                data: undefined
            });
        }
        res.status(500).json({
            message: 'Error al activar empresa',
            data: undefined
        });
    }
};

/**
 * Elimina permanentemente una empresa gestionada
 */
const eliminar_empresa_gestionada = async function (req, res) {
    const { idGestor } = req.params;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            gestoresService.eliminarEmpresaGestionada(pool, idGestor, req.user)
        );

        res.status(200).json({
            message: 'Empresa eliminada permanentemente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en eliminar_empresa_gestionada:', error.message);
        if (esErrorPermisoGestores(error.message)) {
            return res.status(403).json({
                message: 'No tiene permisos para realizar esta acción',
                data: undefined
            });
        }
        res.status(500).json({
            message: 'Error al eliminar empresa',
            data: undefined
        });
    }
};

/**
 * Obtiene la configuración de la empresa
 */
const obtener_configuracion = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            gestoresService.obtenerConfiguracion(pool, req.user)
        );

        res.status(200).json({
            message: 'Configuración obtenida correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en obtener_configuracion:', error.message);
        res.status(500).json({
            message: 'Error al obtener configuración',
            data: undefined
        });
    }
};

const obtener_permisos_configuracion_sistema = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }
        const resultado = await withPool(async (pool) =>
            gestoresService.obtenerPermisosConfiguracionSistema(pool, req.user)
        );
        res.status(200).json({
            message: 'Permisos obtenidos correctamente',
            data: resultado
        });
    } catch (error) {
        console.error('Error en obtener_permisos_configuracion_sistema:', error.message);
        res.status(500).json({
            message: 'Error al obtener permisos de configuración de sistema',
            data: undefined
        });
    }
};

/**
 * Guarda la configuración de la empresa
 */
const guardar_configuracion = async function (req, res) {
    const { configuraciones } = req.body;

    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            gestoresService.guardarConfiguracion(pool, configuraciones, req.user)
        );

        res.status(200).json({
            message: 'Configuración guardada correctamente',
            data: resultado
        });

    } catch (error) {
        console.error('Error en guardar_configuracion:', error.message);

        if (error.message === 'CONFIGURACIONES_INVALIDAS') {
            return res.status(400).json({
                message: 'Las configuraciones deben ser un array',
                data: undefined
            });
        }
        if (error.message === 'NO_AUTORIZADO_CONFIG_SISTEMA') {
            return res.status(403).json({
                message: 'Solo superAdmin de la empresa principal puede editar esta configuración.',
                data: undefined
            });
        }
        if (esErrorPermisoGestores(error.message)) {
            return res.status(403).json({
                message: 'No tiene permiso para guardar la configuración (se requiere permiso de configuración o rol administrador/superAdmin).',
                data: undefined
            });
        }

        res.status(500).json({
            message: 'Error al guardar configuración',
            data: undefined
        });
    }
};

const ejecutar_backup_ahora = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }
        const overrides = req.body && typeof req.body === 'object' ? req.body : {};
        const resultado = await withPool(async (pool) =>
            gestoresService.ejecutarBackupAhora(pool, req.user, overrides)
        );
        res.status(200).json({
            message: resultado.mensaje || 'Backup ejecutado correctamente',
            data: resultado
        });
    } catch (error) {
        console.error('Error en ejecutar_backup_ahora:', error.message);
        if (error.message === 'NO_AUTORIZADO_CONFIG_SISTEMA') {
            return res.status(403).json({
                message: 'Solo superAdmin de la empresa principal puede ejecutar backups.',
                data: undefined
            });
        }
        if (error.message === 'BACKUP_SOLO_WINDOWS') {
            return res.status(400).json({
                message: 'El backup manual solo puede ejecutarse en el servidor Windows donde corre SQL Server.',
                data: undefined
            });
        }
        if (error.message === 'BACKUP_RUTA_LOCAL_REQUERIDA') {
            return res.status(400).json({
                message: 'Configure la ruta local del respaldo antes de ejecutar el backup.',
                data: undefined
            });
        }
        if (error.message === 'BACKUP_TIMEOUT') {
            return res.status(504).json({
                message: 'El backup excedió el tiempo máximo de espera. Revise el servidor SQL.',
                data: undefined
            });
        }
        const detail = String(error.message || '').trim();
        res.status(500).json({
            message: detail
                ? `Error al ejecutar backup: ${detail.slice(0, 500)}`
                : 'Error al ejecutar backup',
            data: undefined
        });
    }
};

const obtener_descuento_venta_por_empresas = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(403).json({ message: 'No Access', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            gestoresService.obtenerDescuentoVentaPorEmpresas(pool, req.user)
        );

        res.status(200).json({
            message: 'Configuración de descuento por empresa obtenida correctamente',
            data: resultado
        });
    } catch (error) {
        console.error('Error en obtener_descuento_venta_por_empresas:', error.message);
        res.status(500).json({
            message: 'Error al obtener configuración de descuento por empresa',
            data: undefined
        });
    }
};

module.exports = {
    obtener_empresas_gestionadas,
    obtener_todos_gestores,
    buscar_empresa_ruc,
    asignar_empresa_gestionada,
    remover_empresa_gestionada,
    activar_empresa_gestionada,
    eliminar_empresa_gestionada,
    obtener_configuracion,
    obtener_permisos_configuracion_sistema,
    guardar_configuracion,
    ejecutar_backup_ahora,
    obtener_descuento_venta_por_empresas
};
