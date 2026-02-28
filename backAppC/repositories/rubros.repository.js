const sql = require('mssql');

async function listar(pool, { buscar, activo }) {
    const result = await pool.request()
        .input('buscar', sql.VarChar(100), buscar ? `%${buscar}%` : null)
        .input('activo', sql.Bit, activo === undefined ? null : (activo ? 1 : 0))
        .query(`
            SELECT idRubro, codigo, nombre, descripcion, activo
            FROM Rubros
            WHERE (@buscar IS NULL OR nombre LIKE @buscar OR codigo LIKE @buscar)
              AND (@activo IS NULL OR activo = @activo)
            ORDER BY nombre
        `);
    return result.recordset;
}

async function obtenerPorId(pool, idRubro) {
    const result = await pool.request()
        .input('idRubro', sql.Int, idRubro)
        .query(`
            SELECT idRubro, codigo, nombre, descripcion, activo
            FROM Rubros
            WHERE idRubro = @idRubro
        `);
    return result.recordset[0] || null;
}

async function obtenerPorCodigo(pool, codigo) {
    const result = await pool.request()
        .input('codigo', sql.VarChar(10), codigo)
        .query('SELECT idRubro, codigo, nombre, descripcion, activo FROM Rubros WHERE codigo = @codigo');
    return result.recordset[0] || null;
}

async function crear(pool, { codigo, nombre, descripcion, activo }) {
    const result = await pool.request()
        .input('codigo', sql.VarChar(10), codigo)
        .input('nombre', sql.VarChar(80), nombre)
        .input('descripcion', sql.VarChar(200), descripcion || null)
        .input('activo', sql.Bit, activo !== false ? 1 : 0)
        .query(`
            INSERT INTO Rubros (codigo, nombre, descripcion, activo)
            OUTPUT INSERTED.idRubro, INSERTED.codigo, INSERTED.nombre, INSERTED.descripcion, INSERTED.activo
            VALUES (@codigo, @nombre, @descripcion, @activo)
        `);
    return result.recordset[0];
}

async function actualizar(pool, idRubro, { codigo, nombre, descripcion, activo }) {
    await pool.request()
        .input('idRubro', sql.Int, idRubro)
        .input('codigo', sql.VarChar(10), codigo)
        .input('nombre', sql.VarChar(80), nombre)
        .input('descripcion', sql.VarChar(200), descripcion || null)
        .input('activo', sql.Bit, activo !== false ? 1 : 0)
        .query(`
            UPDATE Rubros
            SET codigo = @codigo, nombre = @nombre, descripcion = @descripcion, activo = @activo
            WHERE idRubro = @idRubro
        `);
}

async function eliminar(pool, idRubro) {
    const result = await pool.request()
        .input('idRubro', sql.Int, idRubro)
        .query('DELETE FROM Rubros WHERE idRubro = @idRubro');
    return result.rowsAffected[0];
}

async function listarConfiguracion(pool, idRubro) {
    const result = await pool.request()
        .input('idRubro', sql.Int, idRubro)
        .query(`
            SELECT idConfiguracionRubro, idRubro, clave, valor, descripcion
            FROM ConfiguracionRubro
            WHERE idRubro = @idRubro
            ORDER BY clave
        `);
    return result.recordset;
}

async function guardarConfiguracion(pool, idRubro, clave, valor, descripcion) {
    await pool.request()
        .input('idRubro', sql.Int, idRubro)
        .input('clave', sql.VarChar(100), clave)
        .input('valor', sql.VarChar(500), valor)
        .input('descripcion', sql.VarChar(200), descripcion || null)
        .query(`
            MERGE ConfiguracionRubro AS t
            USING (SELECT @idRubro AS idRubro, @clave AS clave, @valor AS valor, @descripcion AS descripcion) AS s
            ON t.idRubro = s.idRubro AND t.clave = s.clave
            WHEN MATCHED THEN UPDATE SET valor = s.valor, descripcion = s.descripcion
            WHEN NOT MATCHED THEN INSERT (idRubro, clave, valor, descripcion) VALUES (s.idRubro, s.clave, s.valor, s.descripcion);
        `);
}

async function guardarConfiguracionLote(pool, idRubro, items) {
    for (const it of items || []) {
        await guardarConfiguracion(pool, idRubro, it.clave, it.valor, it.descripcion);
    }
}

module.exports = {
    listar,
    obtenerPorId,
    obtenerPorCodigo,
    crear,
    actualizar,
    eliminar,
    listarConfiguracion,
    guardarConfiguracion,
    guardarConfiguracionLote
};
