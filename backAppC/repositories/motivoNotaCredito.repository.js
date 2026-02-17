const sql = require('mssql');

async function listar(pool, { idEmpresa, buscar, pagina = 1, porPagina = 20 }) {
    const offset = (pagina - 1) * porPagina;
    const countResult = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('buscar', sql.VarChar(150), buscar ? `%${buscar}%` : null)
        .query(`
            SELECT COUNT(*) AS total FROM MotivoNotaCredito
            WHERE idEmpresa = @idEmpresa
            AND (@buscar IS NULL OR descripcion LIKE @buscar OR codigoSunat LIKE @buscar)
        `);
    const total = countResult.recordset[0]?.total ?? 0;

    const dataResult = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('buscar', sql.VarChar(150), buscar ? `%${buscar}%` : null)
        .input('offset', sql.Int, offset)
        .input('porPagina', sql.Int, porPagina)
        .query(`
            SELECT idMotivoNotaCredito, idEmpresa, codigoSunat, descripcion
            FROM MotivoNotaCredito
            WHERE idEmpresa = @idEmpresa
            AND (@buscar IS NULL OR descripcion LIKE @buscar OR codigoSunat LIKE @buscar)
            ORDER BY codigoSunat
            OFFSET @offset ROWS FETCH NEXT @porPagina ROWS ONLY
        `);

    return { items: dataResult.recordset, total };
}

async function obtenerPorId(pool, idMotivoNotaCredito, idEmpresa) {
    const result = await pool.request()
        .input('idMotivoNotaCredito', sql.UniqueIdentifier, idMotivoNotaCredito)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT idMotivoNotaCredito, idEmpresa, codigoSunat, descripcion
            FROM MotivoNotaCredito
            WHERE idMotivoNotaCredito = @idMotivoNotaCredito AND idEmpresa = @idEmpresa
        `);
    return result.recordset[0] || null;
}

async function crear(pool, { idEmpresa, codigoSunat, descripcion }) {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('codigoSunat', sql.VarChar(2), codigoSunat)
        .input('descripcion', sql.VarChar(150), descripcion)
        .query(`
            INSERT INTO MotivoNotaCredito (idEmpresa, codigoSunat, descripcion)
            OUTPUT INSERTED.idMotivoNotaCredito, INSERTED.codigoSunat, INSERTED.descripcion
            VALUES (@idEmpresa, @codigoSunat, @descripcion)
        `);
    return result.recordset[0];
}

async function actualizar(pool, { idMotivoNotaCredito, idEmpresa, codigoSunat, descripcion }) {
    await pool.request()
        .input('idMotivoNotaCredito', sql.UniqueIdentifier, idMotivoNotaCredito)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('codigoSunat', sql.VarChar(2), codigoSunat)
        .input('descripcion', sql.VarChar(150), descripcion)
        .query(`
            UPDATE MotivoNotaCredito
            SET codigoSunat = @codigoSunat, descripcion = @descripcion
            WHERE idMotivoNotaCredito = @idMotivoNotaCredito AND idEmpresa = @idEmpresa
        `);
}

async function eliminar(pool, idMotivoNotaCredito, idEmpresa) {
    await pool.request()
        .input('idMotivoNotaCredito', sql.UniqueIdentifier, idMotivoNotaCredito)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            DELETE FROM MotivoNotaCredito
            WHERE idMotivoNotaCredito = @idMotivoNotaCredito AND idEmpresa = @idEmpresa
        `);
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
