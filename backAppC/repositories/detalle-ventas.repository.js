// repositories/detalle-venta.repository.js
const sql = require('mssql');

exports.insertar = async (transaction, detalleData) => {
  const {
    idVenta,
    idProducto,
    cantidad,
    pVenta,
    descuento,
    subtotal,
    igv,
    isc,
    total,
    hVenta,
    cantEntregada,
    idEstadoPedido,
    costoUnitario,
    costoTotal
  } = detalleData;

  const cantidadNum = cantidad != null ? Number(cantidad) : 0;
  const costoUnitVal = costoUnitario != null ? Number(costoUnitario) : 0;
  const costoTotalVal =
    costoTotal != null ? Number(costoTotal) : (costoUnitVal * cantidadNum);

  const result = await transaction
    .request()
    .input('idVenta', sql.Int, idVenta)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('cantidad', sql.Decimal(18, 3), cantidadNum)
    .input('pVenta', sql.Decimal(18, 5), pVenta)
    .input('descuento', sql.Decimal(18, 2), descuento)
    .input('subtotal', sql.Decimal(18, 2), subtotal)
    .input('igv', sql.Bit, igv)
    .input('isc', sql.Bit, isc)
    .input('total', sql.Decimal(18, 2), total)
    .input('hVenta', sql.VarChar(23), hVenta)
    .input('cantEntregada', sql.Decimal(18, 3), cantEntregada)
    .input('idEstadoPedido', sql.Int, idEstadoPedido)
    .input('costoUnitario', sql.Decimal(18, 6), costoUnitVal)
    .input('costoTotal', sql.Decimal(18, 6), costoTotalVal)
    .query(`INSERT INTO DetalleVenta 
      (idVenta, idProducto, cantidad, pVenta, descuento, subtotal, igv, isc, total, hVenta, cantEntregada, idEstadoPedido, costoUnitario, costoTotal)
      VALUES 
      (@idVenta, @idProducto, @cantidad, @pVenta, @descuento, @subtotal, @igv, @isc, @total, @hVenta, @cantEntregada, @idEstadoPedido, @costoUnitario, @costoTotal)`);

  return result;
};