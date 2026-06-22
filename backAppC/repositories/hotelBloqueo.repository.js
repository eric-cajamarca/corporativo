const sql = require('mssql');

function selectBloqueoBase() {
  return `
    SELECT b.idBloqueo, b.idEmpresa, b.idProductoHabitacion,
           CONVERT(VARCHAR(19), b.fechaDesde, 120) AS fechaDesde,
           CONVERT(VARCHAR(19), b.fechaHasta, 120) AS fechaHasta,
           b.motivo, b.observaciones,
           CONVERT(VARCHAR(19), b.fRegistro, 120) AS fRegistro,
           p.codigo AS habitacionCodigo, p.descripcion AS habitacionDescripcion
    FROM HotelBloqueoHabitacion b
    INNER JOIN Productos p ON b.idProductoHabitacion = p.idProducto
  `;
}

async function listarPorEmpresaEnRango(pool, idEmpresa, fechaDesde, fechaHasta) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fechaDesde', sql.DateTime, fechaDesde)
    .input('fechaHasta', sql.DateTime, fechaHasta)
    .query(`
      ${selectBloqueoBase()}
      WHERE b.idEmpresa = @idEmpresa
        AND b.fechaDesde < @fechaHasta
        AND b.fechaHasta > @fechaDesde
      ORDER BY b.fechaDesde, p.codigo
    `);
  return result.recordset;
}

async function listarSolapantesHabitacion(pool, idEmpresa, idProductoHabitacion, fechaDesde, fechaHasta, excluirIdBloqueo = null) {
  const req = pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProductoHabitacion', sql.UniqueIdentifier, idProductoHabitacion)
    .input('fechaDesde', sql.DateTime, fechaDesde)
    .input('fechaHasta', sql.DateTime, fechaHasta);
  let excl = '';
  if (excluirIdBloqueo) {
    req.input('excluirIdBloqueo', sql.UniqueIdentifier, excluirIdBloqueo);
    excl = ' AND b.idBloqueo <> @excluirIdBloqueo ';
  }
  const result = await req.query(`
    SELECT b.idBloqueo, b.motivo,
           CONVERT(VARCHAR(19), b.fechaDesde, 120) AS fechaDesde,
           CONVERT(VARCHAR(19), b.fechaHasta, 120) AS fechaHasta
    FROM HotelBloqueoHabitacion b
    WHERE b.idEmpresa = @idEmpresa
      AND b.idProductoHabitacion = @idProductoHabitacion
      AND b.fechaDesde < @fechaHasta
      AND b.fechaHasta > @fechaDesde
      ${excl}
  `);
  return result.recordset;
}

async function obtenerPorId(pool, idBloqueo, idEmpresa) {
  const result = await pool.request()
    .input('idBloqueo', sql.UniqueIdentifier, idBloqueo)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`${selectBloqueoBase()} WHERE b.idBloqueo = @idBloqueo AND b.idEmpresa = @idEmpresa`);
  return result.recordset[0] || null;
}

async function insertar(pool, idEmpresa, payload, idUsuario) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProductoHabitacion', sql.UniqueIdentifier, payload.idProductoHabitacion)
    .input('fechaDesde', sql.DateTime, payload.fechaDesde)
    .input('fechaHasta', sql.DateTime, payload.fechaHasta)
    .input('motivo', sql.VarChar(30), payload.motivo || 'mantenimiento')
    .input('observaciones', sql.VarChar(500), payload.observaciones || null)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario || null)
    .query(`
      INSERT INTO HotelBloqueoHabitacion
        (idEmpresa, idProductoHabitacion, fechaDesde, fechaHasta, motivo, observaciones, idUsuario)
      OUTPUT INSERTED.idBloqueo
      VALUES
        (@idEmpresa, @idProductoHabitacion, @fechaDesde, @fechaHasta, @motivo, @observaciones, @idUsuario)
    `);
  return result.recordset[0]?.idBloqueo;
}

async function eliminar(pool, idBloqueo, idEmpresa) {
  const result = await pool.request()
    .input('idBloqueo', sql.UniqueIdentifier, idBloqueo)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      DELETE FROM HotelBloqueoHabitacion
      WHERE idBloqueo = @idBloqueo AND idEmpresa = @idEmpresa
    `);
  return result.rowsAffected[0];
}

module.exports = {
  listarPorEmpresaEnRango,
  listarSolapantesHabitacion,
  obtenerPorId,
  insertar,
  eliminar
};
