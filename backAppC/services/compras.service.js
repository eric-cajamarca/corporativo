// services/compras.service.js
const sql = require('mssql');
const { withPool } = require('../utils/dbPool.util');
const { v4: uuidv4 } = require('uuid');
const { getFechaSoloSQLString, getNowLocalSQLString } = require('../utils/fechaHoraLocal.util');
const comprasRepository = require('../repositories/compras.repository');
const comprasDetalleReporteRepository = require('../repositories/comprasDetalleReporte.repository');
const CajaRepository = require('../repositories/caja.repository');
const comprobantesCompraSunatService = require('./comprobantesCompraSunat.service');
const {
    obtenerEmpresasPermitidasOperacionCaja,
    resolverIdEmpresaOperacionCaja
} = require('../utils/cajaOperacionEmpresa.util');

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
    return withPool(async (pool) => {
        const recordset = await comprasRepository.listarComprasTodos(pool);
        return formatearFechasCompras(recordset);
    });
};

/**
 * Lista una compra por idCompra (admin).
 */
exports.obtenerComprasPorId = async (idCompra) => {
    return withPool(async (pool) => {
        const recordset = await comprasRepository.listarComprasPorId(pool, idCompra);
        return formatearFechasCompras(recordset);
    });
};

/**
 * Lista una compra por idCompra e idEmpresa.
 */
exports.obtenerComprasPorIdCompraIdEmpresa = async (idEmpresa, idCompra) => {
    return withPool((pool) => comprasRepository.listarComprasPorIdCompraIdEmpresa(pool, idEmpresa, idCompra));
};

/**
 * Lista compras de una empresa (con proveedor y estado pago).
 */
exports.listarComprasPorIdEmpresa = async (idEmpresa) => {
    return withPool((pool) => comprasRepository.listarComprasPorIdEmpresa(pool, idEmpresa));
};

/**
 * Listado para caja / pago proveedores: una empresa (query idEmpresaOperacion) o todas las permitidas si el query va vacío.
 */
exports.listarComprasCajaPorUsuario = async (user, idEmpresaOperacionRaw) => {
    return withPool(async (pool) => {
        let recordset;
        if (idEmpresaOperacionRaw != null && String(idEmpresaOperacionRaw).trim() !== '') {
            const idE = await resolverIdEmpresaOperacionCaja(pool, user, idEmpresaOperacionRaw);
            recordset = await comprasRepository.listarComprasPorIdEmpresa(pool, idE);
        } else {
            const lista = await obtenerEmpresasPermitidasOperacionCaja(pool, user.empresa);
            const ids = lista.map((x) => x.idEmpresa).filter(Boolean);
            recordset = await comprasRepository.listarComprasPorIdsEmpresa(pool, ids);
        }
        return formatearFechasCompras(recordset);
    });
};

/**
 * Crea una compra. Valida permisos y reglas de negocio; idEmpresa e idUsuario vienen del token.
 * Body: ... opcional comprobanteSunat (CPE: condicionPago, tipoCambio solo crédito+moneda≠PEN, fechaVencimiento y cuotas si crédito).
 * Retorna { idCompra }.
 */
exports.crearCompra = async (idEmpresa, idUsuario, body) => {
    const {
        idProveedor, compCompra, idComprobante, serie, numero, fEmision, fVencimiento, idMoneda, idEstadoPago,
        subTotal, igv, exonerado, gratuito, otrosCargos, descuentos, total, idMediosPago, compRelacionado,
        comprobanteSunat
    } = body;

    if (total != null && Number(total) < 0) {
        throw new Error('El total no puede ser negativo');
    }

    const idCompra = uuidv4();
    const fEmisionSQL = getFechaSoloSQLString(fEmision) || getNowLocalSQLString();
    const fVencimientoSQL = getFechaSoloSQLString(fVencimiento) || fEmisionSQL;
    const compRelacionadoVal = compRelacionado || null;

    let idEstadoPagoFinal = idEstadoPago != null ? Number(idEstadoPago) : 2;
    return await withPool(async (pool) => {
        if (idMediosPago != null) {
            const idNum = Number(idMediosPago);
            let desc = await comprasRepository.obtenerDescripcionFormaPago(pool, idNum);
            if (!desc) desc = await comprasRepository.obtenerDescripcionMedioPago(pool, idNum);
            if (/credito/i.test(desc)) {
                idEstadoPagoFinal = 1;
            }
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            await comprasRepository.crearCompra(transaction, {
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

            if (comprobanteSunat && typeof comprobanteSunat === 'object') {
                await comprobantesCompraSunatService.registrarDespuesCompra(
                    transaction,
                    idEmpresa,
                    idUsuario,
                    idCompra,
                    comprobanteSunat
                );
            }

            await transaction.commit();
        } catch (err) {
            try {
                await transaction.rollback();
            } catch (re) {
                console.error('compras.service crearCompra rollback:', re);
            }
            throw err;
        }

        // Registrar egreso en caja solo si: comprobante es Boleta (03) o Factura (01) y compra está pagada.
        const totalNum = Number(total) || 0;
        if (idEstadoPagoFinal === 2 && totalNum > 0) {
            try {
                const codigoComp = await comprasRepository.obtenerCodigoComprobante(pool, idEmpresa, idComprobante);
                const codigo = (codigoComp || '').trim();
                const esBoletaOFactura = codigo === '01' || codigo === '03';
                if (esBoletaOFactura) {
                    const apertura = await CajaRepository.obtenerCualquierAperturaAbiertaRepo(pool, idEmpresa);
                    if (apertura && apertura.idApertura) {
                        const idTipoEgreso = await CajaRepository.obtenerIdTipoMovimientoEgresoRepo(pool, 'COMPRA_CONTADO');
                        if (idTipoEgreso) {
                            const serieNum = [serie, numero].filter(Boolean).join('-') || compCompra || 'Compra';
                            const userMin = { empresa: idEmpresa, sub: idUsuario, sucursal: apertura.idSucursal || undefined };
                            await CajaRepository.registrarMovimientoRepo(pool, userMin, {
                                idApertura: apertura.idApertura,
                                idTipoMovimientoCaja: idTipoEgreso,
                                concepto: 'Compra al contado ' + serieNum,
                                monto: totalNum,
                                idMediosPago: idMediosPago != null ? Number(idMediosPago) : null,
                                documentoRelacionado: serieNum
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('compras.service crearCompra: no se pudo registrar egreso en caja:', err);
            }
        }

        return { idCompra };
    });
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

    return withPool((pool) => comprasRepository.actualizarCompra(pool, {
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
    }));
};

/**
 * Elimina una compra por idEmpresa (token) e idCompra. Retorna rowsAffected.
 */
exports.eliminarCompra = async (idEmpresa, idCompra) => {
    return withPool((pool) => comprasRepository.eliminarCompra(pool, idEmpresa, idCompra));
};

/**
 * Lista comprobantes (compCompra) por proveedor e idEmpresa.
 */
exports.listarComprobantesPorProveedor = async (idEmpresa, idProveedor) => {
    return withPool((pool) => comprasRepository.listarComprobantesPorProveedor(pool, idEmpresa, idProveedor));
};

// --- Borrador compras ---

exports.listarBorradorCompras = async (idEmpresa) => {
    return withPool((pool) => comprasRepository.listarBorradorCompras(pool, idEmpresa));
};

exports.crearBorradorCompra = async (idEmpresa, body) => {
    return withPool(async (pool) => {
        await comprasRepository.crearBorradorCompra(pool, { idEmpresa, ...body });
    });
};

exports.editarBorradorCompra = async (idEmpresa, body) => {
    return withPool((pool) => comprasRepository.actualizarBorradorCompra(pool, { idEmpresa, ...body }));
};

exports.eliminarBorradorCompras = async (idEmpresa) => {
    return withPool((pool) => comprasRepository.eliminarBorradorCompras(pool, idEmpresa));
};

// --- Correlativos ---

exports.listarCorrelativos = async (idEmpresa) => {
    return withPool((pool) => comprasRepository.listarCorrelativos(pool, idEmpresa));
};

exports.actualizarCorrelativo = async (idEmpresa, idCorrelativo, numero) => {
    return withPool((pool) => comprasRepository.actualizarCorrelativo(pool, idEmpresa, idCorrelativo, numero));
};

function abreviaturaComprobante(codigo, nombre) {
    const c = String(codigo || '').trim();
    if (c === '01') return 'FC';
    if (c === '03') return 'BC';
    if (c === '07') return 'NC';
    if (c === '08') return 'ND';
    const n = String(nombre || '').toLowerCase();
    if (n.includes('factura')) return 'FC';
    if (n.includes('boleta')) return 'BC';
    if (n.includes('crédito') || n.includes('credito')) return 'NC';
    if (n.includes('débito') || n.includes('debito')) return 'ND';
    return 'DOC';
}

function etiquetaEstadoCompra(descripcion) {
    const d = String(descripcion || '').trim().toLowerCase();
    if (d.includes('pagad')) return 'CONFIRMADO';
    if (d.includes('pendient')) return 'PENDIENTE';
    return String(descripcion || '—').toUpperCase();
}

function etiquetaDocumento(row) {
    const abrev = abreviaturaComprobante(row.codigoComprobante, row.tipoComprobante);
    const comp = String(row.compCompra || '').trim();
    if (comp) return `${abrev} ${comp}`;
    const serie = String(row.serie || '').trim();
    const numero = row.numero != null ? String(row.numero).trim() : '';
    if (serie || numero) return `${abrev} ${serie}-${numero}`;
    return abrev;
}

function agruparLineasReporteDetallado(lineas) {
    const map = new Map();
    for (const row of lineas || []) {
        const key = String(row.idCompra);
        if (!map.has(key)) {
            map.set(key, {
                idCompra: row.idCompra,
                proveedor: String(row.rSocial || ''),
                ruc: String(row.ruc || ''),
                documento: etiquetaDocumento(row),
                fecha: String(row.fEmision || ''),
                estado: etiquetaEstadoCompra(row.estadoPago),
                subTotal: Number(row.subTotal) || 0,
                igv: Number(row.igv) || 0,
                descuentos: Number(row.descuentos) || 0,
                total: Number(row.total) || 0,
                lineas: [],
            });
        }
        const comp = map.get(key);
        comp.lineas.push({
            codigo: String(row.codigo || ''),
            producto: String(row.producto || ''),
            cantidad: Number(row.cantidad) || 0,
            precio: Number(row.pUnitario) || 0,
            importe: Number(row.importeLinea) || 0,
        });
    }
    return Array.from(map.values());
}

/**
 * Reporte detallado de compras por comprobante (cabecera + líneas de producto).
 */
exports.obtenerReporteDetallado = async (idEmpresa, query) => {
    if (!idEmpresa) {
        throw new Error('Empresa no identificada');
    }
    const fechaInicio = query.fechaInicio || query.fechaDesde;
    const fechaFin = query.fechaFin || query.fechaHasta;
    if (!fechaInicio || !fechaFin) {
        throw new Error('Indique fechaInicio y fechaFin');
    }
    const desde = new Date(fechaInicio);
    const hasta = new Date(fechaFin);
    if (desde > hasta) {
        throw new Error('La fecha inicio no puede ser mayor que la fecha fin');
    }

    const rucLike =
        query.proveedorRuc && String(query.proveedorRuc).trim()
            ? `%${String(query.proveedorRuc).trim()}%`
            : null;
    const razonLike =
        query.proveedorRazon && String(query.proveedorRazon).trim()
            ? `%${String(query.proveedorRazon).trim()}%`
            : null;

    return withPool(async (pool) => {
        const lineas = await comprasDetalleReporteRepository.listarLineasReporteDetallado(pool, {
            idEmpresa,
            fechaInicio,
            fechaFin,
            proveedorRucLike: rucLike,
            proveedorRazonLike: razonLike,
        });
        const comprobantes = agruparLineasReporteDetallado(lineas);
        const totales = comprobantes.reduce(
            (acc, c) => {
                acc.subTotal += c.subTotal;
                acc.igv += c.igv;
                acc.descuentos += c.descuentos;
                acc.total += c.total;
                return acc;
            },
            { subTotal: 0, igv: 0, descuentos: 0, total: 0, cantidadComprobantes: comprobantes.length }
        );
        totales.cantidadComprobantes = comprobantes.length;
        return {
            fechaInicio: String(fechaInicio).slice(0, 10),
            fechaFin: String(fechaFin).slice(0, 10),
            comprobantes,
            totales,
        };
    });
};
