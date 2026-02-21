// repositories/stock.repository.js
const sql = require('mssql');

exports.ejecutarDescuento = async (transaction, stockData) => {
  const {
    idEmpresa,
    idSucursal,
    idProducto,
    cantidad
  } = stockData;

  const request = transaction.request();
  
  // Parámetros del stored procedure
  request.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  request.input('idSucursal', sql.UniqueIdentifier, idSucursal);
  request.input('idProducto', sql.UniqueIdentifier, idProducto);
  request.input('cantidad', sql.Decimal(18, 2), cantidad);

  // Ejecuta el SP (tu lógica existente)
  const result = await request.execute('sp_DescontarStock');
  
  return result; // Devuelve resultado del SP
};

/**
 * Query: filas para descontar por prioridad (Lotes + LotesUbicacion + UbicacionesPrioridad).
 * Filtra por idEmpresa (multiempresa), idSucursal opcional, idProducto. Orden: prioridad ASC.
 */
const queryFilasPorPrioridad = async (transaction, idEmpresa, idProducto, idSucursalFiltro) => {
  const req = transaction.request();
  req.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  req.input('idProducto', sql.UniqueIdentifier, idProducto);
  const whereSucursal = idSucursalFiltro != null && idSucursalFiltro !== ''
    ? ' AND l.idSucursal = @idSucursal'
    : '';
  if (idSucursalFiltro != null && idSucursalFiltro !== '') {
    req.input('idSucursal', sql.UniqueIdentifier, idSucursalFiltro);
  }
  const rs = await req.query(`
    SELECT
      l.idLote,
      lu.idUbicacion,
      CONVERT(DECIMAL(18,2), lu.cantidad) AS cantidadUbicacion
    FROM Lotes l
    INNER JOIN LotesUbicacion lu ON lu.idLote = l.idLote AND lu.cantidad > 0
    INNER JOIN UbicacionesPrioridad up ON up.idUbicacion = lu.idUbicacion AND up.idSucursal = l.idSucursal
    WHERE l.idEmpresa = @idEmpresa
      AND l.idProducto = @idProducto
      AND l.cantidadDisponible > 0
      ${whereSucursal}
    ORDER BY up.prioridad ASC, l.idLote
  `);
  return rs.recordset || [];
};

/**
 * Descuenta cantidad desde Lotes y LotesUbicacion respetando prioridad de UbicacionesPrioridad.
 * 1) Sucursal de la venta: descuenta por ubicación ordenada por prioridad (menor = primero).
 * 2) Otras sucursales de la empresa: mismo criterio por prioridad.
 * 3) Fallback: si queda restante y hay lotes sin ubicación o datos legacy, descuenta solo en Lotes.
 * Multiempresa: todas las consultas filtran por idEmpresa.
 */
exports.descontarDesdeLotes = async (transaction, stockData) => {
  const { idEmpresa, idSucursal, idProducto, cantidad } = stockData;
  const cant = parseFloat(cantidad) || 0;
  if (cant <= 0) return;
  if (!idEmpresa || !idProducto) return;

  let restante = cant;

  const conSucursal = idSucursal != null && idSucursal !== '';

  const descontarPorPrioridad = async (filas) => {
    for (const row of filas) {
      if (restante <= 0) break;
      const disp = parseFloat(row.cantidadUbicacion) || 0;
      if (disp <= 0) continue;
      const tomar = Math.min(restante, disp);
      const upLu = transaction.request();
      upLu.input('idLote', sql.UniqueIdentifier, row.idLote);
      upLu.input('idUbicacion', sql.Int, row.idUbicacion);
      upLu.input('tomar', sql.Decimal(18, 2), tomar);
      await upLu.query(`
        UPDATE LotesUbicacion SET cantidad = cantidad - @tomar
        WHERE idLote = @idLote AND idUbicacion = @idUbicacion
      `);
      const upLote = transaction.request();
      upLote.input('idLote', sql.UniqueIdentifier, row.idLote);
      upLote.input('tomar', sql.Decimal(18, 2), tomar);
      await upLote.query(`
        UPDATE Lotes SET cantidadDisponible = cantidadDisponible - @tomar
        WHERE idLote = @idLote
      `);
      restante -= tomar;
    }
  };

  if (conSucursal) {
    const filasSuc = await queryFilasPorPrioridad(transaction, idEmpresa, idProducto, idSucursal);
    await descontarPorPrioridad(filasSuc);
  }

  if (restante > 0) {
    if (conSucursal) {
      const reqOtras = transaction.request();
      reqOtras.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
      reqOtras.input('idSucursal', sql.UniqueIdentifier, idSucursal);
      reqOtras.input('idProducto', sql.UniqueIdentifier, idProducto);
      const rsOtras = await reqOtras.query(`
        SELECT l.idLote, lu.idUbicacion, CONVERT(DECIMAL(18,2), lu.cantidad) AS cantidadUbicacion
        FROM Lotes l
        INNER JOIN LotesUbicacion lu ON lu.idLote = l.idLote AND lu.cantidad > 0
        INNER JOIN UbicacionesPrioridad up ON up.idUbicacion = lu.idUbicacion AND up.idSucursal = l.idSucursal
        WHERE l.idEmpresa = @idEmpresa AND l.idProducto = @idProducto
          AND l.idSucursal <> @idSucursal AND l.cantidadDisponible > 0
        ORDER BY up.prioridad ASC, l.idLote
      `);
      await descontarPorPrioridad(rsOtras.recordset || []);
    } else {
      const filasTodas = await queryFilasPorPrioridad(transaction, idEmpresa, idProducto, null);
      await descontarPorPrioridad(filasTodas);
    }
  }

  if (restante <= 0) return;

  const ejecutarDescuentoSoloLotes = async (filas) => {
    for (const row of filas) {
      if (restante <= 0) break;
      const disp = parseFloat(row.cantidadDisponible) || 0;
      if (disp <= 0) continue;
      const tomar = Math.min(restante, disp);
      const nuevaCant = Math.max(0, disp - tomar);
      const upReq = transaction.request();
      upReq.input('idLote', sql.UniqueIdentifier, row.idLote);
      upReq.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
      upReq.input('nuevaCantidad', sql.Decimal(18, 2), nuevaCant);
      await upReq.query(`
        UPDATE Lotes SET cantidadDisponible = @nuevaCantidad
        WHERE idLote = @idLote AND idEmpresa = @idEmpresa
      `);
      restante -= tomar;
    }
  };

  const reqFallback = transaction.request();
  reqFallback.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  reqFallback.input('idProducto', sql.UniqueIdentifier, idProducto);
  const whereSuc = conSucursal ? ' AND idSucursal = @idSucursal' : '';
  if (conSucursal) reqFallback.input('idSucursal', sql.UniqueIdentifier, idSucursal);
  const rsFallback = await reqFallback.query(`
    SELECT idLote, CONVERT(DECIMAL(18,2), cantidadDisponible) AS cantidadDisponible
    FROM Lotes
    WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto AND cantidadDisponible > 0${whereSuc}
    ORDER BY idLote ASC
  `);
  await ejecutarDescuentoSoloLotes(rsFallback.recordset || []);

  if (restante > 0 && conSucursal) {
    const reqFallback2 = transaction.request();
    reqFallback2.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    reqFallback2.input('idProducto', sql.UniqueIdentifier, idProducto);
    reqFallback2.input('idSucursalExcluida', sql.UniqueIdentifier, idSucursal);
    const rsFallback2 = await reqFallback2.query(`
      SELECT idLote, CONVERT(DECIMAL(18,2), cantidadDisponible) AS cantidadDisponible
      FROM Lotes
      WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto AND cantidadDisponible > 0
        AND idSucursal <> @idSucursalExcluida
      ORDER BY idLote ASC
    `);
    await ejecutarDescuentoSoloLotes(rsFallback2.recordset || []);
  }

  if (restante > 0) {
    throw new Error('Stock insuficiente para el producto en la empresa');
  }
};