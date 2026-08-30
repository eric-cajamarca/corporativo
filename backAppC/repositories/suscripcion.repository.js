const sql = require('mssql');

async function obtenerIdEmpresaPrincipal(pool) {
  const r = await pool.request().query('SELECT idEmpresa FROM Empresas WHERE esPrincipal = 1');
  return r.recordset[0]?.idEmpresa ?? null;
}

async function obtenerCelularEmpresa(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT celular FROM Empresas WHERE idEmpresa = @idEmpresa');
  return r.recordset[0]?.celular ?? null;
}

async function insertarPagoSuscripcion(pool, row) {
  return pool
    .request()
    .input('idPago', sql.UniqueIdentifier, row.idPago)
    .input('idEmpresaPrincipal', sql.UniqueIdentifier, row.idEmpresaPrincipal)
    .input('idEmpresaCliente', sql.UniqueIdentifier, row.idEmpresaCliente)
    .input('orderNumber', sql.VarChar(100), row.orderNumber)
    .input('monto', sql.Decimal(18, 2), row.monto)
    .input('periodo', sql.VarChar(20), row.periodo)
    .input('origen', sql.VarChar(20), row.origen)
    .query(`
      INSERT INTO PagosSuscripcionEmpresa (idPago, idEmpresaPrincipal, idEmpresaCliente, orderNumber, monto, moneda, periodo, origen, estado)
      VALUES (@idPago, @idEmpresaPrincipal, @idEmpresaCliente, @orderNumber, @monto, 'PEN', @periodo, @origen, 'PENDIENTE')
    `);
}

module.exports = {
  obtenerIdEmpresaPrincipal,
  obtenerCelularEmpresa,
  insertarPagoSuscripcion
};
