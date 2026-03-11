const sql = require('mssql');

/** Lista códigos SUNAT de motivo de traslado (HandlingCode GRE): 01, 02, 04, 08, 09, 13 */
async function listarCodigosSunat(pool) {
    const result = await pool.request().query(`
        SELECT codigoSunat, descripcion FROM CatMotivoTrasladoSunat ORDER BY codigoSunat
    `);
    return result.recordset;
}

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
            SELECT idMotivoTraslado, idEmpresa, codigoSunat, descripcion
            FROM MotivoTraslado
            WHERE idEmpresa = @idEmpresa
            AND (@buscar IS NULL OR descripcion LIKE @buscar)
            ORDER BY codigoSunat, descripcion
            OFFSET @offset ROWS FETCH NEXT @porPagina ROWS ONLY
        `);

    return { items: dataResult.recordset, total };
}

async function obtenerPorId(pool, idMotivoTraslado, idEmpresa) {
    const result = await pool.request()
        .input('idMotivoTraslado', sql.UniqueIdentifier, idMotivoTraslado)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT idMotivoTraslado, idEmpresa, codigoSunat, descripcion
            FROM MotivoTraslado
            WHERE idMotivoTraslado = @idMotivoTraslado AND idEmpresa = @idEmpresa
        `);
    return result.recordset[0] || null;
}

async function crear(pool, { idEmpresa, codigoSunat, descripcion }) {
    const codigo = (codigoSunat || '01').toString().trim().slice(0, 2);
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('codigoSunat', sql.VarChar(2), codigo || '01')
        .input('descripcion', sql.VarChar(150), descripcion)
        .query(`
            INSERT INTO MotivoTraslado (idEmpresa, codigoSunat, descripcion)
            OUTPUT INSERTED.idMotivoTraslado, INSERTED.codigoSunat, INSERTED.descripcion
            VALUES (@idEmpresa, @codigoSunat, @descripcion)
        `);
    return result.recordset[0];
}

async function actualizar(pool, { idMotivoTraslado, idEmpresa, codigoSunat, descripcion }) {
    const codigo = codigoSunat != null ? codigoSunat.toString().trim().slice(0, 2) : null;
    await pool.request()
        .input('idMotivoTraslado', sql.UniqueIdentifier, idMotivoTraslado)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('codigoSunat', sql.VarChar(2), codigo)
        .input('descripcion', sql.VarChar(150), descripcion)
        .query(`
            UPDATE MotivoTraslado
            SET descripcion = @descripcion, codigoSunat = ISNULL(@codigoSunat, codigoSunat)
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

module.exports = { listarCodigosSunat, listar, obtenerPorId, crear, actualizar, eliminar };
