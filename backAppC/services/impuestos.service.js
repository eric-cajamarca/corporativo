const impuestosRepository = require('../repositories/impuestos.repository');

/** Catálogo 05 SUNAT - Código de tipos de tributos y otros conceptos. */
const CODIGOS_SUNAT_CATALOGO_05 = [
    { codigo: '1000', descripcion: 'IGV' },
    { codigo: '1016', descripcion: 'IVAP' },
    { codigo: '2000', descripcion: 'ISC' },
    { codigo: '3000', descripcion: 'IR' },
    { codigo: '7152', descripcion: 'ICBPER' },
    { codigo: '9995', descripcion: 'EXP' },
    { codigo: '9996', descripcion: 'GRA' },
    { codigo: '9997', descripcion: 'EXO' },
    { codigo: '9998', descripcion: 'INA' },
    { codigo: '9999', descripcion: 'OTROS' }
];

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
    const codigoSunat = data.codigoSunat != null ? String(data.codigoSunat).trim() : '';
    if (codigoSunat && !CODIGOS_SUNAT_CATALOGO_05.some(c => c.codigo === codigoSunat)) {
        throw new Error('El código SUNAT no es válido. Use un código del Catálogo 05.');
    }
    const porcentaje = data.porcentaje != null ? Number(data.porcentaje) : 0;
    if (isNaN(porcentaje) || porcentaje < 0) {
        throw new Error('El porcentaje debe ser un número mayor o igual a 0');
    }
    return await impuestosRepository.crear(idEmpresa, {
        descripcion,
        codigoSunat: codigoSunat || null,
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
    const codigoSunat = data.codigoSunat != null ? String(data.codigoSunat).trim() : '';
    if (codigoSunat && !CODIGOS_SUNAT_CATALOGO_05.some(c => c.codigo === codigoSunat)) {
        throw new Error('El código SUNAT no es válido. Use un código del Catálogo 05.');
    }
    const porcentaje = data.porcentaje != null ? Number(data.porcentaje) : 0;
    if (isNaN(porcentaje) || porcentaje < 0) {
        throw new Error('El porcentaje debe ser un número mayor o igual a 0');
    }
    const rows = await impuestosRepository.actualizar(idImpuesto, idEmpresa, {
        descripcion,
        codigoSunat: codigoSunat || null,
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

/**
 * Retorna los códigos del Catálogo 05 SUNAT (tipos de tributos).
 * @returns {Array<{ codigo: string, descripcion: string }>}
 */
function getCodigosSunat() {
    return CODIGOS_SUNAT_CATALOGO_05;
}

module.exports = {
    listar,
    obtenerPorId,
    crear,
    actualizar,
    actualizarEstado,
    getCodigosSunat
};
