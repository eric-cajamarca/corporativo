const cventasService = require('../services/cventas.service');
const { withPool } = require('../utils/dbPool.util');

const getCompVentaById_Empresa = async (req, res) => {
  if (!req.user) {
    return res.status(500).send({ message: 'No Access' });
  }
  try {
    const data = await withPool((pool) =>
      cventasService.obtenerPorSerieYDestino(pool, req.params.id, req.params.aliasempresa)
    );
    res.json(data);
  } catch (error) {
    if (error.message === 'PARAMS_INVALIDOS') {
      return res.status(400).send('Parámetros inválidos');
    }
    console.error('Error al obtener la venta:', error);
    res.status(500).send('Error al obtener la venta por id');
  }
};

const updateCompVenta = async (req, res) => {
  if (!req.user) {
    return res.status(500).send({ message: 'No Access' });
  }
  try {
    await withPool((pool) => cventasService.actualizarEstados(pool, req.body));
    res.status(200).json({ message: 'Registro actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar el detalle de venta:', error);
    res.status(500).send('Error al actualizar el detalle de venta');
  }
};

const deleteCompVenta = async (req, res) => {
  if (!req.user) {
    return res.status(500).send({ message: 'No Access' });
  }
  try {
    await withPool((pool) => cventasService.eliminar(pool, req.params.id));
    res.status(200).json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    if (error.message === 'ID_INVALIDO') {
      return res.status(400).send('Id inválido');
    }
    console.error('Error al eliminar la venta:', error);
    res.status(500).send('Error al eliminar la venta');
  }
};

module.exports = {
  getCompVentaById_Empresa,
  updateCompVenta,
  deleteCompVenta
};
