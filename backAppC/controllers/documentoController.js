const sql = require('mssql');
const dbConfig = require('../dbconfig');

// crear el crud segun la tabla Documentos(idDocumento varchar(1) primary key not null,nombre varchar(20) not null,descripcion varchar(200) not null)
//1. crea el metodo crearDocumento segun los datos de la tabla
async function crearDocumento(req,res){
    if (req.user) {
        if (req.user.rol) {

            try {
                let idDocumento = req.body.idDocumento;
                let nombre = req.body.nombre;
                let descripcion = req.body.descripcion;

                let pool = await sql.connect(dbConfig);
                let insertDocumento = await pool.request()
                    .input('idDocumento', sql.VarChar, idDocumento)
                    .input('nombre', sql.VarChar, nombre)
                    .input('descripcion', sql.VarChar, descripcion)
                    .query('insert into Documentos (idDocumento,nombre,descripcion) values (@idDocumento,@nombre,@descripcion)');
                
                res.status(200).send({ message: 'Documento creado', data: insertDocumento.recordset });
            } catch (error) {
                res.status(500).send({ message: error.message, data: undefined });
            }
        }
        else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }

}

//2. crea el metodo listarDocumentos segun los datos de la tabla
async function listarDocumentos(req,res){
        if (req.user) {
        if (req.user.rol) {
            
            try {
                let pool = await sql.connect(dbConfig);
                let documentos = await pool.request().query('select * from Documentos');
                res.status(200).send({ message: 'Lista de documentos', data: documentos.recordset });
            } catch (error) {
                res.status(500).send({ message: error.message, data: undefined });
            }
        }
        else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }
}

//3. crea el metodo actualizarDocumento segun los datos de la tabla
async function actualizarDocumento(req,res){
    const { nombre, descripcion } = req.body;
    const idDocumento = req.params.idDocumento;

    if (req.user) {
        if (req.user.rol == 'Administrador') {

            try {
                let pool = await sql.connect(dbConfig);
                let updateDocumento = await pool.request()
                    .input('idDocumento', sql.VarChar, idDocumento)
                    .input('nombre', sql.VarChar, nombre)
                    .input('descripcion', sql.VarChar, descripcion)
                    .query('update Documentos set nombre = @nombre, descripcion = @descripcion where idDocumento = @idDocumento');
                res.status(200).send({ message: 'Documento actualizado', data: updateDocumento.recordset });
            } catch (error) {
                res.status(500).send({ message: error.message, data: undefined });
            }
        }
        else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }
}

//4. crea el metodo eliminarDocumento segun los datos de la tabla
async function eliminarDocumento(req,res){
    const idDocumento = req.params.idDocumento;

    if (req.user) {
        if (req.user.rol == 'Administrador') {

            try {
                let pool = await sql.connect(dbConfig);
                let deleteDocumento = await pool.request()
                    .input('idDocumento', sql.VarChar, idDocumento)
                    .query('delete from Documentos where idDocumento = @idDocumento');
                res.status(200).send({ message: 'Documento eliminado', data: deleteDocumento.recordset });
            } catch (error) {
                res.status(500).send({ message: error.message, data: undefined });
            }
        }
        else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }
}

// create table FormaPago
// (
// 	idFPago int identity primary key not null,
// 	descripcion varchar(50) not nulL
// )

const listarFormasPago = async function (req,res) {
    if(req.user){

        try{
            let pool = await sql.connect(dbConfig);
            let formasPago = await pool.request()
                .query('select * from formasPago');
            res.status(200).send({data: formasPago.recordset});
        
        }catch(error){
                        res.status(500).send({ message: error.message, data: undefined });
        }
    }else{
        res.status(500).send({ message: 'No Access' });

    }
}

module.exports = {
    listarDocumentos,
    crearDocumento,
    actualizarDocumento,
    eliminarDocumento,

    listarFormasPago
}