// SIEMPRE valida reglas de negocio aquí (regla 1.3)
const gestoresRepository = require('../repositories/gestores.repository');
const comprobantesRepository = require('../repositories/comprobantes.repository');

/**
 * Obtiene las empresas gestionadas por la empresa actual
 */
const obtenerEmpresasGestionadas = async (pool, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    // Solo administradores pueden ver gestores
    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

    return await gestoresRepository.obtenerEmpresasGestionadas(pool, user.empresa);
};

/**
 * Obtiene todos los gestores (activos e inactivos)
 */
const obtenerTodosGestores = async (pool, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

    return await gestoresRepository.obtenerGestoresPorEmpresa(pool, user.empresa);
};

/**
 * Busca una empresa por RUC para asignarla como gestionada
 */
const buscarEmpresaPorRuc = async (pool, ruc, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

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

    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
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

    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

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

    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
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

    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

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

/**
 * Guarda configuración de la empresa
 */
const guardarConfiguracion = async (pool, configuraciones, user) => {
    if (!user || !user.empresa) {
        throw new Error('USUARIO_NO_VALIDO');
    }

    if (user.rol !== 'Administrador') {
        throw new Error('PERMISO_DENEGADO');
    }

    if (!Array.isArray(configuraciones)) {
        throw new Error('CONFIGURACIONES_INVALIDAS');
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

module.exports = {
    obtenerEmpresasGestionadas,
    obtenerTodosGestores,
    buscarEmpresaPorRuc,
    asignarEmpresaGestionada,
    removerEmpresaGestionada,
    activarEmpresaGestionada,
    eliminarEmpresaGestionada,
    obtenerConfiguracion,
    guardarConfiguracion
};
