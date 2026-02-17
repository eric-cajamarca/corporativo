const sql = require('mssql');

async function listar(pool, { idEmpresa, buscar, tipo, pagina = 1, porPagina = 20 }) {
    const offset = (pagina - 1) * porPagina;
    const tipoVal = (tipo && String(tipo).toUpperCase() === 'INGRESO') ? 'INGRESO' : (tipo && String(tipo).toUpperCase() === 'EGRESO') ? 'EGRESO' : null;
    const countResult = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('buscar', sql.VarChar(100), buscar ? `%${buscar}%` : null)
        .input('tipo', sql.VarChar(20), tipoVal)
        .query(`
            SELECT COUNT(*) AS total FROM Concepto c
            LEFT JOIN ClasificacionConcepto cc ON c.idClasificacionConcepto = cc.idClasificacionConcepto
            WHERE c.idEmpresa = @idEmpresa
            AND (@tipo IS NULL OR c.tipo = @tipo)
            AND (@buscar IS NULL OR c.descripcion LIKE @buscar OR cc.descripcion LIKE @buscar)
        `);
    const total = countResult.recordset[0]?.total ?? 0;

    const dataResult = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('buscar', sql.VarChar(100), buscar ? `%${buscar}%` : null)
        .input('tipo', sql.VarChar(20), tipoVal)
        .input('offset', sql.Int, offset)
        .input('porPagina', sql.Int, porPagina)
        .query(`
            SELECT c.idConcepto, c.idEmpresa, c.descripcion, c.tipo, c.idClasificacionConcepto,
                   cc.descripcion AS clasificacionDescripcion,
                   c.idTipoMovimientoCaja,
                   tmc.nombre AS clasificacionTipoMovimientoNombre,
                   tmc.descripcion AS clasificacionTipoMovimientoDescripcion
            FROM Concepto c
            LEFT JOIN ClasificacionConcepto cc ON c.idClasificacionConcepto = cc.idClasificacionConcepto
            LEFT JOIN TiposMovimientoCaja tmc ON c.idTipoMovimientoCaja = tmc.idTipoMovimientoCaja
            WHERE c.idEmpresa = @idEmpresa
            AND (@tipo IS NULL OR c.tipo = @tipo)
            AND (@buscar IS NULL OR c.descripcion LIKE @buscar OR cc.descripcion LIKE @buscar)
            ORDER BY c.descripcion
            OFFSET @offset ROWS FETCH NEXT @porPagina ROWS ONLY
        `);

    return { items: dataResult.recordset, total };
}

async function obtenerPorId(pool, idConcepto, idEmpresa) {
    const result = await pool.request()
        .input('idConcepto', sql.UniqueIdentifier, idConcepto)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT c.idConcepto, c.idEmpresa, c.descripcion, c.tipo, c.idClasificacionConcepto,
                   cc.descripcion AS clasificacionDescripcion,
                   c.idTipoMovimientoCaja,
                   tmc.nombre AS clasificacionTipoMovimientoNombre
            FROM Concepto c
            LEFT JOIN ClasificacionConcepto cc ON c.idClasificacionConcepto = cc.idClasificacionConcepto
            LEFT JOIN TiposMovimientoCaja tmc ON c.idTipoMovimientoCaja = tmc.idTipoMovimientoCaja
            WHERE c.idConcepto = @idConcepto AND c.idEmpresa = @idEmpresa
        `);
    return result.recordset[0] || null;
}

async function crear(pool, { idEmpresa, descripcion, tipo, idClasificacionConcepto, idTipoMovimientoCaja }) {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('descripcion', sql.VarChar(100), descripcion)
        .input('tipo', sql.VarChar(20), tipo)
        .input('idClasificacionConcepto', sql.UniqueIdentifier, idClasificacionConcepto || null)
        .input('idTipoMovimientoCaja', sql.Int, idTipoMovimientoCaja || null)
        .query(`
            INSERT INTO Concepto (idEmpresa, descripcion, tipo, idClasificacionConcepto, idTipoMovimientoCaja)
            OUTPUT INSERTED.idConcepto, INSERTED.descripcion, INSERTED.tipo, INSERTED.idClasificacionConcepto, INSERTED.idTipoMovimientoCaja
            VALUES (@idEmpresa, @descripcion, @tipo, @idClasificacionConcepto, @idTipoMovimientoCaja)
        `);
    return result.recordset[0];
}

async function actualizar(pool, { idConcepto, idEmpresa, descripcion, tipo, idClasificacionConcepto, idTipoMovimientoCaja }) {
    await pool.request()
        .input('idConcepto', sql.UniqueIdentifier, idConcepto)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('descripcion', sql.VarChar(100), descripcion)
        .input('tipo', sql.VarChar(20), tipo)
        .input('idClasificacionConcepto', sql.UniqueIdentifier, idClasificacionConcepto || null)
        .input('idTipoMovimientoCaja', sql.Int, idTipoMovimientoCaja || null)
        .query(`
            UPDATE Concepto
            SET descripcion = @descripcion, tipo = @tipo, idClasificacionConcepto = @idClasificacionConcepto, idTipoMovimientoCaja = @idTipoMovimientoCaja
            WHERE idConcepto = @idConcepto AND idEmpresa = @idEmpresa
        `);
}

async function eliminar(pool, idConcepto, idEmpresa) {
    await pool.request()
        .input('idConcepto', sql.UniqueIdentifier, idConcepto)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            DELETE FROM Concepto
            WHERE idConcepto = @idConcepto AND idEmpresa = @idEmpresa
        `);
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
