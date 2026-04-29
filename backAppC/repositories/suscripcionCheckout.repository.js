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
    .input('idEmpresaCliente', sql.UniqueIdentifier, row.idEmpresaCliente || null)
    .query(`
      INSERT INTO SuscripcionCheckoutPendiente (
        idCheckout, orderNumber, planCode, billingCycle, monto, moneda, estado, idEmpresaPrincipal, emailContacto, idEmpresaCliente
      ) VALUES (
        @idCheckout, @orderNumber, @planCode, @billingCycle, @monto, @moneda, @estado, @idEmpresaPrincipal, @emailContacto, @idEmpresaCliente
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

/**
 * Checkouts SaaS asociados a la empresa (vinculados o el origen de la suscripción actual).
 * Incluye demo, emprendedor, profesional, etc.
 */
const TOP_CHECKOUTS_EMPRESA = 120;

/**
 * Checkouts asociados a la empresa. Sin OR en un solo scan: UNION + seek por índice (PK en idCheckout).
 * TOP acota trabajo para el panel "Mi suscripción".
 */
async function listarPorEmpresaOCheckoutOrigen(pool, idEmpresa, idCheckoutOrigen) {
  const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  const top = TOP_CHECKOUTS_EMPRESA;

  let q;
  if (idCheckoutOrigen) {
    req.input('idCheckoutOrigen', sql.UniqueIdentifier, idCheckoutOrigen);
    q = `
    SELECT TOP (${top})
      u.orderNumber,
      u.planCode,
      u.billingCycle,
      u.monto,
      u.moneda,
      u.estado,
      CONVERT(VARCHAR(19), u.fCreacion, 120) AS fCreacion,
      CONVERT(VARCHAR(19), u.fConfirmacion, 120) AS fConfirmacion
    FROM (
      SELECT c.orderNumber, c.planCode, c.billingCycle, c.monto, c.moneda, c.estado, c.fCreacion, c.fConfirmacion
      FROM dbo.SuscripcionCheckoutPendiente c
      WHERE c.idEmpresaCliente = @idEmpresa
      UNION
      SELECT c.orderNumber, c.planCode, c.billingCycle, c.monto, c.moneda, c.estado, c.fCreacion, c.fConfirmacion
      FROM dbo.SuscripcionCheckoutPendiente c
      WHERE c.idCheckout = @idCheckoutOrigen
    ) u
    ORDER BY u.fCreacion DESC
    `;
  } else {
    q = `
    SELECT TOP (${top})
      c.orderNumber,
      c.planCode,
      c.billingCycle,
      c.monto,
      c.moneda,
      c.estado,
      CONVERT(VARCHAR(19), c.fCreacion, 120) AS fCreacion,
      CONVERT(VARCHAR(19), c.fConfirmacion, 120) AS fConfirmacion
    FROM dbo.SuscripcionCheckoutPendiente c
    WHERE c.idEmpresaCliente = @idEmpresa
    ORDER BY c.fCreacion DESC
    `;
  }

  const r = await req.query(q);
  return r.recordset || [];
}

async function listarConciliacionCulqi(pool, filtros = {}) {
  const { fechaDesde, fechaHasta, estado } = filtros;
  const req = pool.request();
  let where = "WHERE c.planCode <> 'demo'";

  if (fechaDesde) {
    where += ' AND c.fCreacion >= @fechaDesde';
    req.input('fechaDesde', sql.DateTime2, new Date(fechaDesde));
  }
  if (fechaHasta) {
    where += ' AND c.fCreacion < DATEADD(DAY, 1, @fechaHasta)';
    req.input('fechaHasta', sql.DateTime2, new Date(fechaHasta));
  }
  if (estado) {
    where += ' AND c.estado = @estado';
    req.input('estado', sql.VarChar(20), String(estado).trim().toUpperCase());
  }

  const r = await req.query(`
    SELECT
      c.orderNumber,
      c.planCode,
      c.billingCycle,
      c.monto,
      c.moneda,
      c.estado,
      c.idTransaccionPasarela,
      CONVERT(VARCHAR(19), c.fCreacion, 120) AS fCreacion,
      CONVERT(VARCHAR(19), c.fConfirmacion, 120) AS fConfirmacion,
      c.emailContacto,
      c.idEmpresaCliente,
      e.razon_Social AS razonSocialCliente,
      e.ruc AS rucCliente
    FROM dbo.SuscripcionCheckoutPendiente c
    LEFT JOIN dbo.Empresas e ON e.idEmpresa = c.idEmpresaCliente
    ${where}
    ORDER BY c.fCreacion DESC
  `);
  return r.recordset || [];
}

module.exports = {
  insertar,
  obtenerPorOrderNumber,
  actualizarEstadoPago,
  vincularEmpresaCliente,
  listarPorEmpresaOCheckoutOrigen,
  listarConciliacionCulqi
};
