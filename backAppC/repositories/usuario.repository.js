// repositories/usuario.repository.js
const sql = require('mssql');

/**
 * Verifica si un email ya existe en la BD
 */
exports.checkEmailExists = async (pool, email, Empresa) =>{
      
   console.log('checkEmailExists Empresa', Empresa, email);
    const result = await pool
      .request()
      .input('email', sql.VarChar, email)
      .input('idEmpresa', sql.UniqueIdentifier, Empresa)
      .query('SELECT idUsuario FROM usuarioWeb WHERE email = @email and idEmpresa = @idEmpresa');
     console.log('checkEmailExists', result.recordset.length);
    return result.recordset.length > 0;
  
}

/**
 * Crea un nuevo usuario en la BD
 */
exports.createUsuario = async (pool, usuarioData) => {
  console.log('createUsurio en repositoy', usuarioData);
  
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
    .query('SELECT * FROM UsuarioWeb UW INNER JOIN Rol R ON UW.idRol = R.idRol WHERE UW.idEmpresa = @empresa');
  
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
