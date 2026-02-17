const sql = require('mssql');

async function listar(pool, { idEmpresa, buscar, pagina = 1, porPagina = 20 }) {
    const offset = (pagina - 1) * porPagina;
    const countResult = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('buscar', sql.VarChar(100), buscar ? `%${buscar}%` : null)
        .query(`
            SELECT COUNT(*) AS total FROM CatalogoTipoMovimiento
            WHERE idEmpresa = @idEmpresa
            AND (@buscar IS NULL OR descripcion LIKE @buscar OR descripcionCorta LIKE @buscar)
        `);
    const total = countResult.recordset[0]?.total ?? 0;

    const dataResult = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('buscar', sql.VarChar(100), buscar ? `%${buscar}%` : null)
        .input('offset', sql.Int, offset)
        .input('porPagina', sql.Int, porPagina)
        .query(`
            SELECT idTipoMovimiento, idEmpresa, descripcion, tipo, descripcionCorta
            FROM CatalogoTipoMovimiento
            WHERE idEmpresa = @idEmpresa
            AND (@buscar IS NULL OR descripcion LIKE @buscar OR descripcionCorta LIKE @buscar)
            ORDER BY descripcion
            OFFSET @offset ROWS FETCH NEXT @porPagina ROWS ONLY
        `);

    return { items: dataResult.recordset, total };
}

async function obtenerPorId(pool, idTipoMovimiento, idEmpresa) {
    const result = await pool.request()
        .input('idTipoMovimiento', sql.UniqueIdentifier, idTipoMovimiento)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT idTipoMovimiento, idEmpresa, descripcion, tipo, descripcionCorta
            FROM CatalogoTipoMovimiento
            WHERE idTipoMovimiento = @idTipoMovimiento AND idEmpresa = @idEmpresa
        `);
    return result.recordset[0] || null;
}

async function crear(pool, { idEmpresa, descripcion, tipo, descripcionCorta }) {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('descripcion', sql.VarChar(100), descripcion)
        .input('tipo', sql.VarChar(20), tipo)
        .input('descripcionCorta', sql.VarChar(30), descripcionCorta || null)
        .query(`
            INSERT INTO CatalogoTipoMovimiento (idEmpresa, descripcion, tipo, descripcionCorta)
            OUTPUT INSERTED.idTipoMovimiento, INSERTED.descripcion, INSERTED.tipo, INSERTED.descripcionCorta
            VALUES (@idEmpresa, @descripcion, @tipo, @descripcionCorta)
        `);
    return result.recordset[0];
}

async function actualizar(pool, { idTipoMovimiento, idEmpresa, descripcion, tipo, descripcionCorta }) {
    await pool.request()
        .input('idTipoMovimiento', sql.UniqueIdentifier, idTipoMovimiento)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('descripcion', sql.VarChar(100), descripcion)
        .input('tipo', sql.VarChar(20), tipo)
        .input('descripcionCorta', sql.VarChar(30), descripcionCorta || null)
        .query(`
            UPDATE CatalogoTipoMovimiento
            SET descripcion = @descripcion, tipo = @tipo, descripcionCorta = @descripcionCorta
            WHERE idTipoMovimiento = @idTipoMovimiento AND idEmpresa = @idEmpresa
        `);
}

async function eliminar(pool, idTipoMovimiento, idEmpresa) {
    await pool.request()
        .input('idTipoMovimiento', sql.UniqueIdentifier, idTipoMovimiento)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            DELETE FROM CatalogoTipoMovimiento
            WHERE idTipoMovimiento = @idTipoMovimiento AND idEmpresa = @idEmpresa
        `);
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
