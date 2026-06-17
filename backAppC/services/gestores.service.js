// SIEMPRE valida reglas de negocio aquí (regla 1.3)
const { isSaas } = require('../config/deployment.config');
const gestoresRepository = require('../repositories/gestores.repository');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');
const comprobantesRepository = require('../repositories/comprobantes.repository');
const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const suscripcionCatalogoAdminService = require('./suscripcionCatalogoAdmin.service');
const sistemaBackupService = require('./sistemaBackup.service');
const {
    interpretarBooleanoConfig,
    crearLectorConfiguracionEmpresa
} = require('../utils/configBoolean.util');

const CLAVES_CONFIG_SISTEMA_OPERATIVO = new Set([
    'SISTEMA_BACKUP_AUTOMATICO',
    'SISTEMA_BACKUP_FRECUENCIA',
    'SISTEMA_BACKUP_RUTA_LOCAL',
    'SISTEMA_BACKUP_RUTA_SECUNDARIA',
    'SISTEMA_BACKUP_GOOGLE_DRIVE_REMOTE',
    'SISTEMA_BACKUP_RESTORE_SEMANAL',
    'SISTEMA_NOTIFICACIONES_EMAIL',
    'SISTEMA_NOTIFICACIONES_WHATSAPP',
    'SISTEMA_MODO_MANTENIMIENTO',
    'SISTEMA_RETENCION_LOGS_DIAS',
    'SISTEMA_CULQI_CONCILIACION_CSV'
]);

/**
 * Obtiene las empresas gestionadas por la empresa actual
 */
const obtenerEmpresasGestionadas = async (pool, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    await assertAlgunoPermiso(pool, user, 'GESTIONAR_GESTORES');

    return await gestoresRepository.obtenerEmpresasGestionadas(pool, user.empresa);
};

/**
 * Obtiene todos los gestores (activos e inactivos)
 */
const obtenerTodosGestores = async (pool, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    await assertAlgunoPermiso(pool, user, 'GESTIONAR_GESTORES');

    return await gestoresRepository.obtenerGestoresPorEmpresa(pool, user.empresa);
};

/**
 * Busca una empresa por RUC para asignarla como gestionada
 */
const buscarEmpresaPorRuc = async (pool, ruc, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    await assertAlgunoPermiso(pool, user, 'GESTIONAR_GESTORES');

    // Validar RUC
    if (!ruc || ruc.length !== 11) {
        throw new Error('RUC_INVALIDO');
    }

    const empresa = await gestoresRepository.buscarEmpresaPorRuc(pool, ruc);
    
    if (!empresa) {
        throw new Error('EMPRESA_NO_ENCONTRADA');
    }

    // No permitir asignarse a sí mismo
    if (empresa.idEmpresa === user.empresa) {
        throw new Error('NO_PUEDE_GESTIONARSE_A_SI_MISMO');
    }

    // Verificar si ya existe la relación
    const relacionExistente = await gestoresRepository.verificarRelacionGestor(
        pool, 
        user.empresa, 
        empresa.idEmpresa
    );

    return {
        empresa,
        relacionExistente: relacionExistente || null
    };
};

/**
 * Asigna una empresa como gestionada
 */
const asignarEmpresaGestionada = async (pool, idEmpresaDestino, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    await assertAlgunoPermiso(pool, user, 'GESTIONAR_GESTORES');

    if (isSaas()) {
        const sub = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, user.empresa);
        const pc = String(sub?.planCode || '')
            .trim()
            .toLowerCase();
        if (pc !== 'enterprise') {
            throw new Error('GESTORA_SOLO_PLAN_ENTERPRISE');
        }
    }

    if (!idEmpresaDestino) {
        throw new Error('EMPRESA_DESTINO_REQUERIDA');
    }

    // No permitir asignarse a sí mismo
    if (idEmpresaDestino === user.empresa) {
        throw new Error('NO_PUEDE_GESTIONARSE_A_SI_MISMO');
    }

    // Verificar si ya existe y está activa
    const relacionExistente = await gestoresRepository.verificarRelacionGestor(
        pool, 
        user.empresa, 
        idEmpresaDestino
    );

    if (relacionExistente && relacionExistente.estado) {
        throw new Error('RELACION_YA_EXISTE');
    }

    const resultado = await gestoresRepository.asignarGestor(pool, user.empresa, idEmpresaDestino);
    try {
        await comprobantesRepository.insertarComprobanteVentaAgrupadaSiNoExiste(pool, user.empresa);
    } catch (error) {
        console.error('gestores.service asignarEmpresaGestionada comprobante VA:', error);
        throw new Error('Error al asegurar comprobante Venta Agrupada para la empresa gestora: ' + error.message);
    }
    return resultado;
};

/**
 * Remueve una empresa gestionada (desactiva)
 */
const removerEmpresaGestionada = async (pool, idGestor, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    await assertAlgunoPermiso(pool, user, 'GESTIONAR_GESTORES');

    if (!idGestor) {
        throw new Error('ID_GESTOR_REQUERIDO');
    }

    return await gestoresRepository.removerGestor(pool, idGestor);
};

/**
 * Activa una relación de gestor
 */
const activarEmpresaGestionada = async (pool, idGestor, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    await assertAlgunoPermiso(pool, user, 'GESTIONAR_GESTORES');

    if (isSaas()) {
        const sub = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, user.empresa);
        const pc = String(sub?.planCode || '')
            .trim()
            .toLowerCase();
        if (pc !== 'enterprise') {
            throw new Error('GESTORA_SOLO_PLAN_ENTERPRISE');
        }
    }

    return await gestoresRepository.activarGestor(pool, idGestor);
};

/**
 * Elimina permanentemente una relación de gestor
 */
const eliminarEmpresaGestionada = async (pool, idGestor, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    await assertAlgunoPermiso(pool, user, 'GESTIONAR_GESTORES');

    return await gestoresRepository.eliminarGestor(pool, idGestor);
};

/**
 * Obtiene la configuración de la empresa
 */
const obtenerConfiguracion = async (pool, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    return await gestoresRepository.obtenerConfiguracionEmpresa(pool, user.empresa);
};

const obtenerPermisosConfiguracionSistema = async (pool, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }
    const esEmpresaPrincipal = await suscripcionCatalogoAdminService.usuarioEsEmpresaPrincipal(pool, user);
    const esSuperAdminUsuario = suscripcionCatalogoAdminService.esSuperAdmin(user);
    const puedeEditarSistemaOperativo = await suscripcionCatalogoAdminService.puedeEditarCatalogoPlanes(pool, user);
    /** Pestaña Sistema visible solo para rol superAdmin (operador de plataforma). */
    const mostrarTabSistema = esSuperAdminUsuario;
    return {
        puedeEditarSistemaOperativo,
        mostrarTabSistema,
        esEmpresaPrincipal,
        esSuperAdmin: esSuperAdminUsuario
    };
};

/**
 * Guarda configuración de la empresa
 */
function puedeEditarConfiguracionEmpresa(user) {
    const r = (user?.rol || '').toString();
    return r === 'Administrador' || r === 'superAdmin';
}

const guardarConfiguracion = async (pool, configuraciones, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    const jwtPuede = puedeEditarConfiguracionEmpresa(user);
    if (!jwtPuede) {
        await assertAlgunoPermiso(pool, user, 'EDITAR_CONFIGURACION');
    }

    if (!Array.isArray(configuraciones)) {
        throw new Error('CONFIGURACIONES_INVALIDAS');
    }

    const intentaEditarConfigSistema = configuraciones.some((c) =>
        CLAVES_CONFIG_SISTEMA_OPERATIVO.has(String(c?.clave || '').trim().toUpperCase())
    );
    if (intentaEditarConfigSistema) {
        const autorizado = await suscripcionCatalogoAdminService.puedeEditarCatalogoPlanes(pool, user);
        if (!autorizado) {
            throw new Error('NO_AUTORIZADO_CONFIG_SISTEMA');
        }
    }

    for (const config of configuraciones) {
        await gestoresRepository.guardarConfiguracion(
            pool,
            user.empresa,
            config.clave,
            config.valor,
            config.descripcion || '',
            config.tipoDato || 'STRING'
        );
    }

    return { success: true, count: configuraciones.length };
};

const ejecutarBackupAhora = async (pool, user, overrides) =>
    sistemaBackupService.ejecutarBackupAhora(pool, user, overrides);

async function idsEmpresaJwtYGestionadas(pool, idEmpresaUsuario) {
    const ids = new Set();
    if (idEmpresaUsuario) ids.add(String(idEmpresaUsuario));
    try {
        const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresaUsuario);
        for (const g of gestionadas || []) {
            if (g.idEmpresa) ids.add(String(g.idEmpresa));
        }
    } catch (_) {
        /* solo JWT */
    }
    return Array.from(ids);
}

/**
 * Mapa idEmpresa (minúsculas) → VENTAS_USAR_DESCUENTO_EN_TOTAL para gestora y empresas gestionadas.
 */
const obtenerDescuentoVentaPorEmpresas = async (pool, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    const ids = await idsEmpresaJwtYGestionadas(pool, user.empresa);
    const mapa = {};
    for (const idEmpresa of ids) {
        const configRows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, idEmpresa);
        const getConfig = crearLectorConfiguracionEmpresa(configRows);
        mapa[String(idEmpresa).toLowerCase()] = interpretarBooleanoConfig(
            getConfig('VENTAS_USAR_DESCUENTO_EN_TOTAL', 'true'),
            true
        );
    }
    return mapa;
};

module.exports = {
    obtenerEmpresasGestionadas,
    obtenerTodosGestores,
    buscarEmpresaPorRuc,
    asignarEmpresaGestionada,
    removerEmpresaGestionada,
    activarEmpresaGestionada,
    eliminarEmpresaGestionada,
    obtenerConfiguracion,
    obtenerPermisosConfiguracionSistema,
    guardarConfiguracion,
    ejecutarBackupAhora,
    obtenerDescuentoVentaPorEmpresas
};
