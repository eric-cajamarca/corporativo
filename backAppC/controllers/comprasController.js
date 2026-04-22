const comprasService = require('../services/compras.service');

const obtener_compras_todos = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (req.user.rol !== 'Administrador') {
        return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    const idEmpresa = req.user.empresa;
    if (!idEmpresa) {
        return res.status(403).send({ message: 'No Access', data: undefined });
    }
    try {
        const data = await comprasService.listarComprasPorIdEmpresa(idEmpresa);
        res.status(200).send({ data });
    } catch (error) {
        console.error('obtener_compras_todos:', error);
        return next(error);
    }
};

const obtener_compras_id = async (req, res, next) => {
    const idCompra = req.params.id;
    if (!req.user) {
        return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (req.user.rol !== 'Administrador') {
        return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    try {
        const data = await comprasService.obtenerComprasPorId(idCompra);
        res.status(200).send({ data });
    } catch (error) {
        console.error('obtener_compras_id:', error);
        return next(error);
    }
};

const obtener_compras_idCompra_idEmpresa = async (req, res, next) => {
    const idCompra = req.params.id;
    const idEmpresa = req.user?.empresa;
    if (!req.user) {
        return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (req.user.rol !== 'Administrador') {
        return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    try {
        const data = await comprasService.obtenerComprasPorIdCompraIdEmpresa(idEmpresa, idCompra);
        res.status(200).send({ data });
    } catch (error) {
        console.error('obtener_compras_idCompra_idEmpresa:', error);
        return next(error);
    }
};

const obtener_compras_todos_idEmpresa = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    const idJwt = req.user.empresa || req.user.idEmpresa;
    if (!idJwt) {
        return res.status(403).send({ message: 'Empresa no identificada en la sesión', data: undefined });
    }
    try {
        const data = await comprasService.listarComprasCajaPorUsuario(req.user, req.query.idEmpresaOperacion);
        res.status(200).send({ data });
    } catch (error) {
        if (error.message === 'EMPRESA_OPERACION_NO_PERMITIDA') {
            return res.status(403).send({ message: 'Empresa de operación no permitida', data: undefined });
        }
        if (error.message === 'NO_ACCESS') {
            return res.status(401).send({ message: 'No autorizado', data: undefined });
        }
        console.error('obtener_compras_todos_idEmpresa:', error);
        return next(error);
    }
};

const crear_compra = async (req, res, next) => {
    if (!req.user) {
        return res.status(403).send({ message: 'No Access', data: undefined });
    }
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Almacenero') {
        return res.status(403).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    const idEmpresa = req.user.empresa;
    const idUsuario = req.user.sub || req.user.idUsuario;
    try {
        const resultado = await comprasService.crearCompra(idEmpresa, idUsuario, req.body);
        res.status(200).send({ data: resultado.idCompra });
    } catch (error) {
        console.error('crear_compra:', error);
        if (error.number === 2627) {
            return res.status(400).send({ message: 'Ya existe una compra con la misma serie y número para esta empresa.', data: undefined });
        }
        if (error.statusCode === 400 && error.message) {
            return res.status(400).send({ message: error.message, data: undefined });
        }
        return next(error);
    }
};

const editar_compra = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Almacenero') {
        return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    const idCompra = req.params.id;
    const idEmpresa = req.user.empresa;
    const idUsuario = req.body.idUsuario || req.user.sub || req.user.idUsuario;
    try {
        const rowsAffected = await comprasService.editarCompra(idEmpresa, idUsuario, idCompra, req.body);
        res.status(200).send({ message: 'Compra editada correctamente', data: rowsAffected });
    } catch (error) {
        console.error('editar_compra:', error);
        if (error.message && error.message.includes('idProveedor')) {
            return res.status(400).send({ message: error.message, data: undefined });
        }
        return next(error);
    }
};

const eliminar_idcompra_empresa = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Almacenero') {
        return res.status(403).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    const idCompra = req.params.id;
    const idEmpresa = req.user.empresa;
    try {
        const rowsAffected = await comprasService.eliminarCompra(idEmpresa, idCompra);
        if (!rowsAffected) {
            return res.status(404).send({ message: 'Compra no encontrada para esta empresa', data: 0 });
        }
        res.status(200).send({ message: 'Compra eliminada correctamente', data: rowsAffected });
    } catch (error) {
        console.error('eliminar_idcompra_empresa:', error);
        if (error && error.message === 'NO_SE_PUEDE_ELIMINAR_COMPRA_STOCK_YA_CONSUMIDO') {
            return res.status(400).send({
                message: 'No se puede eliminar la compra porque su stock ya fue consumido o movido. Primero revierta esos movimientos de inventario.',
                data: undefined
            });
        }
        if (error && Number(error.number) === 547) {
            return res.status(400).send({
                message: 'No se puede eliminar la compra porque tiene registros relacionados. Elimine primero los registros dependientes.',
                data: undefined
            });
        }
        return next(error);
    }
};

const buscar_comprobante_idCliente = async (req, res, next) => {
    const idProveedor = req.params.id;
    const idEmpresa = req.user?.empresa;
    if (!req.user) {
        return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Almacenero') {
        return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    try {
        const data = await comprasService.listarComprobantesPorProveedor(idEmpresa, idProveedor);
        res.status(200).send({ data });
    } catch (error) {
        console.error('buscar_comprobante_idCliente:', error);
        return next(error);
    }
};

// --- Borrador compras ---

const obtener_borrador_compras_empresa = async (req, res, next) => {
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!req.user) {
        return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (req.user.rol !== 'Administrador') {
        return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    try {
        const data = await comprasService.listarBorradorCompras(idEmpresa);
        res.status(200).send({ data });
    } catch (error) {
        console.error('obtener_borrador_compras_empresa:', error);
        return next(error);
    }
};

const crear_borrador_compras_empresa = async (req, res, next) => {
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!req.user) {
        return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (req.user.rol !== 'Administrador') {
        return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    try {
        await comprasService.crearBorradorCompra(idEmpresa, req.body);
        res.status(200).send({ message: 'Borrador de compra creado correctamente', data: undefined });
    } catch (error) {
        console.error('crear_borrador_compras_empresa:', error);
        return next(error);
    }
};

const editar_borrador_compras_empresa = async (req, res, next) => {
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!req.user) {
        return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (req.user.rol !== 'Administrador') {
        return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    try {
        await comprasService.editarBorradorCompra(idEmpresa, req.body);
        res.status(200).send({ message: 'Borrador de compra editado correctamente', data: undefined });
    } catch (error) {
        console.error('editar_borrador_compras_empresa:', error);
        return next(error);
    }
};

const eliminar_borrador_compras_empresa = async (req, res, next) => {
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!req.user) {
        return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (req.user.rol !== 'Administrador') {
        return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    try {
        const rowsAffected = await comprasService.eliminarBorradorCompras(idEmpresa);
        res.status(200).send({ message: 'Borrador de compra eliminado correctamente', data: rowsAffected });
    } catch (error) {
        console.error('eliminar_borrador_compras_empresa:', error);
        return next(error);
    }
};

// --- Correlativos ---

const obtener_correlativos_empresa = async (req, res, next) => {
    const idEmpresa = req.user?.empresa;
    if (!idEmpresa) {
        return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    try {
        const data = await comprasService.listarCorrelativos(idEmpresa);
        res.status(200).send({ data });
    } catch (error) {
        console.error('obtener_correlativos_empresa:', error);
        return next(error);
    }
};

const editar_correlativos_empresa = async (req, res, next) => {
    const idCorrelativo = req.params.id;
    const { numero } = req.body;
    const idEmpresa = req.user?.empresa;
    if (!req.user) {
        return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    try {
        const rowsAffected = await comprasService.actualizarCorrelativo(idEmpresa, idCorrelativo, numero);
        res.status(200).send({ message: 'Correlativo editado correctamente', data: rowsAffected });
    } catch (error) {
        console.error('editar_correlativos_empresa:', error);
        return next(error);
    }
};

module.exports = {
    obtener_compras_todos,
    obtener_compras_id,
    obtener_compras_idCompra_idEmpresa,
    obtener_compras_todos_idEmpresa,
    crear_compra,
    editar_compra,
    eliminar_idcompra_empresa,
    obtener_borrador_compras_empresa,
    crear_borrador_compras_empresa,
    editar_borrador_compras_empresa,
    eliminar_borrador_compras_empresa,
    obtener_correlativos_empresa,
    editar_correlativos_empresa,
    buscar_comprobante_idCliente
};
