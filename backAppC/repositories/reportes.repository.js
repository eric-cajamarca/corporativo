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
          AND cu.estado IN ('PENDIENTE', 'VENCIDO')
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

module.exports = {
  obtenerComprasPorProveedor,
  obtenerInventarioResumen,
  obtenerClientesRentabilidad,
  obtenerCarteraCreditos,
};

