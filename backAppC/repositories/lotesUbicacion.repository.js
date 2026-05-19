const sql = require('mssql');
const { withPool } = require('../utils/dbPool.util');
const { clausulaBusquedaProductoMultiPalabra } = require('../utils/productoBusqueda.util');

function construirInClauseUuid(request, ids, prefix) {
  const valid = (ids || []).filter((id) => id && String(id).trim());
  if (!valid.length) {
    return null;
  }
  return valid
    .map((id, i) => {
      const key = `${prefix}${i}`;
      request.input(key, sql.UniqueIdentifier, String(id).trim());
      return `@${key}`;
    })
    .join(', ');
}

async function getByLote(idLote) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .query(`SELECT lu.*, up.codigoUbicacion, up.prioridad 
                FROM LotesUbicacion lu
                JOIN UbicacionesPrioridad up ON lu.idUbicacion = up.idUbicacion
                WHERE lu.idLote = @idLote`);
    return result.recordset;
  });
}

async function getByUbicacion(idUbicacion) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idUbicacion', sql.Int, idUbicacion)
      .query(`SELECT lu.*, l.idProducto, l.costoUnitario 
                FROM LotesUbicacion lu
                JOIN Lotes l ON lu.idLote = l.idLote
                WHERE lu.idUbicacion = @idUbicacion`);
    return result.recordset;
  });
}

async function create(idLote, idUbicacion, cantidad) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .input('idUbicacion', sql.Int, idUbicacion)
      .input('cantidad', sql.Int, cantidad)
      .query('INSERT INTO LotesUbicacion (idLote, idUbicacion, cantidad) VALUES (@idLote, @idUbicacion, @cantidad)');
    return result;
  });
}

async function updateCantidad(idLote, idUbicacion, cantidad) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .input('idUbicacion', sql.Int, idUbicacion)
      .input('cantidad', sql.Int, cantidad)
      .query('UPDATE LotesUbicacion SET cantidad = @cantidad WHERE idLote = @idLote AND idUbicacion = @idUbicacion');
    return result;
  });
}

async function deleted(idLote, idUbicacion) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idLote', sql.UniqueIdentifier, idLote)
      .input('idUbicacion', sql.Int, idUbicacion)
      .query('DELETE FROM LotesUbicacion WHERE idLote = @idLote AND idUbicacion = @idUbicacion');
    return result;
  });
}

async function getUbicacionesDisponiblesPrioridad(idProducto, idSucursal) {
  return withPool(async (pool) => {
    const result = await pool.request()
      .input('idProducto', sql.UniqueIdentifier, idProducto)
      .input('idSucursal', sql.UniqueIdentifier, idSucursal)
      .query(`SELECT 
                    l.idLote, 
                    lu.idUbicacion, 
                    up.codigoUbicacion, 
                    up.prioridad,
                    lu.cantidad,
                    l.costoUnitario
                FROM Lotes l
                JOIN LotesUbicacion lu ON l.idLote = lu.idLote
                JOIN UbicacionesPrioridad up ON lu.idUbicacion = up.idUbicacion
                WHERE l.idProducto = @idProducto 
                  AND l.idSucursal = @idSucursal
                  AND l.cantidadDisponible > 0
                  AND lu.cantidad > 0
                ORDER BY up.prioridad ASC`);
    return result.recordset;
  });
}

/**
 * Productos con stock asignado a al menos una ubicación (para traslado).
 */
async function buscarProductosConStockUbicacion(pool, idsEmpresa, opts = {}) {
  const ids = (idsEmpresa || []).filter(Boolean);
  if (!ids.length) {
    return [];
  }
  const request = pool.request();
  const inClause = construirInClauseUuid(request, ids, 'idEmpresaBusUb');
  if (!inClause) {
    return [];
  }
  const idSucursal =
    opts.idSucursal && String(opts.idSucursal).trim() ? String(opts.idSucursal).trim() : null;
  if (idSucursal) {
    request.input('idSucursal', sql.UniqueIdentifier, idSucursal);
  }
  const busqueda = clausulaBusquedaProductoMultiPalabra(request, opts.buscar, 'busTrasUb');
  const whereSucursal = idSucursal ? 'AND l.idSucursal = @idSucursal' : '';
  const whereBus = busqueda.clause || '';

  const result = await request.query(`
    SELECT
      p.idProducto,
      p.idEmpresa,
      p.codigo AS codigoProducto,
      p.descripcion AS nombreProducto,
      ISNULL(m.nombre, '') AS marca,
      c.nombre AS categoria,
      CAST(COALESCE(SUM(lu.cantidad), 0) AS DECIMAL(18, 3)) AS stockEnUbicaciones,
      ISNULL(e.alias, ISNULL(e.nombreComercial, e.razon_Social)) AS aliasEmpresa
    FROM Productos p
    INNER JOIN Categorias c ON p.idCategoria = c.idCategoria AND c.idEmpresa = p.idEmpresa
    LEFT JOIN Marcas m ON m.idMarca = p.idMarca AND m.idEmpresa = p.idEmpresa
    INNER JOIN Empresas e ON e.idEmpresa = p.idEmpresa
    INNER JOIN Lotes l ON l.idProducto = p.idProducto AND l.idEmpresa = p.idEmpresa
    INNER JOIN LotesUbicacion lu ON lu.idLote = l.idLote AND CAST(lu.cantidad AS DECIMAL(18, 3)) > 0
    WHERE p.idEmpresa IN (${inClause})
      ${whereSucursal}
      ${whereBus}
    GROUP BY
      p.idProducto, p.idEmpresa, p.codigo, p.descripcion, m.nombre, c.nombre,
      e.alias, e.nombreComercial, e.razon_Social
    HAVING SUM(lu.cantidad) > 0
    ORDER BY p.descripcion
  `);
  return result.recordset || [];
}

/** Lotes del producto que tienen stock en ubicaciones. */
async function listarLotesTrasladablesPorProducto(pool, idEmpresa, idProducto, idSucursal) {
  const request = pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto);
  let whereSucursal = '';
  if (idSucursal && String(idSucursal).trim()) {
    request.input('idSucursal', sql.UniqueIdentifier, String(idSucursal).trim());
    whereSucursal = 'AND l.idSucursal = @idSucursal';
  }
  const result = await request.query(`
    SELECT
      l.idLote,
      l.idProducto,
      l.idSucursal,
      l.numeroLote,
      CAST(l.cantidadDisponible AS DECIMAL(18, 3)) AS cantidadDisponible,
      s.nombre AS nombreSucursal,
      CAST(COALESCE(SUM(lu.cantidad), 0) AS DECIMAL(18, 3)) AS stockEnUbicaciones
    FROM Lotes l
    INNER JOIN Sucursal s ON s.idSucursal = l.idSucursal
    INNER JOIN LotesUbicacion lu ON lu.idLote = l.idLote AND lu.cantidad > 0
    WHERE l.idEmpresa = @idEmpresa
      AND l.idProducto = @idProducto
      ${whereSucursal}
    GROUP BY l.idLote, l.idProducto, l.idSucursal, l.numeroLote, l.cantidadDisponible, s.nombre, l.fechaIngreso
    HAVING SUM(lu.cantidad) > 0
    ORDER BY l.fechaIngreso DESC
  `);
  return result.recordset || [];
}

/**
 * Traslado atómico entre ubicaciones del mismo lote.
 */
async function trasladoEntreUbicaciones(pool, idLote, idUbicacionOrigen, idUbicacionDestino, cantidad) {
  const qty = Number(cantidad);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('La cantidad debe ser mayor a cero');
  }
  const idUbOrigen = parseInt(String(idUbicacionOrigen), 10);
  const idUbDestino = parseInt(String(idUbicacionDestino), 10);
  if (!Number.isFinite(idUbOrigen) || idUbOrigen < 1 || !Number.isFinite(idUbDestino) || idUbDestino < 1) {
    throw new Error('Ubicaciones origen y destino inválidas');
  }
  if (idUbOrigen === idUbDestino) {
    throw new Error('La ubicación origen y destino deben ser diferentes');
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const reqOrigen = new sql.Request(transaction);
    const rOrigen = await reqOrigen
      .input('idLote', sql.UniqueIdentifier, idLote)
      .input('idUbicacion', sql.Int, idUbOrigen)
      .query(`
        SELECT CAST(cantidad AS DECIMAL(18, 3)) AS cantidad
        FROM LotesUbicacion
        WHERE idLote = @idLote AND idUbicacion = @idUbicacion
      `);
    const rowOrigen = rOrigen.recordset && rOrigen.recordset[0];
    const stockOrigen = rowOrigen ? Number(rowOrigen.cantidad) || 0 : 0;
    if (stockOrigen < qty) {
      throw new Error(`Stock insuficiente en origen. Disponible: ${stockOrigen}`);
    }
    const nuevaOrigen = stockOrigen - qty;
    const reqUpdOrigen = new sql.Request(transaction);
    if (nuevaOrigen <= 0) {
      await reqUpdOrigen
        .input('idLote', sql.UniqueIdentifier, idLote)
        .input('idUbicacion', sql.Int, idUbOrigen)
        .query('DELETE FROM LotesUbicacion WHERE idLote = @idLote AND idUbicacion = @idUbicacion');
    } else {
      await reqUpdOrigen
        .input('idLote', sql.UniqueIdentifier, idLote)
        .input('idUbicacion', sql.Int, idUbOrigen)
        .input('cantidad', sql.Decimal(18, 3), nuevaOrigen)
        .query(
          'UPDATE LotesUbicacion SET cantidad = @cantidad WHERE idLote = @idLote AND idUbicacion = @idUbicacion'
        );
    }

    const reqDest = new sql.Request(transaction);
    const rDest = await reqDest
      .input('idLote', sql.UniqueIdentifier, idLote)
      .input('idUbicacion', sql.Int, idUbDestino)
      .query(`
        SELECT CAST(cantidad AS DECIMAL(18, 3)) AS cantidad
        FROM LotesUbicacion
        WHERE idLote = @idLote AND idUbicacion = @idUbicacion
      `);
    const rowDest = rDest.recordset && rDest.recordset[0];
    const stockDest = rowDest ? Number(rowDest.cantidad) || 0 : 0;
    const reqUpdDest = new sql.Request(transaction);
    if (stockDest > 0) {
      await reqUpdDest
        .input('idLote', sql.UniqueIdentifier, idLote)
        .input('idUbicacion', sql.Int, idUbDestino)
        .input('cantidad', sql.Decimal(18, 3), stockDest + qty)
        .query(
          'UPDATE LotesUbicacion SET cantidad = @cantidad WHERE idLote = @idLote AND idUbicacion = @idUbicacion'
        );
    } else {
      await reqUpdDest
        .input('idLote', sql.UniqueIdentifier, idLote)
        .input('idUbicacion', sql.Int, idUbDestino)
        .input('cantidad', sql.Decimal(18, 3), qty)
        .query(
          'INSERT INTO LotesUbicacion (idLote, idUbicacion, cantidad) VALUES (@idLote, @idUbicacion, @cantidad)'
        );
    }

    await transaction.commit();
    return { cantidad: qty, stockOrigenRestante: Math.max(0, nuevaOrigen), stockDestino: stockDest + qty };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {
      /* ignore */
    }
    throw err;
  }
}

module.exports = {
  getByLote,
  getByUbicacion,
  create,
  updateCantidad,
  deleted,
  getUbicacionesDisponiblesPrioridad,
  buscarProductosConStockUbicacion,
  listarLotesTrasladablesPorProducto,
  trasladoEntreUbicaciones
};
