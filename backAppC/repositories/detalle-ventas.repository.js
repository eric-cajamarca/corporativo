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
    idEstadoPedido
  } = detalleData;

  const result = await transaction
    .request()
    .input('idVenta', sql.Int, idVenta)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('cantidad', sql.Decimal(18, 3), cantidad)
    .input('pVenta', sql.Decimal(18, 5), pVenta)
    .input('descuento', sql.Decimal(18, 2), descuento)
    .input('subtotal', sql.Decimal(18, 2), subtotal)
    .input('igv', sql.Bit, igv)
    .input('isc', sql.Bit, isc)
    .input('total', sql.Decimal(18, 2), total)
    .input('hVenta', sql.VarChar(23), hVenta)
    .input('cantEntregada', sql.Decimal(18, 3), cantEntregada)
    .input('idEstadoPedido', sql.Int, idEstadoPedido)
    .query(`INSERT INTO DetalleVenta 
      (idVenta, idProducto, cantidad, pVenta, descuento, subtotal, igv, isc, total, hVenta, cantEntregada, idEstadoPedido)
      VALUES 
      (@idVenta, @idProducto, @cantidad, @pVenta, @descuento, @subtotal, @igv, @isc, @total, @hVenta, @cantEntregada, @idEstadoPedido)`);

  return result;
};