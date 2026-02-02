const sql = require('mssql');

// Crear tablas necesarias (ejecutar una sola vez)
// exports.crearTablasVariantes = async (pool) => {
//     try {
//         // Tabla de atributos (Talla, Color, etc.)
//         await pool.request().query(`
//             IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AtributosProducto' AND xtype='U')
//             CREATE TABLE AtributosProducto (
//                 idAtributo INT IDENTITY(1,1) PRIMARY KEY,
//                 nombre VARCHAR(50) NOT NULL,
//                 tipo VARCHAR(20) DEFAULT 'text',
//                 idEmpresa UNIQUEIDENTIFIER NOT NULL,
//                 idUsuario UNIQUEIDENTIFIER,
//                 fCreacion DATETIME DEFAULT GETDATE(),
//                 estado BIT DEFAULT 1,
//                 FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa),
//                 FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario)
//             )
//         `);

//         // Tabla de valores de atributos
//         await pool.request().query(`
//             IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ValoresAtributo' AND xtype='U')
//             CREATE TABLE ValoresAtributo (
//                 idValor INT IDENTITY(1,1) PRIMARY KEY,
//                 idAtributo INT NOT NULL,
//                 valor VARCHAR(50) NOT NULL,
//                 idUsuario UNIQUEIDENTIFIER,
//                 fCreacion DATETIME DEFAULT GETDATE(),
//                 estado BIT DEFAULT 1,
//                 FOREIGN KEY (idAtributo) REFERENCES AtributosProducto(idAtributo),
//                 FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario)
//             )
//         `);

//         // Tabla de variantes
//         await pool.request().query(`
//             IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VariantesProducto' AND xtype='U')
//             CREATE TABLE VariantesProducto (
//                 idVariante UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
//                 idProductoBase UNIQUEIDENTIFIER NOT NULL,
//                 sku VARCHAR(50) NOT NULL UNIQUE,
//                 precio DECIMAL(18,5) NULL,
//                 idUsuario UNIQUEIDENTIFIER,
//                 fCreacion DATETIME DEFAULT GETDATE(),
//                 estado BIT DEFAULT 1,
//                 FOREIGN KEY (idProductoBase) REFERENCES Productos(idProducto),
//                 FOREIGN KEY (idUsuario) REFERENCES UsuarioWeb(idUsuario)
//             )
//         `);

//         // Tabla para asociar atributos a variantes
//         await pool.request().query(`
//             IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VarianteAtributos' AND xtype='U')
//             CREATE TABLE VarianteAtributos (
//                 idVarianteAtributo INT IDENTITY(1,1) PRIMARY KEY,
//                 idVariante UNIQUEIDENTIFIER NOT NULL,
//                 idAtributo INT NOT NULL,
//                 idValor INT NOT NULL,
//                 FOREIGN KEY (idVariante) REFERENCES VariantesProducto(idVariante),
//                 FOREIGN KEY (idAtributo) REFERENCES AtributosProducto(idAtributo),
//                 FOREIGN KEY (idValor) REFERENCES ValoresAtributo(idValor),
//                 CONSTRAINT UQ_VarianteAtributo UNIQUE (idVariante, idAtributo)
//             )
//         `);

//         return { success: true, message: 'Tablas de variantes creadas' };
//     } catch (error) {
//         throw new Error(`Repository Error: ${error.message}`);
//     }
// };

exports.crearVariante = async (pool, datos) => {
    try {
        const { idProductoBase, sku, precio, idUsuario } = datos;

        const result = await pool
            .request()
            .input('idProductoBase', sql.UniqueIdentifier, idProductoBase)
            .input('sku', sql.VarChar(50), sku)
            .input('precio', sql.Decimal(18,5), precio)
            .query(`
                INSERT INTO VariantesProducto (idProductoBase, sku, precio)
                OUTPUT INSERTED.idVariante
                VALUES (@idProductoBase, @sku, @precio)
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerVariantesProducto = async (pool, idProductoBase, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idProductoBase', sql.UniqueIdentifier, idProductoBase)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT 
                    v.idVariante,
                    v.sku,
                    v.precio,
                    p.estado,
                    p.codigo as codigoBase,
                    p.descripcion as productoBase
                FROM VariantesProducto v
                INNER JOIN Productos p ON v.idProductoBase = p.idProducto
                WHERE v.idProductoBase = @idProductoBase
                AND p.idEmpresa = @idEmpresa
                AND p.estado = 1
                ORDER BY v.sku
            `);
        
        return result.recordset;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerVariantePorId = async (pool, idVariante, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idVariante', sql.UniqueIdentifier, idVariante)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT 
                    v.idVariante,
                    v.sku,
                    v.precio,
                    v.idProductoBase,
                    p.codigo as codigoBase,
                    p.descripcion as productoBase
                FROM VariantesProducto v
                INNER JOIN Productos p ON v.idProductoBase = p.idProducto
                WHERE v.idVariante = @idVariante
                AND p.idEmpresa = @idEmpresa
            `);
        
        return result.recordset[0] || null;
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

exports.verificarSkuExistente = async (pool, sku, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('sku', sql.VarChar(50), sku)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT COUNT(*) as existe
                FROM VariantesProducto v
                INNER JOIN Productos p ON v.idProductoBase = p.idProducto
                WHERE v.sku = @sku
                AND p.idEmpresa = @idEmpresa
            `);
        
        return result.recordset[0].existe > 0;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.asociarAtributoVariante = async (pool, datos) => {
    try {
        const { idVariante, idAtributo, idValor } = datos;

        const result = await pool
            .request()
            .input('idVariante', sql.UniqueIdentifier, idVariante)
            .input('idAtributo', sql.Int, idAtributo)
            .input('idValor', sql.Int, idValor)
            .query(`
                INSERT INTO VarianteAtributos (idVariante, idAtributo, idValor)
                VALUES (@idVariante, @idAtributo, @idValor)
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerAtributosVariante = async (pool, idVariante) => {
    try {
        const result = await pool
            .request()
            .input('idVariante', sql.UniqueIdentifier, idVariante)
            .query(`
                SELECT 
                    a.idAtributo,
                    a.nombre as atributo,
                    v.idValor,
                    v.valor
                FROM VarianteAtributos va
                INNER JOIN AtributosProducto a ON va.idAtributo = a.idAtributo
                INNER JOIN ValoresAtributo v ON va.idValor = v.idValor
                WHERE va.idVariante = @idVariante
            `);
        
        return result.recordset;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerAtributosProducto = async (pool, idProductoBase, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idProductoBase', sql.UniqueIdentifier, idProductoBase)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT DISTINCT
                    a.idAtributo,
                    a.nombre,
                    a.idEmpresa,
                    (
                        SELECT va.idValor, va.valor
                        FROM ValoresAtributo va
                        WHERE va.idAtributo = a.idAtributo
                        FOR JSON PATH
                    ) as valores
                FROM AtributosProducto a
                LEFT JOIN VarianteAtributos va ON a.idAtributo = va.idAtributo
                LEFT JOIN VariantesProducto v ON va.idVariante = v.idVariante
                WHERE a.idEmpresa = @idEmpresa
                AND (v.idProductoBase = @idProductoBase OR v.idProductoBase IS NULL)
                ORDER BY a.nombre
            `);
        
        // Procesar resultados JSON
        const atributos = result.recordset.map(attr => ({
            ...attr,
            valores: attr.valores ? JSON.parse(attr.valores) : []
        }));
        
        return atributos;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.verificarAtributoValor = async (pool, idAtributo, idValor, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idAtributo', sql.Int, idAtributo)
            .input('idValor', sql.Int, idValor)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT COUNT(*) as existe
                FROM ValoresAtributo v
                INNER JOIN AtributosProducto a ON v.idAtributo = a.idAtributo
                WHERE v.idValor = @idValor
                AND v.idAtributo = @idAtributo
                AND a.idEmpresa = @idEmpresa

            `);
        
        return result.recordset[0].existe > 0;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.actualizarVariante = async (pool, datos) => {
    try {
        const { idVariante, sku, precio, idUsuario } = datos;

        const request = pool.request()
            .input('idVariante', sql.UniqueIdentifier, idVariante)
            .input('idUsuario', sql.UniqueIdentifier, idUsuario);

        let query = 'UPDATE VariantesProducto SET idUsuario = @idUsuario';
        
        if (sku) {
            request.input('sku', sql.VarChar(50), sku);
            query += ', sku = @sku';
        }
        
        if (precio !== undefined) {
            request.input('precio', sql.Decimal(18,5), precio);
            query += ', precio = @precio';
        }
        
        query += ' WHERE idVariante = @idVariante';
        
        const result = await request.query(query);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.eliminarAtributosVariante = async (pool, idVariante) => {
    try {
        const result = await pool
            .request()
            .input('idVariante', sql.UniqueIdentifier, idVariante)
            .query(`
                DELETE FROM VarianteAtributos 
                WHERE idVariante = @idVariante
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.eliminarVariante = async (pool, idVariante, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idVariante', sql.UniqueIdentifier, idVariante)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                DELETE v
                FROM VariantesProducto v
                INNER JOIN Productos p ON v.idProductoBase = p.idProducto
                WHERE v.idVariante = @idVariante
                AND p.idEmpresa = @idEmpresa
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.verificarStockVariante = async (pool, idVariante, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idVariante', sql.UniqueIdentifier, idVariante)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT 
                    COALESCE(SUM(l.cantidadDisponible), 0) as totalStock,
                    COUNT(DISTINCT l.idSucursal) as sucursalesConStock
                FROM Lotes l
                INNER JOIN VariantesProducto v ON l.idProducto = v.idVariante
                INNER JOIN Productos p ON v.idProductoBase = p.idProducto
                WHERE v.idVariante = @idVariante
                AND l.idEmpresa = @idEmpresa
                AND l.cantidadDisponible > 0
            `);
        
        return result.recordset[0];
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerStockVariante = async (pool, idVariante, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idVariante', sql.UniqueIdentifier, idVariante)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT 
                    s.idSucursal,
                    s.nombre as sucursal,
                    COALESCE(SUM(l.cantidadDisponible), 0) as cantidad,
                    MAX(l.fechaIngreso) as fIngreso,
                    NULL as ubicacion
                FROM Sucursal s
                LEFT JOIN Lotes l ON s.idSucursal = l.idSucursal 
                    AND l.idProducto = @idVariante
                    AND l.idEmpresa = @idEmpresa
                    AND l.cantidadDisponible > 0
                WHERE s.idEmpresa = @idEmpresa
                AND s.estado = 1
                GROUP BY s.idSucursal, s.nombre
                ORDER BY s.nombre
            `);
        
        return result.recordset;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

// Métodos para atributos
exports.crearAtributo = async (pool, datos) => {
    try {
        const { nombre, tipo, idEmpresa, idUsuario } = datos;

        const result = await pool
            .request()
            .input('nombre', sql.VarChar(50), nombre)
            .input('tipo', sql.VarChar(20), tipo || 'text')
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('idUsuario', sql.UniqueIdentifier, idUsuario)
            .query(`
                INSERT INTO AtributosProducto (nombre, tipo, idEmpresa, idUsuario)
                OUTPUT INSERTED.idAtributo
                VALUES (@nombre, @tipo, @idEmpresa, @idUsuario)
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.agregarValorAtributo = async (pool, datos) => {
    try {
        const { idAtributo, valor, idUsuario } = datos;

        const result = await pool
            .request()
            .input('idAtributo', sql.Int, idAtributo)
            .input('valor', sql.VarChar(50), valor)
            .input('idUsuario', sql.UniqueIdentifier, idUsuario)
            .query(`
                INSERT INTO ValoresAtributo (idAtributo, valor, idUsuario)
                OUTPUT INSERTED.idValor
                VALUES (@idAtributo, @valor, @idUsuario)
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerAtributosEmpresa = async (pool, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT 
                    a.idAtributo,
                    a.nombre,
                    a.tipo,
                    (
                        SELECT v.idValor, v.valor
                        FROM ValoresAtributo v
                        WHERE v.idAtributo = a.idAtributo
                        ORDER BY v.valor
                        FOR JSON PATH
                    ) as valores
                FROM AtributosProducto a
                WHERE a.idEmpresa = @idEmpresa
                ORDER BY a.nombre
            `);
        
        // Procesar resultados JSON
        const atributos = result.recordset.map(attr => ({
            ...attr,
            valores: attr.valores ? JSON.parse(attr.valores) : []
        }));
        
        return atributos;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.verificarAtributoExistente = async (pool, nombre, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('nombre', sql.VarChar(50), nombre)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT COUNT(*) as existe
                FROM AtributosProducto 
                WHERE nombre = @nombre
                AND idEmpresa = @idEmpresa
            
            `);
        
        return result.recordset[0].existe > 0;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerAtributoPorId = async (pool, idAtributo, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idAtributo', sql.Int, idAtributo)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT 
                    a.idAtributo,
                    a.nombre,
                    a.tipo,
                FROM AtributosProducto a
                WHERE a.idAtributo = @idAtributo
                AND a.idEmpresa = @idEmpresa
            
            `);
        
        return result.recordset[0] || null;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.verificarValorAtributoExistente = async (pool, idAtributo, valor) => {
    try {
        const result = await pool
            .request()
            .input('idAtributo', sql.Int, idAtributo)
            .input('valor', sql.VarChar(50), valor)
            .query(`
                SELECT COUNT(*) as existe
                FROM ValoresAtributo 
                WHERE idAtributo = @idAtributo
                AND valor = @valor
            
            `);
        
        return result.recordset[0].existe > 0;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};