const sql = require('mssql');
const dbConfig = require('../dbconfig');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const jwt = require('../helpers/jwt');
const { v4: uuidv4 } = require('uuid');
const usuarioService = require('../services/usuario.service');
const empresaService = require('../services/empresa.service');
const loginService = require('../services/login.service');
const authService = require('../services/auth.service');
const colaboradorService = require('../services/colaborador.service');


const getAdmin = async function (req, res) {
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
    res.status(500).send({ data: undefined, message: 'Error al obtener usuarios' });
  }
};

const getEmpresa_login = async function (req, res) {
    if (!req.user) {
        return res.status(200).send({ active: false, data: null });
    }

    try {
        const pool = await sql.connect(dbConfig);
        const empresaResult = await empresaService.getDatosEmpresaLogin(pool, req.user);
        return res.status(200).send({ active: true, data: empresaResult });
    } catch (error) {
        console.error('Error al obtener datos getEmpresa_login:', error);
        return res.status(500).send({ message: 'Error interno del servidor' });
    }
};


const createAdmin = async (req, res) => {
  
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

    // Error genérico
    res.status(500).json({
      message: 'Error al crear un usuario',
      data: undefined
    });
  }
};


// Agrega esta función al archivo existente

const updateAdmin = async (req, res) => {
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

    // Error genérico
    res.status(500).json({ 
      message: 'Error al actualizar un usuario', 
      data: undefined 
    });
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

const obtener_datos_colaborador_admin = async (req, res) => {
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
                console.error('Error al actualizar un usuario:', error);
                // res.status(500).send('Error al actualizar un usuario');
                res.status(200).send({ message: 'Error al actualizar un usuario', data: undefined });
            }
        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }


    }
    else {
        res.status(500).send({ message: 'No Access' });
    }
};




const cambiar_estado_colaborador_admin = async (req, res) => {
  
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

    // Error genérico
    res.status(500).json({ 
      message: 'Error interno del servidor', 
      data: undefined 
    });
  }
};

const admin_login = async (req, res) => {
  const { email, password, ruc } = req.body;

  // 1. Validación de entrada
  if (!email || !password || !ruc) {
    return res.status(400).send({ message: 'Faltan datos requeridos', data: undefined });
  }

  try {
    // 2. Conectar BD
    const pool = await sql.connect(dbConfig);

    // 3. Llamar al Service (toda la lógica de negocio)
    const datosUsuario = await authService.adminLogin(pool, email, password, ruc);

    // 4. Crear token con datos del usuario
    const token = jwt.createToken(datosUsuario);

    // 5. Establecer cookie HttpOnly (path: '/' para que se envíe en todas las peticiones al origen)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 1 día
    });

    
    // 6. Responder éxito con datos del usuario (sin el token)
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

    res.status(500).send({ message: 'Error interno del servidor', data: undefined });
  }
};


const deleteAdmin = async (req, res) => {
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
        res.status(500).send('Error al eliminar un Usuario');
    }
};

// auth.controller.js
const logout = async (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // solo en HTTPS en producción
      sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax'
    });
    return res.status(200).json({ success: true, message: 'Sesión cerrada exitosamente' });
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
const recuperarPassword = async (req, res) => {
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
    res.status(500).send({ message: 'Error al procesar la solicitud', data: undefined });
  }
};

/**
 * POST /restablecer-password
 * Body: { token, newPassword }
 */
const restablecerPassword = async (req, res) => {
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
    res.status(500).send({ message: 'Error al restablecer la contraseña', data: undefined });
  }
};


module.exports = {
    getAdmin,
    createAdmin,
    updateAdmin,
    deleteAdmin,
    admin_login,
    getEmpresa_login,
    cambiar_estado_colaborador_admin,
    obtener_datos_colaborador_admin,
    logout,
    recuperarPassword,
    restablecerPassword
};