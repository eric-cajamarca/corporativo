/**
 * Ledger de saldo a favor del cliente sobre AnticiposCliente / MovimientosAnticipo.
 */
const sql = require('mssql');

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Obtiene o crea la fila AnticiposCliente activa del cliente (saldo consolidado).
 */
async function obtenerOCrearAnticipo(ctx, idEmpresa, idCliente, idMoneda = 1) {
  const sel = await ctx
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, idCliente)
    .query(`
      SELECT TOP 1 idAnticipo, monto, saldo, idMoneda, estado
      FROM AnticiposCliente
      WHERE idEmpresa = @idEmpresa AND idCliente = @idCliente AND ISNULL(estado, 1) = 1
      ORDER BY fRegistro ASC
    `);
  if (sel.recordset && sel.recordset[0]) return sel.recordset[0];

  const ins = await ctx
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, idCliente)
    .input('idMoneda', sql.Int, idMoneda || 1)
    .query(`
      INSERT INTO AnticiposCliente (idEmpresa, idCliente, monto, saldo, idMoneda, estado)
      OUTPUT INSERTED.idAnticipo, INSERTED.monto, INSERTED.saldo, INSERTED.idMoneda, INSERTED.estado
      VALUES (@idEmpresa, @idCliente, 0, 0, @idMoneda, 1)
    `);
  return ins.recordset[0];
}

async function obtenerSaldoDisponible(ctx, idEmpresa, idCliente) {
  const r = await ctx
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, idCliente)
    .query(`
      SELECT ISNULL(SUM(saldo), 0) AS saldo
      FROM AnticiposCliente
      WHERE idEmpresa = @idEmpresa AND idCliente = @idCliente AND ISNULL(estado, 1) = 1
    `);
  return round2((r.recordset[0] || {}).saldo);
}

/**
 * Idempotencia: ¿ya existe un movimiento con misma huella?
 */
async function existeMovimientoIdempotente(ctx, { idAnticipo, tipo, referencia, idVenta }) {
  const r = await ctx
    .request()
    .input('idAnticipo', sql.UniqueIdentifier, idAnticipo)
    .input('tipo', sql.VarChar(20), tipo)
    .input('referencia', sql.VarChar(50), referencia || null)
    .input('idVenta', sql.Int, idVenta != null ? idVenta : null)
    .query(`
      SELECT TOP 1 idMovimientoAnticipo
      FROM MovimientosAnticipo
      WHERE idAnticipo = @idAnticipo
        AND tipo = @tipo
        AND (
          (@referencia IS NOT NULL AND referencia = @referencia)
          OR (@referencia IS NULL AND idVenta IS NOT NULL AND idVenta = @idVenta AND tipo = 'APLICACION_VENTA')
        )
    `);
  return !!(r.recordset && r.recordset[0]);
}

/**
 * Acredita saldo a favor (aumenta AnticiposCliente.saldo y registra movimiento).
 */
async function acreditar(ctx, params) {
  const {
    idEmpresa,
    idCliente,
    monto,
    tipo,
    referencia,
    idVenta,
    idCreditoOrigen,
    motivo,
    idUsuario,
    idMoneda
  } = params;
  const m = round2(monto);
  if (!idEmpresa || idCliente == null || !Number.isFinite(m) || m <= 0.009) {
    return { ok: false, motivo: 'monto_invalido', saldo: 0 };
  }

  const ant = await obtenerOCrearAnticipo(ctx, idEmpresa, idCliente, idMoneda || 1);
  if (await existeMovimientoIdempotente(ctx, { idAnticipo: ant.idAnticipo, tipo, referencia, idVenta })) {
    return {
      ok: true,
      idempotente: true,
      idAnticipo: ant.idAnticipo,
      monto: 0,
      saldo: round2(ant.saldo)
    };
  }

  const nuevoSaldo = round2(Number(ant.saldo || 0) + m);
  const nuevoMonto = round2(Number(ant.monto || 0) + m);

  await ctx
    .request()
    .input('idAnticipo', sql.UniqueIdentifier, ant.idAnticipo)
    .input('saldo', sql.Decimal(18, 2), nuevoSaldo)
    .input('monto', sql.Decimal(18, 2), nuevoMonto)
    .query(`
      UPDATE AnticiposCliente
      SET saldo = @saldo, monto = @monto
      WHERE idAnticipo = @idAnticipo
    `);

  await ctx
    .request()
    .input('idAnticipo', sql.UniqueIdentifier, ant.idAnticipo)
    .input('tipo', sql.VarChar(20), String(tipo || 'ABONO').slice(0, 20))
    .input('monto', sql.Decimal(18, 2), m)
    .input('idVenta', sql.Int, idVenta != null ? idVenta : null)
    .input('referencia', sql.VarChar(50), referencia ? String(referencia).slice(0, 50) : null)
    .input('idUsuario', sql.UniqueIdentifier, idUsuario || null)
    .input('idCreditoOrigen', sql.UniqueIdentifier, idCreditoOrigen || null)
    .input('motivo', sql.VarChar(200), motivo ? String(motivo).slice(0, 200) : null)
    .query(`
      INSERT INTO MovimientosAnticipo (
        idAnticipo, tipo, monto, idVenta, referencia, idUsuario, idCreditoOrigen, motivo
      ) VALUES (
        @idAnticipo, @tipo, @monto, @idVenta, @referencia, @idUsuario, @idCreditoOrigen, @motivo
      )
    `);

  return {
    ok: true,
    idempotente: false,
    idAnticipo: ant.idAnticipo,
    monto: m,
    saldo: nuevoSaldo
  };
}

/**
 * Aplica (descuenta) saldo a favor a una venta. Lanza si no hay saldo suficiente.
 */
async function aplicarAVenta(ctx, params) {
  const { idEmpresa, idCliente, monto, idVenta, idUsuario, referencia } = params;
  const m = round2(monto);
  if (!idEmpresa || idCliente == null || !Number.isFinite(m) || m <= 0.009) {
    return { ok: false, motivo: 'monto_invalido', aplicado: 0 };
  }

  const disponible = await obtenerSaldoDisponible(ctx, idEmpresa, idCliente);
  if (m > disponible + 0.02) {
    const e = new Error(
      `El cliente no tiene saldo a favor suficiente. Disponible: S/ ${disponible.toFixed(2)}, solicitado: S/ ${m.toFixed(2)}.`
    );
    e.code = 'SALDO_FAVOR_INSUFICIENTE';
    e.disponible = disponible;
    e.solicitado = m;
    throw e;
  }

  const ant = await obtenerOCrearAnticipo(ctx, idEmpresa, idCliente, 1);
  const ref = referencia || `VTA-${idVenta}`;
  if (
    await existeMovimientoIdempotente(ctx, {
      idAnticipo: ant.idAnticipo,
      tipo: 'APLICACION_VENTA',
      referencia: ref,
      idVenta
    })
  ) {
    return { ok: true, idempotente: true, aplicado: 0, saldo: round2(ant.saldo) };
  }

  const nuevoSaldo = round2(Number(ant.saldo || 0) - m);
  await ctx
    .request()
    .input('idAnticipo', sql.UniqueIdentifier, ant.idAnticipo)
    .input('saldo', sql.Decimal(18, 2), Math.max(0, nuevoSaldo))
    .query(`UPDATE AnticiposCliente SET saldo = @saldo WHERE idAnticipo = @idAnticipo`);

  await ctx
    .request()
    .input('idAnticipo', sql.UniqueIdentifier, ant.idAnticipo)
    .input('tipo', sql.VarChar(20), 'APLICACION_VENTA')
    .input('monto', sql.Decimal(18, 2), m)
    .input('idVenta', sql.Int, idVenta != null ? idVenta : null)
    .input('referencia', sql.VarChar(50), String(ref).slice(0, 50))
    .input('idUsuario', sql.UniqueIdentifier, idUsuario || null)
    .input('motivo', sql.VarChar(200), 'Aplicación a venta')
    .query(`
      INSERT INTO MovimientosAnticipo (
        idAnticipo, tipo, monto, idVenta, referencia, idUsuario, motivo
      ) VALUES (
        @idAnticipo, @tipo, @monto, @idVenta, @referencia, @idUsuario, @motivo
      )
    `);

  return { ok: true, idempotente: false, aplicado: m, saldo: Math.max(0, nuevoSaldo) };
}

async function listarMovimientos(ctx, idEmpresa, idCliente, limite = 50) {
  const lim = Math.min(200, Math.max(1, Number(limite) || 50));
  const r = await ctx
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, idCliente)
    .input('limite', sql.Int, lim)
    .query(`
      SELECT TOP (@limite)
        m.idMovimientoAnticipo,
        m.tipo,
        m.monto,
        m.idVenta,
        m.referencia,
        m.motivo,
        m.idCreditoOrigen,
        CONVERT(VARCHAR(19), m.fecha, 120) AS fecha,
        a.saldo AS saldoActualCabecera
      FROM MovimientosAnticipo m
      INNER JOIN AnticiposCliente a ON a.idAnticipo = m.idAnticipo
      WHERE a.idEmpresa = @idEmpresa AND a.idCliente = @idCliente
      ORDER BY m.fecha DESC
    `);
  return r.recordset || [];
}

async function listarSaldosEmpresa(ctx, idEmpresa) {
  const r = await ctx
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        a.idCliente,
        ISNULL(c.rSocial, '') AS cliente,
        ISNULL(SUM(a.saldo), 0) AS saldo,
        ISNULL(SUM(a.monto), 0) AS acumulado
      FROM AnticiposCliente a
      LEFT JOIN Clientes c ON c.idCliente = a.idCliente AND c.idEmpresa = a.idEmpresa
      WHERE a.idEmpresa = @idEmpresa AND ISNULL(a.estado, 1) = 1 AND a.saldo > 0.009
      GROUP BY a.idCliente, c.rSocial
      ORDER BY saldo DESC
    `);
  return r.recordset || [];
}

/**
 * Crédito ACTIVO ligado a una venta (puede haber más de uno; tomamos todos).
 */
async function listarCreditosActivosPorVenta(ctx, idEmpresa, idVenta) {
  const r = await ctx
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idVenta', sql.Int, idVenta)
    .query(`
      SELECT idCredito, idCliente, montoTotal, estado, observaciones
      FROM CreditosClientes
      WHERE idEmpresa = @idEmpresa AND idVenta = @idVenta AND estado = 'ACTIVO'
    `);
  return r.recordset || [];
}

async function resumenCobrosCredito(ctx, idEmpresa, idCredito) {
  const r = await ctx
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCredito', sql.UniqueIdentifier, idCredito)
    .query(`
      SELECT
        ISNULL((
          SELECT SUM(p.montoPagado)
          FROM PagosCuotas p
          INNER JOIN CuotasCredito cu ON cu.idCuota = p.idCuota AND cu.idEmpresa = p.idEmpresa
          WHERE cu.idCredito = @idCredito AND cu.idEmpresa = @idEmpresa
        ), 0) AS totalPagos,
        ISNULL(SUM(CASE WHEN estado = 'PAGADO' THEN montoCuota ELSE 0 END), 0) AS totalCuotasPagadas,
        ISNULL(SUM(CASE WHEN estado IN ('PENDIENTE','VENCIDO') THEN saldoPendiente ELSE 0 END), 0) AS saldoPendiente,
        COUNT(CASE WHEN estado = 'PAGADO' THEN 1 END) AS cuotasPagadas
      FROM CuotasCredito
      WHERE idCredito = @idCredito AND idEmpresa = @idEmpresa
    `);
  const row = r.recordset[0] || {};
  const totalPagos = round2(row.totalPagos);
  const totalCuotasPagadas = round2(row.totalCuotasPagadas);
  // Pago parcial marca la cuota original como PAGADO sin bajar montoCuota; la verdad está en PagosCuotas.
  const totalPagado = totalPagos > 0.009 ? totalPagos : totalCuotasPagadas;
  return {
    totalPagado,
    saldoPendiente: round2(row.saldoPendiente),
    cuotasPagadas: Number(row.cuotasPagadas) || 0
  };
}

/**
 * Cierra cuotas pendientes y marca el crédito CANCELADO (conserva cuotas PAGADO).
 * No usa ANULADO: el CHECK de CreditosClientes.estado no lo permite (sí CANCELADO).
 */
async function anularCreditoYCuotasPendientes(ctx, idEmpresa, idCredito, obsExtra) {
  await ctx
    .request()
    .input('idCredito', sql.UniqueIdentifier, idCredito)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      UPDATE CuotasCredito
      SET saldoPendiente = 0
      WHERE idCredito = @idCredito AND idEmpresa = @idEmpresa
        AND estado IN ('PENDIENTE', 'VENCIDO')
    `);

  const prev = await ctx
    .request()
    .input('idCredito', sql.UniqueIdentifier, idCredito)
    .query(`SELECT observaciones FROM CreditosClientes WHERE idCredito = @idCredito`);
  const obs = String((prev.recordset[0] || {}).observaciones || '').trim();
  const nuevo = `${obs ? obs + ' ' : ''}${obsExtra || '[CANCELADO]'}`.slice(0, 500);

  await ctx
    .request()
    .input('idCredito', sql.UniqueIdentifier, idCredito)
    .input('observaciones', sql.VarChar(500), nuevo)
    .query(`UPDATE CreditosClientes SET estado = 'CANCELADO', observaciones = @observaciones WHERE idCredito = @idCredito`);
}

/**
 * Créditos ACTIVO cuya venta está eliminada o no existe (para saneamiento).
 */
async function listarCreditosHuerfanos(ctx, idEmpresa) {
  const req = ctx.request();
  let q = `
    SELECT
      cc.idCredito,
      cc.idEmpresa,
      cc.idCliente,
      ISNULL(c.rSocial, '') AS cliente,
      cc.idVenta,
      cc.montoTotal,
      cc.estado,
      v.compVenta,
      ISNULL(v.eliminado, 0) AS ventaEliminada,
      ISNULL((
        SELECT SUM(CASE WHEN cu.estado = 'PAGADO' THEN cu.montoCuota ELSE 0 END)
        FROM CuotasCredito cu WHERE cu.idCredito = cc.idCredito AND cu.idEmpresa = cc.idEmpresa
      ), 0) AS totalPagado,
      ISNULL((
        SELECT SUM(CASE WHEN cu.estado IN ('PENDIENTE','VENCIDO') THEN cu.saldoPendiente ELSE 0 END)
        FROM CuotasCredito cu WHERE cu.idCredito = cc.idCredito AND cu.idEmpresa = cc.idEmpresa
      ), 0) AS saldoPendiente
    FROM CreditosClientes cc
    LEFT JOIN Clientes c ON c.idCliente = cc.idCliente AND c.idEmpresa = cc.idEmpresa
    LEFT JOIN Ventas v ON v.idVenta = cc.idVenta AND v.idEmpresa = cc.idEmpresa
    WHERE cc.estado = 'ACTIVO'
      AND (v.idVenta IS NULL OR ISNULL(v.eliminado, 0) = 1)
  `;
  if (idEmpresa) {
    req.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    q += ' AND cc.idEmpresa = @idEmpresa';
  }
  q += ' ORDER BY cc.fechaCredito DESC';
  const r = await req.query(q);
  return r.recordset || [];
}

module.exports = {
  round2,
  obtenerOCrearAnticipo,
  obtenerSaldoDisponible,
  acreditar,
  aplicarAVenta,
  listarMovimientos,
  listarSaldosEmpresa,
  listarCreditosActivosPorVenta,
  resumenCobrosCredito,
  anularCreditoYCuotasPendientes,
  listarCreditosHuerfanos
};
