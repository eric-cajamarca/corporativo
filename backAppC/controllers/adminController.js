const sql = require('mssql');
const dbConfig = require('../dbconfig');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const jwt = require('../helpers/jwt');
const { v4: uuidv4 } = require('uuid');
//const usuarioService = require('../services/usuario.service');
const empresaService = require('../services/empresa.service');
const loginService = require('../services/login.service');
const authService = require('../services/auth.service');

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
    res.status(500).send({ data: undefined });
  }
};

// const getAdmin = async function (req, res) {

//     if (req.user) {

//         if (req.user.rol == 'Administrador') {

//             //  if(req.user.rol=='Administrador'){
//             console.log('req.user.rol', req.user.rol);
//             try {
//                 const pool = await sql.connect(dbConfig);
//                 const result = await pool
//                     .request()
//                     .input('empresa', sql.UniqueIdentifier, req.user.empresa)
//                     .query('SELECT * FROM UsuarioWeb UW INNER JOIN Rol R ON UW.idRol = R.idRol WHERE UW.idEmpresa = @empresa')
//                 //.query('SELECT * FROM UsuarioWeb INNER JOIN Rol ON UsuarioWeb.idRol = Rol.idRol where UsuarioWeb.estado = 1 and idEmpresa = @empresa');
//                 // res.json(result.recordset);
//                 // console.log('result.recordset');
//                 // console.log(result.recordset);
//                 res.status(200).send({ data: result.recordset });
//             } catch (error) {
//                 console.error('Error al obtener los usuarios:', error);
//                 res.status(200).send({ data: undefined });
//             }

//         } else {
//             res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
//         }
//     }
//     else {
//         res.status(500).send({ message: 'No Access', data: undefined });
//     }
// };


// const getEmpresa_login = async function (req, res) {
//   const { ruc, email, password } = req.body;

//   // 1. Validación de entrada
//   if (!ruc || !email || !password) {
//     return res.status(400).send({ message: 'Faltan datos: ruc, email y password requeridos' });
//   }

//   try {
//     // 2. Conectar BD
//     const pool = await sql.connect(dbConfig);

//     // 3. Llamar al Service (toda la lógica de negocio)
//     const datosUsuario = await loginService.autenticar(pool, ruc, email, password);

//     // 4. Generar token JWT
//     const token = jwt.sign(datosUsuario, process.env.JWT_SECRET, { expiresIn: '1d' });

//     // 5. Responder con éxito
//     res.status(200).send({ 
//       message: 'Login exitoso', 
//       data: { 
//         token, 
//         usuario: datosUsuario 
//       } 
//     });

//   } catch (error) {
//     console.error('Error en login:', error);
    
//     // Manejar errores específicos del Service
//     if (error.message === 'RUC no existe' || 
//         error.message === 'Usuario no existe' || 
//         error.message === 'Usuario no pertenece a esta empresa' || 
//         error.message === 'Contraseña incorrecta') {
//       return res.status(401).send({ message: 'Credenciales inválidas', data: undefined });
//     }
    
//     res.status(500).send({ message: 'Error interno del servidor', data: undefined });
//   }
// };



const getEmpresa_login = async function (req, res) {
    console.log('getEmpresa_login req.user: ', req.user);
    if (!req.user) {
        return res.status(401).send({ message: 'No autenticado' });
    }

    console.log('Obteniendo datos para usuario:', req.user);
    const data = {};

    try {
        const pool = await sql.connect(dbConfig);
        
        // Obtener datos de la empresa
        const empresaResult = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)
            .query('SELECT razon_Social FROM Empresas WHERE idEmpresa = @idEmpresa');
        
        if (empresaResult.recordset.length > 0) {
            data.razonSocial = empresaResult.recordset[0].razon_Social;
            data.nombres = req.user.nombres + ' ' + req.user.apellidos;
            data.roles = req.user.rol;
        }
        
        console.log('Datos obtenidos en getempresa_login:', data);
        // Verificar si obtuvimos al menos algún dato
        if (!data.razonSocial && !data.nombres) {
            return res.status(404).send({ message: 'No se encontraron datos para el usuario/empresa',data: undefined });
        }

        return res.status(200).send({ data });
        
    } catch (error) {
        console.error('Error al obtener datos:', error);
        return res.status(500).send({ message: 'Error interno del servidor' });
    }
};

const createAdmin = async (req, res) => {
    const { nombres, apellidos, email, password, idRol, estado } = req.body;
    console.log('createAdmin req.body: ', req.body);

    const currentDate = moment().format('YYYY-MM-DD');
    const fregistro = currentDate;

    if (req.user) {
        if (req.user.rol == 'Administrador') {
            const pool = await sql.connect(dbConfig);

            // Verificar si el correo electrónico ya existe
            const checkEmailQuery = await pool
                .request()
                .input('email', sql.VarChar, email)
                .query('SELECT * FROM usuarioWeb WHERE email = @email');

            if (checkEmailQuery.recordset.length > 0) {
                return res.status(200).send({ message: 'El email ya existe. Por favor elija otro.', data: undefined });
            } else {
                try {
                    const hashedPassword = await bcrypt.hash(password, 8); // El número 10 es el factor de coste para el cifrado
                    //crear el idUsuario con uuidv4
                    const idUsuario = uuidv4();


                    const pool = await sql.connect(dbConfig);
                    const result = await pool
                        .request()
                        .input('idUsuario', sql.UniqueIdentifier, idUsuario)
                        .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)
                        .input('nombres', sql.VarChar, nombres)
                        .input('apellidos', sql.VarChar, apellidos)
                        .input('email', sql.VarChar, email)
                        .input('password', sql.Text, hashedPassword)
                        .input('idRol', sql.VarChar, idRol)
                        .input('estado', sql.Bit, estado)
                        .input('fregistro', sql.Date, fregistro)
                        .query('INSERT INTO usuarioWeb (idUsuario, idEmpresa ,nombres, apellidos, email, password, idRol, estado, fregistro) VALUES (@idUsuario, @idEmpresa, @nombres, @apellidos, @email, @password, @idRol, @estado, @fregistro)');
                    // res.json({ message: 'Usuario creado correctamente' });}
                    console.log('valor de result:', result.rowsAffected);
                    let data = result.rowsAffected
                    res.status(200).send({ message: 'Usuario creado correctamente', data: data });
                } catch (error) {
                    console.error('Error al crear un usuario:', error);
                    res.status(200).send({ message: 'Error al crear un usuario', data: undefined });
                }
            }
        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }





};

const updateAdmin = async (req, res) => {
    //   const { name, apellidos, email, password, rol, estado } = req.body;
    const { nombres, apellidos, password, idRol } = req.body;
    const { id } = req.params;
    console.log('updateAdmin rol: ', idRol);

    if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                console.log('password : ', password);

                if (password.trim() == 'sin datos') {

                    //cuando viene sin password
                    console.log('cuando viene sin password');

                    const pool = await sql.connect(dbConfig);
                    const result = await pool
                        .request()
                        .input('idUsuario', sql.UniqueIdentifier, id)
                        .input('nombres', sql.VarChar, nombres)
                        .input('apellidos', sql.VarChar, apellidos)
                        .input('idRol', sql.UniqueIdentifier, idRol)
                        .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)

                        .query('UPDATE usuarioWeb SET nombres = @nombres, apellidos = @apellidos, idRol = @idRol WHERE idUsuario = @idUsuario and idEmpresa = @idEmpresa');
                    res.status(200).send({ message: 'Usuario actualizado correctamente', data: result.rowsAffected });

                } else {

                    //cuando viene con password
                    console.log('cuando viene con password')
                    const hashedPassword = await bcrypt.hash(password, 8);

                    const pool = await sql.connect(dbConfig);
                    const result = await pool
                        .request()
                        .input('idUsuario', sql.UniqueIdentifier, id)
                        .input('nombres', sql.VarChar, nombres)
                        .input('apellidos', sql.VarChar, apellidos)
                        .input('password', sql.Text, hashedPassword)
                        .input('idRol', sql.UniqueIdentifier, idRol)
                        .query('UPDATE usuarioWeb SET nombres = @nombres, apellidos = @apellidos, password = @password, idRol = @idRol WHERE idUsuario = @idUsuario');
                    res.status(200).send({ message: 'Usuario actualizado correctamente', data: result.rowsAffected });

                }

            } catch (error) {
                console.error('Error al actualizar un usuario:', error);
                res.status(500).send('Error al actualizar un usuario');
            }
        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }


};

const obtener_datos_colaborador_admin = async (req, res) => {
    const { id } = req.params;
    let data;

    console.log('obtener_datos_colaborador_admin = id: ', id);
    console.log('req.params antes de validar el usuario: ', req.user);


    if (req.user) {
        //quiero validar si el rol del usuario es administrador
        if (req.user.rol == 'Administrador') {
            console.log('despues de validar el user.rol: ', req.user.rol);
            try {

                const pool = await sql.connect(dbConfig);
                const result = await pool
                    .request()
                    .input('idUsuario', sql.UniqueIdentifier, id)
                    
                    .query('SELECT * FROM UsuarioWeb INNER JOIN Rol ON UsuarioWeb.idRol = Rol.idRol where idUsuario = @idUsuario');
                //.query('SELECT * FROM UsuarioWeb where idUsuario = @idUsuario');



                //despues del codigo anterior no puedo optener respuesta a la consulta
                console.log('result.recordset: ', result.recordset);
                console.log('result.recordset: ', result.recordset[0].idUsuario);

                //quiero convertir el result.recordset.fregistro a un formato de fecha mas amigable
                let fecha = result.recordset[0].fregistro;
                let fecha2 = moment(fecha).format('DD-MM-YYYY');
                console.log('fecha2: ', fecha2);
                result.recordset[0].fregistro = fecha2;
                console.log('result.recordset[0].fregistro: ', result.recordset[0].fregistro);


                data = result.recordset;
                console.log('data: ', data);
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

const cambiar_estado_colaborador_admin = async function (req, res) {

    console.log('cambiar_estado_colaborador_admin: ', req.params);
    if (req.user) {

        //quiero validar si el rol del usuario es administrador
        if (req.user.rol == 'Administrador') {

            let id = req.params['id'];
            let data = req.body;
            let estado = data.estado;

            let nuevo_estado;

            // console.log('cambiar_estado_colaborador_admin: ', data);
            // console.log('id: ', id);


            if (data.estado) {
                nuevo_estado = false;
            } else if (!data.estado) {
                nuevo_estado = true;
            }

            console.log('nuevo estado: ', nuevo_estado);

            const pool = await sql.connect(dbConfig);
            const result = await pool
                .request()
                .input('idUsuario', sql.UniqueIdentifier, id)
                .input('estado', sql.Bit, nuevo_estado)
                .query('UPDATE usuarioWeb SET estado = @estado WHERE idUsuario = @idUsuario');
            console.log(result.recordset);
            res.status(200).send({ data: result.recordset });
        } else {
            console.log('no es administrador');
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }



    } else {
        res.status(403).send({ data: undefined, message: 'NoToken' });
    }
}

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
    console
    // 4. Crear token
    const token = jwt.createToken(datosUsuario);

    // 5. Establecer cookie HttpOnly (estás seguro porque ya validaste credenciales)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 día
    });

    // 6. Responder éxito (NO enviar token en JSON)
    res.status(200).send({ message: 'Login exitoso', data: {} });

  } catch (error) {
    console.error('Error en login:', error);
    
    // Manejar errores específicos del Service
    if (error.message === 'RUC no existe' || 
        error.message === 'El email no existe o no tiene permisos para acceder' ||
        error.message === 'La contraseña es incorrecta') {
      return res.status(401).send({ message: error.message, data: undefined });
    }
    
    res.status(500).send({ message: 'Error interno del servidor', data: undefined });
  }
};

// const admin_login = async (req, res) => {
//     const { email, password, ruc } = req.body;
//     const estado = true;

//     try {
//         const pool = await sql.connect(dbConfig);

//         // Validar RUC
//         const empresaQuery = await pool
//             .request()
//             .input('ruc', sql.VarChar, ruc)
//             .query('SELECT * FROM Empresas WHERE ruc = @ruc');

//         if (empresaQuery.recordset.length === 0) {
//             return res.status(404).send({ message: 'El RUC no existe', data: undefined });
//         }

//         const empresa = empresaQuery.recordset[0];

//         // Validar email y estado
//         const userQuery = await pool
//             .request()
//             .input('idEmpresa', sql.UniqueIdentifier, empresa.idEmpresa)
//             .input('email', sql.VarChar, email)
//             .input('estado', sql.Bit, estado)
//             .query(`
//                 SELECT * 
//                 FROM usuarioWeb 
//                 INNER JOIN Rol ON UsuarioWeb.idRol = Rol.idRol 
//                 WHERE UsuarioWeb.email = @email 
//                   AND UsuarioWeb.estado = @estado 
//                   AND UsuarioWeb.idEmpresa = @idEmpresa
//             `);

//         if (userQuery.recordset.length === 0) {
//             return res.status(401).send({ message: 'El email no existe o usted no tiene permisos para acceder', data: undefined });
//         }

//         const user = userQuery.recordset[0];

//         // Verificar contraseña
//         const isMatch = await bcrypt.compare(password, user.password);

//         if (!isMatch) {
//             return res.status(401).send({ message: 'La contraseña es incorrecta', data: undefined });
//         }

//         // Crear token y establecer cookie segura
//         const token = jwt.createToken(user);

//         res.cookie('token', token, {
//             httpOnly: true,
//             secure: true, //Solo por HTTPS (en producción)
//             sameSite: 'Strict',
//             maxAge: 24 * 60 * 60 * 1000 // 1 día
//         });

//         res.status(200).send({
//             message: 'Login exitoso',
//             data: {}
//         });
//         // //No enviar token por JSON
//         // res.status(200).send({
//         //     message: 'Login exitoso',
//         //     data: {
//         //         nombres: user.nombres,
//         //         apellidos: user.apellidos,
//         //         email: user.email,
//         //         rol: user.descripcion
//         //     }
//         // });

//     } catch (error) {
//         console.error('Error en login:', error);
//         res.status(500).send({ message: 'Error interno del servidor', data: undefined });
//     }
// };


const deleteAdmin = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool
            .request()
            .input('id', sql.Int, id)
            .query('DELETE FROM usuarioWeb WHERE id = @id');
        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar un Usuario:', error);
        res.status(500).send('Error al eliminar un Usuario');
    }
};

// auth.controller.js
const logout = async (req, res) => {
    console.log('logout req.user: ', req.user);
    res.clearCookie('token', {
      httpOnly: true,
      secure: false, // solo en HTTPS
      sameSite: 'None' // o 'Lax' si no usas múltiples dominios
    });
    console.log('Sesión cerrada exitosamente',res.cookie('token'));
    return res.status(200).json({ success:true ,message: 'Sesión cerrada exitosamente' });
};
  
const consulCookie= async (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).send({ message: 'No autenticado' });
  
    try {
      //const decoded = jwt.verify(token, 'secreto');
      res.send({ nombre: decoded.nombre, idUsuario: decoded.idUsuario });
    } catch {
      res.status(401).send({ message: 'Token inválido' });
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
    logout
};