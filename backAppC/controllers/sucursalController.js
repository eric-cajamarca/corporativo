const sql = require('mssql');
const dbConfig = require('../dbconfig');

const { v4: uuidv4 } = require('uuid');

// create table Sucursal
// (
// idSucursal UNIQUEIDENTIFIER primary key not null,
// idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
// nombre varchar(20) not null,
// direccion varchar(200) null,
// idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES UsuarioWeb (idUsuario) not null,
// fregistro datetime not null
// )

// crea un crud para la tabla sucursal de la base de datos
const obtener_sucursal_idempresa = async function (req, res) {
    const idEmpresa = req.user.empresa;
    console.log('obtener_sucursal_idempresa idEmpresa: ', idEmpresa);
    if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                let pool = await sql.connect(dbConfig);
                let sucursal = await pool.request().query("SELECT idSucursal,nombre,fregistro FROM Sucursal WHERE idEmpresa = '" + idEmpresa + "'");

                //quiero recorrer sucursal y cambiar el formato de la fecha de fregistro
                sucursal.recordset.forEach(element => {
                    element.fregistro = element.fregistro.toISOString().split('T')[0];
                });           

                res.status(200).send({ message: 'succes', data: sucursal.recordset });
            } catch (error) {
                console.log('obterner sucursal error: ' + error);
                res.status(500).send({ message: 'Error al obtener los sucursal', data: undefined });
            }
        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access', data: undefined });
    }
}

const obtener_sucursal_todos = async function (req, res) {
    if (!req.user) {
        return res.status(401).send({ message: 'No Access', data: undefined });
    }
    const idEmpresa = req.user.empresa || req.user.idEmpresa;
    if (!idEmpresa) {
        return res.status(403).send({ message: 'No autorizado: falta empresa en token', data: undefined });
    }
    if (req.user.rol !== 'Administrador') {
        return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`SELECT * FROM Sucursal WHERE idEmpresa = @idEmpresa ORDER BY CASE WHEN ISNULL(esPrincipal,0) = 1 THEN 0 ELSE 1 END, nombre`);
        res.status(200).send({ data: result.recordset });
    } catch (error) {
        console.error('obtener_sucursal_todos:', error);
        res.status(500).send({ message: 'Error al obtener las sucursales', data: undefined });
    }
}

/** Marca una sucursal como principal para la empresa (solo una por empresa). Usado en gestión de ubicaciones y dirección principal. */
const establecer_sucursal_principal = async function (req, res) {
    if (!req.user) return res.status(401).send({ message: 'No Access', data: undefined });
    const idEmpresa = req.user.empresa || req.user.idEmpresa;
    if (!idEmpresa) return res.status(403).send({ message: 'No autorizado: falta empresa en token', data: undefined });
    if (req.user.rol !== 'Administrador') return res.status(403).send({ message: 'Sin permisos', data: undefined });
    const idSucursal = req.params.id;
    if (!idSucursal) return res.status(400).send({ message: 'Falta id sucursal', data: undefined });
    try {
        const pool = await sql.connect(dbConfig);
        const verif = await pool.request()
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query('SELECT 1 FROM Sucursal WHERE idSucursal = @idSucursal AND idEmpresa = @idEmpresa');
        if (!verif.recordset || verif.recordset.length === 0) {
            return res.status(404).send({ message: 'Sucursal no encontrada o no pertenece a su empresa', data: undefined });
        }
        await pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa).query('UPDATE Sucursal SET esPrincipal = 0 WHERE idEmpresa = @idEmpresa');
        await pool.request()
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .query('UPDATE Sucursal SET esPrincipal = 1 WHERE idSucursal = @idSucursal');
        res.status(200).send({ message: 'Sucursal principal actualizada', data: { idSucursal } });
    } catch (error) {
        console.error('establecer_sucursal_principal:', error);
        res.status(500).send({ message: 'Error al establecer sucursal principal', data: undefined });
    }
};

// const crear_sucursal_idEmpresa = async function (req, res) {

//     const { nombre, direccion } = req.body;

//     const idUsuario = req.user.idUsuario;
//     const idEmpresa = req.user.empresa;
//     const idSucursal = uuidv4();

//     if (req.user) {
//         if (req.user.rol == 'Administrador') {
//             try {
//                 let pool = await sql.connect(dbConfig);
//                 let sucursal = await pool
//                     .request()
//                     .input('idSucursal', sql.UniqueIdentifier, idSucursal)
//                     .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
//                     .input('nombre', sql.VarChar, nombre)
//                     .input('direccion', sql.VarChar, direccion)
//                     .input('idUsuario', sql.UniqueIdentifier, idUsuario)
//                     .query("INSERT INTO Sucursal (idSucursal, idEmpresa, nombre, direccion, idUsuario, fregistro) VALUES (@idSucursal, @idEmpresa, @nombre, @direccion, @idUsuario, GETDATE())");

//                 res.status(200).send({ message: 'Sucursal creada correctamente', data: sucursal.rowsAffected });
//             } catch (error) {
//                 console.log('crear sucursal error: ' + error);
//                 res.status(500).send({ message: 'Error al crear la sucursal', data: undefined });
//             }
//         } else {
//             res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
//         }
//     }
//     else {
//         res.status(500).send({ message: 'No Access', data: undefined });
//     }
// }

const editar_sucursal_idEmpresa = async function (req, res) {

    console.log('editar_sucursal_idEmpresa: ', req.body);
    const { idEmpresa, idSucursal, nombre, direccion } = req.body;

    if (req.user) {
        if (req.user.rol == 'Administrador') {

            try {
                let pool = await sql.connect(dbConfig);
                let sucursal = await pool
                    .request()
                    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .input('nombre', sql.VarChar, nombre)
                    .input('direccion', sql.VarChar, direccion)
                    
                    .query("UPDATE Sucursal SET nombre = @nombre, direccion = @direccion, fregistro = GETDATE() WHERE idSucursal = @idSucursal and idEmpresa = @idEmpresa");

                res.status(200).send({ message: 'Sucursal editada correctamente', data: sucursal.rowsAffected });
            } catch (error) {
                console.log('editar sucursal error: ' + error);
                res.status(500).send({ message: 'Error al editar la sucursal', data: undefined });
            }

        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access', data: undefined });
    }
}

const editar_estado_idsucursal = async function (req, res) {
    console.log('editar_estado_idsucursal: ', req.body, req.params.id);
    const  idSucursal  = req.params.id;
    const estado = req.body.estado;

    let nuevo_estado = false;
    

    if (req.user) {
        if (req.user.rol == 'Administrador') {

            if (!estado) {
                nuevo_estado = true;
            } else {
                nuevo_estado = false;
            }

            console.log('nuevo_estado: ', nuevo_estado);
            try {
                let pool = await sql.connect(dbConfig);
                let sucursal = await pool
                    .request()
                    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                    .input('estado', sql.Bit, nuevo_estado)
                    .query("UPDATE Sucursal SET estado = @estado WHERE idSucursal = @idSucursal");

                res.status(200).send({ message: 'Estado de la sucursal editado correctamente', data: sucursal.rowsAffected });
            } catch (error) {
                console.log('editar sucursal error: ' + error);
                res.status(500).send({ message: 'Error al editar la sucursal', data: undefined });
            }

        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access', data: undefined });
    }

}

const eliminar_sucursal_idempresa = async function (req, res) {
    const idEmpresa = req.user.empresa;

    if (req.user) {
        if (req.user.rol == 'Administrador') {

            try {
                let pool = await sql.connect(dbConfig);
                let sucursal = await pool
                    .request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .query("DELETE FROM Sucursal WHERE idEmpresa = @idEmpresa");

                res.status(200).send({ message: 'Sucursal eliminada correctamente', data: sucursal.rowsAffected });
            } catch (error) {
                console.log('eliminar sucursal error: ' + error);
                res.status(500).send({ message: 'Error al eliminar la sucursal', data: undefined });
            }

        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access', data: undefined });
    }
}

///////////////////////////////////////////////////////////////////////////////////////

// create table StockSucursal
// (
// idStockSucursal int identity(1,1) primary key not null,
// idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa), 
// idSucursal UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Sucursal(idSucursal) ON DELETE CASCADE,
// idProducto UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos (idProducto),
// cantidad decimal(18,2) not null,
// ubicacion Varchar(20) null,
// fIngreso datetime null,
// idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES UsuarioWeb (idUsuario) not null,

// )


const obtener_stock_sucursal_idProducto = async function (req, res) {
    const idProducto = req.params.id;
    const idSucursal = req.body.idSucursal;

    if (!req.user) {
        return res.status(500).send({ message: 'No Access', data: undefined });
    }
    if (req.user.rol !== 'Administrador') {
        return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .input('idProducto', sql.UniqueIdentifier, idProducto)
            .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)
            .query(`
                SELECT l.idLote, l.idProducto, l.idSucursal, l.cantidadDisponible AS cantidad, l.costoUnitario, l.fechaIngreso, l.fechaVencimiento,
                       p.codigo, p.descripcion, p.cUnitario
                FROM Lotes l
                INNER JOIN Productos p ON l.idProducto = p.idProducto
                WHERE l.idSucursal = @idSucursal AND l.idProducto = @idProducto AND l.idEmpresa = @idEmpresa AND l.cantidadDisponible > 0
            `);
        res.status(200).send({ data: result.recordset });
    } catch (error) {
        console.error('obtener_stock_sucursal_idProducto:', error.message);
        res.status(500).send({ message: 'Error al obtener el stock', data: undefined });
    }
}

const obtener_stock_sucursales_idempresa = async function (req, res) {
    const idEmpresa = req.user?.empresa;
    if (!req.user) {
        return res.status(500).send({ message: 'No Access', data: undefined });
    }
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Almacenero') {
        return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .query(`
                SELECT l.idLote, l.idEmpresa, l.idSucursal, l.idProducto, l.cantidadDisponible AS cantidad, l.costoUnitario, l.fechaIngreso, l.fechaVencimiento,
                       p.codigo, p.descripcion, p.cUnitario, p.idCategoria, p.idMarca, p.idPresentacion,
                       s.nombre AS sucursal, c.nombre AS categoria, m.nombre AS marca, pr.codigo AS codigoPresentacion, pr.descripcion AS descripcionPres
                FROM Lotes l
                INNER JOIN Productos p ON l.idProducto = p.idProducto
                INNER JOIN Sucursal s ON l.idSucursal = s.idSucursal
                LEFT JOIN Categorias c ON p.idCategoria = c.idCategoria
                LEFT JOIN Marcas m ON p.idMarca = m.idMarca
                LEFT JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
                WHERE l.idEmpresa = @idEmpresa AND l.cantidadDisponible > 0
                ORDER BY s.nombre, p.descripcion, l.fechaIngreso DESC
            `);
        res.status(200).send({ data: result.recordset });
    } catch (error) {
        console.error('obtener_stock_sucursales_idempresa:', error.message);
        res.status(500).send({ message: 'Error al obtener el stock', data: undefined });
    }
}

const crear_stock_sucursal_idEmpresa = async function (req, res) {
    const { idLote } = req.body;

    if (!req.user) {
        return res.status(500).send({ message: 'No Access', data: undefined });
    }
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Almacenero') {
        return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    if (idLote) {
        req.params.id = idLote;
        return editar_stock_sucursal(req, res);
    }
    return crearstock_sucursal_idEmpresa(req, res);
}


const crearstock_sucursal_idEmpresa = async function (req, res) {
    const { idSucursal, idProducto, cantidad, costoUnitario } = req.body;
    const idEmpresa = req.user.empresa;
    const cantidadVal = parseFloat(cantidad) || 0;
    const costoVal = parseFloat(costoUnitario) != null && !Number.isNaN(parseFloat(costoUnitario)) ? parseFloat(costoUnitario) : 0;

    try {
        const pool = await sql.connect(dbConfig);
        await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .input('idProducto', sql.UniqueIdentifier, idProducto)
            .input('costoUnitario', sql.Decimal(18, 6), costoVal)
            .input('cantidadIngresada', sql.Decimal(18, 2), cantidadVal)
            .input('cantidadDisponible', sql.Decimal(18, 2), cantidadVal)
            .query(`
                INSERT INTO Lotes (idEmpresa, idSucursal, idProducto, costoUnitario, cantidadIngresada, cantidadDisponible)
                VALUES (@idEmpresa, @idSucursal, @idProducto, @costoUnitario, @cantidadIngresada, @cantidadDisponible)
            `);
        res.status(200).send({ data: 1, message: 'Lote creado correctamente' });
    } catch (error) {
        console.error('crear_stock_sucursal_idEmpresa:', error.message);
        res.status(500).send({ message: 'Error al crear el lote', data: undefined });
    }
}

// const editar_stock_sucursal = async function (req, res) {

//     console.log('editar_stock_sucursal: ');
//     const idProducto = req.params.id;
//     const { idEmpresa, idSucursal, idStockSucursal, cantidad, cantidadAnterior, ubicacion } = req.body;

//     const idUsuario = req.user.sub;

    

//     console.log('cantidadAnterior: ', cantidadAnterior);
//     //quiero sumar la cantidad anterior con la cantidad que se va a editar
//     let cantidadTotal = parseInt(cantidadAnterior) + parseInt(cantidad);

//     //let cantidadTotal = cantidadAnterior + cantidad;

//     console.log('editar_stock_sucursal: ', req.body);
//     console.log('idProducto: ', idProducto);
//     console.log('cantidadTotal: ', cantidadTotal);


//     // if (req.user) {
//     //     if (req.user.rol == 'Administrador') {

//             try {
//                 let pool = await sql.connect(dbConfig);
//                 let stockSucursal = await pool
//                     .request()
//                     .input('idStockSucursal', sql.Int, idStockSucursal)
//                     .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
//                     .input('idSucursal', sql.UniqueIdentifier, idSucursal)
//                     .input('idProducto', sql.UniqueIdentifier, idProducto)
//                     .input('cantidad', sql.Decimal(18,2), cantidadTotal)
//                     .input('ubicacion', sql.VarChar, ubicacion)
//                     .input('idUsuario', sql.UniqueIdentifier, idUsuario)
//                     .query("UPDATE StockSucursal SET idEmpresa = @idEmpresa, idSucursal = @idSucursal, idProducto = @idProducto, cantidad = @cantidad, ubicacion = @ubicacion, fIngreso = GETDATE(), idUsuario = @idUsuario WHERE idStockSucursal = @idStockSucursal");

//                 //res.status(200).send({ data: stockSucursal.rowsAffected });
//                 console.log(' stockSucursal editado: ', stockSucursal.rowsAffected);
//             } catch (error) {
//                 console.log('editar stockSucursal error: ' + error);
//                 res.status(500).send({ message: 'Error al editar la stockSucursal', data: undefined });
//             }

//     //     } else {
//     //         res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
//     //     }
//     // }
//     // else {
//     //     res.status(500).send({ message: 'No Access', data: undefined });
//     // }

// }

const editar_stock_sucursal = async function (req, res) {
    const idLote = req.params.id;
    const { cantidad } = req.body;
    const idEmpresa = req.user?.empresa;

    if (!idLote || (cantidad != null && (Number.isNaN(parseFloat(cantidad)) || parseFloat(cantidad) < 0))) {
        return res.status(400).send({ message: 'ID de lote y cantidad válida son requeridos' });
    }

    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('idLote', sql.UniqueIdentifier, idLote)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('cantidadDisponible', sql.Decimal(18, 2), parseFloat(cantidad))
            .query(`
                UPDATE Lotes SET cantidadDisponible = @cantidadDisponible
                WHERE idLote = @idLote AND idEmpresa = @idEmpresa
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).send({ message: 'Lote no encontrado' });
        }
        res.status(200).send({ success: true });
    } catch (error) {
        console.error('editar_stock_sucursal:', error.message);
        res.status(500).send({ message: 'Error al actualizar el lote', data: undefined });
    }
};

const eliminar_stock_sucursal = async function (req, res) {
    const idEmpresa = req.user?.empresa;
    const idLote = req.params.id;

    if (!req.user) {
        return res.status(500).send({ message: 'No Access', data: undefined });
    }
    if (req.user.rol !== 'Administrador') {
        return res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('idLote', sql.UniqueIdentifier, idLote)
            .query('DELETE FROM Lotes WHERE idEmpresa = @idEmpresa AND idLote = @idLote');
        res.status(200).send({ data: result.rowsAffected[0] });
    } catch (error) {
        console.error('eliminar_stock_sucursal:', error.message);
        res.status(500).send({ message: 'Error al eliminar el lote', data: undefined });
    }
}

module.exports = {
    obtener_sucursal_idempresa,
    obtener_sucursal_todos,
    establecer_sucursal_principal,
    //crear_sucursal_idEmpresa,
    editar_sucursal_idEmpresa,
    eliminar_sucursal_idempresa,
    editar_estado_idsucursal,

    /////////////////////////////////
    
    obtener_stock_sucursal_idProducto,
    obtener_stock_sucursales_idempresa,
    crear_stock_sucursal_idEmpresa,
    //crearstock_sucursal_idEmpresa,
    editar_stock_sucursal,
    eliminar_stock_sucursal

}