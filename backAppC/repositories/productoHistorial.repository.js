// repositories/productoHistorial.repository.js
const sql = require('mssql');

const bindUniqueIdentifiersIn = (request, idsEmpresa, prefix) => {
  const list = (Array.isArray(idsEmpresa) ? idsEmpresa : [idsEmpresa]).filter(Boolean);
  return list.map((id, i) => {
    const k = `${prefix}${i}`;
    request.input(k, sql.UniqueIdentifier, id);
    return `@${k}`;
  }).join(', ');
};

/**
 * Historial de ventas del producto (líneas vigentes).
 * @returns {Promise<{ items: object[] }>}
 */
exports.listarHistorialVentasProducto = async (pool, opts) => {
  const ids = (opts.idsEmpresa || []).filter(Boolean);
  if (ids.length === 0) return { items: [] };

  const req = pool.request();
  const inList = bindUniqueIdentifiersIn(req, ids, 'idEmpHv');
  req.input('idProducto', sql.UniqueIdentifier, opts.idProducto);

  let limite = parseInt(opts.limite, 10);
  if (Number.isNaN(limite) || limite < 1) limite = 30;
  limite = Math.min(100, limite);
  req.input('limite', sql.Int, limite);

  let whereCliente = '';
  if (opts.idCliente != null && opts.idCliente !== '') {
    const idCliente = parseInt(String(opts.idCliente), 10);
    if (!Number.isNaN(idCliente) && idCliente > 0) {
      req.input('idCliente', sql.Int, idCliente);
      whereCliente = 'AND v.idCliente = @idCliente';
    }
  }

  let whereDesde = '';
  if (opts.fechaDesde) {
    const desde = new Date(opts.fechaDesde);
    if (!Number.isNaN(desde.getTime())) {
      req.input('fechaDesde', sql.Date, desde);
      whereDesde = 'AND CAST(v.fEmision AS DATE) >= @fechaDesde';
    }
  }

  const result = await req.query(`
    SELECT TOP (@limite)
      v.idVenta,
      dv.idDetalle,
      CONVERT(VARCHAR(19), v.fEmision, 120) AS fecha,
      ISNULL(NULLIF(LTRIM(RTRIM(v.compVenta)), ''), ISNULL(v.serie, '') + ':' + ISNULL(v.numero, '')) AS comprobante,
      ISNULL(cl.rSocial, '') AS cliente,
      CAST(dv.cantidad AS DECIMAL(18, 3)) AS cantidad,
      CAST(dv.pVenta AS DECIMAL(18, 6)) AS precio,
      CAST(ISNULL(dv.total, dv.subtotal) AS DECIMAL(18, 2)) AS total
    FROM DetalleVenta dv
    INNER JOIN Ventas v ON v.idVenta = dv.idVenta
    LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
    WHERE v.idEmpresa IN (${inList})
      AND dv.idProducto = @idProducto
      AND ISNULL(v.eliminado, 0) = 0
      AND (v.idEstadoSunat IS NULL OR v.idEstadoSunat NOT IN (4, 8))
      ${whereCliente}
      ${whereDesde}
    ORDER BY v.fEmision DESC, v.idVenta DESC, dv.idDetalle DESC
  `);

  return { items: result.recordset || [] };
};

/**
 * Historial de compras del producto.
 * @returns {Promise<{ items: object[] }>}
 */
exports.listarHistorialComprasProducto = async (pool, opts) => {
  const ids = (opts.idsEmpresa || []).filter(Boolean);
  if (ids.length === 0) return { items: [] };

  const req = pool.request();
  const inList = bindUniqueIdentifiersIn(req, ids, 'idEmpHc');
  req.input('idProducto', sql.UniqueIdentifier, opts.idProducto);

  let limite = parseInt(opts.limite, 10);
  if (Number.isNaN(limite) || limite < 1) limite = 30;
  limite = Math.min(100, limite);
  req.input('limite', sql.Int, limite);

  let whereDesde = '';
  if (opts.fechaDesde) {
    const desde = new Date(opts.fechaDesde);
    if (!Number.isNaN(desde.getTime())) {
      req.input('fechaDesde', sql.Date, desde);
      whereDesde = 'AND CAST(c.fEmision AS DATE) >= @fechaDesde';
    }
  }

  const result = await req.query(`
    SELECT TOP (@limite)
      c.idCompra,
      dc.idDetalleCompra,
      CONVERT(VARCHAR(19), c.fEmision, 120) AS fecha,
      ISNULL(NULLIF(LTRIM(RTRIM(c.compCompra)), ''), ISNULL(c.serie, '') + ':' + ISNULL(c.numero, '')) AS comprobante,
      ISNULL(pr.rSocial, '') AS proveedor,
      CAST(dc.cantidad AS DECIMAL(18, 3)) AS cantidad,
      CAST(dc.pUnitario AS DECIMAL(18, 6)) AS precio,
      CAST(dc.total AS DECIMAL(18, 2)) AS total
    FROM DetalleCompras dc
    INNER JOIN Compras c ON c.idCompra = dc.idCompra AND c.idEmpresa = dc.idEmpresa
    LEFT JOIN Proveedores pr ON pr.idProveedor = c.idProveedor AND pr.idEmpresa = c.idEmpresa
    WHERE c.idEmpresa IN (${inList})
      AND dc.idProducto = @idProducto
      ${whereDesde}
    ORDER BY c.fEmision DESC, c.idCompra DESC, dc.idDetalleCompra DESC
  `);

  return { items: result.recordset || [] };
};
