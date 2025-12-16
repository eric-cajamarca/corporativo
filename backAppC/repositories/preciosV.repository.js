const sql = require('mssql');

exports.crearPrecioProducto = async (pool, precioData) => {
    const { idLista, idProducto, precio, idMoneda, idUsuario } = precioData;
    
    try {
        const result = await pool
            .request()
            .input('idLista', sql.Int, idLista)
            .input('idProducto', sql.UniqueIdentifier, idProducto)
            .input('precio', sql.Decimal(18, 4), precio)
            .input('idMoneda', sql.Int, idMoneda)
            .input('idUsuario', sql.UniqueIdentifier, idUsuario)
            .query(`
                INSERT INTO PreciosProducto 
                (idLista, idProducto, precio, idMoneda, idUsuario) 
                VALUES (@idLista, @idProducto, @precio, @idMoneda, @idUsuario)
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

// Opcional: otros métodos del repository
exports.obtenerPrecioPorId = async (pool, id) => {
    try {
        const result = await pool
            .request()
            .input('id', sql.UniqueIdentifier, id)
            .query('SELECT * FROM PreciosProducto WHERE id = @id');
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};


exports.actualizarPrecioProducto = async (pool, precioData) => {
    const { idPrecio, idLista, idProducto, precio, idMoneda, idUsuario } = precioData;
    
    try {
        const result = await pool
            .request()
            .input('idPrecio', sql.UniqueIdentifier, idPrecio)
            .input('idLista', sql.Int, idLista)
            .input('idProducto', sql.UniqueIdentifier, idProducto)
            .input('precio', sql.Decimal(18, 4), precio)
            .input('idMoneda', sql.Int, idMoneda)
            .input('idUsuario', sql.UniqueIdentifier, idUsuario)
            .query(` update PreciosProducto 
                     set idLista = @idLista,
                         idProducto = @idProducto,
                         precio = @precio,
                         idMoneda = @idMoneda,
                         idUsuario = @idUsuario
                     where idPrecio = @idPrecio`);


        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerPrecioPorId = async (pool, idPrecio) => {
    try {
        const result = await pool
            .request()
            .input('idPrecio', sql.UniqueIdentifier, idPrecio)
            .query('SELECT * FROM PreciosProducto WHERE idPrecio = @idPrecio');
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.eliminarPrecioProducto = async (pool, idPrecio) => {
    try {
        const result = await pool
            .request()
            .input('idPrecio', sql.UniqueIdentifier, idPrecio)
            .query('DELETE FROM PreciosProducto WHERE idPrecio = @idPrecio');
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

///////////////////////////////////////////////////////////////////////////////////////////
exports.crearListaPrecio = async (pool, listaData) => {
    try {
        const { 
            idEmpresa, 
            idSucursal, 
            nombre, 
            idMoneda, 
            principal, 
            conIgv, 
            fecha_inicio, 
            fecha_fin, 
            activo 
        } = listaData;

        console.log('Creating listaData in repository:', listaData);
        const result = await pool

            .request()
            .input('idSucursal', sql.UniqueIdentifier, idSucursal || null)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('nombre', sql.VarChar(100), nombre)
            .input('idMoneda', sql.Int, idMoneda)
            .input('principal', sql.Bit, principal)
            .input('conIgv', sql.Bit, conIgv)
            .input('fecha_inicio', sql.Date, fecha_inicio)
            .input('fecha_fin', sql.Date, fecha_fin)
            .input('activo', sql.Bit, activo)
            .query(`
                INSERT INTO ListasPrecio 
                (idEmpresa, idSucursal, nombre, idMoneda, principal, conIgv, fecha_inicio, fecha_fin, activo) 
                VALUES (@idEmpresa, @idSucursal, @nombre, @idMoneda, @principal, @conIgv, @fecha_inicio, @fecha_fin, @activo)
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerListaPorNombre = async (pool, idEmpresa, nombre) => {
    try {
        const result = await pool
            .request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('nombre', sql.VarChar(100), nombre)
            .query(`
                SELECT TOP 1 * 
                FROM ListasPrecio 
                WHERE idEmpresa = @idEmpresa 
                AND nombre = @nombre
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.verificarPrincipalExistente = async (pool, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT TOP 1 * 
                FROM ListasPrecio 
                WHERE idEmpresa = @idEmpresa 
                AND principal = 1 
                AND activo = 1
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.actualizarListaPrecio = async (pool, listaData) => {
    try {
        const { 
            idLista, 
            idEmpresa, 
            idSucursal, 
            nombre, 
            idMoneda, 
            principal, 
            conIgv, 
            fecha_inicio, 
            fecha_fin, 
            activo 
        } = listaData;

        const result = await pool
            .request()
            .input('idLista', sql.Int, idLista)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('idSucursal', sql.UniqueIdentifier, idSucursal || null)
            .input('nombre', sql.VarChar(100), nombre)
            .input('idMoneda', sql.Int, idMoneda)
            .input('principal', sql.Bit, principal)
            .input('conIgv', sql.Bit, conIgv)
            .input('fecha_inicio', sql.Date, fecha_inicio)
            .input('fecha_fin', sql.Date, fecha_fin)    
            .input('activo', sql.Bit, activo)
            .query(`
                UPDATE ListasPrecio 
                SET idEmpresa = @idEmpresa, 
                    idSucursal = @idSucursal, 
                    nombre = @nombre, 
                    idMoneda = @idMoneda, 
                    principal = @principal, 
                    conIgv = @conIgv, 
                    fecha_inicio = @fecha_inicio, 
                    fecha_fin = @fecha_fin, 
                    activo = @activo 
                WHERE idLista = @idLista
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerListaPorId = async (pool, idLista, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idLista', sql.Int, idLista)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT * 
                FROM ListasPrecio 
                WHERE idLista = @idLista 
                AND idEmpresa = @idEmpresa
            `);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerListasPrecioPorProducto = async (pool, idProducto, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idProducto', sql.UniqueIdentifier, idProducto)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT lp.*, pp.precio, pp.idMoneda as monedaPrecio
                FROM ListasPrecio lp
                LEFT JOIN PreciosProducto pp ON lp.idLista = pp.idLista 
                    AND pp.idProducto = @idProducto
                WHERE lp.idEmpresa = @idEmpresa 
                AND lp.activo = 1
                ORDER BY lp.principal DESC, lp.nombre ASC
            `);
        
        return result.recordset;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerListasPrecioEmpresa = async (pool, idEmpresa) => {
    try {
        const result = await pool
            .request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT 
                    lp.*,
                    s.nombre as nombreSucursal
                FROM ListasPrecio lp
                LEFT JOIN Sucursal s ON lp.idSucursal = s.idSucursal
                WHERE lp.idEmpresa = @idEmpresa 
                AND lp.activo = 1
                ORDER BY lp.principal DESC, lp.nombre ASC
            `);
        
        return result.recordset;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.verificarUsoListaPrecio = async (pool, idLista) => {
    try {
        const result = await pool
            .request()
            .input('idLista', sql.Int, idLista)
            .query(`
                SELECT COUNT(*) as cantidad 
                FROM PreciosProducto 
                WHERE idLista = @idLista
            `);
        
        return result.recordset[0].cantidad;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.eliminarListaPrecio = async (pool, idLista) => {
    try {
        const result = await pool
            .request()
            .input('idLista', sql.Int, idLista)
            .query(`DELETE FROM ListasPrecio WHERE idLista = @idLista`);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.desactivarListaPrecio = async (pool, idLista) => {
    try {
        const result = await pool
            .request()
            .input('idLista', sql.Int, idLista)
            .query(`UPDATE ListasPrecio SET activo = 0 WHERE idLista = @idLista`);
        
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};

exports.obtenerListaPorIdSimple = async (pool, idLista) => {
    try {
        const result = await pool
            .request()
            .input('idLista', sql.Int, idLista)
            .query(`SELECT * FROM ListasPrecio WHERE idLista = @idLista`);
        
        return result.recordset[0];
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};