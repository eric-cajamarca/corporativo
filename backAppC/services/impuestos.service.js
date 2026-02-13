const impuestosRepository = require('../repositories/impuestos.repository');

/**
 * Lista impuestos de la empresa.
 * @param {string} idEmpresa
 * @returns {Promise<Array>}
 */
async function listar(idEmpresa) {
    if (!idEmpresa) {
        throw new Error('idEmpresa es requerido');
    }
    return await impuestosRepository.listarPorEmpresa(idEmpresa);
}

/**
 * Obtiene un impuesto por id.
 * @param {number} idImpuesto
 * @param {string} idEmpresa
 * @returns {Promise<object|null>}
 */
async function obtenerPorId(idImpuesto, idEmpresa) {
    if (!idEmpresa) {
        throw new Error('idEmpresa es requerido');
    }
    return await impuestosRepository.obtenerPorId(idImpuesto, idEmpresa);
}

/**
 * Crea un impuesto. Valida descripcion y porcentaje.
 * @param {string} idEmpresa
 * @param {object} data - { descripcion, estado, porcentaje, pIncluyeIGV }
 * @returns {Promise<object>}
 */
async function crear(idEmpresa, data) {
    if (!idEmpresa) {
        throw new Error('idEmpresa es requerido');
    }
    const descripcion = (data.descripcion || '').trim();
    if (!descripcion) {
        throw new Error('La descripción del impuesto es obligatoria');
    }
    const porcentaje = data.porcentaje != null ? Number(data.porcentaje) : 0;
    if (isNaN(porcentaje) || porcentaje < 0) {
        throw new Error('El porcentaje debe ser un número mayor o igual a 0');
    }
    return await impuestosRepository.crear(idEmpresa, {
        descripcion,
        estado: !!data.estado,
        porcentaje,
        pIncluyeIGV: !!data.pIncluyeIGV
    });
}

/**
 * Actualiza un impuesto.
 * @param {number} idImpuesto
 * @param {string} idEmpresa
 * @param {object} data
 * @returns {Promise<number>}
 */
async function actualizar(idImpuesto, idEmpresa, data) {
    if (!idEmpresa) {
        throw new Error('idEmpresa es requerido');
    }
    const descripcion = (data.descripcion || '').trim();
    if (!descripcion) {
        throw new Error('La descripción del impuesto es obligatoria');
    }
    const porcentaje = data.porcentaje != null ? Number(data.porcentaje) : 0;
    if (isNaN(porcentaje) || porcentaje < 0) {
        throw new Error('El porcentaje debe ser un número mayor o igual a 0');
    }
    const rows = await impuestosRepository.actualizar(idImpuesto, idEmpresa, {
        descripcion,
        estado: !!data.estado,
        porcentaje,
        pIncluyeIGV: !!data.pIncluyeIGV
    });
    return rows;
}

/**
 * Actualiza solo el estado de un impuesto.
 * @param {number} idImpuesto
 * @param {string} idEmpresa
 * @param {boolean} estado
 * @returns {Promise<number>}
 */
async function actualizarEstado(idImpuesto, idEmpresa, estado) {
    if (!idEmpresa) {
        throw new Error('idEmpresa es requerido');
    }
    return await impuestosRepository.actualizarEstado(idImpuesto, idEmpresa, !!estado);
}

module.exports = {
    listar,
    obtenerPorId,
    crear,
    actualizar,
    actualizarEstado
};
