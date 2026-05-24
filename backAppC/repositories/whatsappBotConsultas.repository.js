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
        v.idVenta, v.serie, v.numero, v.total, v.idEstadoPedido,
        CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
        ep.descripcion AS estadoPedido
      FROM Ventas v
      LEFT JOIN EstadoPedidos ep ON v.idEstadoPedido = ep.idEstadoPedido
      WHERE v.idEmpresa = @idEmpresa AND v.idCliente = @idCliente
      ORDER BY v.fEmision DESC
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
  resumenDeudaCliente
};
