const sql = require('mssql');
const dbConfig = require('../dbconfig');

//tabla marcas
// create table Marcas
// (
// idMarca int identity(1,1) primary key not null,
// idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE not null,
// nombre varchar(50) not null,
// descripcion varchar(200) null,
// contacto varchar(100) null,
// paginaWeb varchar(100) null,
// estado bit not null
// )

//obtener todas las marcas
const obtenerMarcas = async function (req, res) {
    if (req.user) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool
                .request()
                .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)
                .query(`SELECT * FROM Marcas WHERE idEmpresa = @idEmpresa`);
            res.status(200).send({ data: result.recordset });
        } catch (error) {
            console.error('Error al obtener las marcas:', error);
            res.status(500).send({ data: undefined });
        }
    } else {
        res.status(401).send({ message: 'No Access', data: undefined });
    }
}

//obtener una marca por su id
const obtenerMarcaPorId = async function (req, res) {
    console.log('req.params', req.params.id);
    const idMarca = req.params.id;
    if (req.user) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool
                .request()
                .input('idMarca', sql.Int, idMarca)
                .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)
                .query(`SELECT * FROM Marcas WHERE idMarca = @idMarca and idEmpresa = @idEmpresa`);
            res.status(200).send({ data: result.recordset });
        } catch (error) {
            console.error('Error al obtener la marca:', error);
            res.status(500).send({ data: undefined });
        }
    } else {
        res.status(401).send({ message: 'No Access', data: undefined });
    }
}

//crear marca
const crearMarca = async function (req, res) {
    const { nombre, descripcion, contacto, paginaWeb } = req.body;
    const idEmpresa = req.user.empresa;

    if (req.user) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool
                .request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('nombre', sql.VarChar, nombre)
                .input('descripcion', sql.VarChar, descripcion)
                .input('contacto', sql.VarChar, contacto)
                .input('paginaWeb', sql.VarChar, paginaWeb)
                .query(`INSERT INTO Marcas (idEmpresa, nombre, descripcion, contacto, paginaWeb, estado) VALUES (@idEmpresa, @nombre, @descripcion, @contacto, @paginaWeb, 1)`);
            res.status(200).send({ data: result.recordset });
        } catch (error) {
            console.error('Error al crear la marca:', error);
            res.status(500).send({ data: undefined });
        }
    } else {
        res.status(401).send({ message: 'No Access', data: undefined });
    }
}

//editar marca
const editarMarca = async function (req, res) {
    console.log('req.params', req.params.id);
    console.log('req.body', req.body);
    const { nombre, descripcion, contacto, paginaWeb } = req.body;
    const idMarca = req.params.id;
    const idEmpresa = req.user.empresa;

    if (req.user) {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool
                .request()
                .input('idMarca', sql.Int, idMarca)
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('nombre', sql.VarChar, nombre)
                .input('descripcion', sql.VarChar, descripcion)
                .input('contacto', sql.VarChar, contacto)
                .input('paginaWeb', sql.VarChar, paginaWeb)
                .query('UPDATE Marcas SET nombre = @nombre, descripcion = @descripcion, contacto = @contacto, paginaWeb = @paginaWeb WHERE idMarca = @idMarca and idEmpresa = @idEmpresa');

                
            res.status(200).send({ data: result.rowsAffected });
        } catch (error) {
            console.error('Error al editar la marca:', error);
            res.status(500).send({ data: undefined });
        }
    } else {
        res.status(401).send({ message: 'No Access', data: undefined });
    }
}

const editarEstadoMarca = async function (req, res) {

    console.log('editarEstadoMarca', req.body);
        console.log('editarEstadoMarca', req.params);
    const { estado } = req.body;
    const idMarca = req.params.id;
    const idEmpresa = req.user.empresa;
    let nuevoEstado;

    if (req.user) {

        if(estado){
            nuevoEstado = 0;
        }else{
            nuevoEstado = 1;
        }

        console.log('editarEstadoMarca antes de enviar a la bd', estado);
        
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool
                .request()
                .input('idMarca', sql.Int, idMarca)
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('estado', sql.Bit, nuevoEstado)
                .query('UPDATE Marcas SET estado = @estado WHERE idMarca = @idMarca and idEmpresa = @idEmpresa');
            
                console.log('editarMarca result.rowsAffected', result.rowsAffected);
                res.status(200).send({ data: result.rowsAffected });
        } catch (error) {
            console.error('Error al editar el estado de la marca:', error);
            res.status(500).send({ data: undefined });
        }
    } else {
        console.log('No Access');
        res.status(401).send({ message: 'No Access', data: undefined });
    }
}


module.exports = {
    obtenerMarcas,
    obtenerMarcaPorId,
    crearMarca,
    editarMarca,
    editarEstadoMarca

}