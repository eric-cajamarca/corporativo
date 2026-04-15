// repositories/usuario.repository.js
const sql = require('mssql');

/**
 * Verifica si un email ya existe en la BD
 */
exports.checkEmailExists = async (pool, email, Empresa) =>{
      
       const result = await pool
      .request()
      .input('email', sql.VarChar, email)
      .input('idEmpresa', sql.UniqueIdentifier, Empresa)
      .query('SELECT idUsuario FROM usuarioWeb WHERE email = @email and idEmpresa = @idEmpresa');
         return result.recordset.length > 0;
  
}

/**
 * Crea un nuevo usuario en la BD
 */
exports.createUsuario = async (pool, usuarioData) => {
    
    const result = await pool
      .request()
      .input('idUsuario', sql.UniqueIdentifier, usuarioData.idUsuario)
      .input('idEmpresa', sql.UniqueIdentifier, usuarioData.idEmpresa)
      .input('nombres', sql.VarChar, usuarioData.nombres)
      .input('apellidos', sql.VarChar, usuarioData.apellidos)
      .input('email', sql.VarChar, usuarioData.email)
      .input('password', sql.Text, usuarioData.password)
      .input('idRol', sql.UniqueIdentifier, usuarioData.idRol)
      .input('estado', sql.Bit, 0)
      .input('fregistro', sql.Date, usuarioData.fregistro)
      .query(`
        INSERT INTO usuarioWeb 
        (idUsuario, idEmpresa, nombres, apellidos, email, password, idRol, estado, fregistro) 
        VALUES (@idUsuario, @idEmpresa, @nombres, @apellidos, @email, @password, @idRol, @estado, @fregistro)
      `);

    
    return result.rowsAffected;
  
}


exports.obtenerUsuariosAdmin = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input('empresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT 
        UW.idUsuario,
        UW.idEmpresa,
        UW.nombres,
        UW.apellidos,
        UW.email,
        UW.idRol,
        UW.estado,
        UW.fRegistro,
        R.descripcion as rol
      FROM UsuarioWeb UW
      INNER JOIN Rol R ON UW.idRol = R.idRol
      WHERE UW.idEmpresa = @empresa
    `);
  return result.recordset;
};

exports.buscarPorEmail = async (pool, email, idEmpresa) => {
  const result = await pool
    .request()
    .input('email', sql.VarChar(100), email)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('SELECT idUsuario, password, idRol, nombres, apellidos, email, estado FROM UsuarioWeb WHERE email = @email AND idEmpresa = @idEmpresa');
  
  return result.recordset.length > 0 ? result.recordset[0] : null;
};

exports.buscarPorEmailYRuc = async (pool, email, idEmpresa) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('email', sql.VarChar, email)
    .query(`
      SELECT 
        UW.idUsuario,
        UW.idEmpresa,
        UW.nombres,
        UW.apellidos,
        UW.email,
        UW.password,
        UW.idRol,
        UW.estado,
        UW.fRegistro,
        R.descripcion as rol
      FROM UsuarioWeb UW
      INNER JOIN Rol R ON UW.idRol = R.idRol
      WHERE UW.email = @email AND UW.idEmpresa = @idEmpresa
    `);
  
  return result.recordset.length > 0 ? result.recordset[0] : null;
};

/**
 * Mismo perfil que buscarPorEmailYRuc pero comparando email en minúsculas (login + bloqueo por intentos).
 */
exports.buscarPorEmailNormalizado = async (pool, emailNormalizado, idEmpresa) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('emailNorm', sql.VarChar(320), emailNormalizado)
    .query(`
      SELECT
        UW.idUsuario,
        UW.idEmpresa,
        UW.nombres,
        UW.apellidos,
        UW.email,
        UW.password,
        UW.idRol,
        UW.estado,
        UW.fRegistro,
        R.descripcion AS rol
      FROM UsuarioWeb UW
      INNER JOIN Rol R ON UW.idRol = R.idRol
      WHERE UW.idEmpresa = @idEmpresa
        AND LOWER(LTRIM(RTRIM(UW.email))) = @emailNorm
    `);

  return result.recordset.length > 0 ? result.recordset[0] : null;
};

/**
 * Usuario/colaborador por id (renovar sesión con refresh token).
 */
exports.buscarPorIdYEmpresa = async (pool, idUsuario, idEmpresa) => {
  const result = await pool
    .request()
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        UW.idUsuario,
        UW.idEmpresa,
        UW.nombres,
        UW.apellidos,
        UW.email,
        UW.estado,
        R.descripcion AS rol
      FROM UsuarioWeb UW
      INNER JOIN Rol R ON UW.idRol = R.idRol
      WHERE UW.idUsuario = @idUsuario AND UW.idEmpresa = @idEmpresa
    `);
  return result.recordset.length > 0 ? result.recordset[0] : null;
};

/**
 * Busca el primer usuario administrador de una empresa
 */
exports.buscarUsuarioAdminPorEmpresa = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1
        UW.*,
        R.descripcion as rol
      FROM usuarioWeb UW
      INNER JOIN Rol R ON UW.idRol = R.idRol
      WHERE UW.idEmpresa = @idEmpresa
        AND R.descripcion = 'Administrador'
        AND UW.estado = 1
      ORDER BY UW.fRegistro ASC
    `);

  return result.recordset.length > 0 ? result.recordset[0] : null;
};

// Agrega estas funciones al archivo existente

/**
 * Actualiza usuario SIN password
 */
exports.updateUsuarioSinPassword = async (pool, idUsuario, datos) => {
  try {
    
    const result = await pool
      .request()
      .input('idUsuario', sql.UniqueIdentifier, idUsuario)
      .input('nombres', sql.VarChar, datos.nombres)
      .input('apellidos', sql.VarChar, datos.apellidos)
      .input('idRol', sql.UniqueIdentifier, datos.idRol)
      .input('idEmpresa', sql.UniqueIdentifier, datos.idEmpresa)
      .query(`
        UPDATE usuarioWeb 
        SET nombres = @nombres, apellidos = @apellidos, idRol = @idRol 
        WHERE idUsuario = @idUsuario AND idEmpresa = @idEmpresa
      `);
    
    return result.rowsAffected;
  } catch (error) {
    throw new Error(`DB Error updateSinPass: ${error.message}`);
  }
}

/**
 * Actualiza usuario CON password
 */
exports.updateUsuarioConPassword = async (pool, idUsuario, datos) => {
  try {
    const result = await pool
      .request()
      .input('idUsuario', sql.UniqueIdentifier, idUsuario)
      .input('nombres', sql.VarChar, datos.nombres)
      .input('apellidos', sql.VarChar, datos.apellidos)
      .input('password', sql.Text, datos.password)
      .input('idRol', sql.UniqueIdentifier, datos.idRol)
      .query(`
        UPDATE usuarioWeb 
        SET nombres = @nombres, apellidos = @apellidos, password = @password, idRol = @idRol 
        WHERE idUsuario = @idUsuario
      `);
    
    return result.rowsAffected;
  } catch (error) {
    throw new Error(`DB Error updateConPass: ${error.message}`);
  }
}

/**
 * Actualiza solo la contraseña del usuario (para recuperación de contraseña).
 */
exports.actualizarSoloPassword = async (pool, idUsuario, passwordHash) => {
  const result = await pool
    .request()
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('password', sql.Text, passwordHash)
    .query('UPDATE UsuarioWeb SET password = @password WHERE idUsuario = @idUsuario');
  return result.rowsAffected[0];
};

/**
 * Marca último acceso exitoso al sistema (login). Filtra por empresa.
 */
exports.actualizarUltimoLogin = async (pool, idUsuario, idEmpresa) => {
  const result = await pool
    .request()
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      UPDATE UsuarioWeb
      SET ultimoLogin = GETDATE()
      WHERE idUsuario = @idUsuario AND idEmpresa = @idEmpresa
    `);
  return result.rowsAffected[0];
};

exports.obtenerTotpUsuario = async (pool, idUsuario, idEmpresa) => {
  const result = await pool
    .request()
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        totpSecret,
        totpEnabled
      FROM UsuarioWeb
      WHERE idUsuario = @idUsuario AND idEmpresa = @idEmpresa
    `);
  return result.recordset.length > 0 ? result.recordset[0] : null;
};

exports.actualizarTotpUsuario = async (pool, idUsuario, idEmpresa, totpSecret, totpEnabled) => {
  const result = await pool
    .request()
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('totpSecret', sql.NVarChar(128), totpSecret)
    .input('totpEnabled', sql.Bit, totpEnabled ? 1 : 0)
    .query(`
      UPDATE UsuarioWeb
      SET totpSecret = @totpSecret, totpEnabled = @totpEnabled
      WHERE idUsuario = @idUsuario AND idEmpresa = @idEmpresa
    `);
  return result.rowsAffected[0];
};

/** Quita TOTP a usuarios con rol Administrador o superAdmin de la empresa. */
exports.limpiarTotpRolesElevadosPorEmpresa = async (pool, idEmpresa) => {
  const result = await pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa).query(`
    UPDATE UW
    SET UW.totpSecret = NULL, UW.totpEnabled = 0
    FROM UsuarioWeb AS UW
    INNER JOIN Rol AS R ON UW.idRol = R.idRol AND R.idEmpresa = @idEmpresa
    WHERE UW.idEmpresa = @idEmpresa
      AND R.descripcion IN (N'Administrador', N'superAdmin')
  `);
  return result.rowsAffected[0];
};

/** Colaborador con rol (panel admin). */
exports.obtenerUsuarioConRolPorIdUsuario = async (pool, idUsuario, idEmpresa) => {
  const result = await pool
    .request()
    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT UW.*, R.descripcion AS rol
      FROM UsuarioWeb UW
      INNER JOIN Rol R ON UW.idRol = R.idRol
      WHERE UW.idUsuario = @idUsuario AND UW.idEmpresa = @idEmpresa
    `);
  return result.recordset;
};

/** Tabla legacy usuarioWeb con clave numérica `id` (empresasController). */
exports.obtenerUsuarioWebLegacyPorId = async (pool, id) => {
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('SELECT * FROM usuarioWeb WHERE id = @id');
  return result.recordset;
};

exports.actualizarEstadoUsuarioWebLegacyPorId = async (pool, id, estado) => {
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('estado', sql.Bit, estado ? 1 : 0)
    .query('UPDATE usuarioWeb SET estado = @estado WHERE id = @id');
  return result;
};

exports.eliminarUsuarioWebLegacyPorIdYEmpresa = async (pool, id, idEmpresa) => {
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query('DELETE FROM usuarioWeb WHERE id = @id AND idEmpresa = @idEmpresa');
  return result;
};

exports.eliminarUsuarioWebLegacyPorId = async (pool, id) => {
  return pool
    .request()
    .input('id', sql.Int, id)
    .query('DELETE FROM usuarioWeb WHERE id = @id');
};
