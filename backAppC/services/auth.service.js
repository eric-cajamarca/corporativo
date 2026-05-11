const bcrypt = require('bcryptjs');
const jwtHelper = require('../helpers/jwt');
const empresaRepository = require('../repositories/empresa.repository');
const usuarioRepository = require('../repositories/usuario.repository');
const loginSeguridadRepository = require('../repositories/loginSeguridad.repository');
const seguridadAlertasService = require('./seguridadAlertas.service');
const emailService = require('./email.service');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const saasPlanLimitesService = require('./saasPlanLimites.service');

const LOGIN_INTENTOS_MAX = 5;
const LOGIN_BLOQUEO_MINUTOS = 30;

function empresaExige2faAdmin(empresa) {
  if (!empresa) return true;
  const v = empresa.adminRequiere2FA;
  if (v === false || v === 0) return false;
  return true;
}

async function evaluarEtapa2fa(pool, datosUsuario, syntheticAdmin, empresa) {
  const twoFactorAdminService = require('./twoFactorAdmin.service');
  const jwtHelper = require('../helpers/jwt');
  if (!empresaExige2faAdmin(empresa)) {
    return { stage: 'OK', datosUsuario };
  }
  if (!twoFactorAdminService.requiere2faRolElevado(datosUsuario.rol)) {
    return { stage: 'OK', datosUsuario };
  }
  const st = await twoFactorAdminService.obtenerEstado(
    pool,
    datosUsuario.idUsuario,
    datosUsuario.idEmpresa,
    syntheticAdmin
  );
  if (!st.enabled) {
    return {
      stage: 'SETUP',
      pendingToken: jwtHelper.createTwoFactorPendingToken({
        idUsuario: datosUsuario.idUsuario,
        idEmpresa: datosUsuario.idEmpresa,
        synthetic: syntheticAdmin,
        flow: 'setup'
      }),
      datosUsuario
    };
  }
  return {
    stage: 'VERIFY',
    pendingToken: jwtHelper.createTwoFactorPendingToken({
      idUsuario: datosUsuario.idUsuario,
      idEmpresa: datosUsuario.idEmpresa,
      synthetic: syntheticAdmin,
      flow: 'verify'
    }),
    datosUsuario
  };
}

function normalizarEmailLogin(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
    .slice(0, 320);
}

function correoEmpresaCoincide(correoEmpresa, emailNorm) {
  return String(correoEmpresa || '')
    .trim()
    .toLowerCase() === emailNorm;
}

async function marcarUltimoLoginSiUsuarioWeb(pool, idUsuario, idEmpresa) {
  try {
    const n = await usuarioRepository.actualizarUltimoLogin(pool, idUsuario, idEmpresa);
    if (!n) {
      // Sin fila UsuarioWeb (ej. login solo con credenciales de empresa sin admin en tabla)
      return;
    }
  } catch (err) {
    console.error('marcarUltimoLoginSiUsuarioWeb:', err.message);
  }
}

async function aplicarFalloLogin(pool, empresa, emailNorm, ipCliente) {
  const { intentosFallidos, recienBloqueado } = await loginSeguridadRepository.registrarFallo(
    pool,
    empresa.idEmpresa,
    emailNorm,
    LOGIN_INTENTOS_MAX,
    LOGIN_BLOQUEO_MINUTOS,
    ipCliente
  );
  await seguridadAlertasService.notificarLoginFallido(pool, {
    empresa,
    email: emailNorm,
    intentosFallidos,
    recienBloqueado,
    ipCliente
  });
  if (recienBloqueado) {
    throw new Error('LOGIN_BLOQUEADO_TEMPORAL');
  }
}

exports.adminLogin = async (pool, email, password, ruc, ipCliente = null) => {
  const emailNorm = normalizarEmailLogin(email);
  if (!emailNorm || !password || !ruc) {
    throw new Error('Faltan datos requeridos');
  }

  // 1. Validar RUC y obtener empresa
  const empresa = await empresaRepository.buscarPorRuc(pool, ruc);
  if (!empresa) {
    throw new Error('RUC no existe o empresa inactiva');
  }

  await loginSeguridadRepository.limpiarBloqueoSiExpirado(pool, empresa.idEmpresa, emailNorm);
  const estadoLock = await loginSeguridadRepository.obtenerEstado(pool, empresa.idEmpresa, emailNorm);
  if (estadoLock.bloqueadoHasta && new Date(estadoLock.bloqueadoHasta) > new Date()) {
    throw new Error('LOGIN_BLOQUEADO_TEMPORAL');
  }

  // 2. Intentar login como COLABORADOR (email + contraseña del usuario en UsuarioWeb)
  const colaborador = await usuarioRepository.buscarPorEmailNormalizado(pool, emailNorm, empresa.idEmpresa);
  if (colaborador) {
    // estado puede venir como 1, true (BIT) según el driver
    const activo = colaborador.estado === 1 || colaborador.estado === true;
    if (!activo) {
      throw new Error('El usuario está deshabilitado. Contacte al administrador.');
    }
    // password puede venir con distinta capitalización desde SQL Server
    const passwordHash = colaborador.password || colaborador.Password;
    if (!passwordHash || typeof passwordHash !== 'string') {
      console.error('Login colaborador: hash de contraseña no disponible para', emailNorm);
      throw new Error('Error interno del servidor');
    }
    const isPasswordValid = await bcrypt.compare(password, passwordHash);
    if (isPasswordValid) {
      await loginSeguridadRepository.resetPorExito(pool, empresa.idEmpresa, emailNorm);
      await marcarUltimoLoginSiUsuarioWeb(pool, colaborador.idUsuario, empresa.idEmpresa);
      const datosUsuario = {
        idUsuario: colaborador.idUsuario,
        idEmpresa: empresa.idEmpresa,
        razonSocial: empresa.razon_Social || empresa.razonSocial,
        nombres: colaborador.nombres,
        apellidos: colaborador.apellidos,
        email: colaborador.email,
        rol: colaborador.rol || 'Colaborador'
      };
      return await evaluarEtapa2fa(pool, datosUsuario, false, empresa);
    }
    await aplicarFalloLogin(pool, empresa, emailNorm, ipCliente);
    throw new Error('La contraseña es incorrecta');
  }

  // 3. Si no es colaborador: login como EMPRESA (correo y contraseña de la empresa)
  if (!correoEmpresaCoincide(empresa.correo, emailNorm)) {
    await aplicarFalloLogin(pool, empresa, emailNorm, ipCliente);
    throw new Error('El email no existe o no tiene permisos para acceder');
  }

  const isEmpresaPasswordValid = await bcrypt.compare(password, empresa.password);
  if (!isEmpresaPasswordValid) {
    await aplicarFalloLogin(pool, empresa, emailNorm, ipCliente);
    throw new Error('La contraseña es incorrecta');
  }

  await loginSeguridadRepository.resetPorExito(pool, empresa.idEmpresa, emailNorm);

  // 4. Buscar usuario administrador de la empresa (opcional para completar datos)
  try {
    const usuario = await usuarioRepository.buscarUsuarioAdminPorEmpresa(pool, empresa.idEmpresa);
    if (usuario) {
      await marcarUltimoLoginSiUsuarioWeb(pool, usuario.idUsuario, empresa.idEmpresa);
      const datosUsuario = {
        idUsuario: usuario.idUsuario,
        idEmpresa: empresa.idEmpresa,
        razonSocial: empresa.razon_Social,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        email: usuario.email,
        rol: usuario.rol || 'Administrador'
      };
      return await evaluarEtapa2fa(pool, datosUsuario, false, empresa);
    }
  } catch (error) {
    console.error('Error al buscar admin por empresa:', error.message);
  }

  // 5. Sin usuario administrador: datos básicos de empresa (idUsuario = idEmpresa; no hay fila típica en UsuarioWeb)
  const datosSynthetic = {
    idUsuario: empresa.idEmpresa,
    idEmpresa: empresa.idEmpresa,
    razonSocial: empresa.razon_Social,
    nombres: 'Administrador',
    apellidos: 'Sistema',
    email: empresa.correo,
    rol: 'Administrador'
  };
  return await evaluarEtapa2fa(pool, datosSynthetic, true, empresa);
};

/**
 * Reconstruye datos de sesión tras validar TOTP (misma forma que login completo).
 */
exports.construirDatosUsuarioPost2FA = async (pool, idUsuario, idEmpresa, synthetic) => {
  const emp = await empresaRepository.obtenerBasicaPorId(pool, idEmpresa);
  if (!emp) return null;
  const empresaActiva = emp.estado === 1 || emp.estado === true;
  if (!empresaActiva) return null;

  if (synthetic) {
    return {
      idUsuario: idEmpresa,
      idEmpresa,
      razonSocial: emp.razon_Social,
      nombres: 'Administrador',
      apellidos: 'Sistema',
      email: emp.correo,
      rol: 'Administrador'
    };
  }

  const uw = await usuarioRepository.buscarPorIdYEmpresa(pool, idUsuario, idEmpresa);
  if (!uw) return null;
  const activo = uw.estado === 1 || uw.estado === true;
  if (!activo) return null;
  return {
    idUsuario: uw.idUsuario,
    idEmpresa,
    razonSocial: emp.razon_Social,
    nombres: uw.nombres,
    apellidos: uw.apellidos,
    email: uw.email,
    rol: uw.rol || 'Colaborador'
  };
};

/**
 * Reconstruye el payload de sesión tras validar refresh token (misma forma que adminLogin exitoso).
 */
exports.reconstruirDatosUsuarioParaToken = async (pool, idUsuario, idEmpresa) => {
  const emp = await empresaRepository.obtenerBasicaPorId(pool, idEmpresa);
  if (!emp) return null;
  const empresaActiva = emp.estado === 1 || emp.estado === true;
  if (!empresaActiva) return null;

  const uw = await usuarioRepository.buscarPorIdYEmpresa(pool, idUsuario, idEmpresa);
  if (uw) {
    const activo = uw.estado === 1 || uw.estado === true;
    if (!activo) return null;
    return {
      idUsuario: uw.idUsuario,
      idEmpresa,
      razonSocial: emp.razon_Social,
      nombres: uw.nombres,
      apellidos: uw.apellidos,
      email: uw.email,
      rol: uw.rol || 'Colaborador'
    };
  }

  const idUS = String(idUsuario).toLowerCase();
  const idEM = String(idEmpresa).toLowerCase();
  if (idUS !== idEM) return null;

  const admin = await usuarioRepository.buscarUsuarioAdminPorEmpresa(pool, idEmpresa);
  if (admin) {
    const activo = admin.estado === 1 || admin.estado === true;
    if (!activo) return null;
    return {
      idUsuario: admin.idUsuario,
      idEmpresa,
      razonSocial: emp.razon_Social,
      nombres: admin.nombres,
      apellidos: admin.apellidos,
      email: admin.email,
      rol: admin.rol || 'Administrador'
    };
  }

  return {
    idUsuario: idEmpresa,
    idEmpresa,
    razonSocial: emp.razon_Social,
    nombres: 'Administrador',
    apellidos: 'Sistema',
    email: emp.correo,
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

  await saasPlanLimitesService.assertPuedeCrearUsuarioColaborador(pool, idEmpresa);

    // 3. Verificar email duplicado
  const emailExiste = await usuarioRepository.checkEmailExists(pool, email, idEmpresa);
  if (emailExiste) {
    throw new Error('EMAIL_EXISTE');
  }

  
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
          WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1 
          ORDER BY CASE WHEN ISNULL(esPrincipal, 0) = 1 THEN 0 ELSE 1 END, fRegistro ASC
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

/**
 * Solicitar recuperación de contraseña: valida RUC + email (empresa o colaborador), genera token y envía el enlace por correo.
 * No revela si el email existe o no (mensaje genérico por seguridad). El token solo llega a la bandeja del correo registrado.
 */
exports.solicitarRecuperacion = async (pool, ruc, email) => {
  const empresa = await empresaRepository.buscarPorRuc(pool, ruc);
  if (!empresa) {
    throw new Error('RUC_NO_ENCONTRADO');
  }

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/$/, '');

  const colaborador = await usuarioRepository.buscarPorEmailYRuc(pool, email, empresa.idEmpresa);
  if (colaborador) {
    const token = jwtHelper.createResetToken({
      tipo: 'colaborador',
      idEmpresa: empresa.idEmpresa,
      idUsuario: colaborador.idUsuario,
      email
    });
    const recoveryLink = `${frontendUrl}/recuperar-password?token=${encodeURIComponent(token)}`;
    await emailService.enviarLinkRecuperacion(email, recoveryLink, 'colaborador');
    return { sent: true };
  }

  if (empresa.correo === email) {
    const token = jwtHelper.createResetToken({
      tipo: 'empresa',
      idEmpresa: empresa.idEmpresa,
      idUsuario: null,
      email
    });
    const recoveryLink = `${frontendUrl}/recuperar-password?token=${encodeURIComponent(token)}`;
    await emailService.enviarLinkRecuperacion(email, recoveryLink, 'empresa');
    return { sent: true };
  }

  throw new Error('EMAIL_NO_COINCIDE');
};

/**
 * Restablecer contraseña con el token recibido en recuperación.
 */
exports.restablecerPassword = async (pool, token, newPassword) => {
  if (!newPassword || newPassword.trim().length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres');
  }

  const decoded = jwtHelper.verifyResetToken(token);
  const hashedPassword = await bcrypt.hash(newPassword.trim(), 8);

  if (decoded.tipo === 'empresa') {
    const rows = await empresaRepository.actualizarPassword(pool, decoded.idEmpresa, hashedPassword);
    if (rows === 0) throw new Error('No se pudo actualizar la contraseña');
    return { message: 'Contraseña de empresa actualizada correctamente' };
  }

  if (decoded.tipo === 'colaborador') {
    const rows = await usuarioRepository.actualizarSoloPassword(pool, decoded.idUsuario, hashedPassword);
    if (!rows || rows === 0) throw new Error('No se pudo actualizar la contraseña');
    return { message: 'Contraseña de colaborador actualizada correctamente' };
  }

  throw new Error('Token inválido');
};

