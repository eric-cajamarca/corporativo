const sql = require('mssql');
const dbConfig = require('../dbconfig');

// CREATE TABLE [dbo].[Ventas](
//     [idVenta] [int] IDENTITY(1,1) NOT NULL,
//     [idEmpresa] [UNIQUEIDENTIFIER] NOT NULL,
//     [idSucursal] [UNIQUEIDENTIFIER] NOT NULL,
//     [serie] [varchar](4) NOT NULL,
//     [numero] [varchar](8) NOT NULL,
// 	[compVenta][varchar](13) not null,
//     [idComprobante] [int] NOT NULL, -- '01':Factura, '03':Boleta, etc.
//     [fEmision] [datetime] NOT NULL,
// 	[fVencimiento] [datetime] NOT NULL,
//     [idCliente] [int] NOT NULL,
//     [idMoneda] [int] NOT NULL,
//     [tCambio] [decimal](10,4) NOT NULL,
// 	[subtotal] [decimal](18,2) NOT NULL,
//     [igv] [decimal](18,2) NOT NULL,
// 	[exonerado][decimal](18,2) NOT NULL,
// 	[gratuito][decimal](18,2) NOT NULL,
// 	[otrosCargos][decimal](18,2) NOT NULL,
// 	[descuentos][decimal](18,2) NOT NULL,
//     [total] [decimal](18,2) NOT NULL,
//     [idMediosPago] [varchar](20) NOT NULL, -- 'PENDIENTE', 'PAGADO', 'ANULADO'
// 	[idEstadoSunat][int]not null,
// 	[compRelacionado][varchar](30) NULL,
//     [idUsuario] [UNIQUEIDENTIFIER] NOT NULL,
//     [fechaAnulacion] [datetime] NOT NULL DEFAULT GETDATE(),
//     [idUsuarioAnulacion] [int] NULL,
//     [motivo_anulacion] [varchar](255) NULL,
//     CONSTRAINT [PK_Ventas] PRIMARY KEY CLUSTERED([idVenta] ASC),
//     CONSTRAINT [FK_Ventas_Empresas] FOREIGN KEY ([idempresa]) 
//         REFERENCES [dbo].[Empresas] ([idEmpresa]),
//     CONSTRAINT [FK_Ventas_Sucursal] FOREIGN KEY ([idSucursal]) 
//         REFERENCES [dbo].[Sucursal] ([idSucursal]),
//     CONSTRAINT [FK_Ventas_Clientes] FOREIGN KEY ([idCliente]) 
//         REFERENCES [dbo].[Clientes] ([idCliente]),
// 	CONSTRAINT [FK_Ventas_Usuario] FOREIGN KEY ([idUsuario])
// 		REFERENCES [dbo].[usuarioweb]([idUsuario]),
//     CONSTRAINT [UQ_Ventas_SerieNumero] UNIQUE ([idEmpresa], [serie], [numero]),
	
// ) ON [PRIMARY]

const crearVenta = async function (req, res) {
    const {
        idEmpresa,
        idSucursal,
        serie,
        numero,
        compVenta,
        idComprobante,
        fEmision,
        fVencimiento,
        idCliente,
        idMoneda,
        tCambio,
        subtotal,
        igv,
        exonerado,
        gratuito,
        otrosCargos,
        descuentos,
        total,
        idMediosPago,
        idEstadoSunat,
        compRelacionado,
        idUsuario
    } = req.body;
    if (req.user) {
        try {
            let pool = await sql.connect(dbConfig);
            let result = await pool
                .request()
                .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
                .input('idSucursal', sql.UniqueIdentifier, idSucursal)
                .input('serie', sql.VarChar(4), serie)
                .input('numero', sql.VarChar(8), numero)
                .input('compVenta', sql.VarChar(13), compVenta)
                .input('idComprobante', sql.Int, idComprobante)
                .input('fEmision', sql.DateTime, fEmision)
                .input('fVencimiento', sql.DateTime, fVencimiento)
                .input('idCliente', sql.Int, idCliente)
                .input('idMoneda', sql.Int, idMoneda)
                .input('tCambio', sql.Decimal(10, 4), tCambio)
                .input('subtotal', sql.Decimal(18, 2), subtotal)
                .input('igv', sql.Decimal(18, 2), igv)
                .input('exonerado', sql.Decimal(18, 2), exonerado)
                .input('gratuito', sql.Decimal(18, 2), gratuito)
                .input('otrosCargos', sql.Decimal(18, 2), otrosCargos)
                .input('descuentos', sql.Decimal(18, 2), descuentos)
                .input('total', sql.Decimal(18, 2), total)
                .input('idMediosPago', sql.VarChar(20), idMediosPago)
                .input('idEstadoSunat', sql.Int, idEstadoSunat)
                .input('compRelacionado', sql.VarChar(30), compRelacionado)
                .input('idUsuario', sql.UniqueIdentifier, idUsuario)
                .query(`INSERT INTO Ventas 
                (idEmpresa, idSucursal, serie, numero, compVenta, idComprobante, fEmision, fVencimiento, idCliente, idMoneda, tCambio, subtotal, igv, exonerado, gratuito, otrosCargos, descuentos, total, idMediosPago, idEstadoSunat, compRelacionado, idUsuario) 
                VALUES 
                (@idEmpresa, @idSucursal, @serie, @numero, @compVenta, @idComprobante, @fEmision, @fVencimiento, @idCliente, @idMoneda, @tCambio, @subtotal, @igv, @exonerado, @gratuito, @otrosCargos, @descuentos, @total, @idMediosPago, @idEstadoSunat, @compRelacionado, @idUsuario)`);
            res.status(201).json({ message: 'Venta creada correctamente' });
        } catch (error) {
            console.error('Error al crear la venta:', error);
            res.status(500).send('Error al crear la venta');
        }
    } else {
        res.status(500).send({ message: 'No Access' });
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

// CREATE TABLE [dbo].[DetalleVenta](
//     [idDetalle] [int] IDENTITY(1,1) NOT NULL,
//     [idVenta] [int] NOT NULL,
//     [idProducto] [UNIQUEIDENTIFIER] NOT NULL,
//     [cantidad] [decimal](18,3) NOT NULL,
//     [pVenta] [decimal](18,5) NOT NULL,
//     [descuento] [decimal](18,2) NULL DEFAULT 0,
//     [subtotal] [decimal](18,2) NOT NULL,
// 	[igv] [bit] NOT NULL DEFAULT 0,
// 	[isc] [bit] NOT NULL DEFAULT 0,
//     [total] [decimal](18,2) NOT NULL,
// 	[hVenta][datetime]  not null DEFAULT getdate(),
// 	[cantEntregada][decimal](18,3) NOT NULL,
// 	[cantPendiente]  AS (cantidad - cantEntregada) PERSISTED,
// 	[fUltEntrega] [datetime2] NULL, -- última fecha que se entregó
// 	[idEstadoPedido] [int] NOT NULL
	   
//     CONSTRAINT [PK_DetalleVenta] PRIMARY KEY CLUSTERED ([idDetalle] ASC),
//     CONSTRAINT [FK_DetalleVenta_Ventas] FOREIGN KEY ([idVenta]) 
//         REFERENCES [dbo].[Ventas] ([idVenta]),
//     CONSTRAINT [FK_DetalleVenta_Productos] FOREIGN KEY ([idProducto]) 
//         REFERENCES [dbo].[Productos] ([idProducto]),
// 	CONSTRAINT [FK_DetalleVenta_EstadoPedido] FOREIGN KEY ([idEstadoPedido]) 
//         REFERENCES [dbo].[EstadosPedidos] ([idEstadoPedido])

// ) ON [PRIMARY]

const crearDetalleVenta = async function (req, res) {
  const {
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
        let result = await pool
          .request()
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
        res.status(201).json({ message: 'Detalle de venta creado correctamente' });
        } catch (error) {
        console.error('Error al crear el detalle de venta:', error);
        res.status(500).send('Error al crear el detalle de venta');
        }
    } else {
        res.status(500).send({ message: 'No Access' });
    }
};

//quiero crear detalle de venta y actualizar stock al mismo tiempo utilizando el procedimiento almacenado
// CREATE OR ALTER PROC dbo.sp_DescontarStock
//     @idEmpresa  UNIQUEIDENTIFIER,
//     @idSucursal UNIQUEIDENTIFIER,
//     @idProducto UNIQUEIDENTIFIER,
//     @cantidad   DECIMAL(18,2)
// AS
// BEGIN
//     SET NOCOUNT ON;

//     UPDATE dbo.StockSucursal
//     SET    cantidad = cantidad - @cantidad
//     OUTPUT DELETED.cantidad AS stockAntes, INSERTED.cantidad AS stockDespues
//     WHERE  idEmpresa  = @idEmpresa
//       AND  idSucursal = @idSucursal
//       AND  idProducto = @idProducto
//       AND  cantidad  >= @cantidad;          -- evita negativos

//     IF @@ROWCOUNT = 0
//         THROW 51000, 'Stock insuficiente o producto no existe', 1;
// END

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





