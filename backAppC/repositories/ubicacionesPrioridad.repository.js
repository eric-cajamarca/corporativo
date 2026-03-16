const sql = require('mssql');
const dbConfig = require('../dbconfig');


async function getAll(idEmpresa) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`SELECT up.idUbicacion, up.idSucursal, up.codigoUbicacion, up.prioridad, up.idUbicacionPadre
                FROM UbicacionesPrioridad up
                INNER JOIN Sucursal s ON s.idSucursal = up.idSucursal
                WHERE s.idEmpresa = @idEmpresa
                ORDER BY up.idSucursal, up.prioridad`);
    return result.recordset;
}

async function getBySucursal(idSucursal, idEmpresa) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`SELECT up.idUbicacion, up.idSucursal, up.codigoUbicacion, up.prioridad, up.idUbicacionPadre
                FROM UbicacionesPrioridad up
                INNER JOIN Sucursal s ON s.idSucursal = up.idSucursal AND s.idEmpresa = @idEmpresa
                WHERE up.idSucursal = @idSucursal
                ORDER BY up.prioridad`);
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
    const { idSucursal, codigoUbicacion, prioridad, idUbicacionPadre } = ubicacionData;
    const pool = await sql.connect(dbConfig);
    const req = pool.request()
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .input('codigoUbicacion', sql.VarChar(20), codigoUbicacion)
        .input('prioridad', sql.Int, prioridad);
    if (idUbicacionPadre != null && idUbicacionPadre !== '') {
        req.input('idUbicacionPadre', sql.Int, idUbicacionPadre);
    }
    const sqlInsert = idUbicacionPadre != null && idUbicacionPadre !== ''
        ? `INSERT INTO UbicacionesPrioridad (idSucursal, codigoUbicacion, prioridad, idUbicacionPadre)
           OUTPUT INSERTED.idUbicacion, INSERTED.idSucursal, INSERTED.codigoUbicacion, INSERTED.prioridad, INSERTED.idUbicacionPadre
           VALUES (@idSucursal, @codigoUbicacion, @prioridad, @idUbicacionPadre)`
        : `INSERT INTO UbicacionesPrioridad (idSucursal, codigoUbicacion, prioridad)
           OUTPUT INSERTED.idUbicacion, INSERTED.idSucursal, INSERTED.codigoUbicacion, INSERTED.prioridad, INSERTED.idUbicacionPadre
           VALUES (@idSucursal, @codigoUbicacion, @prioridad)`;
    const result = await req.query(sqlInsert);
    return result.recordset && result.recordset[0] ? result.recordset[0] : null;
}

async function update(idUbicacion, ubicacionData) {
    const { codigoUbicacion, prioridad, idUbicacionPadre } = ubicacionData;
    const pool = await sql.connect(dbConfig);
    const req = pool.request()
        .input('idUbicacion', sql.Int, idUbicacion)
        .input('codigoUbicacion', sql.VarChar(20), codigoUbicacion)
        .input('prioridad', sql.Int, prioridad);
    if (idUbicacionPadre !== undefined) {
        req.input('idUbicacionPadre', sql.Int, idUbicacionPadre == null || idUbicacionPadre === '' ? null : idUbicacionPadre);
    }
    const setPadre = idUbicacionPadre !== undefined ? ', idUbicacionPadre = @idUbicacionPadre' : '';
    const result = await req.query('UPDATE UbicacionesPrioridad SET codigoUbicacion = @codigoUbicacion, prioridad = @prioridad' + setPadre + ' WHERE idUbicacion = @idUbicacion');
    return result;
}

async function deleted(idUbicacion) {
    const pool = await sql.connect(dbConfig);

    const result = await pool.request()
        .input('idUbicacion', sql.Int, idUbicacion)
        .query('DELETE FROM UbicacionesPrioridad WHERE idUbicacion = @idUbicacion');
    return result;
}

/** Verifica si la sucursal pertenece a la empresa (multiempresa). */
async function perteneceSucursalAEmpresa(idSucursal, idEmpresa) {
    if (!idSucursal || !idEmpresa) return false;
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query('SELECT 1 FROM Sucursal WHERE idSucursal = @idSucursal AND idEmpresa = @idEmpresa');
    return result.recordset && result.recordset.length > 0;
}

/** Obtiene una ubicación por id y el idEmpresa de su sucursal (para validar pertenencia). */
async function getByIdConEmpresa(idUbicacion) {
    if (!idUbicacion) return null;
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('idUbicacion', sql.Int, idUbicacion)
        .query(`SELECT up.idUbicacion, up.idSucursal, s.idEmpresa
                FROM UbicacionesPrioridad up
                INNER JOIN Sucursal s ON s.idSucursal = up.idSucursal
                WHERE up.idUbicacion = @idUbicacion`);
    return result.recordset && result.recordset[0] ? result.recordset[0] : null;
}

module.exports = {
    getAll,
    getBySucursal,
    getOrCreateDefaultForSucursal,
    create,
    update,
    deleted,
    perteneceSucursalAEmpresa,
    getByIdConEmpresa
};