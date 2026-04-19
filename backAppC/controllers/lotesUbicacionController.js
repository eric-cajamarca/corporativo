const lotesUbicacionService = require('../services/lotesUbicacion.service');

const getByLote = async function (req, res) {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }else{
        try {
            const { idLote } = req.params;
            const ubicaciones = await lotesUbicacionService.getByLote(idLote);
            res.status(200).send({ success: true, data: ubicaciones });
        } catch (error) {
            res.status(500).send({ success: false, error: error.message });
        }
    }
}

const getByUbicacion = async function (req, res) {

    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }else{
        try {
            const { idUbicacion } = req.params;
            const lotes = await lotesUbicacionService.getByUbicacion(idUbicacion);
            res.status(200).send({ success: true, data: lotes });
        } catch (error) {
            res.status(500).send({ success: false, error: error.message });
        }
    }
}

const create = async function (req, res) {

    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }else{
        try {
            const { idLote, idUbicacion, cantidad } = req.body;
            await lotesUbicacionService.create(idLote, idUbicacion, cantidad);
            res.status(201).json({ success: true, message: 'Ubicación asignada al lote' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

const updateCantidad = async function (req, res) {

    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }else{
        try {
            const { idLote, idUbicacion, cantidad } = req.body;
            await lotesUbicacionService.updateCantidad(idLote, idUbicacion, cantidad);
            res.status(200).send({ success: true, message: 'Cantidad actualizada' });
        } catch (error) {
            res.status(500).send({ success: false, error: error.message });
        }
    }
}

const deleted = async function (req, res) {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }else{
        try {
            const { idLote, idUbicacion } = req.params;
            await lotesUbicacionService.deleted(idLote, idUbicacion);
            res.status(200).send({ success: true, message: 'Asignación eliminada' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = {
    getByLote,
    getByUbicacion,
    create,
    updateCantidad,
    deleted
};