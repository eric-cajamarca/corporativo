const sql = require('mssql');
const dbConfig = require('../dbconfig');


//1. crea el metodo crearCliente segun los datos de la tabla
const crearProveedor = async function (req, res) {
    const { idDocumento, ruc, rSocial, correo, celular, condicion, } = req.body;

    //quiero extaer data del req para poder crear el registro

    console.log('crearProveedor - req.data', req.data);
 

    if (req.user) {
        if (req.user.rol == 'Administrador' || req.user.rol=='Almacenero') {

            //antes de registrar el cliente, verificar si existe el ruc
            let pool = await sql.connect(dbConfig);
            let existeProveedor = await pool.request()
                .input('ruc', sql.VarChar, ruc)
                .query('select * from Proveedores where ruc = @ruc');

            

            if (existeProveedor.recordset.length > 0) {
                res.status(200).send({ message: 'El ruc ya existe', data: undefined });
                return;
            }else{
                try {
                    let idEmpresa = req.user.empresa;
    
                    let pool = await sql.connect(dbConfig);
                    let insertProveedor = await pool.request()
                        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                        .input('idDocumento', sql.VarChar, idDocumento)
                        .input('ruc', sql.VarChar, ruc)
                        .input('rSocial', sql.VarChar, rSocial)
                        .input('correo', sql.VarChar, correo)
                        .input('celular', sql.VarChar, celular)
                        .input('condicion', sql.VarChar, condicion)
                        .query('insert into Proveedores (idEmpresa,idDocumento,ruc,rSocial,correo,celular,condicion,estado) values (@idEmpresa,@idDocumento,@ruc,@rSocial,@correo,@celular,@condicion,1)');
    
    
                    res.status(200).send({ message: 'Proveedor creado', data: insertProveedor.rowsAffected });
    
                } catch (error) {
                    res.status(500).send({ message: error.message, data: undefined });
                }
            }

            


        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }

}

//2. crea el metodo listarClientes segun los datos de la tabla
const listarProveedores = async function (req, res) {
    if (req.user) {
        if (req.user.rol == 'Administrador'|| req.user.rol=='Vendedor') {

            try {
                let pool = await sql.connect(dbConfig);
                let proveedores = await pool.request().query('select * from Proveedores');
                res.status(200).send({ message: 'Lista de proveedores', data: proveedores.recordset });
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

//2. crea el metodo listarClientes_id segun los datos de la tabla
const listarProveedores_ruc = async function (req, res) {
    const ruc = req.params.id;

    console.log('listarProveedores_ruc - req.data', req.body);
    console.log('listarProveedores_ruc - req.params', req.params);

    if (req.user) {
        if (req.user.rol == 'Administrador'|| req.user.rol=='Vendedor') {

            try {
                let pool = await sql.connect(dbConfig);
                let proveedores = await pool.request()
                    .input('ruc', sql.VarChar, ruc)
                    .query('select * from Proveedores where ruc = @ruc');
                res.status(200).send({ message: 'Lista de Proveedores', data: proveedores.recordset });
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

const listarProveedores_id = async function (req, res) {
    const idProveedor = req.params.id;

    console.log('listarProveedores_idCliente - req.data', req.body);
    console.log('listarProveedores_idCliente - req.params', req.params);

    if (req.user) {
        if (req.user.rol == 'Administrador'|| req.user.rol=='Almacenero') {

            try {
                let pool = await sql.connect(dbConfig);
                let proveedores = await pool.request()
                    .input('idProveedor', sql.VarChar, idProveedor)
                    .query('select * from Proveedores where idProveedor = @idProveedor');
                res.status(200).send({ message: 'Lista de proveedores', data: proveedores.recordset });
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

//3. crea el metodo actualizarCliente segun los datos de la tabla
const actualizarProveedor = async function (req, res) {
    const { idDocumento, ruc, rSocial, correo, celular, condicion, } = req.body;
    const idProveedor = req.params.idProveedor;

    if (req.user) {
        if (req.user.rol == 'Administrador'|| req.user.rol=='Vendedor') {

            try {
                let pool = await sql.connect(dbConfig);
                let updateProveedor = await pool.request()
                    .input('idProveedor', sql.Int, idProveedor)
                    .input('idDocumento', sql.VarChar, idDocumento)
                    .input('ruc', sql.VarChar, ruc)
                    .input('rSocial', sql.VarChar, rSocial)
                    .input('correo', sql.VarChar, correo)
                    .input('celular', sql.VarChar, celular)
                    .input('condicion', sql.VarChar, condicion)
                    .query('update Proveedores set idDocumento = @idDocumento, ruc = @ruc, rSocial = @rSocial, correo = @correo, celular = @celular, condicion = @condicion where idCliente = @idCliente');
                res.status(200).send({ message: 'Proveedor actualizado', data: updateProveedor.recordset });
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

//4. crea el metodo eliminarCliente segun los datos de la tabla

const eliminarProveedor = async function (req, res) {
    const idProveedor = req.params.id;

    console.log('eliminarProveedor - req.params', idProveedor);


    if (req.user) {
        if (req.user.rol == 'Administrador') {
            //antes de eliminar el cliente, verificar si tiene ventas asociadas
            let pool = await sql.connect(dbConfig);
            let existeVenta = await pool.request()
                .input('idProveedor', sql.Int, idProveedor)
                .query('select * from Compras where idProveedor = @idProveedor');

            if (existeVenta.recordset.length > 0) {
                res.status(200).send({ message: 'El proveedor tiene compras asociadas, no se puede eliminar', data: undefined });
                return;
            } else {

                try {
                    let pool = await sql.connect(dbConfig);
                    let deleteProveedor = await pool.request()
                        .input('idProveedor', sql.Int, idProveedor)
                        .query('delete from Proveedores where idProveedor = @idProveedor');
                    res.status(200).send({ message: 'Proveedor eliminado', data: deleteProveedor.rowsAffected });
                } catch (error) {
                    console.log('eliminarProveedor - error', error);
                    res.status(500).send({ message: error.message, data: undefined });
                }
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


//crear el metodo para cambiar condicion del cliente a inactivo
//5. crea el metodo cambiarCondicionCliente segun los datos de la tabla
const cambiarCondicionProveedor = async function (req, res) {
    const idProveedor = req.params.id;

    const { condicion } = req.body;

    console.log('cambiarCondicionProveedor - req.params', idProveedor);
    console.log('cambiarCondicionProveedor - req.body', condicion);
    let nuevacondicion = '';

    if (condicion === 'ACTIVO') {
        nuevacondicion = 'INACTIVO';
    } else {
        nuevacondicion = 'ACTIVO';
    }

    if (req.user) {
        if (req.user.rol == 'Administrador') {


            console.log('cambiarCondicionProveedor - nuevacondicion antes de editar', nuevacondicion);

            try {
                let pool = await sql.connect(dbConfig);
                let editProveedor = await pool.request()
                    .input('idProveedor', sql.Int, idProveedor)
                    .input('nuevacondicion', sql.VarChar, nuevacondicion)
                    .query('update Proveedores set condicion = @nuevacondicion where idProveedor = @idProveedor');

                // console.log('cambiarCondicionCliente - deleteCliente', editCliente.rowsAffected);
                res.status(200).send({ message: 'Proveedor eliminado', data: editProveedor.rowsAffected });
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

const cambiarEstadoProveedor = async function (req, res) {
    const idProveedor = req.params.id;

    const { estado } = req.body;

    console.log('cambiarCondicionProveedor - req.params', idProveedor);
    console.log('cambiarCondicionProveedor - estado', estado, req.body);
    let nuevoEstado = '';

    if (estado) {
        nuevoEstado = 0;
    } else {
        nuevoEstado = 1;
    }

    if (req.user) {
        if (req.user.rol == 'Administrador') {


            console.log('cambiarCondicionProveedor - nuevacondicion antes de editar', nuevoEstado);

            try {
                let pool = await sql.connect(dbConfig);
                let editProveedor = await pool.request()
                    .input('idProveedor', sql.Int, idProveedor)
                    .input('estado', sql.Bit, nuevoEstado)
                    .query('update Proveedores set estado = @estado where idProveedor = @idProveedor');

                console.log('cambiarCondicionProveedor - deleteProveedor', editProveedor.rowsAffected);
                res.status(200).send({ message: 'Proveedor eliminado', data: editProveedor.rowsAffected });
            } catch (error) {
                console.log('cambiarCondicionProveedor - error', error);
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

//direcciones de proveedores
//1. crea el metodo crearDireccionCliente segun los datos de la tabla
const crearDireccionProveedor = async function (req, res) {
    console.log('crearDireccionProveedor req.body', req.body);
    console.log('req.user', req.user);



    if (req.user) {
        if (req.user.rol == 'Administrador') {

            
                try {
                    let idEmpresa = req.user.empresa;
                    let idProveedor = req.body.idProveedor;
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
                    let insertDireccionProveedor = await pool.request()
                        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                        .input('idProveedor', sql.Int, idProveedor)
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
                        .query('insert into DireccionProveedor (idEmpresa,idProveedor,ubigeo,codPais,region,provincia,distrito,urbanizacion,direccion,referencia,codLocal, principal) values (@idEmpresa,@idProveedor,@ubigeo,@codPais,@region,@provincia,@distrito,@urbanizacion,@direccion,@referencia,@codLocal,@principal)');

                    res.status(200).send({ message: 'DireccionProveedor creado', data: insertDireccionProveedor.rowsAffected });
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
const listarDireccionProveedores = async function (req, res) {
    if (req.user) {
        if (req.user.rol == 'Administrador') {

            try {
                let idEmpresa = req.user.empresa;

                let pool = await sql.connect(dbConfig);
                let listaDireccionProveedores = await pool.request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .query('select * from DireccionProveedor where idEmpresa = @idEmpresa');

                res.status(200).send({ message: 'Lista de DireccionProveedores', data: listaDireccionProveedores.recordset });
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

//2. crea el metodo listarDireccionProveedores segun los datos de la tabla
const listarDirecciones_idProveedor = async function (req, res) {
    const idProveedor = req.params.id;

    console.log('listarDireccionesProveedores', idProveedor);

    if (req.user) {
        if (req.user.rol == 'Administrador') {
            //aqui permito que todas las empresas puedan ver las direcciones de los Proveedores
            try {
                // let idEmpresa = req.user.empresa;

                let pool = await sql.connect(dbConfig);
                let listaDireccionProveedores = await pool.request()
                    .input('idProveedor', sql.Int, idProveedor)
                    .query('select * from DireccionProveedor where idProveedor = @idProveedor');

                res.status(200).send({ message: 'Lista de DireccionProveedores', data: listaDireccionProveedores.recordset });
            } catch (error) {
                console.log('listarDireccionesProveedores_idProveedor error', error);
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
const actualizarDireccionProveedor = async function (req, res) {
    const { idProveedor, ubigeo, codPais, region, provincia, distrito, urbanizacion, direccion, referencia, codLocal } = req.body;
    const idDireccionProveedor = req.params.idDireccionProveedor;

    if (req.user) {
        if (req.user.rol == 'Administrador') {

            try {
                let pool = await sql.connect(dbConfig);
                let actualizarDireccionProveedor = await pool.request()
                    .input('idDireccionProveedor', sql.Int, idDireccionProveedor)
                    .input('idProveedor', sql.Int, idProveedor)
                    .input('ubigeo', sql.VarChar, ubigeo)
                    .input('codPais', sql.VarChar, codPais)
                    .input('region', sql.VarChar, region)
                    .input('provincia', sql.VarChar, provincia)
                    .input('distrito', sql.VarChar, distrito)
                    .input('urbanizacion', sql.VarChar, urbanizacion)
                    .input('direccion', sql.VarChar, direccion)
                    .input('referencia', sql.VarChar, referencia)
                    .input('codLocal', sql.VarChar, codLocal)
                    .query('update DireccionProveedor set idProveedor = @idProveedor, ubigeo = @ubigeo, codPais = @codPais, region = @region, provincia = @provincia, distrito = @distrito, urbanizacion = @urbanizacion, direccion = @direccion, referencia = @referencia, codLocal = @codLocal where idDireccionProveedor = @idDireccionProveedor');

                res.status(200).send({ message: 'DireccionProveedor actualizado', data: actualizarDireccionProveedor.recordset });
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
const eliminarDireccionProveedor = async function (req, res) {
    const idDireccionProveedor = req.params.idDireccionProveedor;

    if (req.user) {
        if (req.user.rol == 'Administrador') {

            try {
                let pool = await sql.connect(dbConfig);
                let eliminarDireccionProveedor = await pool.request()
                    .input('idDireccionProveedor', sql.Int, idDireccionProveedor)
                    .query('delete from DireccionProveedor where idDireccionProveedor = @idDireccionProveedor');

                res.status(200).send({ message: 'DireccionProveedor eliminado', data: eliminarDireccionProveedor.recordset });
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
    crearProveedor,
    listarProveedores,
    actualizarProveedor,
    eliminarProveedor,
    listarProveedores_ruc,
    // cambiarCondicionProveedor,
    cambiarEstadoProveedor,
    listarProveedores_id,

    //direcciones de proveedores
    crearDireccionProveedor,
    listarDireccionProveedores,
    listarDirecciones_idProveedor,
    actualizarDireccionProveedor,
    eliminarDireccionProveedor

}