const sql = require('mssql');
const detalleComprasRepository = require('../repositories/detalleCompras.repository');
const ubicacionesPrioridadRepository = require('../repositories/ubicacionesPrioridad.repository');

async function obtenerDetallePorCompra(pool, user, idCompra) {
  if (!user) throw new Error('NO_AUTH');
  if (user.rol !== 'Administrador') throw new Error('NO_PERM');
  return detalleComprasRepository.listarPorCompra(pool, user.empresa, idCompra);
}

async function crearDetalleCompraCompleto(pool, user, body) {
  if (!user) throw new Error('NO_AUTH');
  if (user.rol !== 'Administrador' && user.rol !== 'Almacenero') throw new Error('NO_PERM');
  const {
    idSucursal,
    idCompra,
    cantidad,
    idProducto,
    idPresentacion,
    pUnitario,
    total,
    fechaVencimiento,
    asignarPorDefecto
  } = body;
  const idUsuario = user.sub || user.idUsuario;
  const idEmpresa = user.empresa;
  const pUnitarioFormateado = parseFloat(pUnitario) || 0;
  const cantidadVal = parseFloat(cantidad) || 0;
  const totalVal = parseFloat(total) || 0;
  const fechaVencimientoVal = fechaVencimiento || null;
  const asignarUbicacionDefecto = asignarPorDefecto !== false;
  let idUbicacionDefault = null;
  if (asignarUbicacionDefecto) {
    idUbicacionDefault = await ubicacionesPrioridadRepository.getOrCreateDefaultForSucursal(idSucursal);
  }
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await detalleComprasRepository.insertarDetalle(transaction, {
      idEmpresa,
      idSucursal,
      idCompra,
      cantidad: cantidadVal,
      idProducto,
      idPresentacion,
      pUnitario: pUnitarioFormateado,
      total: totalVal,
      idUsuario
    });
    let numeroLote = null;
    try {
      numeroLote = await detalleComprasRepository.obtenerNumeroLoteCompra(transaction, idCompra);
    } catch (_) {
      numeroLote = null;
    }
    if (numeroLote == null) {
      numeroLote = await detalleComprasRepository.obtenerSiguienteNumeroLote(transaction, idEmpresa);
      try {
        await detalleComprasRepository.actualizarNumeroLoteCompra(transaction, idCompra, numeroLote);
      } catch (_) {}
    } else {
      numeroLote = String(numeroLote);
    }
    const idLote = await detalleComprasRepository.insertarLote(transaction, {
      idEmpresa,
      idProducto,
      idSucursal,
      costoUnitario: pUnitarioFormateado,
      cantidadIngresada: cantidadVal,
      cantidadDisponible: cantidadVal,
      fechaVencimiento: fechaVencimientoVal,
      numeroLote
    });
    if (asignarUbicacionDefecto && idLote && idUbicacionDefault) {
      await detalleComprasRepository.insertarLoteUbicacion(
        transaction,
        idLote,
        idUbicacionDefault,
        Math.round(cantidadVal)
      );
    }
    await transaction.commit();
    return { numeroLote, idLote, asignarUbicacionDefecto };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function crearDetalleInterno(pool, detalle) {
  await detalleComprasRepository.insertarDetallePool(pool, detalle);
}

async function actualizarDetalleInterno(pool, detalle) {
  await detalleComprasRepository.actualizarDetalle(pool, detalle);
}

async function eliminarDetallePorCompra(pool, user, idCompra) {
  if (!user) throw new Error('NO_AUTH');
  if (user.rol !== 'Administrador') throw new Error('NO_PERM');
  return detalleComprasRepository.eliminarPorCompra(pool, idCompra);
}

module.exports = {
  obtenerDetallePorCompra,
  crearDetalleCompraCompleto,
  crearDetalleInterno,
  actualizarDetalleInterno,
  eliminarDetallePorCompra
};
