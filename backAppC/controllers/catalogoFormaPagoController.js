const catalogoFormaPagoService = require('../services/catalogoFormaPago.service');
const { withPool } = require('../utils/dbPool.util');

async function listar(req, res) {
  if (!req.user) {
    return res.status(401).json({ message: 'No autorizado', data: undefined });
  }
  try {
    const resultado = await withPool((pool) => catalogoFormaPagoService.listar(pool, req.query));
    res.status(200).json({ data: resultado.items, total: resultado.total });
  } catch (error) {
    console.error('catalogoFormaPago.listar:', error);
    res.status(500).json({ message: error.message || 'Error al listar', data: undefined });
  }
}

async function obtenerPorId(req, res) {
  if (!req.user) {
    return res.status(401).json({ message: 'No autorizado', data: undefined });
  }
  try {
    const item = await withPool((pool) => catalogoFormaPagoService.obtenerPorId(pool, req.params.id));
    if (!item) return res.status(404).json({ message: 'No encontrado', data: undefined });
    res.status(200).json({ data: item });
  } catch (error) {
    console.error('catalogoFormaPago.obtenerPorId:', error);
    res.status(500).json({ message: error.message || 'Error', data: undefined });
  }
}

async function crear(req, res) {
  if (!req.user) {
    return res.status(401).json({ message: 'No autorizado', data: undefined });
  }
  try {
    const creado = await withPool((pool) => catalogoFormaPagoService.crear(pool, req.body));
    res.status(201).json({ data: creado });
  } catch (error) {
    console.error('catalogoFormaPago.crear:', error);
    res.status(400).json({ message: error.message || 'Error al crear', data: undefined });
  }
}

async function actualizar(req, res) {
  if (!req.user) {
    return res.status(401).json({ message: 'No autorizado', data: undefined });
  }
  try {
    await withPool((pool) => catalogoFormaPagoService.actualizar(pool, req.params.id, req.body));
    res.status(200).json({ data: { ok: true } });
  } catch (error) {
    console.error('catalogoFormaPago.actualizar:', error);
    res.status(400).json({ message: error.message || 'Error al actualizar', data: undefined });
  }
}

async function eliminar(req, res) {
  if (!req.user) {
    return res.status(401).json({ message: 'No autorizado', data: undefined });
  }
  try {
    await withPool((pool) => catalogoFormaPagoService.eliminar(pool, req.params.id));
    res.status(200).json({ data: { ok: true } });
  } catch (error) {
    console.error('catalogoFormaPago.eliminar:', error);
    res.status(400).json({ message: error.message || 'Error al eliminar', data: undefined });
  }
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
