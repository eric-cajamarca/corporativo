// repositories/inventario.repository.js
const sql = require('mssql');

/**
 * Inserta una fila en MovimientosInventario (esquema con idProducto y cantidad NOT NULL).
 * Usado cuando la tabla exige idProducto/cantidad por fila (una fila por ítem).
 * Devuelve idMovimiento insertado.
 */
exports.insertarFilaMovimiento = async (transaction, datos) => {
  const {
    idEmpresa,
    idSucursal,
    idProducto,
    tipoMovimiento,
    cantidad,
    docRelacionado,
    idUsuario,
    observaciones,
    costoUnitario,
    idLote
  } = datos;
  const result = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('tipoMovimiento', sql.VarChar(2), tipoMovimiento)
    .input('cantidad', sql.Decimal(18, 3), cantidad)
    .input('docRelacionado', sql.VarChar(50), docRelacionado || null)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('observaciones', sql.VarChar(255), observaciones || null)
    .input('costoUnitario', sql.Decimal(18, 6), costoUnitario != null ? parseFloat(costoUnitario) : null)
    .input('idLote', sql.UniqueIdentifier, idLote || null)
    .query(`
      INSERT INTO MovimientosInventario (idEmpresa, idSucursal, idProducto, tipoMovimiento, cantidad, docRelacionado, idUsuario, observaciones, costoUnitario, idLote)
      OUTPUT INSERTED.idMovimiento
      VALUES (@idEmpresa, @idSucursal, @idProducto, @tipoMovimiento, @cantidad, @docRelacionado, @idUsuario, @observaciones, @costoUnitario, @idLote)
    `);
  return result.recordset && result.recordset[0] ? result.recordset[0].idMovimiento : null;
};

/**
 * Siguiente número de lote para la empresa (inventario inicial / entrada).
 */
exports.obtenerSiguienteNumeroLote = async (transaction, idEmpresa) => {
  const r = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT ISNULL(MAX(TRY_CAST(numeroLote AS INT)), 0) + 1 AS siguiente
      FROM Lotes WHERE idEmpresa = @idEmpresa
    `);
  const v = r.recordset && r.recordset[0] ? r.recordset[0].siguiente : 1;
  return typeof v === 'number' ? v : (parseInt(v, 10) || 1);
};

/**
 * Crea lote sin compra (inventario inicial / entrada varia / reajuste positivo).
 * Opcional: fechaVencimiento, numeroLote, idUbicacionDefault para LotesUbicacion.
 */
exports.crearLoteSinCompra = async (transaction, datos) => {
  const {
    idEmpresa,
    idProducto,
    idSucursal,
    costoUnitario,
    cantidad,
    fechaVencimiento,
    numeroLote,
    idUbicacionDefault
  } = datos;

  const costo = parseFloat(costoUnitario) || 0;
  const cant = parseFloat(cantidad) || 0;
  const numLote = numeroLote != null && numeroLote !== '' ? String(numeroLote) : null;
  const fechaVenc = fechaVencimiento != null && fechaVencimiento !== '' ? fechaVencimiento : null;

  const req = transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('costoUnitario', sql.Decimal(18, 6), costo)
    .input('cantidadIngresada', sql.Decimal(18, 2), cant)
    .input('cantidadDisponible', sql.Decimal(18, 2), cant)
    .input('fechaVencimiento', sql.DateTime, fechaVenc)
    .input('numeroLote', sql.VarChar(50), numLote);

  const result = await req.query(`
    INSERT INTO Lotes (idEmpresa, idProducto, idSucursal, costoUnitario, cantidadIngresada, cantidadDisponible, fechaVencimiento, numeroLote)
    OUTPUT INSERTED.idLote
    VALUES (@idEmpresa, @idProducto, @idSucursal, @costoUnitario, @cantidadIngresada, @cantidadDisponible, @fechaVencimiento, @numeroLote)
  `);
  const idLote = result.recordset && result.recordset[0] ? result.recordset[0].idLote : null;

  if (idLote && idUbicacionDefault && cant > 0) {
    await transaction.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .input('idUbicacion', sql.Int, idUbicacionDefault)
      .input('cantidad', sql.Decimal(18, 2), Math.round(cant))
      .query('INSERT INTO LotesUbicacion (idLote, idUbicacion, cantidad) VALUES (@idLote, @idUbicacion, @cantidad)');
  }
  return idLote;
};

/**
 * Lista movimientos con filtros (idEmpresa obligatorio).
 * Compatible con esquema donde MovimientosInventario tiene idProducto/cantidad por fila (una fila por ítem).
 */
exports.listarMovimientos = async (pool, filtros) => {
  const { idEmpresa, fechaInicio, fechaFin, idSucursal, tipoMovimiento } = filtros;
  const request = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);

  let tipos = ['EN', 'SA', 'AJ'];
  if (tipoMovimiento && tipoMovimiento !== '') {
    tipos = [String(tipoMovimiento).toUpperCase().substring(0, 2)];
  }
  tipos.forEach((t, i) => request.input(`tipo${i}`, sql.VarChar(2), t));
  const placeholders = tipos.map((_, i) => `@tipo${i}`).join(', ');
  let where = ` AND m.tipoMovimiento IN (${placeholders})`;
  if (fechaInicio) {
    request.input('fechaInicio', sql.DateTime, fechaInicio);
    where += ' AND m.fMovimiento >= @fechaInicio';
  }
  if (fechaFin) {
    request.input('fechaFin', sql.DateTime, fechaFin);
    where += ' AND m.fMovimiento <= @fechaFin';
  }
  if (idSucursal) {
    request.input('idSucursal', sql.UniqueIdentifier, idSucursal);
    where += ' AND m.idSucursal = @idSucursal';
  }

  const result = await request.query(`
    SELECT m.idMovimiento, m.idSucursal, s.nombre AS sucursal, m.tipoMovimiento, m.docRelacionado,
           CONVERT(VARCHAR(19), m.fMovimiento, 120) AS fMovimiento, m.observaciones, u.nombre AS usuario,
           1 AS totalProductos, m.cantidad AS totalCantidad
    FROM MovimientosInventario m
    INNER JOIN Sucursal s ON m.idSucursal = s.idSucursal
    INNER JOIN UsuarioWeb u ON m.idUsuario = u.idUsuario
    WHERE m.idEmpresa = @idEmpresa ${where}
    ORDER BY m.fMovimiento DESC
  `);
  return result.recordset || [];
};

/**
 * Obtiene un movimiento por id (para detalle en modal). Incluye producto si existe.
 */
exports.obtenerMovimientoPorId = async (pool, idEmpresa, idMovimiento) => {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idMovimiento', sql.Int, idMovimiento)
    .query(`
      SELECT m.idMovimiento, m.idSucursal, s.nombre AS sucursal, m.tipoMovimiento, m.docRelacionado,
             CONVERT(VARCHAR(19), m.fMovimiento, 120) AS fMovimiento, m.observaciones, u.nombre AS usuario,
             m.idProducto, m.cantidad, m.costoUnitario, p.codigo AS productoCodigo, p.descripcion AS productoDescripcion
      FROM MovimientosInventario m
      INNER JOIN Sucursal s ON m.idSucursal = s.idSucursal
      INNER JOIN UsuarioWeb u ON m.idUsuario = u.idUsuario
      LEFT JOIN Productos p ON m.idProducto = p.idProducto
      WHERE m.idEmpresa = @idEmpresa AND m.idMovimiento = @idMovimiento
    `);
  return result.recordset && result.recordset[0] ? result.recordset[0] : null;
};
