const sql = require('mssql');
const detalleComprasRepository = require('../repositories/detalleCompras.repository');
const productosRepository = require('../repositories/productos.repository');
const ubicacionesPrioridadRepository = require('../repositories/ubicacionesPrioridad.repository');
const conteoFisicoRepository = require('../repositories/conteoFisico.repository');
const productoInventarioMetaService = require('./productoInventarioMeta.service');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');

async function obtenerDetallePorCompra(pool, user, idCompra) {
  if (!user) throw new Error('NO_AUTH');
  await assertAlgunoPermiso(pool, user, 'VER_COMPRAS', 'CREAR_COMPRAS', 'EDITAR_COMPRAS');
  const rows = await detalleComprasRepository.listarPorCompra(pool, user.empresa, idCompra);
  return (rows || []).map((r) => ({
    idDetalleCompra: r.idDetalleCompra,
    idEmpresa: r.idEmpresa,
    idSucursal: r.idSucursal,
    idCompra: r.idCompra,
    cantidad: r.cantidad,
    idProducto: r.idProducto,
    idPresentacion: r.idPresentacion,
    pUnitario: r.pUnitario,
    cUnitario: r.pUnitario,
    total: r.total,
    subtotal: r.total,
    idUsuario: r.idUsuario,
    codigo: r.codigo || '',
    descripcion: r.descripcion || '',
    fProduccion: r.fProduccion || null,
    fVencimiento: r.fVencimiento || null,
    idCategoria: r.idCategoria,
    idMarca: r.idMarca,
    categoria: r.categoriaNombre ? { idCategoria: r.idCategoria, nombre: r.categoriaNombre } : undefined,
    marca: r.marcaNombre ? { idMarca: r.idMarca, nombre: r.marcaNombre } : undefined,
    presentacion: {
      idPresentacion: r.idPresentacion,
      codigo: r.presentacionCodigo || '',
      Descripcion: r.presentacionDescripcion || '',
      descripcion: r.presentacionDescripcion || ''
    },
    sucursal: r.sucursalNombre
      ? { idSucursal: r.idSucursal, nombre: r.sucursalNombre }
      : undefined,
    producto: r.idProducto
      ? {
          idProducto: r.idProducto,
          Codigo: r.codigo || '',
          codigo: r.codigo || '',
          descripcion: r.descripcion || '',
          idCategoria: r.idCategoria,
          idMarca: r.idMarca,
          idPresentacion: r.idPresentacion,
          fProduccion: r.fProduccion || null,
          fVencimiento: r.fVencimiento || null
        }
      : undefined
  }));
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

    // Precios de venta lee Productos.cUnitario; sincronizar con el último costo de compra.
    if (pUnitarioFormateado > 0) {
      await productosRepository.actualizarCUnitarioDesdeCompra(
        transaction,
        idEmpresa,
        idProducto,
        pUnitarioFormateado
      );
    }

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
