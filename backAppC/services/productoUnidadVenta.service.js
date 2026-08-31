const productoUnidadVentaRepository = require('../repositories/productoUnidadVenta.repository');
const ProductosRepository = require('../repositories/productos.repository');
const gestoresRepository = require('../repositories/gestores.repository');
const { interpretarBooleanoConfig } = require('../utils/configBoolean.util');
const { cantidadStockDesdeFactores, resolverFactorEnvase } = require('../utils/unidadVenta.util');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(valor, etiqueta) {
  if (!valor || !UUID_RE.test(String(valor).trim())) {
    throw new Error(`${etiqueta} inválido`);
  }
  return String(valor).trim();
}

async function empresaUsaConversion(executor, idEmpresa) {
  const lista = await gestoresRepository.obtenerConfiguracionEmpresa(executor, idEmpresa);
  const item = (lista || []).find((c) => String(c.clave || '').trim().toUpperCase() === 'VENTAS_USAR_CONVERSION_UNIDADES');
  return interpretarBooleanoConfig(item?.valor, false);
}

async function obtenerPorProducto(pool, idEmpresa, idProducto) {
  assertUuid(idEmpresa, 'Empresa');
  assertUuid(idProducto, 'Producto');
  const producto = await ProductosRepository.obtenerProductoPorIdRepo(pool, idProducto, idEmpresa);
  if (!producto) {
    throw new Error('Producto no encontrado');
  }
  const conversion = await productoUnidadVentaRepository.obtenerConversion(pool, idEmpresa, idProducto);
  const unidades = conversion
    ? await productoUnidadVentaRepository.listarUnidades(pool, idEmpresa, idProducto)
    : [];
  const precioPrincipal = await productoUnidadVentaRepository.obtenerPrecioPrincipal(
    pool,
    idEmpresa,
    idProducto
  );
  return {
    conversion: conversion || null,
    unidades,
    precioPrincipal
  };
}

function agruparUnidadesPorProducto(rows) {
  const mapa = new Map();
  for (const row of rows || []) {
    const id = String(row.idProducto).toLowerCase();
    if (!mapa.has(id)) {
      mapa.set(id, {
        unidadInternaNombre: row.unidadInternaNombre,
        factorCompraAInterna: Number(row.factorCompraAInterna),
        unidadesVenta: []
      });
    }
    if (row.visibleEnPos === false || row.visibleEnPos === 0) continue;
    mapa.get(id).unidadesVenta.push({
      idUnidadVenta: row.idUnidadVenta,
      nombre: row.nombre,
      factorAInterna: Number(row.factorAInterna),
      precio: row.precio != null ? Number(row.precio) : null,
      orden: Number(row.orden) || 0
    });
  }
  return mapa;
}

async function adjuntarUnidadesAProductos(pool, idEmpresa, productos) {
  if (!Array.isArray(productos) || productos.length === 0) return productos;
  const usa = await empresaUsaConversion(pool, idEmpresa);
  if (!usa) return productos;
  const ids = productos.map((p) => p.idProducto).filter(Boolean);
  let rows = [];
  try {
    rows = await productoUnidadVentaRepository.listarUnidadesPorProductos(pool, ids);
  } catch (error) {
    console.error('productoUnidadVenta.adjuntarUnidadesAProductos:', error);
    return productos;
  }
  const mapa = agruparUnidadesPorProducto(rows);
  return productos.map((p) => {
    const extra = mapa.get(String(p.idProducto).toLowerCase());
    if (!extra || !extra.unidadesVenta.length) return p;
    return { ...p, ...extra };
  });
}

async function resolverCantidadStock(executor, idEmpresa, idProducto, idUnidadVenta, cantidadComercial) {
  const cant = Number(cantidadComercial) || 0;
  if (!idUnidadVenta) return cant;
  assertUuid(idUnidadVenta, 'Unidad de venta');
  const conversion = await productoUnidadVentaRepository.obtenerConversion(executor, idEmpresa, idProducto);
  const unidad = await productoUnidadVentaRepository.obtenerUnidad(executor, idEmpresa, idProducto, idUnidadVenta);
  if (!conversion || !conversion.activo || !unidad) {
    throw new Error('Unidad de venta inválida para este producto');
  }
  const unidades = await productoUnidadVentaRepository.listarUnidades(executor, idEmpresa, idProducto);
  const factorEnvase = resolverFactorEnvase(conversion.factorCompraAInterna, unidades);
  return cantidadStockDesdeFactores(cant, unidad.factorAInterna, factorEnvase);
}

async function guardar(pool, idEmpresa, idProducto, body) {
  assertUuid(idEmpresa, 'Empresa');
  assertUuid(idProducto, 'Producto');
  const producto = await ProductosRepository.obtenerProductoPorIdRepo(pool, idProducto, idEmpresa);
  if (!producto) {
    throw new Error('Producto no encontrado');
  }

  if (body?.activo === false) {
    const transaction = new (require('mssql').Transaction)(pool);
    await transaction.begin();
    try {
      await productoUnidadVentaRepository.desactivarConversion(transaction, idEmpresa, idProducto);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    return { conversion: null, unidades: [] };
  }

  const unidadInternaNombre = String(body?.unidadInternaNombre || '').trim();
  const factorCompraAInterna = Number(body?.factorCompraAInterna);
  if (!unidadInternaNombre) {
    throw new Error('Indique el nombre de la unidad interna (ej. 1/32 de galón)');
  }
  if (!Number.isFinite(factorCompraAInterna) || factorCompraAInterna <= 0) {
    throw new Error('El factor del envase de compra debe ser mayor a 0');
  }

  const unidadesIn = Array.isArray(body?.unidades) ? body.unidades : [];
  if (unidadesIn.length === 0) {
    throw new Error('Agregue al menos una unidad de venta');
  }
  if (unidadesIn.length > 20) {
    throw new Error('Máximo 20 unidades de venta por producto');
  }

  let factorEnvase = factorCompraAInterna;
  const hayGramo = unidadesIn.some((u) => /gramo/i.test(String(u?.nombre || '')));
  const maxFactor = unidadesIn.reduce((acc, u) => {
    const f = Number(u?.factorAInterna);
    return Number.isFinite(f) && f > acc ? f : acc;
  }, 0);
  if (hayGramo && factorEnvase <= 1 && maxFactor > 1) {
    factorEnvase = maxFactor;
  }

  const unidadesNorm = unidadesIn.map((u, i) => {
    const nombre = String(u?.nombre || '').trim();
    const factorAInterna = Number(u?.factorAInterna);
    const precio = u?.precio == null || u?.precio === '' ? null : Number(u.precio);
    if (!nombre) {
      throw new Error(`Fila ${i + 1}: indique el nombre de la unidad`);
    }
    if (!Number.isFinite(factorAInterna) || factorAInterna <= 0) {
      throw new Error(`Fila ${i + 1}: el factor debe ser mayor a 0`);
    }
    if (precio != null && (!Number.isFinite(precio) || precio < 0)) {
      throw new Error(`Fila ${i + 1}: precio inválido`);
    }
    return {
      nombre: nombre.slice(0, 50),
      factorAInterna,
      precio,
      visibleEnPos: u?.visibleEnPos !== false,
      orden: Number.isFinite(Number(u?.orden)) ? Number(u.orden) : i
    };
  });

  const sql = require('mssql');
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await productoUnidadVentaRepository.guardarConversion(transaction, {
      idEmpresa,
      idProducto,
      unidadInternaNombre: unidadInternaNombre.slice(0, 50),
      factorCompraAInterna: factorEnvase,
      activo: true
    });
    await productoUnidadVentaRepository.eliminarUnidadesProducto(transaction, idEmpresa, idProducto);
    for (const u of unidadesNorm) {
      await productoUnidadVentaRepository.insertarUnidad(transaction, {
        idEmpresa,
        idProducto,
        ...u
      });
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  return obtenerPorProducto(pool, idEmpresa, idProducto);
}

module.exports = {
  empresaUsaConversion,
  obtenerPorProducto,
  adjuntarUnidadesAProductos,
  resolverCantidadStock,
  guardar
};
