const { withPool } = require('../utils/dbPool.util');
const avisosService = require('../services/avisos.service');

exports.obtenerCinta = async (req, res) => {
  try {
    const data = await withPool((pool) => avisosService.obtenerCinta(pool, req.user));
    return res.status(200).json(data);
  } catch (e) {
    console.error('avisos cinta:', e);
    return res.status(500).json({ message: 'Error al obtener avisos' });
  }
};
