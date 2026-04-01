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
 * Líneas vendidas con costo / venta / utilidad (DetalleVenta + Ventas).
 * @param {object} opts
 * @param {string[]} opts.idsEmpresa
 * @param {Date|string} opts.fechaDesde
 * @param {Date|string} opts.fechaHasta
 * @param {number|null} opts.idCliente
 * @param {string|null} opts.clienteRucLike
 * @param {string|null} opts.clienteRazonLike
 * @param {string|null} opts.categoriaLike
 * @param {string|null} opts.productoLike
 * @param {boolean} opts.agrupar
 */
exports.listarProductosVendidos = async (pool, opts) => {
  const ids = (opts.idsEmpresa || []).filter(Boolean);
  if (ids.length === 0) return [];

  const req = pool.request();
  const inList = bindUniqueIdentifiersIn(req, ids, 'idEmpPv');

  const desde = opts.fechaDesde ? new Date(opts.fechaDesde) : new Date();
  const hasta = opts.fechaHasta ? new Date(opts.fechaHasta) : new Date();
  if (desde > hasta) {
    throw new Error('La fecha desde no puede ser mayor que la fecha hasta');
  }
  req.input('fechaDesde', sql.Date, desde);
  req.input('fechaHasta', sql.Date, hasta);

  const idCliente = opts.idCliente != null && opts.idCliente !== '' ? parseInt(String(opts.idCliente), 10) : null;
  if (idCliente != null && !Number.isNaN(idCliente)) {
    req.input('idCliente', sql.Int, idCliente);
  }

  const rucLike = opts.clienteRucLike && String(opts.clienteRucLike).trim()
    ? `%${String(opts.clienteRucLike).trim()}%`
    : null;
  const razonLike = opts.clienteRazonLike && String(opts.clienteRazonLike).trim()
    ? `%${String(opts.clienteRazonLike).trim()}%`
    : null;
  if (rucLike) req.input('rucLike', sql.NVarChar(20), rucLike);
  if (razonLike) req.input('razonLike', sql.NVarChar(400), razonLike);

  const catLike = opts.categoriaLike && String(opts.categoriaLike).trim()
    ? `%${String(opts.categoriaLike).trim()}%`
    : null;
  const prodLike = opts.productoLike && String(opts.productoLike).trim()
    ? `%${String(opts.productoLike).trim()}%`
    : null;
  if (catLike) req.input('catLike', sql.NVarChar(200), catLike);
  if (prodLike) req.input('prodLike', sql.NVarChar(500), prodLike);

  const buscarLike = opts.buscar && String(opts.buscar).trim()
    ? `%${String(opts.buscar).trim()}%`
    : null;
  if (buscarLike) req.input('buscarLike', sql.NVarChar(600), buscarLike);

  const whereClienteId = idCliente != null && !Number.isNaN(idCliente) ? 'AND v.idCliente = @idCliente' : '';
  const whereRuc = rucLike ? 'AND cl.ruc LIKE @rucLike' : '';
  const whereRazon = razonLike ? 'AND cl.rSocial LIKE @razonLike' : '';
  const whereCat = catLike ? 'AND cat.nombre LIKE @catLike' : '';
  const whereProd = prodLike ? 'AND (p.codigo LIKE @prodLike OR p.descripcion LIKE @prodLike)' : '';
  const whereBuscar = buscarLike
    ? `AND (
        p.codigo LIKE @buscarLike OR p.descripcion LIKE @buscarLike
        OR (p.codigo + ' ' + p.descripcion) LIKE @buscarLike
        OR v.compVenta LIKE @buscarLike
      )`
    : '';

  const agrupar = !!opts.agrupar;

  const baseFrom = `
    FROM DetalleVenta dv
    INNER JOIN Ventas v ON v.idVenta = dv.idVenta
    INNER JOIN Productos p ON p.idProducto = dv.idProducto AND p.idEmpresa = v.idEmpresa
    INNER JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
    INNER JOIN Categorias cat ON cat.idCategoria = p.idCategoria
    INNER JOIN Empresas e ON e.idEmpresa = v.idEmpresa
    WHERE v.idEmpresa IN (${inList})
      AND ISNULL(v.eliminado, 0) = 0
      AND CAST(v.fEmision AS DATE) >= @fechaDesde
      AND CAST(v.fEmision AS DATE) <= @fechaHasta
      ${whereClienteId}
      ${whereRuc}
      ${whereRazon}
      ${whereCat}
      ${whereProd}
      ${whereBuscar}
  `;

  let query;
  if (agrupar) {
    query = `
      SELECT
        v.idEmpresa,
        p.idProducto,
        NULL AS idDetalle,
        NULL AS idVenta,
        CAST(NULL AS VARCHAR(10)) AS fecha,
        (p.codigo + ' ' + p.descripcion) AS producto,
        CAST(SUM(dv.cantidad) AS DECIMAL(18, 3)) AS cantidad,
        CAST(SUM(ISNULL(dv.costoTotal, dv.cantidad * ISNULL(dv.costoUnitario, 0))) AS DECIMAL(18, 2)) AS costo,
        CAST(SUM(dv.total) AS DECIMAL(18, 2)) AS venta,
        CAST(SUM(dv.total) - SUM(ISNULL(dv.costoTotal, dv.cantidad * ISNULL(dv.costoUnitario, 0))) AS DECIMAL(18, 2)) AS utilidad,
        ISNULL(e.alias, ISNULL(e.nombreComercial, e.razon_Social)) AS aliasEmpresa
      ${baseFrom}
      GROUP BY v.idEmpresa, p.idProducto, p.codigo, p.descripcion, e.alias, e.nombreComercial, e.razon_Social
      ORDER BY MAX(p.descripcion)
    `;
  } else {
    query = `
      SELECT
        v.idEmpresa,
        p.idProducto,
        dv.idDetalle,
        v.idVenta,
        CONVERT(VARCHAR(10), CAST(v.fEmision AS DATE), 103) AS fecha,
        (p.codigo + ' ' + p.descripcion) AS producto,
        CAST(dv.cantidad AS DECIMAL(18, 3)) AS cantidad,
        CAST(ISNULL(dv.costoTotal, dv.cantidad * ISNULL(dv.costoUnitario, 0)) AS DECIMAL(18, 2)) AS costo,
        CAST(dv.total AS DECIMAL(18, 2)) AS venta,
        CAST(dv.total - ISNULL(dv.costoTotal, dv.cantidad * ISNULL(dv.costoUnitario, 0)) AS DECIMAL(18, 2)) AS utilidad,
        ISNULL(e.alias, ISNULL(e.nombreComercial, e.razon_Social)) AS aliasEmpresa
      ${baseFrom}
      ORDER BY v.fEmision DESC, v.idVenta DESC, dv.idDetalle
    `;
  }

  const result = await req.query(query);
  const items = result.recordset || [];

  const tot = items.reduce(
    (acc, r) => {
      acc.cantidad += Number(r.cantidad) || 0;
      acc.costo += Number(r.costo) || 0;
      acc.venta += Number(r.venta) || 0;
      acc.utilidad += Number(r.utilidad) || 0;
      return acc;
    },
    { cantidad: 0, costo: 0, venta: 0, utilidad: 0 }
  );

  return { items, totales: tot };
};
