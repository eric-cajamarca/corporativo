const sql = require('mssql');

async function listarPorCompra(pool, idEmpresa, idCompra) {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCompra', sql.UniqueIdentifier, idCompra)
    .query(`
      SELECT
        d.idDetalleCompra,
        d.idEmpresa,
        d.idSucursal,
        d.idCompra,
        d.cantidad,
        d.idProducto,
        d.idPresentacion,
        d.pUnitario,
        d.total,
        d.idUsuario,
        RTRIM(LTRIM(ISNULL(p.Codigo, ''))) AS codigo,
        RTRIM(LTRIM(ISNULL(p.descripcion, ''))) AS descripcion,
        CONVERT(VARCHAR(19), p.fProduccion, 120) AS fProduccion,
        CONVERT(VARCHAR(19), p.fVencimiento, 120) AS fVencimiento,
        p.idCategoria,
        p.idMarca,
        cat.nombre AS categoriaNombre,
        m.nombre AS marcaNombre,
        pr.codigo AS presentacionCodigo,
        pr.descripcion AS presentacionDescripcion,
        s.nombre AS sucursalNombre
      FROM DetalleCompras d
      INNER JOIN Compras c ON c.idCompra = d.idCompra AND c.idEmpresa = @idEmpresa
      LEFT JOIN Productos p ON p.idProducto = d.idProducto AND p.idEmpresa = d.idEmpresa
      LEFT JOIN Categorias cat ON cat.idCategoria = p.idCategoria
      LEFT JOIN Marcas m ON m.idMarca = p.idMarca
      LEFT JOIN Presentacion pr ON pr.idPresentacion = ISNULL(d.idPresentacion, p.idPresentacion)
      LEFT JOIN Sucursal s ON s.idSucursal = d.idSucursal AND ISNULL(s.estado, 1) = 1
      WHERE d.idCompra = @idCompra AND d.idEmpresa = @idEmpresa
      ORDER BY d.idDetalleCompra
    `);
  return result.recordset;
}

async function insertarDetalle(transaction, row) {
  await transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, row.idSucursal)
    .input('idCompra', sql.UniqueIdentifier, row.idCompra)
    .input('cantidad', sql.Decimal(18, 3), row.cantidad)
    .input('idProducto', sql.UniqueIdentifier, row.idProducto)
    .input('idPresentacion', sql.Int, row.idPresentacion)
    .input('pUnitario', sql.Decimal(18, 6), row.pUnitario)
    .input('total', sql.Decimal(18, 2), row.total)
    .input('idUsuario', sql.UniqueIdentifier, row.idUsuario)
    .query(`
      INSERT INTO DetalleCompras (idEmpresa, idSucursal, idCompra, cantidad, idProducto, idPresentacion, pUnitario, total, idUsuario)
      VALUES (@idEmpresa, @idSucursal, @idCompra, @cantidad, @idProducto, @idPresentacion, @pUnitario, @total, @idUsuario)
    `);
}

/** Insert sin transacción explícita (compatibilidad con flujo editar_detalle). */
async function insertarDetallePool(pool, row) {
  const pUnitarioFormateado = parseFloat(row.pUnitario);
  await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, row.idSucursal)
    .input('idCompra', sql.UniqueIdentifier, row.idCompra)
    .input('cantidad', sql.Decimal(18, 3), row.cantidad)
    .input('idProducto', sql.UniqueIdentifier, row.idProducto)
    .input('idPresentacion', sql.Int, row.idPresentacion)
    .input('pUnitario', sql.Decimal(18, 5), pUnitarioFormateado)
    .input('total', sql.Decimal(18, 2), row.total)
    .input('idUsuario', sql.UniqueIdentifier, row.idUsuario)
    .query(
      'INSERT INTO DetalleCompras (idEmpresa, idSucursal, idCompra, cantidad, idProducto, idPresentacion, pUnitario, total, idUsuario) VALUES (@idEmpresa, @idSucursal, @idCompra, @cantidad, @idProducto, @idPresentacion, @pUnitario, @total, @idUsuario)'
    );
}

async function obtenerNumeroLoteCompra(transaction, idCompra) {
  const r = await transaction
    .request()
    .input('idCompra', sql.UniqueIdentifier, idCompra)
    .query('SELECT numeroLote FROM Compras WHERE idCompra = @idCompra');
  return r.recordset?.[0]?.numeroLote ?? null;
}

async function obtenerSiguienteNumeroLote(transaction, idEmpresa) {
  const rNext = await transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT ISNULL(MAX(TRY_CAST(numeroLote AS INT)), 0) + 1 AS siguiente FROM Lotes WHERE idEmpresa = @idEmpresa
    `);
  return rNext.recordset?.[0]?.siguiente != null ? String(rNext.recordset[0].siguiente) : '1';
}

async function actualizarNumeroLoteCompra(transaction, idCompra, numeroLote) {
  await transaction
    .request()
    .input('idCompra', sql.UniqueIdentifier, idCompra)
    .input('numeroLote', sql.Int, parseInt(numeroLote, 10))
    .query('UPDATE Compras SET numeroLote = @numeroLote WHERE idCompra = @idCompra');
}

async function insertarLote(transaction, payload) {
  const r = await transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, payload.idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, payload.idProducto)
    .input('idSucursal', sql.UniqueIdentifier, payload.idSucursal)
    .input('costoUnitario', sql.Decimal(18, 6), payload.costoUnitario)
    .input('cantidadIngresada', sql.Decimal(18, 2), payload.cantidadIngresada)
    .input('cantidadDisponible', sql.Decimal(18, 2), payload.cantidadDisponible)
    .input('fechaVencimiento', sql.DateTime, payload.fechaVencimiento)
    .input('numeroLote', sql.VarChar(50), payload.numeroLote)
    .query(`
      INSERT INTO Lotes (idEmpresa, idProducto, idSucursal, costoUnitario, cantidadIngresada, cantidadDisponible, fechaVencimiento, numeroLote)
      OUTPUT INSERTED.idLote
      VALUES (@idEmpresa, @idProducto, @idSucursal, @costoUnitario, @cantidadIngresada, @cantidadDisponible, @fechaVencimiento, @numeroLote)
    `);
  return r.recordset?.[0]?.idLote ?? null;
}

async function insertarLoteUbicacion(transaction, idLote, idUbicacion, cantidad) {
  await transaction
    .request()
    .input('idLote', sql.UniqueIdentifier, idLote)
    .input('idUbicacion', sql.Int, idUbicacion)
    .input('cantidad', sql.Int, cantidad)
    .query('INSERT INTO LotesUbicacion (idLote, idUbicacion, cantidad) VALUES (@idLote, @idUbicacion, @cantidad)');
}

async function actualizarDetalle(pool, detalle) {
  const pUnitarioFormateado = parseFloat(detalle.pUnitario);
  await pool
    .request()
    .input('idDetalleCompra', sql.Int, detalle.idDetalleCompra)
    .input('idEmpresa', sql.UniqueIdentifier, detalle.idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, detalle.idSucursal)
    .input('idCompra', sql.UniqueIdentifier, detalle.idCompra)
    .input('cantidad', sql.Decimal(18, 3), detalle.cantidad)
    .input('idProducto', sql.UniqueIdentifier, detalle.idProducto)
    .input('idPresentacion', sql.Int, detalle.idPresentacion)
    .input('pUnitario', sql.Decimal(18, 5), pUnitarioFormateado)
    .input('total', sql.Decimal(18, 2), detalle.total)
    .query(
      'UPDATE DetalleCompras SET idSucursal = @idSucursal, cantidad = @cantidad, idProducto = @idProducto, idPresentacion = @idPresentacion, pUnitario = @pUnitario, total = @total WHERE idDetalleCompra = @idDetalleCompra AND idCompra = @idCompra'
    );
}

async function eliminarPorCompra(pool, idCompra) {
  const result = await pool
    .request()
    .input('idCompra', sql.UniqueIdentifier, idCompra)
    .query('DELETE FROM DetalleCompras WHERE idCompra = @idCompra');
  return result.rowsAffected;
}

module.exports = {
  listarPorCompra,
  insertarDetalle,
  insertarDetallePool,
  obtenerNumeroLoteCompra,
  obtenerSiguienteNumeroLote,
  actualizarNumeroLoteCompra,
  insertarLote,
  insertarLoteUbicacion,
  actualizarDetalle,
  eliminarPorCompra
};
