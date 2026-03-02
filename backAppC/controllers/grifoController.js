const grifoService = require('../services/grifo.service');

async function listarTanques(req, res) {
    if (!req.user) return res.status(401).json({ message: 'No autorizado' });
    const idEmpresa = req.user.empresa;
    if (!idEmpresa) return res.status(400).json({ message: 'Empresa no identificada' });
    try {
        const items = await grifoService.listarTanques(idEmpresa);
        res.status(200).json({ data: items });
    } catch (error) {
        console.error('grifo.listarTanques:', error);
        res.status(500).json({ message: error.message || 'Error al listar tanques' });
    }
}

async function actualizarTanque(req, res) {
    if (!req.user) return res.status(401).json({ message: 'No autorizado' });
    const idEmpresa = req.user.empresa;
    const { id } = req.params;
    if (!idEmpresa || !id) return res.status(400).json({ message: 'Datos insuficientes' });
    try {
        await grifoService.actualizarTanque(id, idEmpresa, req.body);
        res.status(200).json({ data: { ok: true } });
    } catch (error) {
        console.error('grifo.actualizarTanque:', error);
        res.status(400).json({ message: error.message || 'Error al actualizar tanque' });
    }
}

async function crearTanque(req, res) {
    if (!req.user) return res.status(401).json({ message: 'No autorizado' });
    const idEmpresa = req.user.empresa;
    if (!idEmpresa) return res.status(400).json({ message: 'Empresa no identificada' });
    try {
        await grifoService.crearTanque(idEmpresa, req.body);
        res.status(201).json({ data: { ok: true } });
    } catch (error) {
        console.error('grifo.crearTanque:', error);
        res.status(400).json({ message: error.message || 'Error al crear tanque' });
    }
}

async function resumen(req, res) {
    if (!req.user) return res.status(401).json({ message: 'No autorizado' });
    const idEmpresa = req.user.empresa;
    if (!idEmpresa) return res.status(400).json({ message: 'Empresa no identificada' });
    const { fechaDesde, fechaHasta } = req.query || {};
    try {
        const data = await grifoService.resumenGrifo(idEmpresa, fechaDesde, fechaHasta);
        res.status(200).json({ data });
    } catch (error) {
        console.error('grifo.resumen:', error);
        res.status(500).json({ message: error.message || 'Error al obtener resumen' });
    }
}

async function productosCombustibles(req, res) {
    if (!req.user) return res.status(401).json({ message: 'No autorizado' });
    const idEmpresa = req.user.empresa;
    if (!idEmpresa) return res.status(400).json({ message: 'Empresa no identificada' });
    try {
        const items = await grifoService.listarProductosCombustibles(idEmpresa);
        res.status(200).json({ data: items });
    } catch (error) {
        console.error('grifo.productosCombustibles:', error);
        res.status(500).json({ message: error.message || 'Error al listar productos combustibles' });
    }
}

module.exports = {
    listarTanques,
    actualizarTanque,
    crearTanque,
    resumen,
    productosCombustibles
};
