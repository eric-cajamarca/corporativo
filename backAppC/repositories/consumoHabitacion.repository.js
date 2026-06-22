const sql = require('mssql');

async function listarPorHabitacion(pool, idEmpresa, idProductoHabitacion) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
    .query(`
      SELECT c.idConsumo, c.idProductoHabitacion, c.idEstancia, c.idProducto, c.cantidad, c.pUnitario,
             c.estadoConsumo,
             CONVERT(VARCHAR(19), c.fRegistro, 120) AS fRegistro,
             p.codigo AS productoCodigo, p.descripcion AS productoDescripcion
      FROM ConsumoHabitacion c
      INNER JOIN Productos p ON c.idProducto = p.idProducto
      WHERE c.idEmpresa = @idEmpresa AND c.idProductoHabitacion = @idProductoHabitacion
        AND ISNULL(c.estadoConsumo, 'pendiente') = 'pendiente'
      ORDER BY c.fRegistro
    `);
  return result.recordset;
}

async function listarPorEmpresa(pool, idEmpresa) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT c.idConsumo, c.idProductoHabitacion, c.idEstancia, c.idProducto, c.cantidad, c.pUnitario,
             c.estadoConsumo,
             CONVERT(VARCHAR(19), c.fRegistro, 120) AS fRegistro,
             p.codigo AS productoCodigo, p.descripcion AS productoDescripcion,
             ph.descripcion AS habitacionDescripcion, ph.codigo AS habitacionCodigo
      FROM ConsumoHabitacion c
      INNER JOIN Productos p ON c.idProducto = p.idProducto
      INNER JOIN Productos ph ON c.idProductoHabitacion = ph.idProducto
      WHERE c.idEmpresa = @idEmpresa
        AND ISNULL(c.estadoConsumo, 'pendiente') = 'pendiente'
      ORDER BY ph.codigo, c.fRegistro
    `);
  return result.recordset;
}

async function listarPendientesPorEstancia(pool, idEmpresa, idEstancia) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idEstancia', sql.UniqueIdentifier, idEstancia)
    .query(`
      SELECT c.idConsumo, c.idProductoHabitacion, c.idEstancia, c.idProducto, c.cantidad, c.pUnitario,
             c.estadoConsumo,
             p.codigo AS productoCodigo, p.descripcion AS productoDescripcion
      FROM ConsumoHabitacion c
      INNER JOIN Productos p ON c.idProducto = p.idProducto
      WHERE c.idEmpresa = @idEmpresa AND c.idEstancia = @idEstancia
        AND ISNULL(c.estadoConsumo, 'pendiente') = 'pendiente'
      ORDER BY c.fRegistro
    `);
  return result.recordset;
}

/** Consumos pendientes al check-out: por estancia y legacy sin idEstancia en la misma habitación. */
async function listarPendientesParaCheckout(pool, idEmpresa, idEstancia, idProductoHabitacion) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idEstancia', sql.UniqueIdentifier, idEstancia)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
    .query(`
      SELECT c.idConsumo, c.idProductoHabitacion, c.idEstancia, c.idProducto, c.cantidad, c.pUnitario,
             c.estadoConsumo,
             p.codigo AS productoCodigo, p.descripcion AS productoDescripcion
      FROM ConsumoHabitacion c
      INNER JOIN Productos p ON c.idProducto = p.idProducto
      WHERE c.idEmpresa = @idEmpresa
        AND c.idProductoHabitacion = @idProductoHabitacion
        AND ISNULL(c.estadoConsumo, 'pendiente') = 'pendiente'
        AND (c.idEstancia = @idEstancia OR c.idEstancia IS NULL)
      ORDER BY c.fRegistro
    `);
  return result.recordset;
}

async function agregar(pool, idEmpresa, payload, idUsuario) {
  const { idProductoHabitacion, idEstancia, idProducto, cantidad, pUnitario } = payload;
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
    .input('idEstancia', sql.UniqueIdentifier, idEstancia)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('cantidad', sql.Decimal(18, 3), cantidad)
    .input('pUnitario', sql.Decimal(18, 6), pUnitario ?? 0)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .query(`
      INSERT INTO ConsumoHabitacion (idEmpresa, idProductoHabitacion, idEstancia, idProducto, cantidad, pUnitario, idUsuario, estadoConsumo)
      OUTPUT INSERTED.idConsumo, INSERTED.cantidad, INSERTED.pUnitario
      VALUES (@idEmpresa, @idProductoHabitacion, @idEstancia, @idProducto, @cantidad, @pUnitario, @idUsuario, 'pendiente')
    `);
  return result.recordset[0];
}

async function actualizar(pool, idConsumo, idEmpresa, payload) {
  const { cantidad, pUnitario } = payload;
  await pool.request()
    .input('idConsumo', sql.UniqueIdentifier, idConsumo)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('cantidad', sql.Decimal(18, 3), cantidad)
    .input('pUnitario', sql.Decimal(18, 6), pUnitario ?? 0)
    .query(`
      UPDATE ConsumoHabitacion SET cantidad = @cantidad, pUnitario = @pUnitario
      WHERE idConsumo = @idConsumo AND idEmpresa = @idEmpresa AND ISNULL(estadoConsumo,'pendiente') = 'pendiente'
    `);
}

async function eliminar(pool, idConsumo, idEmpresa) {
  const result = await pool.request()
    .input('idConsumo', sql.UniqueIdentifier, idConsumo)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      DELETE FROM ConsumoHabitacion
      WHERE idConsumo = @idConsumo AND idEmpresa = @idEmpresa AND ISNULL(estadoConsumo,'pendiente') = 'pendiente'
    `);
  return result.rowsAffected[0];
}

async function limpiarPorHabitacion(pool, idEmpresa, idProductoHabitacion) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
    .query(`
      DELETE FROM ConsumoHabitacion
      WHERE idEmpresa = @idEmpresa AND idProductoHabitacion = @idProductoHabitacion
        AND ISNULL(estadoConsumo,'pendiente') = 'pendiente'
    `);
  return result.rowsAffected[0];
}

async function limpiarPendientesPorEstancia(pool, idEmpresa, idEstancia) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idEstancia', sql.UniqueIdentifier, idEstancia)
    .query(`
      DELETE FROM ConsumoHabitacion
      WHERE idEmpresa = @idEmpresa AND idEstancia = @idEstancia
        AND ISNULL(estadoConsumo,'pendiente') = 'pendiente'
    `);
  return result.rowsAffected[0];
}

async function marcarFacturadosPorEstancia(pool, idEmpresa, idEstancia) {
  await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idEstancia', sql.UniqueIdentifier, idEstancia)
    .query(`
      UPDATE ConsumoHabitacion SET estadoConsumo = 'facturado'
      WHERE idEmpresa = @idEmpresa AND idEstancia = @idEstancia AND ISNULL(estadoConsumo,'pendiente') = 'pendiente'
    `);
}

async function marcarFacturadosCheckout(pool, idEmpresa, idEstancia, idProductoHabitacion) {
  await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idEstancia', sql.UniqueIdentifier, idEstancia)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
    .query(`
      UPDATE ConsumoHabitacion SET
        estadoConsumo = 'facturado',
        idEstancia = COALESCE(idEstancia, @idEstancia)
      WHERE idEmpresa = @idEmpresa
        AND idProductoHabitacion = @idProductoHabitacion
        AND ISNULL(estadoConsumo, 'pendiente') = 'pendiente'
        AND (idEstancia = @idEstancia OR idEstancia IS NULL)
    `);
}

async function listarPorEstancia(pool, idEmpresa, idEstancia, idProductoHabitacion, checkIn, checkOut) {
  const req = pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idEstancia', sql.UniqueIdentifier, idEstancia)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
    .input('checkIn', sql.DateTime, checkIn)
    .input('checkOut', sql.DateTime, checkOut);
  const result = await req.query(`
    SELECT c.idConsumo, c.idProducto, c.cantidad, c.pUnitario, c.estadoConsumo,
           CONVERT(VARCHAR(19), c.fRegistro, 120) AS fRegistro,
           p.codigo AS productoCodigo, p.descripcion AS productoDescripcion
    FROM ConsumoHabitacion c
    INNER JOIN Productos p ON c.idProducto = p.idProducto
    WHERE c.idEmpresa = @idEmpresa
      AND (
        c.idEstancia = @idEstancia
        OR (
          c.idProductoHabitacion = @idProductoHabitacion
          AND c.fRegistro >= @checkIn
          AND c.fRegistro <= @checkOut
        )
      )
    ORDER BY c.fRegistro
  `);
  return result.recordset;
}

async function totalConsumoPorEstancia(pool, idEmpresa, idEstancia, idProductoHabitacion, checkIn, checkOut) {
  const rows = await listarPorEstancia(pool, idEmpresa, idEstancia, idProductoHabitacion, checkIn, checkOut);
  let total = 0;
  for (const r of rows) {
    total += (Number(r.cantidad) || 0) * (Number(r.pUnitario) || 0);
  }
  return { total, lineas: rows.length };
}

async function obtenerPorId(pool, idConsumo, idEmpresa) {
  const result = await pool.request()
    .input('idConsumo', sql.UniqueIdentifier, idConsumo)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT idConsumo, idEstancia, estadoConsumo
      FROM ConsumoHabitacion
      WHERE idConsumo = @idConsumo AND idEmpresa = @idEmpresa
    `);
  return result.recordset[0] || null;
}

module.exports = {
  listarPorHabitacion,
  listarPorEmpresa,
  listarPendientesPorEstancia,
  listarPendientesParaCheckout,
  agregar,
  actualizar,
  eliminar,
  limpiarPorHabitacion,
  limpiarPendientesPorEstancia,
  marcarFacturadosPorEstancia,
  marcarFacturadosCheckout,
  obtenerPorId,
  listarPorEstancia,
  totalConsumoPorEstancia
};
