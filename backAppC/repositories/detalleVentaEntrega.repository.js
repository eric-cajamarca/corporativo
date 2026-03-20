/**
 * Repository: DetalleVentaEntrega
 * Entregas parciales por ítem de venta. Filtra por idEmpresa vía Ventas.
 */
const sql = require('mssql');

/**
 * Lista entregas de una venta
 */
exports.listarPorVentaRepo = async (pool, idVenta, idEmpresa) => {
  const result = await pool
    .request()
    .input('idVenta', sql.Int, idVenta)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        e.idEntrega,
        e.idVenta,
        e.idDetalle,
        e.cantidad,
        CONVERT(VARCHAR(19), e.fEntrega, 120) AS fEntrega,
        e.idUsuario,
        e.notas,
        dv.idProducto,
        dv.cantidad AS cantidadPedida,
        dv.cantEntregada,
        p.codigo AS productoCodigo,
        p.descripcion AS productoDescripcion,
        uw.nombres + ' ' + ISNULL(uw.apellidos, '') AS usuarioNombre
      FROM DetalleVentaEntrega e
      INNER JOIN Ventas v ON v.idVenta = e.idVenta AND v.idEmpresa = @idEmpresa
      INNER JOIN DetalleVenta dv ON dv.idDetalle = e.idDetalle AND dv.idVenta = e.idVenta
      INNER JOIN Productos p ON p.idProducto = dv.idProducto
      LEFT JOIN UsuarioWeb uw ON uw.idUsuario = e.idUsuario
      WHERE e.idVenta = @idVenta
      ORDER BY e.fEntrega DESC
    `);
  return result.recordset || [];
};

/**
 * Registra una entrega parcial. En transacción: INSERT DetalleVentaEntrega + UPDATE DetalleVenta.fUltEntrega.
 * cantEntregada se calcula solo desde DetalleDespachos.
 */
exports.crearRepo = async (pool, datos) => {
  const { idVenta, idDetalle, cantidad, idUsuario, notas, idEmpresa } = datos;
  const transaction = pool.transaction();
  try {
    await transaction.begin();

    const request = new sql.Request(transaction);
    request.input('idVenta', sql.Int, idVenta);
    request.input('idDetalle', sql.Int, idDetalle);
    request.input('cantidad', sql.Decimal(18, 3), cantidad);
    request.input('idUsuario', sql.UniqueIdentifier, idUsuario);
    request.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    request.input('notas', sql.VarChar(200), notas || null);

    const insertResult = await request.query(`
      INSERT INTO DetalleVentaEntrega (idVenta, idDetalle, cantidad, idUsuario, notas)
      OUTPUT INSERTED.idEntrega
      VALUES (@idVenta, @idDetalle, @cantidad, @idUsuario, @notas)
    `);
    const idEntrega = insertResult.recordset[0]?.idEntrega;

    await new sql.Request(transaction)
      .input('idDetalle', sql.Int, idDetalle)
      .query(`
        UPDATE DetalleVenta
        SET fUltEntrega = SYSDATETIME()
        WHERE idDetalle = @idDetalle
      `);

    await transaction.commit();
    return idEntrega;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

/**
 * Valida que el detalle pertenezca a la venta y a la empresa, y que cantidad no exceda pendiente
 */
exports.validarDetalleParaEntregaRepo = async (pool, idVenta, idDetalle, cantidad, idEmpresa) => {
  const result = await pool
    .request()
    .input('idVenta', sql.Int, idVenta)
    .input('idDetalle', sql.Int, idDetalle)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT dv.idDetalle, dv.cantidad, dv.cantEntregada,
             (dv.cantidad - ISNULL(dv.cantEntregada, 0)) AS cantPendiente
      FROM DetalleVenta dv
      INNER JOIN Ventas v ON v.idVenta = dv.idVenta AND v.idEmpresa = @idEmpresa
      WHERE dv.idVenta = @idVenta AND dv.idDetalle = @idDetalle
    `);
  const row = result.recordset && result.recordset[0];
  if (!row) return { valido: false, mensaje: 'Detalle no encontrado o no pertenece a la venta.' };
  const pendiente = Number(row.cantPendiente ?? row.cantidad - (row.cantEntregada || 0));
  if (cantidad <= 0) return { valido: false, mensaje: 'La cantidad debe ser mayor a 0.' };
  if (cantidad > pendiente) return { valido: false, mensaje: 'La cantidad no puede superar el pendiente (' + pendiente + ').' };
  return { valido: true };
};
