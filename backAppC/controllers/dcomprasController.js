const sql = require('mssql');
const dbConfig = require('../dbconfig');
const prodController = require('./productosController');
const preciosVController = require('./preciosVController');

// create table DetalleCompras
// (
// idDetalleCompra int identity(1,1) primary key not null,
// idEmpresa UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
// idSucursal UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Sucursal(idSucursal), -- Nueva columna
// idCompra int not null,
// cantidad decimal(18,3) not null,
// idProducto UNIQUEIDENTIFIER FOREIGN KEY REFERENCES Productos (idProducto),
// idPresentacion int not null,
// pUnitario decimal(18,5),
// total decimal(18,2),
// idUsuario UNIQUEIDENTIFIER FOREIGN KEY REFERENCES UsuarioWeb (idUsuario) not null,
// )

const obtener_detalle_compras_idcompra = async function (req, res) {
    const idCompra = req.params.id;
    console.log('obtener_detalle_compras_idcompra: ', idCompra);
    if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                let pool = await sql.connect(dbConfig);
                let detallecompras = await pool
                    .request()
                    .input('idCompra', sql.UniqueIdentifier, idCompra)
                    //quiero conssultar el detalle de una compra con idcompra trayendo los datos de las columnas relacionadas con inner join idSucursal, idProducto, idPresentacion y idUsuario
                    //.query("SELECT * FROM DetalleCompras INNER JOIN Productos ON DetalleCompras.idProducto = Productos.idProducto WHERE idCompra = @idCompra");

                    .query("SELECT * FROM DetalleCompras  WHERE idCompra = @idCompra");

                    console.log('detallecompras: ', detallecompras.recordset);
                res.status(200).send({ data: detallecompras.recordset });
            } catch (error) {
                console.log('obterner detallecompras error: ' + error);
                res.status(500).send({ message: 'Error al obtener los detallecompras', data: undefined });
            }
        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access', data: undefined });
    }
}

const crear_detalle_compras_idcompra = async function (req, res) {

    const { idSucursal, idCompra, cantidad, idProducto, idPresentacion, pUnitario, total, fechaVencimiento, ubicacion } = req.body;
    console.log('crear_detalle_compras_idcompra: ', req.body);

    const idUsuario = req.user.sub || req.user.idUsuario;
    const idEmpresa = req.user.empresa;

    if (!req.user) {
        return res.status(403).send({ message: 'No Access', data: undefined });
    }
    if (req.user.rol !== 'Administrador' && req.user.rol !== 'Almacenero') {
        return res.status(403).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
    }

    const pUnitarioFormateado = parseFloat(pUnitario) || 0;
    const cantidadVal = parseFloat(cantidad) || 0;
    const totalVal = parseFloat(total) || 0;
    const ubicacionVal = ubicacion || null;
    const fechaVencimientoVal = fechaVencimiento || null;

    try {
        const pool = await sql.connect(dbConfig);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            await transaction.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                .input('idCompra', sql.UniqueIdentifier, idCompra)
                .input('cantidad', sql.Decimal(18, 3), cantidadVal)
                .input('idProducto', sql.UniqueIdentifier, idProducto)
                .input('idPresentacion', sql.Int, idPresentacion)
                .input('pUnitario', sql.Decimal(18, 6), pUnitarioFormateado)
                .input('total', sql.Decimal(18, 2), totalVal)
                .input('idUsuario', sql.UniqueIdentifier, idUsuario)
                .query(`
                    INSERT INTO DetalleCompras (idEmpresa, idSucursal, idCompra, cantidad, idProducto, idPresentacion, pUnitario, total, idUsuario)
                    VALUES (@idEmpresa, @idSucursal, @idCompra, @cantidad, @idProducto, @idPresentacion, @pUnitario, @total, @idUsuario)
                `);

            // Crear nuevo lote por cada línea de compra (según base_datos_mejorada)
            await transaction.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('idProducto', sql.UniqueIdentifier, idProducto)
                .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                .input('costoUnitario', sql.Decimal(18, 6), pUnitarioFormateado)
                .input('cantidadIngresada', sql.Decimal(18, 2), cantidadVal)
                .input('cantidadDisponible', sql.Decimal(18, 2), cantidadVal)
                .input('fechaVencimiento', sql.DateTime, fechaVencimientoVal)
                .query(`
                    INSERT INTO Lotes (idEmpresa, idProducto, idSucursal, costoUnitario, cantidadIngresada, cantidadDisponible, fechaVencimiento)
                    VALUES (@idEmpresa, @idProducto, @idSucursal, @costoUnitario, @cantidadIngresada, @cantidadDisponible, @fechaVencimiento)
                `);

            // Actualizar o insertar StockSucursal (stock agregado por sucursal)
            const existeStock = await transaction.request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                .input('idProducto', sql.UniqueIdentifier, idProducto)
                .query(`
                    SELECT idStockSucursal, cantidad FROM StockSucursal
                    WHERE idEmpresa = @idEmpresa AND idSucursal = @idSucursal AND idProducto = @idProducto
                `);

            if (existeStock.recordset.length > 0) {
                const idStockSucursal = existeStock.recordset[0].idStockSucursal;
                const cantidadAnterior = parseFloat(existeStock.recordset[0].cantidad) || 0;
                await transaction.request()
                    .input('idStockSucursal', sql.Int, idStockSucursal)
                    .input('cantidad', sql.Decimal(18, 2), cantidadAnterior + cantidadVal)
                    .input('ubicacion', sql.VarChar(50), ubicacionVal)
                    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
                    .query(`
                        UPDATE StockSucursal SET cantidad = @cantidad, ubicacion = ISNULL(@ubicacion, ubicacion), fIngreso = GETDATE(), idUsuario = @idUsuario
                        WHERE idStockSucursal = @idStockSucursal
                    `);
            } else {
                await transaction.request()
                    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                    .input('idProducto', sql.UniqueIdentifier, idProducto)
                    .input('cantidad', sql.Decimal(18, 2), cantidadVal)
                    .input('ubicacion', sql.VarChar(50), ubicacionVal)
                    .input('idUsuario', sql.UniqueIdentifier, idUsuario)
                    .query(`
                        INSERT INTO StockSucursal (idEmpresa, idSucursal, idProducto, cantidad, ubicacion, fIngreso, idUsuario)
                        VALUES (@idEmpresa, @idSucursal, @idProducto, @cantidad, @ubicacion, GETDATE(), @idUsuario)
                    `);
            }

            await transaction.commit();
            console.log('DetalleCompra, Lote y StockSucursal creados/actualizados correctamente');
            res.status(200).send({ data: 1, message: 'Detalle de compra registrado. Lote y stock actualizados.' });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (error) {
        console.error('crear_detalle_compras_idcompra error:', error);
        res.status(500).send({ message: 'Error al crear detalle de compra', data: undefined });
    }
}


const crear_detallecompras = async function (detalle) {
    console.log('detalle en crear nuevo_detallecompras: ', detalle);
    try {
        // Formatear pUnitario a dos decimales
        const pUnitarioFormateado = parseFloat(detalle.pUnitario);

        console.log('pUnitarioFormateado en crear_detallecompras: ', pUnitarioFormateado);

        let pool = await sql.connect(dbConfig);
        let detalleCompra = await pool
            .request()
            .input('idEmpresa', sql.UniqueIdentifier, detalle.idEmpresa)
            .input('idSucursal', sql.UniqueIdentifier, detalle.idSucursal)
            .input('idCompra', sql.UniqueIdentifier, detalle.idCompra)
            .input('cantidad', sql.Decimal(18, 3), detalle.cantidad)
            .input('idProducto', sql.UniqueIdentifier, detalle.idProducto)
            .input('idPresentacion', sql.Int, detalle.idPresentacion)
            .input('pUnitario', sql.Decimal(18, 5), pUnitarioFormateado)
            .input('total', sql.Decimal(18, 2), detalle.total)
            .input('idUsuario', sql.UniqueIdentifier, detalle.idUsuario)
            .query("INSERT INTO DetalleCompras (idEmpresa, idSucursal, idCompra, cantidad, idProducto, idPresentacion, pUnitario, total, idUsuario) VALUES (@idEmpresa, @idSucursal, @idCompra, @cantidad, @idProducto, @idPresentacion, @pUnitario, @total, @idUsuario)");

        //res.status(200).send({ data: detalleCompra.rowsAffected });
        console.log('detalleCompra en crear_detallecompras: ', detalleCompra.rowsAffected);

    } catch (error) {
        console.log('crear detallecompras error: ' + error);
        res.status(500).send({ message: 'Error al crear detallecompras', data: undefined });
    }

}

const editar_detalle_compras_idcompra = async (req, res) => {
    console.log('editar_detalle_compras_idcompra reqbody: ', req.body);
    console.log('editar_detalle_compras_idcompra: reqparams', req.params);
    //const {idDetalleCompra, idEmpresa, idSucursal, cantidad, idProducto, idPresentacion, pUnitario, total, idUsuario } = req.body;

    const idCompra = req.params.id;

    if (req.user) {


        let DetalleCompra = [];
        req.body.forEach(element => {
            var detalleCompra = element;
            DetalleCompra.push(detalleCompra);
        });

        console.log('DetalleCompra en editar_detalle_compras_idcompra ', DetalleCompra);


        // productos = DetalleCompra.map(compra => compra.producto);
        //Extracción de productos con campos adicionales
        const productos = DetalleCompra.map(compra => {
            const { idProducto, idEmpresa, idCategoria, idDetalleCompra, idSucursal, idCompra, idMarca, idPresentacion, pUnitario, descripcion, fProduccion, fVencimiento, codigo } = compra;
            return {
                codigo,
                idProducto,
                idEmpresa,
                idCategoria,
                descripcion,
                idMarca,
                idPresentacion,
                pUnitario,
                fProduccion,
                fVencimiento,
                idDetalleCompra,
                idSucursal,
                idCompra,

            };
        });

        console.log('producto en editar_detalle_compras_idcompra: ', productos);

        try {
            for (const detalle of productos) {
                await prodController.actualizar_producto(detalle);
            }

        } catch (error) {
            console.log('error en actualizar_producto: ', error);
        }


        const idUsuario = req.user.sub;
        const idEmpresa = req.user.empresa;

        //quiero extraer del array de objetos DetalleCompra los objetos detalleCompra y luego hacer un update de cada uno de ellos
        const dCompra = DetalleCompra.map(detalleCompra => {
            const { idDetalleCompra, idSucursal, cantidad, idProducto, idPresentacion, pUnitario, total } = detalleCompra;
            return {
                idDetalleCompra,
                idSucursal,
                cantidad,
                idProducto,
                idPresentacion,
                pUnitario,
                total,
                idCompra: req.params.id,
                idEmpresa: req.user.empresa,
                idUsuario: req.user.sub
            };
        });

        console.log('dCompra en editar_detalle_compras_idcompra: ', dCompra);


        if (req.user.rol == 'Administrador') {
            try {

                for (const detalle of dCompra) {
                    if (detalle.idDetalleCompra) {
                        await actualizarDetalleCompra(detalle);
                        // await preciosVController.crearPrecioV(detalle);
                    } else {
                        await crear_detallecompras(detalle);
                    }

                }
                console.log('todos los detalles de compra fueron actualizados');

                res.status(200).send({ data: 1, message: 'Detalle de compra actualizado correctamente' });

            } catch (error) {
                console.log('crear detallecompras error: ' + error);
                res.status(500).send({ message: 'Error al crear detallecompras', data: undefined });
            }
        } else {
            res.status(200).send({ message: 'No tiene permisos para realizar esta acción', data: undefined });
        }
    }
    else {
        res.status(500).send({ message: 'No Access', data: undefined });
    }
}

const actualizarDetalleCompra = async function (detalle) {

    console.log('detalle en actualizarDetalleCompra: ', detalle);
    //const pUnitarioFormateado = parseFloat(detalle.pUnitario);
    //quiero formatear detalle.pUnitario a un decimal con 5 decimales
    const pUnitarioFormateado = parseFloat(detalle.pUnitario);
    console.log('pUnitarioFormateado en actualizarDetalleCompra: ', pUnitarioFormateado);

    try {
        let pool = await sql.connect(dbConfig); // Asegúrate de tener dbConfig definido con tus credenciales de la base de datos
        let result = await pool.request()
            .input('idDetalleCompra', sql.Int, detalle.idDetalleCompra)
            .input('idEmpresa', sql.UniqueIdentifier, detalle.idEmpresa)
            .input('idSucursal', sql.UniqueIdentifier, detalle.idSucursal)
            .input('idCompra', sql.UniqueIdentifier, detalle.idCompra)
            .input('cantidad', sql.Decimal(18, 3), detalle.cantidad)
            .input('idProducto', sql.UniqueIdentifier, detalle.idProducto)
            .input('idPresentacion', sql.Int, detalle.idPresentacion)
            .input('pUnitario', sql.Decimal(18, 5), pUnitarioFormateado)
            .input('total', sql.Decimal(18, 2), detalle.total)
            .query('UPDATE DetalleCompras SET idSucursal = @idSucursal, cantidad = @cantidad, idProducto = @idProducto, idPresentacion = @idPresentacion, pUnitario = @pUnitario, total = @total WHERE idDetalleCompra = @idDetalleCompra and idCompra = @idCompra');
        console.log(result);
    } catch (error) {
        console.error('Error al actualizar el detalle de compra:', error);
    }
}

const eliminar_detalle_compras_idcompra = async function (req, res) {
    const idCompra = req.params.id;
    console.log('eliminar_detalle_compras_idcompra: ', idCompra);
    if (req.user) {
        if (req.user.rol == 'Administrador') {
            try {
                let pool = await sql.connect(dbConfig);
                let detallecompras = await pool
                    .request()
                    .input('idCompra', sql.UniqueIdentifier, idCompra)
                    .query("DELETE FROM DetalleCompras WHERE idCompra = @idCompra");

                res.status(200).send({ data: detallecompras.rowsAffected });

            } catch (error) {
                console.log('eliminar detallecompras error: ' + error);
                res.status(500).send({ message: 'Error al eliminar detallecompras', data: undefined });
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
    obtener_detalle_compras_idcompra,
    crear_detalle_compras_idcompra,
    editar_detalle_compras_idcompra

}