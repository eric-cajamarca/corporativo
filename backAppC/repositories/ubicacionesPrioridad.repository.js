const sql = require('mssql');
const dbConfig = require('../dbconfig');


async function getAll() {
    const pool = await sql.connect(dbConfig);

    const result = await pool.request().query('SELECT * FROM UbicacionesPrioridad ORDER BY idSucursal, prioridad');
    return result.recordset;
}

async function getBySucursal(idSucursal) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .query('SELECT * FROM UbicacionesPrioridad WHERE idSucursal = @idSucursal ORDER BY prioridad');
    return result.recordset;
}

/**
 * Obtiene la primera ubicación de la sucursal o crea una por defecto (codigo DEF-xxx, prioridad 1).
 * Idempotente ante llamadas paralelas: si otro request ya insertó la misma ubicación, se obtiene por SELECT.
 */
async function getOrCreateDefaultForSucursal(idSucursal) {
    const pool = await sql.connect(dbConfig);
    const codigoUnico = 'DEF-' + String(idSucursal).replace(/-/g, '').substring(0, 8);

    const existing = await pool.request()
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .query('SELECT TOP 1 idUbicacion FROM UbicacionesPrioridad WHERE idSucursal = @idSucursal ORDER BY prioridad');
    if (existing.recordset && existing.recordset.length > 0) {
        return existing.recordset[0].idUbicacion;
    }

    try {
        const insertResult = await pool.request()
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .input('codigoUbicacion', sql.VarChar(20), codigoUnico)
            .input('prioridad', sql.Int, 1)
            .query(`INSERT INTO UbicacionesPrioridad (idSucursal, codigoUbicacion, prioridad)
                    OUTPUT INSERTED.idUbicacion
                    VALUES (@idSucursal, @codigoUbicacion, @prioridad)`);
        return insertResult.recordset && insertResult.recordset[0] ? insertResult.recordset[0].idUbicacion : null;
    } catch (err) {
        const isDuplicateKey = (err && err.number === 2627) || (err && err.originalError && err.originalError.number === 2627);
        if (isDuplicateKey) {
            const again = await pool.request()
                .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                .query('SELECT TOP 1 idUbicacion FROM UbicacionesPrioridad WHERE idSucursal = @idSucursal ORDER BY prioridad');
            if (again.recordset && again.recordset.length > 0) {
                return again.recordset[0].idUbicacion;
            }
        }
        throw err;
    }
}

async function create(ubicacionData) {
    const { idSucursal, codigoUbicacion, prioridad } = ubicacionData;
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .input('codigoUbicacion', sql.VarChar(20), codigoUbicacion)
        .input('prioridad', sql.Int, prioridad)
        .query(`INSERT INTO UbicacionesPrioridad (idSucursal, codigoUbicacion, prioridad)
                OUTPUT INSERTED.idUbicacion, INSERTED.idSucursal, INSERTED.codigoUbicacion, INSERTED.prioridad
                VALUES (@idSucursal, @codigoUbicacion, @prioridad)`);
    return result.recordset && result.recordset[0] ? result.recordset[0] : null;
}

async function update(idUbicacion, ubicacionData) {
    const { codigoUbicacion, prioridad } = ubicacionData;
    const pool = await sql.connect(dbConfig);

 
    const result = await pool.request()
        .input('idUbicacion', sql.Int, idUbicacion)
        .input('codigoUbicacion', sql.VarChar(20), codigoUbicacion)
        .input('prioridad', sql.Int, prioridad)
        .query('UPDATE UbicacionesPrioridad SET codigoUbicacion = @codigoUbicacion, prioridad = @prioridad WHERE idUbicacion = @idUbicacion');
    return result;
}

async function deleted(idUbicacion) {
    const pool = await sql.connect(dbConfig);

    const result = await pool.request()
        .input('idUbicacion', sql.Int, idUbicacion)
        .query('DELETE FROM UbicacionesPrioridad WHERE idUbicacion = @idUbicacion');
    return result;
}

module.exports = {
    getAll,
    getBySucursal,
    getOrCreateDefaultForSucursal,
    create,
    update,
    deleted
};