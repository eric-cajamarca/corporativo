const dbConfig = require('../dbconfig');
const sql = require('mssql');
const CajaServices = require('../services/caja.service');

// Obtener cajas disponibles para la empresa
const obtenerCajas = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const cajas = await CajaServices.obtenerCajasService(pool, req.user);
    res.status(200).send({ data: cajas });
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
      data: undefined
    });
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
      concepto,
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
      concepto,
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
    const { idApertura, fechaDesde, fechaHasta } = req.query;

    const pool = await sql.connect(dbConfig);
    const movimientos = await CajaServices.obtenerMovimientosCajaService(pool, req.user, {
      idApertura,
      fechaDesde,
      fechaHasta
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

module.exports = {
  obtenerCajas,
  abrirCaja,
  cerrarCaja,
  registrarMovimiento,
  obtenerMovimientosCaja,
  obtenerTiposMovimientoCaja,
  obtenerResumenCajaDiario
};