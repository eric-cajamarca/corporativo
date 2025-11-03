const sql = require('mssql');
const dbConfig = require('../dbconfig');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const jwt = require('../helpers/jwt');
const { v4: uuidv4 } = require('uuid');


//crear n crud con esta tabla CREATE TABLE DireccionClientes ( idDireccionClientes INT IDENTITY(1,1) PRIMARY KEY not null, idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE, idCliente int not null,ubigeo varchar(10) null,codPais varchar(10) null,region varchar(50) NULL,provincia varchar(50) NULL,distrito varchar(50) NULL,urbanizacion varchar(100) null,direccion VARCHAR(255) null,referencia varchar(200) null,codLocal varchar(10) null)
//1. crea el metodo crearDireccionCliente segun los datos de la tabla
const crearDireccionCliente = async function (req, res) {
    console.log('crearDireccionCliente req.body', req.body);
    console.log('req.user', req.user);



    if (req.user) {
        if (req.user.rol == 'Administrador') {

            
                try {
                    let idEmpresa = req.user.empresa;
                    let idCliente = req.body.idCliente;
                    let ubigeo = req.body.ubigeo;
                    let codPais = req.body.codpais;
                    let region = req.body.region;
                    let provincia = req.body.provincia;
                    let distrito = req.body.distrito;
                    let urbanizacion = req.body.urbanizacion;
                    let direccion = req.body.direccion;
                    let referencia = req.body.referencia;
                    let codLocal = req.body.codLocal;
                    let principal = req.body.principal;

                    let pool = await sql.connect(dbConfig);
                    let insertDireccionCliente = await pool.request()
                        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                        .input('idCliente', sql.Int, idCliente)
                        .input('ubigeo', sql.VarChar, ubigeo)
                        .input('codPais', sql.VarChar, codPais)
                        .input('region', sql.VarChar, region)
                        .input('provincia', sql.VarChar, provincia)
                        .input('distrito', sql.VarChar, distrito)
                        .input('urbanizacion', sql.VarChar, urbanizacion)
                        .input('direccion', sql.VarChar, direccion)
                        .input('referencia', sql.VarChar, referencia)
                        .input('codLocal', sql.VarChar, codLocal)
                        .input('principal', sql.Bit, principal)
                        .query('insert into DireccionClientes (idEmpresa,idCliente,ubigeo,codPais,region,provincia,distrito,urbanizacion,direccion,referencia,codLocal, principal) values (@idEmpresa,@idCliente,@ubigeo,@codPais,@region,@provincia,@distrito,@urbanizacion,@direccion,@referencia,@codLocal,@principal)');

                    res.status(200).send({ message: 'DireccionCliente creado', data: insertDireccionCliente.rowsAffected });
                } catch (error) {
                    console.log('error', error);
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


//2. crea el metodo listarDireccionClientes segun los datos de la tabla
const listarDireccionClientes = async function (req, res) {
    if (req.user) {
        if (req.user.rol == 'Administrador') {

            try {
                let idEmpresa = req.user.empresa;

                let pool = await sql.connect(dbConfig);
                let listaDireccionClientes = await pool.request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .query('select * from DireccionClientes where idEmpresa = @idEmpresa');

                res.status(200).send({ message: 'Lista de DireccionClientes', data: listaDireccionClientes.recordset });
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

//2. crea el metodo listarDireccionClientes segun los datos de la tabla
const listarDireccionesClientes_idCliente = async function (req, res) {
    const idCliente = req.params.id;

    console.log('listarDireccionesClientes_idCliente idCliente', idCliente);

    if (req.user) {
        if (req.user.rol == 'Administrador') {
            //aqui permito que todas las empresas puedan ver las direcciones de los clientes
            try {
                // let idEmpresa = req.user.empresa;

                let pool = await sql.connect(dbConfig);
                let listaDireccionClientes = await pool.request()
                    .input('idCliente', sql.Int, idCliente)
                    .query('select * from DireccionClientes where idCliente = @idCliente');

                res.status(200).send({ message: 'Lista de DireccionClientes', data: listaDireccionClientes.recordset });
            } catch (error) {
                console.log('listarDireccionesClientes_idCliente error', error);
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


//3. crea el metodo actualizarDireccionCliente segun los datos de la tabla
const actualizarDireccionCliente = async function (req, res) {
    const { idCliente, ubigeo, codPais, region, provincia, distrito, urbanizacion, direccion, referencia, codLocal } = req.body;
    const idDireccionCliente = req.params.idDireccionCliente;

    if (req.user) {
        if (req.user.rol == 'Administrador') {

            try {
                let pool = await sql.connect(dbConfig);
                let actualizarDireccionCliente = await pool.request()
                    .input('idDireccionCliente', sql.Int, idDireccionCliente)
                    .input('idCliente', sql.Int, idCliente)
                    .input('ubigeo', sql.VarChar, ubigeo)
                    .input('codPais', sql.VarChar, codPais)
                    .input('region', sql.VarChar, region)
                    .input('provincia', sql.VarChar, provincia)
                    .input('distrito', sql.VarChar, distrito)
                    .input('urbanizacion', sql.VarChar, urbanizacion)
                    .input('direccion', sql.VarChar, direccion)
                    .input('referencia', sql.VarChar, referencia)
                    .input('codLocal', sql.VarChar, codLocal)
                    .query('update DireccionClientes set idCliente = @idCliente, ubigeo = @ubigeo, codPais = @codPais, region = @region, provincia = @provincia, distrito = @distrito, urbanizacion = @urbanizacion, direccion = @direccion, referencia = @referencia, codLocal = @codLocal where idDireccionCliente = @idDireccionCliente');

                res.status(200).send({ message: 'DireccionCliente actualizado', data: actualizarDireccionCliente.recordset });
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

//crea el metodo eliminarDireccionCliente segun los datos de la tabla
const eliminarDireccionCliente = async function (req, res) {
    const idDireccionCliente = req.params.idDireccionCliente;

    if (req.user) {
        if (req.user.rol == 'Administrador') {

            try {
                let pool = await sql.connect(dbConfig);
                let eliminarDireccionCliente = await pool.request()
                    .input('idDireccionCliente', sql.Int, idDireccionCliente)
                    .query('delete from DireccionClientes where idDireccionCliente = @idDireccionCliente');

                res.status(200).send({ message: 'DireccionCliente eliminado', data: eliminarDireccionCliente.recordset });
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

module.exports = {
    crearDireccionCliente,
    listarDireccionClientes,
    actualizarDireccionCliente,
    eliminarDireccionCliente,
    listarDireccionesClientes_idCliente
}