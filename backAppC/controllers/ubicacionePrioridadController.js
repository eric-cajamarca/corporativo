const sql = require('mssql');
const dbConfig = require('../dbconfig');
const ubicacionesPrioridadService = require('../services/ubicacionesPrioridad.service');

const getAll = async function (req, res){
    if (!req.user) {
        return res.status(401).send({ success: false, error: 'Unauthorized' });
    }else{
        try {
            const ubicaciones = await ubicacionesPrioridadService.getAll();
            const data = Array.isArray(ubicaciones) ? ubicaciones.map(normalizarUbicacion) : ubicaciones;
            res.status(200).send({ success: true, data });
        } catch (error) {
            res.status(500).send({ success: false, error: error.message });
        }
    }
}

function normalizarUbicacion(u) {
    if (!u) return u;
    return {
        idUbicacion: u.idUbicacion ?? u.IdUbicacion,
        idSucursal: u.idSucursal ?? u.IdSucursal,
        codigoUbicacion: u.codigoUbicacion ?? u.CodigoUbicacion ?? '',
        prioridad: u.prioridad ?? u.Prioridad ?? 999
    };
}

const getBySucursal = async function (req, res) {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }else{
        try {
            const { idSucursal } = req.params;
            const ubicaciones = await ubicacionesPrioridadService.getBySucursal(idSucursal);
            const data = Array.isArray(ubicaciones) ? ubicaciones.map(normalizarUbicacion) : [];
            res.status(200).send({ success: true, data });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

const create = async function (req, res) {

    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }else{
        try {
            const nuevaUbicacion = await ubicacionesPrioridadService.create(req.body);
            res.status(201).send({ success: true, data: nuevaUbicacion });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

const update = async function (req, res) {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }else{
        try {
            const { idUbicacion } = req.params;
            const ubicacionActualizada = await ubicacionesPrioridadService.update(idUbicacion, req.body);
            res.status(200).send({ success: true, data: ubicacionActualizada });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

const deleted = async function (req, res) {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }else{
        try {
            const { idUbicacion } = req.params;
            await ubicacionesPrioridadService.deleted(idUbicacion);
            res.status(200).send({ success: true, message: 'Ubicación eliminada' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = {
    getAll,
    getBySucursal,
    create,
    update,
    deleted
};