const marcaService = require('../services/marca.service');
const { withPool } = require('../utils/dbPool.util');

const obtenerMarcas = async (req, res) => {
  if (!req.user) {
    return res.status(401).send({ message: 'No Access', data: undefined });
  }
  try {
    const data = await withPool((pool) => marcaService.obtenerMarcas(pool, req.user));
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    console.error('Error al obtener las marcas:', error);
    res.status(500).send({ data: undefined });
  }
};

const obtenerMarcaPorId = async (req, res) => {
  if (!req.user) {
    return res.status(401).send({ message: 'No Access', data: undefined });
  }
  try {
    const data = await withPool((pool) => marcaService.obtenerMarcaPorId(pool, req.user, req.params.id));
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    console.error('Error al obtener la marca:', error);
    res.status(500).send({ data: undefined });
  }
};

const crearMarca = async (req, res) => {
  if (!req.user) {
    return res.status(401).send({ message: 'No Access', data: undefined });
  }
  try {
    const data = await withPool((pool) => marcaService.crearMarca(pool, req.user, req.body));
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    console.error('Error al crear la marca:', error);
    res.status(500).send({ data: undefined });
  }
};

const editarMarca = async (req, res) => {
  if (!req.user) {
    return res.status(401).send({ message: 'No Access', data: undefined });
  }
  try {
    const data = await withPool((pool) => marcaService.editarMarca(pool, req.user, req.params.id, req.body));
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    console.error('Error al editar la marca:', error);
    res.status(500).send({ data: undefined });
  }
};

const editarEstadoMarca = async (req, res) => {
  if (!req.user) {
    return res.status(401).send({ message: 'No Access', data: undefined });
  }
  try {
    const data = await withPool((pool) =>
      marcaService.editarEstadoMarca(pool, req.user, req.params.id, req.body)
    );
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    console.error('Error al editar el estado de la marca:', error);
    res.status(500).send({ data: undefined });
  }
};

module.exports = {
  obtenerMarcas,
  obtenerMarcaPorId,
  crearMarca,
  editarMarca,
  editarEstadoMarca
};
