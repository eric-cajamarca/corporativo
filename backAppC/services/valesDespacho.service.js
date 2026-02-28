const sql = require('mssql');
const dbConfig = require('../dbconfig');
const valesDespachoRepository = require('../repositories/valesDespacho.repository');

exports.listar = async (idEmpresa, filtros) => {
    const pool = await sql.connect(dbConfig);
    return valesDespachoRepository.listar(pool, idEmpresa, filtros);
};

exports.obtenerPorId = async (idValeDespacho, idEmpresa) => {
    const pool = await sql.connect(dbConfig);
    return valesDespachoRepository.obtenerPorId(pool, idValeDespacho, idEmpresa);
};

exports.listarDetalle = async (idValeDespacho, idEmpresa) => {
    const pool = await sql.connect(dbConfig);
    return valesDespachoRepository.listarDetalle(pool, idValeDespacho, idEmpresa);
};

/**
 * Crea un vale de despacho y descuenta stock (MovimientosInventario SA) por cada línea.
 * El descuento de stock se hace aquí, no en la facturación.
 */
exports.crear = async (idEmpresa, idUsuario, body) => {
    const pool = await sql.connect(dbConfig);
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        const compVD = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query("SELECT idComprobante, serie FROM Comprobantes WHERE idEmpresa = @idEmpresa AND codigo = 'VD'");
        const rowVD = compVD.recordset && compVD.recordset[0];
        if (!rowVD) throw new Error('No existe comprobante Vale Despacho (VD) para esta empresa. Configure el comprobante VD.');
        const idComprobanteVD = rowVD.idComprobante;
        const serie = rowVD.serie || 'VD01';

        const numero = await valesDespachoRepository.obtenerSiguienteNumero(transaction, idEmpresa, idComprobanteVD);
        const numeroStr = String(numero).padStart(8, '0');
        const docRelacionado = `${serie}-${numeroStr}`;

        const idValeDespacho = await valesDespachoRepository.insertarVale(transaction, {
            idSucursal: body.idSucursal,
            idCliente: body.idCliente,
            idComprobante: idComprobanteVD,
            serie,
            numero: numeroStr,
            observaciones: body.observaciones
        }, idEmpresa, idUsuario);

        const items = body.detalle || [];
        if (items.length === 0) throw new Error('El vale debe tener al menos un detalle.');
        await valesDespachoRepository.insertarDetalle(transaction, idValeDespacho, items);

        for (const it of items) {
            const cantidad = Number(it.cantidad) || 0;
            if (cantidad <= 0) continue;
            await valesDespachoRepository.insertarMovimientoInventario(
                transaction,
                idEmpresa,
                body.idSucursal,
                it.idProducto,
                cantidad,
                docRelacionado,
                idComprobanteVD,
                idUsuario,
                `Vale Despacho ${docRelacionado}`
            );
        }

        await transaction.commit();
        return { idValeDespacho, serie, numero: numeroStr, compVale: docRelacionado };
    } catch (err) {
        await transaction.rollback();
        console.error('valesDespacho.crear:', err);
        throw err;
    }
};

exports.anular = async (idValeDespacho, idEmpresa) => {
    const pool = await sql.connect(dbConfig);
    const vale = await valesDespachoRepository.obtenerPorId(pool, idValeDespacho, idEmpresa);
    if (!vale) throw new Error('Vale de despacho no encontrado');
    if (vale.estado === 'ANULADO') throw new Error('El vale ya está anulado');
    if (vale.idVentaLiquidacion) throw new Error('No se puede anular un vale ya liquidado');
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();
        await valesDespachoRepository.anularVale(transaction, idValeDespacho, idEmpresa);
        await transaction.commit();
        return { ok: true };
    } catch (err) {
        await transaction.rollback();
        console.error('valesDespacho.anular:', err);
        throw err;
    }
};
