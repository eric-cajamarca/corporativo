// services/compras.service.js
const sql = require('mssql');
const dbConfig = require('../dbconfig');
const { v4: uuidv4 } = require('uuid');
const { getFechaSoloSQLString, getNowLocalSQLString } = require('../utils/fechaHoraLocal.util');
const comprasRepository = require('../repositories/compras.repository');

/**
 * Formatea fechas fEmision/fVencimiento en un recordset a YYYY-MM-DD.
 */
function formatearFechasCompras(recordset) {
    const list = Array.isArray(recordset) ? recordset : [];
    list.forEach(row => {
        if (row.fEmision != null && typeof row.fEmision !== 'string') {
            row.fEmision = row.fEmision.toISOString ? row.fEmision.toISOString().split('T')[0] : row.fEmision;
        }
        if (row.fVencimiento != null && typeof row.fVencimiento !== 'string') {
            row.fVencimiento = row.fVencimiento.toISOString ? row.fVencimiento.toISOString().split('T')[0] : row.fVencimiento;
        }
    });
    return list;
}

/**
 * Lista todas las compras (solo admin). idEmpresa no aplica.
 */
exports.listarComprasTodos = async () => {
    const pool = await sql.connect(dbConfig);
    const recordset = await comprasRepository.listarComprasTodos(pool);
    return formatearFechasCompras(recordset);
};

/**
 * Lista una compra por idCompra (admin).
 */
exports.obtenerComprasPorId = async (idCompra) => {
    const pool = await sql.connect(dbConfig);
    const recordset = await comprasRepository.listarComprasPorId(pool, idCompra);
    return formatearFechasCompras(recordset);
};

/**
 * Lista una compra por idCompra e idEmpresa.
 */
exports.obtenerComprasPorIdCompraIdEmpresa = async (idEmpresa, idCompra) => {
    const pool = await sql.connect(dbConfig);
    return await comprasRepository.listarComprasPorIdCompraIdEmpresa(pool, idEmpresa, idCompra);
};

/**
 * Lista compras de una empresa (con proveedor y estado pago).
 */
exports.listarComprasPorIdEmpresa = async (idEmpresa) => {
    const pool = await sql.connect(dbConfig);
    return await comprasRepository.listarComprasPorIdEmpresa(pool, idEmpresa);
};

/**
 * Crea una compra. Valida permisos y reglas de negocio; idEmpresa e idUsuario vienen del token.
 * Body: idProveedor, compCompra, idComprobante, serie, numero, fEmision, fVencimiento, idMoneda, idEstadoPago, subTotal, igv, exonerado, gratuito, otrosCargos, descuentos, total, idMediosPago, compRelacionado.
 * Retorna { idCompra }.
 */
exports.crearCompra = async (idEmpresa, idUsuario, body) => {
    const {
        idProveedor, compCompra, idComprobante, serie, numero, fEmision, fVencimiento, idMoneda, idEstadoPago,
        subTotal, igv, exonerado, gratuito, otrosCargos, descuentos, total, idMediosPago, compRelacionado
    } = body;

    if (total != null && Number(total) < 0) {
        throw new Error('El total no puede ser negativo');
    }

    const idCompra = uuidv4();
    const fEmisionSQL = getFechaSoloSQLString(fEmision) || getNowLocalSQLString();
    const fVencimientoSQL = getFechaSoloSQLString(fVencimiento) || fEmisionSQL;
    const compRelacionadoVal = compRelacionado || null;

    let idEstadoPagoFinal = idEstadoPago != null ? Number(idEstadoPago) : 2;
    const pool = await sql.connect(dbConfig);
    if (idMediosPago != null) {
        const desc = await comprasRepository.obtenerDescripcionMedioPago(pool, Number(idMediosPago));
        if (/credito/i.test(desc)) {
            idEstadoPagoFinal = 1;
        }
    }

    await comprasRepository.crearCompra(pool, {
        idCompra,
        idEmpresa,
        compCompra: compCompra || '',
        idComprobante,
        serie,
        numero,
        fEmision: fEmisionSQL,
        fVencimiento: fVencimientoSQL,
        idProveedor,
        idMoneda,
        idEstadoPago: idEstadoPagoFinal,
        subTotal: subTotal ?? 0,
        igv: igv ?? 0,
        exonerado: exonerado ?? 0,
        gratuito: gratuito ?? 0,
        otrosCargos: otrosCargos ?? 0,
        descuentos: descuentos ?? 0,
        total: total ?? 0,
        idMediosPago,
        compRelacionado: compRelacionadoVal,
        idUsuario
    });
    return { idCompra };
};

/**
 * Edita una compra. idEmpresa del token. params: idCompra (params.id), body.
 */
exports.editarCompra = async (idEmpresa, idUsuario, idCompra, body) => {
    const idProveedorInt = parseInt(String(body.idProveedor), 10);
    if (isNaN(idProveedorInt)) {
        throw new Error('idProveedor inválido');
    }

    const fEmision = body.fEmision ? getFechaSoloSQLString(body.fEmision) : null;
    const fVencimiento = body.fVencimiento ? getFechaSoloSQLString(body.fVencimiento) : null;

    const pool = await sql.connect(dbConfig);
    return await comprasRepository.actualizarCompra(pool, {
        idEmpresa,
        idCompra,
        compCompra: body.compCompra ?? '',
        serie: body.serie ?? '',
        numero: body.numero ?? '',
        fEmision,
        fVencimiento,
        idProveedor: idProveedorInt,
        idMoneda: body.idMoneda ?? 1,
        idEstadoPago: body.idEstadoPago ?? 1,
        subTotal: body.subTotal ?? 0,
        igv: body.igv ?? 0,
        exonerado: body.exonerado ?? 0,
        gratuito: body.gratuito ?? 0,
        otrosCargos: body.otrosCargos ?? 0,
        descuentos: body.descuentos ?? 0,
        total: body.total ?? 0,
        idMediosPago: body.idMediosPago ?? 1,
        compRelacionado: body.compRelacionado ?? '',
        idUsuario
    });
};

/**
 * Elimina una compra por idEmpresa (token) e idCompra. Retorna rowsAffected.
 */
exports.eliminarCompra = async (idEmpresa, idCompra) => {
    const pool = await sql.connect(dbConfig);
    return await comprasRepository.eliminarCompra(pool, idEmpresa, idCompra);
};

/**
 * Lista comprobantes (compCompra) por proveedor e idEmpresa.
 */
exports.listarComprobantesPorProveedor = async (idEmpresa, idProveedor) => {
    const pool = await sql.connect(dbConfig);
    return await comprasRepository.listarComprobantesPorProveedor(pool, idEmpresa, idProveedor);
};

// --- Borrador compras ---

exports.listarBorradorCompras = async (idEmpresa) => {
    const pool = await sql.connect(dbConfig);
    return await comprasRepository.listarBorradorCompras(pool, idEmpresa);
};

exports.crearBorradorCompra = async (idEmpresa, body) => {
    const pool = await sql.connect(dbConfig);
    await comprasRepository.crearBorradorCompra(pool, { idEmpresa, ...body });
};

exports.editarBorradorCompra = async (idEmpresa, body) => {
    const pool = await sql.connect(dbConfig);
    return await comprasRepository.actualizarBorradorCompra(pool, { idEmpresa, ...body });
};

exports.eliminarBorradorCompras = async (idEmpresa) => {
    const pool = await sql.connect(dbConfig);
    return await comprasRepository.eliminarBorradorCompras(pool, idEmpresa);
};

// --- Correlativos ---

exports.listarCorrelativos = async (idEmpresa) => {
    const pool = await sql.connect(dbConfig);
    return await comprasRepository.listarCorrelativos(pool, idEmpresa);
};

exports.actualizarCorrelativo = async (idEmpresa, idCorrelativo, numero) => {
    const pool = await sql.connect(dbConfig);
    return await comprasRepository.actualizarCorrelativo(pool, idEmpresa, idCorrelativo, numero);
};
