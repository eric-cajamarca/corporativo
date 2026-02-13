const sql = require('mssql');
const dbConfig = require('../dbconfig');

/**
 * Lista todos los impuestos de la empresa.
 * @param {string} idEmpresa - UUID de la empresa (req.user.empresa)
 * @returns {Promise<Array>}
 */
async function listarPorEmpresa(idEmpresa) {
    const pool = await sql.connect(dbConfig);
    const result = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT
                idImpuesto,
                idEmpresa,
                descripcion,
                estado,
                CONVERT(DECIMAL(5,2), porcentaje) AS porcentaje,
                pIncluyeIGV,
                CONVERT(VARCHAR(19), fCreacion, 120) AS fCreacion
            FROM Impuestos
            WHERE idEmpresa = @idEmpresa
            ORDER BY descripcion
        `);
    return result.recordset;
}

/**
 * Obtiene un impuesto por id e idEmpresa.
 * @param {number} idImpuesto
 * @param {string} idEmpresa
 * @returns {Promise<object|null>}
 */
async function obtenerPorId(idImpuesto, idEmpresa) {
    const pool = await sql.connect(dbConfig);
    const result = await pool
        .request()
        .input('idImpuesto', sql.Int, idImpuesto)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT
                idImpuesto,
                idEmpresa,
                descripcion,
                estado,
                CONVERT(DECIMAL(5,2), porcentaje) AS porcentaje,
                pIncluyeIGV,
                CONVERT(VARCHAR(19), fCreacion, 120) AS fCreacion
            FROM Impuestos
            WHERE idImpuesto = @idImpuesto AND idEmpresa = @idEmpresa
        `);
    return result.recordset && result.recordset[0] ? result.recordset[0] : null;
}

/**
 * Crea un impuesto para la empresa.
 * @param {string} idEmpresa
 * @param {object} data - { descripcion, estado, porcentaje, pIncluyeIGV }
 * @returns {Promise<object>}
 */
async function crear(idEmpresa, data) {
    const { descripcion, estado, porcentaje, pIncluyeIGV } = data;
    const pool = await sql.connect(dbConfig);
    const result = await pool
        .request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('descripcion', sql.VarChar(50), descripcion)
        .input('estado', sql.Bit, estado ? 1 : 0)
        .input('porcentaje', sql.Decimal(5, 2), porcentaje)
        .input('pIncluyeIGV', sql.Bit, pIncluyeIGV ? 1 : 0)
        .query(`
            INSERT INTO Impuestos (idEmpresa, descripcion, estado, porcentaje, pIncluyeIGV)
            VALUES (@idEmpresa, @descripcion, @estado, @porcentaje, @pIncluyeIGV);
            SELECT SCOPE_IDENTITY() AS idImpuesto;
        `);
    return result.recordset && result.recordset[0] ? result.recordset[0] : null;
}

/**
 * Actualiza un impuesto (descripcion, estado, porcentaje, pIncluyeIGV).
 * @param {number} idImpuesto
 * @param {string} idEmpresa
 * @param {object} data
 * @returns {Promise<number>} rowsAffected
 */
async function actualizar(idImpuesto, idEmpresa, data) {
    const { descripcion, estado, porcentaje, pIncluyeIGV } = data;
    const pool = await sql.connect(dbConfig);
    const result = await pool
        .request()
        .input('idImpuesto', sql.Int, idImpuesto)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('descripcion', sql.VarChar(50), descripcion)
        .input('estado', sql.Bit, estado ? 1 : 0)
        .input('porcentaje', sql.Decimal(5, 2), porcentaje)
        .input('pIncluyeIGV', sql.Bit, pIncluyeIGV ? 1 : 0)
        .query(`
            UPDATE Impuestos
            SET descripcion = @descripcion, estado = @estado, porcentaje = @porcentaje, pIncluyeIGV = @pIncluyeIGV
            WHERE idImpuesto = @idImpuesto AND idEmpresa = @idEmpresa
        `);
    return result.rowsAffected[0];
}

/**
 * Actualiza solo el estado de un impuesto.
 * @param {number} idImpuesto
 * @param {string} idEmpresa
 * @param {boolean} estado
 * @returns {Promise<number>} rowsAffected
 */
async function actualizarEstado(idImpuesto, idEmpresa, estado) {
    const pool = await sql.connect(dbConfig);
    const result = await pool
        .request()
        .input('idImpuesto', sql.Int, idImpuesto)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('estado', sql.Bit, estado ? 1 : 0)
        .query(`
            UPDATE Impuestos
            SET estado = @estado
            WHERE idImpuesto = @idImpuesto AND idEmpresa = @idEmpresa
        `);
    return result.rowsAffected[0];
}

module.exports = {
    listarPorEmpresa,
    obtenerPorId,
    crear,
    actualizar,
    actualizarEstado
};
