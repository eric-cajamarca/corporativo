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