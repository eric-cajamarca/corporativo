const sql = require('mssql');
const ventasService = require('../services/ventas.service');
const detalleVentaService = require('../services/detalle-ventas.service');
const stockService = require('../services/stock.service');
const dbConfig = require('../dbconfig');



const crearVenta = async function (req, res) {
    const datosVenta = req.body;
    const idUsuario = req.sub;
  
  if (!req.user) {
    return res.status(401).send({ message: 'No Access' });
  }

  const pool = await sql.connect();
  
  try {
    //Inicia transacción (CONTROLADOR = ORQUESTADOR)
    await pool.request().query('BEGIN TRANSACTION');

    //Llama al SERVICIO (solo lógica de negocio)
    await ventasService.crearVenta(pool, datosVenta, req.user.empresa, idUsuario);
    
    //Commit (si todo OK)
    await pool.request().query('COMMIT');
    res.status(201).json({ message: 'Venta creada correctamente' });

  } catch (error) {
    // Rollback automático (si ALGÚN servicio falla)
    await pool.request().query('ROLLBACK');
    console.error('Error al crear la venta:', error);
    res.status(500).send('Error al crear la venta');
  }
};

const obtenerVentaPorId = async function (req, res) {
  const Serie_Numero = req.params.id;
  const idempresa = req.user.empresa;
    console.log('idempresa :', idempresa);

    if (!Serie_Numero) {
    return res.status(400).send('Falta el parámetro Serie_Numero');
  }
    console.log('Serie_numero :', Serie_Numero);
    console.log('idempresa :', idempresa);
    if(req.user) {
    try {
      let pool = await sql.connect(dbConfig);
        let result = await pool
        .request()
        .input('Serie_Numero', sql.Char, Serie_Numero)
        .input('idempresa', sql.UniqueIdentifier, idempresa)
        .query('SELECT * FROM Ventas WHERE Serie_Numero = @Serie_Numero and idEmpresa=@idempresa');
        res.json(result.recordset);
    } catch (error) {
      console.error('Error al obtener la venta:', error);
      res.status(500).send('Error al obtener la venta por id');
    }
    }else {
      res.status(500).send({ message: 'No Access' });
    }
};

const obtenerVentas = async function (req, res) {
  const idempresa = req.user.empresa;
    console.log('idempresa :', idempresa);  
    if(req.user) {
        try {
        let pool = await sql.connect(dbConfig);
            let result = await pool
            .request()
            .input('idempresa', sql.UniqueIdentifier, idempresa)
            .query('SELECT * FROM Ventas WHERE idEmpresa=@idempresa');
            res.json(result.recordset);
        } catch (error) {
        console.error('Error al obtener las ventas:', error);
        res.status(500).send('Error al obtener las ventas');
        }
    }else {
      res.status(500).send({ message: 'No Access' });
    }
};

//en actualizar venta solo actualizare el estadoPEdido y estado sunat
const actualizarVenta = async function (req, res) {
  const { Serie_Numero, EstadoPedido, EstadoSunat } = req.body;
  // const Serie_Numero = req.params.id;
    console.log('estado pedido', EstadoPedido);
    console.log('estado sunat', EstadoSunat);
    if(req.user) {
        try {
        let pool = await sql.connect(dbConfig);
            let result = await pool
            .request()
            .input('Serie_Numero', sql.VarChar, Serie_Numero)
            .input('EstadoPedido', sql.VarChar, EstadoPedido)
            .input('EStadoSunat', sql.VarChar, EstadoSunat)
            // ... completar con otras entradas
            .query('UPDATE Ventas SET EstadoPedido = @EstadoPedido, EstadoSunat = @EstadoSunat WHERE Serie_Numero = Serie_Numero');
            res.status(200).json({ message: 'Registro actualizado correctamente' });
        } catch (error) {
        console.error('Error al actualizar el detalle de venta:', error);
        res.status(500).send('Error al actualizar el detalle de venta');
        }
    }else {
      res.status(500).send({ message: 'No Access' });
    }
};



// const crearDetalleVenta = async function (req, res) {
//   const {
//     idVenta,
//     idProducto,
//     cantidad,
//     pVenta,
//     descuento,
//     subtotal,
//     igv,
//     isc,
//     total,
//     hVenta,
//     cantEntregada,
//     idEstadoPedido
//   } = req.body;
//     if (req.user) {
//      try {
//         let pool = await sql.connect(dbConfig);
//         let result = await pool
//           .request()
//           .input('idVenta', sql.Int, idVenta)
//             .input('idProducto', sql.UniqueIdentifier, idProducto)
//             .input('cantidad', sql.Decimal(18, 3), cantidad)
//             .input('pVenta', sql.Decimal(18, 5), pVenta)
//             .input('descuento', sql.Decimal(18, 2), descuento)
//             .input('subtotal', sql.Decimal(18, 2), subtotal)
//             .input('igv', sql.Bit, igv)
//             .input('isc', sql.Bit, isc)
//             .input('total', sql.Decimal(18, 2), total)
//             .input('hVenta', sql.DateTime, hVenta)
//             .input('cantEntregada', sql.Decimal(18, 3), cantEntregada)
//             .input('idEstadoPedido', sql.Int, idEstadoPedido)
//           .query(`INSERT INTO DetalleVenta 
//           (idVenta, idProducto, cantidad, pVenta, descuento, subtotal, igv, isc, total, hVenta, cantEntregada, idEstadoPedido)
//             VALUES
//             (@idVenta, @idProducto, @cantidad, @pVenta, @descuento, @subtotal, @igv, @isc, @total, @hVenta, @cantEntregada, @idEstadoPedido)`); 
//         res.status(201).json({ message: 'Detalle de venta creado correctamente' });
//         } catch (error) {
//         console.error('Error al crear el detalle de venta:', error);
//         res.status(500).send('Error al crear el detalle de venta');
//         }
//     } else {
//         res.status(500).send({ message: 'No Access' });
//     }
// };

// controllers/ventas.controller.js



const crearVentaCompleta = async (req, res) => {
  const { venta, detalles } = req.body; // venta = {}, detalles = []
  const pool = await sql.connect();

  try {
    await pool.request().query('BEGIN TRANSACTION');
    
    // ✅ Servicio 1: Crea venta
    const ventaResult = await ventasService.crearVenta(pool, venta, req.user.empresa);
    const idVenta = ventaResult.recordset[0].idVenta;

    // ✅ Servicio 2: Crea múltiples detalles
    for (const det of detalles) {
      await detalleVentaService.crearDetalle(pool, { ...det, idVenta }, req.user.empresa);
    }
    
    await pool.request().query('COMMIT');
    res.json({ success: true, idVenta });

  } catch (error) {
    await pool.request().query('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
};

const crearDetalleVenta_DescontarStock = async function (req, res) {
    const {
        idEmpresa,
        idSucursal,
        idVenta,
        idProducto,
        cantidad,
        pVenta,
        descuento,
        subtotal,
        igv,
        isc,
        total,
        hVenta,
        cantEntregada,
        idEstadoPedido
    } = req.body;
    if (req.user) {
        try {
            let pool = await sql.connect(dbConfig);
            let transaction = new sql.Transaction(pool);
            await transaction.begin();
            let request = new sql.Request(transaction);

            // Primero, descontar el stock
            await request
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                .input('idProducto', sql.UniqueIdentifier, idProducto)
                .input('cantidad', sql.Decimal(18, 2), cantidad)
                .execute('sp_DescontarStock');
            // Luego, crear el detalle de venta
            await request
                .input('idVenta', sql.Int, idVenta)
                .input('idProducto', sql.UniqueIdentifier, idProducto)
                .input('cantidad', sql.Decimal(18, 3), cantidad)
                .input('pVenta', sql.Decimal(18, 5), pVenta)
                .input('descuento', sql.Decimal(18, 2), descuento)
                .input('subtotal', sql.Decimal(18, 2), subtotal)
                .input('igv', sql.Bit, igv)
                .input('isc', sql.Bit, isc)
                .input('total', sql.Decimal(18, 2), total)
                .input('hVenta', sql.DateTime, hVenta)
                .input('cantEntregada', sql.Decimal(18, 3), cantEntregada)
                .input('idEstadoPedido', sql.Int, idEstadoPedido)
                .query(`INSERT INTO DetalleVenta 
                (idVenta, idProducto, cantidad, pVenta, descuento, subtotal, igv, isc, total, hVenta, cantEntregada, idEstadoPedido)
                VALUES
                (@idVenta, @idProducto, @cantidad, @pVenta, @descuento, @subtotal, @igv, @isc, @total, @hVenta, @cantEntregada, @idEstadoPedido)`);
            await transaction.commit();
            res.status(201).json({ message: 'Detalle de venta creado y stock descontado correctamente' });
        } catch (error) {
            console.error('Error al crear el detalle de venta y descontar stock:', error);
            res.status(500).send('Error al crear el detalle de venta y descontar stock');
        }
    } else {
        res.status(500).send({ message: 'No Access' });
    }
};


// para actualizar DetalleVentas quiero modificar la cantidad entregada, cantPendiente, fUltEntrega y EstadoPedido
const actualizarDetalleVenta = async function (req, res) {
  const { id, CantEntregado, FUltEntrega, EstadoPedido } = req.body;
  // const id = req.params.id;
    console.log('CantEntregado', CantEntregado);
    console.log('FUltEntrega', FUltEntrega);
    console.log('EstadoPedido', EstadoPedido);
    if(req.user) {
        try {
        let pool = await sql.connect(dbConfig);
            let result = await pool
            .request()
            .input('id', sql.Int, id)
            .input('CantEntregado', sql.Decimal, CantEntregado)
            .input('FUltEntrega', sql.DateTime2, FUltEntrega)
            .input('EstadoPedido', sql.Int, EstadoPedido)
            .query('UPDATE DetalleVentas SET CantEntregado = @CantEntregado, FUltEntrega = @FUltEntrega, idEstadoPedido = @EstadoPedido WHERE Id = @id');
            res.status(200).json({ message: 'Registro actualizado correctamente' });
        } catch (error) {
        console.error('Error al actualizar el detalle de venta:', error);
        res.status(500).send('Error al actualizar el detalle de venta');
        }
    }else {
      res.status(500).send({ message: 'No Access' });
    }
};

const obtenerDetalleVenta_idVenta = async function (req, res) {
    const idVenta = req.params.id;
    if(req.user) {
        try {
        let pool = await sql.connect(dbConfig);
            let result = await pool
            .request()
            .input('idVenta', sql.Int, idVenta)
            .query('SELECT * FROM DetalleVenta WHERE idVenta = @idVenta');
            res.json(result.recordset);
        } catch (error) {
        console.error('Error al obtener el detalle de venta:', error);
        res.status(500).send('Error al obtener el detalle de venta por idVenta');
        }
    }else {
      res.status(500).send({ message: 'No Access' });
    }
};

const obtenerVenta_idDetalle = async function (req, res) {
    const idDetalle = req.params.id;
    if(req.user) {
        try {
        let pool = await sql.connect(dbConfig);
            let result = await pool
            .request()
            .input('idDetalle', sql.Int, idDetalle)
            .query('SELECT v.* FROM Ventas v JOIN DetalleVenta dv ON v.idVenta = dv.idVenta WHERE dv.idDetalle = @idDetalle');
            res.json(result.recordset);
        } catch (error) {
        console.error('Error al obtener la venta por idDetalle:', error);
        res.status(500).send('Error al obtener la venta por idDetalle');
        }
    }else {
      res.status(500).send({ message: 'No Access' });
    }
};

// para eliminar una venta primero debo eliminar su detalle de venta asociado
// pero tengo que llamar a este procedimiento almacenado
// --sp_RestaurarStock – lo llamas cuando anules la venta.
// CREATE OR ALTER PROC dbo.sp_RestaurarStock
//     @idEmpresa  UNIQUEIDENTIFIER,
//     @idSucursal UNIQUEIDENTIFIER,
//     @idProducto UNIQUEIDENTIFIER,
//     @cantidad   DECIMAL(18,2)
// AS
// BEGIN
//     SET NOCOUNT ON;

//     UPDATE dbo.StockSucursal
//     SET    cantidad = cantidad + @cantidad
//     OUTPUT DELETED.cantidad AS stockAntes, INSERTED.cantidad AS stockDespues
//     WHERE  idEmpresa  = @idEmpresa
//       AND  idSucursal = @idSucursal
//       AND  idProducto = @idProducto;

//     IF @@ROWCOUNT = 0  -- si no existe el registro, lo creas (opcional)
//     BEGIN
//         INSERT dbo.StockSucursal(idEmpresa, idSucursal, idProducto, cantidad, idUsuario)
//         VALUES (@idEmpresa, @idSucursal, @idProducto, @cantidad, @idUsuario);  -- envía también el idUsuario
//     END
// END
// GO

const eliminarDetalleVenta = async function (req, res) {
    const idDetalle = req.params.id;
    const { idEmpresa, idSucursal, idProducto, cantidad } = req.body;
    if(req.user) {
        try {
        let pool = await sql.connect(dbConfig);
            let result = await pool
            .request()
            .input('idDetalle', sql.Int, idDetalle)
            .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
            .input('idSucursal', sql.UniqueIdentifier, idSucursal)
            .input('idProducto', sql.UniqueIdentifier, idProducto)
            .input('cantidad', sql.Decimal(18,2), cantidad)
            // primero restauras el stock
            .execute('sp_RestaurarStock')
            // luego eliminas el detalle de venta
            .query('DELETE FROM DetalleVenta WHERE idDetalle = @idDetalle');
            res.status(200).json({ message: 'Detalle de venta eliminado correctamente' });
        }catch (error) {
        console.error('Error al eliminar el detalle de venta:', error);
        res.status(500).send('Error al eliminar el detalle de venta');
        }
    }else {
      res.status(500).send({ message: 'No Access' });
    }
};



module.exports = {
    crearVenta,
    obtenerVentaPorId,
    obtenerVentas,
    actualizarVenta,
    //detalle venta
    crearDetalleVenta,
    crearDetalleVenta_DescontarStock,
    actualizarDetalleVenta,
    obtenerDetalleVenta_idVenta,
    obtenerVenta_idDetalle,
    eliminarDetalleVenta
    
}





