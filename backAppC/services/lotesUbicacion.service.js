const lotesUbicacionRepository = require('../repositories/lotesUbicacion.repository');
const lotesRepository = require('../repositories/lotes.repository');
const { withPool } = require('../utils/dbPool.util');
const { idsEmpresaGestoraConsolidados, assertEmpresaAutorizada } = require('../utils/empresaGestora.util');

async function getByLote(idLote) {
  return await lotesUbicacionRepository.getByLote(idLote);
}

async function getByUbicacion(idUbicacion) {
  return await lotesUbicacionRepository.getByUbicacion(idUbicacion);
}

async function create(idLote, idUbicacion, cantidad) {
  return await lotesUbicacionRepository.create(idLote, idUbicacion, cantidad);
}

async function updateCantidad(idLote, idUbicacion, cantidad) {
  return await lotesUbicacionRepository.updateCantidad(idLote, idUbicacion, cantidad);
}

async function deleted(idLote, idUbicacion) {
  return await lotesUbicacionRepository.deleted(idLote, idUbicacion);
}

async function aplicarDescuentoPorPrioridad(idProducto, idSucursal, cantidadVender) {
  const ubicaciones = await lotesUbicacionRepository.getUbicacionesDisponiblesPrioridad(
    idProducto,
    idSucursal
  );
  let cantidadRestante = cantidadVender;
  const movimientos = [];

  for (const ubicacion of ubicaciones) {
    if (cantidadRestante <= 0) break;

    const cantidadTomar = Math.min(cantidadRestante, ubicacion.cantidad);
    movimientos.push({
      idLote: ubicacion.idLote,
      idUbicacion: ubicacion.idUbicacion,
      cantidad: cantidadTomar
    });

    cantidadRestante -= cantidadTomar;
  }

  if (cantidadRestante > 0) {
    throw new Error('Stock insuficiente en todas las ubicaciones');
  }

  return movimientos;
}

async function buscarProductosTraslado(user, query) {
  if (!user || !user.empresa) {
    throw new Error('NO_AUTH');
  }
  return withPool(async (pool) => {
    const ids = await idsEmpresaGestoraConsolidados(pool, user.empresa);
    const esGestora = ids.length > 1;
    let idSucursal =
      query.idSucursal != null && String(query.idSucursal).trim()
        ? String(query.idSucursal).trim()
        : null;
    if (idSucursal) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(idSucursal)) {
        idSucursal = null;
      }
    }
    const restringirSucursal =
      !esGestora &&
      String(query.restringirSucursal ?? 'true').trim().toLowerCase() !== 'false' &&
      !!idSucursal;
    const items = await lotesUbicacionRepository.buscarProductosConStockUbicacion(pool, ids, {
      buscar: query.buscar || null,
      idSucursal: restringirSucursal ? idSucursal : null
    });
    return { items, alcanceGestora: esGestora };
  });
}

async function listarLotesTrasladables(user, idProducto, query) {
  if (!user || !user.empresa) {
    throw new Error('NO_AUTH');
  }
  return withPool(async (pool) => {
    const idProd = String(idProducto || '').trim();
    const rowEmpresa = await pool
      .request()
      .input('idProducto', require('mssql').UniqueIdentifier, idProd)
      .query('SELECT TOP 1 idEmpresa FROM Productos WHERE idProducto = @idProducto');
    const idEmpresaProducto =
      rowEmpresa.recordset && rowEmpresa.recordset[0]
        ? rowEmpresa.recordset[0].idEmpresa
        : null;
    if (!idEmpresaProducto) {
      throw new Error('Producto no encontrado');
    }
    await assertEmpresaAutorizada(pool, user.empresa, idEmpresaProducto);
    const ids = await idsEmpresaGestoraConsolidados(pool, user.empresa);
    const esGestora = ids.length > 1;
    let idSucursal =
      query.idSucursal != null && String(query.idSucursal).trim()
        ? String(query.idSucursal).trim()
        : null;
    if (idSucursal) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(idSucursal)) {
        idSucursal = null;
      }
    }
    const restringirSucursal =
      !esGestora &&
      String(query.restringirSucursal ?? 'true').trim().toLowerCase() !== 'false' &&
      !!idSucursal;
    const lotes = await lotesUbicacionRepository.listarLotesTrasladablesPorProducto(
      pool,
      idEmpresaProducto,
      idProd,
      restringirSucursal ? idSucursal : null
    );
    return { lotes, idEmpresa: idEmpresaProducto };
  });
}

async function trasladoEntreUbicaciones(user, body) {
  if (!user || !user.empresa) {
    throw new Error('NO_AUTH');
  }
  const idLote = body && body.idLote ? String(body.idLote).trim() : '';
  const idUbicacionOrigen = body && body.idUbicacionOrigen;
  const idUbicacionDestino = body && body.idUbicacionDestino;
  const cantidad = body && body.cantidad;
  if (!idLote) {
    throw new Error('idLote es requerido');
  }

  return withPool(async (pool) => {
    const lote = await lotesRepository.getById(idLote);
    if (!lote || !lote.idEmpresa) {
      throw new Error('Lote no encontrado');
    }
    await assertEmpresaAutorizada(pool, user.empresa, lote.idEmpresa);
    const resultado = await lotesUbicacionRepository.trasladoEntreUbicaciones(
      pool,
      idLote,
      idUbicacionOrigen,
      idUbicacionDestino,
      cantidad
    );
    return resultado;
  });
}

module.exports = {
  getByLote,
  getByUbicacion,
  create,
  updateCantidad,
  deleted,
  aplicarDescuentoPorPrioridad,
  buscarProductosTraslado,
  listarLotesTrasladables,
  trasladoEntreUbicaciones
};
