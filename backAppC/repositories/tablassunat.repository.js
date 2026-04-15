const sql = require('mssql');

async function estadoPago(pool) {
  const result = await pool.request().query('SELECT * FROM EstadoPago');
  return result.recordset;
}

async function estadosPedidos(pool) {
  const result = await pool
    .request()
    .query(
      'SELECT idEstadoPedido, descripcion, color FROM EstadosPedidos ORDER BY idEstadoPedido'
    );
  return result.recordset;
}

async function mediosPago(pool) {
  const result = await pool.request().query('SELECT * FROM MediosPago');
  return result.recordset;
}

async function moneda(pool) {
  const result = await pool.request().query('SELECT * FROM Moneda');
  return result.recordset;
}

async function leyenda(pool) {
  const result = await pool.request().query('SELECT * FROM Leyenda');
  return result.recordset;
}

async function tipoDoc(pool) {
  const result = await pool.request().query('SELECT * FROM tipoDoc');
  return result.recordset;
}

async function tiposFactura(pool) {
  const result = await pool.request().query('SELECT * FROM TiposFactura');
  return result.recordset;
}

async function tiposOperacion(pool) {
  const result = await pool.request().query('SELECT * FROM TiposOperacion');
  return result.recordset;
}

async function modalidadTraslado(pool) {
  const result = await pool.request().query('SELECT * FROM ModalidadTraslado');
  return result.recordset;
}

async function motivosTraslado(pool) {
  const result = await pool.request().query('SELECT * FROM MotivosTraslado');
  return result.recordset;
}

async function regimenPercepcion(pool) {
  const result = await pool.request().query('SELECT * FROM RegimenPercepcion');
  return result.recordset;
}

async function regimenRetencion(pool) {
  const result = await pool.request().query('SELECT * FROM RegimenRetencion');
  return result.recordset;
}

async function tributos(pool) {
  const result = await pool.request().query('SELECT * FROM Tributos');
  return result.recordset;
}

async function estadoSunat(pool) {
  const result = await pool.request().query('SELECT * FROM EstadoSunat');
  return result.recordset;
}

module.exports = {
  estadoPago,
  estadosPedidos,
  mediosPago,
  moneda,
  leyenda,
  tipoDoc,
  tiposFactura,
  tiposOperacion,
  modalidadTraslado,
  motivosTraslado,
  regimenPercepcion,
  regimenRetencion,
  tributos,
  estadoSunat
};
