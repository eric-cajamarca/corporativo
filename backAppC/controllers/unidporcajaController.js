const sql = require('mssql');
const dbConfig = require('../dbconfig');
const unidPorCajaService = require('../services/unidPorCaja.service');

const obtenerUnidPorCaja = async function (req, res) {
  if (!req.user) {
    return res.status(401).send({ message: 'No Access', data: undefined });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const data = await unidPorCajaService.obtenerPorEmpresa(pool, req.user.empresa);
    res.status(200).send({ data });
  } catch (error) {
    console.error('Error al obtener las unidades por caja:', error);
    res.status(500).send({ data: undefined });
  }
};

const editarUnidPorCaja = async function (req, res) {
  if (!req.user) {
    return res.status(401).send({ message: 'No Access', data: undefined });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const data = await unidPorCajaService.editar(pool, req.user.empresa, req.params.id, req.body);
    res.status(200).send({ data });
  } catch (error) {
    console.error('Error al editar la unidad por caja:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

module.exports = {
  obtenerUnidPorCaja,
  editarUnidPorCaja
};
