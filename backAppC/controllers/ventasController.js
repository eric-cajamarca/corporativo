const sql = require('mssql');
const ventasService = require('../services/ventas.service');
const ventasOrquestacion = require('../services/ventasOrquestacion.service');
const { getNowLocalSQLString, getFechaEmisionSQLString, getFechaSoloSQLString } = require('../utils/fechaHoraLocal.util');
const { withPool } = require('../utils/dbPool.util');

const crearVenta = async function (req, res) {
  const datosVenta = req.body;
  const idUsuario = req.sub;

  if (!req.user) {
    return res.status(401).send({ message: 'No Access' });
  }

  try {
    await withPool((pool) =>
      ventasService.crearVentaCabeceraConTransaccion(pool, datosVenta, req.user.empresa, idUsuario)
    );
    res.status(201).json({ message: 'Venta creada correctamente' });
  } catch (error) {
    console.error('Error al crear la venta:', error);
    if (error && error.message === 'PLAN_LIMITE_COMPROBANTES_SUNAT') {
      return res.status(403).json({
        error:
          'Ha alcanzado el límite de comprobantes electrónicos aceptados por SUNAT previsto en su plan de suscripción.',
        code: error.message
      });
    }
    res.status(500).send('Error al crear la venta');
  }
};

const obtenerVentaPorId = async function (req, res) {
  const Serie_Numero = req.params.id;
  const idempresa = req.user.empresa;

  if (!Serie_Numero) {
    return res.status(400).send('Falta el parámetro Serie_Numero');
  }
  if (req.user) {
    try {
      const result = await withPool((pool) =>
        ventasService.obtenerVentaPorSerieNumero(pool, Serie_Numero, idempresa)
      );
      res.json(result);
    } catch (error) {
      console.error('Error al obtener la venta:', error);
      res.status(500).send('Error al obtener la venta por id');
    }
  } else {
    res.status(500).send({ message: 'No Access' });
  }
};

const obtenerVentas = async function (req, res) {
  const idempresa = req.user.empresa;
  if (!req.user || !idempresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    const idSucursal =
      req.query?.idSucursal != null && String(req.query.idSucursal).trim() !== ''
        ? String(req.query.idSucursal).trim()
        : undefined;
    const optsListado = {};
    if (idSucursal) optsListado.idSucursal = idSucursal;
    const list = await withPool((pool) => ventasOrquestacion.obtenerVentasListado(pool, idempresa, optsListado));
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
    const list = await withPool((pool) => ventasOrquestacion.listarVentasAgrupadas(pool, idEmpresa));
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
    const list = await withPool((pool) => ventasOrquestacion.listarVentasEmpresa(pool, idEmpresa));
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
    const detalle = await withPool((pool) =>
      ventasOrquestacion.obtenerDetalleVentaAgrupada(pool, idEmpresa, idVentaAgrupada)
    );
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
    const data = await withPool((pool) =>
      ventasOrquestacion.listarComprobantesPorAgrupada(pool, idEmpresa, idVentaAgrupada)
    );
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
    const data = await withPool((pool) =>
      ventasOrquestacion.obtenerComprobanteParaPdf(pool, idEmpresa, idVenta, baseUrl)
    );
    if (!data) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    res.json({ data });
  } catch (error) {
    console.error('Error al obtener comprobante para PDF:', error);
    const message =
      process.env.NODE_ENV !== 'production' && error?.message ? error.message : 'Error al obtener datos del comprobante';
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
    const data = await withPool((pool) =>
      ventasOrquestacion.obtenerComprobanteVAParaPdf(pool, idEmpresa, idVentaAgrupada, baseUrl)
    );
    if (!data) {
      return res.status(404).json({ error: 'Venta agrupada no encontrada.' });
    }
    return res.json({ message: 'Comprobante VA obtenido.', data });
  } catch (error) {
    console.error('Error obtenerComprobanteVAParaPdf:', error);
    return res.status(500).json({ error: error.message || 'Error interno.' });
  }
};

const actualizarVenta = async function (req, res) {
  const { Serie_Numero, EstadoPedido, EstadoSunat } = req.body;
  if (req.user) {
    try {
      await withPool((pool) =>
        ventasService.actualizarVentaEstadoPedidoSunat(pool, Serie_Numero, EstadoPedido, EstadoSunat)
      );
      res.status(200).json({ message: 'Registro actualizado correctamente' });
    } catch (error) {
      console.error('Error al actualizar el detalle de venta:', error);
      res.status(500).send('Error al actualizar el detalle de venta');
    }
  } else {
    res.status(500).send({ message: 'No Access' });
  }
};

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
    if (error && error.message === 'PLAN_LIMITE_COMPROBANTES_SUNAT') {
      return res.status(403).json({
        error:
          'Ha alcanzado el límite de comprobantes electrónicos aceptados por SUNAT previsto en su plan de suscripción.',
        code: error.message
      });
    }
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
  const hVentaSQL = hVenta
    ? getFechaEmisionSQLString(String(hVenta).trim().slice(0, 10)) || getNowLocalSQLString()
    : getNowLocalSQLString();
  if (req.user) {
    try {
      await withPool((pool) =>
        ventasService.crearDetalleVentaDescontarStock(pool, {
          idEmpresa,
          idSucursal,
          idProducto,
          cantidad,
          idVenta,
          pVenta,
          descuento,
          subtotal,
          igv,
          isc,
          total,
          hVentaSQL,
          cantEntregada,
          idEstadoPedido
        })
      );
      res.status(201).json({ message: 'Detalle de venta creado y stock descontado correctamente' });
    } catch (error) {
      console.error('Error al crear el detalle de venta y descontar stock:', error);
      res.status(500).send('Error al crear el detalle de venta y descontar stock');
    }
  } else {
    res.status(500).send({ message: 'No Access' });
  }
};

const actualizarDetalleVenta = async function (req, res) {
  const { id, CantEntregado, FUltEntrega, EstadoPedido } = req.body;
  const FUltEntregaSQL = FUltEntrega
    ? getFechaSoloSQLString(FUltEntrega) ||
      getFechaEmisionSQLString(String(FUltEntrega).trim().slice(0, 10)) ||
      `${String(FUltEntrega).trim().slice(0, 19).replace('T', ' ')}.000`
    : null;
  if (req.user) {
    try {
      await withPool((pool) =>
        ventasService.actualizarDetalleVentasEntrega(pool, id, CantEntregado, FUltEntregaSQL, EstadoPedido)
      );
      res.status(200).json({ message: 'Registro actualizado correctamente' });
    } catch (error) {
      console.error('Error al actualizar el detalle de venta:', error);
      res.status(500).send('Error al actualizar el detalle de venta');
    }
  } else {
    res.status(500).send({ message: 'No Access' });
  }
};

const obtenerDetalleVenta_idVenta = async function (req, res) {
  const idVenta = req.params.id;
  if (req.user) {
    try {
      const result = await withPool((pool) => ventasService.obtenerDetalleVentaPorIdVenta(pool, idVenta));
      res.json(result);
    } catch (error) {
      console.error('Error al obtener el detalle de venta:', error);
      res.status(500).send('Error al obtener el detalle de venta por idVenta');
    }
  } else {
    res.status(500).send({ message: 'No Access' });
  }
};

const obtenerVenta_idDetalle = async function (req, res) {
  const idDetalle = req.params.id;
  if (req.user) {
    try {
      const result = await withPool((pool) => ventasService.obtenerVentaPorIdDetalle(pool, idDetalle));
      res.json(result);
    } catch (error) {
      console.error('Error al obtener la venta por idDetalle:', error);
      res.status(500).send('Error al obtener la venta por idDetalle');
    }
  } else {
    res.status(500).send({ message: 'No Access' });
  }
};

const eliminarDetalleVenta = async function (req, res) {
  const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
  if (!req.user || !idEmpresa) {
    return res.status(403).json({ message: 'No Access' });
  }
  const idDetalle = req.params.id;
  const { idSucursal, idProducto, cantidad } = req.body;
  try {
    await withPool((pool) =>
      ventasService.restaurarStockEliminarDetalleVenta(pool, {
        idDetalle,
        idEmpresa,
        idSucursal,
        idProducto,
        cantidad
      })
    );
    res.status(200).json({ message: 'Detalle de venta eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar el detalle de venta:', error);
    res.status(500).json({ message: 'Error al eliminar el detalle de venta' });
  }
};

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
  const { venta: cabecera, detalles, detallePago } = req.body || {};
  if (!cabecera || !Array.isArray(detalles)) {
    return res.status(400).json({ error: 'Se requieren venta y detalles' });
  }
  try {
    const out = await withPool((pool) =>
      ventasOrquestacion.actualizarVentaEdicion(pool, idEmpresa, idVenta, cabecera, detalles, req.user, {
        detallePago
      })
    );
    if (!out.ok) {
      return res.status(out.status).json({ error: out.error });
    }
    res.json({ message: 'Venta actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar venta (edición):', error);
    res.status(500).json({ error: error.message || 'Error al actualizar la venta' });
  }
};

const getConfigDefaults = async (req, res) => {
  if (!req.user || !req.user.empresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    const data = await withPool((pool) => ventasOrquestacion.getConfigDefaults(pool, req.user.empresa));
    res.json({ data });
  } catch (error) {
    console.error('Error getConfigDefaults:', error);
    res.status(500).json({ error: error.message || 'Error al obtener configuración' });
  }
};

const putConfigDefaults = async (req, res) => {
  if (!req.user || !req.user.empresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    await withPool((pool) => ventasOrquestacion.putConfigDefaults(pool, req.user.empresa, req.body || {}));
    res.json({ message: 'Configuración guardada' });
  } catch (error) {
    console.error('Error putConfigDefaults:', error);
    res.status(500).json({ error: error.message || 'Error al guardar configuración' });
  }
};

const getPendientesPago = async (req, res) => {
  if (!req.user || !req.user.empresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    const list = await withPool((pool) =>
      ventasOrquestacion.listarPendientesPago(pool, req.user.empresa, req.query)
    );
    res.json({ data: list });
  } catch (error) {
    console.error('Error getPendientesPago:', error);
    res.status(500).json({ error: error.message || 'Error al listar ventas pendientes de pago' });
  }
};

const getPendientesPagoAgrupadas = async (req, res) => {
  if (!req.user || !req.user.empresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    const list = await withPool((pool) =>
      ventasOrquestacion.listarPendientesPagoAgrupado(pool, req.user.empresa, req.query)
    );
    res.json({ data: list });
  } catch (error) {
    console.error('Error getPendientesPagoAgrupadas:', error);
    res.status(500).json({ error: error.message || 'Error al listar ventas agrupadas pendientes' });
  }
};

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
    await withPool((pool) =>
      ventasOrquestacion.postCobrarVentaAgrupada(pool, req.user, idVentaAgrupada, {
        detallePago,
        idApertura,
        cuotasCredito
      })
    );
    res.json({ message: 'Cobro registrado correctamente' });
  } catch (error) {
    console.error('Error postCobrarVentaAgrupada:', error);
    if (error.httpStatus) {
      return res.status(error.httpStatus).json({ message: error.clientMessage || error.message });
    }
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
    await withPool((pool) =>
      ventasOrquestacion.postCobrarVenta(pool, req.user, idVenta, {
        detallePago,
        idApertura,
        cuotasCredito
      })
    );
    res.json({ message: 'Cobro registrado correctamente' });
  } catch (error) {
    console.error('Error postCobrarVenta:', error);
    if (error.httpStatus) {
      return res.status(error.httpStatus).json({ message: error.clientMessage || error.message });
    }
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
  try {
    await withPool(async (pool) => {
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        const resultado = await ventasService.crearVentaDesdeVale(transaction, pool, req.user.empresa, req.user.sub, {
          idValeDespacho,
          idComprobante: Number(idComprobante)
        });
        await transaction.commit();
        res.status(201).json({ success: true, data: resultado });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    });
  } catch (error) {
    console.error('Error crearVentaDesdeVale:', error);
    if (!res.headersSent) {
      if (error && error.message === 'PLAN_LIMITE_COMPROBANTES_SUNAT') {
        return res.status(403).json({
          error:
            'Ha alcanzado el límite de comprobantes electrónicos aceptados por SUNAT previsto en su plan de suscripción.',
          code: error.message
        });
      }
      res.status(500).json({ error: error.message || 'Error al liquidar vale.' });
    }
  }
};

const listarNotasCreditoDebito = async (req, res) => {
  const idempresa = req.user.empresa;
  if (!req.user || !idempresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  try {
    const { rows, total } = await withPool((pool) =>
      ventasOrquestacion.listarNotasCreditoDebito(pool, idempresa, req.query)
    );
    return res.json({ data: rows, total });
  } catch (error) {
    console.error('Error listarNotasCreditoDebito:', error);
    return res.status(500).json({ message: error.message || 'Error al listar notas' });
  }
};

const anularVenta = async (req, res) => {
  if (!req.user || !req.user.empresa) {
    return res.status(401).json({ message: 'No Access' });
  }
  const idVenta = parseInt(req.params.idVenta, 10);
  if (Number.isNaN(idVenta) || idVenta < 1) {
    return res.status(400).json({ error: 'idVenta inválido' });
  }
  try {
    const result = await withPool((pool) =>
      ventasOrquestacion.anularVenta(pool, req.user.empresa, idVenta, req.user)
    );
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
  listarNotasCreditoDebito,
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
  crearDetalleVenta_DescontarStock,
  actualizarDetalleVenta,
  obtenerDetalleVenta_idVenta,
  obtenerVenta_idDetalle,
  eliminarDetalleVenta,
  anularVenta
};
