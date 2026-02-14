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
 * Descuenta cantidad desde Lotes (cantidadDisponible).
 * 1) Intenta primero en la sucursal de la venta (idSucursal).
 * 2) Si no hay stock ahí o no alcanza, descuenta de otra sucursal de la misma empresa donde el producto tenga lotes.
 */
exports.descontarDesdeLotes = async (transaction, stockData) => {
  const { idEmpresa, idSucursal, idProducto, cantidad } = stockData;
  const cant = parseFloat(cantidad) || 0;
  if (cant <= 0) return;
  if (!idEmpresa || !idProducto) return;

  let restante = cant;

  const ejecutarDescuento = async (filas) => {
    for (const row of filas) {
      if (restante <= 0) break;
      const disp = parseFloat(row.cantidadDisponible) || 0;
      if (disp <= 0) continue;
      const tomar = Math.min(restante, disp);
      const nuevaCant = Math.max(0, disp - tomar);
      const upReq = transaction.request();
      upReq.input('idLote', sql.UniqueIdentifier, row.idLote);
      upReq.input('nuevaCantidad', sql.Decimal(18, 2), nuevaCant);
      await upReq.query('UPDATE Lotes SET cantidadDisponible = @nuevaCantidad WHERE idLote = @idLote');
      restante -= tomar;
    }
  };

  const conSucursal = idSucursal != null && idSucursal !== '';
  if (conSucursal) {
    const req = transaction.request();
    req.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    req.input('idSucursal', sql.UniqueIdentifier, idSucursal);
    req.input('idProducto', sql.UniqueIdentifier, idProducto);
    const rs = await req.query(`
      SELECT idLote, CONVERT(DECIMAL(18,2), cantidadDisponible) AS cantidadDisponible
      FROM Lotes
      WHERE idEmpresa = @idEmpresa AND idSucursal = @idSucursal AND idProducto = @idProducto AND cantidadDisponible > 0
      ORDER BY idLote ASC
    `);
    const filas = rs.recordset || [];
    await ejecutarDescuento(filas);
  }

  if (restante > 0) {
    const req2 = transaction.request();
    req2.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    req2.input('idProducto', sql.UniqueIdentifier, idProducto);
    const whereSucursal = conSucursal ? ' AND idSucursal <> @idSucursalExcluida' : '';
    if (conSucursal) req2.input('idSucursalExcluida', sql.UniqueIdentifier, idSucursal);
    const rs2 = await req2.query(`
      SELECT idLote, CONVERT(DECIMAL(18,2), cantidadDisponible) AS cantidadDisponible
      FROM Lotes
      WHERE idEmpresa = @idEmpresa AND idProducto = @idProducto AND cantidadDisponible > 0${whereSucursal}
      ORDER BY idLote ASC
    `);
    const filas2 = rs2.recordset || [];
    await ejecutarDescuento(filas2);
  }

  if (restante > 0) {
    throw new Error('Stock insuficiente para el producto en la empresa');
  }
};