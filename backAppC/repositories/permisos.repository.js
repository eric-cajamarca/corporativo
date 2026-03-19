// SIEMPRE usa sql.UniqueIdentifier para UUIDs, sql.VarChar para cadenas (regla 1.4)
const sql = require('mssql');

/**
 * Obtiene todos los permisos de una empresa
 */
const obtenerPermisosPorEmpresa = async (pool, idEmpresa) => {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT 
                idPermiso,
                idEmpresa,
                nombre,
                descripcion,
                modulo,
                estado
            FROM Permisos 
            WHERE idEmpresa = @idEmpresa AND estado = 1
            ORDER BY modulo, nombre
        `);
    return result.recordset;
};

/**
 * Obtiene los permisos asignados a un rol específico
 */
const obtenerPermisosPorRol = async (pool, idRol, idEmpresa) => {
    const result = await pool.request()
        .input('idRol', sql.UniqueIdentifier, idRol)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT 
                p.idPermiso,
                p.nombre,
                p.descripcion,
                p.modulo
            FROM Permisos p
            INNER JOIN RolPermisos rp ON p.idPermiso = rp.idPermiso
            WHERE rp.idRol = @idRol 
            AND p.idEmpresa = @idEmpresa 
            AND p.estado = 1
            ORDER BY p.modulo, p.nombre
        `);
    return result.recordset;
};

/**
 * Obtiene los permisos de un usuario basado en su rol
 */
const obtenerPermisosPorUsuario = async (pool, idUsuario, idEmpresa) => {
    console.log('idUsuario en obtener permisos usuario', idUsuario);
    const result = await pool.request()
        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT DISTINCT
                p.idPermiso,
                p.nombre,
                p.descripcion,
                p.modulo
            FROM Permisos p
            INNER JOIN RolPermisos rp ON p.idPermiso = rp.idPermiso
            INNER JOIN UsuarioWeb u ON rp.idRol = u.idRol
            WHERE u.idUsuario = @idUsuario 
            AND p.idEmpresa = @idEmpresa 
            AND p.estado = 1
            AND u.estado = 1
            ORDER BY p.modulo, p.nombre
        `);
    return result.recordset;
};

/**
 * Crea un nuevo permiso
 */
const crearPermiso = async (pool, idEmpresa, nombre, descripcion, modulo) => {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('nombre', sql.VarChar(100), nombre)
        .input('descripcion', sql.VarChar(200), descripcion)
        .input('modulo', sql.VarChar(50), modulo)
        .query(`
            INSERT INTO Permisos (idEmpresa, nombre, descripcion, modulo, estado)
            OUTPUT INSERTED.idPermiso
            VALUES (@idEmpresa, @nombre, @descripcion, @modulo, 1)
        `);
    return result.recordset[0];
};

/**
 * Asigna un permiso a un rol
 */
const asignarPermisoARol = async (pool, idRol, idPermiso) => {
    const result = await pool.request()
        .input('idRol', sql.UniqueIdentifier, idRol)
        .input('idPermiso', sql.UniqueIdentifier, idPermiso)
        .query(`
            IF NOT EXISTS (SELECT 1 FROM RolPermisos WHERE idRol = @idRol AND idPermiso = @idPermiso)
            INSERT INTO RolPermisos (idRol, idPermiso)
            VALUES (@idRol, @idPermiso)
        `);
    return result.rowsAffected[0];
};

/**
 * Remueve un permiso de un rol
 */
const removerPermisoDeRol = async (pool, idRol, idPermiso) => {
    const result = await pool.request()
        .input('idRol', sql.UniqueIdentifier, idRol)
        .input('idPermiso', sql.UniqueIdentifier, idPermiso)
        .query(`
            DELETE FROM RolPermisos 
            WHERE idRol = @idRol AND idPermiso = @idPermiso
        `);
    return result.rowsAffected[0];
};

/**
 * Actualiza los permisos de un rol (elimina todos y agrega los nuevos)
 */
const actualizarPermisosDeRol = async (pool, idRol, permisosIds) => {
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        // Eliminar permisos actuales
        await transaction.request()
            .input('idRol', sql.UniqueIdentifier, idRol)
            .query('DELETE FROM RolPermisos WHERE idRol = @idRol');

        // Insertar nuevos permisos
        for (const idPermiso of permisosIds) {
            await transaction.request()
                .input('idRol', sql.UniqueIdentifier, idRol)
                .input('idPermiso', sql.UniqueIdentifier, idPermiso)
                .query('INSERT INTO RolPermisos (idRol, idPermiso) VALUES (@idRol, @idPermiso)');
        }

        await transaction.commit();
        return { success: true, count: permisosIds.length };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Verifica si un usuario tiene un permiso específico
 */
const verificarPermiso = async (pool, idUsuario, idEmpresa, nombrePermiso) => {
    const result = await pool.request()
        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('nombrePermiso', sql.VarChar(100), nombrePermiso)
        .query(`
            SELECT COUNT(*) as tienePermiso
            FROM Permisos p
            INNER JOIN RolPermisos rp ON p.idPermiso = rp.idPermiso
            INNER JOIN UsuarioWeb u ON rp.idRol = u.idRol
            WHERE u.idUsuario = @idUsuario 
            AND p.idEmpresa = @idEmpresa 
            AND p.nombre = @nombrePermiso
            AND p.estado = 1
            AND u.estado = 1
        `);
    return result.recordset[0].tienePermiso > 0;
};

/**
 * Obtiene los módulos disponibles con sus permisos
 */
const obtenerModulosConPermisos = async (pool, idEmpresa) => {
    const result = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT 
                modulo,
                STRING_AGG(nombre, ',') as permisos,
                COUNT(*) as totalPermisos
            FROM Permisos 
            WHERE idEmpresa = @idEmpresa AND estado = 1
            GROUP BY modulo
            ORDER BY modulo
        `);
    return result.recordset;
};

/**
 * Inicializa los permisos por defecto para una empresa
 */
const inicializarPermisosDefecto = async (pool, idEmpresa) => {
    const permisosDefecto = [
        // Módulo Dashboard
        { nombre: 'VER_DASHBOARD', descripcion: 'Ver dashboard principal', modulo: 'DASHBOARD' },
        
        // Módulo Ventas
        { nombre: 'VER_VENTAS', descripcion: 'Ver listado de ventas', modulo: 'VENTAS' },
        { nombre: 'CREAR_VENTAS', descripcion: 'Crear nuevas ventas', modulo: 'VENTAS' },
        { nombre: 'EDITAR_VENTAS', descripcion: 'Editar ventas existentes', modulo: 'VENTAS' },
        { nombre: 'ANULAR_VENTAS', descripcion: 'Anular ventas', modulo: 'VENTAS' },
        
        // Módulo Compras
        { nombre: 'VER_COMPRAS', descripcion: 'Ver listado de compras', modulo: 'COMPRAS' },
        { nombre: 'CREAR_COMPRAS', descripcion: 'Registrar nuevas compras', modulo: 'COMPRAS' },
        { nombre: 'EDITAR_COMPRAS', descripcion: 'Editar compras existentes', modulo: 'COMPRAS' },
        
        // Módulo Inventario
        { nombre: 'VER_INVENTARIO', descripcion: 'Ver inventario', modulo: 'INVENTARIO' },
        { nombre: 'GESTIONAR_LOTES', descripcion: 'Gestionar lotes de inventario', modulo: 'INVENTARIO' },
        { nombre: 'TRANSFERIR_STOCK', descripcion: 'Realizar transferencias de stock', modulo: 'INVENTARIO' },
        
        // Módulo Productos
        { nombre: 'VER_PRODUCTOS', descripcion: 'Ver listado de productos', modulo: 'PRODUCTOS' },
        { nombre: 'CREAR_PRODUCTOS', descripcion: 'Crear nuevos productos', modulo: 'PRODUCTOS' },
        { nombre: 'EDITAR_PRODUCTOS', descripcion: 'Editar productos existentes', modulo: 'PRODUCTOS' },
        { nombre: 'ELIMINAR_PRODUCTOS', descripcion: 'Eliminar productos', modulo: 'PRODUCTOS' },
        { nombre: 'GESTIONAR_PRECIOS', descripcion: 'Gestionar precios de productos', modulo: 'PRODUCTOS' },
        
        // Módulo Clientes
        { nombre: 'VER_CLIENTES', descripcion: 'Ver listado de clientes', modulo: 'CLIENTES' },
        { nombre: 'CREAR_CLIENTES', descripcion: 'Crear nuevos clientes', modulo: 'CLIENTES' },
        { nombre: 'EDITAR_CLIENTES', descripcion: 'Editar clientes existentes', modulo: 'CLIENTES' },
        
        // Módulo Proveedores
        { nombre: 'VER_PROVEEDORES', descripcion: 'Ver listado de proveedores', modulo: 'PROVEEDORES' },
        { nombre: 'CREAR_PROVEEDORES', descripcion: 'Crear nuevos proveedores', modulo: 'PROVEEDORES' },
        { nombre: 'EDITAR_PROVEEDORES', descripcion: 'Editar proveedores existentes', modulo: 'PROVEEDORES' },
        
        // Módulo Caja
        { nombre: 'VER_CAJA', descripcion: 'Ver módulo de caja', modulo: 'CAJA' },
        { nombre: 'ABRIR_CAJA', descripcion: 'Abrir caja', modulo: 'CAJA' },
        { nombre: 'CERRAR_CAJA', descripcion: 'Cerrar caja', modulo: 'CAJA' },
        { nombre: 'REGISTRAR_MOVIMIENTOS', descripcion: 'Registrar movimientos de caja', modulo: 'CAJA' },
        { nombre: 'VER_ARQUEO', descripcion: 'Ver arqueo de caja', modulo: 'CAJA' },
        
        // Módulo Créditos
        { nombre: 'VER_CREDITOS', descripcion: 'Ver créditos de clientes', modulo: 'CREDITOS' },
        { nombre: 'CREAR_CREDITOS', descripcion: 'Crear nuevos créditos', modulo: 'CREDITOS' },
        { nombre: 'REGISTRAR_PAGOS', descripcion: 'Registrar pagos de cuotas', modulo: 'CREDITOS' },
        
        // Módulo Análisis
        { nombre: 'VER_ANALISIS', descripcion: 'Ver análisis y reportes', modulo: 'ANALISIS' },
        { nombre: 'EXPORTAR_REPORTES', descripcion: 'Exportar reportes a PDF/Excel', modulo: 'ANALISIS' },
        
        // Módulo Configuración
        { nombre: 'VER_CONFIGURACION', descripcion: 'Ver configuración', modulo: 'CONFIGURACION' },
        { nombre: 'EDITAR_CONFIGURACION', descripcion: 'Editar configuración', modulo: 'CONFIGURACION' },
        { nombre: 'GESTIONAR_SUCURSALES', descripcion: 'Gestionar sucursales', modulo: 'CONFIGURACION' },
        { nombre: 'GESTIONAR_COMPROBANTES', descripcion: 'Gestionar series de comprobantes', modulo: 'CONFIGURACION' },
        
        // Módulo Usuarios
        { nombre: 'VER_USUARIOS', descripcion: 'Ver listado de usuarios', modulo: 'USUARIOS' },
        { nombre: 'CREAR_USUARIOS', descripcion: 'Crear nuevos usuarios', modulo: 'USUARIOS' },
        { nombre: 'EDITAR_USUARIOS', descripcion: 'Editar usuarios existentes', modulo: 'USUARIOS' },
        { nombre: 'GESTIONAR_ROLES', descripcion: 'Gestionar roles y permisos', modulo: 'USUARIOS' },
        
        // Módulo Empresa
        { nombre: 'VER_EMPRESA', descripcion: 'Ver datos de empresa', modulo: 'EMPRESA' },
        { nombre: 'EDITAR_EMPRESA', descripcion: 'Editar datos de empresa', modulo: 'EMPRESA' },
        { nombre: 'GESTIONAR_GESTORES', descripcion: 'Gestionar empresas gestoras', modulo: 'EMPRESA' },

        // Módulo Despachos
        { nombre: 'VER_DESPACHOS', descripcion: 'Ver despachos', modulo: 'DESPACHOS' },
        { nombre: 'CREAR_DESPACHOS', descripcion: 'Crear despachos', modulo: 'DESPACHOS' },
        { nombre: 'EDITAR_DESPACHOS', descripcion: 'Editar despachos', modulo: 'DESPACHOS' },

        // Módulo Envios
        { nombre: 'VER_ENVIOS', descripcion: 'Ver envíos programados', modulo: 'ENVIOS' },
        { nombre: 'VER_ENVIOS_CHOFER', descripcion: 'Ver mis envíos (chofer)', modulo: 'ENVIOS' },

        // Módulo Reportes
        { nombre: 'VER_REPORTES', descripcion: 'Ver reportes', modulo: 'REPORTES' },
        { nombre: 'GENERAR_REPORTES', descripcion: 'Generar reportes', modulo: 'REPORTES' },
    ];

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        for (const permiso of permisosDefecto) {
            // Verificar si el permiso ya existe
            const existe = await transaction.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('nombre', sql.VarChar(100), permiso.nombre)
                .query('SELECT COUNT(*) as count FROM Permisos WHERE idEmpresa = @idEmpresa AND nombre = @nombre');
            
            if (existe.recordset[0].count === 0) {
                await transaction.request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .input('nombre', sql.VarChar(100), permiso.nombre)
                    .input('descripcion', sql.VarChar(200), permiso.descripcion)
                    .input('modulo', sql.VarChar(50), permiso.modulo)
                    .query(`
                        INSERT INTO Permisos (idEmpresa, nombre, descripcion, modulo, estado)
                        VALUES (@idEmpresa, @nombre, @descripcion, @modulo, 1)
                    `);
            }
        }

        await transaction.commit();
        return { success: true, message: 'Permisos inicializados correctamente' };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

module.exports = {
    obtenerPermisosPorEmpresa,
    obtenerPermisosPorRol,
    obtenerPermisosPorUsuario,
    crearPermiso,
    asignarPermisoARol,
    removerPermisoDeRol,
    actualizarPermisosDeRol,
    verificarPermiso,
    obtenerModulosConPermisos,
    inicializarPermisosDefecto
};
