// SIEMPRE valida reglas de negocio aquí (regla 1.3)
// NUNCA hagas cálculos de precios/impuestos en repositories
const permisosRepository = require('../repositories/permisos.repository');
const gestoresRepository = require('../repositories/gestores.repository');
const saasPlanAccesoService = require('./saasPlanAcceso.service');
const navegacionDominios = require('../utils/navegacionDominios.util');
const saasPlanAccesoRepository = require('../repositories/saasPlanAcceso.repository');
const saasPlanLimitesService = require('./saasPlanLimites.service');
const { getDeploymentMode } = require('../config/deployment.config');

/** Navegación empresa gestora agrupada por dominios (Fase 1). */
function construirNavegacionEmpresaGestora(esAdmin, permisos, tieneVerEnviosChofer) {
    return navegacionDominios.construirNavegacionGestoraPorDominios({
        esAdmin,
        permisos,
        tieneVerEnviosChofer
    });
}

/**
 * Obtiene los permisos de un usuario
 */
const obtenerPermisosUsuario = async (pool, user) => {
    // SIEMPRE filtra por idEmpresa en TODAS las consultas (regla 1.6)
    if (!user || !user.empresa || !user.sub) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    const permisos = await permisosRepository.obtenerPermisosPorUsuario(
        pool, 
        user.sub, 
        user.empresa
    );

    // Agrupar permisos por módulo para el frontend
    const permisosPorModulo = {};
    permisos.forEach(permiso => {
        if (!permisosPorModulo[permiso.modulo]) {
            permisosPorModulo[permiso.modulo] = [];
        }
        permisosPorModulo[permiso.modulo].push(permiso.nombre);
    });

    const deploymentMode = getDeploymentMode();
    let planCodeEfectivo = null;
    let modulosPlanMenu = [];
    let limitesPlan = null;
    if (deploymentMode === 'saas') {
        try {
            planCodeEfectivo = await saasPlanAccesoService.obtenerPlanCodeActivo(pool, user.empresa);
            modulosPlanMenu = await saasPlanAccesoRepository.listarModulosPorPlan(pool, planCodeEfectivo);
            limitesPlan = await saasPlanLimitesService.obtenerBanderasPlan(pool, user.empresa);
        } catch (err) {
            console.error('contexto: obtenerPermisosUsuario modulos plan SaaS', err.message || err);
            modulosPlanMenu = [];
            limitesPlan = null;
        }
    }

    return {
        permisos: permisos,
        permisosPorModulo: permisosPorModulo,
        listaPermisos: permisos.map(p => p.nombre),
        deploymentMode,
        planCodeEfectivo,
        modulosPlanMenu,
        limitesPlan
    };
};

/**
 * Obtiene todos los permisos de la empresa
 */
const obtenerPermisosEmpresa = async (pool, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    // Solo administradores pueden ver todos los permisos
    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

    return await permisosRepository.obtenerPermisosPorEmpresa(pool, user.empresa);
};

/**
 * Obtiene los permisos de un rol específico
 */
const obtenerPermisosRol = async (pool, idRol, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

    return await permisosRepository.obtenerPermisosPorRol(pool, idRol, user.empresa);
};

/**
 * Crea un nuevo permiso
 */
const crearPermiso = async (pool, nombre, descripcion, modulo, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

    // Validaciones de negocio
    if (!nombre || nombre.trim().length === 0) {
        throw new Error('NOMBRE_REQUERIDO');
    }

    if (!modulo || modulo.trim().length === 0) {
        throw new Error('MODULO_REQUERIDO');
    }

    // Normalizar nombre a mayúsculas
    const nombreNormalizado = nombre.toUpperCase().replace(/\s+/g, '_');

    return await permisosRepository.crearPermiso(
        pool, 
        user.empresa, 
        nombreNormalizado, 
        descripcion, 
        modulo.toUpperCase()
    );
};

/**
 * Actualiza los permisos de un rol
 */
const actualizarPermisosRol = async (pool, idRol, permisosIds, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

    if (!Array.isArray(permisosIds)) {
        throw new Error('PERMISOS_INVALIDOS');
    }

    return await permisosRepository.actualizarPermisosDeRol(pool, idRol, permisosIds);
};

/**
 * Verifica si el usuario tiene un permiso específico
 */
const verificarPermisoUsuario = async (pool, nombrePermiso, user) => {
    if (!user || !user.empresa || !user.sub) {
        return false;
    }

    // El administrador tiene todos los permisos
    if (user.rol === 'Administrador') {
        return true;
    }

    return await permisosRepository.verificarPermiso(
        pool, 
        user.sub, 
        user.empresa, 
        nombrePermiso
    );
};

/**
 * Obtiene los módulos disponibles
 */
const obtenerModulos = async (pool, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    return await permisosRepository.obtenerModulosConPermisos(pool, user.empresa);
};

/**
 * Inicializa los permisos por defecto para la empresa
 */
const inicializarPermisos = async (pool, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

    return await permisosRepository.inicializarPermisosDefecto(pool, user.empresa);
};

/**
 * Obtiene la estructura de navegación del sidebar basada en permisos
 */
const obtenerNavegacionSidebar = async (pool, user) => {
    if (!user || !user.empresa || !user.sub) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    // Obtener permisos del usuario
    const permisosData = await obtenerPermisosUsuario(pool, user);
    const permisos = permisosData.listaPermisos;

    // Si es administrador, tiene acceso a todo
    const esAdmin = user.rol === 'Administrador';
    // Chofer/Conductor: fallback para VER_ENVIOS_CHOFER si no está en permisos (p. ej. rol con otro nombre)
    const rolNorm = (user.rol || '').toString().trim().toUpperCase();
    const esChofer = (rolNorm === 'CHOFER' || rolNorm === 'CONDUCTOR');
    const tieneVerEnviosChofer = permisos.includes('VER_ENVIOS_CHOFER') || esChofer;

    let codigoRubro = null;
    let rubro = null;
    try {
        const sql = require('mssql');
        const rubroRs = await pool
            .request()
            .input('idEmpresa', sql.UniqueIdentifier, user.empresa)
            .query(`
                SELECT LTRIM(RTRIM(ISNULL(r.codigo, ''))) AS codigoRubro,
                       LTRIM(RTRIM(ISNULL(e.rubro, ''))) AS rubro
                FROM Empresas e
                LEFT JOIN Rubros r ON e.idRubro = r.idRubro
                WHERE e.idEmpresa = @idEmpresa
            `);
        const row = rubroRs.recordset && rubroRs.recordset[0];
        if (row) {
            codigoRubro = row.codigoRubro || null;
            rubro = row.rubro || null;
        }
    } catch (err) {
        console.error('obtenerNavegacionSidebar rubro empresa:', err.message);
    }

    let resultado = navegacionDominios.construirNavegacionPorDominios({
        esAdmin,
        permisos,
        permisosData,
        tieneVerEnviosChofer,
        codigoRubro,
        rubro
    });

    const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, user.empresa);
    if (esGestora) {
        resultado = construirNavegacionEmpresaGestora(esAdmin, permisos, tieneVerEnviosChofer);
    }

    try {
        resultado = await saasPlanAccesoService.filtrarNavegacionPorPlan(pool, user.empresa, resultado);
    } catch (err) {
        console.error('obtenerNavegacionSidebar filtrarNavegacionPorPlan:', err.message);
    }

    return resultado;
};

module.exports = {
    obtenerPermisosUsuario,
    obtenerPermisosEmpresa,
    obtenerPermisosRol,
    crearPermiso,
    actualizarPermisosRol,
    verificarPermisoUsuario,
    obtenerModulos,
    inicializarPermisos,
    obtenerNavegacionSidebar
};
