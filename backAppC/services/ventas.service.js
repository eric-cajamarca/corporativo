// services/ventas.service.js

const ventasRepository = require('../repositories/ventas.repository');
const valesDespachoRepository = require('../repositories/valesDespacho.repository');
const detalleVentaService = require('./detalle-ventas.service');
const facturacionRepository = require('../repositories/facturacion.repository');
const { getNowLocalSQLString } = require('../utils/fechaHoraLocal.util');

exports.crearVenta = async (datosVenta, idEmpresa, idUsuario) => {
  // El Service solo extrae datos y llama al Repository
  return await ventasRepository.insertar(datosVenta, idEmpresa, idUsuario);
};

/**
 * Crea una venta (Factura/Boleta) a partir de un vale de despacho (liquidación).
 * No descuenta stock; actualiza ValesDespacho.idVentaLiquidacion.
 * transaction ya iniciada; idEmpresa e idUsuario del JWT.
 * @param {object} transaction - Transacción SQL
 * @param {object} pool - Pool SQL (para obtener vale y detalle)
 * @param {string} idEmpresa - UUID empresa
 * @param {string} idUsuario - UUID usuario
 * @param {{ idValeDespacho: string, idComprobante: number }} payload - idComprobante = Factura o Boleta (elegido por usuario)
 * @returns {{ idVenta: number, compVenta: string }}
 */
exports.crearVentaDesdeVale = async (transaction, pool, idEmpresa, idUsuario, payload) => {
  const { idValeDespacho, idComprobante } = payload;
  if (!idValeDespacho || idComprobante == null) {
    throw new Error('Faltan idValeDespacho o idComprobante (Factura/Boleta).');
  }

  const vale = await valesDespachoRepository.obtenerPorId(pool, idValeDespacho, idEmpresa);
  if (!vale) throw new Error('Vale de despacho no encontrado.');
  if (String(vale.estado || '').toUpperCase() === 'ANULADO') {
    throw new Error('No se puede liquidar un vale anulado.');
  }
  if (vale.idVentaLiquidacion != null) {
    throw new Error('El vale ya fue liquidado.');
  }

  const detalleVale = await valesDespachoRepository.listarDetalle(pool, idValeDespacho, idEmpresa);
  if (!detalleVale || detalleVale.length === 0) {
    throw new Error('El vale no tiene detalle.');
  }

  const { numero, serie } = await ventasRepository.obtenerSiguienteNumeroComprobante(transaction, idEmpresa, idComprobante);
  const compVenta = serie + '-' + numero;
  const totalVenta = detalleVale.reduce((sum, d) => sum + (Number(d.total) || 0), 0);
  const fEmision = getNowLocalSQLString();

  const datosVenta = {
    idSucursal: vale.idSucursal,
    serie,
    numero,
    compVenta,
    idComprobante,
    fEmision,
    fVencimiento: fEmision,
    idCliente: vale.idCliente,
    idMoneda: 1,
    tCambio: 1,
    subtotal: totalVenta,
    igv: 0,
    exonerado: 0,
    gratuito: 0,
    otrosCargos: 0,
    descuentos: 0,
    total: totalVenta,
    idMediosPago: '1',
    idEstadoPedido: 2,
    idEstadoPago: 1,
    idEstadoSunat: 0,
    compRelacionado: vale.compVale || null,
    idUsuario
  };

  const ventaResult = await ventasRepository.insertar(transaction, datosVenta, idEmpresa, idUsuario);
  const idVenta = ventaResult.recordset[0].idVenta;

  for (const d of detalleVale) {
    const cantidad = Number(d.cantidad) || 0;
    const pVenta = Number(d.pUnitario) || 0;
    const subtotal = cantidad * pVenta;
    await detalleVentaService.crearDetalle(transaction, {
      idVenta,
      idProducto: d.idProducto,
      cantidad,
      pVenta,
      descuento: 0,
      subtotal,
      igv: 0,
      isc: 0,
      total: subtotal,
      hVenta: fEmision,
      cantEntregada: cantidad,
      idEstadoPedido: 2,
      costoUnitario: 0,
      costoTotal: 0
    });
  }

  await facturacionRepository.registrarComprobanteElectronicoPorVentaRepo(
    transaction,
    idEmpresa,
    idVenta,
    idComprobante,
    serie,
    numero,
    fEmision
  );

  await valesDespachoRepository.actualizarVentaLiquidacion(transaction, idValeDespacho, idEmpresa, idVenta);

  return { idVenta, compVenta };
};
