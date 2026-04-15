const tablassunatRepository = require('../repositories/tablassunat.repository');

async function obtenerEstadoPago(pool) {
  return tablassunatRepository.estadoPago(pool);
}

async function obtenerEstadosPedidos(pool) {
  return tablassunatRepository.estadosPedidos(pool);
}

async function obtenerMediosPago(pool) {
  return tablassunatRepository.mediosPago(pool);
}

async function obtenerMoneda(pool) {
  return tablassunatRepository.moneda(pool);
}

async function obtenerLeyenda(pool) {
  return tablassunatRepository.leyenda(pool);
}

async function obtenerTipoDoc(pool) {
  return tablassunatRepository.tipoDoc(pool);
}

async function obtenerTipoFactura(pool) {
  return tablassunatRepository.tiposFactura(pool);
}

async function obtenerTipoOperacion(pool) {
  return tablassunatRepository.tiposOperacion(pool);
}

async function obtenerModalidadTraslado(pool) {
  return tablassunatRepository.modalidadTraslado(pool);
}

async function obtenerMotivosTraslado(pool) {
  return tablassunatRepository.motivosTraslado(pool);
}

async function obtenerRegimenPercepcion(pool) {
  return tablassunatRepository.regimenPercepcion(pool);
}

async function obtenerRegimenRetencion(pool) {
  return tablassunatRepository.regimenRetencion(pool);
}

async function obtenerTributos(pool) {
  return tablassunatRepository.tributos(pool);
}

async function obtenerEstadoSunat(pool) {
  return tablassunatRepository.estadoSunat(pool);
}

module.exports = {
  obtenerEstadoPago,
  obtenerEstadosPedidos,
  obtenerMediosPago,
  obtenerMoneda,
  obtenerLeyenda,
  obtenerTipoDoc,
  obtenerTipoFactura,
  obtenerTipoOperacion,
  obtenerModalidadTraslado,
  obtenerMotivosTraslado,
  obtenerRegimenPercepcion,
  obtenerRegimenRetencion,
  obtenerTributos,
  obtenerEstadoSunat
};
