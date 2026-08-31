const sql = require('mssql');
const formulaMatizadoRepository = require('../repositories/formulaMatizado.repository');
const productoUnidadVentaRepository = require('../repositories/productoUnidadVenta.repository');
const ProductosRepository = require('../repositories/productos.repository');
const ventaLineaInventarioService = require('./ventaLineaInventario.service');
const { cantidadStockDesdeGramos, formatearCantidad, resolverFactorEnvase } = require('../utils/unidadVenta.util');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(valor, etiqueta) {
  if (!valor || !UUID_RE.test(String(valor).trim())) {
    throw new Error(`${etiqueta} inválido`);
  }
  return String(valor).trim();
}

function normalizarTintes(tintes) {
  if (!Array.isArray(tintes) || tintes.length === 0) {
    throw new Error('Indique al menos un tinte con gramos');
  }
  const seen = new Set();
  return tintes.map((t, i) => {
    const idProductoTinte = assertUuid(t.idProductoTinte || t.idProducto, `Tinte ${i + 1}`);
    const gramos = Number(t.gramos);
    if (!Number.isFinite(gramos) || gramos <= 0) {
      throw new Error(`Tinte ${i + 1}: los gramos deben ser mayores a 0`);
    }
    const key = idProductoTinte.toLowerCase();
    if (seen.has(key)) {
      throw new Error('Hay tintes duplicados en la fórmula');
    }
    seen.add(key);
    return { idProductoTinte, gramos };
  });
}

async function listar(pool, idEmpresa, filtros) {
  assertUuid(idEmpresa, 'Empresa');
  return formulaMatizadoRepository.listar(pool, idEmpresa, filtros || {});
}

async function obtener(pool, idEmpresa, idFormula) {
  assertUuid(idEmpresa, 'Empresa');
  assertUuid(idFormula, 'Fórmula');
  const formula = await formulaMatizadoRepository.obtenerPorId(pool, idEmpresa, idFormula);
  if (!formula) {
    throw new Error('Fórmula no encontrada');
  }
  return formula;
}

async function guardarFormula(executor, idEmpresa, idUsuario, body) {
  const nombre = String(body?.nombre || '').trim();
  if (!nombre) {
    throw new Error('Indique el nombre del color');
  }
  const tintes = normalizarTintes(body?.tintes || []);
  const factorEscalaRaw = Number(body?.factorEscala);
  const factorEscala =
    Number.isFinite(factorEscalaRaw) && factorEscalaRaw > 0 ? factorEscalaRaw : 1;

  const idProductoBase = body?.idProductoBase
    ? assertUuid(body.idProductoBase, 'Producto base')
    : null;
  if (idProductoBase) {
    const prod = await ProductosRepository.obtenerProductoPorIdRepo(executor, idProductoBase, idEmpresa);
    if (!prod) {
      throw new Error('Producto base no encontrado');
    }
  }

  for (const t of tintes) {
    const prod = await ProductosRepository.obtenerProductoPorIdRepo(executor, t.idProductoTinte, idEmpresa);
    if (!prod) {
      throw new Error('Un tinte no pertenece a su empresa');
    }
    const conv = await productoUnidadVentaRepository.obtenerConversion(executor, idEmpresa, t.idProductoTinte);
    if (!conv || !conv.activo) {
      throw new Error(`Configure conversión a gramos en "${prod.descripcion || prod.Codigo}" (1 pote = N gramos)`);
    }
  }

  const esTransaccion = typeof executor?.commit === 'function';
  const transaction = esTransaccion ? executor : new sql.Transaction(executor);
  if (!esTransaccion) {
    await transaction.begin();
  }
  try {
    let idFormula = body?.idFormula ? String(body.idFormula).trim() : null;
    const cab = {
      idEmpresa,
      idUsuario,
      nombre: nombre.slice(0, 80),
      marcaVehiculo: body?.marcaVehiculo ? String(body.marcaVehiculo).trim().slice(0, 50) : null,
      modeloVehiculo: body?.modeloVehiculo ? String(body.modeloVehiculo).trim().slice(0, 50) : null,
      placa: body?.placa ? String(body.placa).trim().toUpperCase().slice(0, 15) : null,
      idProductoBase,
      notas: body?.notas ? String(body.notas).trim().slice(0, 200) : null
    };
    if (idFormula) {
      assertUuid(idFormula, 'Fórmula');
      const existe = await formulaMatizadoRepository.obtenerPorId(transaction, idEmpresa, idFormula);
      if (!existe) {
        throw new Error('Fórmula no encontrada');
      }
      await formulaMatizadoRepository.actualizarCabecera(transaction, { ...cab, idFormula });
      await formulaMatizadoRepository.eliminarDetalles(transaction, idFormula);
    } else {
      idFormula = await formulaMatizadoRepository.insertar(transaction, cab);
    }
    for (const t of tintes) {
      const gramosPorGalon = Math.round((t.gramos / factorEscala) * 1e6) / 1e6;
      await formulaMatizadoRepository.insertarDetalle(transaction, idFormula, t.idProductoTinte, gramosPorGalon);
    }
    if (!esTransaccion) {
      await transaction.commit();
    }
    return idFormula;
  } catch (error) {
    if (!esTransaccion) {
      await transaction.rollback();
    }
    throw error;
  }
}

async function resolverStockDesdeGramos(executor, idEmpresa, idProductoTinte, gramos, etiqueta) {
  const conv = await productoUnidadVentaRepository.obtenerConversion(executor, idEmpresa, idProductoTinte);
  if (!conv || !conv.activo) {
    throw new Error(`Configure conversión a gramos en ${etiqueta || 'el tinte'} (1 pote = N gramos)`);
  }
  const unidades = await productoUnidadVentaRepository.listarUnidades(executor, idEmpresa, idProductoTinte);
  const gramosPorEnvase = resolverFactorEnvase(conv.factorCompraAInterna, unidades);
  if (!gramosPorEnvase) {
    throw new Error(`Configure conversión a gramos en ${etiqueta || 'el tinte'} (1 pote = N gramos)`);
  }
  const cantidadStock = cantidadStockDesdeGramos(gramos, conv.factorCompraAInterna, unidades);
  return { cantidadStock, gramosPorEnvase };
}

async function procesarEnVenta(params) {
  const {
    transaction,
    idEmpresa,
    idSucursal,
    idVenta,
    idProductoBase,
    idUsuario,
    factorEscala,
    matizado,
    permitirVentasNegativas,
    controlUbicaciones,
    cache,
    compVenta,
    idComprobante
  } = params;

  if (!matizado || !Array.isArray(matizado.tintes) || matizado.tintes.length === 0) {
    return null;
  }

  const escala = Number(factorEscala);
  if (!Number.isFinite(escala) || escala <= 0) {
    throw new Error('No se pudo escalar el matizado: la base no descontó stock');
  }

  const tintes = normalizarTintes(matizado.tintes);
  const nombreColor = matizado.nombreColor ? String(matizado.nombreColor).trim().slice(0, 80) : null;

  let idFormula = matizado.idFormula ? String(matizado.idFormula).trim() : null;
  if (matizado.guardarFormula) {
    idFormula = await guardarFormula(transaction, idEmpresa, idUsuario, {
      idFormula: idFormula && UUID_RE.test(idFormula) ? idFormula : null,
      nombre: nombreColor || 'Color sin nombre',
      marcaVehiculo: matizado.marcaVehiculo,
      modeloVehiculo: matizado.modeloVehiculo,
      placa: matizado.placa,
      idProductoBase,
      factorEscala: escala,
      tintes
    });
  }

  const idVentaMatizado = await formulaMatizadoRepository.insertarVentaMatizado(transaction, {
    idVenta,
    idEmpresa,
    idProductoBase,
    nombreColor,
    marcaVehiculo: matizado.marcaVehiculo ? String(matizado.marcaVehiculo).trim().slice(0, 50) : null,
    placa: matizado.placa ? String(matizado.placa).trim().toUpperCase().slice(0, 15) : null,
    factorEscala: escala,
    idFormula: idFormula && UUID_RE.test(idFormula) ? idFormula : null,
    cargoMatizado: matizado.cargoMatizado != null ? Number(matizado.cargoMatizado) : null
  });

  for (const t of tintes) {
    const prod = await ProductosRepository.obtenerProductoPorIdRepo(transaction, t.idProductoTinte, idEmpresa);
    const etiqueta = prod?.descripcion || prod?.Codigo || 'tinte';
    const { cantidadStock, gramosPorEnvase } = await resolverStockDesdeGramos(
      transaction,
      idEmpresa,
      t.idProductoTinte,
      t.gramos,
      `"${etiqueta}"`
    );
    const gTxt = formatearCantidad(t.gramos);
    const envTxt = formatearCantidad(cantidadStock);
    const poteTxt = formatearCantidad(gramosPorEnvase);
    const salida = await ventaLineaInventarioService.procesarSalidaInventarioVentaLinea({
      transaction,
      idEmpresa,
      idSucursal,
      idProducto: t.idProductoTinte,
      cantPedida: t.gramos,
      cantidadStockForzada: cantidadStock,
      descripcion: `Matizado ${nombreColor || ''} · ${etiqueta}`.trim(),
      permitirVentasNegativas,
      controlUbicaciones,
      cache,
      mensajeStockInsuficiente: (disponible) =>
        `Stock insuficiente para "Matizado ${nombreColor || ''} · ${etiqueta}". ` +
        `Pediste ${gTxt} g (equivalen a ${envTxt} envases; 1 envase = ${poteTxt} g). ` +
        `En kardex hay ${formatearCantidad(disponible)} envases.`
    });
    await ventaLineaInventarioService.registrarMovimientosSalidaVenta({
      transaction,
      idEmpresa,
      idSucursal,
      idProducto: t.idProductoTinte,
      idUsuario,
      compVenta,
      idComprobante,
      controlaInventario: salida.controlaInventario,
      cantidadADescontar: salida.cantidadADescontar,
      consumosPorLote: salida.consumosPorLote,
      costoUnitarioProm: salida.costoUnitarioProm,
      observaciones: `Matizado${nombreColor ? ` ${nombreColor}` : ''}`
    });
    await formulaMatizadoRepository.insertarVentaMatizadoTinte(
      transaction,
      idVentaMatizado,
      t.idProductoTinte,
      t.gramos,
      cantidadStock
    );
  }

  return { idVentaMatizado, idFormula };
}

async function eliminar(pool, idEmpresa, idFormula) {
  assertUuid(idEmpresa, 'Empresa');
  assertUuid(idFormula, 'Fórmula');
  const existe = await formulaMatizadoRepository.obtenerPorId(pool, idEmpresa, idFormula);
  if (!existe || !existe.estado) {
    throw new Error('Fórmula no encontrada');
  }
  const ok = await formulaMatizadoRepository.desactivar(pool, idEmpresa, idFormula);
  if (!ok) {
    throw new Error('No se pudo eliminar la fórmula');
  }
}

function textoDescripcionMatizado(matizado) {
  if (!matizado) return '';
  const color = String(matizado.nombreColor || '').trim();
  return color ? color : 'Matizado';
}

module.exports = {
  listar,
  obtener,
  guardarFormula,
  eliminar,
  procesarEnVenta,
  textoDescripcionMatizado
};
