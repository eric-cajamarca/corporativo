const sql = require("mssql");

// exports.obtenerProductosTodosRepo = async (pool, empresa) => {
//   console.log('empresa in repo:', empresa);
//   const result = await pool
//     .request()
//     .input("idEmpresa", sql.UniqueIdentifier, empresa)
//     .query(`
//       SELECT
//           ss.idProducto,
//           p.codigo,
//           c.nombre as categoria,
//           p.descripcion,
//           m.nombre as marca,
//           pr.codigo as codigoPresentacion,
//           pr.descripcion as descripcionPres,
//           ss.idSucursal,
//           s.nombre as sucursal,
//           p.cUnitario,
//           pp.precio,
//           pp.idPrecio,
//           pp.idLista,
//           lp.nombre as nombreLista,  -- Nombre de la lista
//           lp.principal,              -- Si es lista principal
//           ss.cantidad as stock,
//           p.fProduccion,
//           p.fVencimiento
//       FROM StockSucursal ss
//       INNER JOIN Productos p ON ss.idProducto = p.idProducto
//       INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
//       INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
//       INNER JOIN Sucursal s ON ss.idSucursal = s.idSucursal
//       INNER JOIN Marcas m ON p.idMarca = m.idMarca
//       LEFT JOIN PreciosProducto pp ON p.idProducto = pp.idProducto
//       LEFT JOIN ListasPrecio lp ON pp.idLista = lp.idLista  -- Para info de la lista
//       WHERE ss.idEmpresa = @idEmpresa
//         AND (lp.activo = 1 OR lp.activo IS NULL);  -- Solo listas activas
//     `);

//   return result.recordset;
// };
const construirInClause = (request, ids, prefijo) => {
  const params = [];
  (ids || []).forEach((id, index) => {
    const key = `${prefijo}${index}`;
    request.input(key, sql.UniqueIdentifier, id);
    params.push(`@${key}`);
  });
  return params.length > 0 ? params.join(', ') : null;
};

/** Filtro multipalabra (cada token en código, descripción, marca o categoría). */
const construirFiltroTokensBusqueda = (request, tokens, aliasMarca, aliasCategoria, paramBase = 'busq') => {
  if (!tokens || tokens.length === 0) {
    return '';
  }
  const conds = [];
  tokens.forEach((tok, i) => {
    const p = `${paramBase}${i}`;
    request.input(p, sql.NVarChar(120), `%${String(tok).replace(/[%_[\]]/g, '')}%`);
    conds.push(`(
      p.codigo LIKE @${p} OR
      p.descripcion LIKE @${p} OR
      ${aliasMarca}.nombre LIKE @${p} OR
      ${aliasCategoria}.nombre LIKE @${p}
    )`);
  });
  return ` AND (${conds.join(' AND ')}) `;
};

/** SQL Server limita ~2100 parámetros por petición; evitar IN con miles de idProducto. */
const MAX_IN_PRODUCTOS_PRECIO = 500;

const idProductoMapKey = (idProducto) =>
  idProducto != null ? String(idProducto).trim().toLowerCase() : '';

const esListaPrecioPrincipal = (principal) =>
  principal === true || principal === 1 || principal === '1';

const resolverPrecioVentaDesdeMapa = (preciosProducto) => {
  const valores = Object.values(preciosProducto || {});
  if (!valores.length) return 0;
  const principal = valores.find((p) => esListaPrecioPrincipal(p.principal));
  if (principal) return Number(principal.precio) || 0;
  return Number(valores[0].precio) || 0;
};

const agregarPrecioAMapa = (preciosMap, precio) => {
  if (!precio?.idProducto) return;
  const key = idProductoMapKey(precio.idProducto);
  if (!preciosMap[key]) {
    preciosMap[key] = {};
  }
  preciosMap[key][precio.idLista] = {
    precio: precio.precio,
    idPrecio: precio.idPrecio,
    nombreLista: precio.nombreLista,
    principal: precio.principal,
    simboloMoneda: precio.simboloMoneda,
    fActualizacion: precio.fActualizacion
  };
};

/**
 * Precios por lista para productos de una o más empresas.
 * Con catálogos grandes (>500 IDs) consulta por idEmpresa y filtra en memoria.
 */
const cargarPreciosMapProductos = async (pool, idsEmpresa, idsProductos) => {
  const ids = (idsEmpresa || []).filter(Boolean);
  const idsProd = [...new Set((idsProductos || []).filter(Boolean))];
  const preciosMap = {};
  if (ids.length === 0) {
    return preciosMap;
  }

  const sqlPrecios = (inClausePrecios, filtroProdSql) => `
        SELECT
            pp.idProducto,
            pp.idLista,
            pp.precio,
            pp.idPrecio,
            pp.fActualizacion,
            lp.nombre as nombreLista,
            lp.principal,
            m.simbolo as simboloMoneda
        FROM PreciosProducto pp
        INNER JOIN ListasPrecio lp ON pp.idLista = lp.idLista
        INNER JOIN Moneda m ON lp.idMoneda = m.idMoneda
        INNER JOIN Productos p ON pp.idProducto = p.idProducto
        WHERE p.idEmpresa IN (${inClausePrecios})
        ${filtroProdSql}
        AND lp.activo = 1
      `;

  const usarFiltroSqlPorProducto =
    idsProd.length > 0 && idsProd.length <= MAX_IN_PRODUCTOS_PRECIO;

  if (usarFiltroSqlPorProducto) {
    for (let i = 0; i < idsProd.length; i += MAX_IN_PRODUCTOS_PRECIO) {
      const chunk = idsProd.slice(i, i + MAX_IN_PRODUCTOS_PRECIO);
      const req = pool.request();
      const inClausePrecios = construirInClause(req, ids, 'idEmpresaPrecio');
      const inClauseProd = construirInClause(req, chunk, 'idProdPrecio');
      const filtroProdSql = ` AND pp.idProducto IN (${inClauseProd}) `;
      const res = await req.query(sqlPrecios(inClausePrecios, filtroProdSql));
      (res.recordset || []).forEach((precio) => agregarPrecioAMapa(preciosMap, precio));
    }
    return preciosMap;
  }

  const req = pool.request();
  const inClausePrecios = construirInClause(req, ids, 'idEmpresaPrecio');
  const res = await req.query(sqlPrecios(inClausePrecios, ''));
  const permitidos =
    idsProd.length > 0
      ? new Set(idsProd.map((id) => String(id).toLowerCase()))
      : null;
  (res.recordset || []).forEach((precio) => {
    if (
      permitidos &&
      !permitidos.has(String(precio.idProducto).toLowerCase())
    ) {
      return;
    }
    agregarPrecioAMapa(preciosMap, precio);
  });
  return preciosMap;
};

const combinarRecordsetConPrecios = async (pool, idsEmpresa, recordset, idsProductoFiltro = null) => {
  const ids = (idsEmpresa || []).filter(Boolean);
  if (!recordset || recordset.length === 0) {
    return [];
  }
  const idsProdUnicos =
    idsProductoFiltro && idsProductoFiltro.length
      ? [...new Set(idsProductoFiltro.filter(Boolean))]
      : [...new Set(recordset.map((r) => r.idProducto).filter(Boolean))];

  const preciosMap = await cargarPreciosMapProductos(pool, ids, idsProdUnicos);

  return (recordset || []).map((producto) => {
    const preciosProducto =
      preciosMap[idProductoMapKey(producto.idProducto)] ||
      preciosMap[producto.idProducto] ||
      {};
    const pVenta = resolverPrecioVentaDesdeMapa(preciosProducto);
    return {
      idProducto: producto.idProducto,
      idEmpresa: producto.idEmpresa,
      codigo: producto.codigo,
      idCategoria: producto.idCategoria,
      categoria: producto.categoria,
      descripcion: producto.descripcion,
      permiteDescripcionEnVenta: !!(producto.permiteDescripcionEnVenta === true || producto.permiteDescripcionEnVenta === 1),
      idMarca: producto.idMarca,
      marca: producto.marca,
      idPresentacion: producto.idPresentacion,
      codigoPresentacion: producto.codigoPresentacion,
      descripcionPres: producto.descripcionPres,
      idSucursal: producto.idSucursal,
      sucursal: producto.sucursal,
      /** Costo del último lote (fechaIngreso); si no hay lote, Productos.cUnitario */
      cUnitario: producto.cUnitario,
      idLoteUltimo: producto.idLoteUltimo || null,
      pVenta,
      stock: producto.stock,
      tipoProducto: producto.tipoProducto,
      fProduccion: producto.fProduccion,
      fVencimiento: producto.fVencimiento,
      estado: !!(producto.estado === true || producto.estado === 1),
      precios: preciosProducto,
      aliasEmpresa: producto.aliasEmpresa || '',
      razonSocialEmpresa: producto.razonSocialEmpresa || ''
    };
  });
};

exports.obtenerProductosTodosMultiEmpresaRepo = async (pool, idsEmpresa, idsSucursalesFiltro = null) => {
  try {
    const ids = (idsEmpresa || []).filter(Boolean);
    if (ids.length === 0) return [];
    // Primero, obtener productos básicos
    const request = pool.request();
    const inClause = construirInClause(request, ids, 'idEmpresa');
    const sucFilt = (idsSucursalesFiltro || []).filter(Boolean);
    const inSucClause = sucFilt.length > 0 ? construirInClause(request, sucFilt, 'idSuc') : null;
    const filtroSucursalSql = inSucClause ? ` AND ss.idSucursal IN (${inSucClause}) ` : '';
    /*
      Productos sin lotes: si hay filtro por sucursales de usuario, un CROSS APPLY estricto puede devolver 0 filas
      (p. ej. asignación desalineada) y el producto desaparece del listado. Se usa OUTER APPLY filtrado + fallback principal.
    */
    const applySucursalSinLotes = inSucClause
      ? `OUTER APPLY (
          SELECT TOP 1 su.idSucursal AS idSucursal
          FROM Sucursal su
          WHERE su.idEmpresa = p.idEmpresa
            AND ISNULL(su.estado, 1) = 1
            AND su.idSucursal IN (${inSucClause})
          ORDER BY su.nombre
        ) defFilt
        OUTER APPLY (
          SELECT TOP 1 su.idSucursal AS idSucursal
          FROM Sucursal su
          WHERE su.idEmpresa = p.idEmpresa
            AND ISNULL(su.estado, 1) = 1
          ORDER BY CASE WHEN ISNULL(su.esPrincipal, 0) = 1 THEN 0 ELSE 1 END, su.nombre
        ) defFb`
      : `CROSS APPLY (
          SELECT TOP 1 su.idSucursal AS idSucursal
          FROM Sucursal su
          WHERE su.idEmpresa = p.idEmpresa
            AND ISNULL(su.estado, 1) = 1
          ORDER BY CASE WHEN ISNULL(su.esPrincipal, 0) = 1 THEN 0 ELSE 1 END, su.nombre
        ) defFb`;
    const idSucursalSinLotesExpr = inSucClause
      ? 'COALESCE(defFilt.idSucursal, defFb.idSucursal)'
      : 'defFb.idSucursal';
    const result = await request.query(`
        SELECT 
            ss.idProducto,
            ss.idEmpresa,
            p.codigo,
            p.idCategoria,
            c.nombre as categoria,
            p.descripcion,
            ISNULL(p.permiteDescripcionEnVenta, 0) AS permiteDescripcionEnVenta,
            p.idMarca,
            m.nombre as marca,
            p.idPresentacion,
            pr.codigo as codigoPresentacion,
            pr.descripcion as descripcionPres,
            ss.idSucursal,
            s.nombre as sucursal,
            CONVERT(DECIMAL(18,6), ISNULL(ul.costoUnitario, p.cUnitario)) AS cUnitario,
            ul.idLote AS idLoteUltimo,
            ss.cantidad as stock,
            p.tipoProducto,
            p.fProduccion,
            p.fVencimiento,
            p.estado,
            ISNULL(e.alias, e.nombreComercial) as aliasEmpresa,
            e.razon_Social as razonSocialEmpresa
        FROM (
          SELECT idEmpresa, idSucursal, idProducto, SUM(cantidadDisponible) AS cantidad
          FROM Lotes
          GROUP BY idEmpresa, idSucursal, idProducto
        ) ss
        INNER JOIN Productos p ON ss.idProducto = p.idProducto
        INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
        INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
        INNER JOIN Sucursal s ON ss.idSucursal = s.idSucursal AND ISNULL(s.estado, 1) = 1
        INNER JOIN Marcas m ON p.idMarca = m.idMarca
        INNER JOIN Empresas e ON ss.idEmpresa = e.idEmpresa
        OUTER APPLY (
          SELECT TOP 1 l.idLote, l.costoUnitario
          FROM Lotes l
          WHERE l.idEmpresa = ss.idEmpresa
            AND l.idProducto = ss.idProducto
            AND l.idSucursal = ss.idSucursal
          ORDER BY
            CASE WHEN l.fechaIngreso IS NULL THEN 1 ELSE 0 END,
            l.fechaIngreso DESC,
            l.idLote DESC
        ) ul
        WHERE ss.idEmpresa IN (${inClause}) ${filtroSucursalSql}

        UNION ALL

        SELECT 
            p.idProducto,
            p.idEmpresa,
            p.codigo,
            p.idCategoria,
            c2.nombre as categoria,
            p.descripcion,
            ISNULL(p.permiteDescripcionEnVenta, 0) AS permiteDescripcionEnVenta,
            p.idMarca,
            m2.nombre as marca,
            p.idPresentacion,
            pr2.codigo as codigoPresentacion,
            pr2.descripcion as descripcionPres,
            ${idSucursalSinLotesExpr} AS idSucursal,
            s2.nombre as sucursal,
            CONVERT(DECIMAL(18,6), ISNULL(p.cUnitario, 0)) AS cUnitario,
            CAST(NULL AS UNIQUEIDENTIFIER) AS idLoteUltimo,
            CAST(0 AS DECIMAL(18, 3)) AS stock,
            p.tipoProducto,
            p.fProduccion,
            p.fVencimiento,
            p.estado,
            ISNULL(e2.alias, e2.nombreComercial) as aliasEmpresa,
            e2.razon_Social as razonSocialEmpresa
        FROM Productos p
        INNER JOIN Categorias c2 ON p.idCategoria = c2.idCategoria
        INNER JOIN Presentacion pr2 ON p.idPresentacion = pr2.idPresentacion
        INNER JOIN Marcas m2 ON p.idMarca = m2.idMarca
        INNER JOIN Empresas e2 ON p.idEmpresa = e2.idEmpresa
        ${applySucursalSinLotes}
        INNER JOIN Sucursal s2 ON s2.idSucursal = ${idSucursalSinLotesExpr} AND ISNULL(s2.estado, 1) = 1
        WHERE p.idEmpresa IN (${inClause})
        AND NOT EXISTS (
          SELECT 1 FROM Lotes l
          WHERE l.idProducto = p.idProducto AND l.idEmpresa = p.idEmpresa
        )
      `);

    const productos = await combinarRecordsetConPrecios(pool, ids, result.recordset);
    return productos;
  } catch (error) {
    throw new Error(`Repository Error: ${error.message}`);
  }
};

/**
 * Listado paginado de productos (catálogo básico + stock total por empresa).
 */
exports.listarProductosPaginadoRepo = async (pool, idsEmpresa, opts = {}) => {
  const ids = (idsEmpresa || []).filter(Boolean);
  if (ids.length === 0) return { rows: [], total: 0, pagina: 1, porPagina: 20 };
  const { parsePaginacion, likePattern } = require('../utils/paginacion.util');
  const pag = parsePaginacion(opts);
  const offset = pag.offset;
  const porPagina = pag.porPagina;
  const pagina = pag.pagina;

  const reqCount = pool.request();
  const inClause = construirInClause(reqCount, ids, 'idEmpresa');
  let whereBuscar = '';
  const buscarPat = likePattern(opts.buscar);
  if (buscarPat) {
    reqCount.input('buscar', sql.NVarChar(200), buscarPat);
    whereBuscar = ` AND (p.codigo LIKE @buscar ESCAPE '\\' OR p.descripcion LIKE @buscar ESCAPE '\\')`;
  }
  const countRes = await reqCount.query(`
    SELECT COUNT(*) AS total
    FROM Productos p
    WHERE p.idEmpresa IN (${inClause})${whereBuscar}
  `);
  const total = countRes.recordset?.[0] ? Number(countRes.recordset[0].total) || 0 : 0;

  const reqData = pool.request();
  const inClauseData = construirInClause(reqData, ids, 'idEmpresa');
  reqData.input('offset', sql.Int, offset);
  reqData.input('limite', sql.Int, porPagina);
  if (buscarPat) reqData.input('buscar', sql.NVarChar(200), buscarPat);
  const dataRes = await reqData.query(`
    SELECT
      p.idProducto,
      p.idEmpresa,
      p.codigo,
      p.descripcion,
      p.idCategoria,
      c.nombre AS categoria,
      p.idMarca,
      m.nombre AS marca,
      p.idPresentacion,
      pr.codigo AS codigoPresentacion,
      pr.descripcion AS descripcionPres,
      p.cUnitario,
      p.tipoProducto,
      p.estado,
      ISNULL(st.stock, 0) AS stock,
      ISNULL(e.alias, e.nombreComercial) AS aliasEmpresa
    FROM Productos p
    INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
    INNER JOIN Marcas m ON p.idMarca = m.idMarca
    INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
    INNER JOIN Empresas e ON p.idEmpresa = e.idEmpresa
    LEFT JOIN (
      SELECT idEmpresa, idProducto, SUM(cantidadDisponible) AS stock
      FROM Lotes
      GROUP BY idEmpresa, idProducto
    ) st ON st.idProducto = p.idProducto AND st.idEmpresa = p.idEmpresa
    WHERE p.idEmpresa IN (${inClauseData})${whereBuscar}
    ORDER BY p.descripcion
    OFFSET @offset ROWS FETCH NEXT @limite ROWS ONLY
  `);
  const rows = await combinarRecordsetConPrecios(pool, ids, dataRes.recordset || []);
  return { rows, total, pagina, porPagina };
};

/**
 * Búsqueda rápida para ventas: primero filtra productos (TOP), luego stock solo de esos IDs.
 */
exports.buscarProductosVentaRepo = async (
  pool,
  idsEmpresa,
  idsSucursalesFiltro = null,
  tokensBusqueda = [],
  limite = 80,
  idSucursalVenta = null
) => {
  try {
    const ids = (idsEmpresa || []).filter(Boolean);
    if (ids.length === 0) return [];
    const tokens = (tokensBusqueda || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 4);
    if (tokens.length === 0) return [];

    const top = Math.min(100, Math.max(1, parseInt(limite, 10) || 80));
    const topCandidatos = Math.min(150, top * 2);

    const reqProd = pool.request();
    reqProd.input('limite', sql.Int, topCandidatos);
    const inClauseEmp = construirInClause(reqProd, ids, 'idEmpresa');
    const filtroBusq = construirFiltroTokensBusqueda(reqProd, tokens, 'm', 'c', 'bv');

    const candidatosRes = await reqProd.query(`
      SELECT TOP (@limite)
        p.idProducto,
        p.idEmpresa,
        p.codigo,
        p.idCategoria,
        c.nombre AS categoria,
        p.descripcion,
        ISNULL(p.permiteDescripcionEnVenta, 0) AS permiteDescripcionEnVenta,
        p.idMarca,
        m.nombre AS marca,
        p.idPresentacion,
        pr.codigo AS codigoPresentacion,
        pr.descripcion AS descripcionPres,
        p.cUnitario,
        p.tipoProducto,
        p.fProduccion,
        p.fVencimiento,
        p.estado,
        ISNULL(e.alias, e.nombreComercial) AS aliasEmpresa,
        e.razon_Social AS razonSocialEmpresa
      FROM Productos p
      INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
      INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
      INNER JOIN Marcas m ON p.idMarca = m.idMarca
      INNER JOIN Empresas e ON p.idEmpresa = e.idEmpresa
      WHERE p.idEmpresa IN (${inClauseEmp})
        AND ISNULL(p.estado, 1) = 1
        ${filtroBusq}
      ORDER BY p.descripcion, p.codigo
    `);

    const candidatos = candidatosRes.recordset || [];
    if (candidatos.length === 0) {
      return [];
    }

    const idsProducto = [...new Set(candidatos.map((r) => r.idProducto).filter(Boolean))];
    const mapCandidato = new Map();
    for (const c of candidatos) {
      mapCandidato.set(`${c.idProducto}|${c.idEmpresa}`, c);
    }

    const sucFilt = (idsSucursalesFiltro || []).filter(Boolean);
    const reqStock = pool.request();
    reqStock.input('limiteFilas', sql.Int, top);
    const inClauseEmp2 = construirInClause(reqStock, ids, 'idEmp2');
    const inClauseProd = construirInClause(reqStock, idsProducto, 'idProd');
    const inSucClause = sucFilt.length > 0 ? construirInClause(reqStock, sucFilt, 'idSuc') : null;
    let filtroSucLotes = inSucClause ? ` AND l.idSucursal IN (${inSucClause}) ` : '';
    if (idSucursalVenta) {
      reqStock.input('idSucursalVenta', sql.UniqueIdentifier, idSucursalVenta);
      filtroSucLotes += ' AND l.idSucursal = @idSucursalVenta ';
    }

    const stockRes = await reqStock.query(`
      SELECT TOP (@limiteFilas)
        l.idProducto,
        l.idEmpresa,
        l.idSucursal,
        s.nombre AS sucursal,
        SUM(l.cantidadDisponible) AS stock
      FROM Lotes l
      INNER JOIN Sucursal s ON l.idSucursal = s.idSucursal AND ISNULL(s.estado, 1) = 1
      WHERE l.idEmpresa IN (${inClauseEmp2})
        AND l.idProducto IN (${inClauseProd})
        ${filtroSucLotes}
      GROUP BY l.idProducto, l.idEmpresa, l.idSucursal, s.nombre
      ORDER BY s.nombre
    `);

    const filas = [];
    const conStock = new Set();

    for (const row of stockRes.recordset || []) {
      const key = `${row.idProducto}|${row.idEmpresa}`;
      const base = mapCandidato.get(key);
      if (!base) continue;
      conStock.add(key);
      filas.push({
        ...base,
        idSucursal: row.idSucursal,
        sucursal: row.sucursal,
        stock: row.stock
      });
      if (filas.length >= top) break;
    }

    if (filas.length < top) {
      const reqSinLote = pool.request();
      reqSinLote.input('limiteFilas', sql.Int, top - filas.length);
      const inClauseEmp3 = construirInClause(reqSinLote, ids, 'idEmp3');
      const inClauseProd3 = construirInClause(reqSinLote, idsProducto, 'idProd3');
      const inSucClause3 = sucFilt.length > 0 ? construirInClause(reqSinLote, sucFilt, 'idSuc3') : null;

      const applySucursalSinLotes = inSucClause3
        ? `OUTER APPLY (
            SELECT TOP 1 su.idSucursal AS idSucursal
            FROM Sucursal su
            WHERE su.idEmpresa = p.idEmpresa
              AND ISNULL(su.estado, 1) = 1
              AND su.idSucursal IN (${inSucClause3})
            ORDER BY su.nombre
          ) defFilt
          OUTER APPLY (
            SELECT TOP 1 su.idSucursal AS idSucursal
            FROM Sucursal su
            WHERE su.idEmpresa = p.idEmpresa
              AND ISNULL(su.estado, 1) = 1
            ORDER BY CASE WHEN ISNULL(su.esPrincipal, 0) = 1 THEN 0 ELSE 1 END, su.nombre
          ) defFb`
        : `CROSS APPLY (
            SELECT TOP 1 su.idSucursal AS idSucursal
            FROM Sucursal su
            WHERE su.idEmpresa = p.idEmpresa
              AND ISNULL(su.estado, 1) = 1
            ORDER BY CASE WHEN ISNULL(su.esPrincipal, 0) = 1 THEN 0 ELSE 1 END, su.nombre
          ) defFb`;
      const idSucExpr = inSucClause3 ? 'COALESCE(defFilt.idSucursal, defFb.idSucursal)' : 'defFb.idSucursal';
      let filtroSucVenta2 = '';
      if (idSucursalVenta) {
        reqSinLote.input('idSucursalVenta2', sql.UniqueIdentifier, idSucursalVenta);
        filtroSucVenta2 = ` AND ${idSucExpr} = @idSucursalVenta2 `;
      }

      const sinLoteRes = await reqSinLote.query(`
        SELECT TOP (@limiteFilas)
          p.idProducto,
          p.idEmpresa,
          ${idSucExpr} AS idSucursal,
          s2.nombre AS sucursal,
          CAST(0 AS DECIMAL(18, 3)) AS stock
        FROM Productos p
        ${applySucursalSinLotes}
        INNER JOIN Sucursal s2 ON s2.idSucursal = ${idSucExpr} AND ISNULL(s2.estado, 1) = 1
        WHERE p.idEmpresa IN (${inClauseEmp3})
          AND p.idProducto IN (${inClauseProd3})
          AND ISNULL(p.estado, 1) = 1
          ${filtroSucVenta2}
          AND NOT EXISTS (
            SELECT 1 FROM Lotes l
            WHERE l.idProducto = p.idProducto AND l.idEmpresa = p.idEmpresa
          )
        ORDER BY p.descripcion
      `);

      for (const row of sinLoteRes.recordset || []) {
        const key = `${row.idProducto}|${row.idEmpresa}`;
        if (conStock.has(key)) continue;
        const base = mapCandidato.get(key);
        if (!base) continue;
        filas.push({
          ...base,
          idSucursal: row.idSucursal,
          sucursal: row.sucursal,
          stock: row.stock
        });
        if (filas.length >= top) break;
      }
    }

    return await combinarRecordsetConPrecios(pool, ids, filas, idsProducto);
  } catch (error) {
    throw new Error(`Repository Error: ${error.message}`);
  }
};
// exports.obtenerProductosTodosRepo = async (pool, idEmpresa) => {
//   try {
//     const result = await pool
//       .request()
//       .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
//       .query(`
//         SELECT 
//             ss.idProducto,
//             p.codigo,
//             c.nombre as categoria,
//             p.descripcion,
//             m.nombre as marca,
//             pr.codigo as codigoPresentacion,
//             pr.descripcion as descripcionPres,
//             ss.idSucursal,
//             s.nombre as sucursal,
//             p.cUnitario,
//             (
//                 SELECT 
//                     pp.idLista,
//                     pp.precio,
//                     pp.idPrecio,
//                     lp.nombre as nombreLista,
//                     lp.principal,
//                     m2.simbolo as simboloMoneda
//                 FROM PreciosProducto pp
//                 INNER JOIN ListasPrecio lp ON pp.idLista = lp.idLista
//                 INNER JOIN Moneda m2 ON lp.idMoneda = m2.idMoneda
//                 WHERE pp.idProducto = p.idProducto
//                 AND lp.activo = 1
//                 FOR JSON PATH
//             ) as preciosJson,
//             ss.cantidad as stock,
//             p.fProduccion,
//             p.fVencimiento
//         FROM StockSucursal ss
//         INNER JOIN Productos p ON ss.idProducto = p.idProducto
//         INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
//         INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
//         INNER JOIN Sucursal s ON ss.idSucursal = s.idSucursal
//         INNER JOIN Marcas m ON p.idMarca = m.idMarca
//         WHERE ss.idEmpresa = @idEmpresa
//       `);

//     // Procesar resultados
//     const productos = result.recordset.map((producto) => ({
//       idProducto: producto.idProducto,
//       codigo: producto.codigo,
//       categoria: producto.categoria,
//       descripcion: producto.descripcion,
//       marca: producto.marca,
//       codigoPresentacion: producto.codigoPresentacion,
//       descripcionPres: producto.descripcionPres,
//       idSucursal: producto.idSucursal,
//       sucursal: producto.sucursal,
//       cUnitario: producto.cUnitario,
//       stock: producto.stock,
//       fProduccion: producto.fProduccion,
//       fVencimiento: producto.fVencimiento,
      
//       // Convertir JSON a objeto y crear mapa rápido
//       precios: producto.preciosJson
//         ? JSON.parse(producto.preciosJson).reduce((map, precio) => {
//             map[precio.idLista] = {
//               precio: precio.precio,
//               idPrecio: precio.idPrecio,
//               nombreLista: precio.nombreLista,
//               principal: precio.principal,
//               simboloMoneda: precio.simboloMoneda,
//             };
//             return map;
//           }, {})
//         : {},
//     }));

//     console.log('Productos obtenidos en repo:', productos.length);

//     return productos;
//   } catch (error) {
//     throw new Error(`Repository Error: ${error.message}`);
//   }
// };

exports.obtenerProductosCompras = async (pool, idEmpresa, idsSucursalesFiltro = null) => {
  try {
    const reqCompras = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    let filtroSucCompras = '';
    const sf = (idsSucursalesFiltro || []).filter(Boolean);
    if (sf.length > 0) {
      const ph = sf.map((id, i) => {
        const k = `idSucComp${i}`;
        reqCompras.input(k, sql.UniqueIdentifier, id);
        return `@${k}`;
      });
      filtroSucCompras = ` AND ss.idSucursal IN (${ph.join(', ')}) `;
    }
    const inSucClause = sf.length > 0 ? sf.map((_, i) => `@idSucComp${i}`).join(', ') : null;
    const applySucursalSinLotes = inSucClause
      ? `OUTER APPLY (
          SELECT TOP 1 su.idSucursal AS idSucursal
          FROM Sucursal su
          WHERE su.idEmpresa = p.idEmpresa
            AND ISNULL(su.estado, 1) = 1
            AND su.idSucursal IN (${inSucClause})
          ORDER BY su.nombre
        ) defFilt
        OUTER APPLY (
          SELECT TOP 1 su.idSucursal AS idSucursal
          FROM Sucursal su
          WHERE su.idEmpresa = p.idEmpresa
            AND ISNULL(su.estado, 1) = 1
          ORDER BY CASE WHEN ISNULL(su.esPrincipal, 0) = 1 THEN 0 ELSE 1 END, su.nombre
        ) defFb`
      : `CROSS APPLY (
          SELECT TOP 1 su.idSucursal AS idSucursal
          FROM Sucursal su
          WHERE su.idEmpresa = p.idEmpresa
            AND ISNULL(su.estado, 1) = 1
          ORDER BY CASE WHEN ISNULL(su.esPrincipal, 0) = 1 THEN 0 ELSE 1 END, su.nombre
        ) defFb`;
    const idSucursalSinLotesExpr = inSucClause
      ? 'COALESCE(defFilt.idSucursal, defFb.idSucursal)'
      : 'defFb.idSucursal';
    const result = await reqCompras.query(`
        SELECT 
            ss.idProducto,
            p.codigo,
            c.nombre as categoria,
            p.idCategoria,            
            p.descripcion,
            p.idMarca,
            m.nombre as marca,
            p.idPresentacion,
            pr.codigo as codigoPresentacion,
            pr.descripcion as descripcionPres,
            ss.idSucursal,
            s.nombre as sucursal,
            p.cUnitario,
            ss.cantidad as stock,
            p.fProduccion,
            p.fVencimiento
        FROM (SELECT idEmpresa, idSucursal, idProducto, SUM(cantidadDisponible) AS cantidad FROM Lotes GROUP BY idEmpresa, idSucursal, idProducto) ss
        INNER JOIN Productos p ON ss.idProducto = p.idProducto AND p.idEmpresa = ss.idEmpresa
        INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
        INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
        INNER JOIN Sucursal s ON ss.idSucursal = s.idSucursal AND ISNULL(s.estado, 1) = 1
        INNER JOIN Marcas m ON p.idMarca = m.idMarca
        WHERE ss.idEmpresa = @idEmpresa ${filtroSucCompras}

        UNION ALL

        SELECT 
            p.idProducto,
            p.codigo,
            c2.nombre as categoria,
            p.idCategoria,            
            p.descripcion,
            p.idMarca,
            m2.nombre as marca,
            p.idPresentacion,
            pr2.codigo as codigoPresentacion,
            pr2.descripcion as descripcionPres,
            ${idSucursalSinLotesExpr} AS idSucursal,
            s2.nombre as sucursal,
            p.cUnitario,
            CAST(0 AS DECIMAL(18, 3)) AS stock,
            p.fProduccion,
            p.fVencimiento
        FROM Productos p
        INNER JOIN Categorias c2 ON p.idCategoria = c2.idCategoria
        INNER JOIN Presentacion pr2 ON p.idPresentacion = pr2.idPresentacion
        INNER JOIN Marcas m2 ON p.idMarca = m2.idMarca
        ${applySucursalSinLotes}
        INNER JOIN Sucursal s2 ON s2.idSucursal = ${idSucursalSinLotesExpr} AND ISNULL(s2.estado, 1) = 1
        WHERE p.idEmpresa = @idEmpresa
        AND NOT EXISTS (
          SELECT 1 FROM Lotes l
          WHERE l.idProducto = p.idProducto AND l.idEmpresa = p.idEmpresa
        )
      `);

    // Obtener precios por separado
    const preciosResult = await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT 
            pp.idProducto,
            pp.idLista,
            pp.precio,
            pp.idPrecio,
            pp.fActualizacion,
            lp.nombre as nombreLista,
            lp.principal,
            m.simbolo as simboloMoneda
            
        FROM PreciosProducto pp
        INNER JOIN ListasPrecio lp ON pp.idLista = lp.idLista
        INNER JOIN Moneda m ON lp.idMoneda = m.idMoneda
        INNER JOIN Productos p ON pp.idProducto = p.idProducto
        WHERE p.idEmpresa = @idEmpresa
        AND lp.activo = 1
      `);

    // Crear mapa de precios
    const preciosMap = {};
    preciosResult.recordset.forEach(precio => {
      if (!preciosMap[precio.idProducto]) {
        preciosMap[precio.idProducto] = {};
      }
      preciosMap[precio.idProducto][precio.idLista] = {
        precio: precio.precio,
        idPrecio: precio.idPrecio,
        nombreLista: precio.nombreLista,
        principal: precio.principal,
        simboloMoneda: precio.simboloMoneda,
        fActualizacion: precio.fActualizacion

      };
      
    });

     // Combinar productos con precios
    const productos = result.recordset.map((producto) => {
      const preciosProducto =
        preciosMap[idProductoMapKey(producto.idProducto)] ||
        preciosMap[producto.idProducto] ||
        {};
      const pVenta = resolverPrecioVentaDesdeMapa(preciosProducto);

      return {
        idProducto: producto.idProducto,
        codigo: producto.codigo,
        idCategoria: producto.idCategoria,
        categoria: producto.categoria,
        descripcion: producto.descripcion,
        idMarca: producto.idMarca,
        marca: producto.marca,
        idPresentacion: producto.idPresentacion,
        codigoPresentacion: producto.codigoPresentacion,
        descripcionPres: producto.descripcionPres,
        idSucursal: producto.idSucursal,
        sucursal: producto.sucursal,
        cUnitario: producto.cUnitario,
        pVenta,
        stock: producto.stock,
        tipoProducto: producto.tipoProducto,
        fProduccion: producto.fProduccion,
        fVencimiento: producto.fVencimiento,
        // precios: preciosProducto,
      };
    });   // Encontrar el precio principal (normal)

    
    return productos;
  } catch (error) {
    throw new Error(`Repository Error: ${error.message}`);
  }
};

exports.obtenerProductoPorIdRepo = async (pool, idProducto, idEmpresa) => {
  try {
    // SIEMPRE usa sql.UniqueIdentifier para UUIDs (regla 1.4)
    const result = await pool
      .request()
      .input("idProducto", sql.UniqueIdentifier, idProducto)
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT
          p.idProducto,
          p.Codigo,
          p.descripcion,
          ISNULL(p.permiteDescripcionEnVenta, 0) AS permiteDescripcionEnVenta,
          NULLIF(LTRIM(RTRIM(ISNULL(p.codigoProductoSunat, ''))), '') AS codigoProductoSunat,
          p.requiereCodigoSunat,
          ISNULL(p.revisadoSunat, 0) AS revisadoSunat,
          NULLIF(LTRIM(RTRIM(ISNULL(p.anexoSunatSugerido, ''))), '') AS anexoSunatSugerido,
          NULLIF(LTRIM(RTRIM(ISNULL(p.codigoSunatSugerido, ''))), '') AS codigoSunatSugerido,
          p.idCategoria,
          p.idMarca,
          p.idPresentacion,
          p.tipoProducto,
          p.cUnitario,
          p.fProduccion,
          p.fVencimiento,
          p.vecesVendidas,
          p.facturar,
          c.nombre as categoria,
          m.nombre as marca,
          pr.codigo as codigoPresentacion,
          pr.descripcion as presentacion,
          p.estado,
          p.alertaMinimo,
          p.alertaMaximo,
          CONVERT(VARCHAR(19), p.FIngreso, 120) as fechaIngreso,
          CONVERT(VARCHAR(19), p.fProduccion, 120) as fechaProduccion,
          CONVERT(VARCHAR(19), p.fVencimiento, 120) as fechaVencimiento
        FROM Productos p
        INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
        INNER JOIN Marcas m ON p.idMarca = m.idMarca
        INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
        WHERE p.idProducto = @idProducto
        AND p.idEmpresa = @idEmpresa
      `);

    // NUNCA retornes fechas sin formatear (regla 1.4)
    if (result.recordset.length > 0) {
      const producto = result.recordset[0];
      return producto;
    }

    return null;
  } catch (error) {
    throw new Error(`Repository Error: ${error.message}`);
  }
};

/** idEmpresa dueña del registro de producto (clave idProducto). */
exports.obtenerIdEmpresaProductoPorId = async (pool, idProducto) => {
  try {
    const result = await pool
      .request()
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .query('SELECT idEmpresa FROM Productos WHERE idProducto = @idProducto');
    return result.recordset?.[0]?.idEmpresa ?? null;
  } catch (error) {
    throw new Error(`Repository Error: ${error.message}`);
  }
};

/**
 * Obtiene idProducto por cada descripción que coincida exactamente (trim, misma empresa).
 * Retorna array { descripcion, idProducto } para usar en compras al cargar XML.
 */
exports.obtenerProductosPorDescripcionRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT idProducto, LTRIM(RTRIM(descripcion)) AS descripcion
      FROM Productos
      WHERE idEmpresa = @idEmpresa AND descripcion IS NOT NULL
    `);
  return result.recordset || [];
};

/** Presentación + costo unitario para reglas de inventario (ZZ = servicio). */
exports.obtenerMetaInventarioProducto = async (executor, idEmpresa, idProducto) => {
  const r = await executor
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      SELECT TOP 1
        ISNULL(p.cUnitario, 0) AS cUnitario,
        pr.codigo AS codigoPresentacion
      FROM Productos p
      LEFT JOIN Presentacion pr ON pr.idPresentacion = p.idPresentacion
      WHERE p.idEmpresa = @idEmpresa AND p.idProducto = @idProducto
    `);
  return r.recordset?.[0] || null;
};

exports.obtenerCodigoPresentacionPorId = async (executor, idPresentacion) => {
  const id = parseInt(idPresentacion, 10);
  if (!Number.isFinite(id) || id <= 0) return '';
  const r = await executor
    .request()
    .input('idPresentacion', sql.Int, id)
    .query(`
      SELECT TOP 1 codigo FROM Presentacion WHERE idPresentacion = @idPresentacion
    `);
  return r.recordset?.[0]?.codigo || '';
};

/** Productos categoría Habitación + presentación Servicios (ZZ). */
exports.obtenerProductosHabitacionRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("codigoPresentacion", sql.VarChar(10), "ZZ")
    .query(`
      SELECT
        p.idProducto,
        p.codigo,
        p.descripcion,
        pr.codigo AS codigoPresentacion,
        cat.nombre AS categoria,
        ISNULL((
          SELECT TOP 1 pp.precio
          FROM PreciosProducto pp
          INNER JOIN ListasPrecio lp ON pp.idLista = lp.idLista AND lp.idEmpresa = p.idEmpresa
          WHERE pp.idProducto = p.idProducto
            AND ISNULL(lp.activo, 1) = 1
          ORDER BY
            CASE WHEN ISNULL(lp.principal, 0) = 1 THEN 0 ELSE 1 END,
            pp.precio DESC
        ), 0) AS pVenta
      FROM Productos p
      INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
      INNER JOIN Categorias cat ON p.idCategoria = cat.idCategoria
      WHERE p.idEmpresa = @idEmpresa
        AND pr.codigo = @codigoPresentacion
        AND ISNULL(p.estado, 1) = 1
        AND LOWER(LTRIM(RTRIM(REPLACE(REPLACE(cat.nombre, N'ó', N'o'), N'Ó', N'o')))) LIKE N'habitaci%'
      ORDER BY p.codigo
    `);
  return (result.recordset || []).map((r) => ({
    idProducto: r.idProducto,
    codigo: r.codigo,
    descripcion: r.descripcion,
    codigoPresentacion: r.codigoPresentacion,
    categoria: r.categoria,
    pVenta: Number(r.pVenta) || 0
  }));
};

exports.buscarIdUsuarioEnEmpresa = async (pool, idUsuario, idEmpresa) => {
  const r = await pool
    .request()
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT idUsuario FROM UsuarioWeb WHERE idUsuario = @idUsuario AND idEmpresa = @idEmpresa');
  return r.recordset?.[0]?.idUsuario ?? null;
};

exports.buscarPrimerIdUsuarioEmpresa = async (pool, idEmpresa) => {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT TOP 1 idUsuario FROM UsuarioWeb WHERE idEmpresa = @idEmpresa');
  return r.recordset?.[0]?.idUsuario ?? null;
};

exports.incrementarCorrelativo = async (transaction, idEmpresa) => {
  return transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      UPDATE Correlativos WITH (UPDLOCK, HOLDLOCK)
      SET numero = numero + 1
      OUTPUT INSERTED.numero
      WHERE idEmpresa = @idEmpresa
    `);
};

exports.obtenerSiguienteCodigoProductoFallback = async (transaction, idEmpresa) => {
  return transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT ISNULL(MAX(TRY_CAST(RTRIM(LTRIM(Codigo)) AS INT)), 10000) + 1 AS siguiente
      FROM Productos WITH (UPDLOCK, HOLDLOCK)
      WHERE idEmpresa = @idEmpresa
    `);
};

exports.contarProductoPorCodigo = async (transaction, idEmpresa, codigo) => {
  return transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('Codigo', sql.VarChar(50), codigo)
    .query(`
      SELECT COUNT(1) AS n
      FROM Productos
      WHERE idEmpresa = @idEmpresa
        AND RTRIM(LTRIM(Codigo)) = @Codigo
    `);
};

/** Productos del catálogo con el mismo código (para mensajes de error en compras/alta). */
exports.listarProductosPorCodigoRepo = async (executor, idEmpresa, codigo) => {
  const cod = String(codigo || '').trim();
  if (!cod) return [];
  const result = await executor
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('Codigo', sql.VarChar(50), cod)
    .query(`
      SELECT
        idProducto,
        RTRIM(LTRIM(Codigo)) AS codigo,
        RTRIM(LTRIM(descripcion)) AS descripcion
      FROM Productos
      WHERE idEmpresa = @idEmpresa
        AND RTRIM(LTRIM(Codigo)) = @Codigo
      ORDER BY descripcion
    `);
  return result.recordset || [];
};

exports.insertarProducto = async (transaction, row) => {
  return transaction
    .request()
    .input('idProducto', sql.UniqueIdentifier, row.idProducto)
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('Codigo', sql.VarChar, row.Codigo)
    .input('idCategoria', sql.Int, row.idCategoria)
    .input('descripcion', sql.VarChar, row.descripcion)
    .input('idMarca', sql.Int, row.idMarca)
    .input('idPresentacion', sql.Int, row.idPresentacion)
    .input('cUnitario', sql.Decimal(18, 5), row.cUnitario)
    .input('fProduccion', sql.VarChar, row.fProduccion)
    .input('fVencimiento', sql.VarChar, row.fVencimiento)
    .input('alertaMinimo', sql.Decimal(18, 2), row.alertaMinimo)
    .input('alertaMaximo', sql.Decimal(18, 2), row.alertaMaximo)
    .input('VecesVendidas', sql.Int, row.VecesVendidas)
    .input('facturar', sql.VarChar, row.facturar)
    .input('idUsuario', sql.UniqueIdentifier, row.idUsuario)
    .input('FIngreso', sql.DateTime, row.FIngreso)
    .input('estado', sql.Bit, row.estado)
    .input('tipoProducto', sql.Char(1), row.tipoProducto)
    .input('permiteDescripcionEnVenta', sql.Bit, row.permiteDescripcionEnVenta ? 1 : 0)
    .input('codigoProductoSunat', sql.VarChar(8), row.codigoProductoSunat || null)
    .input(
      'requiereCodigoSunat',
      sql.Bit,
      row.requiereCodigoSunat === true || row.requiereCodigoSunat === 1
        ? 1
        : row.requiereCodigoSunat === false || row.requiereCodigoSunat === 0
          ? 0
          : null
    )
    .input('revisadoSunat', sql.Bit, row.revisadoSunat ? 1 : 0)
    .input('anexoSunatSugerido', sql.VarChar(5), row.anexoSunatSugerido || null)
    .input('codigoSunatSugerido', sql.VarChar(8), row.codigoSunatSugerido || null)
    .query(
      `INSERT INTO Productos (
        idProducto, idEmpresa, Codigo, idCategoria, descripcion, idMarca, idPresentacion,
        cUnitario, fProduccion, fVencimiento, alertaMinimo, alertaMaximo, VecesVendidas,
        facturar, idUsuario, FIngreso, estado, tipoProducto, permiteDescripcionEnVenta,
        codigoProductoSunat, requiereCodigoSunat, revisadoSunat, anexoSunatSugerido, codigoSunatSugerido
      ) VALUES (
        @idProducto, @idEmpresa, @Codigo, @idCategoria, @descripcion, @idMarca, @idPresentacion,
        @cUnitario, @fProduccion, @fVencimiento, @alertaMinimo, @alertaMaximo, @VecesVendidas,
        @facturar, @idUsuario, @FIngreso, @estado, @tipoProducto, @permiteDescripcionEnVenta,
        @codigoProductoSunat, @requiereCodigoSunat, @revisadoSunat, @anexoSunatSugerido, @codigoSunatSugerido
      )`
    );
};

exports.insertarLoteInicial = async (transaction, row) => {
  return transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, row.idProducto)
    .input('idSucursal', sql.UniqueIdentifier, row.idSucursal)
    .input('costoUnitario', sql.Decimal(18, 6), row.costoUnitario)
    .input('cantidadIngresada', sql.Decimal(18, 2), row.cantidadIngresada)
    .input('cantidadDisponible', sql.Decimal(18, 2), row.cantidadDisponible)
    .query(
      'INSERT INTO Lotes (idLote, idEmpresa, idProducto, idSucursal, costoUnitario, cantidadIngresada, cantidadDisponible) VALUES (NEWID(), @idEmpresa, @idProducto, @idSucursal, @costoUnitario, @cantidadIngresada, @cantidadDisponible)'
    );
};

exports.actualizarProductoCompra = async (pool, detalle) => {
  return pool
    .request()
    .input('idProducto', sql.UniqueIdentifier, detalle.idProducto)
    .input('idEmpresa', sql.UniqueIdentifier, detalle.idEmpresa)
    .input('Codigo', sql.VarChar, detalle.Codigo)
    .input('idCategoria', sql.Int, detalle.idCategoria)
    .input('descripcion', sql.VarChar, detalle.descripcion)
    .input('idMarca', sql.Int, detalle.idMarca)
    .input('idPresentacion', sql.Int, detalle.idPresentacion)
    .input('cUnitario', sql.Decimal(18, 5), detalle.cUnitario)
    .input('fProduccion', sql.VarChar, detalle.fProduccion)
    .input('fVencimiento', sql.VarChar, detalle.fVencimiento)
    .query(
      'UPDATE Productos SET Codigo = @Codigo, idCategoria = @idCategoria, descripcion = @descripcion, idPresentacion = @idPresentacion, cUnitario = @cUnitario, fProduccion = @fProduccion, fVencimiento = @fVencimiento WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa'
    );
};

/** Actualiza el costo de catálogo (último costo de compra) para que Precios de venta lo refleje. */
exports.actualizarCUnitarioDesdeCompra = async (executor, idEmpresa, idProducto, cUnitario) => {
  const req = typeof executor.request === 'function' ? executor.request() : executor;
  return req
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('cUnitario', sql.Decimal(18, 6), cUnitario)
    .query(`
      UPDATE Productos
      SET cUnitario = @cUnitario
      WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa
    `);
};

/** Alta desde compra: mismo INSERT nominado que el catálogo (evita error 213 si Productos tiene columnas nuevas). */
exports.insertarProductoCompraValores = async (transaction, detalle) => {
  return exports.insertarProducto(transaction, detalle);
};

/**
 * Cuenta líneas en ventas o compras que impiden borrar el producto (integridad documental).
 * @param {import('mssql').Transaction} transaction
 */
exports.contarLineasHistoricasVentasCompras = async (transaction, idProducto, idEmpresa) => {
  const r = await transaction
    .request()
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        ISNULL((
          SELECT COUNT_BIG(1) FROM DetalleVenta dv
          INNER JOIN Ventas v ON v.idVenta = dv.idVenta
          WHERE dv.idProducto = @idProducto AND v.idEmpresa = @idEmpresa
        ), 0)
        + ISNULL((
          SELECT COUNT_BIG(1) FROM DetalleCompras dc
          INNER JOIN Compras c ON c.idCompra = dc.idCompra AND c.idEmpresa = dc.idEmpresa
          WHERE dc.idProducto = @idProducto AND c.idEmpresa = @idEmpresa
        ), 0) AS n
    `);
  return Number(r.recordset[0]?.n || 0);
};

/**
 * Elimina dependencias de inventario/precios/etc. No borra Productos ni valida ventas/compras.
 * @param {import('mssql').Transaction} transaction
 */
exports.eliminarFilasRelacionadasProducto = async (transaction, idProducto, idEmpresa) => {
  const exec = (sql) =>
    transaction
      .request()
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(sql);

  await exec(`
    IF OBJECT_ID('dbo.ConsumoHabitacion','U') IS NOT NULL
      DELETE FROM dbo.ConsumoHabitacion WHERE idEmpresa = @idEmpresa AND (idProducto = @idProducto OR idProductoHabitacion = @idProducto);
  `);
  await exec(`
    IF OBJECT_ID('dbo.Tanques','U') IS NOT NULL
      DELETE FROM dbo.Tanques WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto;
  `);
  await exec(`
    IF OBJECT_ID('dbo.InventarioFisicoLinea','U') IS NOT NULL
      DELETE FROM dbo.InventarioFisicoLinea WHERE idProducto = @idProducto;
  `);
  await exec(`
    IF OBJECT_ID('dbo.DetalleValeDespacho','U') IS NOT NULL
      DELETE FROM dbo.DetalleValeDespacho WHERE idProducto = @idProducto;
  `);
  await exec(`
    IF OBJECT_ID('dbo.DetalleCotizacion','U') IS NOT NULL AND COL_LENGTH('dbo.DetalleCotizacion','idProducto') IS NOT NULL
      DELETE FROM dbo.DetalleCotizacion WHERE idProducto = @idProducto;
  `);
  await exec(`
    IF OBJECT_ID('dbo.Reservas','U') IS NOT NULL AND COL_LENGTH('dbo.Reservas', 'idProductoHabitacion') IS NOT NULL
      UPDATE dbo.Reservas SET idProductoHabitacion = NULL WHERE idProductoHabitacion = @idProducto;
  `);
  await exec(`DELETE FROM DetalleDespachos WHERE idProducto = @idProducto;`);
  await exec(`DELETE FROM ProductosCompuestos WHERE idProductoHijo = @idProducto;`);
  await exec(`DELETE FROM ProductosCompuestos WHERE idProductoPadre = @idProducto;`);
  await exec(`
    IF OBJECT_ID('dbo.VarianteAtributos','U') IS NOT NULL AND OBJECT_ID('dbo.VariantesProducto','U') IS NOT NULL
      DELETE va FROM dbo.VarianteAtributos va
      INNER JOIN dbo.VariantesProducto vp ON vp.idVariante = va.idVariante
      WHERE vp.idProductoBase = @idProducto;
  `);
  await exec(`
    IF OBJECT_ID('dbo.VariantesProducto','U') IS NOT NULL
      DELETE FROM dbo.VariantesProducto WHERE idProductoBase = @idProducto;
  `);
  await exec(`
    IF OBJECT_ID('dbo.MovimientosDetalle','U') IS NOT NULL
      DELETE md FROM dbo.MovimientosDetalle md
      INNER JOIN dbo.MovimientosInventario m ON m.idMovimiento = md.idMovimiento
      WHERE m.idEmpresa = @idEmpresa AND m.idProducto = @idProducto;
  `);
  await exec(
    `DELETE FROM MovimientosInventario WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto;`
  );
  await exec(`
    IF OBJECT_ID('dbo.LotesUbicacion','U') IS NOT NULL
      DELETE lu FROM dbo.LotesUbicacion lu
      INNER JOIN dbo.Lotes l ON l.idLote = lu.idLote
      WHERE l.idEmpresa = @idEmpresa AND l.idProducto = @idProducto;
  `);
  await exec(`DELETE FROM Lotes WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto;`);
  await exec(`
    IF OBJECT_ID('dbo.StockSucursal','U') IS NOT NULL
      DELETE FROM dbo.StockSucursal WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto;
  `);
  await exec(`DELETE FROM PreciosProducto WHERE idProducto = @idProducto;`);
  await exec(`
    IF OBJECT_ID('dbo.DetalleAsientos','U') IS NOT NULL
      UPDATE dbo.DetalleAsientos SET idProducto = NULL WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto;
  `);
};

/** DELETE de la fila en Productos (usar tras eliminarFilasRelacionadasProducto). Acepta pool o transacción. */
exports.eliminarProductoPorId = async (poolOrTransaction, idProducto, idEmpresa) => {
  return poolOrTransaction
    .request()
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('DELETE FROM Productos WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa');
};

/** Solo cambia el bit estado (catálogo activo/inactivo). */
/**
 * Actualiza solo descripción, categoría y presentación (pantalla conteo físico).
 * Acepta pool o transacción.
 */
exports.actualizarMaestroConteoFisico = async (conn, { idEmpresa, idProducto, descripcion, idCategoria, idPresentacion, idMarca }) => {
  const desc = descripcion != null ? String(descripcion).trim().substring(0, 200) : null;
  if (!desc) {
    throw new Error('La descripción no puede quedar vacía');
  }
  const req = conn
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('descripcion', sql.VarChar(200), desc)
    .input('idCategoria', sql.Int, idCategoria)
    .input('idPresentacion', sql.Int, idPresentacion);
  if (idMarca != null && Number.isInteger(Number(idMarca)) && Number(idMarca) > 0) {
    req.input('idMarca', sql.Int, Number(idMarca));
    return req.query(`
      UPDATE dbo.Productos
      SET descripcion = @descripcion, idCategoria = @idCategoria, idPresentacion = @idPresentacion, idMarca = @idMarca
      WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto AND estado = 1
    `);
  }
  return req.query(`
    UPDATE dbo.Productos
    SET descripcion = @descripcion, idCategoria = @idCategoria, idPresentacion = @idPresentacion
    WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto AND estado = 1
  `);
};

exports.actualizarEstadoProductoPorId = async (pool, idProducto, idEmpresa, estadoActivo) => {
  return pool
    .request()
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('estado', sql.Bit, estadoActivo ? 1 : 0)
    .query(
      'UPDATE Productos SET estado = @estado WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa'
    );
};

exports.actualizarProductoFlexible = async (conn, detalle) => {
  const request = conn
    .request()
    .input('idProducto', sql.UniqueIdentifier, detalle.idProducto)
    .input('idEmpresa', sql.UniqueIdentifier, detalle.idEmpresa)
    .input('Codigo', sql.VarChar, detalle.Codigo)
    .input('idCategoria', sql.Int, detalle.idCategoria)
    .input('descripcion', sql.VarChar, detalle.descripcion)
    .input('idMarca', sql.Int, detalle.idMarca)
    .input('idPresentacion', sql.Int, detalle.idPresentacion)
    .input('cUnitario', sql.Decimal(18, 5), detalle.cUnitario)
    .input('fProduccion', sql.VarChar, detalle.fProduccion)
    .input('fVencimiento', sql.VarChar, detalle.fVencimiento);
  let updateSql =
    'UPDATE Productos SET Codigo = @Codigo, idCategoria = @idCategoria, descripcion = @descripcion, idMarca = @idMarca, idPresentacion = @idPresentacion, cUnitario = @cUnitario, fProduccion = @fProduccion, fVencimiento = @fVencimiento';
  if (detalle.tipoProducto !== undefined) {
    request.input('tipoProducto', sql.Char(1), detalle.tipoProducto);
    updateSql += ', tipoProducto = @tipoProducto';
  }
  if (detalle.alertaMinimo !== undefined) {
    request.input('alertaMinimo', sql.Decimal(18, 2), detalle.alertaMinimo);
    updateSql += ', alertaMinimo = @alertaMinimo';
  }
  if (detalle.alertaMaximo !== undefined) {
    request.input('alertaMaximo', sql.Decimal(18, 2), detalle.alertaMaximo);
    updateSql += ', alertaMaximo = @alertaMaximo';
  }
  if (detalle.estado !== undefined) {
    request.input('estado', sql.Bit, detalle.estado);
    updateSql += ', estado = @estado';
  }
  if (detalle.permiteDescripcionEnVenta !== undefined) {
    request.input('permiteDescripcionEnVenta', sql.Bit, detalle.permiteDescripcionEnVenta);
    updateSql += ', permiteDescripcionEnVenta = @permiteDescripcionEnVenta';
  }
  if (detalle.codigoProductoSunat !== undefined) {
    request.input('codigoProductoSunat', sql.VarChar(8), detalle.codigoProductoSunat || null);
    updateSql += ', codigoProductoSunat = @codigoProductoSunat';
  }
  if (detalle.requiereCodigoSunat !== undefined) {
    request.input(
      'requiereCodigoSunat',
      sql.Bit,
      detalle.requiereCodigoSunat === true || detalle.requiereCodigoSunat === 1
        ? 1
        : detalle.requiereCodigoSunat === false || detalle.requiereCodigoSunat === 0
          ? 0
          : null
    );
    updateSql += ', requiereCodigoSunat = @requiereCodigoSunat';
  }
  if (detalle.revisadoSunat !== undefined) {
    request.input('revisadoSunat', sql.Bit, detalle.revisadoSunat ? 1 : 0);
    updateSql += ', revisadoSunat = @revisadoSunat';
  }
  if (detalle.anexoSunatSugerido !== undefined) {
    request.input('anexoSunatSugerido', sql.VarChar(5), detalle.anexoSunatSugerido || null);
    updateSql += ', anexoSunatSugerido = @anexoSunatSugerido';
  }
  if (detalle.codigoSunatSugerido !== undefined) {
    request.input('codigoSunatSugerido', sql.VarChar(8), detalle.codigoSunatSugerido || null);
    updateSql += ', codigoSunatSugerido = @codigoSunatSugerido';
  }
  updateSql += ' WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa';
  return request.query(updateSql);
};

/** Actualiza solo campos de cumplimiento código producto SUNAT. */
exports.actualizarCamposCodigoSunat = async (pool, {
  idProducto,
  idEmpresa,
  codigoProductoSunat,
  requiereCodigoSunat,
  revisadoSunat,
  anexoSunatSugerido,
  codigoSunatSugerido
}) => {
  const sets = [];
  const req = pool
    .request()
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa);

  if (codigoProductoSunat !== undefined) {
    req.input('codigoProductoSunat', sql.VarChar(8), codigoProductoSunat || null);
    sets.push('codigoProductoSunat = @codigoProductoSunat');
  }
  if (requiereCodigoSunat !== undefined) {
    req.input(
      'requiereCodigoSunat',
      sql.Bit,
      requiereCodigoSunat === true || requiereCodigoSunat === 1
        ? 1
        : requiereCodigoSunat === false || requiereCodigoSunat === 0
          ? 0
          : null
    );
    sets.push('requiereCodigoSunat = @requiereCodigoSunat');
  }
  if (revisadoSunat !== undefined) {
    req.input('revisadoSunat', sql.Bit, revisadoSunat ? 1 : 0);
    sets.push('revisadoSunat = @revisadoSunat');
  }
  if (anexoSunatSugerido !== undefined) {
    req.input('anexoSunatSugerido', sql.VarChar(5), anexoSunatSugerido || null);
    sets.push('anexoSunatSugerido = @anexoSunatSugerido');
  }
  if (codigoSunatSugerido !== undefined) {
    req.input('codigoSunatSugerido', sql.VarChar(8), codigoSunatSugerido || null);
    sets.push('codigoSunatSugerido = @codigoSunatSugerido');
  }
  if (!sets.length) return { rowsAffected: [0] };
  return req.query(`
    UPDATE Productos
    SET ${sets.join(', ')}
    WHERE idProducto = @idProducto AND idEmpresa = @idEmpresa
  `);
};

/**
 * Productos pendientes / filtro cumplimiento código SUNAT (por empresa).
 */
exports.listarProductosCodigoSunatPendientes = async (pool, idEmpresa, filtros = {}) => {
  const lim = Math.min(Math.max(parseInt(filtros.limite, 10) || 100, 1), 500);
  const req = pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('limite', sql.Int, lim);

  let where = 'WHERE p.idEmpresa = @idEmpresa AND p.estado = 1';
  const filtro = String(filtros.filtro || 'pendientes').trim().toLowerCase();

  if (filtro === 'requiere_sin_codigo') {
    where += ` AND p.requiereCodigoSunat = 1
      AND NULLIF(LTRIM(RTRIM(ISNULL(p.codigoProductoSunat, ''))), '') IS NULL`;
  } else if (filtro === 'sugeridos') {
    where += ` AND NULLIF(LTRIM(RTRIM(ISNULL(p.codigoSunatSugerido, ''))), '') IS NOT NULL
      AND NULLIF(LTRIM(RTRIM(ISNULL(p.codigoProductoSunat, ''))), '') IS NULL
      AND (p.requiereCodigoSunat IS NULL OR p.requiereCodigoSunat = 1)`;
  } else if (filtro === 'sin_revisar') {
    where += ' AND ISNULL(p.revisadoSunat, 0) = 0';
  } else if (filtro === 'no_aplica') {
    where += ' AND p.requiereCodigoSunat = 0';
  } else if (filtro === 'con_codigo') {
    where += ` AND NULLIF(LTRIM(RTRIM(ISNULL(p.codigoProductoSunat, ''))), '') IS NOT NULL`;
  } else if (filtro === 'todos_sin_codigo') {
    where += ` AND NULLIF(LTRIM(RTRIM(ISNULL(p.codigoProductoSunat, ''))), '') IS NULL`;
  } else {
    // pendientes: requiere sin código OR sugerido sin código OR sin revisar con sugerencia
    where += ` AND (
      (p.requiereCodigoSunat = 1 AND NULLIF(LTRIM(RTRIM(ISNULL(p.codigoProductoSunat, ''))), '') IS NULL)
      OR (
        NULLIF(LTRIM(RTRIM(ISNULL(p.codigoSunatSugerido, ''))), '') IS NOT NULL
        AND NULLIF(LTRIM(RTRIM(ISNULL(p.codigoProductoSunat, ''))), '') IS NULL
        AND ISNULL(p.revisadoSunat, 0) = 0
      )
    )`;
  }

  if (filtros.anexo && ['25.1', '25.2', '25.3'].includes(String(filtros.anexo).trim())) {
    req.input('anexo', sql.VarChar(5), String(filtros.anexo).trim());
    where += ' AND p.anexoSunatSugerido = @anexo';
  }
  if (filtros.idCategoria != null && String(filtros.idCategoria).trim() !== '') {
    req.input('idCategoria', sql.Int, parseInt(filtros.idCategoria, 10));
    where += ' AND p.idCategoria = @idCategoria';
  }
  if (filtros.idMarca != null && String(filtros.idMarca).trim() !== '') {
    req.input('idMarca', sql.Int, parseInt(filtros.idMarca, 10));
    where += ' AND p.idMarca = @idMarca';
  }
  if (filtros.q && String(filtros.q).trim()) {
    req.input('q', sql.VarChar(100), `%${String(filtros.q).trim()}%`);
    where += ' AND (p.Codigo LIKE @q OR p.descripcion LIKE @q OR p.codigoProductoSunat LIKE @q)';
  }

  const r = await req.query(`
    SELECT TOP (@limite)
      p.idProducto,
      p.Codigo AS codigo,
      p.descripcion,
      c.nombre AS categoria,
      m.nombre AS marca,
      NULLIF(LTRIM(RTRIM(ISNULL(p.codigoProductoSunat, ''))), '') AS codigoProductoSunat,
      p.requiereCodigoSunat,
      ISNULL(p.revisadoSunat, 0) AS revisadoSunat,
      NULLIF(LTRIM(RTRIM(ISNULL(p.anexoSunatSugerido, ''))), '') AS anexoSunatSugerido,
      NULLIF(LTRIM(RTRIM(ISNULL(p.codigoSunatSugerido, ''))), '') AS codigoSunatSugerido
    FROM Productos p
    INNER JOIN Categorias c ON c.idCategoria = p.idCategoria
    INNER JOIN Marcas m ON m.idMarca = p.idMarca
    ${where}
    ORDER BY p.descripcion
  `);
  return r.recordset || [];
};

/**
 * Stock por ubicación (LotesUbicacion) de un producto en sucursal. Lista todas las ubicaciones de la sucursal con cantidad (0 si no hay lote).
 */
exports.listarStockUbicacionesProductoSucursal = async (pool, idEmpresa, idSucursal, idProducto) => {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      SELECT
        up.idUbicacion,
        RTRIM(LTRIM(ISNULL(up.codigoUbicacion, ''))) AS codigoUbicacion,
        up.prioridad,
        CAST(ISNULL(SUM(lu.cantidad), 0) AS DECIMAL(18, 3)) AS cantidad
      FROM UbicacionesPrioridad up
      LEFT JOIN Lotes l ON l.idSucursal = up.idSucursal
        AND l.idEmpresa = @idEmpresa
        AND l.idProducto = @idProducto
        AND l.cantidadDisponible > 0
      LEFT JOIN LotesUbicacion lu ON lu.idLote = l.idLote AND lu.idUbicacion = up.idUbicacion AND lu.cantidad > 0
      WHERE up.idSucursal = @idSucursal
      GROUP BY up.idUbicacion, up.codigoUbicacion, up.prioridad
      ORDER BY up.prioridad ASC, up.idUbicacion
    `);
  const rows = (r.recordset || []).map((row) => ({
    idUbicacion: row.idUbicacion != null ? Number(row.idUbicacion) : null,
    codigoUbicacion: row.codigoUbicacion != null ? String(row.codigoUbicacion).trim() : '',
    prioridad: row.prioridad != null ? Number(row.prioridad) : 0,
    cantidad: row.cantidad != null ? Number(row.cantidad) : 0
  }));

  const rTot = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      SELECT CAST(COALESCE(SUM(l.cantidadDisponible), 0) AS DECIMAL(18, 3)) AS totalLotes
      FROM Lotes l
      WHERE l.idEmpresa = @idEmpresa AND l.idSucursal = @idSucursal AND l.idProducto = @idProducto
    `);
  const rLu = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      SELECT CAST(COALESCE(SUM(lu.cantidad), 0) AS DECIMAL(18, 3)) AS totalLu
      FROM LotesUbicacion lu
      INNER JOIN Lotes l ON l.idLote = lu.idLote
      WHERE l.idEmpresa = @idEmpresa AND l.idSucursal = @idSucursal AND l.idProducto = @idProducto
    `);
  const totalLotes = rTot.recordset && rTot.recordset[0] ? Number(rTot.recordset[0].totalLotes) || 0 : 0;
  const totalLu = rLu.recordset && rLu.recordset[0] ? Number(rLu.recordset[0].totalLu) || 0 : 0;
  const diff = totalLotes - totalLu;
  if (diff > 0.0005) {
    rows.push({
      idUbicacion: -1,
      codigoUbicacion: 'Sin ubicación asignada (solo en lotes)',
      prioridad: 999999,
      cantidad: diff,
      esSinUbicacion: true
    });
  }
  return rows;
};