const sql = require('mssql');

exports.listarPorEmpresaYPeriodo = async (pool, idEmpresa, fechaInicio, fechaFin) => {
  try {
    const result = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('fechaInicio', sql.Date, fechaInicio)
      .input('fechaFin', sql.Date, fechaFin)
      .query(`
        SELECT idGasto, CONVERT(VARCHAR(10), fecha, 120) AS fecha, tipo, monto, descripcion, CONVERT(VARCHAR(19), fRegistro, 120) AS fRegistro
        FROM Gastos
        WHERE idEmpresa = @idEmpresa AND fecha >= @fechaInicio AND fecha <= @fechaFin
        ORDER BY fecha DESC
      `);
    return result.recordset || [];
  } catch (err) {
    if (err.number === 208 || /Invalid object name|Gastos/.test(String(err.message))) return [];
    throw err;
  }
};

exports.crear = async (pool, idEmpresa, datos, idUsuario) => {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fecha', sql.Date, datos.fecha)
    .input('tipo', sql.VarChar(30), datos.tipo || 'ADMINISTRACION')
    .input('monto', sql.Decimal(18, 2), datos.monto)
    .input('descripcion', sql.VarChar(500), datos.descripcion || null)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario || null)
    .query(`
      INSERT INTO Gastos (idEmpresa, fecha, tipo, monto, descripcion, idUsuario)
      OUTPUT INSERTED.idGasto
      VALUES (@idEmpresa, @fecha, @tipo, @monto, @descripcion, @idUsuario)
    `);
  return result.recordset[0];
};

exports.eliminar = async (pool, idGasto, idEmpresa) => {
  try {
    await pool.request()
      .input('idGasto', sql.UniqueIdentifier, idGasto)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query('DELETE FROM Gastos WHERE idGasto = @idGasto AND idEmpresa = @idEmpresa');
  } catch (err) {
    if (err.number === 208 || /Invalid object name|Gastos/.test(String(err.message))) return;
    throw err;
  }
};
