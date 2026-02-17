const sql = require('mssql');

async function listar(pool, { idEmpresa, buscar, pagina = 1, porPagina = 20 }) {
    const offset = (pagina - 1) * porPagina;
    const countResult = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('buscar', sql.VarChar(150), buscar ? `%${buscar}%` : null)
        .query(`
            SELECT COUNT(*) AS total FROM MotivoTraslado
            WHERE idEmpresa = @idEmpresa
            AND (@buscar IS NULL OR descripcion LIKE @buscar)
        `);
    const total = countResult.recordset[0]?.total ?? 0;

    const dataResult = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('buscar', sql.VarChar(150), buscar ? `%${buscar}%` : null)
        .input('offset', sql.Int, offset)
        .input('porPagina', sql.Int, porPagina)
        .query(`
            SELECT idMotivoTraslado, idEmpresa, descripcion
            FROM MotivoTraslado
            WHERE idEmpresa = @idEmpresa
            AND (@buscar IS NULL OR descripcion LIKE @buscar)
            ORDER BY descripcion
            OFFSET @offset ROWS FETCH NEXT @porPagina ROWS ONLY
        `);

    return { items: dataResult.recordset, total };
}

async function obtenerPorId(pool, idMotivoTraslado, idEmpresa) {
    const result = await pool.request()
        .input('idMotivoTraslado', sql.UniqueIdentifier, idMotivoTraslado)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT idMotivoTraslado, idEmpresa, descripcion
            FROM MotivoTraslado
            WHERE idMotivoTraslado = @idMotivoTraslado AND idEmpresa = @idEmpresa
        `);
    return result.recordset[0] || null;
}

async function crear(pool, { idEmpresa, descripcion }) {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('descripcion', sql.VarChar(150), descripcion)
        .query(`
            INSERT INTO MotivoTraslado (idEmpresa, descripcion)
            OUTPUT INSERTED.idMotivoTraslado, INSERTED.descripcion
            VALUES (@idEmpresa, @descripcion)
        `);
    return result.recordset[0];
}

async function actualizar(pool, { idMotivoTraslado, idEmpresa, descripcion }) {
    await pool.request()
        .input('idMotivoTraslado', sql.UniqueIdentifier, idMotivoTraslado)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('descripcion', sql.VarChar(150), descripcion)
        .query(`
            UPDATE MotivoTraslado
            SET descripcion = @descripcion
            WHERE idMotivoTraslado = @idMotivoTraslado AND idEmpresa = @idEmpresa
        `);
}

async function eliminar(pool, idMotivoTraslado, idEmpresa) {
    await pool.request()
        .input('idMotivoTraslado', sql.UniqueIdentifier, idMotivoTraslado)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            DELETE FROM MotivoTraslado
            WHERE idMotivoTraslado = @idMotivoTraslado AND idEmpresa = @idEmpresa
        `);
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
