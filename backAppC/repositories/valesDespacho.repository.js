const sql = require('mssql');

async function obtenerIdComprobanteVD(pool, idEmpresa) {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query("SELECT idComprobante FROM Comprobantes WHERE idEmpresa = @idEmpresa AND codigo = 'VD'");
    const row = result.recordset && result.recordset[0];
    return row ? row.idComprobante : null;
}

async function obtenerSiguienteNumero(transaction, idEmpresa, idComprobante) {
    const result = await transaction.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idComprobante', sql.Int, idComprobante)
        .query(`
            UPDATE Comprobantes
            SET numero = ISNULL(numero, 0) + 1
            OUTPUT INSERTED.numero
            WHERE idEmpresa = @idEmpresa AND idComprobante = @idComprobante
        `);
    const row = result.recordset && result.recordset[0];
    const num = row && row.numero != null ? Number(row.numero) : 1;
    return num;
}

async function listar(pool, idEmpresa, filtros = {}) {
    const { idCliente, fechaDesde, fechaHasta, estado } = filtros;
    let where = ' WHERE v.idEmpresa = @idEmpresa';
    const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    if (idCliente != null) {
        where += ' AND v.idCliente = @idCliente';
        req.input('idCliente', sql.Int, idCliente);
    }
    if (fechaDesde) {
        where += ' AND v.fEmision >= @fechaDesde';
        req.input('fechaDesde', sql.DateTime, fechaDesde);
    }
    if (fechaHasta) {
        where += ' AND v.fEmision <= @fechaHasta';
        req.input('fechaHasta', sql.DateTime, fechaHasta);
    }
    if (estado) {
        where += ' AND v.estado = @estado';
        req.input('estado', sql.VarChar(20), estado);
    }
    const result = await req.query(`
        SELECT v.idValeDespacho, v.idEmpresa, v.idSucursal, v.idCliente, v.idComprobante, v.serie, v.numero, v.compVale,
               CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision, v.estado, v.idVentaLiquidacion, v.observaciones,
               c.nombre AS nombreCliente, c.rSocial AS clienteRazonSocial
        FROM ValesDespacho v
        LEFT JOIN Clientes c ON c.idCliente = v.idCliente AND c.idEmpresa = v.idEmpresa
        ${where}
        ORDER BY v.fEmision DESC
    `);
    return result.recordset;
}

async function obtenerPorId(pool, idValeDespacho, idEmpresa) {
    const result = await pool.request()
        .input('idValeDespacho', sql.UniqueIdentifier, idValeDespacho)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT v.idValeDespacho, v.idEmpresa, v.idSucursal, v.idCliente, v.idComprobante, v.serie, v.numero, v.compVale,
                   CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision, v.idUsuario, v.estado, v.idVentaLiquidacion, v.observaciones,
                   c.nombre AS nombreComprobante, cl.rSocial AS clienteRazonSocial, cl.ruc AS clienteRuc
            FROM ValesDespacho v
            LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
            LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
            WHERE v.idValeDespacho = @idValeDespacho AND v.idEmpresa = @idEmpresa
        `);
    return result.recordset[0] || null;
}

async function insertarVale(transaction, datos, idEmpresa, idUsuario) {
    const { idSucursal, idCliente, idComprobante, serie, numero, observaciones } = datos;
    const result = await transaction.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .input('idCliente', sql.Int, idCliente)
        .input('idComprobante', sql.Int, idComprobante)
        .input('serie', sql.VarChar(4), serie)
        .input('numero', sql.VarChar(8), String(numero))
        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
        .input('observaciones', sql.VarChar(255), observaciones || null)
        .query(`
            INSERT INTO ValesDespacho (idEmpresa, idSucursal, idCliente, idComprobante, serie, numero, idUsuario, observaciones)
            OUTPUT INSERTED.idValeDespacho
            VALUES (@idEmpresa, @idSucursal, @idCliente, @idComprobante, @serie, @numero, @idUsuario, @observaciones)
        `);
    return result.recordset[0].idValeDespacho;
}

async function insertarDetalle(transaction, idValeDespacho, items) {
    for (const it of items || []) {
        const cantidad = Number(it.cantidad) || 0;
        const pUnitario = Number(it.pUnitario) || 0;
        const total = Number(it.total) || cantidad * pUnitario;
        await transaction.request()
            .input('idValeDespacho', sql.UniqueIdentifier, idValeDespacho)
            .input('idProducto', sql.UniqueIdentifier, it.idProducto)
            .input('idPresentacion', sql.Int, it.idPresentacion != null ? it.idPresentacion : 1)
            .input('cantidad', sql.Decimal(18, 3), cantidad)
            .input('pUnitario', sql.Decimal(18, 6), pUnitario)
            .input('total', sql.Decimal(18, 2), total)
            .query(`
                INSERT INTO DetalleValeDespacho (idValeDespacho, idProducto, idPresentacion, cantidad, pUnitario, total)
                VALUES (@idValeDespacho, @idProducto, @idPresentacion, @cantidad, @pUnitario, @total)
            `);
    }
}

async function listarDetalle(pool, idValeDespacho, idEmpresa) {
    const result = await pool.request()
        .input('idValeDespacho', sql.UniqueIdentifier, idValeDespacho)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT d.idDetalleValeDespacho, d.idValeDespacho, d.idProducto, d.idPresentacion, d.cantidad, d.pUnitario, d.total,
                   p.nombre AS nombreProducto, p.codigo AS codigoProducto, pr.codigo AS codigoPresentacion, pr.descripcion AS nombrePresentacion
            FROM DetalleValeDespacho d
            INNER JOIN ValesDespacho v ON v.idValeDespacho = d.idValeDespacho AND v.idEmpresa = @idEmpresa
            LEFT JOIN Productos p ON p.idProducto = d.idProducto
            LEFT JOIN Presentacion pr ON pr.idPresentacion = d.idPresentacion
            WHERE d.idValeDespacho = @idValeDespacho
        `);
    return result.recordset;
}

async function insertarMovimientoInventario(transaction, idEmpresa, idSucursal, idProducto, cantidad, docRelacionado, idComprobante, idUsuario, observaciones) {
    await transaction.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .input('idProducto', sql.UniqueIdentifier, idProducto)
        .input('cantidad', sql.Decimal(18, 3), cantidad)
        .input('docRelacionado', sql.VarChar(20), docRelacionado)
        .input('idComprobante', sql.Int, idComprobante)
        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
        .input('observaciones', sql.VarChar(255), observaciones || null)
        .query(`
            INSERT INTO MovimientosInventario (idEmpresa, idSucursal, idProducto, tipoMovimiento, cantidad, docRelacionado, idComprobante, idUsuario, observaciones)
            VALUES (@idEmpresa, @idSucursal, @idProducto, 'SA', @cantidad, @docRelacionado, @idComprobante, @idUsuario, @observaciones)
        `);
}

async function anularVale(transaction, idValeDespacho, idEmpresa) {
    const result = await transaction.request()
        .input('idValeDespacho', sql.UniqueIdentifier, idValeDespacho)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            UPDATE ValesDespacho SET estado = 'ANULADO' WHERE idValeDespacho = @idValeDespacho AND idEmpresa = @idEmpresa
        `);
    return result.rowsAffected[0];
}

module.exports = {
    obtenerIdComprobanteVD,
    obtenerSiguienteNumero,
    listar,
    obtenerPorId,
    insertarVale,
    insertarDetalle,
    listarDetalle,
    insertarMovimientoInventario,
    anularVale
};
