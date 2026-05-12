const { withPool } = require('../utils/dbPool.util');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const usuarioService = require('../services/usuario.service');
const empresaService = require('../services/empresa.service');
const loginService = require('../services/login.service');
const authService = require('../services/auth.service');
const colaboradorService = require('../services/colaborador.service');
const { obtenerIpCliente } = require('../utils/clientIp.util');
const refreshTokenService = require('../services/refreshToken.service');
const seguridadAuditoriaService = require('../services/seguridadAuditoria.service');
const empresaRepository = require('../repositories/empresa.repository');
const jwtHelper = require('../helpers/jwt');
const twoFactorAdminService = require('../services/twoFactorAdmin.service');
const seguridadAlertasService = require('../services/seguridadAlertas.service');
const usuarioAdminService = require('../services/usuarioAdmin.service');

/** WhatsApp al celular de la empresa (admin) o al número de supervisión (superAdmin). No bloquea la respuesta HTTP. */
function notificarWhatsappLoginAdmin(pool, datosUsuario, ipCliente) {
  const rol = (datosUsuario.rol || '').toString();
  if (rol === 'superAdmin') {
    void seguridadAlertasService.notificarLoginSuperAdminExitoso(pool, {
      idEmpresa: datosUsuario.idEmpresa,
      nombres: datosUsuario.nombres,
      apellidos: datosUsuario.apellidos,
      email: datosUsuario.email,
      ipCliente
    });
    return;
  }
  void seguridadAlertasService.notificarLoginAdminExitoso(pool, {
    idEmpresa: datosUsuario.idEmpresa,
    email: datosUsuario.email,
    ipCliente,
    rol: datosUsuario.rol
  });
}
const getAdmin = async function (req, res, next) {
  // 1. Validación de autenticación
  if (!req.user) {
    return res.status(401).send({ message: 'No Access', data: undefined });
  }

  // 2. Validación de rol
  if (req.user.rol !== 'Administrador') {
    return res.status(403).send({ message: 'No tiene permisos', data: undefined });
  }

  try {
    await withPool(async (pool) => {
      const usuarios = await usuarioService.getAdmin(pool, req.user.empresa);
      res.status(200).send({ data: usuarios });
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return next(error);
  }
};

const getEmpresa_login = async function (req, res, next) {
    if (!req.user) {
        return res.status(200).send({ active: false, data: null });
    }

    try {
        await withPool(async (pool) => {
            const empresaResult = await empresaService.getDatosEmpresaLogin(pool, req.user);
            return res.status(200).send({ active: true, data: empresaResult });
        });
    } catch (error) {
        console.error('Error al obtener datos getEmpresa_login:', error);
        return next(error);
    }
};


const createAdmin = async (req, res, next) => {
  
  try {
    // Validación básica de token
    if (!req.user) {
      return res.status(403).json({ data: undefined, message: 'No Access' });
    }

    await withPool(async (pool) => {
      const resultado = await authService.createAdministrador(pool, req.body, req.user);
      res.status(200).json({
        message: resultado.message,
        data: resultado.rowsAffected
      });
    });

  } catch (error) {
    console.error('Error en createAdmin:', error.message);

    // Manejo de errores específicos
    if (error.message === 'PERMISO_DENEGADO') {
      return res.status(403).json({
        message: 'No tiene permisos para realizar esta acción',
        data: undefined
      });
    }

    if (error.message === 'EMAIL_EXISTE') {
      return res.status(200).json({
        message: 'El email ya existe. Por favor elija otro.',
        data: undefined
      });
    }

    if (error.message === 'PLAN_LIMITE_USUARIOS') {
      return res.status(403).json({
        message:
          'Ha alcanzado el número máximo de usuarios permitido por su plan. Actualice el plan para agregar más colaboradores.',
        data: undefined
      });
    }

    return next(error);
  }
};

const updateAdmin = async (req, res, next) => {
  const { id } = req.params;
  
  try {
    // Validación básica de token
    if (!req.user) {
      return res.status(403).json({ message: 'No Access', data: undefined });
    }

    await withPool(async (pool) => {
      const rowsAffected = await authService.updateAdministrador(pool, id, req.body, req.user);
      res.status(200).json({
        message: 'Usuario actualizado correctamente',
        data: rowsAffected
      });
    });

  } catch (error) {
    console.error('Error en updateAdmin:', error.message);

    // Manejo de errores específicos
    if (error.message === 'PERMISO_DENEGADO') {
      return res.status(403).json({ 
        message: 'No tiene permisos para realizar esta acción', 
        data: undefined 
      });
    }

    return next(error);
  }
};

const obtener_datos_colaborador_admin = async (req, res, next) => {
  const { id } = req.params;
  if (!req.user) {
    return res.status(500).send({ message: 'No Access' });
  }
  try {
    await withPool(async (pool) => {
      const row = await usuarioAdminService.obtenerColaboradorConRol(pool, req.user, id);
      res.status(200).send({ data: [row] });
    });
  } catch (error) {
    if (error.message === 'NO_PERM' || error.message === 'NO_PERMISSIONS') {
      return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    if (error.code === 'NOT_FOUND') {
      return res.status(404).send({ message: 'Usuario no encontrado', data: undefined });
    }
    console.error('Error al obtener colaborador admin:', error);
    return next(error);
  }
};




const cambiar_estado_colaborador_admin = async (req, res, next) => {
  
  // Validación básica de autenticación
  if (!req.user) {
    return res.status(403).json({ data: undefined, message: 'NoToken' });
  }

  try {
    const id = req.params.id;
    const data = req.body;
    await withPool(async (pool) => {
      const resultado = await colaboradorService.cambiarEstado(pool,id, data, req.user ,req.user.empresa);
      res.status(200).json({
        message: resultado.message,
        data: { nuevoEstado: resultado.nuevoEstado }
      });
    });

  } catch (error) {
    console.error('Error en controller:', error.message);

    // Manejo específico de errores
    if (error.message === 'PERMISO_DENEGADO') {
      return res.status(403).json({ 
        message: 'No tiene permisos para realizar esta acción', 
        data: undefined 
      });
    }

    return next(error);
  }
};

const admin_login = async (req, res, next) => {
  const { email, password, ruc } = req.body;

  // 1. Validación de entrada
  if (!email || !password || !ruc) {
    return res.status(400).send({ message: 'Faltan datos requeridos', data: undefined });
  }

  const ipCliente = obtenerIpCliente(req);

  try {
    const loginOutcome = await withPool(async (pool) => {
      const loginResult = await authService.adminLogin(pool, email, password, ruc, ipCliente);

      if (loginResult.stage === 'SETUP') {
        return { kind: 'SETUP', loginResult };
      }
      if (loginResult.stage === 'VERIFY') {
        return { kind: 'VERIFY', loginResult };
      }

      const datosUsuario = loginResult.datosUsuario;
      await refreshTokenService.emitirSesion(pool, datosUsuario, res, req);
      await seguridadAuditoriaService.registrar(pool, req, {
        idEmpresa: datosUsuario.idEmpresa,
        idUsuario: datosUsuario.idUsuario,
        tipo: 'LOGIN_OK',
        detalle: null,
        ipCliente
      });
      notificarWhatsappLoginAdmin(pool, datosUsuario, ipCliente);
      return { kind: 'OK', datosUsuario };
    });

    if (loginOutcome.kind === 'SETUP') {
      const d = loginOutcome.loginResult.datosUsuario;
      return res.status(200).send({
        message: 'Configure el código de verificación en dos pasos.',
        data: {
          requiresTwoFactorSetup: true,
          pendingToken: loginOutcome.loginResult.pendingToken,
          idUsuario: d.idUsuario,
          idEmpresa: d.idEmpresa,
          razonSocial: d.razonSocial,
          nombres: d.nombres,
          apellidos: d.apellidos,
          email: d.email,
          rol: d.rol
        }
      });
    }

    if (loginOutcome.kind === 'VERIFY') {
      const d = loginOutcome.loginResult.datosUsuario;
      return res.status(200).send({
        message: 'Ingrese el código de su aplicación autenticadora.',
        data: {
          requiresTwoFactor: true,
          pendingToken: loginOutcome.loginResult.pendingToken,
          idUsuario: d.idUsuario,
          idEmpresa: d.idEmpresa,
          razonSocial: d.razonSocial,
          nombres: d.nombres,
          apellidos: d.apellidos,
          email: d.email,
          rol: d.rol
        }
      });
    }

    const { idUsuario, idEmpresa, razonSocial, nombres, apellidos, email: userEmail, rol } =
      loginOutcome.datosUsuario;
    return res.status(200).send({
      message: 'Login exitoso',
      data: {
        idUsuario,
        idEmpresa,
        razonSocial,
        nombres,
        apellidos,
        email: userEmail,
        rol
      }
    });
  } catch (error) {
    console.error('Error en login:', error.message);
    if (error.stack) console.error(error.stack);

    try {
      await withPool(async (poolA) => {
        let idEmpresaAud = null;
        if (ruc && String(ruc).trim()) {
          const emp = await empresaRepository.buscarPorRuc(poolA, String(ruc).trim());
          if (emp) idEmpresaAud = emp.idEmpresa;
        }
        const tipoAud =
          error.message === 'LOGIN_BLOQUEADO_TEMPORAL' ? 'LOGIN_BLOQUEADO' : 'LOGIN_FAIL';
        await seguridadAuditoriaService.registrar(poolA, req, {
          idEmpresa: idEmpresaAud,
          tipo: tipoAud,
          detalle: String(error.message).slice(0, 500),
          ipCliente
        });
      });
    } catch (audErr) {
      console.error('Auditoría login fallido:', audErr.message);
    }

    if (error.message === 'LOGIN_BLOQUEADO_TEMPORAL') {
      return res.status(429).send({
        message:
          'Demasiados intentos fallidos. El acceso está bloqueado temporalmente. Si necesita ayuda, contacte a soporte.',
        data: undefined
      });
    }

    if (error.message === 'Faltan datos requeridos') {
      return res.status(400).send({ message: error.message, data: undefined });
    }

    // Errores de negocio → 401
    const mensajes401 = [
      'RUC no existe o empresa inactiva',
      'El email no existe o no tiene permisos para acceder',
      'La contraseña es incorrecta',
      'El usuario está deshabilitado. Contacte al administrador.'
    ];
    if (mensajes401.includes(error.message)) {
      return res.status(401).send({ message: error.message, data: undefined });
    }

    return next(error);
  }
};


const deleteAdmin = async (req, res, next) => {
    const { id } = req.params;

    // Validación crítica: SIEMPRE filtra por idEmpresa (regla 1.6)
    if (!req.user || !req.user.empresa) {
        return res.status(401).json({ message: 'No autorizado' });
    }

    try {
        await withPool(async (pool) => {
            await usuarioAdminService.eliminarUsuarioWebLegacy(pool, id, req.user.empresa);
            res.json({ message: 'Usuario eliminado correctamente' });
        });
    } catch (error) {
        if (error.code === 'NOT_FOUND') {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        console.error('Error al eliminar un Usuario:', error);
        return next(error);
    }
};

const refresh_session = async (req, res, next) => {
  try {
    await withPool(async (pool) => {
      const { datosUsuario } = await refreshTokenService.rotarSesion(
        pool,
        req.cookies && req.cookies.refreshToken,
        res,
        req
      );
      await seguridadAuditoriaService.registrar(pool, req, {
        idEmpresa: datosUsuario.idEmpresa,
        idUsuario: datosUsuario.idUsuario,
        tipo: 'REFRESH_TOKEN',
        detalle: null,
        ipCliente: obtenerIpCliente(req)
      });
      return res.status(200).json({ success: true, message: 'Sesión renovada' });
    });
  } catch (err) {
    if (err.message && String(err.message).startsWith('REFRESH_')) {
      refreshTokenService.limpiarCookies(res);
      return res.status(401).json({
        message: 'Sesión expirada. Inicie sesión de nuevo.',
        data: undefined
      });
    }
    return next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    await withPool(async (pool) => {
      if (req.cookies && req.cookies.refreshToken) {
        await refreshTokenService.revocarPorTokenRaw(pool, req.cookies.refreshToken);
      } else if (req.user && req.user.sub && req.user.empresa) {
        await refreshTokenService.revocarTodosUsuarioEmpresa(pool, req.user.sub, req.user.empresa);
      }
      if (req.user && req.user.sub && req.user.empresa) {
        await seguridadAuditoriaService.registrar(pool, req, {
          idEmpresa: req.user.empresa,
          idUsuario: req.user.sub,
          tipo: 'LOGOUT',
          ipCliente: obtenerIpCliente(req)
        });
      }
      refreshTokenService.limpiarCookies(res);
      return res.status(200).json({ success: true, message: 'Sesión cerrada exitosamente' });
    });
  } catch (e) {
    refreshTokenService.limpiarCookies(res);
    return next(e);
  }
};

/**
 * POST /recuperar-password
 * Body: { ruc, email }
 * Genera token de recuperación (válido 15 min). No revela si el email existe.
 */
const recuperarPassword = async (req, res, next) => {
  const { ruc, email } = req.body || {};
  if (!ruc || !email) {
    return res.status(400).send({ message: 'RUC y correo son requeridos', data: undefined });
  }

  try {
    await withPool(async (pool) => {
      await authService.solicitarRecuperacion(pool, ruc.trim(), email.trim());
      res.status(200).send({
        message: 'Si el correo está registrado, recibirá un enlace en su bandeja en los próximos minutos. Revise también la carpeta de spam.',
        data: undefined
      });
    });
  } catch (error) {
    if (error.message === 'RUC_NO_ENCONTRADO') {
      return res.status(400).send({ message: 'RUC no encontrado o empresa inactiva', data: undefined });
    }
    if (error.message === 'EMAIL_NO_COINCIDE') {
      return res.status(400).send({ message: 'No existe una cuenta con ese RUC y correo', data: undefined });
    }
    if (error.message && error.message.includes('SMTP no configurado') && process.env.NODE_ENV !== 'development') {
      return res.status(503).send({ message: 'El envío de correo no está configurado. Contacte al administrador.', data: undefined });
    }
    if (error.message === 'ERROR_ENVIO_CORREO') {
      return res.status(503).send({
        message: 'No se pudo enviar el correo en este momento. Intente más tarde o contacte al administrador.',
        data: undefined
      });
    }
    console.error('Error recuperar password:', error);
    return next(error);
  }
};

/**
 * POST /restablecer-password
 * Body: { token, newPassword }
 */
const listarSesionesDispositivos = async (req, res, next) => {
  if (!req.user || !req.user.sub || !req.user.empresa) {
    return res.status(401).json({ message: 'No autorizado', data: undefined });
  }
  try {
    await withPool(async (pool) => {
      const data = await refreshTokenService.listarSesionesDispositivos(
        pool,
        req.user.sub,
        req.user.empresa,
        req.cookies && req.cookies.refreshToken
      );
      res.status(200).json({ message: 'OK', data });
    });
  } catch (error) {
    console.error('listarSesionesDispositivos:', error.message);
    return next(error);
  }
};

const revocarSesionDispositivo = async (req, res, next) => {
  const { idRefresh } = req.params;
  if (!req.user || !req.user.sub || !req.user.empresa) {
    return res.status(401).json({ message: 'No autorizado', data: undefined });
  }
  if (!idRefresh) {
    return res.status(400).json({ message: 'idRefresh requerido', data: undefined });
  }
  try {
    await withPool(async (pool) => {
      const { cerroCookies } = await refreshTokenService.revocarSesionDispositivoYcookiesSiActual(
        pool,
        idRefresh,
        req.user.sub,
        req.user.empresa,
        req.cookies && req.cookies.refreshToken,
        res
      );
      await seguridadAuditoriaService.registrar(pool, req, {
        idEmpresa: req.user.empresa,
        idUsuario: req.user.sub,
        tipo: 'SESION_REVOCADA',
        detalle: String(idRefresh).slice(0, 80),
        ipCliente: obtenerIpCliente(req)
      });
      res.status(200).json({ message: 'Sesión cerrada', data: { cerroCookies } });
    });
  } catch (error) {
    if (error.message === 'SESION_NO_ENCONTRADA') {
      return res.status(404).json({ message: 'Sesión no encontrada', data: undefined });
    }
    console.error('revocarSesionDispositivo:', error.message);
    return next(error);
  }
};

const revocarOtrasSesionesDispositivos = async (req, res, next) => {
  if (!req.user || !req.user.sub || !req.user.empresa) {
    return res.status(401).json({ message: 'No autorizado', data: undefined });
  }
  try {
    await withPool(async (pool) => {
      await refreshTokenService.revocarOtrasSesionesDispositivos(
        pool,
        req.user.sub,
        req.user.empresa,
        req.cookies && req.cookies.refreshToken
      );
      await seguridadAuditoriaService.registrar(pool, req, {
        idEmpresa: req.user.empresa,
        idUsuario: req.user.sub,
        tipo: 'SESIONES_OTRAS_REVOCADAS',
        detalle: null,
        ipCliente: obtenerIpCliente(req)
      });
      res.status(200).json({ message: 'Otras sesiones cerradas', data: { success: true } });
    });
  } catch (error) {
    if (error.message === 'REFRESH_NO_EN_COOKIES') {
      return res.status(400).json({
        message: 'No hay cookie de sesión en este navegador; no se pudo conservar la sesión actual.',
        data: undefined
      });
    }
    console.error('revocarOtrasSesionesDispositivos:', error.message);
    return next(error);
  }
};

const restablecerPassword = async (req, res, next) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).send({ message: 'Token y nueva contraseña son requeridos', data: undefined });
  }

  try {
    await withPool(async (pool) => {
      const result = await authService.restablecerPassword(pool, token, newPassword);
      res.status(200).send({ message: result.message, data: undefined });
    });
  } catch (error) {
    if (
      error.name === 'TokenExpiredError' ||
      error.message === 'jwt expired' ||
      error.message === 'Token inválido' ||
      error.name === 'JsonWebTokenError'
    ) {
      return res.status(400).send({
        message: 'El enlace no es válido o ha expirado. Solicite uno nuevo desde la pantalla de recuperación.',
        data: undefined
      });
    }
    if (error.message === 'La contraseña debe tener al menos 6 caracteres') {
      return res.status(400).send({ message: error.message, data: undefined });
    }
    console.error('Error restablecer password:', error);
    return next(error);
  }
};

function esErrorJwt2fa(err) {
  if (!err) return false;
  if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') return true;
  const m = String(err.message || '');
  return m === 'jwt expired' || m.includes('Token 2FA');
}

const admin_2fa_setup_init = async (req, res, next) => {
  const { pendingToken } = req.body || {};
  if (!pendingToken) {
    return res.status(400).send({ message: 'Token pendiente requerido', data: undefined });
  }
  try {
    const decoded = jwtHelper.verifyTwoFactorPendingToken(pendingToken);
    if (decoded.flow !== 'setup') {
      return res.status(400).send({ message: 'Token no válido para configuración', data: undefined });
    }
    const { qrDataUrl } = await withPool(async (pool) =>
      twoFactorAdminService.iniciarSetup(pool, decoded)
    );
    return res.status(200).send({ message: 'OK', data: { qrDataUrl } });
  } catch (error) {
    if (esErrorJwt2fa(error)) {
      return res.status(401).send({
        message: 'La verificación en dos pasos expiró. Inicie sesión de nuevo.',
        data: undefined
      });
    }
    if (error.message === '2FA_YA_ACTIVO') {
      return res.status(400).send({ message: 'El segundo factor ya está activo.', data: undefined });
    }
    console.error('admin_2fa_setup_init:', error.message);
    return next(error);
  }
};

const admin_2fa_setup_confirm = async (req, res, next) => {
  const { pendingToken, code } = req.body || {};
  if (!pendingToken || code === undefined || code === null || String(code).trim() === '') {
    return res.status(400).send({ message: 'Token y código son requeridos', data: undefined });
  }
  const ipCliente = obtenerIpCliente(req);
  try {
    const decoded = jwtHelper.verifyTwoFactorPendingToken(pendingToken);
    if (decoded.flow !== 'setup') {
      return res.status(400).send({ message: 'Token no válido para confirmación', data: undefined });
    }
    await withPool(async (pool) => {
      await twoFactorAdminService.completarSetup(pool, decoded, code);
      const datosUsuario = await authService.construirDatosUsuarioPost2FA(
        pool,
        decoded.idUsuario,
        decoded.idEmpresa,
        decoded.synthetic
      );
      if (!datosUsuario) {
        throw Object.assign(new Error('USUARIO_NO_VALIDO_2FA'), { __status401: true });
      }
      await refreshTokenService.emitirSesion(pool, datosUsuario, res, req);
      await seguridadAuditoriaService.registrar(pool, req, {
        idEmpresa: datosUsuario.idEmpresa,
        idUsuario: datosUsuario.idUsuario,
        tipo: 'LOGIN_OK',
        detalle: '2FA_SETUP_OK',
        ipCliente
      });
      notificarWhatsappLoginAdmin(pool, datosUsuario, ipCliente);
      const { idUsuario, idEmpresa, razonSocial, nombres, apellidos, email: userEmail, rol } = datosUsuario;
      res.status(200).send({
        message: 'Login exitoso',
        data: {
          idUsuario,
          idEmpresa,
          razonSocial,
          nombres,
          apellidos,
          email: userEmail,
          rol
        }
      });
    });
  } catch (error) {
    if (error && error.__status401 && error.message === 'USUARIO_NO_VALIDO_2FA') {
      return res.status(401).send({ message: 'Usuario no válido', data: undefined });
    }
    if (esErrorJwt2fa(error)) {
      return res.status(401).send({
        message: 'La verificación en dos pasos expiró. Inicie sesión de nuevo.',
        data: undefined
      });
    }
    if (error.message === 'CODIGO_2FA_INCORRECTO') {
      try {
        await withPool(async (poolA) => {
          const dec = jwtHelper.verifyTwoFactorPendingToken(pendingToken);
          await seguridadAuditoriaService.registrar(poolA, req, {
            idEmpresa: dec.idEmpresa,
            idUsuario: dec.idUsuario,
            tipo: 'LOGIN_2FA_FAIL',
            detalle: 'setup',
            ipCliente
          });
        });
      } catch (audErr) {
        console.error('Auditoría 2FA:', audErr.message);
      }
      return res.status(401).send({ message: 'Código incorrecto', data: undefined });
    }
    if (error.message === '2FA_YA_ACTIVO' || error.message === '2FA_SIN_SECRETO') {
      return res.status(400).send({ message: error.message, data: undefined });
    }
    console.error('admin_2fa_setup_confirm:', error.message);
    return next(error);
  }
};

const admin_2fa_verify = async (req, res, next) => {
  const { pendingToken, code } = req.body || {};
  if (!pendingToken || code === undefined || code === null || String(code).trim() === '') {
    return res.status(400).send({ message: 'Token y código son requeridos', data: undefined });
  }
  const ipCliente = obtenerIpCliente(req);
  try {
    const decoded = jwtHelper.verifyTwoFactorPendingToken(pendingToken);
    if (decoded.flow !== 'verify') {
      return res.status(400).send({ message: 'Token no válido para verificación', data: undefined });
    }
    await withPool(async (pool) => {
      await twoFactorAdminService.verificarCodigoLogin(pool, decoded, code);
      const datosUsuario = await authService.construirDatosUsuarioPost2FA(
        pool,
        decoded.idUsuario,
        decoded.idEmpresa,
        decoded.synthetic
      );
      if (!datosUsuario) {
        throw Object.assign(new Error('USUARIO_NO_VALIDO_2FA'), { __status401: true });
      }
      await refreshTokenService.emitirSesion(pool, datosUsuario, res, req);
      await seguridadAuditoriaService.registrar(pool, req, {
        idEmpresa: datosUsuario.idEmpresa,
        idUsuario: datosUsuario.idUsuario,
        tipo: 'LOGIN_OK',
        detalle: '2FA_VERIFY_OK',
        ipCliente
      });
      notificarWhatsappLoginAdmin(pool, datosUsuario, ipCliente);
      const { idUsuario, idEmpresa, razonSocial, nombres, apellidos, email: userEmail, rol } = datosUsuario;
      res.status(200).send({
        message: 'Login exitoso',
        data: {
          idUsuario,
          idEmpresa,
          razonSocial,
          nombres,
          apellidos,
          email: userEmail,
          rol
        }
      });
    });
  } catch (error) {
    if (error && error.__status401 && error.message === 'USUARIO_NO_VALIDO_2FA') {
      return res.status(401).send({ message: 'Usuario no válido', data: undefined });
    }
    if (esErrorJwt2fa(error)) {
      return res.status(401).send({
        message: 'La verificación en dos pasos expiró. Inicie sesión de nuevo.',
        data: undefined
      });
    }
    if (error.message === 'CODIGO_2FA_INCORRECTO') {
      try {
        await withPool(async (poolA) => {
          const dec = jwtHelper.verifyTwoFactorPendingToken(pendingToken);
          await seguridadAuditoriaService.registrar(poolA, req, {
            idEmpresa: dec.idEmpresa,
            idUsuario: dec.idUsuario,
            tipo: 'LOGIN_2FA_FAIL',
            detalle: 'verify',
            ipCliente
          });
        });
      } catch (audErr) {
        console.error('Auditoría 2FA:', audErr.message);
      }
      return res.status(401).send({ message: 'Código incorrecto', data: undefined });
    }
    if (error.message === '2FA_NO_CONFIGURADO' || error.message === '2FA_FLUJO_INVALIDO') {
      return res.status(400).send({ message: 'No se pudo validar el segundo factor.', data: undefined });
    }
    console.error('admin_2fa_verify:', error.message);
    return next(error);
  }
};


module.exports = {
    getAdmin,
    createAdmin,
    updateAdmin,
    deleteAdmin,
    admin_login,
    admin_2fa_setup_init,
    admin_2fa_setup_confirm,
    admin_2fa_verify,
    refresh_session,
    getEmpresa_login,
    cambiar_estado_colaborador_admin,
    obtener_datos_colaborador_admin,
    logout,
    recuperarPassword,
    restablecerPassword,
    listarSesionesDispositivos,
    revocarSesionDispositivo,
    revocarOtrasSesionesDispositivos
};