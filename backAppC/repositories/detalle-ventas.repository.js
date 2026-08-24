// repositories/detalle-venta.repository.js
const sql = require('mssql');

function normalizarDescripcionLinea(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > 500 ? s.slice(0, 500) : s;
}

function primerTextoDescripcionLinea(...valores) {
  for (const v of valores) {
    const n = normalizarDescripcionLinea(v);
    if (n) return n;
  }
  return null;
}

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
    costoTotal,
    descripcionLinea
  } = detalleData;

  const cantidadNum = cantidad != null ? Number(cantidad) : 0;
  const costoUnitVal = costoUnitario != null ? Number(costoUnitario) : 0;
  const costoTotalVal =
    costoTotal != null ? Number(costoTotal) : (costoUnitVal * cantidadNum);
  const descripcionLineaVal = primerTextoDescripcionLinea(
    descripcionLinea,
    detalleData.descripcionVenta,
    detalleData.descripcion
  );

  const result = await transaction
    .request()
    .input('idVenta', sql.Int, idVenta)
    .input('idProducto', sql.UniqueIdentifier, idProducto)
    .input('cantidad', sql.Decimal(18, 3), cantidadNum)
    .input('pVenta', sql.Decimal(18, 5), pVenta)
    .input('descuento', sql.Decimal(18, 2), descuento)
    .input('subtotal', sql.Decimal(18, 2), subtotal)
    .input('igv', sql.Bit, igv === true || igv === 1 || igv === '1' ? 1 : 0)
    .input('isc', sql.Bit, isc === true || isc === 1 || isc === '1' ? 1 : 0)
    .input('total', sql.Decimal(18, 2), total)
    .input('hVenta', sql.VarChar(23), hVenta)
    .input('cantEntregada', sql.Decimal(18, 3), cantEntregada)
    .input('idEstadoPedido', sql.Int, idEstadoPedido)
    .input('costoUnitario', sql.Decimal(18, 6), costoUnitVal)
    .input('costoTotal', sql.Decimal(18, 6), costoTotalVal)
    .input('descripcionLinea', sql.NVarChar(500), descripcionLineaVal)
    .query(`INSERT INTO DetalleVenta 
      (idVenta, idProducto, cantidad, pVenta, descuento, subtotal, igv, isc, total, hVenta, cantEntregada, idEstadoPedido, costoUnitario, costoTotal, descripcionLinea)
      VALUES 
      (@idVenta, @idProducto, @cantidad, @pVenta, @descuento, @subtotal, @igv, @isc, @total, @hVenta, @cantEntregada, @idEstadoPedido, @costoUnitario, @costoTotal, @descripcionLinea)`);

  return result;
};