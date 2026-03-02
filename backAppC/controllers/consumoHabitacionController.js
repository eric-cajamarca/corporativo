const sql = require('mssql');
const dbConfig = require('../dbconfig');
const consumoHabitacionService = require('../services/consumoHabitacion.service');

async function listar(req, res) {
    if (!req.user || !req.user.empresa) return res.status(401).json({ message: 'No autorizado' });
    try {
        const pool = await sql.connect(dbConfig);
        const idProductoHabitacion = req.query.idProductoHabitacion;
        const items = idProductoHabitacion
            ? await consumoHabitacionService.listarPorHabitacion(pool, req.user.empresa, idProductoHabitacion)
            : await consumoHabitacionService.listarPorEmpresa(pool, req.user.empresa);
        res.status(200).json({ data: items });
    } catch (error) {
        console.error('consumoHabitacion.listar:', error);
        res.status(500).json({ message: error.message || 'Error al listar' });
    }
}

async function agregar(req, res) {
    if (!req.user || !req.user.empresa) return res.status(401).json({ message: 'No autorizado' });
    try {
        const pool = await sql.connect(dbConfig);
        const body = { ...req.body };
        delete body.idEmpresa;
        const idUsuario = req.user.idUsuario || req.user.id;
        const creado = await consumoHabitacionService.agregar(pool, req.user.empresa, body, idUsuario);
        res.status(201).json({ data: creado });
    } catch (error) {
        console.error('consumoHabitacion.agregar:', error);
        res.status(400).json({ message: error.message || 'Error al agregar' });
    }
}

async function actualizar(req, res) {
    if (!req.user || !req.user.empresa) return res.status(401).json({ message: 'No autorizado' });
    try {
        const pool = await sql.connect(dbConfig);
        const body = { ...req.body };
        delete body.idEmpresa;
        await consumoHabitacionService.actualizar(pool, req.params.id, req.user.empresa, body);
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('consumoHabitacion.actualizar:', error);
        res.status(400).json({ message: error.message || 'Error al actualizar' });
    }
}

async function eliminar(req, res) {
    if (!req.user || !req.user.empresa) return res.status(401).json({ message: 'No autorizado' });
    try {
        const pool = await sql.connect(dbConfig);
        await consumoHabitacionService.eliminar(pool, req.params.id, req.user.empresa);
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('consumoHabitacion.eliminar:', error);
        res.status(400).json({ message: error.message || 'Error al eliminar' });
    }
}

async function limpiarHabitacion(req, res) {
    if (!req.user || !req.user.empresa) return res.status(401).json({ message: 'No autorizado' });
    try {
        const pool = await sql.connect(dbConfig);
        const idProductoHabitacion = req.params.idProductoHabitacion;
        await consumoHabitacionService.limpiarPorHabitacion(pool, req.user.empresa, idProductoHabitacion);
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('consumoHabitacion.limpiarHabitacion:', error);
        res.status(400).json({ message: error.message || 'Error al limpiar' });
    }
}

module.exports = { listar, agregar, actualizar, eliminar, limpiarHabitacion };
