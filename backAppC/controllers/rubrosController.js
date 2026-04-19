const rubrosService = require('../services/rubros.service');
const { withPool } = require('../utils/dbPool.util');

async function listar(req, res) {
  if (!req.user) return res.status(401).json({ message: 'No autorizado' });
  try {
    const items = await withPool((pool) => rubrosService.listar(pool, req.query));
    res.status(200).json({ data: items });
  } catch (error) {
    console.error('rubros.listar:', error);
    res.status(500).json({ message: error.message || 'Error al listar' });
  }
}

async function obtenerPorId(req, res) {
  if (!req.user) return res.status(401).json({ message: 'No autorizado' });
  try {
    const item = await withPool((pool) => rubrosService.obtenerPorId(pool, req.params.id));
    if (!item) return res.status(404).json({ message: 'No encontrado' });
    res.status(200).json({ data: item });
  } catch (error) {
    console.error('rubros.obtenerPorId:', error);
    res.status(500).json({ message: error.message || 'Error' });
  }
}

async function crear(req, res) {
  if (!req.user) return res.status(401).json({ message: 'No autorizado' });
  try {
    const creado = await withPool((pool) => rubrosService.crear(pool, req.body));
    res.status(201).json({ data: creado });
  } catch (error) {
    console.error('rubros.crear:', error);
    res.status(400).json({ message: error.message || 'Error al crear' });
  }
}

async function actualizar(req, res) {
  if (!req.user) return res.status(401).json({ message: 'No autorizado' });
  try {
    await withPool((pool) => rubrosService.actualizar(pool, req.params.id, req.body));
    res.status(200).json({ data: { ok: true } });
  } catch (error) {
    console.error('rubros.actualizar:', error);
    res.status(400).json({ message: error.message || 'Error al actualizar' });
  }
}

async function eliminar(req, res) {
  if (!req.user) return res.status(401).json({ message: 'No autorizado' });
  try {
    await withPool((pool) => rubrosService.eliminar(pool, req.params.id));
    res.status(200).json({ data: { ok: true } });
  } catch (error) {
    console.error('rubros.eliminar:', error);
    res.status(400).json({ message: error.message || 'Error al eliminar' });
  }
}

async function listarConfiguracion(req, res) {
  if (!req.user) return res.status(401).json({ message: 'No autorizado' });
  try {
    const items = await withPool((pool) => rubrosService.listarConfiguracion(pool, req.params.id));
    res.status(200).json({ data: items });
  } catch (error) {
    console.error('rubros.listarConfiguracion:', error);
    res.status(500).json({ message: error.message || 'Error' });
  }
}

async function guardarConfiguracion(req, res) {
  if (!req.user) return res.status(401).json({ message: 'No autorizado' });
  try {
    await withPool((pool) => rubrosService.guardarConfiguracion(pool, req.params.id, req.body?.items || []));
    res.status(200).json({ data: { ok: true } });
  } catch (error) {
    console.error('rubros.guardarConfiguracion:', error);
    res.status(400).json({ message: error.message || 'Error al guardar' });
  }
}

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
  listarConfiguracion,
  guardarConfiguracion
};
