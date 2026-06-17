// repositories/compras.repository.js
const sql = require('mssql');
const {
  SQL_SELECT_USUARIO_COMPRAS,
  SQL_JOIN_USUARIO_COMPRAS
} = require('../utils/documentoTrazabilidad.util');

const QUERY_COMPRAS_JOIN = `
    SELECT
        Compras.idEmpresa,
        Compras.idCompra, Compras.compCompra, Compras.idComprobante, Compras.serie, Compras.numero,
        CONVERT(VARCHAR(19), Compras.fEmision, 120) AS fEmision,
        CONVERT(VARCHAR(19), Compras.fVencimiento, 120) AS fVencimiento,
        Compras.idProveedor, Compras.idMoneda, Compras.idEstadoPago,
        Compras.subTotal, Compras.igv, Compras.exonerado, Compras.gratuito, Compras.otrosCargos, Compras.descuentos, Compras.total,
        Compras.idMediosPago, Compras.compRelacionado, Compras.idUsuario,
        CONVERT(VARCHAR(19), Compras.fRegistro, 120) AS fRegistro,
        Compras.numeroLote,
        ${SQL_SELECT_USUARIO_COMPRAS},
        Proveedores.ruc, Proveedores.rSocial, Proveedores.correo, Proveedores.celular, Proveedores.condicion, Proveedores.estado,
        CONVERT(VARCHAR(19), Proveedores.fCreacion, 120) AS fCreacion,
        EstadoPago.descripcion
    FROM Compras
    INNER JOIN Proveedores ON Compras.idProveedor = Proveedores.idProveedor
    INNER JOIN EstadoPago ON Compras.idEstadoPago = EstadoPago.idEstadoPago
    ${SQL_JOIN_USUARIO_COMPRAS}
`;

/**
 * Lista todas las compras (admin, sin filtro empresa). Retorna recordset.
 */
exports.listarComprasTodos = async (pool) => {
    const result = await pool.request().query(`
        ${QUERY_COMPRAS_JOIN}
    `);
    return result.recordset || [];
};

/**
 * Lista una compra por idCompra (admin).
 */
exports.listarComprasPorId = async (pool, idCompra) => {
    const result = await pool.request()
        .input('idCompra', sql.UniqueIdentifier, idCompra)
        .query(`
            ${QUERY_COMPRAS_JOIN}
            WHERE Compras.idCompra = @idCompra
        `);
    return result.recordset || [];
};

/**
 * Lista una compra por idCompra e idEmpresa.
 */
exports.listarComprasPorIdCompraIdEmpresa = async (executor, idEmpresa, idCompra) => {
    const result = await executor.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idCompra', sql.UniqueIdentifier, idCompra)
        .query(`
            SELECT * FROM Compras
            WHERE idEmpresa = @idEmpresa AND idCompra = @idCompra
        `);
    return result.recordset || [];
};

/**
 * Lista compras de una empresa (con JOIN Proveedores y EstadoPago).
 * Solo filtra por idEmpresa; si idEmpresa es null/undefined retorna [].
 */
exports.listarComprasPorIdEmpresa = async (pool, idEmpresa) => {
    if (!idEmpresa) return [];
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            ${QUERY_COMPRAS_JOIN}
            WHERE Compras.idEmpresa = @idEmpresa
        `);
    return result.recordset || [];
};

/**
 * Lista compras de varias empresas (misma estructura que listarComprasPorIdEmpresa).
 */
exports.listarComprasPorIdsEmpresa = async (pool, idsEmpresa) => {
    const ids = (idsEmpresa || []).filter(Boolean);
    if (ids.length === 0) return [];
    if (ids.length === 1) {
        return exports.listarComprasPorIdEmpresa(pool, ids[0]);
    }
    const request = pool.request();
    ids.forEach((id, i) => {
        request.input(`e${i}`, sql.UniqueIdentifier, id);
    });
    const placeholders = ids.map((_, i) => `@e${i}`).join(', ');
    const result = await request.query(`
        ${QUERY_COMPRAS_JOIN}
        WHERE Compras.idEmpresa IN (${placeholders})
        ORDER BY Compras.fRegistro DESC
    `);
    return result.recordset || [];
};

/**
 * Obtiene descripción de MediosPago por id.
 */
exports.obtenerDescripcionMedioPago = async (pool, idMediosPago) => {
    const result = await pool.request()
        .input('idMediosPago', sql.Int, idMediosPago)
        .query('SELECT descripcion FROM MediosPago WHERE idMediosPago = @idMediosPago');
    return result.recordset?.[0]?.descripcion || '';
};

/**
 * Obtiene descripción de FormasPago por idFormaPago (para compras que envían idFormaPago en idMediosPago).
 */
exports.obtenerDescripcionFormaPago = async (pool, idFormaPago) => {
    const result = await pool.request()
        .input('idFormaPago', sql.Int, idFormaPago)
        .query('SELECT descripcion FROM FormasPago WHERE idFormaPago = @idFormaPago');
    return result.recordset?.[0]?.descripcion || '';
};

/**
 * Obtiene el código del comprobante (ej. '01' Factura, '03' Boleta) por idComprobante e idEmpresa.
 */
exports.obtenerCodigoComprobante = async (pool, idEmpresa, idComprobante) => {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idComprobante', sql.Int, idComprobante)
        .query("SELECT RTRIM(LTRIM(ISNULL(codigo, ''))) AS codigo FROM Comprobantes WHERE idEmpresa = @idEmpresa AND idComprobante = @idComprobante");
    return result.recordset?.[0]?.codigo || '';
};

/**
 * Inserta una compra. No retorna filas.
 */
exports.crearCompra = async (executor, params) => {
    const req = executor.request()
        .input('idCompra', sql.UniqueIdentifier, params.idCompra)
        .input('idEmpresa', sql.UniqueIdentifier, params.idEmpresa)
        .input('compCompra', sql.VarChar(13), params.compCompra || '')
        .input('idComprobante', sql.Int, params.idComprobante)
        .input('serie', sql.VarChar(4), (params.serie || '').toString().substring(0, 4))
        .input('numero', sql.VarChar(8), (params.numero || '').toString().substring(0, 8))
        .input('fEmision', sql.VarChar(23), params.fEmision)
        .input('fVencimiento', sql.VarChar(23), params.fVencimiento)
        .input('idProveedor', sql.Int, params.idProveedor)
        .input('idMoneda', sql.Int, params.idMoneda)
        .input('idEstadoPago', sql.Int, params.idEstadoPago)
        .input('subTotal', sql.Decimal(18, 2), params.subTotal ?? 0)
        .input('igv', sql.Decimal(18, 2), params.igv ?? 0)
        .input('exonerado', sql.Decimal(18, 2), params.exonerado ?? 0)
        .input('gratuito', sql.Decimal(18, 2), params.gratuito ?? 0)
        .input('otrosCargos', sql.Decimal(18, 2), params.otrosCargos ?? 0)
        .input('descuentos', sql.Decimal(18, 2), params.descuentos ?? 0)
        .input('total', sql.Decimal(18, 2), params.total ?? 0)
        .input('idMediosPago', sql.Int, params.idMediosPago)
        .input('compRelacionado', sql.VarChar(50), params.compRelacionado ?? null)
        .input('idUsuario', sql.UniqueIdentifier, params.idUsuario);
    await req.query(`
        INSERT INTO Compras (idCompra, idEmpresa, compCompra, idComprobante, serie, numero, fEmision, fVencimiento, idProveedor, idMoneda, idEstadoPago, subTotal, igv, exonerado, gratuito, otrosCargos, descuentos, total, idMediosPago, compRelacionado, idUsuario)
        VALUES (@idCompra, @idEmpresa, @compCompra, @idComprobante, @serie, @numero, @fEmision, @fVencimiento, @idProveedor, @idMoneda, @idEstadoPago, @subTotal, @igv, @exonerado, @gratuito, @otrosCargos, @descuentos, @total, @idMediosPago, @compRelacionado, @idUsuario)
    `);
};

/**
 * Actualiza una compra por idEmpresa e idCompra. Retorna rowsAffected.
 */
exports.actualizarCompra = async (pool, params) => {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, params.idEmpresa)
        .input('idcompra', sql.UniqueIdentifier, params.idCompra)
        .input('compCompra', sql.VarChar, params.compCompra ?? '')
        .input('serie', sql.VarChar, params.serie ?? '')
        .input('numero', sql.VarChar, params.numero ?? '')
        .input('fEmision', sql.VarChar(23), params.fEmision)
        .input('fVencimiento', sql.VarChar(23), params.fVencimiento)
        .input('idProveedor', sql.Int, params.idProveedor)
        .input('idMoneda', sql.Int, params.idMoneda ?? 1)
        .input('idEstadoPago', sql.Int, params.idEstadoPago ?? 1)
        .input('subTotal', sql.Decimal(18, 2), params.subTotal ?? 0)
        .input('igv', sql.Decimal(18, 2), params.igv ?? 0)
        .input('exonerado', sql.Decimal(18, 2), params.exonerado ?? 0)
        .input('gratuito', sql.Decimal(18, 2), params.gratuito ?? 0)
        .input('otrosCargos', sql.Decimal(18, 2), params.otrosCargos ?? 0)
        .input('descuentos', sql.Decimal(18, 2), params.descuentos ?? 0)
        .input('total', sql.Decimal(18, 2), params.total ?? 0)
        .input('idMediosPago', sql.Int, params.idMediosPago ?? 1)
        .input('compRelacionado', sql.VarChar, params.compRelacionado ?? '')
        .input('idUsuarioModifica', sql.UniqueIdentifier, params.idUsuarioModifica)
        .query(`
            UPDATE Compras SET compCompra=@compCompra, serie=@serie, numero=@numero, fEmision=ISNULL(@fEmision, fEmision), fVencimiento=@fVencimiento, idProveedor=@idProveedor, idMoneda=@idMoneda, idEstadoPago=@idEstadoPago, subTotal=@subTotal, igv=@igv, exonerado=@exonerado, gratuito=@gratuito, otrosCargos=@otrosCargos, descuentos=@descuentos, total=@total, idMediosPago=@idMediosPago, compRelacionado=@compRelacionado, idUsuarioModifica=@idUsuarioModifica, fModificacion=GETDATE()
            WHERE idEmpresa=@idEmpresa AND idCompra=@idcompra
        `);
    return result.rowsAffected?.[0] ?? 0;
};

/**
 * Elimina una compra por idEmpresa e idCompra. Retorna rowsAffected.
 */
exports.eliminarCompra = async (pool, idEmpresa, idCompra) => {
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        const lotesAsociados = await transaction.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('idCompra', sql.UniqueIdentifier, idCompra)
            .query(`
                SELECT DISTINCT l.idLote, l.cantidadIngresada, l.cantidadDisponible
                FROM Compras c
                INNER JOIN DetalleCompras dc
                    ON dc.idEmpresa = c.idEmpresa
                   AND dc.idCompra = c.idCompra
                INNER JOIN Lotes l
                    ON l.idEmpresa = dc.idEmpresa
                   AND l.idProducto = dc.idProducto
                   AND l.idSucursal = dc.idSucursal
                   AND (
                        (c.numeroLote IS NOT NULL AND l.numeroLote = CONVERT(VARCHAR(50), c.numeroLote))
                        OR (
                            c.numeroLote IS NULL
                            AND CONVERT(DECIMAL(18,3), ISNULL(l.cantidadIngresada, 0)) = CONVERT(DECIMAL(18,3), ISNULL(dc.cantidad, 0))
                            AND CONVERT(DECIMAL(18,6), ISNULL(l.costoUnitario, 0)) = CONVERT(DECIMAL(18,6), ISNULL(dc.pUnitario, 0))
                        )
                   )
                WHERE c.idEmpresa = @idEmpresa
                  AND c.idCompra = @idCompra
            `);

        const lotesConsumidos = (lotesAsociados.recordset || []).filter((r) => {
            const ingresada = Number(r.cantidadIngresada) || 0;
            const disponible = Number(r.cantidadDisponible) || 0;
            return disponible < ingresada;
        });
        if (lotesConsumidos.length > 0) {
            throw new Error('NO_SE_PUEDE_ELIMINAR_COMPRA_STOCK_YA_CONSUMIDO');
        }

        for (const lote of lotesAsociados.recordset || []) {
            await transaction.request()
                .input('idLote', sql.UniqueIdentifier, lote.idLote)
                .query('DELETE FROM LotesUbicacion WHERE idLote = @idLote');
        }

        if ((lotesAsociados.recordset || []).length > 0) {
            await transaction.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('idCompra', sql.UniqueIdentifier, idCompra)
                .query(`
                    DELETE l
                    FROM Lotes l
                    INNER JOIN Compras c
                        ON c.idEmpresa = l.idEmpresa
                    INNER JOIN DetalleCompras dc
                        ON dc.idEmpresa = c.idEmpresa
                       AND dc.idCompra = c.idCompra
                       AND dc.idProducto = l.idProducto
                       AND dc.idSucursal = l.idSucursal
                    WHERE c.idEmpresa = @idEmpresa
                      AND c.idCompra = @idCompra
                      AND (
                            (c.numeroLote IS NOT NULL AND l.numeroLote = CONVERT(VARCHAR(50), c.numeroLote))
                            OR (
                                c.numeroLote IS NULL
                                AND CONVERT(DECIMAL(18,3), ISNULL(l.cantidadIngresada, 0)) = CONVERT(DECIMAL(18,3), ISNULL(dc.cantidad, 0))
                                AND CONVERT(DECIMAL(18,6), ISNULL(l.costoUnitario, 0)) = CONVERT(DECIMAL(18,6), ISNULL(dc.pUnitario, 0))
                            )
                      )
                `);
        }

        await transaction.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('idCompra', sql.UniqueIdentifier, idCompra)
            .query(`
                DELETE FROM ComprobantesElectronicos
                WHERE idEmpresa = @idEmpresa AND idCompra = @idCompra
            `);

        await transaction.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('idCompra', sql.UniqueIdentifier, idCompra)
            .query(`
                DELETE FROM DetalleCompras
                WHERE idEmpresa = @idEmpresa AND idCompra = @idCompra
            `);

        const result = await transaction.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('idCompra', sql.UniqueIdentifier, idCompra)
            .query(`
                DELETE FROM Compras
                WHERE idEmpresa = @idEmpresa AND idCompra = @idCompra
            `);

        await transaction.commit();
        return result.rowsAffected?.[0] ?? 0;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Lista compCompra por idProveedor e idEmpresa.
 */
exports.listarComprobantesPorProveedor = async (pool, idEmpresa, idProveedor) => {
    const result = await pool.request()
        .input('idProveedor', sql.Int, idProveedor)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query('SELECT compCompra FROM Compras WHERE idProveedor = @idProveedor AND idEmpresa = @idEmpresa');
    return result.recordset || [];
};

// --- BorradorCompras ---

exports.listarBorradorCompras = async (pool, idEmpresa) => {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query('SELECT * FROM BorradorCompras WHERE idEmpresa = @idEmpresa');
    return result.recordset || [];
};

exports.crearBorradorCompra = async (pool, params) => {
    await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, params.idEmpresa)
        .input('Cantidad', sql.Decimal(18, 3), params.Cantidad)
        .input('Codigo', sql.VarChar(50), params.Codigo)
        .input('Categoria', sql.VarChar(50), params.Categoria)
        .input('Descripcion', sql.VarChar(200), params.Descripcion)
        .input('Presentacion', sql.VarChar(20), params.Presentacion)
        .input('CUnitario', sql.Decimal(18, 5), params.CUnitario)
        .input('FProduccion', sql.VarChar(10), params.FProduccion)
        .input('FVencimiento', sql.VarChar(10), params.FVencimiento)
        .input('Ubicacion', sql.VarChar(20), params.Ubicacion)
        .input('Total', sql.Decimal(18, 2), params.Total)
        .input('Serie_Numero', sql.Char(13), params.Serie_Numero)
        .input('Razon_Social', sql.VarChar(200), params.Razon_Social)
        .query(`
            INSERT INTO BorradorCompras (idEmpresa, Cantidad, Codigo, Categoria, Descripcion, Presentacion, CUnitario, FProduccion, FVencimiento, Ubicacion, Total, Serie_Numero, Razon_Social)
            VALUES (@idEmpresa, @Cantidad, @Codigo, @Categoria, @Descripcion, @Presentacion, @CUnitario, @FProduccion, @FVencimiento, @Ubicacion, @Total, @Serie_Numero, @Razon_Social)
        `);
};

exports.actualizarBorradorCompra = async (pool, params) => {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, params.idEmpresa)
        .input('Cantidad', sql.Decimal(18, 3), params.Cantidad)
        .input('Codigo', sql.VarChar(50), params.Codigo)
        .input('Categoria', sql.VarChar(50), params.Categoria)
        .input('Descripcion', sql.VarChar(200), params.Descripcion)
        .input('Presentacion', sql.VarChar(20), params.Presentacion)
        .input('CUnitario', sql.Decimal(18, 5), params.CUnitario)
        .input('FProduccion', sql.VarChar(10), params.FProduccion)
        .input('FVencimiento', sql.VarChar(10), params.FVencimiento)
        .input('Ubicacion', sql.VarChar(20), params.Ubicacion)
        .input('Total', sql.Decimal(18, 2), params.Total)
        .input('Serie_Numero', sql.Char(13), params.Serie_Numero)
        .input('Razon_Social', sql.VarChar(200), params.Razon_Social)
        .query(`
            UPDATE BorradorCompras SET Cantidad = @Cantidad, Codigo = @Codigo, Categoria = @Categoria, Descripcion = @Descripcion, Presentacion = @Presentacion, CUnitario = @CUnitario, FProduccion = @FProduccion, FVencimiento = @FVencimiento, Ubicacion = @Ubicacion, Total = @Total, Razon_Social = @Razon_Social
            WHERE idEmpresa = @idEmpresa AND Serie_Numero = @Serie_Numero
        `);
    return result.rowsAffected?.[0] ?? 0;
};

exports.eliminarBorradorCompras = async (pool, idEmpresa) => {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query('DELETE FROM BorradorCompras WHERE idEmpresa = @idEmpresa');
    return result.rowsAffected?.[0] ?? 0;
};

// --- Correlativos ---

exports.listarCorrelativos = async (pool, idEmpresa) => {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query('SELECT * FROM Correlativos WHERE idEmpresa = @idEmpresa');
    return result.recordset || [];
};

exports.actualizarCorrelativo = async (pool, idEmpresa, idCorrelativo, numero) => {
    const result = await pool.request()
        .input('idCorrelativo', sql.Int, idCorrelativo)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('numero', sql.Int, numero)
        .query('UPDATE Correlativos SET numero = @numero WHERE idEmpresa = @idEmpresa AND idCorrelativo = @idCorrelativo');
    return result.rowsAffected?.[0] ?? 0;
};

/**
 * Proveedor de la compra (razón social SUNAT / maestro) para completar ComprobantesCompraSunat.
 * @param {import('mssql').ConnectionPool|import('mssql').Transaction} executor
 */
exports.obtenerProveedorRucRSocialPorCompra = async (executor, idEmpresa, idCompra) => {
    const result = await executor.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idCompra', sql.UniqueIdentifier, idCompra)
        .query(`
            SELECT P.ruc AS rucProveedor, P.rSocial
            FROM dbo.Compras C
            INNER JOIN dbo.Proveedores P ON P.idProveedor = C.idProveedor
            WHERE C.idEmpresa = @idEmpresa AND C.idCompra = @idCompra
        `);
    return result.recordset?.[0] || null;
};
