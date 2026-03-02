const sql = require('mssql');

async function listarPorHabitacion(pool, idEmpresa, idProductoHabitacion) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
    .query(`
      SELECT c.idConsumo, c.idProductoHabitacion, c.idProducto, c.cantidad, c.pUnitario,
             CONVERT(VARCHAR(19), c.fRegistro, 120) AS fRegistro,
             p.codigo AS productoCodigo, p.descripcion AS productoDescripcion
      FROM ConsumoHabitacion c
      INNER JOIN Productos p ON c.idProducto = p.idProducto
      WHERE c.idEmpresa = @idEmpresa AND c.idProductoHabitacion = @idProductoHabitacion
      ORDER BY c.fRegistro
    `);
  return result.recordset;
}

async function listarPorEmpresa(pool, idEmpresa) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT c.idConsumo, c.idProductoHabitacion, c.idProducto, c.cantidad, c.pUnitario,
             CONVERT(VARCHAR(19), c.fRegistro, 120) AS fRegistro,
             p.codigo AS productoCodigo, p.descripcion AS productoDescripcion,
             ph.descripcion AS habitacionDescripcion, ph.codigo AS habitacionCodigo
      FROM ConsumoHabitacion c
      INNER JOIN Productos p ON c.idProducto = p.idProducto
      INNER JOIN Productos ph ON c.idProductoHabitacion = ph.idProducto
      WHERE c.idEmpresa = @idEmpresa
      ORDER BY ph.codigo, c.fRegistro
    `);
  return result.recordset;
}

async function agregar(pool, idEmpresa, payload, idUsuario) {
  const { idProductoHabitacion, idProducto, cantidad, pUnitario } = payload;
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('cantidad', sql.Decimal(18, 3), cantidad)
    .input('pUnitario', sql.Decimal(18, 6), pUnitario ?? 0)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .query(`
      INSERT INTO ConsumoHabitacion (idEmpresa, idProductoHabitacion, idProducto, cantidad, pUnitario, idUsuario)
      OUTPUT INSERTED.idConsumo, INSERTED.cantidad, INSERTED.pUnitario
      VALUES (@idEmpresa, @idProductoHabitacion, @idProducto, @cantidad, @pUnitario, @idUsuario)
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
      WHERE idConsumo = @idConsumo AND idEmpresa = @idEmpresa
    `);
}

async function eliminar(pool, idConsumo, idEmpresa) {
  const result = await pool.request()
    .input('idConsumo', sql.UniqueIdentifier, idConsumo)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('DELETE FROM ConsumoHabitacion WHERE idConsumo = @idConsumo AND idEmpresa = @idEmpresa');
  return result.rowsAffected[0];
}

async function limpiarPorHabitacion(pool, idEmpresa, idProductoHabitacion) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
    .query('DELETE FROM ConsumoHabitacion WHERE idEmpresa = @idEmpresa AND idProductoHabitacion = @idProductoHabitacion');
  return result.rowsAffected[0];
}

async function obtenerPorId(pool, idConsumo, idEmpresa) {
  const result = await pool.request()
    .input('idConsumo', sql.UniqueIdentifier, idConsumo)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT idConsumo FROM ConsumoHabitacion WHERE idConsumo = @idConsumo AND idEmpresa = @idEmpresa');
  return result.recordset[0] || null;
}

module.exports = { listarPorHabitacion, listarPorEmpresa, agregar, actualizar, eliminar, limpiarPorHabitacion, obtenerPorId };
