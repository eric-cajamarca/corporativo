const sql = require('mssql');

/**
 * Verifica si un rol existe por descripción
 */
exports.existeRolPorDescripcion = async (pool, descripcion, idEmpresa) => {
  try {
    const result = await pool
      .request()
      .input('descripcion', sql.VarChar, descripcion)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query('SELECT idRol FROM Rol WHERE descripcion = @descripcion AND idEmpresa = @idEmpresa');
    
    return result.recordset.length > 0;
  } catch (error) {
    throw new Error(`DB Error existeRol: ${error.message}`);
  }
}

/**
 * Crea un nuevo rol en la BD
 */
exports.crearRol = async (pool, datos) => {
  try {
    const result = await pool
      .request()
      .input('idRol', sql.UniqueIdentifier, datos.idRol)
      .input('descripcion', sql.VarChar, datos.descripcion)
      .input('idEmpresa', sql.UniqueIdentifier, datos.idEmpresa)
      .query('INSERT INTO Rol (idRol, descripcion, idEmpresa) VALUES (@idRol, @descripcion, @idEmpresa)');
    
    return result.rowsAffected;
  } catch (error) {
    throw new Error(`DB Error crearRol: ${error.message}`);
  }
}


exports.obtenerRolesPorEmpresa = async (pool, idEmpresa) =>{
  try {
    const result = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query('SELECT idRol, descripcion FROM Rol WHERE idEmpresa = @idEmpresa');
    
    return result.recordset; // Devuelve directamente el array de roles
  } catch (error) {
    throw new Error(`DB Error obtenerRoles: ${error.message}`);
  }
}

/**
 * Obtiene un rol por su ID (validando empresa para seguridad)
 */
exports.obtenerRolPorId = async (pool, idRol, idEmpresa) => {
  try {
    const result = await pool
      .request()
      .input('idRol', sql.UniqueIdentifier, idRol)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query('SELECT idRol, descripcion FROM Rol WHERE idRol = @idRol AND idEmpresa = @idEmpresa');
    
    return result.recordset[0] || null; // Devuelve el rol o null si no existe
  } catch (error) {
    throw new Error(`DB Error obtenerRolPorId: ${error.message}`);
  }
}

/**
 * Verifica si existe OTRO rol con la misma descripción (excluyendo el rol actual)
 */
exports.existeOtroRolConDescripcion = async (pool, idRolActual, descripcion, idEmpresa) =>{
  try {
    const result = await pool
      .request()
      .input('idRolActual', sql.UniqueIdentifier, idRolActual)
      .input('descripcion', sql.VarChar, descripcion)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT idRol FROM Rol 
        WHERE descripcion = @descripcion 
          AND idEmpresa = @idEmpresa
          AND idRol != @idRolActual
      `);
    
    return result.recordset.length > 0;
  } catch (error) {
    throw new Error(`DB Error existeOtroRol: ${error.message}`);
  }
}

/**
 * Actualiza la descripción de un rol
 */
exports.actualizarRol = async (idRol, descripcion) => {
  try {
    const result = await pool
      .request()
      .input('idRol', sql.UniqueIdentifier, idRol)
      .input('descripcion', sql.VarChar, descripcion)
      .query('UPDATE Rol SET descripcion = @descripcion WHERE idRol = @idRol');
    
    return result.rowsAffected;
  } catch (error) {
    throw new Error(`DB Error actualizarRol: ${error.message}`);
  }
}

