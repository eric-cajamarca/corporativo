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
 * Líneas de compra (DetalleCompras + Compras + Proveedores).
 * @param {object} opts
 * @param {string[]} opts.idsEmpresa
 * @param {Date|string} opts.fechaDesde
 * @param {Date|string} opts.fechaHasta
 * @param {number|null} opts.idProveedor
 * @param {string|null} opts.proveedorRucLike
 * @param {string|null} opts.proveedorRazonLike
 * @param {number|null} opts.idComprobante
 * @param {string|null} opts.productoLike
 * @param {boolean} opts.agrupar
 * @param {string|null} opts.buscar
 */
exports.listarProductosComprados = async (pool, opts) => {
  const ids = (opts.idsEmpresa || []).filter(Boolean);
  if (ids.length === 0) return { items: [], totales: { cantidad: 0, importe: 0 } };

  const req = pool.request();
  const inList = bindUniqueIdentifiersIn(req, ids, 'idEmpPc');

  const desde = opts.fechaDesde ? new Date(opts.fechaDesde) : new Date();
  const hasta = opts.fechaHasta ? new Date(opts.fechaHasta) : new Date();
  if (desde > hasta) {
    throw new Error('La fecha desde no puede ser mayor que la fecha hasta');
  }
  req.input('fechaDesde', sql.Date, desde);
  req.input('fechaHasta', sql.Date, hasta);

  const idProveedor =
    opts.idProveedor != null && opts.idProveedor !== ''
      ? parseInt(String(opts.idProveedor), 10)
      : null;
  if (idProveedor != null && !Number.isNaN(idProveedor)) {
    req.input('idProveedor', sql.Int, idProveedor);
  }

  const rucLike =
    opts.proveedorRucLike && String(opts.proveedorRucLike).trim()
      ? `%${String(opts.proveedorRucLike).trim()}%`
      : null;
  const razonLike =
    opts.proveedorRazonLike && String(opts.proveedorRazonLike).trim()
      ? `%${String(opts.proveedorRazonLike).trim()}%`
      : null;
  if (rucLike) req.input('rucProvLike', sql.NVarChar(20), rucLike);
  if (razonLike) req.input('razonProvLike', sql.NVarChar(400), razonLike);

  const idComprobante =
    opts.idComprobante != null && opts.idComprobante !== ''
      ? parseInt(String(opts.idComprobante), 10)
      : null;
  if (idComprobante != null && !Number.isNaN(idComprobante)) {
    req.input('idComprobante', sql.Int, idComprobante);
  }

  const prodLike =
    opts.productoLike && String(opts.productoLike).trim()
      ? `%${String(opts.productoLike).trim()}%`
      : null;
  if (prodLike) req.input('prodLike', sql.NVarChar(500), prodLike);

  const buscarLike =
    opts.buscar && String(opts.buscar).trim() ? `%${String(opts.buscar).trim()}%` : null;
  if (buscarLike) req.input('buscarLike', sql.NVarChar(600), buscarLike);

  const whereProvId =
    idProveedor != null && !Number.isNaN(idProveedor) ? 'AND c.idProveedor = @idProveedor' : '';
  const whereRuc = rucLike ? 'AND pr.ruc LIKE @rucProvLike' : '';
  const whereRazon = razonLike ? 'AND pr.rSocial LIKE @razonProvLike' : '';
  const whereComp =
    idComprobante != null && !Number.isNaN(idComprobante)
      ? 'AND c.idComprobante = @idComprobante'
      : '';
  const whereProd = prodLike ? 'AND (p.codigo LIKE @prodLike OR p.descripcion LIKE @prodLike)' : '';
  const whereBuscar = buscarLike
    ? `AND (
        p.codigo LIKE @buscarLike OR p.descripcion LIKE @buscarLike
        OR (p.codigo + ' ' + p.descripcion) LIKE @buscarLike
        OR c.compCompra LIKE @buscarLike
        OR pr.ruc LIKE @buscarLike
        OR pr.rSocial LIKE @buscarLike
      )`
    : '';

  const agrupar = !!opts.agrupar;

  const baseFrom = `
    FROM DetalleCompras dc
    INNER JOIN Compras c ON c.idCompra = dc.idCompra AND c.idEmpresa = dc.idEmpresa
    INNER JOIN Productos p ON p.idProducto = dc.idProducto AND p.idEmpresa = dc.idEmpresa
    INNER JOIN Proveedores pr ON pr.idProveedor = c.idProveedor AND pr.idEmpresa = c.idEmpresa
    INNER JOIN Empresas e ON e.idEmpresa = c.idEmpresa
    WHERE c.idEmpresa IN (${inList})
      AND CAST(c.fEmision AS DATE) >= @fechaDesde
      AND CAST(c.fEmision AS DATE) <= @fechaHasta
      ${whereProvId}
      ${whereRuc}
      ${whereRazon}
      ${whereComp}
      ${whereProd}
      ${whereBuscar}
  `;

  let query;
  if (agrupar) {
    query = `
      SELECT
        c.idEmpresa,
        p.idProducto,
        NULL AS idDetalleCompra,
        NULL AS idCompra,
        CAST(NULL AS VARCHAR(10)) AS fecha,
        (p.codigo + ' ' + p.descripcion) AS producto,
        CAST(NULL AS NVARCHAR(200)) AS proveedor,
        CAST(SUM(dc.cantidad) AS DECIMAL(18, 3)) AS cantidad,
        CAST(
          CASE WHEN SUM(dc.cantidad) = 0 THEN 0
          ELSE SUM(dc.total) / NULLIF(SUM(dc.cantidad), 0) END
        AS DECIMAL(18, 6)) AS precio,
        CAST(SUM(dc.total) AS DECIMAL(18, 2)) AS importe,
        ISNULL(e.alias, ISNULL(e.nombreComercial, e.razon_Social)) AS aliasEmpresa
      ${baseFrom}
      GROUP BY c.idEmpresa, p.idProducto, p.codigo, p.descripcion, e.alias, e.nombreComercial, e.razon_Social
      ORDER BY MAX(p.descripcion)
    `;
  } else {
    query = `
      SELECT
        c.idEmpresa,
        p.idProducto,
        dc.idDetalleCompra,
        c.idCompra,
        CONVERT(VARCHAR(10), CAST(c.fEmision AS DATE), 103) AS fecha,
        (p.codigo + ' ' + p.descripcion) AS producto,
        ISNULL(pr.rSocial, '') AS proveedor,
        CAST(dc.cantidad AS DECIMAL(18, 3)) AS cantidad,
        CAST(dc.pUnitario AS DECIMAL(18, 6)) AS precio,
        CAST(dc.total AS DECIMAL(18, 2)) AS importe,
        ISNULL(e.alias, ISNULL(e.nombreComercial, e.razon_Social)) AS aliasEmpresa
      ${baseFrom}
      ORDER BY c.fEmision DESC, c.idCompra DESC, dc.idDetalleCompra
    `;
  }

  const result = await req.query(query);
  const items = result.recordset || [];

  const tot = items.reduce(
    (acc, r) => {
      acc.cantidad += Number(r.cantidad) || 0;
      acc.importe += Number(r.importe) || 0;
      return acc;
    },
    { cantidad: 0, importe: 0 }
  );

  return { items, totales: tot };
};
