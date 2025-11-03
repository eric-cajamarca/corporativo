const sql = require('mssql');
const dbConfig = require('../dbconfig');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const jwt = require('../helpers/jwt');
const { v4: uuidv4 } = require('uuid');


const getAdmin = async function (req, res) {

    if (req.user) {

        if (req.user.rol == 'Administrador') {

            //  if(req.user.rol=='Administrador'){
            console.log('req.user.rol', req.user.rol);
            try {
                const pool = await sql.connect(dbConfig);
                const result = await pool
                    .request()
                    .input('empresa', sql.UniqueIdentifier, req.user.empresa)
                    .query('SELECT * FROM UsuarioWeb UW INNER JOIN Rol R ON UW.idRol = R.idRol WHERE UW.idEmpresa = @empresa')
                //.query('SELECT * FROM UsuarioWeb INNER JOIN Rol ON UsuarioWeb.idRol = Rol.idRol where UsuarioWeb.estado = 1 and idEmpresa = @empresa');
                // res.json(result.recordset);
                // console.log('result.recordset');
                // console.log(result.recordset);
                res.status(200).send({ data: result.recordset });
            } catch (error) {
                console.error('Error al obtener los usuarios:', error);
                res.status(200).send({ data: undefined });
            }

        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access', data: undefined });
    }
};

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

// if (req.user) {
// if (req.user.rol == 'Administrador') {

// } else {
//    res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
// }
// }
// else {
//     res.status(500).send({ message: 'No Access' });
// }

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


// const admin_login = async (req, res) => {
//     const { email, password, ruc } = req.body;
//     const estado = true;
//     // const data = req.body;
//     // console.log('entro a login admin')
//     // console.log(data);

//     console.log('aqui valido si es el ruc correcto', ruc);
//     //primero quiero validar si el ruc es correcto en la tabla de Empresas
//     try {
//         const pool = await sql.connect(dbConfig);

//         //validar ruc
//         const checkEmailQuery = await pool
//             .request()
//             .input('ruc', sql.VarChar, ruc)
//             .query('SELECT * FROM Empresas where ruc = @ruc ');
//         //console.log('checkEmailQuery', checkEmailQuery);
//         // const bdRuc = checkEmailQuery.recordset[0].ruc;
//         // const bdidEmpresa = checkEmailQuery.recordset[0].idEmpresa;
//         // console.log('checkEmailQuery.recordset[0].ruc', checkEmailQuery.recordset[0].ruc)

//         if (checkEmailQuery.recordset.length > 0) {
            
            
//             //const bdidEmpresa = checkEmailQuery.recordset[0].idEmpresa;
//             console.log('el ruc existe');
//             console.log('aqui valido si el email es correcto', email, 'estado :', estado);

//             const pool = await sql.connect(dbConfig);
//             const checkEmailQuery = await pool
//                 .request()
//                 .input('idEmpresa', sql.UniqueIdentifier, bdidEmpresa)
//                 .input('email', sql.VarChar, email)
//                 .input('estado', sql.Bit, estado)
//                 .query('SELECT * FROM usuarioWeb INNER JOIN Rol ON UsuarioWeb.idRol = Rol.idRol WHERE UsuarioWeb.email = @email and UsuarioWeb.estado=@estado and usuarioWeb.idEmpresa = @idEmpresa');

//             //.query('SELECT * FROM UsuarioWeb INNER JOIN Rol ON UsuarioWeb.idRol = Rol.idRol');
//             //.query('SELECT * FROM usuarioWeb INNER JOIN Rol ON UsuarioWeb.idRol = Rol.idRol WHERE email = @email and estado=@estado');


//             console.log('checkEmailQuery', checkEmailQuery);
//             console.log(checkEmailQuery.recordset.length)

//             if (checkEmailQuery.recordset.length > 0) {
//                 const bdEmail = checkEmailQuery.recordset[0].email;
//                 const bdPassword = checkEmailQuery.recordset[0].password;
//                 let user = checkEmailQuery.recordset[0];
//                 console.log('user respuesta de la bd', user);

//                 //aqui quiero comparar si el ruc es igual al bdRuc, si el email es igual al bdEmail y si el estado es igual a true
//                 if (bdRuc == ruc && bdEmail == email && estado == true) {
                   

//                     console.log('bdRuc == ruc && bdEmail == email && estado == true');
//                     bcrypt.compare(password, bdPassword, (err, result) => {
//                         if (err) {
//                             console.error('Error al comparar contraseñas:', err);
//                             res.status(500).send('Error al comparar contraseñas');
//                         } else if (result) {
//                             // Las contraseñas coinciden, inicia sesión
//                             res.status(200).send({
//                                 data: user,
//                                 token: jwt.createToken(user)
//                             });
//                             console.log('las contraseñas coinciden');
//                         } else {
//                             // Las contraseñas no coinciden, devuelve un mensaje de error
//                             res.status(200).send({ message: 'La contraseña es incorrecta', data: undefined });
//                         }
//                     });

//                 } else {
//                     console.log('el ruc no coincide con el email o el estado no es true');
//                     res.status(200).send({ message: 'El ruc no coincide con el email o el estado no es true', data: undefined });
//                 }


//             } else {
//                 // return res.status(400).json({ message: 'El email no existe. Por favor elija otro.' });
//                 res.status(200).send({ message: 'El email no existe o usted no tiene permisos para acceder' });
//             }

//         } else {
//             console.log('el ruc no existe');
//             res.status(200).send({ message: 'El ruc no existe', data: undefined });
//         }
//     } catch (error) {
//         console.error('Error al obtener los usurios:', error);
//         res.status(200).send({ data: undefined });
//     }


// };



// const admin_login = async (req, res) => {
//     const { email, password, ruc } = req.body;
//     const estado = true;
//     const data = req.body;
//     console.log('entro a login admin')
//     console.log(data);

//     console.log('aqui valido si es el ruc correcto', ruc);
//     //primero quiero validar si el ruc es correcto en la tabla de Empresas
//     try {
//         const pool = await sql.connect(dbConfig);
//         const checkEmailQuery = await pool
//             .request()
//             .input('ruc', sql.VarChar, ruc)
//             .query('SELECT * FROM Empresas where ruc = @ruc ');
//         console.log('checkEmailQuery', checkEmailQuery);

//         if (checkEmailQuery.recordset.length > 0) {
//             console.log('el ruc existe');
//             console.log('aqui valido si el email es correcto', email,'estado :', estado);

//             const pool = await sql.connect(dbConfig);
//             const checkEmailQuery = await pool
//                 .request()
//                 .input('email', sql.VarChar, email)
//                 .input('estado', sql.Bit, estado)
//                 //.query('SELECT * FROM UsuarioWeb INNER JOIN Rol ON UsuarioWeb.idRol = Rol.idRol');
//                 .query('SELECT * FROM usuarioWeb INNER JOIN Rol ON UsuarioWeb.idRol = Rol.idRol WHERE email = @email and estado=@estado');


//             console.log('checkEmailQuery', checkEmailQuery);
//             console.log(checkEmailQuery.recordset.length)

//             if (checkEmailQuery.recordset.length > 0) {
//                 const bdPassword = checkEmailQuery.recordset[0].password;
//                 let user = checkEmailQuery.recordset[0];
//                 console.log('user respuesta de la bd', user);


//                 console.log('bdpassword', bdPassword);
//                 bcrypt.compare(password, bdPassword, (err, result) => {
//                     if (err) {
//                         console.error('Error al comparar contraseñas:', err);
//                         res.status(500).send('Error al comparar contraseñas');
//                     } else if (result) {
//                         // Las contraseñas coinciden, inicia sesión
//                         res.status(200).send({
//                             data: user,
//                             token: jwt.createToken(user)
//                         });
//                         console.log('las contraseñas coinciden');
//                     } else {
//                         // Las contraseñas no coinciden, devuelve un mensaje de error
//                         res.status(200).send({ message: 'La contraseña es incorrecta', data: undefined });
//                     }
//                 });
//             } else {
//                 // return res.status(400).json({ message: 'El email no existe. Por favor elija otro.' });
//                 res.status(200).send({ message: 'El email no existe o usted no tiene permisos para acceder' });
//             }

//         } else {
//             console.log('el ruc no existe');
//             res.status(200).send({ message: 'El ruc no existe', data: undefined });
//         }
//     } catch (error) {
//         console.error('Error al obtener los usuriosa:', error);
//         res.status(200).send({ data: undefined });
//     }


// };

const admin_login = async (req, res) => {
    const { email, password, ruc } = req.body;
    const estado = true;

    try {
        const pool = await sql.connect(dbConfig);

        // Validar RUC
        const empresaQuery = await pool
            .request()
            .input('ruc', sql.VarChar, ruc)
            .query('SELECT * FROM Empresas WHERE ruc = @ruc');

        if (empresaQuery.recordset.length === 0) {
            return res.status(404).send({ message: 'El RUC no existe', data: undefined });
        }

        const empresa = empresaQuery.recordset[0];

        // Validar email y estado
        const userQuery = await pool
            .request()
            .input('idEmpresa', sql.UniqueIdentifier, empresa.idEmpresa)
            .input('email', sql.VarChar, email)
            .input('estado', sql.Bit, estado)
            .query(`
                SELECT * 
                FROM usuarioWeb 
                INNER JOIN Rol ON UsuarioWeb.idRol = Rol.idRol 
                WHERE UsuarioWeb.email = @email 
                  AND UsuarioWeb.estado = @estado 
                  AND UsuarioWeb.idEmpresa = @idEmpresa
            `);

        if (userQuery.recordset.length === 0) {
            return res.status(401).send({ message: 'El email no existe o usted no tiene permisos para acceder', data: undefined });
        }

        const user = userQuery.recordset[0];

        // Verificar contraseña
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).send({ message: 'La contraseña es incorrecta', data: undefined });
        }

        // Crear token y establecer cookie segura
        const token = jwt.createToken(user);

        res.cookie('token', token, {
            httpOnly: true,
            secure: true, //Solo por HTTPS (en producción)
            sameSite: 'Strict',
            maxAge: 24 * 60 * 60 * 1000 // 1 día
        });

        res.status(200).send({
            message: 'Login exitoso',
            data: {}
        });
        // //No enviar token por JSON
        // res.status(200).send({
        //     message: 'Login exitoso',
        //     data: {
        //         nombres: user.nombres,
        //         apellidos: user.apellidos,
        //         email: user.email,
        //         rol: user.descripcion
        //     }
        // });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).send({ message: 'Error interno del servidor', data: undefined });
    }
};


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