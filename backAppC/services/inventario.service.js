// services/inventario.service.js
const { randomUUID } = require('crypto');
const sql = require('mssql');
const { withPool } = require('../utils/dbPool.util');
const inventarioRepository = require('../repositories/inventario.repository');
const productosVendidosRepository = require('../repositories/productosVendidos.repository');
const productosCompradosRepository = require('../repositories/productosComprados.repository');
const gestoresRepository = require('../repositories/gestores.repository');
const permisosService = require('./permisos.service');
const stockService = require('./stock.service');
const ubicacionesPrioridadRepository = require('../repositories/ubicacionesPrioridad.repository');
const comprobantesRepository = require('../repositories/comprobantes.repository');

/** Mapeo tipo frontend -> { tipoBD: 'EN'|'SA'|'AJ', esEntrada: boolean } */
const TIPOS_MOVIMIENTO = {
  INVENTARIO_INICIAL: { tipoBD: 'EN', esEntrada: true },
  ENTRADA_VARIA: { tipoBD: 'EN', esEntrada: true },
  REAJUSTE_POSITIVO: { tipoBD: 'AJ', esEntrada: true },
  REAJUSTE_NEGATIVO: { tipoBD: 'AJ', esEntrada: false },
  SALIDA_MERMA: { tipoBD: 'SA', esEntrada: false },
  /** Devolución: ingreso (cat. TiposMovimiento DEVOLUCION, afectaStock +) */
  DEVOLUCION: { tipoBD: 'EN', esEntrada: true }
};

function getConfig(configRows, clave, def) {
  const row = configRows && configRows.find(c => c.clave === clave);
  return row && row.valor != null ? row.valor : def;
}

const CODIGOS_COMP_INVENTARIO = new Set(['IV', 'II', 'IN', 'SA', 'TF']);

async function validarSucursalesTransferencia(transaction, idEmpresa, idOrigen, idDestino) {
  const r = await transaction.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idOrigen', sql.UniqueIdentifier, idOrigen)
    .input('idDestino', sql.UniqueIdentifier, idDestino)
    .query(`
      SELECT idSucursal, nombre
      FROM Sucursal
      WHERE idEmpresa = @idEmpresa AND idSucursal IN (@idOrigen, @idDestino)
    `);
  const rows = r.recordset || [];
  if (rows.length !== 2) {
    throw new Error('Las sucursales de origen y destino deben existir y pertenecer a la empresa');
  }
  const norm = (u) => String(u || '').toLowerCase();
  const o = rows.find((x) => norm(x.idSucursal) === norm(idOrigen));
  const d = rows.find((x) => norm(x.idSucursal) === norm(idDestino));
  return {
    nombreOrigen: o?.nombre || '',
    nombreDestino: d?.nombre || ''
  };
}

/**
 * Transferencia entre sucursales: salida (SA) en origen por consumo de lotes, entrada (EN) en destino con costo ponderado.
 * Body: { idSucursal (origen), idSucursalDestino, fechaMovimiento?, idComprobante (TF), docRelacionado?, observaciones?, items: [{ idProducto, cantidad }] }
 */
async function procesarTransferenciaEntreSucursales(idEmpresa, idUsuario, body) {
  const {
    idSucursal: idSucursalOrigen,
    idSucursalDestino,
    fechaMovimiento,
    docRelacionado,
    observaciones,
    items,
    idComprobante
  } = body;

  if (!idSucursalOrigen || !idSucursalDestino) {
    throw new Error('Transferencia: indique sucursal de origen y sucursal de destino');
  }
  if (String(idSucursalOrigen) === String(idSucursalDestino)) {
    throw new Error('La sucursal de origen y destino deben ser diferentes');
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Debe incluir al menos un ítem');
  }

  return withPool(async (pool) => {
  const configRows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, idEmpresa).catch(() => []);
  const controlUbicaciones = String(getConfig(configRows, 'INVENTARIO_CONTROL_UBICACIONES', 'true')).toLowerCase() !== 'false';

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    const { nombreOrigen, nombreDestino } = await validarSucursalesTransferencia(
      transaction,
      idEmpresa,
      idSucursalOrigen,
      idSucursalDestino
      );

    let docRelacionadoFinal = docRelacionado || null;
    let comprobanteActual = null;
    if (idComprobante != null && String(idComprobante).trim() !== '') {
      const idComp = parseInt(idComprobante, 10);
      if (Number.isNaN(idComp)) {
        throw new Error('Comprobante inválido');
      }
      const compRes = await comprobantesRepository.obtenerComprobantePorIdEmpresa(transaction, idEmpresa, idComp);
      comprobanteActual = compRes?.recordset?.[0];
      if (!comprobanteActual) {
        throw new Error('Comprobante no encontrado');
      }
      const codigo = String(comprobanteActual.codigo || '').toUpperCase();
      if (codigo !== 'TF') {
        throw new Error('La transferencia entre sucursales debe usar el comprobante TF (Transferencia)');
      }
      const serie = comprobanteActual.serie || '';
      const numero = comprobanteActual.numero != null ? String(comprobanteActual.numero) : '';
      docRelacionadoFinal = serie && numero ? `${serie}-${numero}` : (serie || numero || null);
    } else {
      throw new Error('La transferencia requiere comprobante TF');
    }

    const idGrupoMovimiento = randomUUID();
    const fBatch = fechaMovimiento ? new Date(fechaMovimiento) : new Date();
    if (Number.isNaN(fBatch.getTime())) {
      throw new Error('Fecha de movimiento no válida');
    }

    const obsTraslado = `Traslado: ${nombreOrigen} → ${nombreDestino}`;
    const obsBase = observaciones ? String(observaciones).trim() : '';
    const observacionesLinea = obsBase ? `${obsBase} | ${obsTraslado}` : obsTraslado;
    const obsCorta = observacionesLinea.length > 255 ? observacionesLinea.substring(0, 252) + '...' : observacionesLinea;

    const idUbicacionDestino = await ubicacionesPrioridadRepository.getOrCreateDefaultForSucursal(idSucursalDestino);
    let siguienteNumLote = await inventarioRepository.obtenerSiguienteNumeroLote(transaction, idEmpresa);

    let primerIdMovimiento = null;
    const tipoCodigoUi = 'TRANSFERENCIA';

    for (const item of items) {
      const cantidad = parseFloat(item.cantidad) || 0;
      if (cantidad <= 0) continue;

      const disponible = await stockService.obtenerStockDisponible(
        transaction,
        idEmpresa,
        item.idProducto,
        idSucursalOrigen
      );
      if (disponible < cantidad) {
        throw new Error(`Stock insuficiente en origen. Solicitado: ${cantidad}, disponible: ${disponible}`);
      }

      const resultadoDescuento = await stockService.descontarDesdeLotes(transaction, {
        idEmpresa,
        idSucursal: idSucursalOrigen,
        idProducto: item.idProducto,
        cantidad
      }, { controlUbicaciones });

      const consumos = resultadoDescuento?.consumosPorLote || [];
      if (consumos.length === 0) {
        throw new Error('No se pudo descontar stock en sucursal origen (lotes/ubicaciones)');
      }

      let sumCant = 0;
      let sumCosto = 0;
      for (const c of consumos) {
        const ct = Number(c.cantidadTomada) || 0;
        const cu = Number(c.costoUnitario) || 0;
        sumCant += ct;
        sumCosto += ct * cu;
      }
      const costoUnitarioDestino = sumCant > 0 ? sumCosto / sumCant : 0;

      for (const c of consumos) {
        const cantTomada = Number(c.cantidadTomada) || 0;
        if (cantTomada <= 0) continue;
        const idMovSal = await inventarioRepository.insertarFilaMovimiento(transaction, {
          idEmpresa,
          idSucursal: idSucursalOrigen,
          idProducto: item.idProducto,
          tipoMovimiento: 'SA',
          cantidad: cantTomada,
          docRelacionado: docRelacionadoFinal,
          idComprobante: comprobanteActual?.idComprobante || null,
          idUsuario,
          observaciones: obsCorta,
          costoUnitario: c.costoUnitario != null ? Number(c.costoUnitario) : null,
          idLote: c.idLote || null,
          idGrupoMovimiento,
          codigoTipoMovimiento: tipoCodigoUi,
          fMovimiento: fBatch
        });
        if (primerIdMovimiento == null) primerIdMovimiento = idMovSal;
      }

      const numeroLote =
        item.numeroLote != null && item.numeroLote !== ''
          ? String(item.numeroLote)
          : String(siguienteNumLote++);

      const idLoteDest = await inventarioRepository.crearLoteSinCompra(transaction, {
        idEmpresa,
        idProducto: item.idProducto,
        idSucursal: idSucursalDestino,
        costoUnitario: costoUnitarioDestino,
        cantidad: sumCant,
        fechaVencimiento: item.fechaVencimiento || null,
        numeroLote,
        idUbicacionDefault: idUbicacionDestino
      });

      const idMovEnt = await inventarioRepository.insertarFilaMovimiento(transaction, {
        idEmpresa,
        idSucursal: idSucursalDestino,
        idProducto: item.idProducto,
        tipoMovimiento: 'EN',
        cantidad: sumCant,
        docRelacionado: docRelacionadoFinal,
        idComprobante: comprobanteActual?.idComprobante || null,
        idUsuario,
        observaciones: obsCorta,
        costoUnitario: costoUnitarioDestino,
        idLote: idLoteDest,
        idGrupoMovimiento,
        codigoTipoMovimiento: tipoCodigoUi,
        fMovimiento: fBatch
      });
      if (primerIdMovimiento == null) primerIdMovimiento = idMovEnt;
    }

    if (comprobanteActual) {
      const siguiente = (parseInt(comprobanteActual.numero, 10) || 0) + 1;
      await comprobantesRepository.actualizarNumeroComprobante(
        transaction,
        idEmpresa,
        comprobanteActual.idComprobante,
        siguiente
      );
    }

    await transaction.commit();
    return { idMovimiento: primerIdMovimiento, message: 'Transferencia entre sucursales registrada correctamente' };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
  });
}

/**
 * Registra un movimiento unificado (inventario inicial, entrada varia, reajuste, salida/merma).
 * Body: { tipoMovimiento, idSucursal, idSucursalDestino?, fechaMovimiento?, docRelacionado?, observaciones?, items: [{ idProducto, cantidad, costoUnitario?, fechaVencimiento?, numeroLote? }] }
 * tipoMovimiento: ... | DEVOLUCION | TRANSFERENCIA (esta última usa idSucursal origen + idSucursalDestino + comprobante TF)
 */
exports.procesarMovimiento = async (idEmpresa, idUsuario, body) => {
  const { tipoMovimiento, idSucursal, fechaMovimiento, docRelacionado, observaciones, items, idComprobante } = body;

  if (tipoMovimiento === 'TRANSFERENCIA') {
    return procesarTransferenciaEntreSucursales(idEmpresa, idUsuario, body);
  }

  const mapa = TIPOS_MOVIMIENTO[tipoMovimiento];
  if (!mapa) {
    throw new Error('Tipo de movimiento no válido. Use: INVENTARIO_INICIAL, ENTRADA_VARIA, REAJUSTE_POSITIVO, REAJUSTE_NEGATIVO, SALIDA_MERMA, DEVOLUCION, TRANSFERENCIA');
  }
  if (!idSucursal) throw new Error('Sucursal es obligatoria');
  if (!items || !Array.isArray(items) || items.length === 0) throw new Error('Debe incluir al menos un ítem');

  return withPool(async (pool) => {
  const configRows = await gestoresRepository.obtenerConfiguracionEmpresa(pool, idEmpresa).catch(() => []);
  const controlUbicaciones = String(getConfig(configRows, 'INVENTARIO_CONTROL_UBICACIONES', 'true')).toLowerCase() !== 'false';

  let idUbicacionDefault = null;
  if (mapa.esEntrada) {
    idUbicacionDefault = await ubicacionesPrioridadRepository.getOrCreateDefaultForSucursal(idSucursal);
  }

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    let docRelacionadoFinal = docRelacionado || null;
    let comprobanteActual = null;
    if (idComprobante != null && String(idComprobante).trim() !== '') {
      const idComp = parseInt(idComprobante, 10);
      if (Number.isNaN(idComp)) {
        throw new Error('Comprobante inválido');
      }
      const compRes = await comprobantesRepository.obtenerComprobantePorIdEmpresa(transaction, idEmpresa, idComp);
      comprobanteActual = compRes?.recordset?.[0];
      if (!comprobanteActual) {
        throw new Error('Comprobante no encontrado');
      }
      const codigo = String(comprobanteActual.codigo || '').toUpperCase();
      if (!CODIGOS_COMP_INVENTARIO.has(codigo)) {
        throw new Error('Comprobante no válido para inventario');
      }
      const serie = comprobanteActual.serie || '';
      const numero = comprobanteActual.numero != null ? String(comprobanteActual.numero) : '';
      docRelacionadoFinal = serie && numero ? `${serie}-${numero}` : (serie || numero || null);
    }

    let siguienteNumLote = 1;
    if (mapa.esEntrada) {
      siguienteNumLote = await inventarioRepository.obtenerSiguienteNumeroLote(transaction, idEmpresa);
    }

    const idGrupoMovimiento = randomUUID();
    const fBatch = fechaMovimiento ? new Date(fechaMovimiento) : new Date();
    if (Number.isNaN(fBatch.getTime())) {
      throw new Error('Fecha de movimiento no válida');
    }

    let primerIdMovimiento = null;

    for (const item of items) {
      const cantidad = parseFloat(item.cantidad) || 0;
      if (cantidad <= 0) continue;

      let idLote = null;
      if (mapa.esEntrada) {
        const costoUnitario = parseFloat(item.costoUnitario) || 0;
        const numeroLote = item.numeroLote != null && item.numeroLote !== '' ? String(item.numeroLote) : String(siguienteNumLote++);
        idLote = await inventarioRepository.crearLoteSinCompra(transaction, {
          idEmpresa,
          idProducto: item.idProducto,
          idSucursal,
          costoUnitario,
          cantidad,
          fechaVencimiento: item.fechaVencimiento || null,
          numeroLote,
          idUbicacionDefault
        });
      } else {
        const disponible = await stockService.obtenerStockDisponible(transaction, idEmpresa, item.idProducto, idSucursal);
        if (disponible < cantidad) {
          throw new Error(`Stock insuficiente para producto. Solicitado: ${cantidad}, disponible: ${disponible}`);
        }
        const resultadoDescuento = await stockService.descontarDesdeLotes(transaction, {
          idEmpresa,
          idSucursal,
          idProducto: item.idProducto,
          cantidad
        }, { controlUbicaciones });
        const consumos = resultadoDescuento?.consumosPorLote || [];
        if (consumos.length > 0) {
          for (const c of consumos) {
            const cantTomada = Number(c.cantidadTomada) || 0;
            if (cantTomada <= 0) continue;
            const idMov = await inventarioRepository.insertarFilaMovimiento(transaction, {
              idEmpresa,
              idSucursal,
              idProducto: item.idProducto,
              tipoMovimiento: mapa.tipoBD,
              cantidad: cantTomada,
              docRelacionado: docRelacionadoFinal,
              idComprobante: comprobanteActual?.idComprobante || null,
              idUsuario,
              observaciones: observaciones || null,
              costoUnitario: c.costoUnitario != null ? Number(c.costoUnitario) : null,
              idLote: c.idLote || null,
              idGrupoMovimiento,
              codigoTipoMovimiento: tipoMovimiento,
              fMovimiento: fBatch
            });
            if (primerIdMovimiento == null) primerIdMovimiento = idMov;
          }
          continue;
        }
      }

      const idMov = await inventarioRepository.insertarFilaMovimiento(transaction, {
        idEmpresa,
        idSucursal,
        idProducto: item.idProducto,
        tipoMovimiento: mapa.tipoBD,
        cantidad,
        docRelacionado: docRelacionadoFinal,
        idComprobante: comprobanteActual?.idComprobante || null,
        idUsuario,
        observaciones: observaciones || null,
        costoUnitario: mapa.esEntrada ? (parseFloat(item.costoUnitario) || 0) : null,
        idLote,
        idGrupoMovimiento,
        codigoTipoMovimiento: tipoMovimiento,
        fMovimiento: fBatch
      });
      if (primerIdMovimiento == null) primerIdMovimiento = idMov;
    }

    if (comprobanteActual) {
      const siguiente = (parseInt(comprobanteActual.numero, 10) || 0) + 1;
      await comprobantesRepository.actualizarNumeroComprobante(transaction, idEmpresa, comprobanteActual.idComprobante, siguiente);
    }

    await transaction.commit();
    return { idMovimiento: primerIdMovimiento, message: 'Movimiento registrado correctamente' };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
  });
};

/**
 * Lista movimientos con filtros.
 */
exports.listarMovimientos = async (idEmpresa, filtros) => {
  return withPool((pool) => inventarioRepository.listarMovimientos(pool, { ...filtros, idEmpresa }));
};

/**
 * Cabeceras agrupadas para pantalla Movimientos (ingresos/salidas).
 */
exports.listarMovimientosResumen = async (idEmpresa, query) => {
  return withPool(async (pool) => {
    const fechaInicio = query.fechaInicio || query.fechaDesde || null;
    const fechaFinRaw = query.fechaFin || query.fechaHasta || null;
    const toYmd = (v) => (v ? String(v).trim().substring(0, 10) : null);
    const page = query.page != null ? parseInt(String(query.page), 10) : 1;
    const pageSize = query.pageSize != null ? parseInt(String(query.pageSize), 10) : 10;
    const filtros = {
      idEmpresa,
      fechaInicio: toYmd(fechaInicio),
      fechaFin: toYmd(fechaFinRaw),
      idSucursal: query.idSucursal || null,
      codigoTipoMovimiento: query.codigoTipo || null,
      buscar: query.buscar || null,
      page: Number.isNaN(page) ? 1 : page,
      pageSize: Number.isNaN(pageSize) ? 10 : pageSize
    };
    return await inventarioRepository.listarMovimientosResumen(pool, filtros);
  });
};

/**
 * Líneas de una cabecera (idMovimiento representativo).
 */
exports.listarLineasMovimientoCabecera = async (idEmpresa, idMovimiento) => {
  return withPool((pool) =>
    inventarioRepository.listarLineasMovimientoPorCabecera(pool, idEmpresa, idMovimiento)
  );
};

/**
 * Obtiene un movimiento por id (para detalle en modal).
 */
exports.obtenerMovimientoPorId = async (idEmpresa, idMovimiento) => {
  return withPool((pool) => inventarioRepository.obtenerMovimientoPorId(pool, idEmpresa, idMovimiento));
};

/**
 * Tipos de movimiento para el dropdown (frontend).
 */
exports.obtenerTiposMovimiento = () => {
  return [
    { codigo: 'INVENTARIO_INICIAL', descripcion: 'Inventario inicial' },
    { codigo: 'ENTRADA_VARIA', descripcion: 'Entrada varia' },
    { codigo: 'REAJUSTE_POSITIVO', descripcion: 'Reajuste de stock (positivo)' },
    { codigo: 'REAJUSTE_NEGATIVO', descripcion: 'Reajuste de stock (negativo)' },
    { codigo: 'SALIDA_MERMA', descripcion: 'Salida / Merma' },
    { codigo: 'DEVOLUCION', descripcion: 'Devoluciones' },
    { codigo: 'TRANSFERENCIA', descripcion: 'Transferencia entre sucursales' }
  ];
};

/**
 * Stock actual por producto (Lotes agregados). Requiere VER_INVENTARIO o Administrador.
 * Query: idSucursal?, categoria?, marca?, filtroStock=todos|cero|minimo, buscar?
 */
exports.obtenerStockActual = async (user, query) => {
  if (!user || !user.empresa) {
    throw new Error('NO_AUTH');
  }
  return withPool(async (pool) => {
    const esAdmin = user.rol === 'Administrador';
    const puede =
      esAdmin || (await permisosService.verificarPermisoUsuario(pool, 'VER_INVENTARIO', user));
    if (!puede) {
      throw new Error('NO_PERMISO_STOCK_ACTUAL');
    }
    const empresasGestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, user.empresa);
    const idsEmpresa = [
      user.empresa,
      ...(empresasGestionadas || []).map((e) => e.idEmpresa).filter(Boolean)
    ];
    const filtroStockRaw = (query.filtroStock || 'todos').toString().toLowerCase();
    const filtroStock = ['todos', 'cero', 'minimo'].includes(filtroStockRaw) ? filtroStockRaw : 'todos';
    let idSucursal = query.idSucursal && String(query.idSucursal).trim() ? String(query.idSucursal).trim() : null;
    if (idSucursal) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(idSucursal)) {
        idSucursal = null;
      }
    }
    const items = await inventarioRepository.listarStockActual(pool, {
      idsEmpresa,
      idSucursal,
      categoriaLike: query.categoria || null,
      marcaLike: query.marca || null,
      filtroStock,
      buscar: query.buscar || null
    });
    const totalValorizado = items.reduce((s, r) => s + (Number(r.valorizado) || 0), 0);
    return {
      items,
      totalProductos: items.length,
      totalValorizado
    };
  });
};

/**
 * Productos vendidos en rango de fechas (DetalleVenta). Requiere VER_INVENTARIO o Administrador.
 * Query: fechaDesde, fechaHasta, idCliente?, clienteRuc?, clienteRazon?, categoria?, producto?, agrupar, buscar?
 */
exports.obtenerProductosVendidos = async (user, query) => {
  if (!user || !user.empresa) {
    throw new Error('NO_AUTH');
  }
  return withPool(async (pool) => {
    const esAdmin = user.rol === 'Administrador';
    const puede =
      esAdmin || (await permisosService.verificarPermisoUsuario(pool, 'VER_INVENTARIO', user));
    if (!puede) {
      throw new Error('NO_PERMISO_PRODUCTOS_VENDIDOS');
    }
    const empresasGestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, user.empresa);
    const idsEmpresa = [
      user.empresa,
      ...(empresasGestionadas || []).map((e) => e.idEmpresa).filter(Boolean)
    ];
    const fechaDesde = query.fechaDesde || query.desde || null;
    const fechaHasta = query.fechaHasta || query.hasta || null;
    if (!fechaDesde || !fechaHasta) {
      throw new Error('fechaDesde y fechaHasta son obligatorias (YYYY-MM-DD)');
    }
    const agrupar =
      query.agrupar === '1' ||
      query.agrupar === 'true' ||
      String(query.agrupar || '').toLowerCase() === 'si';
    let idCliente = query.idCliente;
    if (idCliente === '' || idCliente === undefined) {
      idCliente = null;
    }
    return await productosVendidosRepository.listarProductosVendidos(pool, {
      idsEmpresa,
      fechaDesde,
      fechaHasta,
      idCliente,
      clienteRucLike: query.clienteRuc || null,
      clienteRazonLike: query.clienteRazon || null,
      categoriaLike: query.categoria || null,
      productoLike: query.producto || null,
      agrupar,
      buscar: query.buscar || null
    });
  });
};

/**
 * Productos comprados (líneas de compra) para reporte inventario.
 */
exports.obtenerProductosComprados = async (user, query) => {
  if (!user || !user.empresa) {
    throw new Error('NO_AUTH');
  }
  return withPool(async (pool) => {
    const esAdmin = user.rol === 'Administrador';
    const puede =
      esAdmin || (await permisosService.verificarPermisoUsuario(pool, 'VER_INVENTARIO', user));
    if (!puede) {
      throw new Error('NO_PERMISO_PRODUCTOS_COMPRADOS');
    }
    const empresasGestionadas = await gestoresRepository.obtenerEmpresasGestionadas(pool, user.empresa);
    const idsEmpresa = [
      user.empresa,
      ...(empresasGestionadas || []).map((e) => e.idEmpresa).filter(Boolean)
    ];
    const fechaDesde = query.fechaDesde || query.desde || null;
    const fechaHasta = query.fechaHasta || query.hasta || null;
    if (!fechaDesde || !fechaHasta) {
      throw new Error('fechaDesde y fechaHasta son obligatorias (YYYY-MM-DD)');
    }
    const agrupar =
      query.agrupar === '1' ||
      query.agrupar === 'true' ||
      String(query.agrupar || '').toLowerCase() === 'si';
    let idProveedor = query.idProveedor;
    if (idProveedor === '' || idProveedor === undefined) {
      idProveedor = null;
    }
    let idComprobante = query.idComprobante;
    if (idComprobante === '' || idComprobante === undefined) {
      idComprobante = null;
    }
    return await productosCompradosRepository.listarProductosComprados(pool, {
      idsEmpresa,
      fechaDesde,
      fechaHasta,
      idProveedor,
      proveedorRucLike: query.proveedorRuc || null,
      proveedorRazonLike: query.proveedorRazon || null,
      idComprobante,
      productoLike: query.producto || null,
      agrupar,
      buscar: query.buscar || null
    });
  });
};
