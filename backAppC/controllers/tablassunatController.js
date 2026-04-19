const tablassunatService = require('../services/tablassunat.service');
const { withPool } = require('../utils/dbPool.util');

const wrap = (fn) => async (req, res) => {
  if (!req.user) {
    return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
  }
  try {
    const data = await withPool((pool) => fn(pool));
    res.status(200).send({ data });
  } catch (error) {
    console.error('tablassunat:', error);
    res.status(500).send({ message: error.message || 'Error', data: undefined });
  }
};

const wrap401 = (fn) => async (req, res) => {
  if (!req.user) {
    return res.status(401).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
  }
  try {
    const data = await withPool((pool) => fn(pool));
    res.status(200).send({ data });
  } catch (error) {
    console.error('tablassunat:', error);
    res.status(500).send({ message: error.message || 'Error', data: undefined });
  }
};

const obtener_estado_pago = wrap((pool) => tablassunatService.obtenerEstadoPago(pool));
const obtener_estados_pedidos = wrap401((pool) => tablassunatService.obtenerEstadosPedidos(pool));
const obtener_medios_pago = wrap((pool) => tablassunatService.obtenerMediosPago(pool));
const obtener_moneda = wrap((pool) => tablassunatService.obtenerMoneda(pool));
const obtener_leyenda = wrap((pool) => tablassunatService.obtenerLeyenda(pool));
const obtener_tipo_doc = wrap((pool) => tablassunatService.obtenerTipoDoc(pool));
const obtener_tipo_factura = wrap((pool) => tablassunatService.obtenerTipoFactura(pool));
const obtener_tipo_operacion = wrap((pool) => tablassunatService.obtenerTipoOperacion(pool));
const obtener_modalidad_traslado = wrap((pool) => tablassunatService.obtenerModalidadTraslado(pool));
const obtener_motivos_traslado = wrap((pool) => tablassunatService.obtenerMotivosTraslado(pool));
const obtener_regimen_percepcion = wrap((pool) => tablassunatService.obtenerRegimenPercepcion(pool));
const obtener_regimen_retencion = wrap((pool) => tablassunatService.obtenerRegimenRetencion(pool));
const obtener_tributos = wrap((pool) => tablassunatService.obtenerTributos(pool));
const obtener_estado_sunat = wrap((pool) => tablassunatService.obtenerEstadoSunat(pool));

module.exports = {
  obtener_estado_pago,
  obtener_estados_pedidos,
  obtener_medios_pago,
  obtener_estado_sunat,
  obtener_moneda,
  obtener_leyenda,
  obtener_tipo_doc,
  obtener_tipo_operacion,
  obtener_modalidad_traslado,
  obtener_motivos_traslado,
  obtener_tipo_factura,
  obtener_regimen_percepcion,
  obtener_regimen_retencion,
  obtener_tributos
};
