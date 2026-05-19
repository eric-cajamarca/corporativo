const lotesUbicacionService = require('../services/lotesUbicacion.service');

const getByLote = async function (req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const { idLote } = req.params;
    const ubicaciones = await lotesUbicacionService.getByLote(idLote);
    res.status(200).send({ success: true, data: ubicaciones });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
};

const getByUbicacion = async function (req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const { idUbicacion } = req.params;
    const lotes = await lotesUbicacionService.getByUbicacion(idUbicacion);
    res.status(200).send({ success: true, data: lotes });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
};

const buscarProductosTraslado = async function (req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const data = await lotesUbicacionService.buscarProductosTraslado(req.user, req.query);
    res.status(200).send({ success: true, ...data });
  } catch (error) {
    const status = error.message === 'NO_AUTH' ? 401 : 500;
    res.status(status).send({ success: false, message: error.message });
  }
};

const listarLotesTrasladables = async function (req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const { idProducto } = req.params;
    const data = await lotesUbicacionService.listarLotesTrasladables(req.user, idProducto, req.query);
    res.status(200).send({ success: true, ...data });
  } catch (error) {
    const status =
      error.message === 'NO_AUTH' ? 401 : error.message === 'Producto no encontrado' ? 404 : 500;
    res.status(status).send({ success: false, message: error.message });
  }
};

const trasladoEntreUbicaciones = async function (req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const resultado = await lotesUbicacionService.trasladoEntreUbicaciones(req.user, req.body);
    res.status(200).send({
      success: true,
      message: 'Traslado ejecutado correctamente',
      data: resultado
    });
  } catch (error) {
    const msg = error.message || 'Error en traslado';
    const status = msg.includes('insuficiente') || msg.includes('diferentes') ? 400 : 500;
    res.status(status).send({ success: false, message: msg });
  }
};

const create = async function (req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const { idLote, idUbicacion, cantidad } = req.body;
    await lotesUbicacionService.create(idLote, idUbicacion, cantidad);
    res.status(201).json({ success: true, message: 'Ubicación asignada al lote' });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
};

const updateCantidad = async function (req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const { idLote, idUbicacion, cantidad } = req.body;
    await lotesUbicacionService.updateCantidad(idLote, idUbicacion, cantidad);
    res.status(200).send({ success: true, message: 'Cantidad actualizada' });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
};

const deleted = async function (req, res) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const { idLote, idUbicacion } = req.params;
    await lotesUbicacionService.deleted(idLote, idUbicacion);
    res.status(200).send({ success: true, message: 'Asignación eliminada' });
  } catch (error) {
    res.status(500).send({ success: false, error: error.message });
  }
};

module.exports = {
  getByLote,
  getByUbicacion,
  buscarProductosTraslado,
  listarLotesTrasladables,
  trasladoEntreUbicaciones,
  create,
  updateCantidad,
  deleted
};
