const sql = require('mssql');

const ESTADOS_VALIDOS = ['sucia', 'en_limpieza', 'limpia', 'fuera_servicio'];

async function listarPorEmpresa(pool, idEmpresa) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT h.idEmpresa, h.idProductoHabitacion, h.estadoLimpieza, h.observaciones,
             CONVERT(VARCHAR(19), h.fActualizacion, 120) AS fActualizacion,
             p.codigo AS habitacionCodigo, p.descripcion AS habitacionDescripcion
      FROM HotelHousekeeping h
      INNER JOIN Productos p ON h.idProductoHabitacion = p.idProducto
      WHERE h.idEmpresa = @idEmpresa
      ORDER BY p.codigo
    `);
  return result.recordset;
}

async function obtenerPorHabitacion(pool, idEmpresa, idProductoHabitacion) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
    .query(`
      SELECT idEmpresa, idProductoHabitacion, estadoLimpieza, observaciones,
             CONVERT(VARCHAR(19), fActualizacion, 120) AS fActualizacion
      FROM HotelHousekeeping
      WHERE idEmpresa = @idEmpresa AND idProductoHabitacion = @idProductoHabitacion
    `);
  return result.recordset[0] || null;
}

async function upsertEstado(pool, idEmpresa, idProductoHabitacion, estadoLimpieza, observaciones = null) {
  const estado = String(estadoLimpieza || 'limpia').trim().toLowerCase();
  if (!ESTADOS_VALIDOS.includes(estado)) {
    throw new Error(`Estado de limpieza inválido. Use: ${ESTADOS_VALIDOS.join(', ')}`);
  }
  const existente = await obtenerPorHabitacion(pool, idEmpresa, idProductoHabitacion);
  if (!existente) {
    await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
      .input('estadoLimpieza', sql.VarChar(20), estado)
      .input('observaciones', sql.VarChar(500), observaciones)
      .query(`
        INSERT INTO HotelHousekeeping (idEmpresa, idProductoHabitacion, estadoLimpieza, observaciones)
        VALUES (@idEmpresa, @idProductoHabitacion, @estadoLimpieza, @observaciones)
      `);
  } else {
    await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
      .input('estadoLimpieza', sql.VarChar(20), estado)
      .input('observaciones', sql.VarChar(500), observaciones ?? existente.observaciones)
      .query(`
        UPDATE HotelHousekeeping SET
          estadoLimpieza = @estadoLimpieza,
          observaciones = @observaciones,
          fActualizacion = GETDATE()
        WHERE idEmpresa = @idEmpresa AND idProductoHabitacion = @idProductoHabitacion
      `);
  }
  return obtenerPorHabitacion(pool, idEmpresa, idProductoHabitacion);
}

module.exports = {
  ESTADOS_VALIDOS,
  listarPorEmpresa,
  obtenerPorHabitacion,
  upsertEstado
};
