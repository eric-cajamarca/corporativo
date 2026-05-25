const sql = require('mssql');
const { SQL_CELULAR_NORM } = require('../utils/telefonoWhatsApp.util');

async function buscarPorCelular(pool, idEmpresa, variantesDigitos) {
  const vars = (variantesDigitos || []).filter(Boolean);
  if (vars.length === 0) return [];

  const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  const conds = vars.map((v, i) => {
    const p = `cel${i}`;
    req.input(p, sql.VarChar(20), v);
    return `${SQL_CELULAR_NORM} LIKE '%' + @${p}`;
  });

  const r = await req.query(`
    SELECT idCliente, idEmpresa, rSocial, celular, ruc
    FROM Clientes
    WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1
      AND (${conds.join(' OR ')})
  `);
  return r.recordset || [];
}

async function listarPedidosRecientes(pool, idEmpresa, idCliente, top = 5) {
  const r = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, idCliente)
    .input('top', sql.Int, Math.min(10, Math.max(1, top)))
    .query(`
      SELECT TOP (@top)
        v.idVenta, v.serie, v.numero, v.total, v.idEstadoPedido, v.idEstadoPago,
        CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
        ep.descripcion AS estadoPedido,
        epg.descripcion AS estadoPago
      FROM Ventas v
      LEFT JOIN EstadosPedidos ep ON v.idEstadoPedido = ep.idEstadoPedido
      LEFT JOIN EstadoPago epg ON v.idEstadoPago = epg.idEstadoPago
      WHERE v.idEmpresa = @idEmpresa AND v.idCliente = @idCliente
        AND ISNULL(v.eliminado, 0) = 0
      ORDER BY v.fEmision DESC
    `);
  return r.recordset || [];
}

async function listarVentasPendientesPago(pool, idEmpresa, idCliente) {
  const r = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, idCliente)
    .query(`
      SELECT
        v.idVenta, v.serie, v.numero, v.total, v.idEstadoPago,
        CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
        CONVERT(VARCHAR(10), v.fVencimiento, 120) AS fVencimiento,
        epg.descripcion AS estadoPago
      FROM Ventas v
      LEFT JOIN EstadoPago epg ON v.idEstadoPago = epg.idEstadoPago
      WHERE v.idEmpresa = @idEmpresa AND v.idCliente = @idCliente
        AND ISNULL(v.eliminado, 0) = 0
        AND v.idEstadoPago IN (1, 3)
      ORDER BY v.fEmision DESC
    `);
  return r.recordset || [];
}

async function obtenerVentaDeCliente(pool, idEmpresa, idVenta, idCliente) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idVenta', sql.Int, idVenta)
    .input('idCliente', sql.Int, idCliente)
    .query(`
      SELECT
        v.idVenta, v.serie, v.numero, v.total, v.idEstadoPedido, v.idEstadoPago,
        CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
        ep.descripcion AS estadoPedido,
        epg.descripcion AS estadoPago
      FROM Ventas v
      LEFT JOIN EstadosPedidos ep ON v.idEstadoPedido = ep.idEstadoPedido
      LEFT JOIN EstadoPago epg ON v.idEstadoPago = epg.idEstadoPago
      WHERE v.idEmpresa = @idEmpresa AND v.idVenta = @idVenta AND v.idCliente = @idCliente
        AND ISNULL(v.eliminado, 0) = 0
    `);
  return r.recordset?.[0] || null;
}

async function listarDetallePedido(pool, idEmpresa, idVenta, idCliente) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idVenta', sql.Int, idVenta)
    .input('idCliente', sql.Int, idCliente)
    .query(`
      SELECT
        dv.cantidad,
        dv.pVenta,
        dv.total,
        p.codigo,
        CASE
          WHEN NULLIF(LTRIM(RTRIM(ISNULL(dv.descripcionLinea, ''))), '') IS NOT NULL
          THEN LTRIM(RTRIM(dv.descripcionLinea))
          ELSE p.descripcion
        END AS descripcion
      FROM DetalleVenta dv
      INNER JOIN Ventas v ON v.idVenta = dv.idVenta AND v.idEmpresa = @idEmpresa
      INNER JOIN Productos p ON p.idProducto = dv.idProducto AND p.idEmpresa = v.idEmpresa
      WHERE dv.idVenta = @idVenta AND v.idCliente = @idCliente
        AND ISNULL(v.eliminado, 0) = 0
      ORDER BY dv.idDetalle
    `);
  return r.recordset || [];
}

async function resumenDeudaCliente(pool, idEmpresa, idCliente) {
  const CreditosRepository = require('./creditos.repository');
  const creditos = await CreditosRepository.obtenerCreditosClienteRepo(pool, idEmpresa, idCliente);
  let saldoTotal = 0;
  for (const c of creditos) {
    saldoTotal += Number(c.saldoPendiente || 0);
  }
  return { creditos, saldoTotal };
}

module.exports = {
  buscarPorCelular,
  listarPedidosRecientes,
  listarVentasPendientesPago,
  obtenerVentaDeCliente,
  listarDetallePedido,
  resumenDeudaCliente
};
