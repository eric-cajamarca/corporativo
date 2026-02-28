const valesDespachoService = require('../services/valesDespacho.service');

async function listar(req, res) {
    if (!req.user) return res.status(401).json({ message: 'No autorizado' });
    const idEmpresa = req.user.empresa;
    if (!idEmpresa) return res.status(400).json({ message: 'Empresa no identificada' });
    try {
        const items = await valesDespachoService.listar(idEmpresa, req.query);
        res.status(200).json({ data: items });
    } catch (error) {
        console.error('valesDespacho.listar:', error);
        res.status(500).json({ message: error.message || 'Error al listar' });
    }
}

async function obtenerPorId(req, res) {
    if (!req.user) return res.status(401).json({ message: 'No autorizado' });
    const idEmpresa = req.user.empresa;
    const { id } = req.params;
    try {
        const vale = await valesDespachoService.obtenerPorId(id, idEmpresa);
        if (!vale) return res.status(404).json({ message: 'Vale no encontrado' });
        const detalle = await valesDespachoService.listarDetalle(id, idEmpresa);
        res.status(200).json({ data: { ...vale, detalle } });
    } catch (error) {
        console.error('valesDespacho.obtenerPorId:', error);
        res.status(500).json({ message: error.message || 'Error' });
    }
}

async function crear(req, res) {
    if (!req.user) return res.status(401).json({ message: 'No autorizado' });
    const idEmpresa = req.user.empresa;
    const idUsuario = req.user.id;
    if (!idEmpresa || !idUsuario) return res.status(400).json({ message: 'Usuario o empresa no identificados' });
    try {
        const resultado = await valesDespachoService.crear(idEmpresa, idUsuario, req.body);
        res.status(201).json({ data: resultado });
    } catch (error) {
        console.error('valesDespacho.crear:', error);
        res.status(400).json({ message: error.message || 'Error al crear el vale' });
    }
}

async function anular(req, res) {
    if (!req.user) return res.status(401).json({ message: 'No autorizado' });
    const idEmpresa = req.user.empresa;
    const { id } = req.params;
    try {
        await valesDespachoService.anular(id, idEmpresa);
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('valesDespacho.anular:', error);
        res.status(400).json({ message: error.message || 'Error al anular' });
    }
}

module.exports = { listar, obtenerPorId, crear, anular };
