// SIEMPRE usa sql.UniqueIdentifier para UUIDs (regla 1.4)
const sql = require('mssql');

/**
 * Obtiene las sucursales asignadas a un usuario
 */
const obtenerSucursalesUsuario = async (pool, idUsuario, idEmpresa) => {
        const result = await pool.request()
        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT 
                us.idUsuarioSucursal,
                us.idUsuario,
                us.idSucursal,
                us.esDefault,
                us.estado,
                CONVERT(VARCHAR(19), us.fAsignacion, 120) as fAsignacion,
                s.codigo as codigoSucursal,
                s.direccion as direccionSucursal,
                s.telefono as telefonoSucursal,
                s.estado as estadoSucursal
            FROM UsuarioSucursal us
            INNER JOIN Sucursal s ON us.idSucursal = s.idSucursal
            WHERE us.idUsuario = @idUsuario
            AND s.idEmpresa = @idEmpresa
            ORDER BY us.esDefault DESC, s.codigo
        `);
    return result.recordset;
};

/**
 * Obtiene las sucursales activas asignadas a un usuario
 */
const obtenerSucursalesActivasUsuario = async (pool, idUsuario, idEmpresa) => {
    const result = await pool.request()
        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT 
                us.idUsuarioSucursal,
                us.idSucursal,
                us.esDefault,
                s.codigo as codigoSucursal,
                s.direccion as direccionSucursal,
                s.telefono as telefonoSucursal
            FROM UsuarioSucursal us
            INNER JOIN Sucursal s ON us.idSucursal = s.idSucursal
            WHERE us.idUsuario = @idUsuario
            AND s.idEmpresa = @idEmpresa
            AND ISNULL(us.estado, 1) = 1
            AND ISNULL(s.estado, 1) = 1
            ORDER BY us.esDefault DESC, s.codigo
        `);
    return result.recordset;
};

/**
 * Obtiene todos los usuarios asignados a una sucursal
 */
const obtenerUsuariosSucursal = async (pool, idSucursal, idEmpresa) => {
    const result = await pool.request()
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT 
                us.idUsuarioSucursal,
                us.idUsuario,
                us.esDefault,
                us.estado,
                CONVERT(VARCHAR(19), us.fAsignacion, 120) as fAsignacion,
                u.nombres,
                u.apellidos,
                u.email,
                u.estado as estadoUsuario,
                r.descripcion as rol
            FROM UsuarioSucursal us
            INNER JOIN UsuarioWeb u ON us.idUsuario = u.idUsuario
            INNER JOIN Rol r ON u.idRol = r.idRol
            INNER JOIN Sucursal s ON us.idSucursal = s.idSucursal
            WHERE us.idSucursal = @idSucursal
            AND s.idEmpresa = @idEmpresa
            ORDER BY u.nombres
        `);
    return result.recordset;
};

/**
 * Asigna un usuario a una sucursal
 */
const asignarUsuarioSucursal = async (pool, idUsuario, idSucursal, esDefault = false) => {
    const result = await pool.request()
        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .input('esDefault', sql.Bit, esDefault ? 1 : 0)
        .query(`
            IF NOT EXISTS (
                SELECT 1 FROM UsuarioSucursal 
                WHERE idUsuario = @idUsuario AND idSucursal = @idSucursal
            )
            BEGIN
                INSERT INTO UsuarioSucursal (idUsuario, idSucursal, esDefault, estado, fAsignacion)
                OUTPUT INSERTED.idUsuarioSucursal
                VALUES (@idUsuario, @idSucursal, @esDefault, 1, GETDATE())
            END
            ELSE
            BEGIN
                UPDATE UsuarioSucursal 
                SET estado = 1, fAsignacion = GETDATE()
                OUTPUT INSERTED.idUsuarioSucursal
                WHERE idUsuario = @idUsuario AND idSucursal = @idSucursal
            END
        `);
    return result.recordset[0];
};

/**
 * Desasigna un usuario de una sucursal
 */
const desasignarUsuarioSucursal = async (pool, idUsuarioSucursal) => {
    const result = await pool.request()
        .input('idUsuarioSucursal', sql.Int, idUsuarioSucursal)
        .query(`
            UPDATE UsuarioSucursal 
            SET estado = 0
            WHERE idUsuarioSucursal = @idUsuarioSucursal
        `);
    return result.rowsAffected[0];
};

/**
 * Establece una sucursal como default para un usuario
 */
const establecerSucursalDefault = async (pool, idUsuario, idSucursal, idEmpresa) => {
    // Primero quitar default de todas las sucursales del usuario
    await pool.request()
        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            UPDATE us
            SET us.esDefault = 0
            FROM UsuarioSucursal us
            INNER JOIN Sucursal s ON us.idSucursal = s.idSucursal
            WHERE us.idUsuario = @idUsuario
            AND s.idEmpresa = @idEmpresa
        `);

    // Establecer la nueva sucursal como default
    const result = await pool.request()
        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .query(`
            UPDATE UsuarioSucursal 
            SET esDefault = 1
            WHERE idUsuario = @idUsuario AND idSucursal = @idSucursal
        `);
    return result.rowsAffected[0];
};

/**
 * Verifica si un usuario tiene acceso a una sucursal
 */
const verificarAccesoSucursal = async (pool, idUsuario, idSucursal) => {
    const result = await pool.request()
        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .query(`
            SELECT 1 as tieneAcceso
            FROM UsuarioSucursal us
            INNER JOIN Sucursal s ON us.idSucursal = s.idSucursal
            WHERE us.idUsuario = @idUsuario 
            AND us.idSucursal = @idSucursal
            AND ISNULL(us.estado, 1) = 1
            AND ISNULL(s.estado, 1) = 1
        `);
    return result.recordset.length > 0;
};

/**
 * Obtiene la sucursal default del usuario
 */
const obtenerSucursalDefault = async (pool, idUsuario, idEmpresa) => {
    const result = await pool.request()
        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT TOP 1
                us.idSucursal,
                s.codigo,
                s.direccion
            FROM UsuarioSucursal us
            INNER JOIN Sucursal s ON us.idSucursal = s.idSucursal
            WHERE us.idUsuario = @idUsuario
            AND s.idEmpresa = @idEmpresa
            AND ISNULL(us.estado, 1) = 1
            AND ISNULL(s.estado, 1) = 1
            ORDER BY us.esDefault DESC
        `);
    return result.recordset[0] || null;
};

/**
 * Actualiza múltiples asignaciones de usuario a sucursales
 */
const actualizarAsignacionesMasivo = async (pool, idUsuario, sucursalesIds, idEmpresa) => {
    // Desactivar todas las asignaciones actuales
    await pool.request()
        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            UPDATE us
            SET us.estado = 0
            FROM UsuarioSucursal us
            INNER JOIN Sucursal s ON us.idSucursal = s.idSucursal
            WHERE us.idUsuario = @idUsuario
            AND s.idEmpresa = @idEmpresa
        `);

    // Activar las nuevas asignaciones
    for (let i = 0; i < sucursalesIds.length; i++) {
        const idSucursal = sucursalesIds[i];
        const esDefault = i === 0; // La primera es default
        await asignarUsuarioSucursal(pool, idUsuario, idSucursal, esDefault);
    }

    return sucursalesIds.length;
};

/**
 * Obtiene todas las sucursales de una empresa con info de asignación a un usuario
 */
const obtenerSucursalesConAsignacion = async (pool, idUsuario, idEmpresa) => {
    
    const result = await pool.request()
        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
            SELECT 
                s.idSucursal,
                s.direccion,
                s.telefono,
                s.estado as estadoSucursal,
                CASE WHEN us.idUsuarioSucursal IS NOT NULL AND us.estado = 1 THEN 1 ELSE 0 END as asignado,
                ISNULL(us.esDefault, 0) as esDefault,
                us.idUsuarioSucursal
            FROM Sucursal s
            LEFT JOIN UsuarioSucursal us ON s.idSucursal = us.idSucursal AND us.idUsuario = @idUsuario
            WHERE s.idEmpresa = @idEmpresa
            
        `);
    return result.recordset;
};

module.exports = {
    obtenerSucursalesUsuario,
    obtenerSucursalesActivasUsuario,
    obtenerUsuariosSucursal,
    asignarUsuarioSucursal,
    desasignarUsuarioSucursal,
    establecerSucursalDefault,
    verificarAccesoSucursal,
    obtenerSucursalDefault,
    actualizarAsignacionesMasivo,
    obtenerSucursalesConAsignacion
};
