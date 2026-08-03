const sql = require('mssql');

async function listar(pool, { buscar, pagina = 1, porPagina = 20 }) {
    const offset = (pagina - 1) * porPagina;
    const countResult = await pool.request()
        .input('buscar', sql.VarChar(150), buscar ? `%${buscar}%` : null)
        .query(`
            SELECT COUNT(*) AS total FROM MotivoNotaDebito
            WHERE ISNULL(activo, 1) = 1
            AND (@buscar IS NULL OR descripcion LIKE @buscar OR codigoSunat LIKE @buscar)
        `);
    const total = countResult.recordset[0]?.total ?? 0;

    const dataResult = await pool.request()
        .input('buscar', sql.VarChar(150), buscar ? `%${buscar}%` : null)
        .input('offset', sql.Int, offset)
        .input('porPagina', sql.Int, porPagina)
        .query(`
            SELECT idMotivoNotaDebito, codigoSunat, descripcion, ISNULL(activo, 1) AS activo
            FROM MotivoNotaDebito
            WHERE ISNULL(activo, 1) = 1
            AND (@buscar IS NULL OR descripcion LIKE @buscar OR codigoSunat LIKE @buscar)
            ORDER BY codigoSunat
            OFFSET @offset ROWS FETCH NEXT @porPagina ROWS ONLY
        `);

    return { items: dataResult.recordset, total };
}

async function obtenerPorId(pool, idMotivoNotaDebito) {
    const result = await pool.request()
        .input('idMotivoNotaDebito', sql.UniqueIdentifier, idMotivoNotaDebito)
        .query(`
            SELECT idMotivoNotaDebito, codigoSunat, descripcion, ISNULL(activo, 1) AS activo
            FROM MotivoNotaDebito
            WHERE idMotivoNotaDebito = @idMotivoNotaDebito
        `);
    return result.recordset[0] || null;
}

async function obtenerPorCodigo(pool, codigoSunat) {
    const result = await pool.request()
        .input('codigoSunat', sql.VarChar(2), codigoSunat)
        .query(`
            SELECT idMotivoNotaDebito, codigoSunat, descripcion, ISNULL(activo, 1) AS activo
            FROM MotivoNotaDebito
            WHERE codigoSunat = @codigoSunat AND ISNULL(activo, 1) = 1
        `);
    return result.recordset[0] || null;
}

async function crear(pool, { codigoSunat, descripcion }) {
    const result = await pool.request()
        .input('codigoSunat', sql.VarChar(2), codigoSunat)
        .input('descripcion', sql.VarChar(150), descripcion)
        .query(`
            INSERT INTO MotivoNotaDebito (codigoSunat, descripcion, activo)
            OUTPUT INSERTED.idMotivoNotaDebito, INSERTED.codigoSunat, INSERTED.descripcion, INSERTED.activo
            VALUES (@codigoSunat, @descripcion, 1)
        `);
    return result.recordset[0];
}

async function actualizar(pool, { idMotivoNotaDebito, codigoSunat, descripcion }) {
    await pool.request()
        .input('idMotivoNotaDebito', sql.UniqueIdentifier, idMotivoNotaDebito)
        .input('codigoSunat', sql.VarChar(2), codigoSunat)
        .input('descripcion', sql.VarChar(150), descripcion)
        .query(`
            UPDATE MotivoNotaDebito
            SET codigoSunat = @codigoSunat, descripcion = @descripcion
            WHERE idMotivoNotaDebito = @idMotivoNotaDebito
        `);
}

async function eliminar(pool, idMotivoNotaDebito) {
    await pool.request()
        .input('idMotivoNotaDebito', sql.UniqueIdentifier, idMotivoNotaDebito)
        .query(`
            DELETE FROM MotivoNotaDebito
            WHERE idMotivoNotaDebito = @idMotivoNotaDebito
        `);
}

module.exports = { listar, obtenerPorId, obtenerPorCodigo, crear, actualizar, eliminar };
