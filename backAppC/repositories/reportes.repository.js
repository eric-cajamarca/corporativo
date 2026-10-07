const sql = require('mssql');

// Compras por proveedor en un rango de fechas
async function obtenerComprasPorProveedor(pool, idEmpresa, fechaInicio, fechaFin) {
  const rs = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fechaInicio', sql.Date, fechaInicio)
    .input('fechaFin', sql.Date, fechaFin)
    .query(`
      SELECT
        pr.rSocial AS proveedor,
        COUNT(DISTINCT c.idCompra) AS numeroCompras,
        ISNULL(SUM(c.total), 0) AS totalCompras,
        ISNULL(SUM(dc.cantidad), 0) AS totalItems
      FROM Compras c
      INNER JOIN Proveedores pr ON c.idProveedor = pr.idProveedor AND pr.idEmpresa = c.idEmpresa
      LEFT JOIN DCompras dc ON dc.idCompra = c.idCompra
      WHERE c.idEmpresa = @idEmpresa
        AND CONVERT(DATE, c.fEmision) >= @fechaInicio
        AND CONVERT(DATE, c.fEmision) <= @fechaFin
      GROUP BY pr.rSocial
      ORDER BY totalCompras DESC
    `);

  return (rs.recordset || []).map((r) => ({
    proveedor: String(r.proveedor || ''),
    numeroCompras: Number(r.numeroCompras || 0),
    totalCompras: Number(r.totalCompras || 0),
    totalItems: Number(r.totalItems || 0),
  }));
}

// Resumen de inventario por producto (stock y valor)
async function obtenerInventarioResumen(pool, idEmpresa) {
  const rs = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        p.idProducto,
        p.codigo,
        p.descripcion AS nombreProducto,
        ISNULL(c.nombre, 'Sin categoría') AS categoria,
        SUM(l.cantidadDisponible) AS stockTotal,
        SUM(l.cantidadDisponible * ISNULL(l.costoUnitario, 0)) AS valorInventario
      FROM Lotes l
      INNER JOIN Productos p ON l.idProducto = p.idProducto AND p.idEmpresa = l.idEmpresa
      LEFT JOIN Categorias c ON p.idCategoria = c.idCategoria AND c.idEmpresa = p.idEmpresa
      WHERE l.idEmpresa = @idEmpresa
      GROUP BY p.idProducto, p.codigo, p.descripcion, c.nombre
      HAVING SUM(l.cantidadDisponible) <> 0
      ORDER BY valorInventario DESC
    `);

  return (rs.recordset || []).map((r) => ({
    idProducto: r.idProducto,
    codigo: String(r.codigo || ''),
    nombreProducto: String(r.nombreProducto || ''),
    categoria: String(r.categoria || ''),
    stockTotal: Number(r.stockTotal || 0),
    valorInventario: Number(r.valorInventario || 0),
  }));
}

// Clientes por compras y saldo de créditos (si existen tablas de crédito)
async function obtenerClientesRentabilidad(pool, idEmpresa, fechaInicio, fechaFin) {
  const req = pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('fechaInicio', sql.Date, fechaInicio)
    .input('fechaFin', sql.Date, fechaFin);

  const rs = await req.query(`
    SELECT
      c.idCliente,
      c.rSocial AS cliente,
      ISNULL(SUM(v.total), 0) AS comprasTotales,
      COUNT(DISTINCT v.idVenta) AS numeroVentas,
      ISNULL(SUM(v.total), 0) / NULLIF(COUNT(DISTINCT v.idVenta), 0) AS ticketPromedio,
      ISNULL(MAX(v.fEmision), NULL) AS ultimaCompra
    FROM Clientes c
    LEFT JOIN Ventas v
      ON c.idCliente = v.idCliente
      AND v.idEmpresa = c.idEmpresa
      AND CONVERT(DATE, v.fEmision) >= @fechaInicio
      AND CONVERT(DATE, v.fEmision) <= @fechaFin
    WHERE c.idEmpresa = @idEmpresa
      AND ISNULL(c.estado, 1) = 1
    GROUP BY c.idCliente, c.rSocial
    HAVING ISNULL(SUM(v.total), 0) > 0
    ORDER BY comprasTotales DESC
  `);

  let deudas = { recordset: [] };
  try {
    deudas = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT
          cc.idCliente,
          ISNULL(SUM(cu.saldoPendiente), 0) AS deudaPendiente
        FROM CreditosClientes cc
        INNER JOIN CuotasCredito cu ON cc.idCredito = cu.idCredito
        LEFT JOIN Ventas v ON v.idVenta = cc.idVenta AND v.idEmpresa = cc.idEmpresa
        WHERE cc.idEmpresa = @idEmpresa
          AND ISNULL(cc.estado, '') = 'ACTIVO'
          AND cu.estado IN ('PENDIENTE', 'VENCIDO', 'PARCIAL')
          AND (cc.idVenta IS NULL OR ISNULL(v.eliminado, 0) = 0)
        GROUP BY cc.idCliente
      `);
  } catch (err) {
    if (err.number !== 208) {
      throw err;
    }
  }

  const deudaMap = new Map();
  (deudas.recordset || []).forEach((row) => {
    deudaMap.set(row.idCliente, Number(row.deudaPendiente || 0));
  });

  return (rs.recordset || []).map((r) => ({
    idCliente: r.idCliente,
    cliente: String(r.cliente || ''),
    comprasTotales: Number(r.comprasTotales || 0),
    numeroVentas: Number(r.numeroVentas || 0),
    ticketPromedio: Number(r.ticketPromedio || 0),
    ultimaCompra: r.ultimaCompra,
    deudaPendiente: deudaMap.get(r.idCliente) || 0,
  }));
}

// Reutiliza el resumen de créditos existente como cartera de créditos
async function obtenerCarteraCreditos(pool, idEmpresa) {
  const creditosRepository = require('./creditos.repository');
  const resumen = await creditosRepository.obtenerResumenCreditosRepo(pool, idEmpresa);
  return resumen;
}

async function obtenerAntiguedadDeuda(pool, idEmpresa) {
  const rs = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        cl.idCliente,
        ISNULL(cl.rSocial, '') AS cliente,
        ISNULL(SUM(CASE WHEN DATEDIFF(DAY, cu.fechaVencimiento, CAST(GETDATE() AS DATE)) <= 0 THEN ISNULL(cu.saldoPendiente, 0) ELSE 0 END), 0) AS alDia,
        ISNULL(SUM(CASE WHEN DATEDIFF(DAY, cu.fechaVencimiento, CAST(GETDATE() AS DATE)) BETWEEN 1 AND 30 THEN ISNULL(cu.saldoPendiente, 0) ELSE 0 END), 0) AS de1a30,
        ISNULL(SUM(CASE WHEN DATEDIFF(DAY, cu.fechaVencimiento, CAST(GETDATE() AS DATE)) BETWEEN 31 AND 60 THEN ISNULL(cu.saldoPendiente, 0) ELSE 0 END), 0) AS de31a60,
        ISNULL(SUM(CASE WHEN DATEDIFF(DAY, cu.fechaVencimiento, CAST(GETDATE() AS DATE)) > 60 THEN ISNULL(cu.saldoPendiente, 0) ELSE 0 END), 0) AS mas60,
        ISNULL(SUM(ISNULL(cu.saldoPendiente, 0)), 0) AS saldo
      FROM CuotasCredito cu
      INNER JOIN CreditosClientes cc ON cc.idCredito = cu.idCredito AND cc.idEmpresa = cu.idEmpresa
      INNER JOIN Clientes cl ON cl.idCliente = cc.idCliente AND cl.idEmpresa = cc.idEmpresa
      LEFT JOIN Ventas v ON v.idVenta = cc.idVenta
      WHERE cu.idEmpresa = @idEmpresa
        AND ISNULL(cc.estado, '') NOT IN ('ANULADO', 'CANCELADO')
        AND ISNULL(cu.estado, '') IN ('PENDIENTE', 'VENCIDO', 'PARCIAL')
        AND ISNULL(cu.saldoPendiente, 0) > 0
        AND (v.idVenta IS NULL OR ISNULL(v.eliminado, 0) = 0)
      GROUP BY cl.idCliente, cl.rSocial
      ORDER BY saldo DESC
    `);
  const clientes = rs.recordset || [];
  const resumen = clientes.reduce(
    (acc, r) => {
      acc.alDia += Number(r.alDia) || 0;
      acc.de1a30 += Number(r.de1a30) || 0;
      acc.de31a60 += Number(r.de31a60) || 0;
      acc.mas60 += Number(r.mas60) || 0;
      acc.saldo += Number(r.saldo) || 0;
      return acc;
    },
    { alDia: 0, de1a30: 0, de31a60: 0, mas60: 0, saldo: 0, clientes: clientes.length }
  );
  return { resumen, clientes };
}

async function obtenerEstadoCuentaCliente(pool, idEmpresa, idCliente) {
  const id = Number(idCliente);
  if (!id || Number.isNaN(id)) {
    throw new Error('idCliente es requerido');
  }
  const req = pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, id);

  const cab = await req.query(`
    SELECT TOP 1 cl.idCliente, ISNULL(cl.rSocial, '') AS cliente, ISNULL(cl.ruc, '') AS documento
    FROM Clientes cl
    WHERE cl.idEmpresa = @idEmpresa AND cl.idCliente = @idCliente
  `);
  const cliente = cab.recordset[0];
  if (!cliente) {
    throw new Error('Cliente no encontrado');
  }

  const ventas = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, id)
    .query(`
      SELECT
        CONVERT(VARCHAR(10), v.fEmision, 23) AS fecha,
        ISNULL(v.compVenta, ISNULL(v.serie, '') + '-' + ISNULL(CONVERT(VARCHAR(12), v.numero), '')) AS documento,
        'Venta' AS tipo,
        ISNULL(v.total, 0) AS cargo,
        0 AS abono,
        CASE WHEN ISNULL(v.eliminado, 0) = 1 THEN 'Anulada' ELSE ISNULL(ep.descripcion, '') END AS estado
      FROM Ventas v
      LEFT JOIN EstadoPago ep ON ep.idEstadoPago = v.idEstadoPago
      WHERE v.idEmpresa = @idEmpresa AND v.idCliente = @idCliente
      ORDER BY v.fEmision DESC
    `);

  const pagos = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, id)
    .query(`
      SELECT
        CONVERT(VARCHAR(10), p.fechaPago, 23) AS fecha,
        'Pago cuota ' + CONVERT(VARCHAR(8), cu.numeroCuota) AS documento,
        'Pago' AS tipo,
        0 AS cargo,
        ISNULL(p.montoPagado, 0) AS abono,
        'Pagado' AS estado
      FROM PagosCuotas p
      INNER JOIN CuotasCredito cu ON cu.idCuota = p.idCuota AND cu.idEmpresa = p.idEmpresa
      INNER JOIN CreditosClientes cc ON cc.idCredito = cu.idCredito AND cc.idEmpresa = cu.idEmpresa
      WHERE p.idEmpresa = @idEmpresa AND cc.idCliente = @idCliente
      ORDER BY p.fechaPago DESC
    `);

  const aging = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCliente', sql.Int, id)
    .query(`
      SELECT
        ISNULL(SUM(CASE WHEN DATEDIFF(DAY, cu.fechaVencimiento, CAST(GETDATE() AS DATE)) <= 0 THEN ISNULL(cu.saldoPendiente, 0) ELSE 0 END), 0) AS alDia,
        ISNULL(SUM(CASE WHEN DATEDIFF(DAY, cu.fechaVencimiento, CAST(GETDATE() AS DATE)) BETWEEN 1 AND 30 THEN ISNULL(cu.saldoPendiente, 0) ELSE 0 END), 0) AS de1a30,
        ISNULL(SUM(CASE WHEN DATEDIFF(DAY, cu.fechaVencimiento, CAST(GETDATE() AS DATE)) BETWEEN 31 AND 60 THEN ISNULL(cu.saldoPendiente, 0) ELSE 0 END), 0) AS de31a60,
        ISNULL(SUM(CASE WHEN DATEDIFF(DAY, cu.fechaVencimiento, CAST(GETDATE() AS DATE)) > 60 THEN ISNULL(cu.saldoPendiente, 0) ELSE 0 END), 0) AS mas60,
        ISNULL(SUM(ISNULL(cu.saldoPendiente, 0)), 0) AS saldo
      FROM CuotasCredito cu
      INNER JOIN CreditosClientes cc ON cc.idCredito = cu.idCredito AND cc.idEmpresa = cu.idEmpresa
      WHERE cu.idEmpresa = @idEmpresa AND cc.idCliente = @idCliente
        AND ISNULL(cc.estado, '') NOT IN ('ANULADO', 'CANCELADO')
        AND ISNULL(cu.estado, '') IN ('PENDIENTE', 'VENCIDO', 'PARCIAL')
        AND ISNULL(cu.saldoPendiente, 0) > 0
    `);

  return {
    cliente,
    aging: aging.recordset[0] || { alDia: 0, de1a30: 0, de31a60: 0, mas60: 0, saldo: 0 },
    movimientos: [...(ventas.recordset || []), ...(pagos.recordset || [])].sort((a, b) =>
      String(b.fecha || '').localeCompare(String(a.fecha || ''))
    )
  };
}

module.exports = {
  obtenerComprasPorProveedor,
  obtenerInventarioResumen,
  obtenerClientesRentabilidad,
  obtenerCarteraCreditos,
  obtenerAntiguedadDeuda,
  obtenerEstadoCuentaCliente,
};

