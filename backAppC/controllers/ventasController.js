const path = require('path');
const fs = require('fs');
const sql = require('mssql');
const ventasService = require('../services/ventas.service');
const ventasRepository = require('../repositories/ventas.repository');
const gestoresRepository = require('../repositories/gestores.repository');
const facturacionRepository = require('../repositories/facturacion.repository');
const dbConfig = require('../dbconfig');
const { nombreArchivoComprobante, getRutaFirmaFacturador, getRutaRptaFacturador } = require('../utils/facturadorSunat.util');
const { getNowLocalSQLString, getFechaEmisionSQLString, getFechaSoloSQLString } = require('../utils/fechaHoraLocal.util');
const sunatPostPagoService = require('../services/sunatPostPago.service');

/** Empresa JWT + gestionadas (gestora): permite PDF/comprobante de ventas de empresas hijas. */
const idsEmpresaParaComprobanteVenta = async (pool, idEmpresaUsuario) => {
  const ids = new Set();
  if (idEmpresaUsuario) ids.add(String(idEmpresaUsuario));
  try {
    const gestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, idEmpresaUsuario);
    for (const g of gestionadas || []) {
      if (g.idEmpresa) ids.add(String(g.idEmpresa));
    }
  } catch (_) {
    /* solo JWT */
  }
  return Array.from(ids);
};

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
    
    if (!Serie_Numero) {
    return res.status(400).send('Falta el parámetro Serie_Numero');
  }
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
    let idsList = [idempresa];
    try {
      const esGestora = await gestoresRepository.esEmpresaGestoraActiva(pool, idempresa);
      if (esGestora) {
        idsList = await idsEmpresaParaComprobanteVenta(pool, idempresa);
      }
    } catch (_) {
      idsList = [idempresa];
    }
    let list = await ventasRepository.listarPorIdsEmpresas(pool, idsList);
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

const obtenerVentasAgrupadas = async function (req, res) {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const list = await ventasRepository.listarVentasAgrupadas(pool, idEmpresa);
    res.json({ data: list });
  } catch (error) {
    console.error('Error al obtener ventas agrupadas:', error);
    res.status(500).json({ error: 'Error al obtener ventas agrupadas' });
  }
};

const obtenerVentasEmpresa = async function (req, res) {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const list = await ventasRepository.listarVentasEmpresa(pool, idEmpresa);
    res.json({ data: list });
  } catch (error) {
    console.error('Error al obtener ventas por empresa:', error);
    res.status(500).json({ error: 'Error al obtener ventas por empresa' });
  }
};

const obtenerDetalleVentaAgrupada = async function (req, res) {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  const idVentaAgrupada = req.params.idVentaAgrupada;
  if (!idVentaAgrupada) {
    return res.status(400).json({ error: 'idVentaAgrupada es requerido' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const detalle = await ventasRepository.obtenerDetalleVentaAgrupada(pool, idEmpresa, idVentaAgrupada);
    res.json({ data: detalle });
  } catch (error) {
    console.error('Error al obtener detalle de venta agrupada:', error);
    res.status(500).json({ error: 'Error al obtener detalle de venta agrupada' });
  }
};

const obtenerComprobantesVentaAgrupada = async function (req, res) {
  const idEmpresa = req.user?.empresa;
  if (!req.user || !idEmpresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  const idVentaAgrupada = req.params.idVentaAgrupada;
  if (!idVentaAgrupada) {
    return res.status(400).json({ error: 'idVentaAgrupada es requerido' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const data = await ventasRepository.listarComprobantesPorAgrupada(pool, idEmpresa, idVentaAgrupada);
    res.json({ data });
  } catch (error) {
    console.error('Error al obtener comprobantes por venta agrupada:', error);
    res.status(500).json({ error: 'Error al obtener comprobantes' });
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
    const idsEmpresa = await idsEmpresaParaComprobanteVenta(pool, idEmpresa);
    const data = await ventasRepository.obtenerComprobanteParaPdf(pool, idVenta, idsEmpresa, baseUrl);
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

const obtenerComprobanteVAParaPdf = async (req, res) => {
  try {
    const idEmpresa = req.user.empresa;
    const { idVentaAgrupada } = req.params;
    if (!idVentaAgrupada) {
      return res.status(400).json({ error: 'idVentaAgrupada es requerido.' });
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const pool = await sql.connect(dbConfig);
    const data = await ventasRepository.obtenerComprobanteVAParaPdf(pool, idEmpresa, idVentaAgrupada, baseUrl);
    if (!data) {
      return res.status(404).json({ error: 'Venta agrupada no encontrada.' });
    }
    return res.json({ message: 'Comprobante VA obtenido.', data });
  } catch (error) {
    console.error('Error obtenerComprobanteVAParaPdf:', error);
    return res.status(500).json({ error: error.message || 'Error interno.' });
  }
};

//en actualizar venta solo actualizare el estadoPEdido y estado sunat
const actualizarVenta = async function (req, res) {
  const { Serie_Numero, EstadoPedido, EstadoSunat } = req.body;
  // const Serie_Numero = req.params.id;
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
  if (!req.user || !req.user.empresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    const resultado = await ventasService.crearVentaCorporativaCompleta(req.body, req.user);
    res.json({
      success: true,
      idVentaAgrupada: resultado.idVentaAgrupada,
      ventasEmpresa: resultado.ventasEmpresa,
      ...(resultado.avisoStockInsuficiente && { avisoStockInsuficiente: resultado.avisoStockInsuficiente })
    });
  } catch (error) {
    console.error('Error crearVentaCompleta:', error);
    res.status(500).json({ error: error?.message });
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
    const idsEmpresa = await idsEmpresaParaComprobanteVenta(pool, idEmpresa);
    const data = await ventasRepository.obtenerComprobanteParaPdf(pool, idVenta, idsEmpresa);
    if (!data || !data.venta) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    if (data.venta.eliminado) {
      return res.status(400).json({ error: 'No se puede editar: el comprobante fue anulado.' });
    }
    const idEstadoSunat = data.venta.idEstadoSunat;
    const codigoCompEdicion = String(data.venta.codigoComprobante || '').trim().toUpperCase();
    const esNotaVentaEdicion = codigoCompEdicion === 'NV';
    if (!esNotaVentaEdicion && (idEstadoSunat === 1 || idEstadoSunat === 2 || idEstadoSunat === 3)) {
      return res.status(400).json({
        error: 'No se puede editar: el comprobante ya fue enviado o aceptado en SUNAT.'
      });
    }
    const idEmpresaVenta = data.venta.idEmpresa || idEmpresa;
    const result = await ventasRepository.actualizarVentaCompleta(pool, idVenta, idEmpresaVenta, {
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

/** GET /ventas/agrupadas/pendientes-pago - Lista ventas agrupadas pendientes de pago. */
const getPendientesPagoAgrupadas = async (req, res) => {
  if (!req.user || !req.user.empresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const list = await ventasRepository.listarPendientesPagoAgrupado(pool, req.user.empresa, req.query);
    res.json({ data: list });
  } catch (error) {
    console.error('Error getPendientesPagoAgrupadas:', error);
    res.status(500).json({ error: error.message || 'Error al listar ventas agrupadas pendientes' });
  }
};

/** POST /ventas/agrupadas/:idVentaAgrupada/cobrar - Registra cobro de una venta agrupada. */
const postCobrarVentaAgrupada = async (req, res) => {
  if (!req.user || !req.user.empresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  const idVentaAgrupada = req.params.idVentaAgrupada;
  const { detallePago, idApertura, cuotasCredito } = req.body || {};
  if (!idVentaAgrupada) {
    return res.status(400).json({ message: 'idVentaAgrupada es requerido' });
  }
  if (!detallePago || !Array.isArray(detallePago) || detallePago.length === 0) {
    return res.status(400).json({ message: 'detallePago es requerido y debe tener al menos un pago' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const ventaAgrRow = await pool.request()
      .input('idVentaAgrupada', sql.UniqueIdentifier, idVentaAgrupada)
      .input('idEmpresaCobradora', sql.UniqueIdentifier, req.user.empresa)
      .query(`
        SELECT idVentaAgrupada, idSucursal, idEstadoPago, compVenta
        FROM VentaAgrupada
        WHERE idVentaAgrupada = @idVentaAgrupada AND idEmpresaCobradora = @idEmpresaCobradora
      `);
    const ventaAgr = ventaAgrRow.recordset && ventaAgrRow.recordset[0];
    if (!ventaAgr) {
      return res.status(404).json({ message: 'Venta agrupada no encontrada' });
    }
    if (ventaAgr.idEstadoPago !== 1) {
      return res.status(400).json({ message: 'La venta ya está pagada o no está pendiente de pago' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const ventasEmp = await ventasRepository.listarVentasEmpresaPorAgrupada(transaction, idVentaAgrupada);
      if (!ventasEmp || ventasEmp.length === 0) {
        throw new Error('La venta agrupada no tiene comprobantes asociados (VentaEmpresa). No se puede cobrar.');
      }

      const fvRow = await transaction
        .request()
        .input('idVA', sql.UniqueIdentifier, idVentaAgrupada)
        .query(`
          SELECT TOP 1 CONVERT(VARCHAR(10), v.fVencimiento, 23) AS fVencimiento
          FROM VentaEmpresa ve
          INNER JOIN Ventas v ON v.idVenta = ve.idVenta AND v.idEmpresa = ve.idEmpresa
          WHERE ve.idVentaAgrupada = @idVA
          ORDER BY ve.fEmision ASC
        `);
      const fVencCab = fvRow.recordset?.[0]?.fVencimiento || null;

      const ventaCreditoPostVentaService = require('../services/ventaCreditoPostVenta.service');
      await ventaCreditoPostVentaService.crearCreditosDesdeVentaAgrupada(transaction, {
        ventasEmpresa: ventasEmp.map((v) => ({
          idEmpresa: v.idEmpresa,
          idVenta: v.idVenta,
          idCliente: v.idCliente,
          codigoComprobante: v.codigoComprobante || '',
          compVenta: v.compVenta,
          total: v.total,
          idSucursal: v.idSucursal,
        })),
        detallePago,
        cuotasCredito: Array.isArray(cuotasCredito) ? cuotasCredito : [],
        userSub: req.user.sub,
        fVencimientoCabecera: fVencCab,
      });

      await ventasRepository.actualizarEstadoPagoVentaAgrupada(transaction, idVentaAgrupada, req.user.empresa, 2);
      for (const ve of ventasEmp) {
        await ventasRepository.actualizarEstadoPagoVenta(transaction, ve.idVenta, ve.idEmpresa, 2);
      }

      const compParaCaja = (ventaAgr.compVenta && String(ventaAgr.compVenta).trim())
        ? String(ventaAgr.compVenta).trim()
        : 'S/N';

      const ventaAgrupadaCobroService = require('../services/ventaAgrupadaCobro.service');
      await ventaAgrupadaCobroService.aplicarCobroVentasAgrupadasMulticompania(pool, transaction, {
        lineasVenta: ventasEmp.map((v) => ({
          idVenta: v.idVenta,
          idEmpresa: v.idEmpresa,
          compVenta: v.compVenta,
          total: v.total,
          idSucursal: v.idSucursal,
        })),
        detallePago,
        idEmpresaCobradora: req.user.empresa,
        idUsuario: req.user.sub,
        compVentaVA: compParaCaja,
        idAperturaGestoraOpcional: idApertura || null,
        idSucursalGestoraFallback: ventaAgr.idSucursal,
      });

      await transaction.commit();
      for (const ve of ventasEmp) {
        sunatPostPagoService.encolarTrasConfirmarPago(pool, ve.idVenta, ve.idEmpresa);
      }
      res.json({ message: 'Cobro registrado correctamente' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error postCobrarVentaAgrupada:', error);
    const msg = error.message || 'Error al registrar cobro';
    const cod = error.code;
    const esNegocio =
      cod === 'TOTAL_PAGO_INCONSISTENTE' ||
      cod === 'PAGO_INSUFICIENTE' ||
      cod === 'PAGO_EXCEDENTE' ||
      msg.includes('Debe abrir una caja') ||
      msg.includes('No hay caja abierta') ||
      msg.includes('no coincide con la suma de comprobantes') ||
      msg.includes('No alcanzan las formas de pago') ||
      msg.includes('Sobran montos en formas de pago') ||
      msg.includes('no tiene idVenta válido') ||
      msg.includes('no tiene comprobantes asociados') ||
      msg.includes('plan de cuotas') ||
      msg.includes('suma de cuotas');
    res.status(esNegocio ? 400 : 500).json({ error: msg });
  }
};
/** POST /ventas/:idVenta/cobrar - Registra cobro de una venta pendiente. Body: { detallePago: [{ idMediosPago, monto }], idApertura? }. */
const postCobrarVenta = async (req, res) => {
  if (!req.user || !req.user.empresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  const idVenta = parseInt(req.params.idVenta, 10);
  const { detallePago, idApertura, cuotasCredito } = req.body || {};
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
        SELECT
          v.idVenta,
          v.compVenta,
          v.idSucursal,
          v.idEstadoPago,
          v.idCliente,
          v.total,
          CONVERT(VARCHAR(10), v.fVencimiento, 23) AS fVencimiento,
          UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) AS codigoComprobante
        FROM Ventas v
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        WHERE v.idVenta = @idVenta AND v.idEmpresa = @idEmpresa
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
      const ventaCreditoPostVentaService = require('../services/ventaCreditoPostVenta.service');
      const { normalizarDetallePagoIdMediosPago } = require('../utils/detallePagoNormalizar.util');
      const detalleNorm = await normalizarDetallePagoIdMediosPago(transaction, detallePago);

      await ventaCreditoPostVentaService.crearCreditosDesdeVentaAgrupada(transaction, {
        ventasEmpresa: [
          {
            idEmpresa: req.user.empresa,
            idVenta,
            idCliente: venta.idCliente,
            codigoComprobante: venta.codigoComprobante || '',
            compVenta: venta.compVenta,
            total: Number(venta.total) || 0,
            idSucursal: venta.idSucursal,
          },
        ],
        detallePago: detalleNorm,
        cuotasCredito: Array.isArray(cuotasCredito) ? cuotasCredito : [],
        userSub: req.user.sub,
        fVencimientoCabecera: venta.fVencimiento,
      });

      await ventasRepository.actualizarEstadoPagoVenta(transaction, idVenta, req.user.empresa, 2);
      await ventasRepository.insertarDetallePagoVenta(transaction, idVenta, detalleNorm);
      let idSucursalCaja = venta.idSucursal;
      let idAperturaActual = idApertura || null;
      if (!idAperturaActual && venta.idSucursal) {
        const apertura = await CajaRepository.obtenerAperturaAbiertaPorSucursalRepo(pool, req.user.empresa, venta.idSucursal);
        idAperturaActual = apertura?.idApertura;
      }
      if (!idAperturaActual) {
        const cualquier = await CajaRepository.obtenerCualquierAperturaAbiertaRepo(pool, req.user.empresa);
        if (cualquier?.idApertura) {
          idAperturaActual = cualquier.idApertura;
          idSucursalCaja = cualquier.idSucursal || venta.idSucursal;
        }
      }
      const esCotizacion = (venta.codigoComprobante || '').trim().toUpperCase() === 'CT';
      const idsCredito = await ventaCreditoPostVentaService.idsMediosPagoCredito(transaction);
      const detalleCaja = detalleNorm.filter((p) => !idsCredito.has(Number(p.idMediosPago)));
      if (idAperturaActual && !esCotizacion && detalleCaja.length > 0) {
        await CajaRepository.registrarMovimientosVentaContadoRepo(transaction, {
          idApertura: idAperturaActual,
          idEmpresa: req.user.empresa,
          idSucursal: idSucursalCaja,
          idUsuario: req.user.sub,
          idVenta,
          compVenta: venta.compVenta || '',
          detallePago: detalleCaja,
        });
      }
      await transaction.commit();
      sunatPostPagoService.encolarTrasConfirmarPago(pool, idVenta, req.user.empresa);
      res.json({ message: 'Cobro registrado correctamente' });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error postCobrarVenta:', error);
    const msg = error.message || 'Error al registrar cobro';
    const esNegocio =
      msg.includes('plan de cuotas') ||
      msg.includes('suma de cuotas') ||
      msg.includes('total al crédito') ||
      msg.includes('No hay caja abierta') ||
      msg.includes('no coincide con la suma');
    res.status(esNegocio ? 400 : 500).json({ error: msg });
  }
};

const crearVentaDesdeVale = async (req, res) => {
  if (!req.user || !req.user.empresa || !req.user.sub) {
    return res.status(401).json({ message: 'No Access' });
  }
  const { idValeDespacho, idComprobante } = req.body || {};
  if (!idValeDespacho || idComprobante == null) {
    return res.status(400).json({ error: 'Se requieren idValeDespacho e idComprobante (Factura o Boleta).' });
  }
  const pool = await sql.connect(dbConfig);
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();
    const resultado = await ventasService.crearVentaDesdeVale(
      transaction,
      pool,
      req.user.empresa,
      req.user.sub,
      { idValeDespacho, idComprobante: Number(idComprobante) }
    );
    await transaction.commit();
    res.status(201).json({ success: true, data: resultado });
  } catch (error) {
    await transaction.rollback();
    console.error('Error crearVentaDesdeVale:', error);
    res.status(500).json({ error: error.message || 'Error al liquidar vale.' });
  }
};

/** DELETE /ventas/anular/:idVenta - Anula lógicamente una venta (eliminado=1). Restaura stock. No permitido si ya enviado a SUNAT. */
const anularVenta = async (req, res) => {
  if (!req.user || !req.user.empresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  const idVenta = parseInt(req.params.idVenta, 10);
  if (Number.isNaN(idVenta) || idVenta < 1) {
    return res.status(400).json({ error: 'idVenta inválido' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const result = await ventasRepository.anularVentaRepo(pool, idVenta, req.user.empresa);
    if (result.ok === false) {
      return res.status(400).json({ error: result.error || 'No se pudo anular' });
    }
    res.json({ message: 'Comprobante anulado correctamente. El stock ha sido restaurado.' });
  } catch (error) {
    console.error('Error anularVenta:', error);
    res.status(500).json({ error: error.message || 'Error al anular la venta' });
  }
};

module.exports = {
    crearVenta,
    crearVentaCompleta,
    crearVentaDesdeVale,
    obtenerVentaPorId,
    obtenerVentas,
    obtenerVentasAgrupadas,
    obtenerVentasEmpresa,
    obtenerDetalleVentaAgrupada,
    obtenerComprobantesVentaAgrupada,
    obtenerComprobanteParaPdf,
    obtenerComprobanteVAParaPdf,
    actualizarVenta,
    actualizarVentaEdicion,
    getConfigDefaults,
    putConfigDefaults,
    getPendientesPago,
    getPendientesPagoAgrupadas,
    postCobrarVenta,
    postCobrarVentaAgrupada,
    // detalle venta (crearDetalleVenta está comentado; se usa crearVentaCompleta)
    crearDetalleVenta_DescontarStock,
    actualizarDetalleVenta,
    obtenerDetalleVenta_idVenta,
    obtenerVenta_idDetalle,
    eliminarDetalleVenta,
    anularVenta
}





