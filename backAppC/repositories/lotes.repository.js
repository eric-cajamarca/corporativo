const sql = require('mssql');
const dbConfig = require('../dbconfig');



async function getAll(idEmpresa) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT 
                l.idLote, 
                l.idEmpresa, 
                l.idProducto, 
                l.idSucursal, 
                l.costoUnitario, 
                l.cantidadIngresada, 
                l.cantidadDisponible,
                CONVERT(VARCHAR(19), l.fechaIngreso, 120) AS fechaIngreso,
                p.descripcion AS nombreProducto,
                s.nombre AS nombreSucursal
            FROM Lotes l
            LEFT JOIN Productos p ON l.idProducto = p.idProducto
            LEFT JOIN Sucursal s ON l.idSucursal = s.idSucursal
            WHERE l.idEmpresa = @idEmpresa 
            ORDER BY l.fechaIngreso DESC
        `);
    return result.recordset;
}

async function getById(idLote) {
    console.log('idLote en getById repository:', idLote);
    const pool = await sql.connect(dbConfig);
    
    const result = await pool.request()
        .input('idLote', sql.UniqueIdentifier, idLote)
        .query(`
            SELECT 
                idLote, 
                idEmpresa, 
                idProducto, 
                idSucursal, 
                costoUnitario, 
                cantidadIngresada, 
                cantidadDisponible
            FROM Lotes 
            WHERE idLote = @idLote
        `);
        console.log('Lote obtenido en repository:', result.recordset[0]);
    return result.recordset[0];
}

async function getBySucursal(idEmpresa, idSucursal) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .query('SELECT * FROM Lotes WHERE idEmpresa = @idEmpresa AND idSucursal = @idSucursal');
    return result.recordset;
}

async function create(loteData) {
    const { idEmpresa, idProducto, idSucursal, costoUnitario, cantidadIngresada, cantidadDisponible } = loteData;
    
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idProducto', sql.UniqueIdentifier, idProducto)
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .input('costoUnitario', sql.Decimal(18,6), costoUnitario)
        .input('cantidadIngresada', sql.Int, cantidadIngresada)
        .input('cantidadDisponible', sql.Int, cantidadDisponible)
        .query(`INSERT INTO Lotes (idLote, idEmpresa, idProducto, idSucursal, costoUnitario, cantidadIngresada, cantidadDisponible)
                VALUES (NEWID(), @idEmpresa, @idProducto, @idSucursal, @costoUnitario, @cantidadIngresada, @cantidadDisponible)`);
    return result;
}

async function update(idLote, loteData) {
    const { costoUnitario, cantidadDisponible } = loteData;

    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('idLote', sql.UniqueIdentifier, idLote)
        .input('costoUnitario', sql.Decimal(18,6), costoUnitario)
        .input('cantidadDisponible', sql.Int, cantidadDisponible)
        .query('UPDATE Lotes SET costoUnitario = @costoUnitario, cantidadDisponible = @cantidadDisponible WHERE idLote = @idLote');
    return result;
}

async function deleted(idLote) {

    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('idLote', sql.UniqueIdentifier, idLote)
        .query('DELETE FROM Lotes WHERE idLote = @idLote');
    return result;
}

async function actualizarCantidadDisponible(idLote, nuevaCantidad) {

    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('idLote', sql.UniqueIdentifier, idLote)
        .input('nuevaCantidad', sql.Int, nuevaCantidad)
        .query('UPDATE Lotes SET cantidadDisponible = @nuevaCantidad WHERE idLote = @idLote');
    return result;
}

module.exports = {
    getAll,
    getById,
    getBySucursal,
    create,
    update,
    deleted,
    actualizarCantidadDisponible
};