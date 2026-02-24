const sql = require('mssql');
const dbConfig = require('../dbconfig');
const catalogoTipoMovimientoService = require('../services/catalogoTipoMovimiento.service');

async function listar(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const data = await catalogoTipoMovimientoService.listar(pool, req.query);
        res.status(200).json({ data: data || [] });
    } catch (error) {
        console.error('catalogoTipoMovimiento.listar:', error);
        res.status(500).json({ message: error.message || 'Error al listar', data: undefined });
    }
}

async function obtenerPorId(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const item = await catalogoTipoMovimientoService.obtenerPorId(pool, req.params.id);
        if (!item) return res.status(404).json({ message: 'No encontrado', data: undefined });
        res.status(200).json({ data: item });
    } catch (error) {
        console.error('catalogoTipoMovimiento.obtenerPorId:', error);
        res.status(500).json({ message: error.message || 'Error', data: undefined });
    }
}

async function crear(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const creado = await catalogoTipoMovimientoService.crear(pool, req.body);
        res.status(201).json({ data: creado });
    } catch (error) {
        console.error('catalogoTipoMovimiento.crear:', error);
        res.status(400).json({ message: error.message || 'Error al crear', data: undefined });
    }
}

async function actualizar(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        await catalogoTipoMovimientoService.actualizar(pool, req.params.id, req.body);
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('catalogoTipoMovimiento.actualizar:', error);
        res.status(400).json({ message: error.message || 'Error al actualizar', data: undefined });
    }
}

async function eliminar(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        await catalogoTipoMovimientoService.eliminar(pool, req.params.id);
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('catalogoTipoMovimiento.eliminar:', error);
        res.status(400).json({ message: error.message || 'Error al eliminar', data: undefined });
    }
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
