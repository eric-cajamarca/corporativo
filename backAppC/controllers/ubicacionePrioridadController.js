const ubicacionesPrioridadService = require('../services/ubicacionesPrioridad.service');

const getAll = async function (req, res){
    if (!req.user) {
        return res.status(401).send({ success: false, error: 'Unauthorized' });
    }
    const idEmpresa = req.user.empresa || req.user.idEmpresa;
    if (!idEmpresa) {
        return res.status(403).send({ success: false, error: 'No autorizado: falta empresa en token' });
    }
    try {
        const ubicaciones = await ubicacionesPrioridadService.getAll(idEmpresa);
        const data = Array.isArray(ubicaciones) ? ubicaciones.map(normalizarUbicacion) : ubicaciones;
        res.status(200).send({ success: true, data });
    } catch (error) {
        res.status(500).send({ success: false, error: error.message });
    }
}

function normalizarUbicacion(u) {
    if (!u) return u;
    return {
        idUbicacion: u.idUbicacion ?? u.IdUbicacion,
        idSucursal: u.idSucursal ?? u.IdSucursal,
        codigoUbicacion: u.codigoUbicacion ?? u.CodigoUbicacion ?? '',
        prioridad: u.prioridad ?? u.Prioridad ?? 999,
        idUbicacionPadre: u.idUbicacionPadre ?? u.IdUbicacionPadre ?? null
    };
}

const getBySucursal = async function (req, res) {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const idEmpresa = req.user.empresa || req.user.idEmpresa;
    if (!idEmpresa) {
        return res.status(403).json({ success: false, error: 'No autorizado: falta empresa en token' });
    }
    try {
        const { idSucursal } = req.params;
        const ubicaciones = await ubicacionesPrioridadService.getBySucursal(idSucursal, idEmpresa);
        const data = Array.isArray(ubicaciones) ? ubicaciones.map(normalizarUbicacion) : [];
        res.status(200).send({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

const create = async function (req, res) {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const idEmpresa = req.user.empresa || req.user.idEmpresa;
    if (!idEmpresa) {
        return res.status(403).json({ success: false, error: 'No autorizado: falta empresa en token' });
    }
    try {
        const nuevaUbicacion = await ubicacionesPrioridadService.create(req.body, idEmpresa);
        res.status(201).send({ success: true, data: nuevaUbicacion });
    } catch (error) {
        const status = error.message && (error.message.includes('pertenece') || error.message.includes('empresa')) ? 403 : 500;
        res.status(status).json({ success: false, error: error.message });
    }
}

const update = async function (req, res) {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const idEmpresa = req.user.empresa || req.user.idEmpresa;
    if (!idEmpresa) {
        return res.status(403).json({ success: false, error: 'No autorizado: falta empresa en token' });
    }
    try {
        const { idUbicacion } = req.params;
        const ubicacionActualizada = await ubicacionesPrioridadService.update(idUbicacion, req.body, idEmpresa);
        res.status(200).send({ success: true, data: ubicacionActualizada });
    } catch (error) {
        const status = error.message && error.message.includes('no pertenece') ? 403 : 500;
        res.status(status).json({ success: false, error: error.message });
    }
}

const deleted = async function (req, res) {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const idEmpresa = req.user.empresa || req.user.idEmpresa;
    if (!idEmpresa) {
        return res.status(403).json({ success: false, error: 'No autorizado: falta empresa en token' });
    }
    try {
        const { idUbicacion } = req.params;
        await ubicacionesPrioridadService.deleted(idUbicacion, idEmpresa);
        res.status(200).send({ success: true, message: 'Ubicación eliminada' });
    } catch (error) {
        const status = error.message && error.message.includes('no pertenece') ? 403 : 500;
        res.status(status).json({ success: false, error: error.message });
    }
}

module.exports = {
    getAll,
    getBySucursal,
    create,
    update,
    deleted
};