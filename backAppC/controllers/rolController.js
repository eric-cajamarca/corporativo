const sql = require('mssql');
const dbConfig = require('../dbconfig');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const rolService = require('../services/rol.service');

// const crear_rol = async function (req, res) {

//     const { descripcion } = req.body;
//     // escribe el codigo para crear un rol
//     if (req.user) {

//         if (req.user.rol == 'Administrador') {

//             //antes de crear el rol, verificar que no exista
//             try {
//                 let pool = await sql.connect(dbConfig);
//                 let rol = await pool
//                     .request()
                    
//                     .input('descripcion', sql.VarChar, descripcion)
//                     .query("SELECT * FROM Rol WHERE descripcion = @descripcion");
//                 if (rol.recordset.length > 0) {
//                     res.status(200).send({ message: 'El rol ya existe', data: undefined });
//                 } else {
//                     try {
//                         let pool = await sql.connect(dbConfig);
//                         let rol = await pool
//                             .request()
//                             .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)
//                             .input('idRol', sql.UniqueIdentifier, uuidv4())
//                             .input('descripcion', sql.VarChar, descripcion)
//                             .query("INSERT INTO Rol (idRol,descripcion,idEmpresa) VALUES (@idRol,@descripcion,@idEmpresa)");

                        
//                         res.status(200).send({ message: 'Rol creado correctamente', data: rol.rowsAffected });
//                     } catch (error) {
                        
//                         res.status(200).send({ message: 'Error al crear el rol', data: undefined });
//                         //res.send(error.message);
//                     }
//                 }
//             } catch (error) {
//                 res.status(500);
//                 res.send(error.message);
//             }


//         } else {
//             res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
//         }
//     }
//     else {
//         res.status(500).send({ message: 'No Access' });
//     }
// }

// GET ALL



const crear_rol = async function (req, res) {
  const { descripcion } = req.body;

  try {
    // Validación básica de token
    if (!req.user) {
      return res.status(403).json({ message: 'No Access', data: undefined });
    }

    const pool = await sql.connect(dbConfig);
    // Llamar al service
    const resultado = await rolService.crearRol(pool, descripcion, req.user);

    // Respuesta exitosa
    res.status(200).json({
      message: resultado.message,
      data: resultado.rowsAffected
    });

  } catch (error) {
    console.error('Error en crear_rol:', error.message);

    // Manejo de errores específicos
    if (error.message === 'PERMISO_DENEGADO') {
      return res.status(403).json({
        message: 'No tiene permisos para realizar esta acción',
        data: undefined
      });
    }

    if (error.message === 'ROL_EXISTE') {
      return res.status(200).json({
        message: 'El rol ya existe',
        data: undefined
      });
    }

    // Error genérico
    res.status(500).json({
      message: 'Error al crear el rol',
      data: undefined
    });
  }
};


const obtener_roles = async function (req, res) {
 
  try {
    // Validación básica de token
    if (!req.user) {
      return res.status(403).json({ message: 'No Access', data: undefined });
    }
    const pool = await sql.connect(dbConfig);
    // Llamar al service
    const resultado = await rolService.obtenerRoles(pool, req.user);

    // Respuesta exitosa
    res.status(200).json({
      data: resultado.data
    });

  } catch (error) {
    console.error('Error en obtener_roles:', error.message);

    // Manejo de errores específicos
    if (error.message === 'PERMISO_DENEGADO') {
      return res.status(403).json({
        message: 'No tiene permisos para realizar esta acción',
        data: undefined
      });
    }

    // Error genérico
    res.status(200).json({
      message: 'Error al obtener los roles',
      data: undefined
    });
  }
};

// const obtener_rol_id = async function (req, res) {
//     const { id } = req.params;

//     if (req.user) {

//         if (req.user.rol == 'Administrador') {

//             try {
//                 let pool = await sql.connect(dbConfig);
//                 let rol = await pool
//                     .request()
//                     .input('idRol', sql.UniqueIdentifier, id)
//                     .query("SELECT * from Rol WHERE idRol = @idRol");
//                 res.status(200).send({data: rol.recordset});
//             } catch (error) {
//                 res.status(500);
//                 res.send(error.message);
//             }

//         } else {
//             res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
//         }
//     }
//     else {
//         res.status(500).send({ message: 'No Access' });
//     }

// }

const obtener_rol_id = async function (req, res) {
  const { id } = req.params;
  console.log('obtener_rol_id:', id);

  try {
    // Validación básica de token
    if (!req.user) {
      return res.status(403).json({ message: 'No Access', data: undefined });
    }

    const pool = await sql.connect(dbConfig);
    // Llamar al service
    const resultado = await rolService.obtenerRolPorId(pool, id, req.user);

    // Respuesta exitosa
    res.status(200).json({
      data: resultado.data
    });

  } catch (error) {
    console.error('Error en obtener_rol_id:', error.message);

    // Manejo de errores específicos
    if (error.message === 'PERMISO_DENEGADO') {
      return res.status(403).json({
        message: 'No tiene permisos para realizar esta acción',
        data: undefined
      });
    }

    if (error.message === 'ROL_NO_EXISTE') {
      return res.status(200).json({
        message: 'El rol no existe',
        data: undefined
      });
    }

    // Error genérico
    res.status(500).json({
      message: 'Error al obtener el rol',
      data: undefined
    });
  }
};


//crea la funcion actualizar_rol para actualizar un rol por id
// UPDATE
const actualizar_rol = async function (req, res) {
    const { id } = req.params;
    const { descripcion } = req.body;

    if (req.user) {

        if (req.user.rol == 'Administrador') {

            //antes de actualizar el rol, verificar que no exista
            try {
                let pool = await sql.connect(dbConfig);
                let rol = await pool
                    .request()
                    .input('descripcion', sql.VarChar, descripcion)
                    .query("SELECT * FROM Rol WHERE descripcion = @descripcion");
                if (rol.recordset.length > 0) {
                    res.status(200).send({ message: 'El rol ya existe', data: undefined });
                } else {
                    try {
                        let pool = await sql.connect(dbConfig);
                        let rol = await pool
                            .request()
                            .input('idRol', sql.UniqueIdentifier, id)
                            .input('descripcion', sql.VarChar, descripcion)
                            .query("UPDATE Rol SET descripcion = @descripcion WHERE idRol = @idRol");

                        res.status(200).send({message: 'Rol actualizado correctamente', data: rol.rowsAffected});
                    } catch (error) {
                        res.status(200).send({ message: 'Error al actualizar el rol', data: undefined });
                        //res.send(error.message);
                    }
                }
            } catch (error) {
                res.status(200).send({ message: 'Error al actualizar el rol', data: undefined });
                //res.send(error.message);
            }

        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }

}



//crea la funcion eliminar_rol para eliminar un rol por id



module.exports = {
    crear_rol,
    obtener_roles,
    obtener_rol_id,
    actualizar_rol

};