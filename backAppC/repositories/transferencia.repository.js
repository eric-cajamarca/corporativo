const sql = require('mssql');

// Primero, crear tabla de detalles si no existe
exports.crearTablaDetalles = async (pool) => {
    try {
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='MovimientosDetalle' AND xtype='U')
            CREATE TABLE MovimientosDetalle (
                idDetalle INT IDENTITY(1,1) PRIMARY KEY,
                idMovimiento INT NOT NULL,
                idProducto UNIQUEIDENTIFIER NOT NULL,
                cantidad DECIMAL(18,3) NOT NULL,
                tipo VARCHAR(10) NOT NULL, -- SALIDA, ENTRADA, REVERSION
                FOREIGN KEY (idMovimiento) REFERENCES MovimientosInventario(idMovimiento),
                FOREIGN KEY (idProducto) REFERENCES Productos(idProducto)
            )
        `);
        return { success: true, message: 'Tabla de detalles creada' };
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.crearMovimiento = async (transaction, datos) => {
    try {
        const { 
            idEmpresa, 
            idSucursal, 
            tipoMovimiento, 
            docRelacionado, 
            idUsuario, 
            observaciones,
            idMovimientoRelacionado 
        } = datos;

        const request = transaction.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .input('tipoMovimiento', sql.VarChar(2), tipoMovimiento)
            .input('docRelacionado', sql.VarChar(20), docRelacionado)
            .input('idUsuario', sql.UniqueIdentifier, idUsuario)
            .input('observaciones', sql.VarChar(255), observaciones);

        let query = `
            INSERT INTO MovimientosInventario 
            (idEmpresa, idSucursal, tipoMovimiento, docRelacionado, idUsuario, observaciones)
            OUTPUT INSERTED.idMovimiento
            VALUES (@idEmpresa, @idSucursal, @tipoMovimiento, @docRelacionado, @idUsuario, @observaciones)
        `;

        if (idMovimientoRelacionado) {
            request.input('idMovimientoRelacionado', sql.Int, idMovimientoRelacionado);
            query = `
                INSERT INTO MovimientosInventario 
                (idEmpresa, idSucursal, tipoMovimiento, docRelacionado, idUsuario, observaciones, idComprobante)
                OUTPUT INSERTED.idMovimiento
                VALUES (@idEmpresa, @idSucursal, @tipoMovimiento, @docRelacionado, @idUsuario, @observaciones, @idMovimientoRelacionado)
            `;
        }

        const result = await request.query(query);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.agregarDetalleMovimiento = async (transaction, datos) => {
    try {
        const { idMovimiento, idProducto, cantidad, tipo } = datos;

        const result = await transaction.request()
            .input('idMovimiento', sql.Int, idMovimiento)
            .input('idProducto', sql.UniqueIdentifier, idProducto)
            .input('cantidad', sql.Decimal(18,3), cantidad)
            .input('tipo', sql.VarChar(10), tipo)
            .query(`
                INSERT INTO MovimientosDetalle (idMovimiento, idProducto, cantidad, tipo)
                VALUES (@idMovimiento, @idProducto, @cantidad, @tipo)
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerStockProducto = async (transaction, idProducto, idSucursal, idEmpresa) => {
    try {
        const result = await transaction.request()
            .input('idProducto', sql.UniqueIdentifier, idProducto)
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT cantidad
                FROM StockSucursal
                WHERE idProducto = @idProducto
                AND idSucursal = @idSucursal
                AND idEmpresa = @idEmpresa
            `);
        
        return result.recordset[0] || null;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.ajustarStock = async (transaction, datos) => {
    try {
        const { 
            idEmpresa, 
            idSucursal, 
            idProducto, 
            cantidad,
            idUsuario,
            tipoMovimiento,
            idMovimiento,
            observaciones 
        } = datos;

        // Verificar si existe registro en StockSucursal
        const existe = await transaction.request()
            .input('idProducto', sql.UniqueIdentifier, idProducto)
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT COUNT(*) as existe
                FROM StockSucursal
                WHERE idProducto = @idProducto
                AND idSucursal = @idSucursal
                AND idEmpresa = @idEmpresa
            `);

        if (existe.recordset[0].existe > 0) {
            // Actualizar stock existente
            const result = await transaction.request()
                .input('idProducto', sql.UniqueIdentifier, idProducto)
                .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('cantidad', sql.Decimal(18,3), cantidad)
                .input('idUsuario', sql.UniqueIdentifier, idUsuario)
                .query(`
                    UPDATE StockSucursal 
                    SET cantidad = cantidad + @cantidad,
                        idUsuario = @idUsuario,
                        fIngreso = GETDATE()
                    WHERE idProducto = @idProducto
                    AND idSucursal = @idSucursal
                    AND idEmpresa = @idEmpresa
                `);
            
            return result;
        } else {
            // Insertar nuevo registro (si cantidad es positiva)
            if (cantidad > 0) {
                const result = await transaction.request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                    .input('idProducto', sql.UniqueIdentifier, idProducto)
                    .input('cantidad', sql.Decimal(18,3), cantidad)
                    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
                    .query(`
                        INSERT INTO StockSucursal 
                        (idEmpresa, idSucursal, idProducto, cantidad, idUsuario)
                        VALUES (@idEmpresa, @idSucursal, @idProducto, @cantidad, @idUsuario)
                    `);
                
                return result;
            } else {
                throw new Error('NO_EXISTE_STOCK_PARA_RESTAR');
            }
        }
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerSucursal = async (transaction, idSucursal, idEmpresa) => {
    try {
        const result = await transaction.request()
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT idSucursal, nombre, estado
                FROM Sucursal
                WHERE idSucursal = @idSucursal
                AND idEmpresa = @idEmpresa
            `);
        
        return result.recordset[0] || null;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerProducto = async (transaction, idProducto, idEmpresa) => {
    try {
        const result = await transaction.request()
            .input('idProducto', sql.UniqueIdentifier, idProducto)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT idProducto, codigo, descripcion, estado
                FROM Productos
                WHERE idProducto = @idProducto
                AND idEmpresa = @idEmpresa
                AND estado = 1
            `);
        
        return result.recordset[0] || null;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.actualizarMovimientoRelacionado = async (transaction, idMovimiento, idMovimientoRelacionado) => {
    try {
        const result = await transaction.request()
                    .input('idMovimiento', sql.Int, idMovimiento)
            .input('idMovimientoRelacionado', sql.Int, idMovimientoRelacionado)
            .query(`
                UPDATE MovimientosInventario 
                SET idComprobante = @idMovimientoRelacionado
                WHERE idMovimiento = @idMovimiento
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerTransferencias = async (pool, filtros) => {
    try {
        const { idEmpresa, fechaInicio, fechaFin, idSucursal, estado } = filtros;

        let query = `
            SELECT 
                m.idMovimiento,
                m.idSucursal,
                s.nombre as sucursal,
                m.tipoMovimiento,
                m.docRelacionado,
                m.fMovimiento,
                m.observaciones,
                u.nombre as usuario,
                m.idComprobante as idMovimientoRelacionado,
                sr.nombre as sucursalRelacionada,
                COUNT(DISTINCT md.idProducto) as totalProductos,
                SUM(md.cantidad) as totalCantidad,
                CASE 
                    WHEN m.idComprobante IS NOT NULL THEN 'COMPLETADO'
                    ELSE 'PENDIENTE'
                END as estado
            FROM MovimientosInventario m
            INNER JOIN Sucursal s ON m.idSucursal = s.idSucursal
            INNER JOIN UsuarioWeb u ON m.idUsuario = u.idUsuario
            LEFT JOIN MovimientosDetalle md ON m.idMovimiento = md.idMovimiento
            LEFT JOIN MovimientosInventario mr ON m.idComprobante = mr.idMovimiento
            LEFT JOIN Sucursal sr ON mr.idSucursal = sr.idSucursal
            WHERE m.idEmpresa = @idEmpresa
            AND m.tipoMovimiento = 'TR'
        `;

        const request = pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa);

        if (fechaInicio) {
            request.input('fechaInicio', sql.DateTime, fechaInicio);
            query += ` AND m.fMovimiento >= @fechaInicio`;
        }

        if (fechaFin) {
            request.input('fechaFin', sql.DateTime, fechaFin);
            query += ` AND m.fMovimiento <= @fechaFin`;
        }

        if (idSucursal) {
            request.input('idSucursal', sql.UniqueIdentifier, idSucursal);
            query += ` AND m.idSucursal = @idSucursal`;
        }

        if (estado === 'COMPLETADO') {
            query += ` AND m.idComprobante IS NOT NULL`;
        } else if (estado === 'PENDIENTE') {
            query += ` AND m.idComprobante IS NULL`;
        }

        query += `
            GROUP BY 
                m.idMovimiento, m.idSucursal, s.nombre, m.tipoMovimiento,
                m.docRelacionado, m.fMovimiento, m.observaciones, u.nombre,
                m.idComprobante, sr.nombre
            ORDER BY m.fMovimiento DESC
        `;

        const result = await request.query(query);
        
        return result.recordset;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerTransferenciaPorId = async (pool, idMovimiento, idEmpresa) => {
    try {
        const result = await pool.request()
            .input('idMovimiento', sql.Int, idMovimiento)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT 
                    m.idMovimiento,
                    m.idSucursal,
                    s.nombre as sucursal,
                    m.tipoMovimiento,
                    m.docRelacionado,
                    m.fMovimiento,
                    m.observaciones,
                    m.idUsuario,
                    u.nombre as usuario,
                    m.idComprobante as idMovimientoRelacionado,
                    CASE 
                        WHEN m.idComprobante IS NOT NULL THEN 1
                        ELSE 0
                    END as revertido
                FROM MovimientosInventario m
                INNER JOIN Sucursal s ON m.idSucursal = s.idSucursal
                INNER JOIN UsuarioWeb u ON m.idUsuario = u.idUsuario
                WHERE m.idMovimiento = @idMovimiento
                AND m.idEmpresa = @idEmpresa
                AND m.tipoMovimiento = 'TR'
            `);
        
        return result.recordset[0] || null;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerDetallesTransferencia = async (pool, idMovimiento) => {
    try {
        const result = await pool.request()
            .input('idMovimiento', sql.Int, idMovimiento)
            .query(`
                SELECT 
                    md.idDetalle,
                    md.idProducto,
                    p.codigo,
                    p.descripcion,
                    md.cantidad,
                    md.tipo,
                    COALESCE(pr.codigo, '') as presentacion,
                    COALESCE(m.nombre, '') as marca
                FROM MovimientosDetalle md
                INNER JOIN Productos p ON md.idProducto = p.idProducto
                LEFT JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
                LEFT JOIN Marcas m ON p.idMarca = m.idMarca
                WHERE md.idMovimiento = @idMovimiento
                ORDER BY p.descripcion
            `);
        
        return result.recordset;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerMovimientoRelacionado = async (pool, idMovimiento, idEmpresa) => {
    try {
        const result = await pool.request()
            .input('idMovimiento', sql.Int, idMovimiento)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT 
                    m.idMovimiento,
                    m.idSucursal,
                    s.nombre as sucursal,
                    m.tipoMovimiento,
                    m.fMovimiento,
                    m.observaciones
                FROM MovimientosInventario m
                INNER JOIN Sucursal s ON m.idSucursal = s.idSucursal
                WHERE m.idMovimiento = @idMovimiento
                AND m.idEmpresa = @idEmpresa
            `);
        
        return result.recordset[0] || null;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.marcarComoRevertido = async (transaction, idMovimiento, idMovimientoReversion) => {
    try {
        const result = await transaction.request()
            .input('idMovimiento', sql.Int, idMovimiento)
            .input('idMovimientoReversion', sql.Int, idMovimientoReversion)
            .query(`
                UPDATE MovimientosInventario 
                SET idComprobante = @idMovimientoReversion
                WHERE idMovimiento = @idMovimiento
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

// Método adicional para obtener historial de stock por producto/sucursal
exports.obtenerHistorialStock = async (pool, idProducto, idSucursal, idEmpresa, fechaInicio, fechaFin) => {
    try {
        let query = `
            SELECT 
                m.idMovimiento,
                m.tipoMovimiento,
                m.fMovimiento,
                md.cantidad,
                m.observaciones,
                u.nombre as usuario,
                s.nombre as sucursal,
                CASE 
                    WHEN m.tipoMovimiento LIKE 'TR_ENTRADA%' OR m.tipoMovimiento = 'EN' THEN 'ENTRADA'
                    WHEN m.tipoMovimiento LIKE 'TR_SALIDA%' OR m.tipoMovimiento = 'SA' THEN 'SALIDA'
                    WHEN m.tipoMovimiento LIKE 'TR_REVERSION%' THEN 'REVERSION'
                    ELSE m.tipoMovimiento
                END as tipo,
                CASE 
                    WHEN m.tipoMovimiento LIKE 'TR_ENTRADA%' OR m.tipoMovimiento = 'EN' THEN md.cantidad
                    WHEN m.tipoMovimiento LIKE 'TR_SALIDA%' OR m.tipoMovimiento = 'SA' THEN -md.cantidad
                    WHEN m.tipoMovimiento LIKE 'TR_REVERSION%' THEN 
                        CASE 
                            WHEN m.observaciones LIKE '%Reversión a%' THEN md.cantidad
                            ELSE -md.cantidad
                        END
                    ELSE 0
                END as cantidadAjuste
            FROM MovimientosDetalle md
            INNER JOIN MovimientosInventario m ON md.idMovimiento = m.idMovimiento
            INNER JOIN Sucursal s ON m.idSucursal = s.idSucursal
            INNER JOIN UsuarioWeb u ON m.idUsuario = u.idUsuario
            WHERE md.idProducto = @idProducto
            AND m.idEmpresa = @idEmpresa
        `;

        const request = pool.request()
            .input('idProducto', sql.UniqueIdentifier, idProducto)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa);

        if (idSucursal) {
            request.input('idSucursal', sql.UniqueIdentifier, idSucursal);
            query += ` AND m.idSucursal = @idSucursal`;
        }

        if (fechaInicio) {
            request.input('fechaInicio', sql.DateTime, fechaInicio);
            query += ` AND m.fMovimiento >= @fechaInicio`;
        }

        if (fechaFin) {
            request.input('fechaFin', sql.DateTime, fechaFin);
            query += ` AND m.fMovimiento <= @fechaFin`;
        }

        query += ` ORDER BY m.fMovimiento DESC`;

        const result = await request.query(query);
        
        return result.recordset;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

// Método para obtener resumen de transferencias por período
exports.obtenerResumenTransferencias = async (pool, idEmpresa, fechaInicio, fechaFin) => {
    try {
        const result = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('fechaInicio', sql.DateTime, fechaInicio)
            .input('fechaFin', sql.DateTime, fechaFin)
            .query(`
                SELECT 
                    CONVERT(DATE, m.fMovimiento) as fecha,
                    COUNT(DISTINCT m.idMovimiento) as totalTransferencias,
                    COUNT(DISTINCT md.idProducto) as totalProductos,
                    SUM(md.cantidad) as totalCantidad,
                    COUNT(DISTINCT m.idSucursal) as sucursalesInvolucradas
                FROM MovimientosInventario m
                INNER JOIN MovimientosDetalle md ON m.idMovimiento = md.idMovimiento
                WHERE m.idEmpresa = @idEmpresa
                AND m.tipoMovimiento = 'TR'
                AND m.fMovimiento >= @fechaInicio
                AND m.fMovimiento <= @fechaFin
                GROUP BY CONVERT(DATE, m.fMovimiento)
                ORDER BY fecha DESC
            `);
        
        return result.recordset;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};