const sql = require('mssql');
const dbConfig = require('../dbconfig');
const gestoresRepository = require('../repositories/gestores.repository');


//1. crea el metodo crearCliente segun los datos de la tabla
const crearProveedor = async function (req, res) {
    const { idDocumento, ruc, rSocial, correo, celular, condicion, } = req.body;

    if (req.user) {
        if (req.user.rol == 'Administrador' || req.user.rol=='Almacenero') {

            const idEmpresa = req.user.empresa;
            if (!idEmpresa) {
                return res.status(403).send({ message: 'No autorizado: falta empresa en token', data: undefined });
            }

            // Verificar si el RUC ya existe solo en la empresa del usuario (multiempresa)
            let pool = await sql.connect(dbConfig);
            let existeProveedor = await pool.request()
                .input('ruc', sql.VarChar, ruc)
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .query('SELECT 1 FROM Proveedores WHERE ruc = @ruc AND idEmpresa = @idEmpresa');

            if (existeProveedor.recordset.length > 0) {
                return res.status(409).send({ message: 'El RUC ya existe en su empresa', data: undefined });
            }

            try {
                const insertProveedor = await pool.request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .input('idDocumento', sql.VarChar, idDocumento)
                    .input('ruc', sql.VarChar, ruc)
                    .input('rSocial', sql.VarChar, rSocial)
                    .input('correo', sql.VarChar, correo)
                    .input('celular', sql.VarChar, celular)
                    .input('condicion', sql.VarChar, condicion)
                    .query('INSERT INTO Proveedores (idEmpresa,idDocumento,ruc,rSocial,correo,celular,condicion,estado) VALUES (@idEmpresa,@idDocumento,@ruc,@rSocial,@correo,@celular,@condicion,1)');

                res.status(200).send({ message: 'Proveedor creado', data: insertProveedor.rowsAffected });
            } catch (error) {
                console.error('crearProveedor:', error);
                res.status(500).send({ message: error.message, data: undefined });
            }

            


        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access' });
    }

}

//2. Lista proveedores de la empresa del usuario + empresas gestionadas si es gestora
const listarProveedores = async function (req, res) {
    if (!req.user) {
        return res.status(401).send({ message: 'No Access' });
    }
    const idEmpresa = req.user.empresa || req.user.idEmpresa;
    if (!idEmpresa) {
        return res.status(403).send({ message: 'No autorizado: falta empresa en token' });
    }
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Vendedor') {
        return res.status(403).send({ message: 'No tiene permisos para realizar esta acción' });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresa);
        const idEmpresas = [idEmpresa, ...(gestionadas || []).map((g) => g.idEmpresa)];
        const request = pool.request();
        idEmpresas.forEach((id, i) => {
            request.input('id' + i, sql.UniqueIdentifier, id);
        });
        const placeholders = idEmpresas.map((_, i) => '@id' + i).join(', ');
        const result = await request.query(
            'SELECT * FROM Proveedores WHERE idEmpresa IN (' + placeholders + ') ORDER BY rSocial'
        );
        res.status(200).send({ message: 'Lista de proveedores', data: result.recordset });
    } catch (error) {
        console.error('listarProveedores:', error);
        res.status(500).send({ message: error.message, data: undefined });
    }
}

// Lista proveedores por RUC en empresa del usuario o gestionadas
const listarProveedores_ruc = async function (req, res) {
    const ruc = req.params.id;
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!req.user || !idEmpresa) {
        return res.status(401).send({ message: 'No Access' });
    }
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Vendedor') {
        return res.status(403).send({ message: 'No tiene permisos para realizar esta acción' });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresa);
        const idEmpresas = [idEmpresa, ...(gestionadas || []).map((g) => g.idEmpresa)];
        const request = pool.request().input('ruc', sql.VarChar, ruc);
        idEmpresas.forEach((id, i) => {
            request.input('id' + i, sql.UniqueIdentifier, id);
        });
        const placeholders = idEmpresas.map((_, i) => '@id' + i).join(', ');
        const result = await request.query(
            'SELECT * FROM Proveedores WHERE ruc = @ruc AND idEmpresa IN (' + placeholders + ')'
        );
        res.status(200).send({ message: 'Lista de Proveedores', data: result.recordset });
    } catch (error) {
        console.error('listarProveedores_ruc:', error);
        res.status(500).send({ message: error.message, data: undefined });
    }
}

const listarProveedores_id = async function (req, res) {
    const idProveedor = req.params.id;
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!req.user || !idEmpresa) {
        return res.status(401).send({ message: 'No Access' });
    }
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Almacenero') {
        return res.status(403).send({ message: 'No tiene permisos para realizar esta acción' });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresa);
        const idEmpresas = [idEmpresa, ...(gestionadas || []).map((g) => g.idEmpresa)];
        const request = pool.request().input('idProveedor', sql.Int, idProveedor);
        idEmpresas.forEach((id, i) => {
            request.input('id' + i, sql.UniqueIdentifier, id);
        });
        const placeholders = idEmpresas.map((_, i) => '@id' + i).join(', ');
        const result = await request.query(
            'SELECT * FROM Proveedores WHERE idProveedor = @idProveedor AND idEmpresa IN (' + placeholders + ')'
        );
        res.status(200).send({ message: 'Lista de proveedores', data: result.recordset });
    } catch (error) {
        console.error('listarProveedores_id:', error);
        res.status(500).send({ message: error.message, data: undefined });
    }
}

//3. actualizarProveedor: solo si pertenece a la empresa del usuario o a una gestionada
const actualizarProveedor = async function (req, res) {
    const { idDocumento, ruc, rSocial, correo, celular, condicion } = req.body;
    const idProveedor = req.params.idProveedor || req.params.id;
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!req.user || !idEmpresa) {
        return res.status(401).send({ message: 'No Access' });
    }
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Vendedor') {
        return res.status(403).send({ message: 'No tiene permisos para realizar esta acción' });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresa);
        const idEmpresas = [idEmpresa, ...(gestionadas || []).map((g) => g.idEmpresa)];
        const request = pool.request()
            .input('idProveedor', sql.Int, idProveedor)
            .input('idDocumento', sql.VarChar, idDocumento)
            .input('ruc', sql.VarChar, ruc)
            .input('rSocial', sql.VarChar, rSocial)
            .input('correo', sql.VarChar, correo)
            .input('celular', sql.VarChar, celular)
            .input('condicion', sql.VarChar, condicion);
        idEmpresas.forEach((id, i) => { request.input('id' + i, sql.UniqueIdentifier, id); });
        const placeholders = idEmpresas.map((_, i) => '@id' + i).join(', ');
        const updateResult = await request.query(
            'UPDATE Proveedores SET idDocumento = @idDocumento, ruc = @ruc, rSocial = @rSocial, correo = @correo, celular = @celular, condicion = @condicion WHERE idProveedor = @idProveedor AND idEmpresa IN (' + placeholders + ')'
        );
        if (updateResult.rowsAffected[0] === 0) {
            return res.status(404).send({ message: 'Proveedor no encontrado o no pertenece a su empresa', data: undefined });
        }
        res.status(200).send({ message: 'Proveedor actualizado', data: updateResult.rowsAffected });
    } catch (error) {
        console.error('actualizarProveedor:', error);
        res.status(500).send({ message: error.message, data: undefined });
    }
}

//4. eliminarProveedor: solo si pertenece a la empresa del usuario o a una gestionada
const eliminarProveedor = async function (req, res) {
    const idProveedor = req.params.id;
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!req.user || !idEmpresa) {
        return res.status(401).send({ message: 'No Access' });
    }
    if (req.user.rol !== 'Administrador') {
        return res.status(403).send({ message: 'No tiene permisos para realizar esta acción' });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresa);
        const idEmpresas = [idEmpresa, ...(gestionadas || []).map((g) => g.idEmpresa)];
        const existeVenta = await pool.request()
            .input('idProveedor', sql.Int, idProveedor)
            .query('SELECT 1 FROM Compras WHERE idProveedor = @idProveedor');
        if (existeVenta.recordset.length > 0) {
            return res.status(400).send({ message: 'El proveedor tiene compras asociadas, no se puede eliminar', data: undefined });
        }
        const request = pool.request().input('idProveedor', sql.Int, idProveedor);
        idEmpresas.forEach((id, i) => { request.input('id' + i, sql.UniqueIdentifier, id); });
        const placeholders = idEmpresas.map((_, i) => '@id' + i).join(', ');
        const deleteResult = await request.query(
            'DELETE FROM Proveedores WHERE idProveedor = @idProveedor AND idEmpresa IN (' + placeholders + ')'
        );
        res.status(200).send({ message: 'Proveedor eliminado', data: deleteResult.rowsAffected[0] });
    } catch (error) {
        console.error('eliminarProveedor:', error);
        res.status(500).send({ message: error.message, data: undefined });
    }
}


//crear el metodo para cambiar condicion del cliente a inactivo
//5. crea el metodo cambiarCondicionCliente segun los datos de la tabla
const cambiarCondicionProveedor = async function (req, res) {
    const idProveedor = req.params.id;

    const { condicion } = req.body;

            let nuevacondicion = '';

    if (condicion === 'ACTIVO') {
        nuevacondicion = 'INACTIVO';
    } else {
        nuevacondicion = 'ACTIVO';
    }

    if (req.user) {
        if (req.user.rol == 'Administrador') {


            
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

            let nuevoEstado = '';

    if (estado) {
        nuevoEstado = 0;
    } else {
        nuevoEstado = 1;
    }

    if (req.user) {
        if (req.user.rol == 'Administrador') {


            
            try {
                let pool = await sql.connect(dbConfig);
                let editProveedor = await pool.request()
                    .input('idProveedor', sql.Int, idProveedor)
                    .input('estado', sql.Bit, nuevoEstado)
                    .query('update Proveedores set estado = @estado where idProveedor = @idProveedor');

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

//direcciones de proveedores
//1. crea el metodo crearDireccionCliente segun los datos de la tabla
const crearDireccionProveedor = async function (req, res) {
        


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
    const { idProveedor, ubigeo, codPais, region, provincia, distrito, urbanizacion, direccion, referencia, codLocal, principal } = req.body;
    const idDireccionProveedor = req.params.id || req.params.idDireccionProveedor;

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
                    .input('principal', sql.Bit, principal === true || principal === 1)
                    .query('update DireccionProveedor set idProveedor = @idProveedor, ubigeo = @ubigeo, codPais = @codPais, region = @region, provincia = @provincia, distrito = @distrito, urbanizacion = @urbanizacion, direccion = @direccion, referencia = @referencia, codLocal = @codLocal, principal = @principal where idDireccionProveedor = @idDireccionProveedor');

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
    const idDireccionProveedor = req.params.id || req.params.idDireccionProveedor;

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