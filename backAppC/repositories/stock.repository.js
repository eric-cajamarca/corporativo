// repositories/stock.repository.js
const sql = require('mssql');
const inventarioRepository = require('./inventario.repository');

async function obtenerCostoUnitarioProducto(transaction, idEmpresa, idProducto) {
  const rs = await transaction
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .query(`
      SELECT ISNULL(cUnitario, 0) AS cUnitario
      FROM Productos
      WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto
    `);
  const v = rs.recordset && rs.recordset[0] ? rs.recordset[0].cUnitario : 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Descuenta cantidad dejando cantidadDisponible negativa en un lote (venta sin stock).
 * Crea lote en 0 si el producto no tiene ninguno en la sucursal.
 */
async function aplicarSaldoNegativoEnLote(transaction, { idEmpresa, idSucursal, idProducto, cantidad, consumos }) {
  const cant = parseFloat(cantidad) || 0;
  if (cant <= 0 || !idEmpresa || !idProducto) return;
  const conSucursal = idSucursal != null && idSucursal !== '';
  const req = transaction.request();
  req.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  req.input('idProducto', sql.UniqueIdentifier, idProducto);
  const whereSuc = conSucursal ? ' AND idSucursal = @idSucursal' : '';
  if (conSucursal) req.input('idSucursal', sql.UniqueIdentifier, idSucursal);

  const rs = await req.query(`
    SELECT TOP 1 idLote, ISNULL(costoUnitario, 0) AS costoUnitario,
      CONVERT(DECIMAL(18, 2), cantidadDisponible) AS cantidadDisponible
    FROM Lotes
    WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto${whereSuc}
    ORDER BY fechaIngreso DESC, idLote DESC
  `);

  let idLote = rs.recordset && rs.recordset[0] ? rs.recordset[0].idLote : null;
  let costoUnitario =
    rs.recordset && rs.recordset[0] && rs.recordset[0].costoUnitario != null
      ? parseFloat(rs.recordset[0].costoUnitario)
      : 0;
  let disp =
    rs.recordset && rs.recordset[0] && rs.recordset[0].cantidadDisponible != null
      ? parseFloat(rs.recordset[0].cantidadDisponible)
      : 0;

  if (!idLote) {
    if (!conSucursal) {
      throw new Error('No se pudo determinar la sucursal para registrar stock negativo.');
    }
    costoUnitario = await obtenerCostoUnitarioProducto(transaction, idEmpresa, idProducto);
    idLote = await inventarioRepository.crearLoteSinCompra(transaction, {
      idEmpresa,
      idProducto,
      idSucursal,
      costoUnitario,
      cantidad: 0
    });
    disp = 0;
  }

  if (!idLote) {
    throw new Error('No se pudo registrar el saldo negativo del producto.');
  }

  const nuevaCant = (Number.isFinite(disp) ? disp : 0) - cant;
  await transaction
    .request()
    .input('idLote', sql.UniqueIdentifier, idLote)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('nuevaCantidad', sql.Decimal(18, 2), nuevaCant)
    .query(`
      UPDATE Lotes SET cantidadDisponible = @nuevaCantidad
      WHERE idLote = @idLote AND idEmpresa = @idEmpresa
    `);

  consumos.push({
    idLote,
    cantidadTomada: cant,
    costoUnitario: Number.isFinite(costoUnitario) ? costoUnitario : 0
  });
}

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
 * Obtiene el stock disponible total de un producto (suma de Lotes.cantidadDisponible).
 * @param {object} transaction - Transacción SQL
 * @param {string} idEmpresa - UUID empresa
 * @param {string} idProducto - UUID producto
 * @param {string|null} idSucursal - UUID sucursal (opcional; si null, suma todas las sucursales)
 * @returns {Promise<number>} Cantidad disponible
 */
exports.obtenerStockDisponible = async (transaction, idEmpresa, idProducto, idSucursal) => {
  const req = transaction.request();
  req.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  req.input('idProducto', sql.UniqueIdentifier, idProducto);
  const whereSuc = idSucursal != null && idSucursal !== '' ? ' AND idSucursal = @idSucursal' : '';
  if (idSucursal != null && idSucursal !== '') req.input('idSucursal', sql.UniqueIdentifier, idSucursal);
  const rs = await req.query(`
    SELECT ISNULL(SUM(cantidadDisponible), 0) AS total
    FROM Lotes
    WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto AND cantidadDisponible > 0${whereSuc}
  `);
  const total = rs.recordset?.[0]?.total;
  return total != null ? parseFloat(total) : 0;
};

/**
 * Query: filas para descontar por prioridad (Lotes + LotesUbicacion + UbicacionesPrioridad).
 * Filtra por idEmpresa (multiempresa), idSucursal opcional, idProducto. Orden: prioridad ASC.
 */
const queryFilasPorPrioridad = async (transaction, idEmpresa, idProducto, idSucursalFiltro, idUbicacionFiltro) => {
  const req = transaction.request();
  req.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  req.input('idProducto', sql.UniqueIdentifier, idProducto);
  const whereSucursal = idSucursalFiltro != null && idSucursalFiltro !== ''
    ? ' AND l.idSucursal = @idSucursal'
    : '';
  if (idSucursalFiltro != null && idSucursalFiltro !== '') {
    req.input('idSucursal', sql.UniqueIdentifier, idSucursalFiltro);
  }
  const idUbF =
    idUbicacionFiltro != null && idUbicacionFiltro !== ''
      ? parseInt(String(idUbicacionFiltro), 10)
      : NaN;
  const whereUb = Number.isFinite(idUbF) && idUbF > 0 ? ' AND lu.idUbicacion = @idUbicacionFiltro' : '';
  if (whereUb) {
    req.input('idUbicacionFiltro', sql.Int, idUbF);
  }
  const rs = await req.query(`
    SELECT
      l.idLote,
      l.costoUnitario,
      lu.idUbicacion,
      CONVERT(DECIMAL(18,2), lu.cantidad) AS cantidadUbicacion
    FROM Lotes l
    INNER JOIN LotesUbicacion lu ON lu.idLote = l.idLote AND lu.cantidad > 0
    INNER JOIN UbicacionesPrioridad up ON up.idUbicacion = lu.idUbicacion AND up.idSucursal = l.idSucursal
    WHERE l.idEmpresa = @idEmpresa
      AND l.idProducto = @idProducto
      AND l.cantidadDisponible > 0
      ${whereSucursal}
      ${whereUb}
    ORDER BY up.prioridad ASC, l.idLote
  `);
  return rs.recordset || [];
};

/**
 * Descuenta cantidad desde Lotes y (opcional) LotesUbicacion respetando prioridad.
 * Si opciones.controlUbicaciones es false: solo descuenta en Lotes.cantidadDisponible (sin ubicaciones).
 * Si true: 1) por prioridad en LotesUbicacion, 2) fallback en Lotes.
 * Multiempresa: todas las consultas filtran por idEmpresa.
 */
exports.descontarDesdeLotes = async (transaction, stockData, opciones = {}) => {
  const { idEmpresa, idSucursal, idProducto, cantidad } = stockData;
  const cant = parseFloat(cantidad) || 0;
  if (cant <= 0) return { consumosPorLote: [] };
  if (!idEmpresa || !idProducto) return { consumosPorLote: [] };

  const controlUbicaciones = opciones.controlUbicaciones !== false;
  const idUbicacionSoloRaw = opciones.idUbicacionSolo;
  const idUbicacionSoloParsed =
    idUbicacionSoloRaw != null && idUbicacionSoloRaw !== ''
      ? parseInt(String(idUbicacionSoloRaw), 10)
      : NaN;
  const idUbicacionSolo =
    controlUbicaciones && Number.isFinite(idUbicacionSoloParsed) && idUbicacionSoloParsed > 0
      ? idUbicacionSoloParsed
      : null;
  const conSucursal = idSucursal != null && idSucursal !== '';
  let restante = cant;
  const consumos = [];

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
      const costoLote = row.costoUnitario != null ? parseFloat(row.costoUnitario) : 0;
      consumos.push({
        idLote: row.idLote,
        cantidadTomada: tomar,
        costoUnitario: costoLote
      });
      restante -= tomar;
    }
  };

  if (controlUbicaciones) {
    if (conSucursal) {
      const filasSuc = await queryFilasPorPrioridad(
        transaction,
        idEmpresa,
        idProducto,
        idSucursal,
        idUbicacionSolo
      );
      await descontarPorPrioridad(filasSuc);
    }
    if (!idUbicacionSolo && restante > 0) {
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
        const filasTodas = await queryFilasPorPrioridad(transaction, idEmpresa, idProducto, null, null);
        await descontarPorPrioridad(filasTodas);
      }
    }
  }

  if (restante <= 0) return { consumosPorLote: consumos };

  if (idUbicacionSolo) {
    if (opciones.permitirVentasNegativas) {
      await aplicarSaldoNegativoEnLote(transaction, {
        idEmpresa,
        idSucursal,
        idProducto,
        cantidad: restante,
        consumos
      });
      return { consumosPorLote: consumos };
    }
    throw new Error('Stock insuficiente en la ubicación seleccionada');
  }

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
      const costoLote = row.costoUnitario != null ? parseFloat(row.costoUnitario) : 0;
      consumos.push({
        idLote: row.idLote,
        cantidadTomada: tomar,
        costoUnitario: costoLote
      });
      restante -= tomar;
    }
  };

  const reqFallback = transaction.request();
  reqFallback.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  reqFallback.input('idProducto', sql.UniqueIdentifier, idProducto);
  const whereSuc = conSucursal ? ' AND idSucursal = @idSucursal' : '';
  if (conSucursal) reqFallback.input('idSucursal', sql.UniqueIdentifier, idSucursal);
  const rsFallback = await reqFallback.query(`
    SELECT idLote, costoUnitario, CONVERT(DECIMAL(18,2), cantidadDisponible) AS cantidadDisponible
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
      SELECT idLote, costoUnitario, CONVERT(DECIMAL(18,2), cantidadDisponible) AS cantidadDisponible
      FROM Lotes
      WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto AND cantidadDisponible > 0
        AND idSucursal <> @idSucursalExcluida
      ORDER BY idLote ASC
    `);
    await ejecutarDescuentoSoloLotes(rsFallback2.recordset || []);
  }

  if (restante > 0) {
    if (opciones.permitirVentasNegativas) {
      await aplicarSaldoNegativoEnLote(transaction, {
        idEmpresa,
        idSucursal,
        idProducto,
        cantidad: restante,
        consumos
      });
      return { consumosPorLote: consumos };
    }
    throw new Error('Stock insuficiente para el producto en la empresa');
  }
  return { consumosPorLote: consumos };
};

/**
 * Restaura/devolve stock a Lotes (inverso de descontar). Añade cantidad al lote más reciente del producto/sucursal.
 * Usado al anular/eliminar una venta para devolver el stock.
 * @param {object} transaction - Transacción SQL
 * @param {object} stockData - { idEmpresa, idSucursal, idProducto, cantidad }
 */
exports.restaurarStockEnLotes = async (transaction, stockData) => {
  const { idEmpresa, idSucursal, idProducto, cantidad } = stockData;
  const cant = parseFloat(cantidad) || 0;
  if (cant <= 0) return;
  if (!idEmpresa || !idProducto) return;

  const req = transaction.request();
  req.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  req.input('idProducto', sql.UniqueIdentifier, idProducto);
  req.input('cantidad', sql.Decimal(18, 2), cant);
  const whereSuc = idSucursal != null && idSucursal !== '' ? ' AND idSucursal = @idSucursal' : '';
  if (idSucursal != null && idSucursal !== '') req.input('idSucursal', sql.UniqueIdentifier, idSucursal);

  const rs = await req.query(`
    SELECT TOP 1 idLote FROM Lotes
    WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto${whereSuc}
    ORDER BY fechaIngreso DESC, idLote DESC
  `);
  const row = rs.recordset && rs.recordset[0];
  if (!row) return;

  await transaction.request()
    .input('idLote', sql.UniqueIdentifier, row.idLote)
    .input('cantidad', sql.Decimal(18, 2), cant)
    .query(`
      UPDATE Lotes SET cantidadDisponible = cantidadDisponible + @cantidad
      WHERE idLote = @idLote
    `);
};