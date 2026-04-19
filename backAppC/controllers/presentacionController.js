const presentacionService = require('../services/presentacion.service');
const { withPool } = require('../utils/dbPool.util');

const obtener_Presentaciones = async (req, res) => {
  if (!req.user) {
    return res.status(200).send({ message: 'No access', data: undefined });
  }
  try {
    const data = await withPool((pool) => presentacionService.obtenerPresentaciones(pool, req.user));
    res.status(200).send({ data });
  } catch (error) {
    console.error('presentacion.obtener_Presentaciones:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

const obtener_presentacion_id = async (req, res) => {
  if (!req.user) {
    return res.status(200).send({ message: 'No access', data: undefined });
  }
  try {
    const data = await withPool((pool) =>
      presentacionService.obtenerPresentacionPorId(pool, req.user, req.params.id)
    );
    res.status(200).send({ data });
  } catch (error) {
    console.error('presentacion.obtener_presentacion_id:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

const crear_Presentacion = async (req, res) => {
  if (!req.user) {
    return res.status(200).send({ message: 'No access', data: undefined });
  }
  try {
    const data = await withPool((pool) => presentacionService.crearPresentacion(pool, req.user, req.body));
    res.status(200).send({ data });
  } catch (error) {
    console.error('presentacion.crear_Presentacion:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

const editar_presentacion = async (req, res) => {
  if (!req.user) {
    return res.status(200).send({ message: 'No access', data: undefined });
  }
  try {
    const data = await withPool((pool) =>
      presentacionService.editarPresentacion(pool, req.user, req.params.id, req.body)
    );
    res.status(200).send({ data });
  } catch (error) {
    console.error('presentacion.editar_presentacion:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

const eliminar_presentacion = async (req, res) => {
  if (!req.user) {
    return res.status(200).send({ message: 'No access', data: undefined });
  }
  try {
    const data = await withPool((pool) =>
      presentacionService.eliminarPresentacion(pool, req.user, req.params.id)
    );
    res.status(200).send({ data });
  } catch (error) {
    console.error('presentacion.eliminar_presentacion:', error);
    res.status(500).send({ message: error.message, data: undefined });
  }
};

module.exports = {
  obtener_Presentaciones,
  obtener_presentacion_id,
  crear_Presentacion,
  editar_presentacion,
  eliminar_presentacion
};
