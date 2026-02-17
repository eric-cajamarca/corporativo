const sql = require('mssql');
const dbConfig = require('../dbconfig');
const clasificacionConceptoService = require('../services/clasificacionConcepto.service');

async function listar(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const resultado = await clasificacionConceptoService.listar(pool, req.user.empresa, req.query);
        res.status(200).json({ data: resultado.items, total: resultado.total });
    } catch (error) {
        console.error('clasificacionConcepto.listar:', error);
        res.status(500).json({ message: error.message || 'Error al listar', data: undefined });
    }
}

async function obtenerPorId(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const item = await clasificacionConceptoService.obtenerPorId(pool, req.params.id, req.user.empresa);
        if (!item) return res.status(404).json({ message: 'No encontrado', data: undefined });
        res.status(200).json({ data: item });
    } catch (error) {
        console.error('clasificacionConcepto.obtenerPorId:', error);
        res.status(500).json({ message: error.message || 'Error', data: undefined });
    }
}

async function crear(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const creado = await clasificacionConceptoService.crear(pool, req.user.empresa, req.body);
        res.status(201).json({ data: creado });
    } catch (error) {
        console.error('clasificacionConcepto.crear:', error);
        res.status(400).json({ message: error.message || 'Error al crear', data: undefined });
    }
}

async function actualizar(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        await clasificacionConceptoService.actualizar(pool, req.params.id, req.user.empresa, req.body);
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('clasificacionConcepto.actualizar:', error);
        res.status(400).json({ message: error.message || 'Error al actualizar', data: undefined });
    }
}

async function eliminar(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        await clasificacionConceptoService.eliminar(pool, req.params.id, req.user.empresa);
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('clasificacionConcepto.eliminar:', error);
        res.status(400).json({ message: error.message || 'Error al eliminar', data: undefined });
    }
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
