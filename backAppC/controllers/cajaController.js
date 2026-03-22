const dbConfig = require('../dbconfig');
const sql = require('mssql');
const CajaServices = require('../services/caja.service');

// Obtener cajas disponibles para la empresa
const obtenerCajas = async (req, res) => {
  try {
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(403).send({ message: 'No autorizado: falta empresa en token', data: [] });
    }
    const pool = await sql.connect(dbConfig);
    const userWithEmpresa = { ...req.user, empresa: idEmpresa };
    const cajas = await CajaServices.obtenerCajasService(pool, userWithEmpresa);
    res.status(200).send({ data: Array.isArray(cajas) ? cajas : [] });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({
        message: "No tiene permisos para realizar esta acción",
        data: undefined
      });
    }
    console.error("Error obtener cajas:", error);
    res.status(500).send({
      message: "Error al obtener las cajas",
      data: []
    });
  }
};

// Crear nueva caja
const crearCaja = async (req, res) => {
  try {
    const { idSucursal, nombre, descripcion } = req.body;
    if (!idSucursal || !nombre || !nombre.trim()) {
      return res.status(400).send({
        message: "Sucursal y nombre son obligatorios",
        data: undefined
      });
    }
    const pool = await sql.connect(dbConfig);
    const result = await CajaServices.crearCajaService(pool, req.user, {
      idSucursal,
      nombre: nombre.trim(),
      descripcion: descripcion || null
    });
    res.status(200).send({
      message: "Caja registrada correctamente",
      data: result
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({ message: "Sin permisos", data: undefined });
    }
    if (error.message === "DATOS_INVALIDOS") {
      return res.status(400).send({ message: "Sucursal y nombre son obligatorios", data: undefined });
    }
    console.error("Error crear caja:", error);
    res.status(500).send({ message: "Error al registrar la caja", data: undefined });
  }
};

// Abrir caja
const abrirCaja = async (req, res) => {
  try {
    const { idCaja, montoInicial, observaciones } = req.body;

    // Validación básica
    if (!idCaja || montoInicial === undefined || montoInicial < 0) {
      return res.status(400).send({
        message: "Datos inválidos: idCaja y montoInicial son requeridos",
        data: undefined
      });
    }

    const pool = await sql.connect(dbConfig);
    const result = await CajaServices.abrirCajaService(pool, req.user, {
      idCaja,
      montoInicial,
      observaciones
    });

    res.status(200).send({
      message: "Caja abierta exitosamente",
      data: result
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({
        message: "No tiene permisos para realizar esta acción",
        data: undefined
      });
    }
    if (error.message === "CAJA_YA_ABIERTA") {
      return res.status(400).send({
        message: "La caja ya está abierta",
        data: undefined
      });
    }
    if (error.message === "CAJA_SIN_SUCURSAL") {
      return res.status(400).send({
        message: "La caja no tiene sucursal asignada",
        data: undefined
      });
    }
    console.error("Error abrir caja:", error);
    res.status(500).send({
      message: "Error al abrir la caja",
      data: undefined
    });
  }
};

// Cerrar caja
const cerrarCaja = async (req, res) => {
  try {
    const { idApertura, montoFinal, observaciones } = req.body;

    // Validación básica
    if (!idApertura || montoFinal === undefined || montoFinal < 0) {
      return res.status(400).send({
        message: "Datos inválidos: idApertura y montoFinal son requeridos",
        data: undefined
      });
    }

    const pool = await sql.connect(dbConfig);
    const result = await CajaServices.cerrarCajaService(pool, req.user, {
      idApertura,
      montoFinal,
      observaciones
    });

    res.status(200).send({
      message: "Caja cerrada exitosamente",
      data: result
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({
        message: "No tiene permisos para realizar esta acción",
        data: undefined
      });
    }
    if (error.message === "APERTURA_NO_ENCONTRADA") {
      return res.status(404).send({
        message: "Apertura de caja no encontrada o ya cerrada",
        data: undefined
      });
    }
    console.error("Error cerrar caja:", error);
    res.status(500).send({
      message: "Error al cerrar la caja",
      data: undefined
    });
  }
};

// Registrar movimiento de caja
const registrarMovimiento = async (req, res) => {
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

    // Validación básica
    if (!idApertura || !idTipoMovimientoCaja || !concepto || monto === undefined || monto <= 0) {
      return res.status(400).send({
        message: "Datos inválidos: idApertura, idTipoMovimientoCaja, concepto y monto son requeridos",
        data: undefined
      });
    }

    const pool = await sql.connect(dbConfig);
    const result = await CajaServices.registrarMovimientoService(pool, req.user, {
      idApertura,
      idTipoMovimientoCaja,
      fechaMovimiento: fechaMovimiento || null,
      concepto,
      idConcepto: idConcepto || null,
      monto,
      idMediosPago,
      idMoneda,
      documentoRelacionado,
      observaciones
    });

    res.status(200).send({
      message: "Movimiento registrado exitosamente",
      data: result
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({
        message: "No tiene permisos para realizar esta acción",
        data: undefined
      });
    }
    if (error.message === "CAJA_NO_ABIERTA") {
      return res.status(400).send({
        message: "La caja no está abierta",
        data: undefined
      });
    }
    if (error.message === "CONCEPTO_NO_ENCONTRADO" || error.message === "EL_CONCEPTO_NO_COINCIDE_CON_EL_TIPO_DE_MOVIMIENTO") {
      return res.status(400).send({
        message: error.message === "EL_CONCEPTO_NO_COINCIDE_CON_EL_TIPO_DE_MOVIMIENTO" ? "El concepto no coincide con el tipo de movimiento (Ingreso/Egreso)." : "Concepto no encontrado.",
        data: undefined
      });
    }
    if (error.message === "COMPROBANTE_RI_RE_NO_CONFIGURADO") {
      return res.status(400).send({
        message: "No está configurado el comprobante RI o RE para esta empresa. Ejecute la migración de Comprobantes.",
        data: undefined
      });
    }
    console.error("Error registrar movimiento:", error);
    res.status(500).send({
      message: "Error al registrar el movimiento",
      data: undefined
    });
  }
};

// Obtener movimientos de caja
const obtenerMovimientosCaja = async (req, res) => {
  try {
    const { idApertura, idCaja, fechaDesde, fechaHasta, tipoMovimiento, soloRecibos } = req.query;

    const pool = await sql.connect(dbConfig);
    const movimientos = await CajaServices.obtenerMovimientosCajaService(pool, req.user, {
      idApertura,
      idCaja: idCaja || null,
      fechaDesde,
      fechaHasta,
      tipoMovimiento: tipoMovimiento || null,
      soloRecibos: soloRecibos === "true" || soloRecibos === true
    });

    res.status(200).send({ data: movimientos });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({
        message: "No tiene permisos para realizar esta acción",
        data: undefined
      });
    }
    console.error("Error obtener movimientos:", error);
    res.status(500).send({
      message: "Error al obtener los movimientos de caja",
      data: undefined
    });
  }
};

// Obtener tipos de movimiento de caja
const obtenerTiposMovimientoCaja = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const tipos = await CajaServices.obtenerTiposMovimientoCajaService(pool, req.user);
    res.status(200).send({ data: tipos });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener tipos movimiento:", error);
    res.status(500).send({
      message: "Error al obtener los tipos de movimiento",
      data: undefined
    });
  }
};

// Crear tipo de movimiento de caja
const crearTipoMovimientoCaja = async (req, res) => {
  try {
    const { nombre, descripcion, tipo } = req.body;
    const pool = await sql.connect(dbConfig);
    const result = await CajaServices.crearTipoMovimientoCajaService(pool, req.user, { nombre, descripcion, tipo });
    res.status(201).send({ message: "Tipo de movimiento creado", data: result });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    if (error.message === "NO_PERMISSIONS") return res.status(403).send({ message: "Sin permisos", data: undefined });
    if ((error.message && error.message.includes("UNIQUE")) || error.code === "EREQUEST") {
      return res.status(400).send({ message: "Ya existe un tipo con ese nombre", data: undefined });
    }
    console.error("Error crear tipo movimiento:", error);
    res.status(500).send({ message: error.message || "Error al crear tipo de movimiento", data: undefined });
  }
};

// Actualizar tipo de movimiento de caja
const actualizarTipoMovimientoCaja = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).send({ message: "ID inválido", data: undefined });
    const { nombre, descripcion, tipo } = req.body;
    const pool = await sql.connect(dbConfig);
    await CajaServices.actualizarTipoMovimientoCajaService(pool, req.user, id, { nombre, descripcion, tipo });
    res.status(200).send({ message: "Tipo de movimiento actualizado", data: undefined });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    if (error.message === "NO_PERMISSIONS") return res.status(403).send({ message: "Sin permisos", data: undefined });
    console.error("Error actualizar tipo movimiento:", error);
    res.status(500).send({ message: error.message || "Error al actualizar", data: undefined });
  }
};

// Eliminar tipo de movimiento de caja
const eliminarTipoMovimientoCaja = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).send({ message: "ID inválido", data: undefined });
    const pool = await sql.connect(dbConfig);
    await CajaServices.eliminarTipoMovimientoCajaService(pool, req.user, id);
    res.status(200).send({ message: "Tipo de movimiento eliminado", data: undefined });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    if (error.message === "NO_PERMISSIONS") return res.status(403).send({ message: "Sin permisos", data: undefined });
    if (error.message === "Tipo de movimiento no encontrado.") return res.status(404).send({ message: error.message, data: undefined });
    console.error("Error eliminar tipo movimiento:", error);
    res.status(500).send({ message: error.message || "Error al eliminar", data: undefined });
  }
};

// Recibos de egreso (movimientos tipo Egreso)
const obtenerRecibosEgreso = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta } = req.query;
    const pool = await sql.connect(dbConfig);
    const lista = await CajaServices.obtenerRecibosEgresoService(pool, req.user, {
      fechaDesde: fechaDesde || null,
      fechaHasta: fechaHasta || null
    });
    res.status(200).send({ data: lista });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({ message: "Sin permisos", data: undefined });
    }
    console.error("Error obtener recibos egreso:", error);
    res.status(500).send({ message: "Error al obtener recibos de egreso", data: undefined });
  }
};

// Eliminar movimiento (recibo egreso)
const eliminarMovimientoCaja = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await sql.connect(dbConfig);
    const deleted = await CajaServices.eliminarMovimientoCajaService(pool, req.user, id);
    if (deleted === 0) {
      return res.status(404).send({ message: "Movimiento no encontrado", data: undefined });
    }
    res.status(200).send({ message: "Movimiento eliminado", data: deleted });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({ message: "Sin permisos", data: undefined });
    }
    console.error("Error eliminar movimiento:", error);
    res.status(500).send({ message: "Error al eliminar", data: undefined });
  }
};

// Actualizar movimiento (recibo egreso)
const actualizarMovimientoCaja = async (req, res) => {
  try {
    const { id } = req.params;
    const { concepto, idConcepto, monto, idMediosPago, documentoRelacionado, observaciones } = req.body;
    if (!concepto || monto === undefined || monto <= 0) {
      return res.status(400).send({
        message: "concepto y monto son requeridos",
        data: undefined
      });
    }
    const pool = await sql.connect(dbConfig);
    const updated = await CajaServices.actualizarMovimientoCajaService(pool, req.user, {
      idMovimientoCaja: id,
      concepto,
      idConcepto: idConcepto || null,
      monto,
      idMediosPago: idMediosPago || null,
      documentoRelacionado: documentoRelacionado || null,
      observaciones: observaciones || null
    });
    if (updated === 0) {
      return res.status(404).send({ message: "Movimiento no encontrado", data: undefined });
    }
    res.status(200).send({ message: "Movimiento actualizado", data: updated });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({ message: "Sin permisos", data: undefined });
    }
    console.error("Error actualizar movimiento:", error);
    res.status(500).send({ message: "Error al actualizar", data: undefined });
  }
};

// Obtener resumen de caja diario
const obtenerResumenCajaDiario = async (req, res) => {
  try {
    const { fecha } = req.query;

    const pool = await sql.connect(dbConfig);
    const resumen = await CajaServices.obtenerResumenCajaDiarioService(pool, req.user, fecha);

    res.status(200).send({ data: resumen });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({
        message: "No tiene permisos para realizar esta acción",
        data: undefined
      });
    }
    console.error("Error obtener resumen caja:", error);
    res.status(500).send({
      message: "Error al obtener el resumen de caja",
      data: undefined
    });
  }
};

// Arqueo dinámico: conceptos y formas de pago. Filtro por fecha única o por rango (fechaInicial, fechaFinal)
const obtenerArqueoDinamico = async (req, res) => {
  try {
    const { fecha, fechaInicial, fechaFinal, idCaja } = req.query;
    const pool = await sql.connect(dbConfig);
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(403).send({ message: "No autorizado: falta empresa", data: undefined });
    }
    const result = await CajaServices.obtenerArqueoDinamicoService(pool, req.user, {
      fecha: fecha || undefined,
      fechaInicial: fechaInicial || undefined,
      fechaFinal: fechaFinal || undefined,
      idCaja: idCaja || "TODAS"
    });
    res.status(200).send({
      data: result.movimientos || [],
      detalle: result.detalle || [],
      ventasCredito: result.ventasCredito || { concepto: 'VENTA CREDITO', importe: 0 },
      cobroCreditos: result.cobroCreditos || { concepto: 'COBRO CREDITOS', importe: 0 }
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "NO_PERMISSIONS") {
      return res.status(403).send({ message: "Sin permisos", data: undefined });
    }
    console.error("Error obtener arqueo dinámico:", error);
    res.status(500).send({ message: "Error al obtener arqueo", data: undefined });
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
  obtenerArqueoDinamico
};