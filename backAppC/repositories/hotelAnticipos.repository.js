const sql = require('mssql');

async function listarPorEmpresa(pool, idEmpresa, filtros = {}) {
  const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  let where = 'WHERE a.idEmpresa = @idEmpresa';
  if (filtros.estado) {
    req.input('estado', sql.VarChar(20), filtros.estado);
    where += ' AND a.estado = @estado';
  }
  if (filtros.idReserva) {
    req.input('idReserva', sql.UniqueIdentifier, filtros.idReserva);
    where += ' AND a.idReserva = @idReserva';
  }
  if (filtros.idEstancia) {
    req.input('idEstancia', sql.UniqueIdentifier, filtros.idEstancia);
    where += ' AND a.idEstancia = @idEstancia';
  }
  const result = await req.query(`
    SELECT a.idAnticipo, a.idEmpresa, a.idReserva, a.idEstancia, a.monto, a.concepto,
           a.idVenta, a.estado,
           CONVERT(VARCHAR(19), a.fRegistro, 120) AS fRegistro
    FROM HotelAnticipos a
    ${where}
    ORDER BY a.fRegistro DESC
  `);
  return result.recordset;
}

async function listarPendientesCheckout(pool, idEmpresa, idEstancia, idReserva) {
  const req = pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idEstancia', sql.UniqueIdentifier, idEstancia);
  let cond = '(a.idEstancia = @idEstancia';
  if (idReserva) {
    req.input('idReserva', sql.UniqueIdentifier, idReserva);
    cond += ' OR a.idReserva = @idReserva';
  }
  cond += ')';
  const result = await req.query(`
    SELECT a.idAnticipo, a.monto, a.concepto, a.idReserva, a.idEstancia
    FROM HotelAnticipos a
    WHERE a.idEmpresa = @idEmpresa
      AND a.estado = 'pendiente'
      AND ${cond}
  `);
  return result.recordset;
}

async function insertar(pool, idEmpresa, payload, idUsuario) {
  const result = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idReserva', sql.UniqueIdentifier, payload.idReserva || null)
    .input('idEstancia', sql.UniqueIdentifier, payload.idEstancia || null)
    .input('monto', sql.Decimal(18, 2), payload.monto)
    .input('concepto', sql.VarChar(200), payload.concepto || null)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario || null)
    .query(`
      INSERT INTO HotelAnticipos (idEmpresa, idReserva, idEstancia, monto, concepto, idUsuario, estado)
      OUTPUT INSERTED.idAnticipo
      VALUES (@idEmpresa, @idReserva, @idEstancia, @monto, @concepto, @idUsuario, 'pendiente')
    `);
  return result.recordset[0]?.idAnticipo;
}

async function marcarAplicadosCheckout(pool, idEmpresa, idEstancia, idReserva, idVenta) {
  const req = pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idEstancia', sql.UniqueIdentifier, idEstancia)
    .input('idVenta', sql.Int, idVenta);
  let cond = 'idEstancia = @idEstancia';
  if (idReserva) {
    req.input('idReserva', sql.UniqueIdentifier, idReserva);
    cond = `(idEstancia = @idEstancia OR idReserva = @idReserva)`;
  }
  await req.query(`
    UPDATE HotelAnticipos SET estado = 'aplicado', idVenta = @idVenta
    WHERE idEmpresa = @idEmpresa AND estado = 'pendiente' AND ${cond}
  `);
}

async function anular(pool, idAnticipo, idEmpresa) {
  const result = await pool.request()
    .input('idAnticipo', sql.UniqueIdentifier, idAnticipo)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      UPDATE HotelAnticipos SET estado = 'anulado'
      WHERE idAnticipo = @idAnticipo AND idEmpresa = @idEmpresa AND estado = 'pendiente'
    `);
  return result.rowsAffected[0];
}

module.exports = {
  listarPorEmpresa,
  listarPendientesCheckout,
  insertar,
  marcarAplicadosCheckout,
  anular
};
