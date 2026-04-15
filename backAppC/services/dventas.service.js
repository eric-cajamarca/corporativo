const dventasRepository = require('../repositories/dventas.repository');
const stockRepository = require('../repositories/stock.repository');
const inventarioRepository = require('../repositories/inventario.repository');
const sql = require('mssql');
const { idUsuarioDesdePayloadUser } = require('../utils/idUsuarioSesion.util');

async function obtenerDetalleVentas(pool, idEmpresa) {
  return dventasRepository.listarDetalleVentaPorEmpresa(pool, idEmpresa);
}

async function obtenerDetalleVentaPorCompDestino(pool, compVentas, destino) {
  return dventasRepository.obtenerDetalleVentasPorCompDestino(pool, compVentas, destino);
}

async function actualizarDetalleVentaLote(pool, user, data) {
  if (!user) {
    throw new Error('NO_AUTH');
  }
  if (!Array.isArray(data)) {
    throw new Error('INVALID_FORMAT');
  }
  let estado;
  let mensaje = '';
  let contador = 0;
  for (const registro of data) {
    const id = parseInt(registro.Id, 10);
    const cantEntregadoRegistro = parseFloat(registro.CantEntregado);
    const cantidadActual = parseInt(registro.Cantidad, 10);
    const cantBD = await dventasRepository.obtenerCantEntregado(pool, id);
    const cantEntregadoBD = cantBD != null ? Number(cantBD) : 0;
    const sumaTotal = cantEntregadoBD + cantEntregadoRegistro;
    if (sumaTotal <= cantidadActual) {
      const r = await dventasRepository.actualizarCantEntregado(pool, id, sumaTotal);
      estado = r;
      mensaje = 'Registros actualizados correctamente';
    } else {
      contador++;
      if (contador === data.length) {
        estado = undefined;
        mensaje = 'La cantidad que deseas registrar es mayor a la cantidad comprada';
      }
    }
  }
  return { mensaje, estado };
}

async function eliminarDetalleVenta(pool, user, idDetalle) {
  const idEmpresa = user?.empresa || user?.idEmpresa;
  if (!idEmpresa) {
    throw new Error('NO_EMPRESA');
  }
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const row = await dventasRepository.obtenerFilaDetalleParaEliminar(transaction, idDetalle, idEmpresa);
    if (!row) {
      await transaction.rollback();
      return { notFound: true };
    }
    if (row.eliminado) {
      await transaction.rollback();
      return { anulada: true };
    }
    const cod = String(row.codigoComprobante || '').trim().toUpperCase();
    const esNv = cod === 'NV';
    if (!esNv && (row.idEstadoSunat === 1 || row.idEstadoSunat === 2 || row.idEstadoSunat === 3)) {
      await transaction.rollback();
      return { sunatBloqueo: true };
    }
    const cant = parseFloat(row.cantidad) || 0;
    if (cant > 0 && row.idProducto) {
      await stockRepository.restaurarStockEnLotes(transaction, {
        idEmpresa,
        idSucursal: row.idSucursal,
        idProducto: row.idProducto,
        cantidad: cant
      });
      const idUsuarioMov = row.idUsuario || idUsuarioDesdePayloadUser(user);
      if (idUsuarioMov) {
        await inventarioRepository.insertarFilaMovimiento(transaction, {
          idEmpresa,
          idSucursal: row.idSucursal,
          idProducto: row.idProducto,
          tipoMovimiento: 'EN',
          cantidad: cant,
          docRelacionado: row.compVenta,
          idComprobante: row.idComprobante,
          idUsuario: idUsuarioMov,
          observaciones: 'Eliminación de línea de venta — devolución de stock',
          costoUnitario: row.costoUnitario != null ? Number(row.costoUnitario) : 0,
          idLote: null
        });
      }
    }
    await dventasRepository.eliminarDetalleVentaPorId(transaction, idDetalle);
    await transaction.commit();
    return { ok: true };
  } catch (inner) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw inner;
  }
}

module.exports = {
  obtenerDetalleVentas,
  obtenerDetalleVentaPorCompDestino,
  actualizarDetalleVentaLote,
  eliminarDetalleVenta
};
