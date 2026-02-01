const bcrypt = require('bcryptjs');
const jwt = require('../helpers/jwt');
const empresaRepository = require('../repositories/empresa.repository');
const usuarioRepository = require('../repositories/usuario.repository');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

exports.adminLogin = async (pool, email, password, ruc) => {
  // 1. Validar RUC y obtener empresa
  const empresa = await empresaRepository.buscarPorRuc(pool, ruc);
  if (!empresa) {
    throw new Error('RUC no existe o empresa inactiva');
  }

  // 2. Intentar login como COLABORADOR (email + contraseña del usuario en UsuarioWeb)
  const colaborador = await usuarioRepository.buscarPorEmailYRuc(pool, email, empresa.idEmpresa);
  if (colaborador) {
    // estado puede venir como 1, true (BIT) según el driver
    const activo = colaborador.estado === 1 || colaborador.estado === true;
    if (!activo) {
      throw new Error('El usuario está deshabilitado. Contacte al administrador.');
    }
    // password puede venir con distinta capitalización desde SQL Server
    const passwordHash = colaborador.password || colaborador.Password;
    if (!passwordHash || typeof passwordHash !== 'string') {
      console.error('Login colaborador: hash de contraseña no disponible para', email);
      throw new Error('Error interno del servidor');
    }
    const isPasswordValid = await bcrypt.compare(password, passwordHash);
    if (isPasswordValid) {
      console.log('✓ Login como colaborador:', colaborador.email, 'Rol:', colaborador.rol);
      return {
        idUsuario: colaborador.idUsuario,
        idEmpresa: empresa.idEmpresa,
        razonSocial: empresa.razon_Social || empresa.razonSocial,
        nombres: colaborador.nombres,
        apellidos: colaborador.apellidos,
        email: colaborador.email,
        rol: colaborador.rol || 'Colaborador'
      };
    }
    // Contraseña incorrecta para este colaborador
    throw new Error('La contraseña es incorrecta');
  }

  // 3. Si no es colaborador: login como EMPRESA (correo y contraseña de la empresa)
  if (empresa.correo !== email) {
    throw new Error('El email no existe o no tiene permisos para acceder');
  }

  const isEmpresaPasswordValid = await bcrypt.compare(password, empresa.password);
  if (!isEmpresaPasswordValid) {
    throw new Error('La contraseña es incorrecta');
  }

  console.log('Empresa autenticada correctamente');

  // 4. Buscar usuario administrador de la empresa (opcional para completar datos)
  try {
    const usuario = await usuarioRepository.buscarUsuarioAdminPorEmpresa(pool, empresa.idEmpresa);
    if (usuario) {
      return {
        idUsuario: usuario.idUsuario,
        idEmpresa: empresa.idEmpresa,
        razonSocial: empresa.razon_Social,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        email: usuario.email,
        rol: usuario.rol || 'Administrador'
      };
    }
  } catch (error) {
    console.error('Error al buscar admin por empresa:', error.message);
  }

  // 5. Sin usuario administrador: datos básicos de empresa
  return {
    idUsuario: empresa.idEmpresa,
    idEmpresa: empresa.idEmpresa,
    razonSocial: empresa.razon_Social,
    nombres: 'Administrador',
    apellidos: 'Sistema',
    email: empresa.correo,
    rol: 'Administrador'
  };
};


function validarAdmin(usuario) {
  if (!usuario || usuario.rol !== 'Administrador') {
    throw new Error('PERMISO_DENEGADO');
  }
}

/**
 * Crea un administrador (valida rol, email, hashea pass, genera UUID)
 */
exports.createAdministrador = async (pool, datos, usuarioAutenticado) => {
  // 1. Validar permisos
  validarAdmin(usuarioAutenticado);

  // 2. Destructurar datos
  const { nombres, apellidos, email, password, idRol } = datos;
  const idEmpresa = usuarioAutenticado.empresa;

  console.log('antes chekar email');
  // 3. Verificar email duplicado
  const emailExiste = await usuarioRepository.checkEmailExists(pool, email, idEmpresa);
  if (emailExiste) {
    throw new Error('EMAIL_EXISTE');
  }

  console.log('despues chekar email');

  // 4. Hashear password
  const hashedPassword = await bcrypt.hash(password, 8);

  // 5. Generar UUID
  const idUsuario = uuidv4();

  // 6. Preparar datos para BD
  const usuarioData = {
    idUsuario,
    idEmpresa: usuarioAutenticado.empresa,
    nombres,
    apellidos,
    email,
    password: hashedPassword,
    idRol,
    fregistro: moment().format('YYYY-MM-DD')
  };

  console.log('en servicio UsuarioData', usuarioData);
  // 7. Crear usuario
  const rowsAffected = await usuarioRepository.createUsuario(pool, usuarioData);

  // 8. Asignar sucursal principal al usuario (si existe tabla UsuarioSucursal)
  const sql = require('mssql');
  let idSucursal = datos.idSucursal;
  
  if (!idSucursal) {
    try {
      const sucursalResult = await pool.request()
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query(`
          SELECT TOP 1 idSucursal 
          FROM Sucursal 
          WHERE idEmpresa = @idEmpresa AND estado = 1 
          ORDER BY fRegistro ASC
        `);
      
      if (sucursalResult.recordset.length > 0) {
        idSucursal = sucursalResult.recordset[0].idSucursal;
      }
    } catch (error) {
      console.warn('⚠️ No se pudo obtener sucursal principal:', error.message);
    }
  }

  // Asignar sucursal al usuario en UsuarioSucursal
  if (idSucursal) {
    try {
      const idUsuarioSucursal = uuidv4();
      await pool.request()
        .input('idUsuarioSucursal', sql.UniqueIdentifier, idUsuarioSucursal)
        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
        .input('idSucursal', sql.UniqueIdentifier, idSucursal)
        .input('estado', sql.Bit, 1)
        .input('esDefault', sql.Bit, 1)
        .query(`
          INSERT INTO UsuarioSucursal (idUsuarioSucursal, idUsuario, idSucursal, estado, esDefault, fAsignacion)
          VALUES (@idUsuarioSucursal, @idUsuario, @idSucursal, @estado, @esDefault, GETDATE())
        `);
      console.log('✓ Sucursal principal asignada al usuario:', idSucursal);
    } catch (error) {
      console.warn('⚠️ No se pudo asignar sucursal al usuario:', error.message);
    }
  }

  return {
    message: 'Usuario creado correctamente',
    rowsAffected,
    idSucursal
  };
}


function esPasswordVacio(password) {
  return !password || password.trim() === '' || password.trim() === 'sin datos';
}

/**
 * Actualiza un administrador (con o sin password)
 */
exports.updateAdministrador = async (pool, id, datos, usuarioAutenticado) => {
  // 1. Validar permisos
  if (usuarioAutenticado.rol !== 'Administrador') {
    throw new Error('PERMISO_DENEGADO');
  }

  // 2. Preparar datos comunes
  const datosActualizacion = {
    nombres: datos.nombres,
    apellidos: datos.apellidos,
    idRol: datos.idRol,
    idEmpresa: usuarioAutenticado.empresa
  };

  // 3. Decidir qué tipo de actualización
  if (esPasswordVacio(datos.password)) {
    // SIN password
    return await usuarioRepository.updateUsuarioSinPassword(pool, id, datosActualizacion);
  } else {
    // CON password
    const hashedPassword = await bcrypt.hash(datos.password, 8);
    return await usuarioRepository.updateUsuarioConPassword(pool, id, {
      ...datosActualizacion,
      password: hashedPassword
    });
  }
}

