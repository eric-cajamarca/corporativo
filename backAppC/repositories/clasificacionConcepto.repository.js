const sql = require('mssql');

async function listar(pool, { idEmpresa, buscar, pagina = 1, porPagina = 20 }) {
    const offset = (pagina - 1) * porPagina;
    const countResult = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('buscar', sql.VarChar(100), buscar ? `%${buscar}%` : null)
        .query(`
            SELECT COUNT(*) AS total FROM ClasificacionConcepto
            WHERE idEmpresa = @idEmpresa
            AND (@buscar IS NULL OR descripcion LIKE @buscar)
        `);
    const total = countResult.recordset[0]?.total ?? 0;

    const dataResult = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('buscar', sql.VarChar(100), buscar ? `%${buscar}%` : null)
        .input('offset', sql.Int, offset)
        .input('porPagina', sql.Int, porPagina)
        .query(`
            SELECT idClasificacionConcepto, idEmpresa, descripcion
            FROM ClasificacionConcepto
            WHERE idEmpresa = @idEmpresa
            AND (@buscar IS NULL OR descripcion LIKE @buscar)
            ORDER BY descripcion
            OFFSET @offset ROWS FETCH NEXT @porPagina ROWS ONLY
        `);

    return { items: dataResult.recordset, total };
}

async function obtenerPorId(pool, idClasificacionConcepto, idEmpresa) {
    const result = await pool.request()
        .input('idClasificacionConcepto', sql.UniqueIdentifier, idClasificacionConcepto)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT idClasificacionConcepto, idEmpresa, descripcion
            FROM ClasificacionConcepto
            WHERE idClasificacionConcepto = @idClasificacionConcepto AND idEmpresa = @idEmpresa
        `);
    return result.recordset[0] || null;
}

async function crear(pool, { idEmpresa, descripcion }) {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('descripcion', sql.VarChar(100), descripcion)
        .query(`
            INSERT INTO ClasificacionConcepto (idEmpresa, descripcion)
            OUTPUT INSERTED.idClasificacionConcepto, INSERTED.descripcion
            VALUES (@idEmpresa, @descripcion)
        `);
    return result.recordset[0];
}

async function actualizar(pool, { idClasificacionConcepto, idEmpresa, descripcion }) {
    await pool.request()
        .input('idClasificacionConcepto', sql.UniqueIdentifier, idClasificacionConcepto)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('descripcion', sql.VarChar(100), descripcion)
        .query(`
            UPDATE ClasificacionConcepto
            SET descripcion = @descripcion
            WHERE idClasificacionConcepto = @idClasificacionConcepto AND idEmpresa = @idEmpresa
        `);
}

async function eliminar(pool, idClasificacionConcepto, idEmpresa) {
    await pool.request()
        .input('idClasificacionConcepto', sql.UniqueIdentifier, idClasificacionConcepto)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            DELETE FROM ClasificacionConcepto
            WHERE idClasificacionConcepto = @idClasificacionConcepto AND idEmpresa = @idEmpresa
        `);
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
