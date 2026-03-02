const sql = require('mssql');
const dbConfig = require('../dbconfig');
const reservasService = require('../services/reservas.service');

async function listar(req, res) {
    if (!req.user || !req.user.empresa) return res.status(401).json({ message: 'No autorizado' });
    try {
        const pool = await sql.connect(dbConfig);
        const filtros = {};
        if (req.query.estado) filtros.estado = req.query.estado;
        if (req.query.idProductoHabitacion) filtros.idProductoHabitacion = req.query.idProductoHabitacion;
        const items = await reservasService.listar(pool, req.user.empresa, filtros);
        res.status(200).json({ data: items });
    } catch (error) {
        console.error('reservas.listar:', error);
        res.status(500).json({ message: error.message || 'Error al listar' });
    }
}

async function obtenerPorId(req, res) {
    if (!req.user || !req.user.empresa) return res.status(401).json({ message: 'No autorizado' });
    try {
        const pool = await sql.connect(dbConfig);
        const item = await reservasService.obtenerPorId(pool, req.params.id, req.user.empresa);
        if (!item) return res.status(404).json({ message: 'Reserva no encontrada' });
        res.status(200).json({ data: item });
    } catch (error) {
        console.error('reservas.obtenerPorId:', error);
        res.status(500).json({ message: error.message || 'Error' });
    }
}

async function siguienteCodigo(req, res) {
    if (!req.user || !req.user.empresa) return res.status(401).json({ message: 'No autorizado' });
    try {
        const pool = await sql.connect(dbConfig);
        const codigo = await reservasService.obtenerSiguienteCodigo(pool, req.user.empresa);
        res.status(200).json({ data: { codigo } });
    } catch (error) {
        console.error('reservas.siguienteCodigo:', error);
        res.status(500).json({ message: error.message || 'Error' });
    }
}

async function crear(req, res) {
    if (!req.user || !req.user.empresa) return res.status(401).json({ message: 'No autorizado' });
    try {
        const pool = await sql.connect(dbConfig);
        const body = { ...req.body };
        delete body.idEmpresa;
        const idUsuario = req.user.idUsuario || req.user.id;
        const creado = await reservasService.crear(pool, req.user.empresa, body, idUsuario);
        res.status(201).json({ data: creado });
    } catch (error) {
        console.error('reservas.crear:', error);
        res.status(400).json({ message: error.message || 'Error al crear' });
    }
}

async function actualizar(req, res) {
    if (!req.user || !req.user.empresa) return res.status(401).json({ message: 'No autorizado' });
    try {
        const pool = await sql.connect(dbConfig);
        const body = { ...req.body };
        delete body.idEmpresa;
        await reservasService.actualizar(pool, req.params.id, req.user.empresa, body);
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('reservas.actualizar:', error);
        res.status(400).json({ message: error.message || 'Error al actualizar' });
    }
}

async function eliminar(req, res) {
    if (!req.user || !req.user.empresa) return res.status(401).json({ message: 'No autorizado' });
    try {
        const pool = await sql.connect(dbConfig);
        await reservasService.eliminar(pool, req.params.id, req.user.empresa);
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('reservas.eliminar:', error);
        res.status(400).json({ message: error.message || 'Error al eliminar' });
    }
}

module.exports = {
    listar,
    obtenerPorId,
    siguienteCodigo,
    crear,
    actualizar,
    eliminar
};
