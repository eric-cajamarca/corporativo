const sql = require('mssql');

/**
 * Lista tanques de la empresa. Incluye productos del catálogo (solo combustibles si se filtra por categoría).
 * Si idEmpresa tiene rubro grifo, se pueden mostrar todos los productos con tanque; el front puede filtrar por categoría Combustibles.
 */
async function listarTanques(pool, idEmpresa) {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT t.idTanque, t.idEmpresa, t.idProducto, t.idSucursal, t.capacidad, t.cantidadActual, t.unidad,
                   p.codigo AS codigoProducto, p.descripcion AS nombreProducto,
                   c.nombre AS categoria,
                   s.nombre AS nombreSucursal
            FROM Tanques t
            INNER JOIN Productos p ON p.idProducto = t.idProducto AND p.idEmpresa = @idEmpresa
            LEFT JOIN Categorias c ON c.idCategoria = p.idCategoria
            LEFT JOIN Sucursal s ON s.idSucursal = t.idSucursal
            WHERE t.idEmpresa = @idEmpresa
            ORDER BY p.descripcion
        `);
    return result.recordset || [];
}

/**
 * Actualiza cantidadActual (y opcionalmente capacidad) de un tanque.
 */
async function actualizarTanque(pool, idTanque, idEmpresa, datos) {
    const { cantidadActual, capacidad } = datos || {};
    const updates = [];
    const req = pool.request()
        .input('idTanque', sql.UniqueIdentifier, idTanque)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    if (cantidadActual !== undefined && cantidadActual !== null) {
        updates.push('cantidadActual = @cantidadActual');
        req.input('cantidadActual', sql.Decimal(18, 3), Number(cantidadActual));
    }
    if (capacidad !== undefined && capacidad !== null) {
        updates.push('capacidad = @capacidad');
        req.input('capacidad', sql.Decimal(18, 3), Number(capacidad));
    }
    if (updates.length === 0) return 0;
    const result = await req.query(`
        UPDATE Tanques SET ${updates.join(', ')}
        WHERE idTanque = @idTanque AND idEmpresa = @idEmpresa
    `);
    return result.rowsAffected[0] || 0;
}

/**
 * Crea o no hace nada si ya existe un tanque para ese producto/sucursal.
 */
async function crearTanqueSiNoExiste(pool, idEmpresa, idProducto, idSucursal, capacidad, cantidadActual) {
    const cap = Number(capacidad) || 0;
    const actual = Number(cantidadActual) || 0;
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idProducto', sql.UniqueIdentifier, idProducto)
        .input('idSucursal', sql.UniqueIdentifier, idSucursal || null)
        .input('capacidad', sql.Decimal(18, 3), cap)
        .input('cantidadActual', sql.Decimal(18, 3), actual)
        .query(`
            IF NOT EXISTS (SELECT 1 FROM Tanques WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto AND (idSucursal = @idSucursal OR (idSucursal IS NULL AND @idSucursal IS NULL)))
            INSERT INTO Tanques (idEmpresa, idProducto, idSucursal, capacidad, cantidadActual)
            VALUES (@idEmpresa, @idProducto, @idSucursal, @capacidad, @cantidadActual)
        `);
    return result.rowsAffected[0] || 0;
}

/**
 * Resumen grifo: total vales (monto periodo), total anticipos (saldo), total facturado (ventas periodo).
 * Fechas en ISO o YYYY-MM-DD para el periodo (ej. mes actual).
 */
async function resumenGrifo(pool, idEmpresa, fechaDesde, fechaHasta) {
    let whereVales = ' WHERE v.idEmpresa = @idEmpresa AND v.estado <> \'ANULADO\'';
    const reqVales = pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    if (fechaDesde) { whereVales += ' AND v.fEmision >= @fechaDesde'; reqVales.input('fechaDesde', sql.DateTime, fechaDesde); }
    if (fechaHasta) { whereVales += ' AND v.fEmision <= @fechaHasta'; reqVales.input('fechaHasta', sql.DateTime, fechaHasta); }

    let whereVentas = ' WHERE idEmpresa = @idEmpresa';
    const reqVentas = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    if (fechaDesde) { whereVentas += ' AND fEmision >= @fechaDesde'; reqVentas.input('fechaDesde', sql.DateTime, fechaDesde); }
    if (fechaHasta) { whereVentas += ' AND fEmision <= @fechaHasta'; reqVentas.input('fechaHasta', sql.DateTime, fechaHasta); }

    const reqAnticipos = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    let anticiposResult;
    try {
        anticiposResult = await reqAnticipos.query(`
            SELECT ISNULL(SUM(saldo), 0) AS totalAnticipos FROM AnticiposCliente WHERE idEmpresa = @idEmpresa AND estado = 1
        `);
    } catch (e) {
        anticiposResult = { recordset: [{ totalAnticipos: 0 }] };
    }

    const [valesResult, ventasResult] = await Promise.all([
        reqVales.query(`
            SELECT ISNULL(SUM(d.total), 0) AS totalVales, COUNT(DISTINCT v.idValeDespacho) AS cantidadVales
            FROM ValesDespacho v
            INNER JOIN DetalleValeDespacho d ON d.idValeDespacho = v.idValeDespacho
            ${whereVales}
        `),
        reqVentas.query(`SELECT ISNULL(SUM(total), 0) AS totalFacturado FROM Ventas ${whereVentas}`)
    ]);

    const totalVales = (valesResult.recordset && valesResult.recordset[0]) ? Number(valesResult.recordset[0].totalVales) : 0;
    const cantidadVales = (valesResult.recordset && valesResult.recordset[0]) ? Number(valesResult.recordset[0].cantidadVales) : 0;
    const totalAnticipos = (anticiposResult.recordset && anticiposResult.recordset[0]) ? Number(anticiposResult.recordset[0].totalAnticipos) : 0;
    const totalFacturado = (ventasResult.recordset && ventasResult.recordset[0]) ? Number(ventasResult.recordset[0].totalFacturado) : 0;

    return {
        totalVales,
        cantidadVales,
        totalAnticipos,
        totalFacturado
    };
}

/**
 * Productos del catálogo con categoría Combustibles (para asignar tanques o mostrar en grifo).
 */
async function listarProductosCombustibles(pool, idEmpresa) {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT p.idProducto, p.codigo, p.descripcion, c.nombre AS categoria
            FROM Productos p
            INNER JOIN Categorias c ON c.idCategoria = p.idCategoria
            WHERE p.idEmpresa = @idEmpresa AND c.nombre = 'Combustibles' AND p.estado = 1
            ORDER BY p.descripcion
        `);
    return result.recordset || [];
}

module.exports = {
    listarTanques,
    actualizarTanque,
    crearTanqueSiNoExiste,
    resumenGrifo,
    listarProductosCombustibles
};
