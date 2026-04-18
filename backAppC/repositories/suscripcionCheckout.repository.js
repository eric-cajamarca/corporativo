const sql = require('mssql');

async function insertar(pool, row) {
  await pool
    .request()
    .input('idCheckout', sql.UniqueIdentifier, row.idCheckout)
    .input('orderNumber', sql.VarChar(120), row.orderNumber)
    .input('planCode', sql.VarChar(30), row.planCode)
    .input('billingCycle', sql.VarChar(10), row.billingCycle)
    .input('monto', sql.Decimal(18, 2), row.monto)
    .input('moneda', sql.VarChar(10), row.moneda || 'PEN')
    .input('estado', sql.VarChar(20), row.estado || 'PENDIENTE')
    .input('idEmpresaPrincipal', sql.UniqueIdentifier, row.idEmpresaPrincipal)
    .input('emailContacto', sql.VarChar(200), row.emailContacto || null)
    .query(`
      INSERT INTO SuscripcionCheckoutPendiente (
        idCheckout, orderNumber, planCode, billingCycle, monto, moneda, estado, idEmpresaPrincipal, emailContacto
      ) VALUES (
        @idCheckout, @orderNumber, @planCode, @billingCycle, @monto, @moneda, @estado, @idEmpresaPrincipal, @emailContacto
      )
    `);
}

async function obtenerPorOrderNumber(pool, orderNumber) {
  const r = await pool
    .request()
    .input('orderNumber', sql.VarChar(120), orderNumber)
    .query(`
      SELECT TOP 1
        idCheckout,
        orderNumber,
        planCode,
        billingCycle,
        monto,
        moneda,
        estado,
        idEmpresaPrincipal,
        idEmpresaCliente,
        emailContacto,
        idTransaccionPasarela,
        CONVERT(VARCHAR(19), fCreacion, 120) AS fCreacion,
        CONVERT(VARCHAR(19), fConfirmacion, 120) AS fConfirmacion
      FROM SuscripcionCheckoutPendiente
      WHERE orderNumber = @orderNumber
    `);
  return r.recordset[0] || null;
}

async function actualizarEstadoPago(pool, orderNumber, estado, idTransaccionPasarela) {
  await pool
    .request()
    .input('orderNumber', sql.VarChar(120), orderNumber)
    .input('estado', sql.VarChar(20), estado)
    .input('idTransaccionPasarela', sql.VarChar(120), idTransaccionPasarela || null)
    .query(`
      UPDATE SuscripcionCheckoutPendiente
      SET estado = @estado,
          idTransaccionPasarela = CASE WHEN @idTransaccionPasarela IS NOT NULL AND @idTransaccionPasarela <> '' THEN @idTransaccionPasarela ELSE idTransaccionPasarela END,
          fConfirmacion = CASE WHEN @estado = 'PAGADO' THEN GETDATE() ELSE fConfirmacion END
      WHERE orderNumber = @orderNumber
    `);
}

async function vincularEmpresaCliente(pool, orderNumber, idEmpresaCliente) {
  await pool
    .request()
    .input('orderNumber', sql.VarChar(120), orderNumber)
    .input('idEmpresaCliente', sql.UniqueIdentifier, idEmpresaCliente)
    .query(`
      UPDATE SuscripcionCheckoutPendiente
      SET idEmpresaCliente = @idEmpresaCliente
      WHERE orderNumber = @orderNumber
    `);
}

module.exports = {
  insertar,
  obtenerPorOrderNumber,
  actualizarEstadoPago,
  vincularEmpresaCliente
};
