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

exports.desactivarPrecioProducto = async (pool, idPrecio) => {
    try {
        const result = await pool
            .request()
            .input('idPrecio', sql.UniqueIdentifier, idPrecio)
            .query(`UPDATE PreciosProducto
                    SET activo = 0
                    WHERE idPrecio = @idPrecio`);
        return result;
    } catch (error) {
        throw new Error(`Repository Error: ${error.message}`);
    }
};