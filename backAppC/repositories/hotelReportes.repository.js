const sql = require('mssql');

async function reporteOcupacion(pool, idEmpresa, fechaDesde, fechaHasta, totalHabitaciones) {
  const habitaciones = Math.max(1, Number(totalHabitaciones) || 1);
  const dias = Math.max(1, Math.ceil((new Date(fechaHasta) - new Date(fechaDesde)) / 86400000) + 1);
  const capacidad = habitaciones * dias;

  const estancias = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fechaDesde', sql.DateTime, new Date(`${fechaDesde}T00:00:00`))
    .input('fechaHasta', sql.DateTime, new Date(`${fechaHasta}T23:59:59`))
    .query(`
      SELECT COUNT(DISTINCT e.idEstancia) AS estanciasCerradas,
             ISNULL(SUM(e.totalHabitacion), 0) AS ingresoHabitacion
      FROM Estancias e
      WHERE e.idEmpresa = @idEmpresa
        AND e.estadoEstancia = 'checkout'
        AND e.checkOutReal >= @fechaDesde
        AND e.checkOutReal <= @fechaHasta
    `);

  const activas = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fechaDesde', sql.DateTime, new Date(`${fechaDesde}T00:00:00`))
    .input('fechaHasta', sql.DateTime, new Date(`${fechaHasta}T23:59:59`))
    .query(`
      SELECT COUNT(*) AS estanciasActivas
      FROM Estancias e
      WHERE e.idEmpresa = @idEmpresa
        AND e.estadoEstancia = 'activa'
        AND e.checkIn <= @fechaHasta
        AND e.checkOutPrevisto >= @fechaDesde
    `);

  const nochesOcupadas = Number(estancias.recordset[0]?.estanciasCerradas || 0)
    + Number(activas.recordset[0]?.estanciasActivas || 0);
  const ocupacionPct = Math.min(100, Math.round((nochesOcupadas / capacidad) * 10000) / 100);

  return {
    habitaciones,
    dias,
    nochesOcupadas,
    ocupacionPct,
    ingresoHabitacion: Number(estancias.recordset[0]?.ingresoHabitacion) || 0
  };
}

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
        AND c.estadoConsumo = 'facturado'
        AND c.fRegistro >= @fechaDesde
        AND c.fRegistro <= @fechaHasta
    `);
  return {
    ingresoConsumo: Number(result.recordset[0]?.ingresoConsumo) || 0,
    lineasFacturadas: Number(result.recordset[0]?.lineasFacturadas) || 0
  };
}

async function reporteReservas(pool, idEmpresa, fechaDesde, fechaHasta) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fechaDesde', sql.Date, fechaDesde)
    .input('fechaHasta', sql.Date, fechaHasta)
    .query(`
      SELECT
        SUM(CASE WHEN estado = 'cancelada' THEN 1 ELSE 0 END) AS cancelaciones,
        SUM(CASE WHEN estado = 'no_show' THEN 1 ELSE 0 END) AS noShow,
        SUM(CASE WHEN estado = 'convertida' THEN 1 ELSE 0 END) AS convertidas,
        SUM(CASE WHEN estado = 'confirmada' THEN 1 ELSE 0 END) AS confirmadas
      FROM Reservas
      WHERE idEmpresa = @idEmpresa
        AND fechaEntrada >= @fechaDesde
        AND fechaEntrada <= @fechaHasta
    `);
  const row = result.recordset[0] || {};
  return {
    cancelaciones: Number(row.cancelaciones) || 0,
    noShow: Number(row.noShow) || 0,
    convertidas: Number(row.convertidas) || 0,
    confirmadas: Number(row.confirmadas) || 0
  };
}

module.exports = {
  reporteOcupacion,
  reporteConsumo,
  reporteReservas
};
