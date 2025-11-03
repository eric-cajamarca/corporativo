const sql = require('mssql');
const dbConfig = require('../dbconfig');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// crea un crud de roles teniendo en cuenta la estructura de la tabla create table Rol (idRol UNIQUEIDENTIFIER primary key NOT NULL,descripcion varchar(50) not null,)
// CREATE
const crear_rol = async function (req, res) {

    const { descripcion } = req.body;
    // escribe el codigo para crear un rol
    if (req.user) {

        if (req.user.rol == 'Administrador') {

            //antes de crear el rol, verificar que no exista
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
                            .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)
                            .input('idRol', sql.UniqueIdentifier, uuidv4())
                            .input('descripcion', sql.VarChar, descripcion)
                            .query("INSERT INTO Rol (idRol,descripcion,idEmpresa) VALUES (@idRol,@descripcion,@idEmpresa)");

                        
                        res.status(200).send({ message: 'Rol creado correctamente', data: rol.rowsAffected });
                    } catch (error) {
                        
                        res.status(200).send({ message: 'Error al crear el rol', data: undefined });
                        //res.send(error.message);
                    }
                }
            } catch (error) {
                res.status(500);
                res.send(error.message);
            }


        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }
}

// GET ALL
const obtener_roles = async function (req, res) {
    console.log('obtener_roles' + req.user.rol)
    if (req.user) {

        if (req.user.rol == 'Administrador') {

            try {
                let pool = await sql.connect(dbConfig);
                let roles = await pool
                    .request()
                    .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)
                    .query("SELECT * from Rol WHERE idEmpresa = @idEmpresa");
               
                res.status(200).send({data: roles.recordset });
                
            } catch (error) {
                res.status(200).send({ message: 'Error al obtener los roles', data: undefined });
                res.send(error.message);
            }

        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }

}

//crea la funcion obtener_rol_id para obtener un rol por id
// GET BY ID
const obtener_rol_id = async function (req, res) {
    const { id } = req.params;

    if (req.user) {

        if (req.user.rol == 'Administrador') {

            try {
                let pool = await sql.connect(dbConfig);
                let rol = await pool
                    .request()
                    .input('idRol', sql.UniqueIdentifier, id)
                    .query("SELECT * from Rol WHERE idRol = @idRol");
                res.json(rol.recordset);
            } catch (error) {
                res.status(500);
                res.send(error.message);
            }

        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }

}


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