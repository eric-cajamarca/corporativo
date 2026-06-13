const sql = require('mssql');

/**
 * Lista reservas de una empresa. idProductoHabitacion (producto Servicios ZZ). Siempre filtrar por idEmpresa.
 */
async function listar(pool, idEmpresa, filtros = {}) {
    const { estado, idProductoHabitacion } = filtros;
    let query = `
        SELECT r.idReserva, r.idEmpresa, r.idProductoHabitacion, r.idCliente, r.codigo, r.nombreHuesped,
               CONVERT(VARCHAR(10), r.fechaEntrada, 120) AS fechaEntrada,
               CONVERT(VARCHAR(10), r.fechaSalida, 120) AS fechaSalida,
               r.estado, r.total, r.observaciones,
               CONVERT(VARCHAR(19), r.fRegistro, 120) AS fRegistro,
               p.descripcion AS habitacionDescripcion,
               p.codigo AS habitacionCodigo
        FROM Reservas r
        LEFT JOIN Productos p ON r.idProductoHabitacion = p.idProducto
        WHERE r.idEmpresa = @idEmpresa
    `;
    const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    if (estado) {
        query += ' AND r.estado = @estado';
        req.input('estado', sql.VarChar(20), estado);
    }
    if (idProductoHabitacion) {
        query += ' AND r.idProductoHabitacion = @idProductoHabitacion';
        req.input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion);
    }
    query += ' ORDER BY r.fechaEntrada DESC, r.codigo';
    const result = await req.query(query);
    return result.recordset;
}

async function obtenerPorId(pool, idReserva, idEmpresa) {
    const result = await pool.request()
        .input('idReserva', sql.UniqueIdentifier, idReserva)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT r.idReserva, r.idEmpresa, r.idProductoHabitacion, r.idCliente, r.codigo, r.nombreHuesped,
                   CONVERT(VARCHAR(10), r.fechaEntrada, 120) AS fechaEntrada,
                   CONVERT(VARCHAR(10), r.fechaSalida, 120) AS fechaSalida,
                   r.estado, r.total, r.observaciones,
                   CONVERT(VARCHAR(19), r.fRegistro, 120) AS fRegistro,
                   p.descripcion AS habitacionDescripcion, p.codigo AS habitacionCodigo
            FROM Reservas r
            LEFT JOIN Productos p ON r.idProductoHabitacion = p.idProducto
            WHERE r.idReserva = @idReserva AND r.idEmpresa = @idEmpresa
        `);
    return result.recordset[0] || null;
}

async function siguienteCodigo(pool, idEmpresa) {
    const año = new Date().getFullYear();
    const prefijo = `RES-${año}-%`;
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('prefijo', sql.VarChar(20), prefijo)
        .query(`
            SELECT ISNULL(MAX(CAST(SUBSTRING(codigo, 10, 10) AS INT)), 0) + 1 AS siguiente
            FROM Reservas
            WHERE idEmpresa = @idEmpresa AND codigo LIKE @prefijo
        `);
    const num = result.recordset[0]?.siguiente || 1;
    return `RES-${año}-${String(num).padStart(3, '0')}`;
}

async function crear(pool, idEmpresa, payload, idUsuario = null) {
    const {
        idProductoHabitacion, idCliente, codigo, nombreHuesped,
        fechaEntrada, fechaSalida, estado, total, observaciones
    } = payload;
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
        .input('idCliente', sql.Int, idCliente || null)
        .input('codigo', sql.VarChar(30), codigo)
        .input('nombreHuesped', sql.VarChar(200), nombreHuesped)
        .input('fechaEntrada', sql.Date, fechaEntrada)
        .input('fechaSalida', sql.Date, fechaSalida)
        .input('estado', sql.VarChar(20), estado || 'vigente')
        .input('total', sql.Decimal(18, 2), total ?? 0)
        .input('observaciones', sql.VarChar(500), observaciones || null)
        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
        .query(`
            INSERT INTO Reservas (idEmpresa, idProductoHabitacion, idCliente, codigo, nombreHuesped, fechaEntrada, fechaSalida, estado, total, observaciones, idUsuario)
            OUTPUT INSERTED.idReserva, INSERTED.codigo
            VALUES (@idEmpresa, @idProductoHabitacion, @idCliente, @codigo, @nombreHuesped, @fechaEntrada, @fechaSalida, @estado, @total, @observaciones, @idUsuario)
        `);
    return result.recordset[0];
}

async function actualizar(pool, idReserva, idEmpresa, payload) {
    const {
        idProductoHabitacion, idCliente, codigo, nombreHuesped,
        fechaEntrada, fechaSalida, estado, total, observaciones
    } = payload;
    await pool.request()
        .input('idReserva', sql.UniqueIdentifier, idReserva)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
        .input('idCliente', sql.Int, idCliente || null)
        .input('codigo', sql.VarChar(30), codigo)
        .input('nombreHuesped', sql.VarChar(200), nombreHuesped)
        .input('fechaEntrada', sql.Date, fechaEntrada)
        .input('fechaSalida', sql.Date, fechaSalida)
        .input('estado', sql.VarChar(20), estado)
        .input('total', sql.Decimal(18, 2), total ?? 0)
        .input('observaciones', sql.VarChar(500), observaciones || null)
        .query(`
            UPDATE Reservas
            SET idProductoHabitacion = @idProductoHabitacion, idCliente = @idCliente, codigo = @codigo,
                nombreHuesped = @nombreHuesped, fechaEntrada = @fechaEntrada, fechaSalida = @fechaSalida,
                estado = @estado, total = @total, observaciones = @observaciones
            WHERE idReserva = @idReserva AND idEmpresa = @idEmpresa
        `);
}

async function eliminar(pool, idReserva, idEmpresa) {
    const result = await pool.request()
        .input('idReserva', sql.UniqueIdentifier, idReserva)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query('DELETE FROM Reservas WHERE idReserva = @idReserva AND idEmpresa = @idEmpresa');
    return result.rowsAffected[0];
}

/**
 * Detecta solapamiento de fechas con otra reserva vigente en la misma habitación.
 */
async function existeSolapamiento(pool, idEmpresa, idProductoHabitacion, fechaEntrada, fechaSalida, excluirIdReserva = null) {
    let query = `
        SELECT TOP 1 r.idReserva
        FROM Reservas r
        WHERE r.idEmpresa = @idEmpresa
          AND r.idProductoHabitacion = @idProductoHabitacion
          AND r.estado = 'vigente'
          AND r.fechaEntrada < @fechaSalida
          AND r.fechaSalida > @fechaEntrada
    `;
    const req = pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
        .input('fechaEntrada', sql.Date, fechaEntrada)
        .input('fechaSalida', sql.Date, fechaSalida);
    if (excluirIdReserva) {
        query += ' AND r.idReserva <> @excluirIdReserva';
        req.input('excluirIdReserva', sql.UniqueIdentifier, excluirIdReserva);
    }
    const result = await req.query(query);
    return !!(result.recordset && result.recordset[0]);
}

async function cerrarPostVenta(pool, idEmpresa, { idProductoHabitacion, idVenta, idReserva = null }) {
    if (!idProductoHabitacion) throw new Error('Habitación requerida');
    if (!idVenta) throw new Error('idVenta requerido');

    await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
        .query(`
            DELETE FROM ConsumoHabitacion
            WHERE idEmpresa = @idEmpresa AND idProductoHabitacion = @idProductoHabitacion
        `);

    if (idReserva) {
        await pool.request()
            .input('idReserva', sql.UniqueIdentifier, idReserva)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('idVenta', sql.Int, idVenta)
            .query(`
                UPDATE Reservas
                SET estado = 'sin_efecto', idVenta = @idVenta
                WHERE idReserva = @idReserva AND idEmpresa = @idEmpresa
            `);
    } else {
        await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
            .input('idVenta', sql.Int, idVenta)
            .query(`
                UPDATE Reservas
                SET estado = 'sin_efecto', idVenta = @idVenta
                WHERE idEmpresa = @idEmpresa
                  AND idProductoHabitacion = @idProductoHabitacion
                  AND estado = 'vigente'
            `);
    }
}

module.exports = {
    listar,
    obtenerPorId,
    siguienteCodigo,
    crear,
    actualizar,
    eliminar,
    existeSolapamiento,
    cerrarPostVenta
};
