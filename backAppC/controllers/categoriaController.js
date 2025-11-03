const sql = require('mssql');
const dbConfig = require('../dbconfig');



// create table Categorias 
// (
// idCategoria int identity (1,1) primary key not null,
// idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
// Descripcion varchar(200)not null,

// )

const obtener_Categorias = async (req, res) => {
    const idEmpresa = req.user.empresa;
    if(req.user){
        try {
            let pool = await sql.connect(dbConfig);
            let categorias = await pool
            .request()
            .input('idEmpresa',sql.UniqueIdentifier,idEmpresa)
            .query("select * from Categorias where idEmpresa = @idEmpresa");
            // .query("select * from Categoria");
            res.status(200).send({data: categorias.recordset});
        } catch (error) {
            res.status(500).send({message: error.message, data: undefined});
        }
    }
    else {
    res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
}

// const obtener_Categorias_idEmpresa = async (req, res) => {

//    const idEmpresa = req.user.empresa;
//     if(req.user){
//         try {
//             let pool = await sql.connect(dbConfig);
//             let categorias = await pool.request()
//             .input('idEmpresa',sql.UniqueIdentifier,idEmpresa)
//             .query("select * from Categorias where idEmpresa = @idEmpresa");
//             res.status(200).send({data: categorias.recordset});
//         } catch (error) {
//             res.status(500).send({message: error.message, data: undefined});
//         }
//     }
//     else {
//     res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
//     }
// }

const obtener_Categoria_id = async (req, res) => {
    const idCategoria = req.params.id;

    if(req.user){
        try {
            let pool = await sql.connect(dbConfig);
            let categoria = await pool.request()
            .input('idCategoria',sql.Int,idCategoria)
            .query("select * from Categorias where idCategoria = @idCategoria");
            res.status(200).send({data: categoria.recordset});
        } catch (error) {
            console.log('obtener_Categoria_id', error);
            res.status(500).send({message: error.message, data: undefined});
        }
    }
    else {
    res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }

}

// const obtener_Categoria_id_idempresa = async (req, res) => {
//     const idCategoria = req.params.id;
//     const idEmpresa = req.user.empresa;

//     if(req.user){
//         try {
//             let pool = await sql.connect(dbConfig);
//             let categoria = await pool.request()
//             .input('idCategoria',sql.Int,idCategoria)
//             .input('idEmpresa',sql.UniqueIdentifier,idEmpresa)
//             .query("select * from Categorias where idCategoria = @idCategoria and idEmpresa = @idEmpresa");
//             res.status(200).send({data: categoria.recordset});
//         } catch (error) {
//             console.log('obtener_Categoria_id_idempresa', error);
//             res.status(500).send({message: error.message, data: undefined});
//         }
//     }
//     else {
//     res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
//     }
// }

const crear_Categoria = async (req, res) => {
    const {descripcion, nombre } = req.body;
    const idEmpresa = req.user.empresa;
    const estado = 1;
    if(req.user){
        try {
            let pool = await sql.connect(dbConfig);
            let categoria = await pool.request()
            .input('idEmpresa',sql.UniqueIdentifier,idEmpresa)
            .input('nombre',sql.VarChar,nombre)
            .input('descripcion',sql.VarChar,descripcion)
            .input('estado',sql.Bit,estado)
            .query("insert into Categorias (idEmpresa,nombre,descripcion,estado) values (@idEmpresa,@nombre,@descripcion,@estado)");
            res.status(200).send({data: categoria.rowsAffected});
        } catch (error) {
            console.log('crear_Categoria', error);
            res.status(500).send({message: error.message, data: undefined});
        }
    }
    else {
    res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }

}

const editar_Categoria = async function(req, res) {
    const {descripcion, nombre } = req.body;
    const idCategoria = req.params.id;
    const idEmpresa = req.user.empresa;

    if(req.user){
        try {
            let pool = await sql.connect(dbConfig);
            let categoria = await pool.request()
            .input('idCategoria',sql.Int,idCategoria)
            .input('idEmpresa',sql.UniqueIdentifier,idEmpresa)
            .input('nombre',sql.VarChar,nombre)
            .input('descripcion',sql.VarChar,descripcion)
            .query("update Categorias set nombre=@nombre, descripcion = @descripcion where idCategoria = @idCategoria and idEmpresa = @idEmpresa");
            res.status(200).send({data: categoria.rowsAffected});
        } catch (error) {
            console.log('editar_Categoria', error);
            res.status(500).send({message: error.message, data: undefined});
        }
    }
    else {
    res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }


}

const cambiar_estado_categoria = async function(req, res) {
    const {estado } = req.body;
    const idCategoria = req.params.id;
    const idEmpresa = req.user.empresa;
    var cambioEstado = 0;

    if(req.user){
        //if(estado == 1 || estado == 0){
            if(estado){

                cambioEstado = 0;
            }else{
                cambioEstado = 1;
            }
        //}

        try {
            let pool = await sql.connect(dbConfig);
            let categoria = await pool.request()
            .input('idCategoria',sql.Int,idCategoria)
            .input('idEmpresa',sql.UniqueIdentifier,idEmpresa)
            .input('estado',sql.Bit,cambioEstado)
            .query("update Categorias set estado=@estado where idCategoria = @idCategoria and idEmpresa = @idEmpresa");
            res.status(200).send({data: categoria.rowsAffected});
        } catch (error) {
            console.log('cambiar_estado_categoria', error);
            res.status(500).send({message: error.message, data: undefined});
        }
    }
    else {
    res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
}

const eliminar_Categoria = async (req, res) => {
    const idCategoria = req.params.id;
    const idEmpresa = req.user.empresa;

    if(req.user){
        try {
            let pool = await sql.connect(dbConfig);
            let categoria = await pool.request()
            .input('idCategoria',sql.Int,idCategoria)
            .input('idEmpresa',sql.UniqueIdentifier,idEmpresa)
            .query("delete from Categorias where idCategoria = @idCategoria and idEmpresa = @idEmpresa");
            res.status(200).send({data: categoria.rowsAffected});
        } catch (error) {
            console.log('eliminar_Categoria', error);
            res.status(500).send({message: error.message, data: undefined});
        }
    }
    else {
    res.status(200).send({ message: 'No Acces', data: undefined });
    }
    
}


module.exports = {
    obtener_Categorias,
    //obtener_Categorias_idEmpresa,
    obtener_Categoria_id,
    //obtener_Categoria_id_idempresa,
    crear_Categoria,
    editar_Categoria,
    cambiar_estado_categoria,
    eliminar_Categoria

}