const sql = require('mssql');
const dbConfig = require('../dbconfig');
const gestoresRepository = require('../repositories/gestores.repository');

// create table Clientes
// (
// idCliente int identity (1,1) primary key not null,
// idEmpresa  UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
// idDocumento varchar(1) not null,
// ruc varchar(11) not null,
// rSocial varchar(200) not null,
// correo varchar(100) null,
// celular varchar (50) null,
// condicion varchar(50) null,
// estado bit not null

// )


//1. crea el metodo crearCliente segun los datos de la tabla
const crearCliente = async function (req, res) {
    const { idDocumento, ruc, rSocial, correo, celular, condicion, sujetoCredito, lineaCredito } = req.body;

    //quiero extaer data del req para poder crear el registro

    console.log('crearCliente - req.data', req.data);
    console.log('crearCliente - req.body', req.body);
    console.log('crearCliente- req.user', req.user);

    if (req.user) {
        if (req.user.rol == 'Administrador' || req.user.rol=='Vendedor') {

            const idEmpresa = req.user.empresa;
            let pool = await sql.connect(dbConfig);
            let existeCliente = await pool.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('ruc', sql.VarChar, ruc)
                .query('SELECT * FROM Clientes WHERE idEmpresa = @idEmpresa AND ruc = @ruc');

            if (existeCliente.recordset.length > 0) {
                res.status(200).send({ message: 'El ruc ya existe', data: undefined });
                return;
            }
            try {
                const esSujetoCredito = sujetoCredito === true || sujetoCredito === 1 || String(sujetoCredito).toLowerCase() === 'true';
                const linea = lineaCredito != null && !isNaN(Number(lineaCredito)) ? Math.max(0, Number(lineaCredito)) : 0;
                await pool.request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .input('idDocumento', sql.VarChar, idDocumento)
                    .input('ruc', sql.VarChar, ruc)
                    .input('rSocial', sql.VarChar, rSocial)
                    .input('correo', sql.VarChar, correo || null)
                    .input('celular', sql.VarChar, celular || null)
                    .input('condicion', sql.VarChar, condicion || null)
                    .input('sujetoCredito', sql.Bit, esSujetoCredito ? 1 : 0)
                    .input('lineaCredito', sql.Decimal(18, 2), linea)
                    .query('INSERT INTO Clientes (idEmpresa,idDocumento,ruc,rSocial,correo,celular,condicion,estado,sujetoCredito,lineaCredito) VALUES (@idEmpresa,@idDocumento,@ruc,@rSocial,@correo,@celular,@condicion,1,@sujetoCredito,@lineaCredito)');

                const creado = await pool.request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .input('ruc', sql.VarChar, ruc)
                    .query('SELECT idCliente, idEmpresa, idDocumento, ruc, rSocial, correo, celular, condicion, estado, sujetoCredito, lineaCredito FROM Clientes WHERE idEmpresa = @idEmpresa AND ruc = @ruc');
                const cliente = creado.recordset && creado.recordset[0] ? creado.recordset[0] : null;
                res.status(200).send({ message: 'Cliente creado', data: cliente });
            } catch (error) {
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

// Lista solo los clientes de la empresa del usuario logueado (idEmpresa del token).
const listarClientes = async function (req, res) {
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
        const result = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query('SELECT * FROM Clientes WHERE idEmpresa = @idEmpresa ORDER BY rSocial');
        res.status(200).send({ message: 'Lista de clientes', data: result.recordset });
    } catch (error) {
        console.error('listarClientes:', error);
        res.status(500).send({ message: error.message, data: undefined });
    }
}

//2. crea el metodo listarClientes_ruc por documento (ruc/dni) en empresa del usuario o gestionadas
const listarClientes_ruc = async function (req, res) {
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
            'SELECT * FROM Clientes WHERE ruc = @ruc AND idEmpresa IN (' + placeholders + ')'
        );
        res.status(200).send({ message: 'Lista de clientes', data: result.recordset });
    } catch (error) {
        console.error('listarClientes_ruc:', error);
        res.status(500).send({ message: error.message, data: undefined });
    }
}

const listarClientes_id = async function (req, res) {
    const idCliente = req.params.id;
    if (!req.user || !(req.user.empresa || req.user.idEmpresa)) {
        return res.status(401).send({ message: 'No Access' });
    }
    const idEmpresa = req.user.empresa || req.user.idEmpresa;
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Vendedor') {
        return res.status(403).send({ message: 'No tiene permisos para realizar esta acción' });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresa);
        const idEmpresas = [idEmpresa, ...(gestionadas || []).map((g) => g.idEmpresa)];
        const request = pool.request().input('idCliente', sql.Int, idCliente);
        idEmpresas.forEach((id, i) => {
            request.input('id' + i, sql.UniqueIdentifier, id);
        });
        const placeholders = idEmpresas.map((_, i) => '@id' + i).join(', ');
        const result = await request.query(
            'SELECT * FROM Clientes WHERE idCliente = @idCliente AND idEmpresa IN (' + placeholders + ')'
        );
        res.status(200).send({ message: 'Lista de clientes', data: result.recordset });
    } catch (error) {
        console.error('listarClientes_id:', error);
        res.status(500).send({ message: error.message, data: undefined });
    }
}

//3. actualizarCliente: solo si el cliente pertenece a la empresa del usuario o a una gestionada
const actualizarCliente = async function (req, res) {
    const { idDocumento, ruc, rSocial, correo, celular, condicion, sujetoCredito, lineaCredito } = req.body;
    const idCliente = req.params.id;
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
        const esSujetoCredito = sujetoCredito === true || sujetoCredito === 1 || String(sujetoCredito).toLowerCase() === 'true';
        const linea = lineaCredito != null && !isNaN(Number(lineaCredito)) ? Math.max(0, Number(lineaCredito)) : 0;
        const request = pool.request()
            .input('idCliente', sql.Int, idCliente)
            .input('idDocumento', sql.VarChar, idDocumento)
            .input('ruc', sql.VarChar, ruc)
            .input('rSocial', sql.VarChar, rSocial)
            .input('correo', sql.VarChar, correo)
            .input('celular', sql.VarChar, celular)
            .input('condicion', sql.VarChar, condicion)
            .input('sujetoCredito', sql.Bit, esSujetoCredito ? 1 : 0)
            .input('lineaCredito', sql.Decimal(18, 2), linea);
        idEmpresas.forEach((id, i) => { request.input('id' + i, sql.UniqueIdentifier, id); });
        const placeholders = idEmpresas.map((_, i) => '@id' + i).join(', ');
        const updateResult = await request.query(
            'UPDATE Clientes SET idDocumento = @idDocumento, ruc = @ruc, rSocial = @rSocial, correo = @correo, celular = @celular, condicion = @condicion, sujetoCredito = @sujetoCredito, lineaCredito = @lineaCredito WHERE idCliente = @idCliente AND idEmpresa IN (' + placeholders + ')'
        );
        if (updateResult.rowsAffected[0] === 0) {
            return res.status(404).send({ message: 'Cliente no encontrado o no pertenece a su empresa', data: undefined });
        }
        const actualizado = await pool.request().input('idCliente', sql.Int, idCliente)
            .query('SELECT idCliente, idEmpresa, idDocumento, ruc, rSocial, correo, celular, condicion, estado, sujetoCredito, lineaCredito FROM Clientes WHERE idCliente = @idCliente');
        res.status(200).send({ message: 'Cliente actualizado', data: actualizado.recordset });
    } catch (error) {
        console.error('actualizarCliente:', error);
        res.status(500).send({ message: error.message, data: undefined });
    }
}

//4. eliminarCliente: solo si el cliente pertenece a la empresa del usuario o a una gestionada
const eliminarCliente = async function (req, res) {
    const idCliente = req.params.id;
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
        const request = pool.request().input('idCliente', sql.Int, idCliente);
        idEmpresas.forEach((id, i) => { request.input('id' + i, sql.UniqueIdentifier, id); });
        const placeholders = idEmpresas.map((_, i) => '@id' + i).join(', ');
        const deleteResult = await request.query(
            'DELETE FROM Clientes WHERE idCliente = @idCliente AND idEmpresa IN (' + placeholders + ')'
        );
        res.status(200).send({ message: 'Cliente eliminado', data: deleteResult.rowsAffected[0] });
    } catch (error) {
        console.error('eliminarCliente:', error);
        res.status(500).send({ message: error.message, data: undefined });
    }
}


//crear el metodo para cambiar condicion del cliente a inactivo
//5. crea el metodo cambiarCondicionCliente segun los datos de la tabla
const cambiarCondicionCliente = async function (req, res) {
    const idCliente = req.params.id;

    const { condicion } = req.body;

    console.log('cambiarCondicionCliente - req.params', idCliente);
    console.log('cambiarCondicionCliente - req.body', condicion);
    let nuevacondicion = '';

    if (condicion === 'ACTIVO') {
        nuevacondicion = 'INACTIVO';
    } else {
        nuevacondicion = 'ACTIVO';
    }

    if (req.user) {
        if (req.user.rol == 'Administrador') {


            console.log('cambiarCondicionCliente - nuevacondicion antes de editar', nuevacondicion);

            try {
                let pool = await sql.connect(dbConfig);
                let editCliente = await pool.request()
                    .input('idCliente', sql.Int, idCliente)
                    .input('nuevacondicion', sql.VarChar, nuevacondicion)
                    .query('update Clientes set condicion = @nuevacondicion where idCliente = @idCliente');

                console.log('cambiarCondicionCliente - deleteCliente', editCliente.rowsAffected);
                res.status(200).send({ message: 'Cliente eliminado', data: editCliente.rowsAffected });
            } catch (error) {
                console.log('cambiarCondicionCliente - error', error);
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

const cambiarEstadoCliente = async function (req, res) {
    const idCliente = req.params.id;

    const { estado } = req.body;

    console.log('cambiarCondicionCliente - req.params', idCliente);
    console.log('cambiarCondicionCliente - estado', estado, req.body);
    let nuevoEstado = '';

    if (estado) {
        nuevoEstado = 0;
    } else {
        nuevoEstado = 1;
    }

    if (req.user) {
        if (req.user.rol == 'Administrador') {


            console.log('cambiarCondicionCliente - nuevacondicion antes de editar', nuevoEstado);

            try {
                let pool = await sql.connect(dbConfig);
                let editCliente = await pool.request()
                    .input('idCliente', sql.Int, idCliente)
                    .input('estado', sql.Bit, nuevoEstado)
                    .query('update Clientes set estado = @estado where idCliente = @idCliente');

                console.log('cambiarCondicionCliente - deleteCliente', editCliente.rowsAffected);
                res.status(200).send({ message: 'Cliente eliminado', data: editCliente.rowsAffected });
            } catch (error) {
                console.log('cambiarCondicionCliente - error', error);
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
    crearCliente,
    listarClientes,
    actualizarCliente,
    eliminarCliente,
    listarClientes_ruc,
    // cambiarCondicionCliente,
    cambiarEstadoCliente,
    listarClientes_id

}