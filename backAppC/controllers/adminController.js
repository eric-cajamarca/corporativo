const sql = require('mssql');
const dbConfig = require('../dbconfig');
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

/** WhatsApp al celular de la empresa (no bloquea la respuesta HTTP). */
function notificarWhatsappLoginAdmin(pool, datosUsuario, ipCliente) {
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
    // 3. Conectar BD (Controller gestiona el lifecycle de la conexión)
    const pool = await sql.connect();

    // 4. Llamar al Service
    const usuarios = await usuarioService.getAdmin(pool, req.user.empresa);
        // 5. Responder HTTP
    res.status(200).send({ data: usuarios });
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
        const pool = await sql.connect(dbConfig);
        const empresaResult = await empresaService.getDatosEmpresaLogin(pool, req.user);
        return res.status(200).send({ active: true, data: empresaResult });
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

    const pool = await sql.connect(dbConfig);
    // Llamar al service
    const resultado = await authService.createAdministrador(pool, req.body, req.user);

    // Respuesta exitosa
    res.status(200).json({
      message: resultado.message,
      data: resultado.rowsAffected
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

    return next(error);
  }
};


// Agrega esta función al archivo existente

const updateAdmin = async (req, res, next) => {
  const { id } = req.params;
  
  try {
    // Validación básica de token
    if (!req.user) {
      return res.status(403).json({ message: 'No Access', data: undefined });
    }

    const pool = await sql.connect(dbConfig);
    // Llamar al service
    const rowsAffected = await authService.updateAdministrador(pool, id, req.body, req.user);

    // Respuesta exitosa
    res.status(200).json({
      message: 'Usuario actualizado correctamente',
      data: rowsAffected
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


// const updateAdmin = async (req, res) => {
//     //   const { name, apellidos, email, password, rol, estado } = req.body;
//     const { nombres, apellidos, password, idRol } = req.body;
//     const { id } = req.params;
//     console.log('updateAdmin rol: ', idRol);

//     if (req.user) {
//         if (req.user.rol == 'Administrador') {
//             try {
//                 console.log('password : ', password);

//                 if (password.trim() == 'sin datos') {

//                     //cuando viene sin password
//                     console.log('cuando viene sin password');

//                     const pool = await sql.connect(dbConfig);
//                     const result = await pool
//                         .request()
//                         .input('idUsuario', sql.UniqueIdentifier, id)
//                         .input('nombres', sql.VarChar, nombres)
//                         .input('apellidos', sql.VarChar, apellidos)
//                         .input('idRol', sql.UniqueIdentifier, idRol)
//                         .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)

//                         .query('UPDATE usuarioWeb SET nombres = @nombres, apellidos = @apellidos, idRol = @idRol WHERE idUsuario = @idUsuario and idEmpresa = @idEmpresa');
//                     res.status(200).send({ message: 'Usuario actualizado correctamente', data: result.rowsAffected });

//                 } else {

//                     //cuando viene con password
//                     console.log('cuando viene con password')
//                     const hashedPassword = await bcrypt.hash(password, 8);

//                     const pool = await sql.connect(dbConfig);
//                     const result = await pool
//                         .request()
//                         .input('idUsuario', sql.UniqueIdentifier, id)
//                         .input('nombres', sql.VarChar, nombres)
//                         .input('apellidos', sql.VarChar, apellidos)
//                         .input('password', sql.Text, hashedPassword)
//                         .input('idRol', sql.UniqueIdentifier, idRol)
//                         .query('UPDATE usuarioWeb SET nombres = @nombres, apellidos = @apellidos, password = @password, idRol = @idRol WHERE idUsuario = @idUsuario');
//                     res.status(200).send({ message: 'Usuario actualizado correctamente', data: result.rowsAffected });

//                 }

//             } catch (error) {
//                 console.error('Error al actualizar un usuario:', error);
//                 res.status(500).send('Error al actualizar un usuario');
//             }
//         } else {
//             res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
//         }
//     }
//     else {
//         res.status(500).send({ message: 'No Access' });
//     }


// };

const obtener_datos_colaborador_admin = async (req, res, next) => {
    const { id } = req.params;
    let data;

        

    if (req.user) {
        //quiero validar si el rol del usuario es administrador
        if (req.user.rol == 'Administrador') {
                        try {

                const pool = await sql.connect(dbConfig);
                const result = await pool
                    .request()
                    .input('idUsuario', sql.UniqueIdentifier, id)
                    
                    .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)
                    .query('SELECT * FROM UsuarioWeb INNER JOIN Rol ON UsuarioWeb.idRol = Rol.idRol WHERE idUsuario = @idUsuario AND UsuarioWeb.idEmpresa = @idEmpresa');
                //.query('SELECT * FROM UsuarioWeb where idUsuario = @idUsuario');



                if (result.recordset.length === 0) {
                    return res.status(404).send({ message: 'Usuario no encontrado', data: undefined });
                }

                // Formatear fecha (regla 1.4: NUNCA retornes fechas sin formatear)
                if (result.recordset[0].fregistro) {
                    result.recordset[0].fregistro = moment(result.recordset[0].fregistro).format('DD-MM-YYYY');
                }

                data = result.recordset;
                res.status(200).send({ data: data });
                //res.json({ data });


            } catch (error) {
                console.error('Error al obtener colaborador admin:', error);
                return next(error);
            }
        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }


    }
    else {
        res.status(500).send({ message: 'No Access' });
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
    const pool = await sql.connect(dbConfig);

    // Llamada al service
    const resultado = await colaboradorService.cambiarEstado(pool,id, data, req.user ,req.user.empresa);

    // Respuesta exitosa
    res.status(200).json({
      message: resultado.message,
      data: { nuevoEstado: resultado.nuevoEstado }
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
    const pool = await sql.connect(dbConfig);

    const loginResult = await authService.adminLogin(pool, email, password, ruc, ipCliente);

    if (loginResult.stage === 'SETUP') {
      const d = loginResult.datosUsuario;
      return res.status(200).send({
        message: 'Configure el código de verificación en dos pasos.',
        data: {
          requiresTwoFactorSetup: true,
          pendingToken: loginResult.pendingToken,
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

    if (loginResult.stage === 'VERIFY') {
      const d = loginResult.datosUsuario;
      return res.status(200).send({
        message: 'Ingrese el código de su aplicación autenticadora.',
        data: {
          requiresTwoFactor: true,
          pendingToken: loginResult.pendingToken,
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
  } catch (error) {
    console.error('Error en login:', error.message);
    if (error.stack) console.error(error.stack);

    try {
      const poolA = await sql.connect(dbConfig);
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
        const pool = await sql.connect(dbConfig);
        const result = await pool
            .request()
            .input('id', sql.Int, id)
            .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)
            .query('DELETE FROM usuarioWeb WHERE id = @id AND idEmpresa = @idEmpresa');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar un Usuario:', error);
        return next(error);
    }
};

const refresh_session = async (req, res, next) => {
  try {
    const pool = await sql.connect(dbConfig);
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
    const pool = await sql.connect(dbConfig);
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
  } catch (e) {
    refreshTokenService.limpiarCookies(res);
    return next(e);
  }
};
  
// const consulCookie= async (req, res) => {
//     const token = req.cookies.token;
//     if (!token) return res.status(401).send({ message: 'No autenticado' });
  
//     try {
//       //const decoded = jwt.verify(token, 'secreto');
//       res.send({ nombre: decoded.nombre, idUsuario: decoded.idUsuario });
//     } catch {
//       res.status(401).send({ message: 'Token inválido' });
//     }
//   };

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
    const pool = await sql.connect(dbConfig);
    await authService.solicitarRecuperacion(pool, ruc.trim(), email.trim());
    res.status(200).send({
      message: 'Si el correo está registrado, recibirá un enlace en su bandeja en los próximos minutos. Revise también la carpeta de spam.',
      data: undefined
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
    console.error('Error recuperar password:', error);
    return next(error);
  }
};

/**
 * POST /restablecer-password
 * Body: { token, newPassword }
 */
const restablecerPassword = async (req, res, next) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).send({ message: 'Token y nueva contraseña son requeridos', data: undefined });
  }

  try {
    const pool = await sql.connect(dbConfig);
    const result = await authService.restablecerPassword(pool, token, newPassword);
    res.status(200).send({ message: result.message, data: undefined });
  } catch (error) {
    if (error.message === 'jwt expired' || error.message === 'Token inválido') {
      return res.status(400).send({ message: 'El enlace ha expirado. Solicite uno nuevo.', data: undefined });
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
    const pool = await sql.connect(dbConfig);
    const decoded = jwtHelper.verifyTwoFactorPendingToken(pendingToken);
    if (decoded.flow !== 'setup') {
      return res.status(400).send({ message: 'Token no válido para configuración', data: undefined });
    }
    const { qrDataUrl } = await twoFactorAdminService.iniciarSetup(pool, decoded);
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
    const pool = await sql.connect(dbConfig);
    const decoded = jwtHelper.verifyTwoFactorPendingToken(pendingToken);
    if (decoded.flow !== 'setup') {
      return res.status(400).send({ message: 'Token no válido para confirmación', data: undefined });
    }
    await twoFactorAdminService.completarSetup(pool, decoded, code);
    const datosUsuario = await authService.construirDatosUsuarioPost2FA(
      pool,
      decoded.idUsuario,
      decoded.idEmpresa,
      decoded.synthetic
    );
    if (!datosUsuario) {
      return res.status(401).send({ message: 'Usuario no válido', data: undefined });
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
    if (esErrorJwt2fa(error)) {
      return res.status(401).send({
        message: 'La verificación en dos pasos expiró. Inicie sesión de nuevo.',
        data: undefined
      });
    }
    if (error.message === 'CODIGO_2FA_INCORRECTO') {
      try {
        const poolA = await sql.connect(dbConfig);
        const dec = jwtHelper.verifyTwoFactorPendingToken(pendingToken);
        await seguridadAuditoriaService.registrar(poolA, req, {
          idEmpresa: dec.idEmpresa,
          idUsuario: dec.idUsuario,
          tipo: 'LOGIN_2FA_FAIL',
          detalle: 'setup',
          ipCliente
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
    const pool = await sql.connect(dbConfig);
    const decoded = jwtHelper.verifyTwoFactorPendingToken(pendingToken);
    if (decoded.flow !== 'verify') {
      return res.status(400).send({ message: 'Token no válido para verificación', data: undefined });
    }
    await twoFactorAdminService.verificarCodigoLogin(pool, decoded, code);
    const datosUsuario = await authService.construirDatosUsuarioPost2FA(
      pool,
      decoded.idUsuario,
      decoded.idEmpresa,
      decoded.synthetic
    );
    if (!datosUsuario) {
      return res.status(401).send({ message: 'Usuario no válido', data: undefined });
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
    if (esErrorJwt2fa(error)) {
      return res.status(401).send({
        message: 'La verificación en dos pasos expiró. Inicie sesión de nuevo.',
        data: undefined
      });
    }
    if (error.message === 'CODIGO_2FA_INCORRECTO') {
      try {
        const poolA = await sql.connect(dbConfig);
        const dec = jwtHelper.verifyTwoFactorPendingToken(pendingToken);
        await seguridadAuditoriaService.registrar(poolA, req, {
          idEmpresa: dec.idEmpresa,
          idUsuario: dec.idUsuario,
          tipo: 'LOGIN_2FA_FAIL',
          detalle: 'verify',
          ipCliente
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
    restablecerPassword
};