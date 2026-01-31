const { v4: uuidv4 } = require('uuid');

/**
 * Obtiene datos de empresa/usuario para la respuesta de getEmpresa_login (verificación de token).
 * req.user viene del JWT decodificado (adminLogin).
 */
exports.getDatosEmpresaLogin = async (pool, user) => {
    if (!user) return null;
    return {
        razonSocial: user.razonSocial || '',
        nombres: user.nombres || '',
        apellidos: user.apellidos || '',
        email: user.email || '',
        rol: user.rol || 'Administrador',
        roles: user.rol || 'Administrador' // frontend usa response.data.roles
    };
};

/**
 * Crea los roles predeterminados para una nueva empresa
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @returns {Array} Array con los IDs de los roles creados
 */
exports.crearRolesPredeterminados = async (pool, idEmpresa) => {
    console.log('Creando roles predeterminados para empresa:', idEmpresa);
    
    const sql = require('mssql');
    
    const rolesPredeterminados = [
        { descripcion: 'Administrador', estado: 1 },
        { descripcion: 'Vendedor', estado: 1 },
        { descripcion: 'Almacenero', estado: 1 },
        { descripcion: 'Contador', estado: 1 }
    ];

    const rolesCreados = [];

    try {
        for (const rol of rolesPredeterminados) {
            const idRol = uuidv4();
            
            await pool.request()
                .input('idRol', sql.UniqueIdentifier, idRol)
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('descripcion', sql.VarChar(50), rol.descripcion)
                .input('estado', sql.Bit, rol.estado)
                .query(`
                    INSERT INTO Rol (idRol, idEmpresa, descripcion, estado, fCreacion)
                    VALUES (@idRol, @idEmpresa, @descripcion, @estado, GETDATE())
                `);

            rolesCreados.push({ idRol, descripcion: rol.descripcion });
            console.log(`Rol creado: ${rol.descripcion} (${idRol})`);
        }

        console.log(`✓ ${rolesCreados.length} roles predeterminados creados`);
        return rolesCreados;

    } catch (error) {
        console.error('Error creando roles predeterminados:', error);
        throw new Error('Error al crear roles predeterminados: ' + error.message);
    }
};

/**
 * Verifica si la empresa tiene colaboradores
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @returns {Object} { tieneColaboradores: boolean, cantidad: number }
 */
exports.verificarColaboradores = async (pool, idEmpresa) => {
    const sql = require('mssql');
    
    try {
        const result = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT COUNT(*) as cantidad 
                FROM UsuarioWeb 
                WHERE idEmpresa = @idEmpresa AND estado = 1
            `);

        const cantidad = result.recordset[0].cantidad;

        return {
            tieneColaboradores: cantidad > 0,
            cantidad: cantidad
        };

    } catch (error) {
        console.error('Error verificando colaboradores:', error);
        throw new Error('Error al verificar colaboradores: ' + error.message);
    }
};

/**
 * Obtiene el estado de configuración de la empresa
 * @param {Object} pool - Conexión a la base de datos
 * @param {String} idEmpresa - ID de la empresa
 * @returns {Object} Estado de configuración
 */
exports.obtenerEstadoConfiguracion = async (pool, idEmpresa) => {
    const sql = require('mssql');
    
    try {
        // Verificar colaboradores
        const colaboradores = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query('SELECT COUNT(*) as total FROM UsuarioWeb WHERE idEmpresa = @idEmpresa');

        // Verificar productos
        const productos = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query('SELECT COUNT(*) as total FROM Productos WHERE idEmpresa = @idEmpresa');

        // Verificar proveedores
        const proveedores = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query('SELECT COUNT(*) as total FROM Proveedor WHERE idEmpresa = @idEmpresa');

        // Verificar clientes
        const clientes = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query('SELECT COUNT(*) as total FROM Cliente WHERE idEmpresa = @idEmpresa');

        return {
            tieneColaboradores: colaboradores.recordset[0].total > 0,
            cantidadColaboradores: colaboradores.recordset[0].total,
            tieneProductos: productos.recordset[0].total > 0,
            cantidadProductos: productos.recordset[0].total,
            tieneProveedores: proveedores.recordset[0].total > 0,
            cantidadProveedores: proveedores.recordset[0].total,
            tieneClientes: clientes.recordset[0].total > 0,
            cantidadClientes: clientes.recordset[0].total,
            configuracionCompleta: 
                colaboradores.recordset[0].total > 0 &&
                productos.recordset[0].total > 0 &&
                proveedores.recordset[0].total > 0
        };

    } catch (error) {
        console.error('Error obteniendo estado de configuración:', error);
        throw new Error('Error al obtener estado de configuración: ' + error.message);
    }
};

module.exports = exports;
