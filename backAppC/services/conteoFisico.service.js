const { randomUUID } = require('crypto');
const sql = require('mssql');
const { withPool } = require('../utils/dbPool.util');
const conteoFisicoRepository = require('../repositories/conteoFisico.repository');
const inventarioRepository = require('../repositories/inventario.repository');
const inventarioService = require('./inventario.service');
const gestoresRepository = require('../repositories/gestores.repository');
const comprobantesRepository = require('../repositories/comprobantes.repository');
const productosRepository = require('../repositories/productos.repository');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');
const { normalizarFechaMovimientoParaSql } = require('../utils/fechaMovimientoInventario.util');

function controlUbicacionesDesdeConfig(configRows) {
  const row = configRows && configRows.find((c) => c.clave === 'INVENTARIO_CONTROL_UBICACIONES');
  return String(row?.valor ?? 'true').toLowerCase() !== 'false';
}

const TIPOS_CONTEO = new Set(['INICIAL', 'MENSUAL']);

function normTipoConteo(v) {
  return String(v || '').trim().toUpperCase();
}

/** Fecha/hora civil enviada por el cliente (navegador) o null para GETDATE() en SQL. */
function fechaMovimientoDesdeBodyAplicar(body) {
  if (body && body.fechaMovimiento != null && String(body.fechaMovimiento).trim() !== '') {
    const r = normalizarFechaMovimientoParaSql(body.fechaMovimiento);
    if (!r) {
      throw new Error('fechaMovimiento inválida (use YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss, sin Z)');
    }
    return r;
  }
  return null;
}

/**
 * Crea sesión en borrador.
 */
exports.crearSesion = async (idEmpresa, idUsuario, body) => {
  const { idSucursal, tipoConteo, observaciones } = body || {};
  if (!idSucursal) {
    throw new Error('Sucursal es obligatoria');
  }
  const tipo = normTipoConteo(tipoConteo);
  if (!TIPOS_CONTEO.has(tipo)) {
    throw new Error('tipoConteo debe ser INICIAL o MENSUAL');
  }
  return withPool(async (pool) => {
    const ok = await conteoFisicoRepository.validarSucursalPerteneceEmpresa(pool, idEmpresa, idSucursal);
    if (!ok) {
      throw new Error('La sucursal no existe o no pertenece a la empresa');
    }
    const idSesion = randomUUID();
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();
      await conteoFisicoRepository.insertarSesion(transaction, {
        idSesion,
        idEmpresa,
        idSucursal,
        tipoConteo: tipo,
        observaciones: observaciones != null ? String(observaciones).substring(0, 500) : null,
        idUsuarioCreacion: idUsuario || null
      });
      await transaction.commit();
      return { idSesion, message: 'Sesión de conteo creada' };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  });
};

async function obtenerSesionInterno(pool, idEmpresa, idSesion) {
  const sesion = await conteoFisicoRepository.obtenerSesionPorId(pool, idEmpresa, idSesion);
  if (!sesion) {
    throw new Error('Sesión no encontrada');
  }
  const lineas = await conteoFisicoRepository.listarLineasPorSesion(pool, idEmpresa, idSesion);
  return { sesion, lineas };
}

exports.obtenerSesion = async (idEmpresa, idSesion) => {
  return withPool((pool) => obtenerSesionInterno(pool, idEmpresa, idSesion));
};

/**
 * Previsualización: stock al instante y delta que se aplicaría (solo líneas verificadas con stockReal).
 */
exports.previsualizarAplicacion = async (idEmpresa, idSesion) => {
  return withPool(async (pool) => {
    const { sesion, lineas } = await obtenerSesionInterno(pool, idEmpresa, idSesion);
    if (sesion.estado !== 'BORRADOR') {
      throw new Error('Solo se puede previsualizar una sesión en borrador');
    }
    const preview = [];
    for (const l of lineas) {
      const stockActual = await inventarioRepository.obtenerStockAgregadoProductoSucursal(
        pool,
        idEmpresa,
        sesion.idSucursal,
        l.idProducto
      );
      const stockReal = l.stockReal != null ? Number(l.stockReal) : null;
      const aplicable = !!l.verificado && stockReal != null && !Number.isNaN(stockReal);
      const delta = aplicable ? stockReal - stockActual : null;
      preview.push({
        idLinea: l.idLinea,
        idProducto: l.idProducto,
        productoCodigo: l.productoCodigo,
        productoDescripcion: l.productoDescripcion,
        marca: l.marca,
        stockSistemaAlGuardar: Number(l.stockSistema) || 0,
        stockActual,
        stockReal: aplicable ? stockReal : l.stockReal,
        verificado: !!l.verificado,
        delta,
        seAplicaraMovimiento: aplicable && delta !== 0
      });
    }
    return { sesion, preview };
  });
};

async function validarCategoriaEmpresa(pool, idEmpresa, idCategoria) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idCategoria', sql.Int, idCategoria)
    .query(
      'SELECT 1 AS ok FROM dbo.Categorias WHERE idEmpresa = @idEmpresa AND idCategoria = @idCategoria AND ISNULL(estado, 1) = 1'
    );
  if (!r.recordset || !r.recordset[0]) {
    throw new Error('La categoría no existe o no pertenece a la empresa');
  }
}

async function validarPresentacionExiste(pool, idPresentacion) {
  const r = await pool
    .request()
    .input('idPresentacion', sql.Int, idPresentacion)
    .query('SELECT 1 AS ok FROM dbo.Presentacion WHERE idPresentacion = @idPresentacion');
  if (!r.recordset || !r.recordset[0]) {
    throw new Error('La presentación no es válida');
  }
}

async function validarMarcaEmpresa(pool, idEmpresa, idMarca) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idMarca', sql.Int, idMarca)
    .query(
      'SELECT 1 AS ok FROM dbo.Marcas WHERE idEmpresa = @idEmpresa AND idMarca = @idMarca AND ISNULL(estado, 1) = 1'
    );
  if (!r.recordset || !r.recordset[0]) {
    throw new Error('La marca no existe o no pertenece a la empresa');
  }
}

/**
 * Upsert línea (actualiza referencia stockSistema al guardar).
 * Opcional: descripcion, idCategoria, idPresentacion, idMarca actualizan el maestro del producto (requiere EDITAR_PRODUCTOS o CREAR_PRODUCTOS, o Administrador).
 */
exports.upsertLinea = async (user, idSesion, body) => {
  if (!user || !user.empresa) {
    throw new Error('NO_ACCESS');
  }
  const idEmpresa = user.empresa;
  const { idProducto, stockReal, verificado, notas } = body || {};
  if (!idProducto) {
    throw new Error('idProducto es obligatorio');
  }

  const tieneDescripcion = body && Object.prototype.hasOwnProperty.call(body, 'descripcion');
  const tieneCategoria = body && Object.prototype.hasOwnProperty.call(body, 'idCategoria');
  const tienePresentacion = body && Object.prototype.hasOwnProperty.call(body, 'idPresentacion');
  const tieneMarca = body && Object.prototype.hasOwnProperty.call(body, 'idMarca');
  const quiereMaestro = tieneDescripcion || tieneCategoria || tienePresentacion || tieneMarca;

  return withPool(async (pool) => {
    const sesion = await conteoFisicoRepository.obtenerSesionPorId(pool, idEmpresa, idSesion);
    if (!sesion) {
      throw new Error('Sesión no encontrada');
    }
    if (sesion.estado !== 'BORRADOR') {
      throw new Error('La sesión está cerrada; no se pueden editar líneas');
    }

    if (quiereMaestro && user.rol !== 'Administrador') {
      await assertAlgunoPermiso(pool, user, 'EDITAR_PRODUCTOS', 'CREAR_PRODUCTOS');
    }

    const stockSistema = await inventarioRepository.obtenerStockAgregadoProductoSucursal(
      pool,
      idEmpresa,
      sesion.idSucursal,
      idProducto
    );
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();

      if (quiereMaestro) {
        const prod = await productosRepository.obtenerProductoPorIdRepo(transaction, idProducto, idEmpresa);
        if (!prod) {
          throw new Error('Producto no encontrado');
        }
        const nuevaDesc = tieneDescripcion ? String(body.descripcion ?? '').trim() : String(prod.descripcion || '').trim();
        const nuevaCat = tieneCategoria ? Number(body.idCategoria) : Number(prod.idCategoria);
        const nuevaPres = tienePresentacion ? Number(body.idPresentacion) : Number(prod.idPresentacion);
        const nuevaMar = tieneMarca ? Number(body.idMarca) : Number(prod.idMarca);
        if (!nuevaDesc) {
          throw new Error('La descripción no puede quedar vacía');
        }
        if (!Number.isInteger(nuevaCat) || nuevaCat < 1) {
          throw new Error('idCategoria inválido');
        }
        if (!Number.isInteger(nuevaPres) || nuevaPres < 1) {
          throw new Error('idPresentacion inválido');
        }
        if (!Number.isInteger(nuevaMar) || nuevaMar < 1) {
          throw new Error('idMarca inválido');
        }
        await validarCategoriaEmpresa(transaction, idEmpresa, nuevaCat);
        await validarPresentacionExiste(transaction, nuevaPres);
        await validarMarcaEmpresa(transaction, idEmpresa, nuevaMar);
        const cambia =
          nuevaDesc !== String(prod.descripcion || '').trim() ||
          nuevaCat !== Number(prod.idCategoria) ||
          nuevaPres !== Number(prod.idPresentacion) ||
          nuevaMar !== Number(prod.idMarca);
        if (cambia) {
          await productosRepository.actualizarMaestroConteoFisico(transaction, {
            idEmpresa,
            idProducto,
            descripcion: nuevaDesc,
            idCategoria: nuevaCat,
            idPresentacion: nuevaPres,
            idMarca: nuevaMar
          });
        }
      }

      await conteoFisicoRepository.upsertLinea(transaction, {
        idSesion,
        idProducto,
        stockSistema,
        stockReal,
        verificado: !!verificado,
        notas: notas != null ? String(notas).substring(0, 500) : null
      });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
    const lineas = await conteoFisicoRepository.listarLineasPorSesion(pool, idEmpresa, idSesion);
    const linea = lineas.find(
      (x) => String(x.idProducto).toLowerCase() === String(idProducto).toLowerCase()
    );
    return { linea: linea || null, lineas };
  });
};

/**
 * Aplica reajustes: delta = stockReal − stock actual (en transacción), cierra sesión.
 */
exports.aplicarMovimientos = async (idEmpresa, idUsuario, idSesion, body) => {
  const observacionesExtra = body && body.observaciones != null ? String(body.observaciones) : '';

  return withPool(async (pool) => {
    const sesion = await conteoFisicoRepository.obtenerSesionPorId(pool, idEmpresa, idSesion);
    if (!sesion) {
      throw new Error('Sesión no encontrada');
    }
    if (sesion.estado !== 'BORRADOR') {
      throw new Error('La sesión ya está cerrada');
    }

    const lineas = await conteoFisicoRepository.listarLineasPorSesion(pool, idEmpresa, idSesion);
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();

      const configRows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, idEmpresa).catch(() => []);
      const controlUbicaciones = controlUbicacionesDesdeConfig(configRows);

      const detalle = [];
      const itemsPositivos = [];
      const itemsNegativos = [];

      for (const l of lineas) {
        if (!l.verificado) {
          continue;
        }
        const stockReal = l.stockReal != null ? Number(l.stockReal) : null;
        if (stockReal == null || Number.isNaN(stockReal)) {
          continue;
        }

        const stockActual = await inventarioRepository.obtenerStockAgregadoProductoSucursal(
          transaction,
          idEmpresa,
          sesion.idSucursal,
          l.idProducto
        );
        const delta = stockReal - stockActual;
        detalle.push({
          idProducto: l.idProducto,
          productoCodigo: l.productoCodigo,
          stockActual,
          stockReal,
          delta
        });

        if (delta === 0) {
          continue;
        }

        if (delta > 0) {
          const costoUnitario = await inventarioRepository.obtenerCostoUnitarioProducto(
            transaction,
            idEmpresa,
            l.idProducto
          );
          itemsPositivos.push({
            idProducto: l.idProducto,
            cantidad: delta,
            costoUnitario: costoUnitario > 0 ? costoUnitario : 0
          });
        } else {
          const cantidad = Math.abs(delta);
          itemsNegativos.push({ idProducto: l.idProducto, cantidad });
        }
      }

      const obsBase = `Conteo físico sesión ${idSesion}`;
      const obs = [obsBase, observacionesExtra].filter(Boolean).join('. ');
      const documentos = {
        ingreso: null,
        salida: null
      };

      const fechaMovimientoAplicacion = fechaMovimientoDesdeBodyAplicar(body);

      if (itemsPositivos.length > 0) {
        const compIngreso = await comprobantesRepository.obtenerComprobantePorCodigoRepo(
          transaction,
          idEmpresa,
          'IN'
        );
        if (!compIngreso || !compIngreso.idComprobante) {
          throw new Error('No existe comprobante IN para registrar reajuste positivo');
        }
        const movIngresoBody = {
          tipoMovimiento: 'REAJUSTE_POSITIVO',
          idSucursal: sesion.idSucursal,
          fechaMovimiento: fechaMovimientoAplicacion,
          docRelacionado: null,
          observaciones: obs,
          idComprobante: compIngreso.idComprobante,
          items: itemsPositivos
        };
        const mapaIngreso = { tipoBD: 'AJ', esEntrada: true };
        await inventarioService.ejecutarProcesarMovimientoNoTransferencia(
          transaction,
          idEmpresa,
          idUsuario,
          movIngresoBody,
          { mapa: mapaIngreso, controlUbicaciones }
        );
        const numeroDocIngreso = parseInt(String(compIngreso.numero || '0'), 10) || 0;
        documentos.ingreso = {
          idComprobante: compIngreso.idComprobante,
          codigo: compIngreso.codigo,
          serie: compIngreso.serie || null,
          numero: numeroDocIngreso,
          serieNumero: `${compIngreso.serie || ''}-${numeroDocIngreso}`.replace(/^-/, '')
        };
      }

      if (itemsNegativos.length > 0) {
        const compSalida = await comprobantesRepository.obtenerComprobantePorCodigoRepo(
          transaction,
          idEmpresa,
          'SA'
        );
        if (!compSalida || !compSalida.idComprobante) {
          throw new Error('No existe comprobante SA para registrar reajuste negativo');
        }
        const movSalidaBody = {
          tipoMovimiento: 'REAJUSTE_NEGATIVO',
          idSucursal: sesion.idSucursal,
          fechaMovimiento: fechaMovimientoAplicacion,
          docRelacionado: null,
          observaciones: obs,
          idComprobante: compSalida.idComprobante,
          items: itemsNegativos
        };
        const mapaSalida = { tipoBD: 'AJ', esEntrada: false };
        await inventarioService.ejecutarProcesarMovimientoNoTransferencia(
          transaction,
          idEmpresa,
          idUsuario,
          movSalidaBody,
          { mapa: mapaSalida, controlUbicaciones }
        );
        const numeroDocSalida = parseInt(String(compSalida.numero || '0'), 10) || 0;
        documentos.salida = {
          idComprobante: compSalida.idComprobante,
          codigo: compSalida.codigo,
          serie: compSalida.serie || null,
          numero: numeroDocSalida,
          serieNumero: `${compSalida.serie || ''}-${numeroDocSalida}`.replace(/^-/, '')
        };
      }

      await conteoFisicoRepository.marcarSesionCerrada(transaction, idEmpresa, idSesion);
      await transaction.commit();
      const movimientosGenerados = itemsPositivos.length + itemsNegativos.length;
      return {
        message: 'Movimientos aplicados y sesión cerrada',
        movimientosGenerados,
        lineasProcesadas: detalle.length,
        detalle,
        documentos
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  });
};

/**
 * Datos para export (sesión cerrada).
 */
exports.obtenerSesionParaExport = async (idEmpresa, idSesion) => {
  return withPool(async (pool) => {
    const { sesion, lineas } = await obtenerSesionInterno(pool, idEmpresa, idSesion);
    if (sesion.estado !== 'CERRADO') {
      throw new Error('La exportación solo está disponible para sesiones cerradas');
    }
    return { sesion, lineas };
  });
};
