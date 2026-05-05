const sql = require('mssql');
const ProductosRepository = require('../repositories/productos.repository');
const preciosVRepository = require('../repositories/preciosV.repository');

async function resolverIdUsuarioParaProducto(pool, idEmpresa, subFromToken) {
  if (!subFromToken || !idEmpresa) return null;
  try {
    const found = await ProductosRepository.buscarIdUsuarioEnEmpresa(pool, subFromToken, idEmpresa);
    if (found) return found;
    return ProductosRepository.buscarPrimerIdUsuarioEmpresa(pool, idEmpresa);
  } catch (e) {
    console.error('resolverIdUsuarioParaProducto:', e.message);
  }
  return null;
}

async function obtenerSiguienteCodigoCorrelativoDisponible(transaction, idEmpresa) {
  const maxIntentos = 500;
  for (let intento = 0; intento < maxIntentos; intento += 1) {
    const corrResult = await ProductosRepository.incrementarCorrelativo(transaction, idEmpresa);
    const row = corrResult.recordset && corrResult.recordset[0];
    let candidato = null;
    if (row && row.numero != null) {
      candidato = String(row.numero).trim();
    } else {
      const fallback = await ProductosRepository.obtenerSiguienteCodigoProductoFallback(transaction, idEmpresa);
      candidato = String(fallback.recordset?.[0]?.siguiente || '').trim();
    }
    if (!candidato) continue;
    const chk = await ProductosRepository.contarProductoPorCodigo(transaction, idEmpresa, candidato);
    const ocupado = Number(chk.recordset?.[0]?.n) > 0;
    if (!ocupado) return candidato;
  }
  return `P-${String(Date.now()).slice(-10)}`;
}

/**
 * Transacción de alta de producto (código correlativo opcional, lote inicial, precio en lista).
 * @returns {{ ok: true, idProducto }} | {{ errorLista: true }}
 */
async function crearProductoConTransaccion(pool, params) {
  const { datosProducto, usarCorrelativo, lote, precioVenta, idListaPrecio, idEmpresa } = params;
  const maxIntentosCodigo = 12;
  let committed = false;
  let lastDupErr = null;
  for (let attempt = 1; attempt <= maxIntentosCodigo && !committed; attempt += 1) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      if (usarCorrelativo) {
        datosProducto.Codigo = await obtenerSiguienteCodigoCorrelativoDisponible(transaction, idEmpresa);
      } else if (attempt === 1) {
        const chkCodigo = await ProductosRepository.contarProductoPorCodigo(
          transaction,
          idEmpresa,
          String(datosProducto.Codigo || '').trim()
        );
        if (Number(chkCodigo.recordset?.[0]?.n) > 0) {
          datosProducto.Codigo = await obtenerSiguienteCodigoCorrelativoDisponible(transaction, idEmpresa);
        }
      } else {
        datosProducto.Codigo = await obtenerSiguienteCodigoCorrelativoDisponible(transaction, idEmpresa);
      }

      await ProductosRepository.insertarProducto(transaction, datosProducto);

      if (lote && lote.idSucursal && (lote.cantidadIngresada > 0 || lote.costoUnitario != null)) {
        const cantidad = Math.max(0, parseInt(lote.cantidadIngresada, 10) || 0);
        const costoLote = lote.costoUnitario != null ? parseFloat(lote.costoUnitario) : datosProducto.cUnitario;
        await ProductosRepository.insertarLoteInicial(transaction, {
          idEmpresa,
          idProducto: datosProducto.idProducto,
          idSucursal: lote.idSucursal,
          costoUnitario: costoLote,
          cantidadIngresada: cantidad,
          cantidadDisponible: cantidad
        });
      }

      const precioVal = parseFloat(precioVenta);
      if (!Number.isNaN(precioVal) && precioVal > 0) {
        let lista = null;
        if (idListaPrecio != null && idListaPrecio !== '') {
          const listaResult = await preciosVRepository.obtenerListaPorId(
            transaction,
            parseInt(idListaPrecio, 10),
            idEmpresa
          );
          lista = listaResult && listaResult.recordset && listaResult.recordset[0];
          if (!lista) {
            await transaction.rollback();
            return { errorLista: true };
          }
        } else {
          const listaPrincipal = await preciosVRepository.verificarPrincipalExistente(transaction, idEmpresa);
          lista = listaPrincipal && listaPrincipal.recordset && listaPrincipal.recordset[0];
        }
        if (lista && lista.idLista && lista.idMoneda) {
          await preciosVRepository.crearPrecioProducto(transaction, {
            idLista: lista.idLista,
            idProducto: datosProducto.idProducto,
            precio: precioVal,
            idMoneda: lista.idMoneda,
            idUsuario: datosProducto.idUsuario
          });
        }
      }

      await transaction.commit();
      committed = true;
    } catch (err) {
      await transaction.rollback();
      const msg = String(err.message || '');
      const dupCodigo =
        err.number === 2627 && (/codigo/i.test(msg) || /duplicate key/i.test(msg) || /UNIQUE KEY/i.test(msg));
      if (dupCodigo && attempt < maxIntentosCodigo) {
        lastDupErr = err;
        continue;
      }
      throw err;
    }
  }
  if (!committed) {
    throw lastDupErr || new Error('No se pudo asignar un código de producto único.');
  }
  return { ok: true, idProducto: datosProducto.idProducto };
}

async function actualizarProductoCompra(pool, datosProducto) {
  await ProductosRepository.actualizarProductoCompra(pool, datosProducto);
  return datosProducto.idProducto;
}

async function crearProductoCompra(pool, datosProducto) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    let codigoFinal = String(datosProducto.Codigo || '').trim();
    if (!codigoFinal) {
      codigoFinal = await obtenerSiguienteCodigoCorrelativoDisponible(transaction, datosProducto.idEmpresa);
    } else {
      const existe = await ProductosRepository.contarProductoPorCodigo(
        transaction,
        datosProducto.idEmpresa,
        codigoFinal
      );
      if (Number(existe.recordset?.[0]?.n) > 0) {
        codigoFinal = await obtenerSiguienteCodigoCorrelativoDisponible(transaction, datosProducto.idEmpresa);
      }
    }
    datosProducto.Codigo = codigoFinal;
    await ProductosRepository.insertarProductoCompraValores(transaction, datosProducto);
    await transaction.commit();
    return datosProducto.idProducto;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function actualizarProducto(pool, detalle) {
  return ProductosRepository.actualizarProductoFlexible(pool, detalle);
}

/**
 * Activa o desactiva el producto (no elimina). idEmpresa desde contexto de seguridad.
 */
async function actualizarEstadoProducto(pool, idProducto, idEmpresa, activo) {
  const on =
    activo === true ||
    activo === 1 ||
    activo === '1' ||
    String(activo).toLowerCase() === 'true';
  const off =
    activo === false ||
    activo === 0 ||
    activo === '0' ||
    String(activo).toLowerCase() === 'false';
  if (!on && !off) {
    throw new Error('Indique activo: true o false.');
  }
  return ProductosRepository.actualizarEstadoProductoPorId(pool, idProducto, idEmpresa, on);
}

/**
 * Elimina producto e inventario/precios asociados en una transacción.
 * No borra si hay líneas en ventas o compras (mensaje claro para el cliente).
 */
async function eliminarProducto(pool, idProducto, idEmpresa) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  let committed = false;
  try {
    const lineasHistoricas = await ProductosRepository.contarLineasHistoricasVentasCompras(
      transaction,
      idProducto,
      idEmpresa
    );
    if (lineasHistoricas > 0) {
      throw new Error(
        'No se puede eliminar el producto porque tiene líneas en ventas o compras. Desactívelo (estado inactivo) en la ficha del producto.'
      );
    }
    await ProductosRepository.eliminarFilasRelacionadasProducto(transaction, idProducto, idEmpresa);
    const resultado = await ProductosRepository.eliminarProductoPorId(transaction, idProducto, idEmpresa);
    await transaction.commit();
    committed = true;
    return resultado;
  } catch (err) {
    if (!committed) {
      try {
        await transaction.rollback();
      } catch (_) {
        /* ignore */
      }
    }
    if (err && err.number === 547) {
      throw new Error(
        'No se puede eliminar el producto: sigue vinculado a otros registros del sistema (p. ej. variantes con stock propio, módulos adicionales).'
      );
    }
    throw err;
  }
}

module.exports = {
  resolverIdUsuarioParaProducto,
  obtenerSiguienteCodigoCorrelativoDisponible,
  crearProductoConTransaccion,
  actualizarProductoCompra,
  crearProductoCompra,
  actualizarProducto,
  actualizarEstadoProducto,
  eliminarProducto
};
