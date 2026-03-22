// services/inventario.service.js
const sql = require('mssql');
const dbConfig = require('../dbconfig');
const inventarioRepository = require('../repositories/inventario.repository');
const gestoresRepository = require('../repositories/gestores.repository');
const stockService = require('./stock.service');
const ubicacionesPrioridadRepository = require('../repositories/ubicacionesPrioridad.repository');
const comprobantesRepository = require('../repositories/comprobantes.repository');

/** Mapeo tipo frontend -> { tipoBD: 'EN'|'SA'|'AJ', esEntrada: boolean } */
const TIPOS_MOVIMIENTO = {
  INVENTARIO_INICIAL: { tipoBD: 'EN', esEntrada: true },
  ENTRADA_VARIA: { tipoBD: 'EN', esEntrada: true },
  REAJUSTE_POSITIVO: { tipoBD: 'AJ', esEntrada: true },
  REAJUSTE_NEGATIVO: { tipoBD: 'AJ', esEntrada: false },
  SALIDA_MERMA: { tipoBD: 'SA', esEntrada: false }
};

function getConfig(configRows, clave, def) {
  const row = configRows && configRows.find(c => c.clave === clave);
  return row && row.valor != null ? row.valor : def;
}

/**
 * Registra un movimiento unificado (inventario inicial, entrada varia, reajuste, salida/merma).
 * Body: { tipoMovimiento, idSucursal, fechaMovimiento?, docRelacionado?, observaciones?, items: [{ idProducto, cantidad, costoUnitario?, fechaVencimiento?, numeroLote? }] }
 * tipoMovimiento: INVENTARIO_INICIAL | ENTRADA_VARIA | REAJUSTE_POSITIVO | REAJUSTE_NEGATIVO | SALIDA_MERMA
 */
exports.procesarMovimiento = async (idEmpresa, idUsuario, body) => {
  const { tipoMovimiento, idSucursal, fechaMovimiento, docRelacionado, observaciones, items, idComprobante } = body;

  const mapa = TIPOS_MOVIMIENTO[tipoMovimiento];
  if (!mapa) {
    throw new Error('Tipo de movimiento no válido. Use: INVENTARIO_INICIAL, ENTRADA_VARIA, REAJUSTE_POSITIVO, REAJUSTE_NEGATIVO, SALIDA_MERMA');
  }
  if (!idSucursal) throw new Error('Sucursal es obligatoria');
  if (!items || !Array.isArray(items) || items.length === 0) throw new Error('Debe incluir al menos un ítem');

  const pool = await sql.connect(dbConfig);
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
      const codigosValidos = new Set(['IV', 'II', 'IN', 'SA']);
      if (!codigosValidos.has(codigo)) {
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
              idLote: c.idLote || null
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
        idLote
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
};

/**
 * Lista movimientos con filtros.
 */
exports.listarMovimientos = async (idEmpresa, filtros) => {
  const pool = await sql.connect(dbConfig);
  return await inventarioRepository.listarMovimientos(pool, { ...filtros, idEmpresa });
};

/**
 * Obtiene un movimiento por id (para detalle en modal).
 */
exports.obtenerMovimientoPorId = async (idEmpresa, idMovimiento) => {
  const pool = await sql.connect(dbConfig);
  try {
    return await inventarioRepository.obtenerMovimientoPorId(pool, idEmpresa, idMovimiento);
  } finally {
    pool.close && pool.close().catch(() => {});
  }
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
    { codigo: 'SALIDA_MERMA', descripcion: 'Salida / Merma' }
  ];
};
