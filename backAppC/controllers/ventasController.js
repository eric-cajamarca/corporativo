const path = require('path');
const fs = require('fs');
const sql = require('mssql');
const ventasService = require('../services/ventas.service');
const detalleVentaService = require('../services/detalle-ventas.service');
const stockService = require('../services/stock.service');
const ventasRepository = require('../repositories/ventas.repository');
const facturacionRepository = require('../repositories/facturacion.repository');
const dbConfig = require('../dbconfig');
const { nombreArchivoComprobante, getRutaFirmaFacturador, getRutaRptaFacturador } = require('../utils/facturadorSunat.util');
const { getNowLocal, getNowLocalSQLString, getFechaEmisionSQLString, getFechaSoloSQLString } = require('../utils/fechaHoraLocal.util');

/** Fecha de emisión en formato SQL local (YYYY-MM-DD HH:mm:ss.sss) para guardar sin conversión UTC.
 *  Devuelve string para que el driver mssql no convierta el Date a UTC al insertar. */
function fechaEmisionConHoraActual(fEmision) {
  if (!fEmision) return getNowLocalSQLString();
  const str = typeof fEmision === 'string' ? fEmision.trim() : (fEmision instanceof Date ? fEmision.toISOString().slice(0, 19).replace('T', ' ') : '');
  const parteFecha = str.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parteFecha)) return getNowLocalSQLString();
  return getFechaEmisionSQLString(parteFecha);
}

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
  if (!req.user || !idempresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    let list = await ventasRepository.listarPorEmpresa(pool, idempresa);
    const config = await facturacionRepository.obtenerConfiguracionFacturacionRepo(pool, idempresa);
    const rutaFacturador = config && config.rutaCarpetaFacturadorSunat ? String(config.rutaCarpetaFacturadorSunat).trim() : null;
    if (rutaFacturador) {
      const rutaFirma = getRutaFirmaFacturador(rutaFacturador);
      const rutaRpta = getRutaRptaFacturador(rutaFacturador);
      list = list.map((r) => {
        let tieneXml = false;
        let tieneCdr = false;
        if (r.idComprobanteElectronico && r.rucEmpresa && r.tipoComprobante != null) {
          const nombreArchivo = nombreArchivoComprobante({
            ruc: r.rucEmpresa,
            tipoComprobante: r.tipoComprobante,
            serie: r.serie,
            numero: r.numero
          });
          const base = nombreArchivo.replace(/\.json$/i, '');
          if (rutaFirma) {
            const xmlPath = path.join(rutaFirma, base + '.xml');
            try { tieneXml = fs.existsSync(xmlPath); } catch (_) {}
          }
          if (rutaRpta) {
            const zipPath = path.join(rutaRpta, 'R' + base + '.zip');
            try { tieneCdr = fs.existsSync(zipPath); } catch (_) {}
          }
        }
        return { ...r, tieneXml, tieneCdr };
      });
    } else {
      list = list.map((r) => ({ ...r, tieneXml: false, tieneCdr: false }));
    }
    res.json({ data: list });
  } catch (error) {
    console.error('Error al obtener las ventas:', error);
    res.status(500).json({ error: 'Error al obtener las ventas' });
  }
};

const obtenerComprobanteParaPdf = async function (req, res) {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  const idVentaRaw = req.params.idVenta;
  if (!idVentaRaw) {
    return res.status(400).json({ error: 'idVenta es requerido' });
  }
  const idVenta = parseInt(idVentaRaw, 10);
  if (Number.isNaN(idVenta) || idVenta < 1) {
    return res.status(400).json({ error: 'idVenta debe ser un número válido' });
  }
  try {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const pool = await sql.connect(dbConfig);
    const data = await ventasRepository.obtenerComprobanteParaPdf(pool, idVenta, idEmpresa, baseUrl);
    if (!data) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    res.json({ data });
  } catch (error) {
    console.error('Error al obtener comprobante para PDF:', error);
    const message = process.env.NODE_ENV !== 'production' && error?.message
      ? error.message
      : 'Error al obtener datos del comprobante';
    res.status(500).json({ error: message });
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
  const { venta, detalles, detallePago, idApertura } = req.body; // detallePago = [{ idMediosPago, monto }], opcional
  const pool = await sql.connect(dbConfig);
  const CajaRepository = require('../repositories/caja.repository');
  const ventasRepository = require('../repositories/ventas.repository');
  const CreditosService = require('../services/creditos.service');

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    let idSucursalStock = venta.idSucursal || null;
    if (!idSucursalStock) {
      const rsSuc = await transaction.request()
        .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)
        .query('SELECT TOP 1 idSucursal FROM Sucursal WHERE idEmpresa = @idEmpresa');
      idSucursalStock = rsSuc.recordset?.[0]?.idSucursal || null;
    }

    const fechaEmisionConHora = fechaEmisionConHoraActual(venta.fEmision);
    const fVencimientoSQL = getFechaSoloSQLString(venta.fVencimiento) || fechaEmisionConHora;
    const ventaConHora = { ...venta, fEmision: fechaEmisionConHora, fVencimiento: fVencimientoSQL };
    const idEstadoPago = venta.idEstadoPago != null ? parseInt(venta.idEstadoPago, 10) : 1;
    if (idEstadoPago === 1) {
      const medPago = ventaConHora.idMediosPago != null && String(ventaConHora.idMediosPago).trim() !== '';
      if (!medPago) {
        const rMp = await transaction.request().query('SELECT TOP 1 idMediosPago FROM MediosPago');
        const firstId = rMp.recordset?.[0]?.idMediosPago;
        ventaConHora.idMediosPago = firstId != null ? String(firstId) : '1';
      }
    }
    const ventaResult = await ventasRepository.insertar(transaction, ventaConHora, req.user.empresa, req.user.sub);
    const idVenta = ventaResult.recordset[0].idVenta;

    const idSucursalParaStock = idSucursalStock || venta.idSucursal || null;
    const idEstadoPedidoVenta = venta.idEstadoPedido != null ? parseInt(venta.idEstadoPedido, 10) : 1;
    const esEstadoPendiente = (idEstadoPedidoVenta === 1);
    for (const det of detalles) {
      const cantEntregada = esEstadoPendiente ? 0 : (det.cantEntregada != null ? Number(det.cantEntregada) : det.cantidad);
      await detalleVentaService.crearDetalle(transaction, { ...det, idVenta, cantEntregada, idEstadoPedido: idEstadoPedidoVenta, hVenta: getNowLocalSQLString() });
      await stockService.descontarDesdeLotes(transaction, {
        idEmpresa: req.user.empresa,
        idSucursal: idSucursalParaStock,
        idProducto: det.idProducto,
        cantidad: det.cantidad
      });
    }

    await ventasRepository.actualizarNumeroComprobante(transaction, req.user.empresa, venta.idComprobante, venta.numero);

    await facturacionRepository.registrarComprobanteElectronicoPorVentaRepo(
      transaction,
      req.user.empresa,
      idVenta,
      venta.idComprobante,
      venta.serie,
      venta.numero,
      fechaEmisionConHora
    );

    if (detallePago && Array.isArray(detallePago) && detallePago.length > 0) {
      await ventasRepository.insertarDetallePagoVenta(transaction, idVenta, detallePago);
      let idAperturaActual = idApertura || null;
      if (!idAperturaActual && venta.idSucursal) {
        const apertura = await CajaRepository.obtenerAperturaAbiertaPorSucursalRepo(pool, req.user.empresa, venta.idSucursal);
        idAperturaActual = apertura?.idApertura;
      }
      if (idAperturaActual) {
        await CajaRepository.registrarMovimientosVentaContadoRepo(transaction, {
          idApertura: idAperturaActual,
          idEmpresa: req.user.empresa,
          idSucursal: venta.idSucursal,
          idUsuario: req.user.sub,
          idVenta,
          compVenta: venta.compVenta || (venta.serie + '-' + venta.numero),
          detallePago
        });
      }
    }

    let condicionCredito = false;
    let descMedioPago = '';
    if (venta.idMediosPago != null && String(venta.idMediosPago).trim() !== '') {
      const rCond = await transaction.request()
        .input('idMediosPago', sql.VarChar(20), String(venta.idMediosPago).trim())
        .query(`SELECT descripcion FROM MediosPago WHERE idMediosPago = TRY_CAST(@idMediosPago AS INT) OR CAST(idMediosPago AS VARCHAR(20)) = @idMediosPago`);
      descMedioPago = rCond.recordset?.[0]?.descripcion || '';
      const descNormalizada = descMedioPago.normalize('NFD').replace(/\u0300-\u036f/g, '');
      condicionCredito = /credito/i.test(descNormalizada) || /cr[éèêëÉÈÊË]dito/i.test(descMedioPago);
    }

    await transaction.commit();

    if (condicionCredito && venta.idCliente && Number(venta.total) > 0) {
      try {
        const fEmision = venta.fEmision ? new Date(venta.fEmision) : new Date();
        const fVencimiento = venta.fVencimiento ? new Date(venta.fVencimiento) : new Date(fEmision.getTime() + 30 * 24 * 60 * 60 * 1000);
        const plazoDias = Math.max(1, Math.round((fVencimiento - fEmision) / (24 * 60 * 60 * 1000)));
        await CreditosService.crearCreditoService(pool, req.user, {
          idVenta: Number(idVenta),
          idCliente: venta.idCliente,
          montoTotal: Number(venta.total),
          plazoDias,
          tasaInteres: 0,
          numeroCuotas: 1,
          fechaVencimiento: fVencimiento
        });
      } catch (errCredito) {
        console.error('Error crear crédito desde venta:', errCredito);
      }
    }

    res.json({ success: true, idVenta });
  } catch (error) {
    await transaction.rollback();
    console.error('Error crearVentaCompleta:', error);
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
    const hVentaSQL = hVenta ? (getFechaEmisionSQLString(String(hVenta).trim().slice(0, 10)) || getNowLocalSQLString()) : getNowLocalSQLString();
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
                .input('hVenta', sql.VarChar(23), hVentaSQL)
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
  const FUltEntregaSQL = FUltEntrega ? (getFechaSoloSQLString(FUltEntrega) || getFechaEmisionSQLString(String(FUltEntrega).trim().slice(0, 10)) || String(FUltEntrega).trim().slice(0, 19).replace('T', ' ') + '.000') : null;
  if(req.user) {
        try {
        let pool = await sql.connect(dbConfig);
            let result = await pool
            .request()
            .input('id', sql.Int, id)
            .input('CantEntregado', sql.Decimal, CantEntregado)
            .input('FUltEntrega', sql.VarChar(23), FUltEntregaSQL)
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
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!req.user || !idEmpresa) {
        return res.status(403).json({ message: 'No Access' });
    }
    const idDetalle = req.params.id;
    const { idSucursal, idProducto, cantidad } = req.body;
    try {
        const pool = await sql.connect(dbConfig);
        const request = pool.request();
        request.input('idDetalle', sql.Int, idDetalle);
        request.input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
        request.input('idSucursal', sql.UniqueIdentifier, idSucursal);
        request.input('idProducto', sql.UniqueIdentifier, idProducto);
        request.input('cantidad', sql.Decimal(18, 2), cantidad);
        await request.execute('sp_RestaurarStock');
        await pool.request().input('idDetalle', sql.Int, idDetalle).query('DELETE FROM DetalleVenta WHERE idDetalle = @idDetalle');
        res.status(200).json({ message: 'Detalle de venta eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar el detalle de venta:', error);
        res.status(500).json({ message: 'Error al eliminar el detalle de venta' });
    }
};



/** PUT ventas/editar/:idVenta - Actualiza cabecera y detalle. No permitido si comprobante ya enviado/aceptado en SUNAT (idEstadoSunat 1,2,3). */
const actualizarVentaEdicion = async (req, res) => {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  const idVentaRaw = req.params.idVenta;
  const idVenta = parseInt(idVentaRaw, 10);
  if (Number.isNaN(idVenta) || idVenta < 1) {
    return res.status(400).json({ error: 'idVenta inválido' });
  }
  const { venta: cabecera, detalles } = req.body || {};
  if (!cabecera || !Array.isArray(detalles)) {
    return res.status(400).json({ error: 'Se requieren venta y detalles' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const data = await ventasRepository.obtenerComprobanteParaPdf(pool, idVenta, idEmpresa);
    if (!data || !data.venta) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    const idEstadoSunat = data.venta.idEstadoSunat;
    if (idEstadoSunat === 1 || idEstadoSunat === 2 || idEstadoSunat === 3) {
      return res.status(400).json({
        error: 'No se puede editar: el comprobante ya fue enviado o aceptado en SUNAT.'
      });
    }
    const result = await ventasRepository.actualizarVentaCompleta(pool, idVenta, idEmpresa, {
      ...cabecera,
      idEstadoSunat
    }, detalles);
    if (result && result.ok === false) {
      return res.status(400).json({ error: result.error || 'No se pudo actualizar' });
    }
    res.json({ message: 'Venta actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar venta (edición):', error);
    res.status(500).json({ error: error.message || 'Error al actualizar la venta' });
  }
};

/** GET /ventas/config-defaults - Valores por defecto para nueva venta (estado pedido, estado pago) desde ConfiguracionEmpresa. */
const getConfigDefaults = async (req, res) => {
  if (!req.user || !req.user.empresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const gestoresRepository = require('../repositories/gestores.repository');
    const rows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, req.user.empresa);
    const getVal = (clave) => {
      const r = (rows || []).find((x) => x.clave === clave);
      return r && r.valor != null ? r.valor.trim() : null;
    };
    const idEstadoPedido = getVal('venta_idEstadoPedidoPorDefecto');
    const idEstadoPago = getVal('venta_idEstadoPagoPorDefecto');
    res.json({
      data: {
        idEstadoPedidoPorDefecto: idEstadoPedido != null ? parseInt(idEstadoPedido, 10) : 1,
        idEstadoPagoPorDefecto: idEstadoPago != null ? parseInt(idEstadoPago, 10) : 2
      }
    });
  } catch (error) {
    console.error('Error getConfigDefaults:', error);
    res.status(500).json({ error: error.message || 'Error al obtener configuración' });
  }
};

/** PUT /ventas/config-defaults - Guarda valores por defecto para nueva venta. Body: { idEstadoPedidoPorDefecto, idEstadoPagoPorDefecto }. */
const putConfigDefaults = async (req, res) => {
  if (!req.user || !req.user.empresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  const { idEstadoPedidoPorDefecto, idEstadoPagoPorDefecto } = req.body || {};
  try {
    const pool = await sql.connect(dbConfig);
    const gestoresRepository = require('../repositories/gestores.repository');
    const idEmpresa = req.user.empresa;
    if (idEstadoPedidoPorDefecto != null) {
      await gestoresRepository.guardarConfiguracion(
        pool,
        idEmpresa,
        'venta_idEstadoPedidoPorDefecto',
        String(idEstadoPedidoPorDefecto),
        'Estado pedido por defecto en nueva venta (1=Pendiente, 2=Entregado)',
        'INT'
      );
    }
    if (idEstadoPagoPorDefecto != null) {
      await gestoresRepository.guardarConfiguracion(
        pool,
        idEmpresa,
        'venta_idEstadoPagoPorDefecto',
        String(idEstadoPagoPorDefecto),
        'Estado de pago por defecto en nueva venta (1=Pendiente, 2=Pagado)',
        'INT'
      );
    }
    res.json({ message: 'Configuración guardada' });
  } catch (error) {
    console.error('Error putConfigDefaults:', error);
    res.status(500).json({ error: error.message || 'Error al guardar configuración' });
  }
};

/** GET /ventas/pendientes-pago - Lista ventas con idEstadoPago = 1. Query: idVenta, cliente (nombre o RUC). */
const getPendientesPago = async (req, res) => {
  if (!req.user || !req.user.empresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const list = await ventasRepository.listarPendientesPago(pool, req.user.empresa, req.query);
    res.json({ data: list });
  } catch (error) {
    console.error('Error getPendientesPago:', error);
    res.status(500).json({ error: error.message || 'Error al listar ventas pendientes de pago' });
  }
};

/** POST /ventas/:idVenta/cobrar - Registra cobro de una venta pendiente. Body: { detallePago: [{ idMediosPago, monto }], idApertura? }. */
const postCobrarVenta = async (req, res) => {
  if (!req.user || !req.user.empresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  const idVenta = parseInt(req.params.idVenta, 10);
  const { detallePago, idApertura } = req.body || {};
  if (!idVenta || !Number.isFinite(idVenta)) {
    return res.status(400).json({ message: 'idVenta inválido' });
  }
  if (!detallePago || !Array.isArray(detallePago) || detallePago.length === 0) {
    return res.status(400).json({ message: 'detallePago es requerido y debe tener al menos un pago' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const CajaRepository = require('../repositories/caja.repository');
    const ventaRow = await pool
      .request()
      .input('idVenta', sql.Int, idVenta)
      .input('idEmpresa', sql.UniqueIdentifier, req.user.empresa)
      .query(`
        SELECT idVenta, compVenta, idSucursal, idEstadoPago
        FROM Ventas WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
      `);
    const venta = ventaRow.recordset && ventaRow.recordset[0];
    if (!venta) {
      return res.status(404).json({ message: 'Venta no encontrada' });
    }
    if (venta.idEstadoPago !== 1) {
      return res.status(400).json({ message: 'La venta ya está pagada o no está pendiente de pago' });
    }
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await ventasRepository.actualizarEstadoPagoVenta(transaction, idVenta, req.user.empresa, 2);
      await ventasRepository.insertarDetallePagoVenta(transaction, idVenta, detallePago);
      let idAperturaActual = idApertura || null;
      if (!idAperturaActual && venta.idSucursal) {
        const apertura = await CajaRepository.obtenerAperturaAbiertaPorSucursalRepo(pool, req.user.empresa, venta.idSucursal);
        idAperturaActual = apertura?.idApertura;
      }
      if (idAperturaActual) {
        await CajaRepository.registrarMovimientosVentaContadoRepo(transaction, {
          idApertura: idAperturaActual,
          idEmpresa: req.user.empresa,
          idSucursal: venta.idSucursal,
          idUsuario: req.user.sub,
          idVenta,
          compVenta: venta.compVenta || '',
          detallePago
        });
      }
      await transaction.commit();
      res.json({ message: 'Cobro registrado correctamente' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error postCobrarVenta:', error);
    res.status(500).json({ error: error.message || 'Error al registrar cobro' });
  }
};

module.exports = {
    crearVenta,
    crearVentaCompleta,
    obtenerVentaPorId,
    obtenerVentas,
    obtenerComprobanteParaPdf,
    actualizarVenta,
    actualizarVentaEdicion,
    getConfigDefaults,
    putConfigDefaults,
    getPendientesPago,
    postCobrarVenta,
    // detalle venta (crearDetalleVenta está comentado; se usa crearVentaCompleta)
    crearDetalleVenta_DescontarStock,
    actualizarDetalleVenta,
    obtenerDetalleVenta_idVenta,
    obtenerVenta_idDetalle,
    eliminarDetalleVenta
}





