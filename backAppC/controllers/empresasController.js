const sql = require('mssql');
const dbConfig = require('../dbconfig');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const jwt = require('../helpers/jwt');
const { v4: uuidv4 } = require('uuid');
const { max } = require('moment/moment');
const path = require('path');
const fs = require('fs').promises; // Usamos la versión con promesas
// CREATE TABLE Empresas(
// 	idEmpresa UNIQUEIDENTIFIER primary key NOT NULL,
// 	idDocumento varchar(1) not null,
// 	ruc varchar(11) not NULL,
// 	razon_Social varchar(200) not NULL,
// 	nombreComercial varchar(200) null,
// 	rubro varchar(200) NULL,
// 	celular varchar(11) NULL,
// 	correo varchar(100) not NULL,
// 	password text not null,
// 	logo varbinary(max) NULL,
// 	alias varchar(10) NULL,
// 	condicion varchar(20) null,
// 	estSunat varchar(20) null,
// 	estado bit NOT NULL


// )


const getEmpresas = async function (req, res) {
    console.log('entro a getEmpresas', req.user);
    
    if (req.user) {
        if (req.user.rol == 'Administrador') {
            console.log('req.user.rol');
            try {
                const pool = await sql.connect(dbConfig);
                const result = await pool
                    .request()
                    .query('SELECT * FROM Empresas');
                // res.json(result.recordset);
                // console.log('result.recordset');
                // console.log(result.recordset);
                console.log('result:', result.recordset);
                res.status(200).send({ data: result.recordset });
            } catch (error) {
                console.error('Error al obtener las epresas:', error);
                res.status(200).send({ data: undefined });
            }
        } else {
            res.status(500).send({ message: 'No Access' });
        }



    }
    else {
        res.status(500).send({ message: 'No Access' });
    }
};



const getEmpresasById = async function (req, res) {
    console.log('entro a getEmpresasById', req.user.empresa);
    const id = req.user.empresa;

    if (req.user) {
        if(req.user.rol=='Administrador'){
            console.log('req.user.rol:');
            try {
                const pool = await sql.connect(dbConfig);
                let result = await pool
                    .request()
                    .input('idEmpresa', sql.UniqueIdentifier, id)
                    .query('SELECT * FROM Empresas WHERE idEmpresa = @idEmpresa');

                console.log('result:', result.recordset);
                //res.json(result.recordset);
                res.status(200).send({ data: result.recordset });
            } catch (error) {
                console.error('Error al obtener los usuarios:', error);
                res.status(500).send({ data: undefined });
            }
        }else{
            res.status(500).send({ message: 'No Autorizado' });

        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }
};

const getEmpresa_id = async function (req, res) {

    const id = req.user.empresa;

    if (req.user) {
        if(req.user.rol=='Administrador'){
            console.log('req.user.rol:');
            try {
                const pool = await sql.connect(dbConfig);
                let result = await pool
                    .request()
                    .input('idEmpresa', sql.UniqueIdentifier, id)
                    .query(
                        'SELECT e.logo, e.razon_Social AS nombre, e.ruc, e.rubro, e.correo, e.celular AS telefono, de.direccion ' +
                        'FROM Empresas e ' +
                        'LEFT JOIN DireccionEmpresa de ON e.idEmpresa = de.idEmpresa AND de.principal = 1 ' +
                        'WHERE e.idEmpresa = @idEmpresa'
                    );


                console.log('result:', result.recordset);
                //res.json(result.recordset);
                res.status(200).send({ data: result.recordset });
            } catch (error) {
                console.error('Error al obtener los usuarios:', error);
                res.status(500).send({ data: undefined });
            }
        }else{
            res.status(500).send({ message: 'No Autorizado' });

        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }
};

const empresaService = require('../services/empresa.service');

const createEmpresa = async function (req, res) {
    console.log('entro a createEmpresa', req.body);
    const { idDocumento, ruc, razon_Social, nombre_Comercial, rubro, celular, logo, correo, password, alias, condicion, estSunat } = req.body;

    const currentDate = moment().format('YYYY-MM-DD');
    const fregistro = currentDate;
    console.log(currentDate);

    const pool = await sql.connect(dbConfig);

    // Verificar si el correo electrónico ya existe
    const checkEmailQuery = await pool
        .request()
        .input('Ruc', sql.VarChar, ruc)
        .query('SELECT * FROM Empresas WHERE ruc = @ruc');

    console.log('checkEmailQuery.recordset:', checkEmailQuery.recordset);

    if (checkEmailQuery.recordset.length > 0) {

        return res.status(200).send({ message: 'La Empresa ya existe. Por favor registre una empresa diferente', data: undefined });
    } else {
        try {
            // Convertir buffer a cadena base64
            const hashedPassword = await bcrypt.hash(password, 8); // El número 10 es el factor de coste para el cifrado
            //crear el idUsuario con uuidv4
            const idEmpresa = uuidv4();

            const pool = await sql.connect(dbConfig);
            const result = await pool
                .request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('idDocumento', sql.VarChar(1), idDocumento)
                .input('ruc', sql.VarChar, ruc)
                .input('razon_Social', sql.VarChar, razon_Social)
                .input('nombreComercial', sql.VarChar, nombre_Comercial)
                .input('rubro', sql.VarChar, rubro)
                .input('celular', sql.VarChar, celular)
                .input('correo', sql.VarChar, correo)
                .input('password', sql.Text, hashedPassword)
                .input('logo', sql.VarBinary(sql.MAX), null)
                .input('alias', sql.VarChar, alias)
                .input('condicion', sql.VarChar, condicion)
                .input('estSunat', sql.VarChar, estSunat)
                .input('estado', sql.Bit, 1)
                .input('fregistro', sql.DateTime, fregistro)
                .query('INSERT INTO Empresas (idEmpresa, idDocumento, ruc, razon_Social, nombreComercial, rubro, celular, correo, password, logo, alias, condicion, estSunat, estado, fregistro) VALUES (@idEmpresa, @idDocumento, @ruc, @razon_Social, @nombreComercial, @rubro, @celular, @correo, @password, @logo, @alias, @condicion, @estSunat, @estado, @fregistro)');


            console.log('✓ Empresa creada con ID:', idEmpresa);

            // Inicializar datos maestros de la empresa
            try {
                const datosEmpresa = {
                    razon_Social,
                    correo,
                    celular,
                    direccion: req.body.direccion || 'Sin dirección'
                };
                
                const resultadoInicializacion = await empresaService.inicializarDatosEmpresa(pool, idEmpresa, datosEmpresa);
                
                console.log('✅ Datos maestros inicializados:', {
                    roles: resultadoInicializacion.roles.length,
                    comprobantes: resultadoInicializacion.comprobantes.length,
                    sucursal: resultadoInicializacion.sucursal ? 'OK' : 'ERROR',
                    secuencias: resultadoInicializacion.secuencias.length,
                    errores: resultadoInicializacion.errores.length
                });

                // Devolver el ID de la empresa junto con el ID de la sucursal principal
                res.status(200).send({ 
                    data: idEmpresa,
                    sucursalPrincipal: resultadoInicializacion.sucursal?.idSucursal,
                    mensaje: 'Empresa creada exitosamente con datos maestros inicializados'
                });
            } catch (errorInicializacion) {
                console.error('⚠️ Error inicializando datos maestros:', errorInicializacion);
                // La empresa se creó pero falló la inicialización - devolver el ID de todas formas
                res.status(200).send({ 
                    data: idEmpresa,
                    warning: 'Empresa creada pero algunos datos maestros no se inicializaron correctamente'
                });
            }
        }
        catch (error) {
            console.error('Error al crear la Empresa:', error);
            res.status(500).send({ data: undefined });
        }
    }
}



const updateEmpresa = async function (req, res) {
    try {
        console.log('Datos recibidos:', req.body);
        console.log('Archivo recibido:', req.file);

        const idEmpresa = req.user.empresa;
        const {
            ruc, correo, celular, nombreComercial, 
            alias, rubro, logoAnterior
        } = req.body;

        // Validación básica
        if ( req.user.rol !== 'Administrador') {
            return res.status(401).send({ success: false, message: 'No autorizado' });
        }

        const pool = await sql.connect(dbConfig);
        let query = `
            UPDATE Empresas SET 
                Rubro = @Rubro,
                Celular = @Celular,
                nombreComercial = @nombreComercial,
                Correo = @Correo,
                Alias = @Alias
        `;

        // Parámetros base
        const request = pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('Rubro', sql.VarChar, rubro || '')
            .input('Celular', sql.VarChar, celular || '')
            .input('nombreComercial', sql.VarChar, nombreComercial || '')
            .input('Correo', sql.VarChar, correo || '')
            .input('Alias', sql.VarChar, alias || '');

        // Si hay nueva imagen
        if (req.file) {
            query += ', Logo = @Logo';
            request.input('Logo', sql.VarChar, req.file.filename);

            // Eliminar imagen anterior si existe
            if (logoAnterior && logoAnterior !== 'undefined' && logoAnterior !== 'null') {
                try {
                    const oldPath = path.join(__dirname, '../uploads/configuraciones/', logoAnterior);
                    await fs.promises.unlink(oldPath);
                    console.log('Imagen anterior eliminada:', logoAnterior);
                } catch (err) {
                    console.warn('No se pudo eliminar la imagen anterior:', err.message);
                }
            }
        }

        query += ' WHERE idEmpresa = @idEmpresa';

        const result = await request.query(query);

        res.status(200).json({
            success: true,
            message: 'Empresa actualizada correctamente',
            data: {
                rowsAffected: result.rowsAffected,
                newLogo: req.file ? req.file.filename : null
            }
        });

    } catch (error) {
        console.error('Error en updateEmpresa:', error);
        
        // Eliminar archivo subido si hubo error después de la subida
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }

        res.status(500).json({
            success: false,
            message: 'Error al actualizar empresa',
            //error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
};

const cambiar_estado_empresa = async function (req, res) {
    console.log('entro a cambiar_estado_empresa', req.params);
    if (req.user) {
        let idEmpresa = req.params['id'];
        const { estado } = req.body;

        if (!estado) {
            nuevo_estado = true;
        } else {
            nuevo_estado = false;
        }

        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool
                .request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('estado', sql.Bit, nuevo_estado)
                .query('UPDATE Empresas SET estado = @estado WHERE idEmpresa = @idEmpresa');
            res.status(200).send({ data: result.rowsAffected });
        } catch (error) {
            console.error('Error al cambiar el estado de la empresa:', error);
            res.status(500).send({ data: undefined });

        }

    }
}

// const obtener_logo = async function (req, res) {
//     console.log('entro a obtener_logo', req.params);
//     //var img = req.params['img'];
//     var img = '01.jpg';


//     fs.stat('./uploads/configuraciones/' + img, function (err) {
//         if (!err) {
//             let path_img = './uploads/configuraciones/' + img;
//             res.status(200).sendFile(path.resolve(path_img));
//         } else {
//             let path_img = '../public/assets/img/01.jpg';
//             res.status(200).sendFile(path.resolve(path_img));
//         }

//         //console.log('path_img', path_img);
//     })
// }



const obtener_logo = async function (req, res) {
    try {
        console.log('Solicitud para obtener logo:', req.params.img);
        
        const img = req.params.img || 'default.jpg';
        const logoPath = path.join(__dirname, '../uploads/configuraciones/', img);
        
        console.log('Ruta del logo:', logoPath);
        // Verificar si existe el archivo
        try {
            await fs.access(logoPath);
            return res.sendFile(logoPath);
        } catch (err) {
            console.log('Logo no encontrado, usando default:', err.message);
            const defaultPath = path.join(__dirname, '../public/assets/img/01.jpg');
            return res.sendFile(defaultPath);
        }
    } catch (error) {
        console.error('Error al obtener logo:', error);
        res.status(500).send('Error al obtener la imagen');
    }
};


const obtener_datos_colaborador_admin = async (req, res) => {
    const { id } = req.params;
    let data;

    if (req.user) {

        try {

            const pool = await sql.connect(dbConfig);
            const result = await pool.request().query('SELECT * FROM usuarioWeb where id =' + id);
            // const result = await pool
            //     .request()
            //     .input('id', sql.Int, id)
            //     .query('SELECT * FROM usuarioWeb WHERE email = @id');
            // res.json({ message: 'Usuario actualizado correctamente' });
            console.log(result.recordset);
            data = result.recordset;
            console.log('data: ', data);
            // res.status(200).send({data: data });
            res.json({ data });


        } catch (error) {
            console.error('Error al actualizar un usuario:', error);
            // res.status(500).send('Error al actualizar un usuario');
            res.status(200).send({ message: 'Error al actualizar un usuario', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }
};

const cambiar_estado_colaborador_admin = async function (req, res) {
    if (req.user) {
        let id = req.params['id'];
        let data = req.body;
        let estado = data.estado;

        let nuevo_estado;

        console.log('cambiar_estado_colaborador_admin: ', data);
        console.log('id: ', id);


        if (data.estado) {
            nuevo_estado = false;
        } else if (!data.estado) {
            nuevo_estado = true;
        }

        console.log('nuevo estado: ', nuevo_estado);

        const pool = await sql.connect(dbConfig);
        const result = await pool
            .request()
            .input('id', sql.Int, id)
            .input('estado', sql.Bit, nuevo_estado)
            .query('UPDATE usuarioWeb SET estado = @estado WHERE id = @id');
        console.log(result.recordset);
        res.status(200).send({ data: result.recordset });

    } else {
        res.status(403).send({ data: undefined, message: 'NoToken' });
    }
}




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




const createDireccionEmpresa = async function (req, res) {
    try {
        const idEmpresa = (req.user && (req.user.empresa || req.user.idEmpresa)) ? (req.user.empresa || req.user.idEmpresa) : req.body.idEmpresa;
        if (!idEmpresa) {
            return res.status(400).send({ message: 'idEmpresa requerido', data: undefined });
        }
        let ubigeo = req.body.ubigeo;
        let codPais = req.body.codpais;
        let region = req.body.region;
        let provincia = req.body.provincia;
        let distrito = req.body.distrito;
        let urbanizacion = req.body.urbanizacion;
        let direccion = req.body.direccion;
        let codLocal = '0';
        let principal = true;


        //let idUsuario = 'C654A619-B725-4C2E-9175-A3F4AC3B7845';

        //let nombre = 'Mi empresa';

        let pool = await sql.connect(dbConfig);
        let insertDireccionEmpresa = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('ubigeo', sql.VarChar, ubigeo)
            .input('codPais', sql.VarChar, codPais)
            .input('region', sql.VarChar, region)
            .input('provincia', sql.VarChar, provincia)
            .input('distrito', sql.VarChar, distrito)
            .input('urbanizacion', sql.VarChar, urbanizacion)
            .input('direccion', sql.VarChar, direccion)
            .input('codLocal', sql.VarChar, codLocal)
            .input('principal', sql.Bit, principal)
            //.input('idUsuario', sql.UniqueIdentifier, idUsuario)
            //.input('nombre', sql.VarChar, nombre)
            .query('insert into DireccionEmpresa (idEmpresa,ubigeo,codPais,region,provincia,distrito,urbanizacion,direccion,codLocal, principal) values (@idEmpresa,@ubigeo,@codPais,@region,@provincia,@distrito,@urbanizacion,@direccion,@codLocal,@principal)');

        res.status(200).send({ data: insertDireccionEmpresa.rowsAffected });

        // quiero ejecutar el metodo createSucursalEmpresa
        createSucursalEmpresa(req, res);
    } catch (error) {
        console.log('error', error);
        res.status(500).send({ message: error.message, data: undefined });

    }

    //     }
    //     else {
    //         res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    //     }
    // }
    // else {
    //     res.status(500).send({ message: 'No Access' });
    // }

}

//crear sucursal de la empresa 


//crear el metodo const createSucursalEmpresa con los parametros del metodo const createDireccionEmpresa
const createSucursalEmpresa = async function (req, res) {
    console.log('crearSucursalEmpresa req.body', req.body);
    //console.log('req.user', req.user);

    try {
        let nombre = '';

        if (req.body.nombre) {
            nombre = req.body.nombre;
        } else {
            nombre = 'Mi sucursal';
        }

        let idSucursal = uuidv4();
        const idEmpresa = (req.user && (req.user.empresa || req.user.idEmpresa)) ? (req.user.empresa || req.user.idEmpresa) : req.body.idEmpresa;
        if (!idEmpresa) {
            return res.status(400).send({ message: 'idEmpresa requerido', data: undefined });
        }
        let direccion = req.body.direccion;
        // let idUsuario = req.body.idUsuario;
        let fregistro = moment().format('YYYY-MM-DD');
        let estado = true;

        let pool = await sql.connect(dbConfig);
        let insertSucursalEmpresa = await pool.request()
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('nombre', sql.VarChar, nombre)
            .input('direccion', sql.VarChar, direccion)
            // .input('idUsuario', sql.UniqueIdentifier, idUsuario)
            .input('fregistro', sql.DateTime, fregistro)
            .input('estado', sql.Bit, estado)
            .query('insert into Sucursal (idSucursal,idEmpresa,nombre,direccion,fregistro,estado) values (@idSucursal,@idEmpresa,@nombre,@direccion,@fregistro,@estado)');

        //.query('insert into Sucursal (idEmpresa,nombre,direccion,fregistro,estado) values (@idEmpresa,@nombre,@direccion,@fregistro,@estado)');
        //.query('insert into Sucursal (idEmpresa,nombre,direccion,idUsuario,fregistro,estado) values (@idEmpresa,@nombre,@direccion,@idUsuario,@fregistro,@estado)');
        //res.status(200).send({ data: insertSucursalEmpresa.rowsAffected });
    } catch (error) {
        console.log('error', error);
        res.status(500).send({ message: error.message, data: undefined });

    }

}

const updateDireccionEmpresa = async function (req, res) {
    console.log('entro a updateDireccionEmpresa', req.body);
    const { idDireccionEmpresa, ubigeo, codPais, region, provincia, distrito, urbanizacion, direccion, codLocal, principal } = req.body;
    const id = idDireccionEmpresa;

    if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                const pool = await sql.connect(dbConfig);
                const result = await pool
                    .request()
                    .input('id', sql.Int, id)
                    .input('ubigeo', sql.VarChar, ubigeo)
                    .input('codPais', sql.VarChar, codPais)
                    .input('region', sql.VarChar, region)
                    .input('provincia', sql.VarChar, provincia)
                    .input('distrito', sql.VarChar, distrito)
                    .input('urbanizacion', sql.VarChar, urbanizacion)
                    .input('direccion', sql.VarChar, direccion)
                    .input('codLocal', sql.VarChar, codLocal)
                    .input('principal', sql.Bit, principal)
                    .query('UPDATE DireccionEmpresa SET ubigeo = @ubigeo, codPais = @codPais, region = @region, provincia = @provincia, distrito = @distrito, urbanizacion = @urbanizacion, direccion = @direccion, codLocal = @codLocal, principal = @principal WHERE idDireccionEmpresa = @id');
                res.status(200).send({ data: result.rowsAffected });
            } catch (error) {
                console.error('Error al actualizar un DireccionEmpresa:', error);
                res.status(500).send('Error al actualizar un DireccionEmpresa');
            }
        }
        else {
            res.status(401).send({ message: 'No Access' });
        }
    } else {
        res.status(401).send({ message: 'No Access' });
    }
}

const getDireccionEmpresa_id = async function (req, res) {
    
    const idEmpresa = req.user.empresa;
    console.log('entro a getDireccionEmpresa_id', idEmpresa);
    if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                const pool = await sql.connect(dbConfig);
                const result = await pool
                    .request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .query('SELECT * FROM DireccionEmpresa WHERE idEmpresa = @idEmpresa');
                res.status(200).send({ data: result.recordset });
            } catch (error) {
                console.error('Error al obtener las direcciones de la empresa:', error);
                res.status(500).send('Error al obtener las direcciones de la empresa');
            }
        }
        else {
            res.status(401).send({ message: 'No Access' });
        }

    } else {
        res.status(401).send({ message: 'No Access' });
    }
}

// const eliminarDirecion_id
const deleteDireccion_id = async function (req,res) {
    const idDireccionEmpresa = req.params['id'];
    

    if( req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                const pool = await sql.connect(dbConfig);
                const result = await pool
                    .request()
                    .input('idDireccionEmpresa', sql.Int, idDireccionEmpresa)
                    .query('DELETE FROM DireccionEmpresa WHERE idDireccionEmpresa = @idDireccionEmpresa');
                res.status(200).send({ data: result.rowsAffected });
            } catch (error) {
                console.error('Error al eliminar la direccion de la empresa:', error);
                res.status(500).send('Error al eliminar la direccion de la empresa');
            }
        }
        else {
            res.status(401).send({ message: 'No Access' });
        }

    } else {
        res.status(401).send({ message: 'No Access' });
    }
}

//convertir en principal la direccion de la empresa por su idDireccionEmpresa y el resro de direcciones en false
const cambiar_principal_direccion = async function (req, res) {
    console.log('entro a cambiar_principal_direccion', req.body, req.params);
    const idDireccionEmpresa = req.params.id;
    const idEmpresa = req.user.empresa;

    if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                const pool = await sql.connect(dbConfig);
                const result = await pool
                    .request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .query('UPDATE DireccionEmpresa SET principal = 0 WHERE idEmpresa = @idEmpresa');
                //res.status(200).send({ data: result.rowsAffected });
                if (result.rowsAffected > 0) {
                    //console.log('result.rowsAffected:', result.rowsAffected);
                    try {
                        const pool = await sql.connect(dbConfig);
                        const result = await pool
                            .request()
                            .input('idDireccionEmpresa', sql.Int, idDireccionEmpresa)
                            .query('UPDATE DireccionEmpresa SET principal = 1 WHERE idDireccionEmpresa = @idDireccionEmpresa');
                        res.status(200).send({ data: result.rowsAffected });
                    } catch (error) {
                        console.error('Error al cambiar la direccion principal1:', error);
                        res.status(500).send('Error al cambiar la direccion principal');
                    }
                }


            } catch (error) {
                console.error('Error al cambiar la direccion principal0:', error);
                res.status(500).send('Error al cambiar la direccion principal');
            }


        }
        else {
            res.status(401).send({ message: 'No Access' });
        }
    } else {
        res.status(401).send({ message: 'No Access' });
    }
}

const getEstadoConfiguracion = async function (req, res) {
    console.log('getEstadoConfiguracion - Usuario:', req.user);
    
    if (!req.user || !req.user.empresa) {
        return res.status(401).send({ message: 'No autorizado', data: undefined });
    }

    try {
        const pool = await sql.connect(dbConfig);
        const estado = await empresaService.obtenerEstadoConfiguracion(pool, req.user.empresa);
        
        console.log('Estado de configuración:', estado);
        res.status(200).send({ data: estado });
    } catch (error) {
        console.error('Error obteniendo estado de configuración:', error);
        res.status(500).send({ message: 'Error al obtener estado de configuración', data: undefined });
    }
};

module.exports = {
    // getEmpresas,
    getEmpresas,
    createEmpresa,
    updateEmpresa,
    cambiar_estado_empresa,
    deleteAdmin,
    // admin_login,
    cambiar_estado_colaborador_admin,
    obtener_datos_colaborador_admin,
    getEmpresasById,
    getDireccionEmpresa_id,
    createDireccionEmpresa,
    updateDireccionEmpresa,
    deleteDireccion_id,
    cambiar_principal_direccion,

    //logo,
    obtener_logo,
    getEmpresa_id,

    // Estado de configuración
    getEstadoConfiguracion,

    //direcciones de la empresa




};