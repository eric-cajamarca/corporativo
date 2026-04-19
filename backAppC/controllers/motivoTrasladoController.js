const { withPool } = require('../utils/dbPool.util');
const motivoTrasladoService = require('../services/motivoTraslado.service');

async function codigosSunat(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const items = await withPool(async (pool) => motivoTrasladoService.listarCodigosSunat(pool));
        res.status(200).json({ data: items });
    } catch (error) {
        console.error('motivoTraslado.codigosSunat:', error);
        res.status(500).json({ message: error.message || 'Error al listar códigos SUNAT', data: undefined });
    }
}

async function listar(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const resultado = await withPool(async (pool) =>
            motivoTrasladoService.listar(pool, req.user.empresa, req.query)
        );
        res.status(200).json({ data: resultado.items, total: resultado.total });
    } catch (error) {
        console.error('motivoTraslado.listar:', error);
        res.status(500).json({ message: error.message || 'Error al listar', data: undefined });
    }
}

async function obtenerPorId(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const item = await withPool(async (pool) =>
            motivoTrasladoService.obtenerPorId(pool, req.params.id, req.user.empresa)
        );
        if (!item) return res.status(404).json({ message: 'No encontrado', data: undefined });
        res.status(200).json({ data: item });
    } catch (error) {
        console.error('motivoTraslado.obtenerPorId:', error);
        res.status(500).json({ message: error.message || 'Error', data: undefined });
    }
}

async function crear(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const creado = await withPool(async (pool) =>
            motivoTrasladoService.crear(pool, req.user.empresa, req.body)
        );
        res.status(201).json({ data: creado });
    } catch (error) {
        console.error('motivoTraslado.crear:', error);
        res.status(400).json({ message: error.message || 'Error al crear', data: undefined });
    }
}

async function actualizar(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        await withPool(async (pool) =>
            motivoTrasladoService.actualizar(pool, req.params.id, req.user.empresa, req.body)
        );
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('motivoTraslado.actualizar:', error);
        res.status(400).json({ message: error.message || 'Error al actualizar', data: undefined });
    }
}

async function eliminar(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        await withPool(async (pool) =>
            motivoTrasladoService.eliminar(pool, req.params.id, req.user.empresa)
        );
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('motivoTraslado.eliminar:', error);
        res.status(400).json({ message: error.message || 'Error al eliminar', data: undefined });
    }
}

module.exports = { codigosSunat, listar, obtenerPorId, crear, actualizar, eliminar };
