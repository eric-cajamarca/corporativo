const { randomUUID } = require('crypto');
const sql = require('mssql');
const { withPool } = require('../utils/dbPool.util');
const conteoFisicoRepository = require('../repositories/conteoFisico.repository');
const inventarioRepository = require('../repositories/inventario.repository');
const inventarioService = require('./inventario.service');
const gestoresRepository = require('../repositories/gestores.repository');
const comprobantesRepository = require('../repositories/comprobantes.repository');
const productosRepository = require('../repositories/productos.repository');
const cotizacionesRepository = require('../repositories/cotizaciones.repository');
const ubicacionesPrioridadRepository = require('../repositories/ubicacionesPrioridad.repository');
const { assertAlgunoPermiso } = require('../utils/autorizacionPermisos.util');
const { normalizarFechaMovimientoParaSql } = require('../utils/fechaMovimientoInventario.util');
const { esEmpresaGestora, assertEmpresaAutorizada } = require('../utils/empresaGestora.util');

function controlUbicacionesDesdeConfig(configRows) {
  const row = configRows && configRows.find((c) => c.clave === 'INVENTARIO_CONTROL_UBICACIONES');
  return String(row?.valor ?? 'true').toLowerCase() !== 'false';
}

/** Sesión con ubicación fijada requiere inventario por ubicaciones activo. */
function assertSesionUbicacionCompatibleConControl(sesion, controlUbicaciones) {
  const idUbSes =
    sesion && sesion.idUbicacionInventario != null
      ? parseInt(String(sesion.idUbicacionInventario), 10)
      : NaN;
  if (Number.isFinite(idUbSes) && idUbSes > 0 && !controlUbicaciones) {
    throw new Error(
      'La sesión tiene ubicación de conteo fijada, pero «Gestionar stock por ubicación» (INVENTARIO_CONTROL_UBICACIONES) está desactivado. Active esa opción en Configuración → Inventario o cree una sesión sin ubicación.'
    );
  }
}

const DELTA_CONTEO_EPS = 1e-6;

const TIPOS_CONTEO = new Set(['INICIAL', 'MENSUAL']);

function normTipoConteo(v) {
  return String(v || '').trim().toUpperCase();
}

/**
 * Resuelve empresa, sucursal y ubicación para stock/movimientos de una línea (gestora multiempresa).
 */
async function resolverContextoLineaStock(pool, sesion, idProducto, idEmpresaJwt) {
  const empresaProducto = await productosRepository.obtenerIdEmpresaProductoPorId(pool, idProducto);
  if (!empresaProducto) {
    throw new Error('Producto no encontrado');
  }
  await assertEmpresaAutorizada(pool, idEmpresaJwt, empresaProducto);

  const gestora = await esEmpresaGestora(pool, idEmpresaJwt);
  let idSucursal = sesion.idSucursal;

  if (gestora || String(empresaProducto).toLowerCase() !== String(idEmpresaJwt).toLowerCase()) {
    const sucConStock = await inventarioRepository.obtenerSucursalConStockProducto(
      pool,
      empresaProducto,
      idProducto
    );
    idSucursal =
      sucConStock ||
      (await cotizacionesRepository.obtenerPrimeraSucursalPorEmpresa(pool, empresaProducto));
    if (!idSucursal) {
      throw new Error('No hay sucursal configurada para la empresa del producto');
    }
  }

  const configRows = await gestoresRepository
    .obtenerConfiguracionEmpresa(pool, empresaProducto)
    .catch(() => []);
  const controlUbicaciones = controlUbicacionesDesdeConfig(configRows);

  let idUbMov = null;
  if (controlUbicaciones) {
    const codigoSes = String(sesion.codigoUbicacionInventario || '').trim();
    if (codigoSes) {
      idUbMov = await conteoFisicoRepository.obtenerIdUbicacionPorCodigo(
        pool,
        empresaProducto,
        idSucursal,
        codigoSes
      );
    } else if (!gestora) {
      const idUbSes =
        sesion.idUbicacionInventario != null ? parseInt(String(sesion.idUbicacionInventario), 10) : NaN;
      if (Number.isFinite(idUbSes) && idUbSes > 0) {
        const okUb = await conteoFisicoRepository.validarUbicacionPerteneceSucursal(pool, idSucursal, idUbSes);
        if (okUb) {
          idUbMov = idUbSes;
        }
      }
    }
  }

  return {
    idEmpresa: empresaProducto,
    idSucursal,
    controlUbicaciones,
    idUbMov,
    codigoUbicacion: String(sesion.codigoUbicacionInventario || '').trim() || null,
    gestora
  };
}

async function obtenerStockLinea(conn, ctx, idProducto) {
  if (ctx.idUbMov) {
    return inventarioRepository.obtenerStockAgregadoProductoSucursalUbicacion(
      conn,
      ctx.idEmpresa,
      ctx.idSucursal,
      idProducto,
      ctx.idUbMov
    );
  }
  if (ctx.gestora) {
    return inventarioRepository.obtenerStockAgregadoProductoEmpresa(conn, ctx.idEmpresa, idProducto);
  }
  return inventarioRepository.obtenerStockAgregadoProductoSucursal(
    conn,
    ctx.idEmpresa,
    ctx.idSucursal,
    idProducto
  );
}

function claveGrupoMovimiento(ctx) {
  const ub = ctx.idUbMov != null && ctx.idUbMov > 0 ? String(ctx.idUbMov) : '0';
  return `${String(ctx.idEmpresa).toLowerCase()}|${String(ctx.idSucursal).toLowerCase()}|${ub}`;
}

async function obtenerComprobanteIngresoInventario(conn, idEmpresa, idSucursal) {
  for (const cod of ['IN', 'II', 'IV']) {
    const comp = await comprobantesRepository.obtenerComprobantePorCodigoRepo(
      conn,
      idEmpresa,
      cod,
      idSucursal
    );
    if (comp && comp.idComprobante) {
      return comp;
    }
  }
  return null;
}

async function obtenerComprobanteSalidaInventario(conn, idEmpresa, idSucursal) {
  for (const cod of ['SA']) {
    const comp = await comprobantesRepository.obtenerComprobantePorCodigoRepo(
      conn,
      idEmpresa,
      cod,
      idSucursal
    );
    if (comp && comp.idComprobante) {
      return comp;
    }
  }
  return null;
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
    const gestora = await esEmpresaGestora(pool, idEmpresa);
    const configRows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, idEmpresa).catch(() => []);
    const controlUbicaciones = controlUbicacionesDesdeConfig(configRows);

    const rawUb = body && body.idUbicacionInventario;
    const rawCodigoUb =
      body && body.codigoUbicacionInventario != null ? String(body.codigoUbicacionInventario).trim() : '';
    let idUbicacionInventario = null;
    let codigoUbicacionInventario = null;

    if (rawCodigoUb) {
      if (!controlUbicaciones) {
        throw new Error(
          'Active «Gestionar stock por ubicación» en configuración de inventario para fijar ubicación en el conteo físico'
        );
      }
      codigoUbicacionInventario = rawCodigoUb.substring(0, 20);
      if (gestora) {
        const { idsEmpresaGestoraConsolidados } = require('../utils/empresaGestora.util');
        const ids = await idsEmpresaGestoraConsolidados(pool, idEmpresa);
        const codigos = await ubicacionesPrioridadRepository.listarCodigosConsolidados(pool, ids);
        const okCod = (codigos || []).some(
          (c) =>
            String(c.codigoUbicacion || '')
              .trim()
              .toUpperCase() === codigoUbicacionInventario.toUpperCase()
        );
        if (!okCod) {
          throw new Error(`El código de ubicación «${codigoUbicacionInventario}» no existe en las empresas gestionadas`);
        }
      } else {
        const idUb = await conteoFisicoRepository.obtenerIdUbicacionPorCodigo(
          pool,
          idEmpresa,
          idSucursal,
          codigoUbicacionInventario
        );
        if (!idUb) {
          throw new Error('La ubicación no pertenece a la sucursal seleccionada');
        }
        idUbicacionInventario = idUb;
      }
    } else if (rawUb != null && rawUb !== '') {
      const n = parseInt(String(rawUb), 10);
      if (!Number.isFinite(n) || n < 1) {
        throw new Error('Ubicación de inventario inválida');
      }
      if (!controlUbicaciones) {
        throw new Error(
          'Active «Gestionar stock por ubicación» en configuración de inventario para fijar ubicación en el conteo físico'
        );
      }
      const okUb = await conteoFisicoRepository.validarUbicacionPerteneceSucursal(pool, idSucursal, n);
      if (!okUb) {
        throw new Error('La ubicación no pertenece a la sucursal seleccionada');
      }
      idUbicacionInventario = n;
    }

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
        idUsuarioCreacion: idUsuario || null,
        idUbicacionInventario,
        codigoUbicacionInventario
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
      const ctx = await resolverContextoLineaStock(pool, sesion, l.idProducto, idEmpresa);
      const stockActual = await obtenerStockLinea(pool, ctx, l.idProducto);
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
        seAplicaraMovimiento:
          aplicable && delta != null && Math.abs(delta) > DELTA_CONTEO_EPS
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
  const rawEmpresaProducto = body?.idEmpresaProducto ? String(body.idEmpresaProducto).trim() : null;
  const idEmpresaProducto = rawEmpresaProducto || null;
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
    const empresaProductoRegistrado = await productosRepository.obtenerIdEmpresaProductoPorId(pool, idProducto);
    if (!empresaProductoRegistrado) {
      throw new Error('Producto no encontrado');
    }
    const empresaDestino = idEmpresaProducto || empresaProductoRegistrado;
    await assertEmpresaAutorizada(pool, idEmpresa, empresaDestino);
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

    const ctx = await resolverContextoLineaStock(pool, sesion, idProducto, idEmpresa);
    const stockSistema = await obtenerStockLinea(pool, ctx, idProducto);
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();

      if (quiereMaestro) {
      const prod = await productosRepository.obtenerProductoPorIdRepo(transaction, idProducto, empresaDestino);
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
      await validarCategoriaEmpresa(transaction, empresaDestino, nuevaCat);
      await validarPresentacionExiste(transaction, nuevaPres);
      await validarMarcaEmpresa(transaction, empresaDestino, nuevaMar);
      const cambia =
        nuevaDesc !== String(prod.descripcion || '').trim() ||
        nuevaCat !== Number(prod.idCategoria) ||
        nuevaPres !== Number(prod.idPresentacion) ||
        nuevaMar !== Number(prod.idMarca);
      if (cambia) {
        await productosRepository.actualizarMaestroConteoFisico(transaction, {
          idEmpresa: empresaDestino,
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

      const detalle = [];
      /** @type {Map<string, { ctx: object, items: object[] }>} */
      const gruposPositivos = new Map();
      /** @type {Map<string, { ctx: object, items: object[] }>} */
      const gruposNegativos = new Map();

      for (const l of lineas) {
        if (!l.verificado) {
          continue;
        }
        const stockReal = l.stockReal != null ? Number(l.stockReal) : null;
        if (stockReal == null || Number.isNaN(stockReal)) {
          continue;
        }

        const ctx = await resolverContextoLineaStock(transaction, sesion, l.idProducto, idEmpresa);
        const stockActual = await obtenerStockLinea(transaction, ctx, l.idProducto);
        const delta = stockReal - stockActual;
        detalle.push({
          idProducto: l.idProducto,
          idEmpresaDestino: ctx.idEmpresa,
          idSucursalDestino: ctx.idSucursal,
          productoCodigo: l.productoCodigo,
          stockActual,
          stockReal,
          delta
        });

        if (Math.abs(delta) < DELTA_CONTEO_EPS) {
          continue;
        }

        if (ctx.codigoUbicacion && ctx.controlUbicaciones && !ctx.idUbMov) {
          throw new Error(
            `No existe la ubicación «${ctx.codigoUbicacion}» en la sucursal del producto (${l.productoDescripcion || l.productoCodigo}).`
          );
        }

        const keyGrupo = claveGrupoMovimiento(ctx);
        if (delta > DELTA_CONTEO_EPS) {
          const costoUnitario = await inventarioRepository.obtenerCostoUnitarioProducto(
            transaction,
            ctx.idEmpresa,
            l.idProducto
          );
          if (!gruposPositivos.has(keyGrupo)) {
            gruposPositivos.set(keyGrupo, { ctx, items: [] });
          }
          gruposPositivos.get(keyGrupo).items.push({
            idProducto: l.idProducto,
            cantidad: delta,
            costoUnitario: costoUnitario > 0 ? costoUnitario : 0
          });
        } else {
          const cantidad = Math.abs(delta);
          if (!gruposNegativos.has(keyGrupo)) {
            gruposNegativos.set(keyGrupo, { ctx, items: [] });
          }
          gruposNegativos.get(keyGrupo).items.push({ idProducto: l.idProducto, cantidad });
        }
      }

      let totalItemsPositivos = 0;
      let totalItemsNegativos = 0;
      gruposPositivos.forEach((g) => {
        totalItemsPositivos += g.items.length;
      });
      gruposNegativos.forEach((g) => {
        totalItemsNegativos += g.items.length;
      });

      const obsBase = `Conteo físico sesión ${idSesion}`;
      const obs = [obsBase, observacionesExtra].filter(Boolean).join('. ');
      const documentos = {
        ingreso: null,
        salida: null
      };

      const fechaMovimientoAplicacion = fechaMovimientoDesdeBodyAplicar(body);

      const lineasConStockRealSinVerificar = lineas.filter((l) => {
        if (l.verificado) return false;
        const sr = l.stockReal != null ? Number(l.stockReal) : null;
        return sr != null && !Number.isNaN(sr);
      }).length;

      if (totalItemsPositivos === 0 && totalItemsNegativos === 0) {
        if (detalle.length === 0) {
          if (lineasConStockRealSinVerificar > 0) {
            throw new Error(
              `Hay ${lineasConStockRealSinVerificar} línea(s) con «Stock real» guardado pero sin «Verificado». Abra cada producto en el panel lateral, marque «Verificado», pulse «Guardar línea» y vuelva a aplicar.`
            );
          }
          throw new Error(
            'No hay líneas para aplicar: marque «Verificado», indique «Stock real» y guarde cada línea antes de aplicar.'
          );
        }
        throw new Error(
          'No se registró ningún movimiento: en todas las líneas incluidas el stock real coincide con el stock del sistema (delta cero). Revise la previsualización o la sucursal/ubicación de la sesión.'
        );
      }

      const empresasAfectadas = new Set();

      for (const [, grupo] of gruposPositivos) {
        const { ctx, items } = grupo;
        empresasAfectadas.add(String(ctx.idEmpresa).toLowerCase());
        const compIngreso = await obtenerComprobanteIngresoInventario(
          transaction,
          ctx.idEmpresa,
          ctx.idSucursal
        );
        if (!compIngreso || !compIngreso.idComprobante) {
          throw new Error(
            'No existe comprobante de ingreso (IN, II o IV) en la sucursal del producto para registrar el reajuste positivo'
          );
        }
        const movIngresoBody = {
          tipoMovimiento: 'REAJUSTE_POSITIVO',
          idSucursal: ctx.idSucursal,
          fechaMovimiento: fechaMovimientoAplicacion,
          docRelacionado: null,
          observaciones: obs,
          idComprobante: compIngreso.idComprobante,
          items
        };
        const mapaIngreso = { tipoBD: 'AJ', esEntrada: true };
        await inventarioService.ejecutarProcesarMovimientoNoTransferencia(
          transaction,
          ctx.idEmpresa,
          idUsuario,
          movIngresoBody,
          {
            mapa: mapaIngreso,
            controlUbicaciones: ctx.controlUbicaciones,
            idUbicacionMovimiento: ctx.idUbMov
          }
        );
        if (!documentos.ingreso) {
          const numeroDocIngreso = parseInt(String(compIngreso.numero || '0'), 10) || 0;
          documentos.ingreso = {
            idComprobante: compIngreso.idComprobante,
            codigo: compIngreso.codigo,
            serie: compIngreso.serie || null,
            numero: numeroDocIngreso,
            serieNumero: `${compIngreso.serie || ''}-${numeroDocIngreso}`.replace(/^-/, '')
          };
        }
      }

      for (const [, grupo] of gruposNegativos) {
        const { ctx, items } = grupo;
        empresasAfectadas.add(String(ctx.idEmpresa).toLowerCase());
        const compSalida = await obtenerComprobanteSalidaInventario(
          transaction,
          ctx.idEmpresa,
          ctx.idSucursal
        );
        if (!compSalida || !compSalida.idComprobante) {
          throw new Error(
            'No existe comprobante SA en la sucursal del producto para registrar el reajuste negativo'
          );
        }
        const movSalidaBody = {
          tipoMovimiento: 'REAJUSTE_NEGATIVO',
          idSucursal: ctx.idSucursal,
          fechaMovimiento: fechaMovimientoAplicacion,
          docRelacionado: null,
          observaciones: obs,
          idComprobante: compSalida.idComprobante,
          items
        };
        const mapaSalida = { tipoBD: 'AJ', esEntrada: false };
        await inventarioService.ejecutarProcesarMovimientoNoTransferencia(
          transaction,
          ctx.idEmpresa,
          idUsuario,
          movSalidaBody,
          {
            mapa: mapaSalida,
            controlUbicaciones: ctx.controlUbicaciones,
            idUbicacionMovimiento: ctx.idUbMov
          }
        );
        if (!documentos.salida) {
          const numeroDocSalida = parseInt(String(compSalida.numero || '0'), 10) || 0;
          documentos.salida = {
            idComprobante: compSalida.idComprobante,
            codigo: compSalida.codigo,
            serie: compSalida.serie || null,
            numero: numeroDocSalida,
            serieNumero: `${compSalida.serie || ''}-${numeroDocSalida}`.replace(/^-/, '')
          };
        }
      }

      await conteoFisicoRepository.marcarSesionCerrada(transaction, idEmpresa, idSesion);
      await transaction.commit();
      const movimientosGenerados = totalItemsPositivos + totalItemsNegativos;
      return {
        message: 'Movimientos aplicados y sesión cerrada',
        movimientosGenerados,
        lineasProcesadas: detalle.length,
        empresasAfectadas: Array.from(empresasAfectadas),
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
