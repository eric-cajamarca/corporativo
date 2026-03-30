const sql = require('mssql');
const dbConfig = require('../dbconfig');
const conceptoService = require('../services/concepto.service');
const { resolverIdEmpresaOperacionCaja } = require('../utils/cajaOperacionEmpresa.util');

async function listar(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const rawOp = req.query.idEmpresaOperacion;
        const usarOp = rawOp != null && String(rawOp).trim() !== '';
        let idEmpresaListar = req.user.empresa;
        if (usarOp) {
            idEmpresaListar = await resolverIdEmpresaOperacionCaja(pool, req.user, rawOp);
        }
        const resultado = await conceptoService.listar(pool, idEmpresaListar, req.query);
        res.status(200).json({ data: resultado.items, total: resultado.total });
    } catch (error) {
        if (error.message === 'EMPRESA_OPERACION_NO_PERMITIDA') {
            return res.status(403).json({ message: 'Empresa de operación no permitida', data: undefined });
        }
        console.error('concepto.listar:', error);
        res.status(500).json({ message: error.message || 'Error al listar', data: undefined });
    }
}

async function obtenerPorId(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const rawOp = req.query.idEmpresaOperacion;
        const usarOp = rawOp != null && String(rawOp).trim() !== '';
        let idEmpresa = req.user.empresa;
        if (usarOp) {
            idEmpresa = await resolverIdEmpresaOperacionCaja(pool, req.user, rawOp);
        }
        const item = await conceptoService.obtenerPorId(pool, req.params.id, idEmpresa);
        if (!item) return res.status(404).json({ message: 'No encontrado', data: undefined });
        res.status(200).json({ data: item });
    } catch (error) {
        if (error.message === 'EMPRESA_OPERACION_NO_PERMITIDA') {
            return res.status(403).json({ message: 'Empresa de operación no permitida', data: undefined });
        }
        console.error('concepto.obtenerPorId:', error);
        res.status(500).json({ message: error.message || 'Error', data: undefined });
    }
}

async function crear(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const creado = await conceptoService.crear(pool, req.user.empresa, req.body);
        res.status(201).json({ data: creado });
    } catch (error) {
        console.error('concepto.crear:', error);
        res.status(400).json({ message: error.message || 'Error al crear', data: undefined });
    }
}

async function actualizar(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        await conceptoService.actualizar(pool, req.params.id, req.user.empresa, req.body);
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('concepto.actualizar:', error);
        res.status(400).json({ message: error.message || 'Error al actualizar', data: undefined });
    }
}

async function eliminar(req, res) {
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        await conceptoService.eliminar(pool, req.params.id, req.user.empresa);
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('concepto.eliminar:', error);
        res.status(400).json({ message: error.message || 'Error al eliminar', data: undefined });
    }
}

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar };
