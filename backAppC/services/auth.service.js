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

  console.log('Empresa encontrada:', empresa);

  // 2. Verificar que el email coincida con el email de la empresa
  if (empresa.correo !== email) {
    throw new Error('El email no corresponde a la empresa registrada');
  }

  // 3. Verificar contraseña de la empresa
  const isEmpresaPasswordValid = await bcrypt.compare(password, empresa.password);
  if (!isEmpresaPasswordValid) {
    throw new Error('La contraseña es incorrecta');
  }

  console.log('Empresa autenticada correctamente');

  // 4. Buscar usuario administrador de la empresa (opcional para completar datos)
  try {
    const usuario = await usuarioRepository.buscarUsuarioAdminPorEmpresa(pool, empresa.idEmpresa);
    if (usuario) {
      console.log('Usuario administrador encontrado:', usuario.nombres);

      // 5. Retornar datos combinados para token
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
    console.log('No se encontró usuario administrador, continuando con datos de empresa');
  }

  // 6. Si no hay usuario administrador, retornar datos básicos de empresa
  return {
    idUsuario: empresa.idEmpresa, // Usar ID de empresa como ID de usuario temporal
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

  return {
    message: 'Usuario creado correctamente',
    rowsAffected
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

