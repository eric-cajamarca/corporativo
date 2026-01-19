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

async function create(ubicacionData) {

    const { idSucursal, codigoUbicacion, prioridad } = ubicacionData;

    const pool = await sql.connect(dbConfig);

    const result = await pool.request()
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .input('codigoUbicacion', sql.VarChar(20), codigoUbicacion)
        .input('prioridad', sql.Int, prioridad)
        .query(`INSERT INTO UbicacionesPrioridad (idSucursal, codigoUbicacion, prioridad)
                VALUES (@idSucursal, @codigoUbicacion, @prioridad)`);
    return result;
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
    create,
    update,
    deleted
};