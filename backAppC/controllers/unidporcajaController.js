const unidPorCajaService = require('../services/unidPorCaja.service');
const { withPool } = require('../utils/dbPool.util');

const obtenerUnidPorCaja = async function (req, res) {
  if (!req.user) {
    return res.status(401).send({ message: 'No Access', data: undefined });
  }
  try {
    const data = await withPool((pool) => unidPorCajaService.obtenerPorEmpresa(pool, req.user.empresa));
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
    const data = await withPool((pool) =>
      unidPorCajaService.editar(pool, req.user.empresa, req.params.id, req.body)
    );
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
