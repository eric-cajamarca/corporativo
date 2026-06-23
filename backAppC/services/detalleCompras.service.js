const sql = require('mssql');
const detalleComprasRepository = require('../repositories/detalleCompras.repository');
const ubicacionesPrioridadRepository = require('../repositories/ubicacionesPrioridad.repository');
const conteoFisicoRepository = require('../repositories/conteoFisico.repository');
const productoInventarioMetaService = require('./productoInventarioMeta.service');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');

async function obtenerDetallePorCompra(pool, user, idCompra) {
  if (!user) throw new Error('NO_AUTH');
  await assertAlgunoPermiso(pool, user, 'VER_COMPRAS', 'CREAR_COMPRAS', 'EDITAR_COMPRAS');
  return detalleComprasRepository.listarPorCompra(pool, user.empresa, idCompra);
}

async function crearDetalleCompraCompleto(pool, user, body) {
  if (!user) throw new Error('NO_AUTH');
  await assertAlgunoPermiso(pool, user, 'CREAR_COMPRAS', 'EDITAR_COMPRAS', 'GESTIONAR_LOTES');
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
  const rawUbDest = body.idUbicacionDestino ?? body.idUbicacionCompra;
  const idUbExplicita =
    rawUbDest != null && String(rawUbDest).trim() !== '' ? parseInt(String(rawUbDest), 10) : NaN;
  const tieneUbicacionExplicita = Number.isFinite(idUbExplicita) && idUbExplicita > 0;

  let idUbicacionDefault = null;
  if (asignarUbicacionDefecto && !tieneUbicacionExplicita) {
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

    let ingresaStock;
    if (idPresentacion != null && idPresentacion !== '') {
      ingresaStock = await productoInventarioMetaService.controlaInventarioPorIdPresentacion(
        transaction,
        idPresentacion
      );
    } else {
      const metaProd = await productoInventarioMetaService.obtenerMeta(transaction, idEmpresa, idProducto);
      ingresaStock = metaProd.controlaInventario;
    }

    let numeroLote = null;
    let idLote = null;
    let idUbParaLote = null;
    if (ingresaStock) {
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
      idLote = await detalleComprasRepository.insertarLote(transaction, {
        idEmpresa,
        idProducto,
        idSucursal,
        costoUnitario: pUnitarioFormateado,
        cantidadIngresada: cantidadVal,
        cantidadDisponible: cantidadVal,
        fechaVencimiento: fechaVencimientoVal,
        numeroLote
      });
      if (tieneUbicacionExplicita) {
        const okUb = await conteoFisicoRepository.validarUbicacionPerteneceSucursal(
          transaction,
          idSucursal,
          idUbExplicita
        );
        if (!okUb) {
          throw new Error('La ubicación de ingreso no pertenece a la sucursal del detalle');
        }
        idUbParaLote = idUbExplicita;
      } else if (asignarUbicacionDefecto && idUbicacionDefault) {
        idUbParaLote = idUbicacionDefault;
      }
      if (idLote && idUbParaLote != null) {
        await detalleComprasRepository.insertarLoteUbicacion(
          transaction,
          idLote,
          idUbParaLote,
          Math.round(cantidadVal)
        );
      }
    }

    await transaction.commit();
    const viaPrioridad1 = asignarUbicacionDefecto && !tieneUbicacionExplicita && idUbParaLote != null;
    return {
      numeroLote,
      idLote,
      asignarUbicacionDefecto: viaPrioridad1,
      ubicacionAsignada: idUbParaLote != null
    };
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
  await assertAlgunoPermiso(pool, user, 'EDITAR_COMPRAS');
  return detalleComprasRepository.eliminarPorCompra(pool, idCompra);
}

module.exports = {
  obtenerDetallePorCompra,
  crearDetalleCompraCompleto,
  crearDetalleInterno,
  actualizarDetalleInterno,
  eliminarDetallePorCompra
};
