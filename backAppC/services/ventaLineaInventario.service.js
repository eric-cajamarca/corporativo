const stockService = require('./stock.service');
const productoInventarioMetaService = require('./productoInventarioMeta.service');
const inventarioRepository = require('../repositories/inventario.repository');
const productoUnidadVentaService = require('./productoUnidadVenta.service');

/**
 * Salida de inventario al vender una línea.
 * Servicios (presentación ZZ): sin stock; costo = cUnitario del producto × cantidad.
 */
async function procesarSalidaInventarioVentaLinea(params) {
  const {
    transaction,
    idEmpresa,
    idSucursal,
    idProducto,
    cantPedida,
    idUnidadVenta,
    cantidadStockForzada,
    descripcion,
    permitirVentasNegativas,
    controlUbicaciones,
    cache,
    mensajeStockInsuficiente
  } = params;

  const cantComercial = parseFloat(cantPedida) || 0;
  const cant =
    cantidadStockForzada != null && Number.isFinite(Number(cantidadStockForzada))
      ? Number(cantidadStockForzada)
      : await productoUnidadVentaService.resolverCantidadStock(
          transaction,
          idEmpresa,
          idProducto,
          idUnidadVenta,
          cantComercial
        );
  const meta = await productoInventarioMetaService.obtenerMeta(transaction, idEmpresa, idProducto, cache);

  if (!meta.controlaInventario) {
    const costoU = meta.cUnitario;
    return {
      controlaInventario: false,
      consumosPorLote: [],
      costoTotalLinea: cantComercial * costoU,
      costoUnitarioProm: costoU,
      avisoStock: null,
      cantidadADescontar: 0
    };
  }

  const stockDisponible = await stockService.obtenerStockDisponible(
    transaction,
    idEmpresa,
    idProducto,
    idSucursal
  );

  let avisoStock = null;
  if (stockDisponible < cant) {
    if (!permitirVentasNegativas) {
      const etiqueta = descripcion || idProducto;
      const extra =
        typeof mensajeStockInsuficiente === 'function'
          ? mensajeStockInsuficiente(stockDisponible, cant)
          : mensajeStockInsuficiente;
      throw new Error(
        extra ||
          `Stock insuficiente para "${etiqueta}". Disponible: ${stockDisponible}, solicitado: ${cant}.`
      );
    }
    avisoStock = {
      idProducto,
      cantidadSolicitada: cant,
      cantidadDisponible: stockDisponible
    };
  }

  const cantidadADescontar = cant;
  let consumosPorLote = [];
  if (cantidadADescontar > 0) {
    const resultadoDescuento = await stockService.descontarDesdeLotes(
      transaction,
      { idEmpresa, idSucursal, idProducto, cantidad: cantidadADescontar },
      { controlUbicaciones, permitirVentasNegativas }
    );
    consumosPorLote = resultadoDescuento?.consumosPorLote || [];
  }

  const costoTotalLinea = Array.isArray(consumosPorLote)
    ? consumosPorLote.reduce(
        (acc, c) => acc + (Number(c.cantidadTomada) || 0) * (Number(c.costoUnitario) || 0),
        0
      )
    : 0;
  const costoUnitarioProm = cantComercial > 0 ? costoTotalLinea / cantComercial : 0;

  return {
    controlaInventario: true,
    consumosPorLote,
    costoTotalLinea,
    costoUnitarioProm,
    avisoStock,
    cantidadADescontar
  };
}

async function registrarMovimientosSalidaVenta(params) {
  const {
    transaction,
    idEmpresa,
    idSucursal,
    idProducto,
    idUsuario,
    compVenta,
    idComprobante,
    controlaInventario,
    cantidadADescontar,
    consumosPorLote,
    costoUnitarioProm,
    observaciones
  } = params;
  const obs = observaciones || 'Venta';

  if (!controlaInventario || !cantidadADescontar || cantidadADescontar <= 0 || !idUsuario) {
    return;
  }

  if (Array.isArray(consumosPorLote) && consumosPorLote.length > 0) {
    for (const c of consumosPorLote) {
      const cantTomada = Number(c.cantidadTomada) || 0;
      if (cantTomada <= 0) continue;
      await inventarioRepository.insertarFilaMovimiento(transaction, {
        idEmpresa,
        idSucursal,
        idProducto,
        tipoMovimiento: 'SA',
        cantidad: cantTomada,
        docRelacionado: compVenta,
        idComprobante,
        idUsuario,
        observaciones: obs,
        costoUnitario: c.costoUnitario != null ? Number(c.costoUnitario) : costoUnitarioProm,
        idLote: c.idLote || null
      });
    }
    return;
  }

  await inventarioRepository.insertarFilaMovimiento(transaction, {
    idEmpresa,
    idSucursal,
    idProducto,
    tipoMovimiento: 'SA',
    cantidad: cantidadADescontar,
    docRelacionado: compVenta,
    idComprobante,
    idUsuario,
    observaciones: obs,
    costoUnitario: costoUnitarioProm,
    idLote: null
  });
}

module.exports = {
  procesarSalidaInventarioVentaLinea,
  registrarMovimientosSalidaVenta
};
