const { withPool } = require('../utils/dbPool.util');
const transferenciaService = require('../services/transferencia.service');

const crear_transferencia = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(401).send({ 
                message: 'No Access', 
                data: undefined 
            });
        }

        const { 
            idSucursalOrigen,
            idSucursalDestino,
            items, // Array: [{idProducto, cantidad}, ...]
            observaciones,
            docRelacionado
        } = req.body;

        // Validaciones básicas
        if (!idSucursalOrigen || !idSucursalDestino || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).send({ 
                message: 'Faltan campos requeridos', 
                data: undefined 
            });
        }

        if (idSucursalOrigen === idSucursalDestino) {
            return res.status(400).send({ 
                message: 'La sucursal origen y destino no pueden ser iguales', 
                data: undefined 
            });
        }

        const resultado = await withPool(async (pool) =>
            transferenciaService.crearTransferencia(
                pool,
                {
                    idEmpresa: req.user.empresa,
                    idSucursalOrigen,
                    idSucursalDestino,
                    items,
                    observaciones: observaciones || '',
                    docRelacionado: docRelacionado || null,
                    idUsuario: req.user.idUsuario
                },
                req.user
            )
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message,
            idMovimiento: resultado.idMovimiento,
            totalItems: resultado.totalItems
        });

    } catch (error) {
        console.error('Error al crear transferencia:', error);

        switch (error.message) {
            case 'NO_ACCESO':
                return res.status(401).send({ message: 'No Access', data: undefined });
            case 'CAMPOS_REQUERIDOS':
                return res.status(400).send({ message: 'Faltan campos requeridos', data: undefined });
            case 'SUCURSALES_IGUALES':
                return res.status(400).send({ message: 'Las sucursales no pueden ser iguales', data: undefined });
            case 'STOCK_INSUFICIENTE':
                return res.status(400).send({ message: 'Stock insuficiente en sucursal origen', data: undefined });
            case 'PRODUCTO_NO_ENCONTRADO':
                return res.status(404).send({ message: 'Uno o más productos no existen', data: undefined });
            case 'SUCURSAL_NO_ENCONTRADA':
                return res.status(404).send({ message: 'Sucursal no encontrada', data: undefined });
            case 'SUCURSAL_INACTIVA':
                return res.status(400).send({ message: 'Una de las sucursales está inactiva', data: undefined });
            default:
                return res.status(500).send({ message: 'Error interno del servidor', data: undefined });
        }
    }
};

const obtener_transferencias = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }

        const { fechaInicio, fechaFin, idSucursal, estado } = req.query;

        const resultado = await withPool(async (pool) =>
            transferenciaService.obtenerTransferencias(
                pool,
                {
                    idEmpresa: req.user.empresa,
                    fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
                    fechaFin: fechaFin ? new Date(fechaFin) : null,
                    idSucursal: idSucursal || null,
                    estado: estado || null
                },
                req.user
            )
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message,
            totalTransferencias: resultado.totalTransferencias
        });

    } catch (error) {
        console.error('Error al obtener transferencias:', error);
        
        if (error.message === 'NO_ACCESO') {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }
        
        res.status(500).send({ message: 'Error interno del servidor', data: undefined });
    }
};

const obtener_transferencia_por_id = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }

        const { idMovimiento } = req.params;

        if (!idMovimiento) {
            return res.status(400).send({ message: 'ID de movimiento requerido', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            transferenciaService.obtenerTransferenciaPorId(
                pool,
                idMovimiento,
                req.user.empresa,
                req.user
            )
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message
        });

    } catch (error) {
        console.error('Error al obtener transferencia:', error);
        
        if (error.message === 'TRANSFERENCIA_NO_ENCONTRADA') {
            return res.status(404).send({ message: 'Transferencia no encontrada', data: undefined });
        }
        
        res.status(500).send({ message: 'Error interno del servidor', data: undefined });
    }
};

const revertir_transferencia = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }

        const { idMovimiento } = req.params;
        const { motivo } = req.body;

        if (!idMovimiento) {
            return res.status(400).send({ message: 'ID de movimiento requerido', data: undefined });
        }

        if (!motivo || motivo.trim() === '') {
            return res.status(400).send({ message: 'Motivo de reversión requerido', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            transferenciaService.revertirTransferencia(
                pool,
                {
                    idMovimiento,
                    motivo: motivo.trim(),
                    idUsuario: req.user.idUsuario,
                    idEmpresa: req.user.empresa
                },
                req.user
            )
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message,
            idMovimientoReverso: resultado.idMovimientoReverso
        });

    } catch (error) {
        console.error('Error al revertir transferencia:', error);
        
        switch (error.message) {
            case 'TRANSFERENCIA_NO_ENCONTRADA':
                return res.status(404).send({ message: 'Transferencia no encontrada', data: undefined });
            case 'TRANSFERENCIA_YA_REVERTIDA':
                return res.status(400).send({ message: 'La transferencia ya fue revertida', data: undefined });
            case 'STOCK_INSUFICIENTE_REVERSION':
                return res.status(400).send({ message: 'Stock insuficiente para reversión', data: undefined });
            default:
                return res.status(500).send({ message: 'Error interno del servidor', data: undefined });
        }
    }
};

const verificar_stock_transferencia = async function (req, res) {
    try {
        if (!req.user) {
            return res.status(401).send({ message: 'No Access', data: undefined });
        }

        const { 
            idSucursalOrigen,
            items // Array: [{idProducto, cantidad}, ...]
        } = req.body;

        if (!idSucursalOrigen || !items || !Array.isArray(items)) {
            return res.status(400).send({ message: 'Faltan campos requeridos', data: undefined });
        }

        const resultado = await withPool(async (pool) =>
            transferenciaService.verificarStockTransferencia(
                pool,
                {
                    idEmpresa: req.user.empresa,
                    idSucursalOrigen,
                    items
                },
                req.user
            )
        );

        res.status(200).send({ 
            data: resultado.data,
            message: resultado.message,
            tieneStockSuficiente: resultado.tieneStockSuficiente
        });

    } catch (error) {
        console.error('Error al verificar stock:', error);
        res.status(500).send({ message: 'Error interno del servidor', data: undefined });
    }
};

module.exports = {
    crear_transferencia,
    obtener_transferencias,
    obtener_transferencia_por_id,
    revertir_transferencia,
    verificar_stock_transferencia
};
