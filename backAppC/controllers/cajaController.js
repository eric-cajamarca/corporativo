const CajaServices = require('../services/caja.service');
const auditoriaOperaciones = require('../services/auditoriaOperaciones.service');
const { resolverIdEmpresaOperacionCaja } = require('../utils/cajaOperacionEmpresa.util');
const { withPool } = require('../utils/dbPool.util');

/** Acepta número o string con separadores (ej. "10,757.1"). */
function parseMontoRequest(val) {
  if (val == null || val === '') return NaN;
  if (typeof val === 'number') return Number.isFinite(val) ? val : NaN;
  const s = String(val).replace(/\s/g, '').replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Si no viene idEmpresaOperacion en query, el servicio de caja usa todas las empresas permitidas (gestora + gestionadas). */
async function resolverIdEmpresaOperacionFiltroMovimientos(pool, user, rawQuery) {
  if (rawQuery == null) return undefined;
  const s = String(rawQuery).trim();
  if (s === '') return undefined;
  return resolverIdEmpresaOperacionCaja(pool, user, rawQuery);
}

// Obtener cajas disponibles para la empresa
const obtenerCajas = async (req, res, next) => {
  try {
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(403).send({ message: 'No autorizado: falta empresa en token', data: [] });
    }
    const cajas = await withPool(async (pool) => {
      const idEmpresaOp = await resolverIdEmpresaOperacionCaja(pool, req.user, req.query.idEmpresaOperacion);
      const userWithEmpresa = { ...req.user, empresa: idEmpresaOp };
      return CajaServices.obtenerCajasService(pool, userWithEmpresa);
    });
    res.status(200).send({ data: Array.isArray(cajas) ? cajas : [] });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({
        message: 'No tiene permisos para realizar esta acción',
        data: undefined
      });
    }
    if (error.message === 'EMPRESA_OPERACION_NO_PERMITIDA') {
      return res.status(403).send({ message: 'Empresa de operación no permitida', data: [] });
    }
    console.error('Error obtener cajas:', error);
    return next(error);
  }
};

// Crear nueva caja
const crearCaja = async (req, res, next) => {
  try {
    const { idSucursal, nombre, descripcion } = req.body;
    if (!idSucursal || !nombre || !nombre.trim()) {
      return res.status(400).send({
        message: 'Sucursal y nombre son obligatorios',
        data: undefined
      });
    }
    const result = await withPool((pool) =>
      CajaServices.crearCajaService(pool, req.user, {
        idSucursal,
        nombre: nombre.trim(),
        descripcion: descripcion || null
      })
    );
    res.status(200).send({
      message: 'Caja registrada correctamente',
      data: result
    });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({ message: 'Sin permisos', data: undefined });
    }
    if (error.message === 'DATOS_INVALIDOS') {
      return res.status(400).send({ message: 'Sucursal y nombre son obligatorios', data: undefined });
    }
    console.error('Error crear caja:', error);
    return next(error);
  }
};

// Abrir caja
const abrirCaja = async (req, res, next) => {
  try {
    const { idCaja, montoInicial, observaciones, fechaApertura } = req.body;

    if (!idCaja || montoInicial === undefined || montoInicial < 0) {
      return res.status(400).send({
        message: 'Datos inválidos: idCaja y montoInicial son requeridos',
        data: undefined
      });
    }

    const result = await withPool((pool) =>
      CajaServices.abrirCajaService(pool, req.user, {
        idCaja,
        montoInicial,
        observaciones,
        fechaApertura
      })
    );

    auditoriaOperaciones.auditarCaja(
      req,
      'ABRIR',
      result?.idApertura,
      idCaja || null,
      `Monto inicial: ${montoInicial}`
    );

    res.status(200).send({
      message: 'Caja abierta exitosamente',
      data: result
    });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({
        message: 'No tiene permisos para realizar esta acción',
        data: undefined
      });
    }
    if (error.message === 'CAJA_YA_ABIERTA') {
      return res.status(400).send({
        message: 'La caja ya está abierta',
        data: undefined
      });
    }
    if (error.message === 'CAJA_SIN_SUCURSAL') {
      return res.status(400).send({
        message: 'La caja no tiene sucursal asignada',
        data: undefined
      });
    }
    console.error('Error abrir caja:', error);
    return next(error);
  }
};

// Cerrar caja
const cerrarCaja = async (req, res, next) => {
  try {
    const { idApertura, montoFinal, observaciones, fechaCierre } = req.body;

    if (!idApertura) {
      return res.status(400).send({
        message: 'Datos inválidos: idApertura es requerido',
        data: undefined
      });
    }
    if (montoFinal !== undefined && montoFinal !== null && Number(montoFinal) < 0) {
      return res.status(400).send({
        message: 'Datos inválidos: montoFinal no puede ser negativo',
        data: undefined
      });
    }

    const result = await withPool((pool) =>
      CajaServices.cerrarCajaService(pool, req.user, {
        idApertura,
        montoFinal,
        observaciones,
        fechaCierre
      })
    );

    auditoriaOperaciones.auditarCaja(
      req,
      'CERRAR',
      result?.idCierre || idApertura,
      null,
      montoFinal != null ? `Monto final: ${montoFinal}` : null
    );

    res.status(200).send({
      message: 'Caja cerrada exitosamente',
      data: result
    });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({
        message: 'No tiene permisos para realizar esta acción',
        data: undefined
      });
    }
    if (error.message === 'APERTURA_NO_ENCONTRADA') {
      return res.status(404).send({
        message: 'Apertura de caja no encontrada o ya cerrada',
        data: undefined
      });
    }
    console.error('Error cerrar caja:', error);
    return next(error);
  }
};

// Registrar movimiento de caja
const registrarMovimiento = async (req, res, next) => {
  try {
    const {
      idApertura,
      idTipoMovimientoCaja,
      fechaMovimiento,
      concepto,
      idConcepto,
      monto,
      idMediosPago,
      idMoneda,
      documentoRelacionado,
      observaciones
    } = req.body;

    const idTipoNum = idTipoMovimientoCaja != null && idTipoMovimientoCaja !== ''
      ? Number(idTipoMovimientoCaja)
      : NaN;
    const montoNum = parseMontoRequest(monto);
    const conceptoTxt = concepto != null ? String(concepto).trim() : '';
    const tieneConceptoCatalogo =
      idConcepto != null && String(idConcepto).trim() !== '';

    if (!idApertura || !Number.isFinite(idTipoNum) || idTipoNum <= 0) {
      return res.status(400).send({
        message: 'Datos inválidos: idApertura e idTipoMovimientoCaja (tipo de ingreso/egreso) son requeridos.',
        data: undefined
      });
    }
    if (!conceptoTxt && !tieneConceptoCatalogo) {
      return res.status(400).send({
        message: 'Datos inválidos: indique concepto (texto) o concepto del catálogo (idConcepto).',
        data: undefined
      });
    }
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return res.status(400).send({
        message: 'Datos inválidos: el monto debe ser un número mayor a 0.',
        data: undefined
      });
    }

    const result = await withPool((pool) =>
      CajaServices.registrarMovimientoService(pool, req.user, {
        idApertura,
        idTipoMovimientoCaja: idTipoNum,
        fechaMovimiento: fechaMovimiento || null,
        concepto: conceptoTxt || concepto || '',
        idConcepto: idConcepto || null,
        monto: montoNum,
        idMediosPago,
        idMoneda,
        documentoRelacionado,
        observaciones,
        idEmpresaOperacion: req.body.idEmpresaOperacion
      })
    );

    auditoriaOperaciones.auditarCaja(
      req,
      'MOVIMIENTO',
      result?.idMovimientoCaja,
      result?.documentoRelacionado || documentoRelacionado || null,
      conceptoTxt || concepto || null
    );

    res.status(200).send({
      message: 'Movimiento registrado exitosamente',
      data: result
    });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({
        message: 'No tiene permisos para realizar esta acción',
        data: undefined
      });
    }
    if (error.message === 'EMPRESA_OPERACION_NO_PERMITIDA') {
      return res.status(403).send({ message: 'Empresa de operación no permitida', data: undefined });
    }
    if (error.message === 'CAJA_NO_ABIERTA') {
      return res.status(400).send({
        message: 'La caja no está abierta',
        data: undefined
      });
    }
    if (error.message === 'CONCEPTO_NO_ENCONTRADO' || error.message === 'EL_CONCEPTO_NO_COINCIDE_CON_EL_TIPO_DE_MOVIMIENTO') {
      return res.status(400).send({
        message:
          error.message === 'EL_CONCEPTO_NO_COINCIDE_CON_EL_TIPO_DE_MOVIMIENTO'
            ? 'El concepto no coincide con el tipo de movimiento (Ingreso/Egreso).'
            : 'Concepto no encontrado.',
        data: undefined
      });
    }
    if (error.message === 'COMPROBANTE_RI_RE_NO_CONFIGURADO') {
      return res.status(400).send({
        message:
          'No hay fila en Comprobantes con código RI o RE para la misma empresa y la misma sucursal que la caja abierta ' +
          '(AperturasCaja.idSucursal = Comprobantes.idSucursal). Revise catálogo de comprobantes por sucursal, no solo por empresa.',
        data: undefined
      });
    }
    console.error('Error registrar movimiento:', error);
    return next(error);
  }
};

// Obtener movimientos de caja
const obtenerMovimientosCaja = async (req, res, next) => {
  try {
    const { idApertura, idCaja, fechaDesde, fechaHasta, tipoMovimiento, soloRecibos } = req.query;

    const movimientos = await withPool(async (pool) => {
      const idEmpresaOpFiltro = await resolverIdEmpresaOperacionFiltroMovimientos(
        pool,
        req.user,
        req.query.idEmpresaOperacion
      );
      return CajaServices.obtenerMovimientosCajaService(pool, req.user, {
        idApertura,
        idCaja: idCaja || null,
        fechaDesde,
        fechaHasta,
        tipoMovimiento: tipoMovimiento || null,
        soloRecibos: soloRecibos === 'true' || soloRecibos === true,
        idEmpresaOperacion: idEmpresaOpFiltro
      });
    });

    res.status(200).send({ data: movimientos });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({
        message: 'No tiene permisos para realizar esta acción',
        data: undefined
      });
    }
    if (error.message === 'EMPRESA_OPERACION_NO_PERMITIDA') {
      return res.status(403).send({ message: 'Empresa de operación no permitida', data: undefined });
    }
    console.error('Error obtener movimientos:', error);
    return next(error);
  }
};

// Obtener tipos de movimiento de caja
const obtenerTiposMovimientoCaja = async (req, res, next) => {
  try {
    const tipos = await withPool((pool) => CajaServices.obtenerTiposMovimientoCajaService(pool, req.user));
    res.status(200).send({ data: tipos });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    console.error('Error obtener tipos movimiento:', error);
    return next(error);
  }
};

// Crear tipo de movimiento de caja
const crearTipoMovimientoCaja = async (req, res, next) => {
  try {
    const { nombre, descripcion, tipo } = req.body;
    const result = await withPool((pool) =>
      CajaServices.crearTipoMovimientoCajaService(pool, req.user, { nombre, descripcion, tipo })
    );
    res.status(201).send({ message: 'Tipo de movimiento creado', data: result });
  } catch (error) {
    if (error.message === 'NO_ACCESS') return res.status(401).send({ message: 'No autorizado', data: undefined });
    if (error.message === 'NO_PERMISSIONS') return res.status(403).send({ message: 'Sin permisos', data: undefined });
    if ((error.message && error.message.includes('UNIQUE')) || error.code === 'EREQUEST') {
      return res.status(400).send({ message: 'Ya existe un tipo con ese nombre', data: undefined });
    }
    console.error('Error crear tipo movimiento:', error);
    return next(error);
  }
};

// Actualizar tipo de movimiento de caja
const actualizarTipoMovimientoCaja = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).send({ message: 'ID inválido', data: undefined });
    const { nombre, descripcion, tipo } = req.body;
    await withPool((pool) => CajaServices.actualizarTipoMovimientoCajaService(pool, req.user, id, { nombre, descripcion, tipo }));
    res.status(200).send({ message: 'Tipo de movimiento actualizado', data: undefined });
  } catch (error) {
    if (error.message === 'NO_ACCESS') return res.status(401).send({ message: 'No autorizado', data: undefined });
    if (error.message === 'NO_PERMISSIONS') return res.status(403).send({ message: 'Sin permisos', data: undefined });
    console.error('Error actualizar tipo movimiento:', error);
    return next(error);
  }
};

// Eliminar tipo de movimiento de caja
const eliminarTipoMovimientoCaja = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).send({ message: 'ID inválido', data: undefined });
    await withPool((pool) => CajaServices.eliminarTipoMovimientoCajaService(pool, req.user, id));
    res.status(200).send({ message: 'Tipo de movimiento eliminado', data: undefined });
  } catch (error) {
    if (error.message === 'NO_ACCESS') return res.status(401).send({ message: 'No autorizado', data: undefined });
    if (error.message === 'NO_PERMISSIONS') return res.status(403).send({ message: 'Sin permisos', data: undefined });
    if (error.message === 'Tipo de movimiento no encontrado.') return res.status(404).send({ message: error.message, data: undefined });
    console.error('Error eliminar tipo movimiento:', error);
    return next(error);
  }
};

// Recibos de egreso (movimientos tipo Egreso)
const obtenerRecibosEgreso = async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta } = req.query;
    const lista = await withPool(async (pool) => {
      const idEmpresaOpFiltro = await resolverIdEmpresaOperacionFiltroMovimientos(
        pool,
        req.user,
        req.query.idEmpresaOperacion
      );
      return CajaServices.obtenerRecibosEgresoService(pool, req.user, {
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
        idEmpresaOperacion: idEmpresaOpFiltro
      });
    });
    res.status(200).send({ data: lista });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({ message: 'Sin permisos', data: undefined });
    }
    if (error.message === 'EMPRESA_OPERACION_NO_PERMITIDA') {
      return res.status(403).send({ message: 'Empresa de operación no permitida', data: undefined });
    }
    console.error('Error obtener recibos egreso:', error);
    return next(error);
  }
};

// Eliminar movimiento (recibo egreso)
const eliminarMovimientoCaja = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await withPool((pool) => CajaServices.eliminarMovimientoCajaService(pool, req.user, id));
    if (deleted === 0) {
      return res.status(404).send({ message: 'Movimiento no encontrado', data: undefined });
    }
    res.status(200).send({ message: 'Movimiento eliminado', data: deleted });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({ message: 'Sin permisos', data: undefined });
    }
    if (error.message === 'EMPRESA_OPERACION_NO_PERMITIDA') {
      return res.status(403).send({ message: 'Empresa de operación no permitida', data: undefined });
    }
    console.error('Error eliminar movimiento:', error);
    return next(error);
  }
};

// Actualizar movimiento (recibo egreso)
const actualizarMovimientoCaja = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { concepto, idConcepto, monto, idMediosPago, documentoRelacionado, observaciones } = req.body;
    const conceptoUpd = concepto != null ? String(concepto).trim() : '';
    const tieneCat = idConcepto != null && String(idConcepto).trim() !== '';
    const montoUpd = parseMontoRequest(monto);
    if ((!conceptoUpd && !tieneCat) || !Number.isFinite(montoUpd) || montoUpd <= 0) {
      return res.status(400).send({
        message: 'concepto (o idConcepto) y monto válido son requeridos',
        data: undefined
      });
    }
    const updated = await withPool((pool) =>
      CajaServices.actualizarMovimientoCajaService(pool, req.user, {
        idMovimientoCaja: id,
        concepto: conceptoUpd || concepto || '',
        idConcepto: idConcepto || null,
        monto: montoUpd,
        idMediosPago: idMediosPago || null,
        documentoRelacionado: documentoRelacionado || null,
        observaciones: observaciones || null
      })
    );
    if (updated === 0) {
      return res.status(404).send({ message: 'Movimiento no encontrado', data: undefined });
    }
    res.status(200).send({ message: 'Movimiento actualizado', data: updated });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({ message: 'Sin permisos', data: undefined });
    }
    if (error.message === 'EMPRESA_OPERACION_NO_PERMITIDA') {
      return res.status(403).send({ message: 'Empresa de operación no permitida', data: undefined });
    }
    console.error('Error actualizar movimiento:', error);
    return next(error);
  }
};

// Obtener resumen de caja diario
const obtenerResumenCajaDiario = async (req, res, next) => {
  try {
    const { fecha } = req.query;

    const resumen = await withPool((pool) => CajaServices.obtenerResumenCajaDiarioService(pool, req.user, fecha));

    res.status(200).send({ data: resumen });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({
        message: 'No tiene permisos para realizar esta acción',
        data: undefined
      });
    }
    console.error('Error obtener resumen caja:', error);
    return next(error);
  }
};

// Arqueo dinámico: conceptos y formas de pago. Filtro por fecha única o por rango (fechaInicial, fechaFinal)
const obtenerArqueoDinamico = async (req, res, next) => {
  try {
    const { fecha, fechaInicial, fechaFinal, idCaja } = req.query;
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(403).send({ message: 'No autorizado: falta empresa', data: undefined });
    }
    const result = await withPool((pool) =>
      CajaServices.obtenerArqueoDinamicoService(pool, req.user, {
        fecha: fecha || undefined,
        fechaInicial: fechaInicial || undefined,
        fechaFinal: fechaFinal || undefined,
        idCaja: idCaja || 'TODAS'
      })
    );
    res.status(200).send({
      data: result.movimientos || [],
      detalle: result.detalle || [],
      ventasCredito: result.ventasCredito || { concepto: 'VENTA CREDITO', importe: 0 },
      cobroCreditos: result.cobroCreditos || { concepto: 'COBRO CREDITOS', importe: 0 },
      totalesPorEmpresa: result.totalesPorEmpresa,
      totalesPorSucursal: result.totalesPorSucursal
    });
  } catch (error) {
    if (error.message === 'NO_ACCESS') {
      return res.status(401).send({ message: 'No autorizado', data: undefined });
    }
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({ message: 'Sin permisos', data: undefined });
    }
    console.error('Error obtener arqueo dinámico:', error);
    return next(error);
  }
};

// Contexto empresa operación caja (gestora + gestionadas) y default desde config
const obtenerContextoOperacionCaja = async (req, res, next) => {
  try {
    const data = await withPool((pool) => CajaServices.obtenerContextoOperacionCajaService(pool, req.user));
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') return res.status(401).send({ message: 'No autorizado', data: undefined });
    if (error.message === 'NO_PERMISSIONS') return res.status(403).send({ message: 'Sin permisos', data: undefined });
    console.error('Error contexto operación caja:', error);
    return next(error);
  }
};

const guardarEmpresaOperacionCajaDefault = async (req, res, next) => {
  try {
    const { idEmpresaOperacion } = req.body || {};
    const data = await withPool((pool) =>
      CajaServices.guardarEmpresaOperacionCajaDefaultService(pool, req.user, idEmpresaOperacion)
    );
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === 'NO_ACCESS') return res.status(401).send({ message: 'No autorizado', data: undefined });
    if (error.message === 'NO_PERMISSIONS') {
      return res.status(403).send({ message: 'Solo la empresa gestora puede guardar el valor por defecto.', data: undefined });
    }
    if (error.message === 'EMPRESA_OPERACION_NO_PERMITIDA' || error.message === 'ID_EMPRESA_DEFAULT_INVALIDO') {
      return res.status(400).send({ message: error.message, data: undefined });
    }
    console.error('Error guardar default operación caja:', error);
    return next(error);
  }
};

module.exports = {
  obtenerCajas,
  crearCaja,
  abrirCaja,
  cerrarCaja,
  registrarMovimiento,
  obtenerMovimientosCaja,
  obtenerRecibosEgreso,
  eliminarMovimientoCaja,
  actualizarMovimientoCaja,
  obtenerTiposMovimientoCaja,
  crearTipoMovimientoCaja,
  actualizarTipoMovimientoCaja,
  eliminarTipoMovimientoCaja,
  obtenerResumenCajaDiario,
  obtenerArqueoDinamico,
  obtenerContextoOperacionCaja,
  guardarEmpresaOperacionCajaDefault
};
