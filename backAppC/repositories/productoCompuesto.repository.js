const sql = require('mssql');

exports.crearComponente = async (pool, datos) => {
    try {
        const { idProductoPadre, idProductoHijo, cantidad, idUsuario } = datos;

        const result = await pool
            .request()
            .input('idProductoPadre', sql.UniqueIdentifier, idProductoPadre)
            .input('idProductoHijo', sql.UniqueIdentifier, idProductoHijo)
            .input('cantidad', sql.Int, cantidad)
            .query(`
                INSERT INTO ProductosCompuestos (idProductoPadre, idProductoHijo, cantidad)
                VALUES (@idProductoPadre, @idProductoHijo, @cantidad)
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerComponentes = async (pool, idProductoPadre, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idProductoPadre', sql.UniqueIdentifier, idProductoPadre)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT 
                    pc.idProductoCompuesto,
                    pc.idProductoHijo,
                    p.codigo,
                    p.descripcion,
                    pc.cantidad,
                    pr.codigo as presentacion,
                    m.nombre as marca
                FROM ProductosCompuestos pc
                INNER JOIN Productos p ON pc.idProductoHijo = p.idProducto
                LEFT JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
                LEFT JOIN Marcas m ON p.idMarca = m.idMarca
                WHERE pc.idProductoPadre = @idProductoPadre
                AND p.idEmpresa = @idEmpresa
                ORDER BY p.descripcion
            `);
        
        return result.recordset;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerProductoPorId = async (pool, idProducto, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idProducto', sql.UniqueIdentifier, idProducto)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT idProducto, codigo, descripcion, tipoProducto, estado
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

exports.eliminarComponentes = async (pool, idProductoPadre, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idProductoPadre', sql.UniqueIdentifier, idProductoPadre)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                DELETE pc
                FROM ProductosCompuestos pc
                INNER JOIN Productos p ON pc.idProductoPadre = p.idProducto
                WHERE pc.idProductoPadre = @idProductoPadre
                AND p.idEmpresa = @idEmpresa
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.calcularStockCompuestoRepo = async (pool, idProductoPadre, idEmpresa, idSucursal = null) => {
    try {
        // Construir consulta dinámica para sucursal
        let filtroSucursal = '';
        let params = [
            { name: 'idProductoPadre', type: sql.UniqueIdentifier, value: idProductoPadre },
            { name: 'idEmpresa', type: sql.UniqueIdentifier, value: idEmpresa }
        ];

        if (idSucursal) {
            filtroSucursal = 'AND ss.idSucursal = @idSucursal';
            params.push({ name: 'idSucursal', type: sql.UniqueIdentifier, value: idSucursal });
        }

        const request = pool.request();
        params.forEach(param => request.input(param.name, param.type, param.value));

        const result = await request.query(`
            SELECT 
                s.idSucursal,
                s.nombre as sucursal,
                MIN(COALESCE(ss.cantidad, 0) / pc.cantidad) as stockDisponible,
                COUNT(pc.idProductoHijo) as totalComponentes,
                SUM(CASE WHEN COALESCE(ss.cantidad, 0) >= pc.cantidad THEN 1 ELSE 0 END) as componentesConStock
            FROM ProductosCompuestos pc
            INNER JOIN Productos p ON pc.idProductoHijo = p.idProducto
            CROSS JOIN Sucursal s
            LEFT JOIN StockSucursal ss ON p.idProducto = ss.idProducto 
                AND s.idSucursal = ss.idSucursal
                AND ss.idEmpresa = @idEmpresa
            WHERE pc.idProductoPadre = @idProductoPadre
            AND s.idEmpresa = @idEmpresa
            AND s.estado = 1
            ${filtroSucursal}
            GROUP BY s.idSucursal, s.nombre
            ORDER BY s.nombre
        `);
        
        // Si es para una sucursal específica, calcular stock mínimo
        if (idSucursal && result.recordset.length > 0) {
            const stockMinimo = Math.floor(result.recordset[0].stockDisponible);
            return {
                sucursales: result.recordset,
                stockMinimo: stockMinimo,
                tieneStockSuficiente: stockMinimo > 0
            };
        }
        
        return {
            sucursales: result.recordset,
            stockMinimo: 0,
            tieneStockSuficiente: false
        };
        
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.verificarComponentesEnStock = async (pool, idProductoPadre, cantidadRequerida, idSucursal, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idProductoPadre', sql.UniqueIdentifier, idProductoPadre)
            .input('cantidadRequerida', sql.Int, cantidadRequerida)
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT 
                    pc.idProductoHijo,
                    p.descripcion,
                    pc.cantidad as cantidadNecesaria,
                    COALESCE(ss.cantidad, 0) as stockActual,
                    (COALESCE(ss.cantidad, 0) - (pc.cantidad * @cantidadRequerida)) as stockRestante,
                    CASE 
                        WHEN COALESCE(ss.cantidad, 0) >= (pc.cantidad * @cantidadRequerida) 
                        THEN 1 ELSE 0 
                    END as tieneStock
                FROM ProductosCompuestos pc
                INNER JOIN Productos p ON pc.idProductoHijo = p.idProducto
                LEFT JOIN StockSucursal ss ON p.idProducto = ss.idProducto 
                    AND ss.idSucursal = @idSucursal
                    AND ss.idEmpresa = @idEmpresa
                WHERE pc.idProductoPadre = @idProductoPadre
                AND p.idEmpresa = @idEmpresa
            `);
        
        const tieneStockTotal = result.recordset.every(item => item.tieneStock === 1);
        
        return {
            componentes: result.recordset,
            tieneStock: tieneStockTotal,
            stockInsuficiente: result.recordset.filter(item => item.tieneStock === 0)
        };
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};