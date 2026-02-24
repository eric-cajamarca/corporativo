const sql = require('mssql');

/**
 * Catálogo universal TiposMovimientoCaja (todas las empresas).
 * Sin paginación, sin filtro por idEmpresa.
 */
async function listar(pool, { buscar } = {}) {
    const request = pool.request();
    if (buscar) request.input('buscar', sql.VarChar(100), `%${buscar}%`);
    const query = buscar
        ? `SELECT idTipoMovimientoCaja, nombre, descripcion, tipo
           FROM TiposMovimientoCaja
           WHERE nombre LIKE @buscar OR ISNULL(descripcion,'') LIKE @buscar
           ORDER BY nombre`
        : `SELECT idTipoMovimientoCaja, nombre, descripcion, tipo
           FROM TiposMovimientoCaja
           ORDER BY nombre`;
    const result = await request.query(query);
    return result.recordset;
}

async function obtenerPorId(pool, idTipoMovimientoCaja) {
    const result = await pool.request()
        .input('idTipoMovimientoCaja', sql.Int, idTipoMovimientoCaja)
        .query(`
            SELECT idTipoMovimientoCaja, nombre, descripcion, tipo
            FROM TiposMovimientoCaja
            WHERE idTipoMovimientoCaja = @idTipoMovimientoCaja
        `);
    return result.recordset[0] || null;
}

async function crear(pool, { nombre, descripcion, tipo }) {
    const result = await pool.request()
        .input('nombre', sql.VarChar(30), nombre)
        .input('descripcion', sql.VarChar(100), descripcion || null)
        .input('tipo', sql.Char(1), tipo)
        .query(`
            INSERT INTO TiposMovimientoCaja (nombre, descripcion, tipo)
            OUTPUT INSERTED.idTipoMovimientoCaja, INSERTED.nombre, INSERTED.descripcion, INSERTED.tipo
            VALUES (@nombre, @descripcion, @tipo)
        `);
    return result.recordset[0];
}

async function actualizar(pool, { idTipoMovimientoCaja, nombre, descripcion, tipo }) {
    await pool.request()
        .input('idTipoMovimientoCaja', sql.Int, idTipoMovimientoCaja)
        .input('nombre', sql.VarChar(30), nombre)
        .input('descripcion', sql.VarChar(100), descripcion || null)
        .input('tipo', sql.Char(1), tipo)
        .query(`
            UPDATE TiposMovimientoCaja
            SET nombre = @nombre, descripcion = @descripcion, tipo = @tipo
            WHERE idTipoMovimientoCaja = @idTipoMovimientoCaja
        `);
}

async function eliminar(pool, idTipoMovimientoCaja) {
    await pool.request()
        .input('idTipoMovimientoCaja', sql.Int, idTipoMovimientoCaja)
        .query(`
            DELETE FROM TiposMovimientoCaja
            WHERE idTipoMovimientoCaja = @idTipoMovimientoCaja
        `);
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
