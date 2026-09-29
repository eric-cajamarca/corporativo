const sql = require('mssql');

async function reporteConsumo(pool, idEmpresa, fechaDesde, fechaHasta) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fechaDesde', sql.DateTime, new Date(`${fechaDesde}T00:00:00`))
    .input('fechaHasta', sql.DateTime, new Date(`${fechaHasta}T23:59:59`))
    .query(`
      SELECT ISNULL(SUM(c.cantidad * c.pUnitario), 0) AS ingresoConsumo,
             COUNT(*) AS lineasFacturadas
      FROM ConsumoHabitacion c
      WHERE c.idEmpresa = @idEmpresa
        AND ISNULL(c.estadoConsumo, 'pendiente') IN ('facturado', 'pendiente')
        AND c.fRegistro >= @fechaDesde
        AND c.fRegistro <= @fechaHasta
    `);
  return {
    ingresoConsumo: Number(result.recordset[0]?.ingresoConsumo) || 0,
    lineasFacturadas: Number(result.recordset[0]?.lineasFacturadas) || 0
  };
}

async function reporteConsumoPorHabitacion(pool, idEmpresa, fechaDesde, fechaHasta) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fechaDesde', sql.DateTime, new Date(`${fechaDesde}T00:00:00`))
    .input('fechaHasta', sql.DateTime, new Date(`${fechaHasta}T23:59:59`))
    .query(`
      SELECT c.idProductoHabitacion,
             ISNULL(SUM(c.cantidad * c.pUnitario), 0) AS ingresoConsumo,
             COUNT(*) AS lineas
      FROM ConsumoHabitacion c
      WHERE c.idEmpresa = @idEmpresa
        AND ISNULL(c.estadoConsumo, 'pendiente') IN ('facturado', 'pendiente')
        AND c.fRegistro >= @fechaDesde
        AND c.fRegistro <= @fechaHasta
      GROUP BY c.idProductoHabitacion
    `);
  return result.recordset.map((row) => ({
    idProductoHabitacion: row.idProductoHabitacion,
    ingresoConsumo: Number(row.ingresoConsumo) || 0,
    lineas: Number(row.lineas) || 0
  }));
}

module.exports = {
  reporteConsumo,
  reporteConsumoPorHabitacion
};
