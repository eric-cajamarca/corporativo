const { withPool } = require('../utils/dbPool.util');
const busquedaGlobalService = require('../services/busquedaGlobal.service');

const buscar = async (req, res) => {
  try {
    const q = req.query.q;
    const limit = req.query.limit;
    const data = await withPool((pool) =>
      busquedaGlobalService.buscarGlobal(pool, req.user, q, limit)
    );
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_EMPRESA') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    console.error('busquedaGlobal:', error);
    res.status(500).send({ message: 'Error en búsqueda global', data: undefined });
  }
};

module.exports = { buscar };
