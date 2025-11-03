const sql = require('mssql');
const dbConfig = require('../dbconfig');
const e = require('cors');

// create table Presentacion
// (
// idPresentacion int identity(1,1) primary key not null,
// idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
// codigo varchar(3) not null,
// Descripcion varchar(50) null,
// Multiplicador int null,

// )

const obtener_Presentaciones = async (req, res) => {
    console.log('obtener_Presentaciones')
    if(req.user){
        try {
            let pool = await sql.connect(dbConfig);
            let presentaciones = await pool.request().query("select * from Presentacion");
            res.status(200).send({data: presentaciones.recordset});
        } catch (error) {
            console.log('error obtener_Presentaciones',error)
            res.status(500).send({message: error.message, data: undefined});
        }
    }
    else {
        
    res.status(200).send({ message: 'No access', data: undefined });
    }
}

const obtener_presentacion_id = async (req, res) => {
    const idPresentacion = req.params.id;

    if(req.user){
        try {
            let pool = await sql.connect(dbConfig);
            let presentacion = await pool.request()
            .input('idPresentacion',sql.Int,idPresentacion)
            .query("select * from Presentaciones where idPresentacion = @idPresentacion");
            res.status(200).send({data: presentacion.recordset});
        } catch (error) {
            res.status(500).send({message: error.message, data: undefined});
        }
    }
    else {
    res.status(200).send({ message: 'No access', data: undefined });
    }
}

const crear_Presentacion = async (req, res) => {
    const { codigo, Descripcion, Multiplicador} = req.body;
    const idEmpresa = req.user.empresa;

    if(req.user){
        try {
            let pool = await sql.connect(dbConfig);
            let presentacion = await pool.request()
            .input('idEmpresa',sql.UniqueIdentifier,idEmpresa)
            .input('codigo',sql.VarChar(3),codigo)
            .input('Descripcion',sql.VarChar(50),Descripcion)
            .input('Multiplicador',sql.Int,Multiplicador)
            .query("insert into Presentaciones (idEmpresa, codigo, Descripcion, Multiplicador) values (@idEmpresa, @codigo, @Descripcion, @Multiplicador)");
            res.status(200).send({data: presentacion.recordset});
        } catch (error) {
            res.status(500).send({message: error.message, data: undefined});
        }
    }
    else {
    res.status(200).send({ message: 'No access', data: undefined });
    }
}

const editar_presentacion = async (req, res) => {
    const { codigo, Descripcion, Multiplicador} = req.body;
    const idPresentacion = req.params.id;

    if(req.user){
        try {
            let pool = await sql.connect(dbConfig);
            let presentacion = await pool.request()
            .input('idPresentacion',sql.Int,idPresentacion)
            .input('codigo',sql.VarChar(3),codigo)
            .input('Descripcion',sql.VarChar(50),Descripcion)
            .input('Multiplicador',sql.Int,Multiplicador)
            .query("update Presentaciones set codigo = @codigo, Descripcion = @Descripcion, Multiplicador = @Multiplicador where idPresentacion = @idPresentacion");
            res.status(200).send({data: presentacion.recordset});
        } catch (error) {
            res.status(500).send({message: error.message, data: undefined});
        }
    }
    else {
    res.status(200).send({ message: 'No access', data: undefined });
    }
}

const eliminar_presentacion = async (req, res) => {
    const idPresentacion = req.params.id;

    if(req.user){
        try {
            let pool = await sql.connect(dbConfig);
            let presentacion = await pool.request()
            .input('idPresentacion',sql.Int,idPresentacion)
            .query("delete from Presentaciones where idPresentacion = @idPresentacion");
            res.status(200).send({data: presentacion.recordset});
        } catch (error) {
            res.status(500).send({message: error.message, data: undefined});
        }
    }
    else {
    res.status(200).send({ message: 'No access', data: undefined });
    }
}

module.exports = {
    obtener_Presentaciones,
    obtener_presentacion_id,
    crear_Presentacion,
    editar_presentacion,
    eliminar_presentacion

}