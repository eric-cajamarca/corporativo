const lotesService = require('../services/lotes.service');

const getAll = async function (req, res) {
        if (!req.user) {
        return res.status(401).send({ success: false, error: 'Unauthorized' });
    }else{
                try {
            const idEmpresa = req.user.empresa;
            const alcance = req.query && req.query.alcance ? String(req.query.alcance).trim().toLowerCase() : '';
            const lotes =
              alcance === 'gestora'
                ? await lotesService.getAllConsolidadoGestora(idEmpresa)
                : await lotesService.getAll(idEmpresa);
            res.status(200).send({ success: true, data: lotes });
        } catch (error) {
            res.status(500).send({ success: false, data: undefined });
        }
    }
    
}
//const obtenerMarcas = async function (req, res) {
const getById = async function (req, res) {
     if (!req.user) {
        return res.status(401).send({ success: false, error: 'Unauthorized' });
    }else{
        try {
            const { idLote } = req.params;
            const idEmpresa = req.user.empresa;
            const lote = await lotesService.getById(idLote, idEmpresa);
            if (!lote) {
                return res.status(404).send({ success: false, error: 'Lote no encontrado' });
            }
            res.status(200).send({ success: true, data: lote });
        } catch (error) {
            res.status(500).send({ success: false, data: undefined, error: error.message });
        }
    }
}

const getBySucursal = async function (req, res) {

     if (!req.user) {
        return res.status(401).send({ success: false, error: 'Unauthorized' });
    }else{

        try {
            const { idSucursal } = req.params;
            const { idEmpresa } = req.user.empresa;
            const lotes = await lotesService.getBySucursal(idEmpresa, idSucursal);
            res.status(200).send({ success: true, data: lotes });
        } catch (error) {
            res.status(500).send({ success: false, data:undefined });
        }
    }
}

const create = async function (req, res) {
     if (!req.user) {
        return res.status(401).send({ success: false, error: 'Unauthorized' });
    }else{
        try {
        const { idEmpresa } = req.user.empresa;
        const loteData = { ...req.body, idEmpresa };
        const nuevoLote = await lotesService.create(loteData);
            res.status(200).send({ success: true, data: nuevoLote });
        } catch (error) {
            res.status(500).send({ success: false, error: error.message });
        }
    }
    
}

const update = async function (req, res) {

    if (!req.user) {
        return res.status(401).send({ success: false, error: 'Unauthorized' });
    }else{
        try {
            const { idLote } = req.params;
            const idEmpresa = req.user.empresa;
            const loteData = req.body;
            const loteActualizado = await lotesService.update(idLote, idEmpresa, loteData);
            res.status(200).send({ success: true, data: loteActualizado });
        } catch (error) {
            res.status(500).send({ success: false, error: error.message });
        }
    }


}

const deleted = async function (req, res) {

    if (!req.user) {
        return res.status(401).send({ success: false, error: 'Unauthorized' });
    }else{
        try {
            const { idLote } = req.params;
            await lotesService.deleted(idLote);
            res.status(200).send({ success: true, message: 'Lote eliminado' });
        } catch (error) {
            res.status(500).send({ success: false, error: error.message });
        }
    }



}

const actualizarCantidadDisponible = async function(req, res) {

    if (!req.user) {
        return res.status(401).send({ success: false, error: 'Unauthorized' });
    }else{
        try {
            const { idLote } = req.params;
            const { cantidad, tipo } = req.body; // tipo: 'INGRESO' o 'SALIDA'
            await lotesService.actualizarCantidadDisponible(idLote, cantidad, tipo);
            res.status(200).send({ success: true, message: 'Cantidad actualizada' });
        } catch (error) {
            res.status(500).send({ success: false, error: error.message });
        }
    }


    
}

module.exports = {
    getAll,
    getById,
    getBySucursal,
    create,
    update,
    deleted,
    actualizarCantidadDisponible
};