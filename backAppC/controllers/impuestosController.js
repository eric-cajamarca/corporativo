const impuestosService = require('../services/impuestos.service');

/**
 * GET /api/impuestos - Lista impuestos de la empresa del token.
 */
const listar = async (req, res) => {
    if (!req.user || !req.user.empresa) {
        return res.status(401).send({ message: 'No Access', data: undefined });
    }
    try {
        const idEmpresa = req.user.empresa;
        const data = await impuestosService.listar(idEmpresa);
        return res.status(200).send({ data });
    } catch (error) {
        console.error('impuestosController listar:', error);
        return res.status(500).send({ message: error.message || 'Error al listar impuestos', data: undefined });
    }
};

/**
 * GET /api/impuestos/:id - Obtiene un impuesto por id.
 */
const obtenerPorId = async (req, res) => {
    if (!req.user || !req.user.empresa) {
        return res.status(401).send({ message: 'No Access', data: undefined });
    }
    try {
        const idImpuesto = parseInt(req.params.id, 10);
        if (isNaN(idImpuesto)) {
            return res.status(400).send({ message: 'id inválido', data: undefined });
        }
        const idEmpresa = req.user.empresa;
        const data = await impuestosService.obtenerPorId(idImpuesto, idEmpresa);
        if (!data) {
            return res.status(404).send({ message: 'Impuesto no encontrado', data: undefined });
        }
        return res.status(200).send({ data });
    } catch (error) {
        console.error('impuestosController obtenerPorId:', error);
        return res.status(500).send({ message: error.message || 'Error al obtener impuesto', data: undefined });
    }
};

/**
 * POST /api/impuestos - Crea un impuesto. idEmpresa del token.
 */
const crear = async (req, res) => {
    if (!req.user || !req.user.empresa) {
        return res.status(401).send({ message: 'No Access', data: undefined });
    }
    try {
        const idEmpresa = req.user.empresa;
        const data = await impuestosService.crear(idEmpresa, req.body);
        return res.status(200).send({ data });
    } catch (error) {
        console.error('impuestosController crear:', error);
        return res.status(500).send({ message: error.message || 'Error al crear impuesto', data: undefined });
    }
};

/**
 * PUT /api/impuestos/:id - Actualiza un impuesto.
 */
const actualizar = async (req, res) => {
    if (!req.user || !req.user.empresa) {
        return res.status(401).send({ message: 'No Access', data: undefined });
    }
    try {
        const idImpuesto = parseInt(req.params.id, 10);
        if (isNaN(idImpuesto)) {
            return res.status(400).send({ message: 'id inválido', data: undefined });
        }
        const idEmpresa = req.user.empresa;
        const rows = await impuestosService.actualizar(idImpuesto, idEmpresa, req.body);
        if (rows === 0) {
            return res.status(404).send({ message: 'Impuesto no encontrado', data: undefined });
        }
        return res.status(200).send({ data: { rowsAffected: rows } });
    } catch (error) {
        console.error('impuestosController actualizar:', error);
        return res.status(500).send({ message: error.message || 'Error al actualizar impuesto', data: undefined });
    }
};

/**
 * PUT /api/impuestosestado/:id - Actualiza solo el estado. Body: { estado: true|false }
 */
const actualizarEstado = async (req, res) => {
    if (!req.user || !req.user.empresa) {
        return res.status(401).send({ message: 'No Access', data: undefined });
    }
    try {
        const idImpuesto = parseInt(req.params.id, 10);
        if (isNaN(idImpuesto)) {
            return res.status(400).send({ message: 'id inválido', data: undefined });
        }
        const idEmpresa = req.user.empresa;
        const estado = req.body.estado;
        const rows = await impuestosService.actualizarEstado(idImpuesto, idEmpresa, estado);
        if (rows === 0) {
            return res.status(404).send({ message: 'Impuesto no encontrado', data: undefined });
        }
        return res.status(200).send({ data: { rowsAffected: rows } });
    } catch (error) {
        console.error('impuestosController actualizarEstado:', error);
        return res.status(500).send({ message: error.message || 'Error al actualizar estado', data: undefined });
    }
};

module.exports = {
    listar,
    obtenerPorId,
    crear,
    actualizar,
    actualizarEstado
};
