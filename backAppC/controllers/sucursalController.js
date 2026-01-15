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
    if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                let pool = await sql.connect(dbConfig);
                let sucursal = await pool.request().query("SELECT * FROM Sucursal");
                res.status(200).send({ data: sucursal.recordset });
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
    const { idProducto } = req.params.id;
    const idSucursal = req.body.idSucursal;

    if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                let pool = await sql.connect(dbConfig);
                let stockSucursal = await pool
                    .request()
                    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                    .input('idProducto', sql.UniqueIdentifier, idProducto)
                    //quiero consultar el stock de un producto en una sucursal uniendo las tablas stockSucursal y productos con inner join
                    .query("SELECT * FROM StockSucursal inner join Productos on StockSucursal.idProducto = Productos.idProducto WHERE idSucursal = @idSucursal and idProducto = @idProducto");
                res.status(200).send({ data: stockSucursal.recordset });



            } catch (error) {
                console.log('obterner stockSucursal error: ' + error);
                res.status(500).send({ message: 'Error al obtener los stockSucursal', data: undefined });
            }
        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access', data: undefined });
    }

}

const obtener_stock_sucursales_idempresa = async function (req, res) {
    const idEmpresa = req.user.empresa;

    if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                let pool = await sql.connect(dbConfig);
                let stockSucursal = await pool
                    .request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .query("SELECT * FROM StockSucursal WHERE idEmpresa = @idEmpresa");
                //quiero consultar todas las stockSucursales de una empresa uniendo las tablas Sucursales con inner join y productos con inner join
                //.query("SELECT * FROM StockSucursal inner join Sucursal on StockSucursal.idSucursal = Sucursal.idSucursal inner join Productos on StockSucursal.idProducto = Productos.idProducto WHERE StockSucursal.idEmpresa = @idEmpresa");



                res.status(200).send({ data: stockSucursal.recordset });
            } catch (error) {
                console.log('obterner stockSucursal error: ' + error);
                res.status(500).send({ message: 'Error al obtener los stockSucursal', data: undefined });
            }
        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access', data: undefined });
    }

}

const crear_stock_sucursal_idEmpresa = async function (req, res) {
    console.log('crear_stock_sucursal_idEmpresa: ', req.body);
    const { idStockSucursal } = req.body;
    const idEmpresa = req.user.empresa;
    const idUsuario = req.user.sub;

    if(req.user){
        if(req.user.rol == 'Administrador' || req.user.rol == 'Almacenero'){
            if(idStockSucursal){
                await editar_stock_sucursal(req, res);
                
            }else{
                await crearstock_sucursal_idEmpresa(req, res);
            }
        }else{
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else{
        res.status(500).send({ message: 'No Access', data: undefined });
    }
}


const crearstock_sucursal_idEmpresa = async function (req, res) {

    const { idSucursal, idProducto, cantidad, ubicacion } = req.body;
    const idEmpresa = req.user.empresa;
    const idUsuario = req.user.sub;

    console.log('crear_stock_sucursal_idEmpresa: ', req.body);

    // if (req.user) {
    //     if (req.user.rol == 'Administrador') {
            try {
                let pool = await sql.connect(dbConfig);
                let stockSucursal = await pool
                    .request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                    .input('idProducto', sql.UniqueIdentifier, idProducto)
                    .input('cantidad', sql.Decimal(18,2), cantidad)
                    .input('ubicacion', sql.VarChar, ubicacion)
                    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
                    .query("INSERT INTO StockSucursal ( idEmpresa, idSucursal, idProducto, cantidad, ubicacion, fIngreso, idUsuario) VALUES ( @idEmpresa, @idSucursal, @idProducto, @cantidad, @ubicacion, GETDATE(), @idUsuario)");

               // res.status(200).send({ data: stockSucursal.rowsAffected });
            } catch (error) {
                console.log('crear stockSucursal error: ' + error);
                res.status(500).send({ message: 'Error al crear la stockSucursal', data: undefined });
            }
    //     } else {
    //         res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    //     }
    // }
    // else {
    //     res.status(500).send({ message: 'No Access', data: undefined });
    // }

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
    const idProducto = req.params.id;
    const { idEmpresa, idSucursal, idStockSucursal, cantidad, cantidadAnterior, ubicacion } = req.body;
    const idUsuario = req.user.sub;
    console.log('editar_stock_sucursal: ', req.body);
    // Validaciones
    if (!idProducto) {
        return res.status(400).send({ message: 'ID de producto es requerido' });
    }

    console.log('Datos recibidos:', {
        idProducto,
        ...req.body
    });

    try {
        let cantidadTotal = parseInt(cantidadAnterior) + parseInt(cantidad);
        
        let pool = await sql.connect(dbConfig);
        let result = await pool
            .request()
            .input('idProducto', sql.UniqueIdentifier, idProducto)
            .input('idStockSucursal', sql.Int, idStockSucursal)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            //.input('idProducto', sql.UniqueIdentifier, idProducto) // Quizás no necesitas actualizar este campo
            .input('cantidad', sql.Decimal(18,2), cantidadTotal)
            .input('ubicacion', sql.VarChar, ubicacion)
            .input('idUsuario', sql.UniqueIdentifier, idUsuario)
            .query(`
                UPDATE StockSucursal 
                SET 
                    idEmpresa = @idEmpresa, 
                    idSucursal = @idSucursal, 
                    cantidad = @cantidad, 
                    ubicacion = @ubicacion, 
                    fIngreso = GETDATE(), 
                    idUsuario = @idUsuario 
                WHERE idStockSucursal = @idStockSucursal
                AND idProducto = @idProducto
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).send({ message: 'Registro no encontrado' });
        }

        res.status(200).send({ success: true });
    } catch (error) {
        console.error('Error completo:', error);
        res.status(500).send({ 
            message: 'Error al actualizar el stock',
            error: error.message 
        });
    }
};

const eliminar_stock_sucursal = async function (req, res) {
    const idEmpresa = req.user.empresa;
    const idStockSucursal = req.params.id;


    if (req.user) {
        if (req.user.rol == 'Administrador') {

            try {
                let pool = await sql.connect(dbConfig);
                let stockSucursal = await pool
                    .request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .input('idStockSucursal', sql.Int, idStockSucursal)
                    .query("DELETE FROM StockSucursal WHERE idEmpresa = @idEmpresa and idStockSucursal = @idStockSucursal");

                res.status(200).send({ data: stockSucursal.rowsAffected });
            } catch (error) {
                console.log('eliminar stockSucursal error: ' + error);
                res.status(500).send({ message: 'Error al eliminar la stockSucursal', data: undefined });
            }

        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access', data: undefined });
    }
}

module.exports = {
    obtener_sucursal_idempresa,
    obtener_sucursal_todos,
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