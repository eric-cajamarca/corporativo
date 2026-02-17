const sql = require('mssql');

/**
 * Usa la tabla FormasPago existente (idFormaPago INT, descripcion, tipo, requiereReferencia, activo).
 * Catálogo global sin idEmpresa.
 */
async function listar(pool, { buscar, pagina = 1, porPagina = 20 }) {
    const offset = (pagina - 1) * porPagina;
    const countResult = await pool.request()
        .input('buscar', sql.VarChar(100), buscar ? `%${buscar}%` : null)
        .query(`
            SELECT COUNT(*) AS total FROM FormasPago
            WHERE (@buscar IS NULL OR descripcion LIKE @buscar)
        `);
    const total = countResult.recordset[0]?.total ?? 0;

    const dataResult = await pool.request()
        .input('buscar', sql.VarChar(100), buscar ? `%${buscar}%` : null)
        .input('offset', sql.Int, offset)
        .input('porPagina', sql.Int, porPagina)
        .query(`
            SELECT idFormaPago, descripcion, tipo, requiereReferencia, activo
            FROM FormasPago
            WHERE (@buscar IS NULL OR descripcion LIKE @buscar)
            ORDER BY descripcion
            OFFSET @offset ROWS FETCH NEXT @porPagina ROWS ONLY
        `);

    return { items: dataResult.recordset, total };
}

async function obtenerPorId(pool, idFormaPago) {
    const result = await pool.request()
        .input('idFormaPago', sql.Int, idFormaPago)
        .query(`
            SELECT idFormaPago, descripcion, tipo, requiereReferencia, activo
            FROM FormasPago
            WHERE idFormaPago = @idFormaPago
        `);
    return result.recordset[0] || null;
}

async function crear(pool, { descripcion, tipo, requiereReferencia, activo }) {
    const result = await pool.request()
        .input('descripcion', sql.VarChar(50), descripcion)
        .input('tipo', sql.VarChar(20), tipo)
        .input('requiereReferencia', sql.Bit, requiereReferencia ? 1 : 0)
        .input('activo', sql.Bit, activo !== false ? 1 : 0)
        .query(`
            INSERT INTO FormasPago (descripcion, tipo, requiereReferencia, activo)
            OUTPUT INSERTED.idFormaPago, INSERTED.descripcion, INSERTED.tipo, INSERTED.requiereReferencia, INSERTED.activo
            VALUES (@descripcion, @tipo, @requiereReferencia, @activo)
        `);
    return result.recordset[0];
}

async function actualizar(pool, { idFormaPago, descripcion, tipo, requiereReferencia, activo }) {
    await pool.request()
        .input('idFormaPago', sql.Int, idFormaPago)
        .input('descripcion', sql.VarChar(50), descripcion)
        .input('tipo', sql.VarChar(20), tipo)
        .input('requiereReferencia', sql.Bit, requiereReferencia ? 1 : 0)
        .input('activo', sql.Bit, activo !== false ? 1 : 0)
        .query(`
            UPDATE FormasPago
            SET descripcion = @descripcion, tipo = @tipo, requiereReferencia = @requiereReferencia, activo = @activo
            WHERE idFormaPago = @idFormaPago
        `);
}

async function eliminar(pool, idFormaPago) {
    const result = await pool.request()
        .input('idFormaPago', sql.Int, idFormaPago)
        .query(`
            DELETE FROM FormasPago
            WHERE idFormaPago = @idFormaPago
        `);
    return result.rowsAffected[0];
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
