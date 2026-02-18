const dbConfig = require('../dbconfig');
const sql = require('mssql');
const CreditosServices = require('../services/creditos.service');

// Obtener todos los créditos de la empresa (sin filtrar por cliente)
const obtenerCreditosClienteTodos = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const creditos = await CreditosServices.obtenerCreditosClienteService(pool, req.user, '');

    res.status(200).send({ data: creditos });
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
    console.error("Error obtener créditos:", error);
    res.status(500).send({
      message: "Error al obtener los créditos",
      data: undefined
    });
  }
};

// Obtener créditos por cliente
const obtenerCreditosCliente = async (req, res) => {
  try {
    const { idCliente } = req.params;

    const pool = await sql.connect(dbConfig);
    const creditos = await CreditosServices.obtenerCreditosClienteService(pool, req.user, idCliente);

    res.status(200).send({ data: creditos });
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
    console.error("Error obtener créditos cliente:", error);
    res.status(500).send({
      message: "Error al obtener los créditos del cliente",
      data: undefined
    });
  }
};

// Crear nuevo crédito
const crearCredito = async (req, res) => {
  try {
    const {
      idCliente,
      idVenta,
      montoTotal,
      plazoDias,
      tasaInteres,
      fechaInicio,
      observaciones
    } = req.body;

    // Validación básica
    if (!idCliente || !montoTotal || montoTotal <= 0) {
      return res.status(400).send({
        message: "Datos inválidos: idCliente y montoTotal son requeridos",
        data: undefined
      });
    }

    const pool = await sql.connect(dbConfig);
    const result = await CreditosServices.crearCreditoService(pool, req.user, {
      idCliente,
      idVenta,
      montoTotal,
      plazoDias: plazoDias || 30,
      tasaInteres,
      fechaInicio,
      observaciones
    });

    res.status(200).send({
      message: "Crédito creado exitosamente",
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
    if (error.message === "CLIENTE_NO_ENCONTRADO") {
      return res.status(404).send({
        message: "Cliente no encontrado",
        data: undefined
      });
    }
    console.error("Error crear crédito:", error);
    res.status(500).send({
      message: "Error al crear el crédito",
      data: undefined
    });
  }
};

// Obtener cuotas de un crédito
const obtenerCuotasCredito = async (req, res) => {
  try {
    const { idCredito } = req.params;

    const pool = await sql.connect(dbConfig);
    const cuotas = await CreditosServices.obtenerCuotasCreditoService(pool, req.user, idCredito);

    res.status(200).send({ data: cuotas });
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
    console.error("Error obtener cuotas crédito:", error);
    res.status(500).send({
      message: "Error al obtener las cuotas del crédito",
      data: undefined
    });
  }
};

// Pagar cuota
const pagarCuota = async (req, res) => {
  try {
    const { idCuota } = req.params;
    const {
      montoPagado,
      idMediosPago,
      idMoneda,
      numeroRecibo,
      observaciones,
      idApertura
    } = req.body;

    // Validación básica
    if (!montoPagado || montoPagado <= 0) {
      return res.status(400).send({
        message: "El monto pagado es requerido y debe ser mayor a cero",
        data: undefined
      });
    }

    const pool = await sql.connect(dbConfig);
    const result = await CreditosServices.pagarCuotaService(pool, req.user, {
      idCuota,
      montoPagado,
      idMediosPago,
      idMoneda,
      numeroRecibo,
      observaciones,
      idApertura
    });

    res.status(200).send({
      message: "Pago registrado exitosamente",
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
    if (error.message === "CUOTA_NO_ENCONTRADA") {
      return res.status(404).send({
        message: "Cuota no encontrada o ya está pagada",
        data: undefined
      });
    }
    console.error("Error pagar cuota:", error);
    res.status(500).send({
      message: "Error al procesar el pago",
      data: undefined
    });
  }
};

// Obtener resumen de créditos
const obtenerResumenCreditos = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const resumen = await CreditosServices.obtenerResumenCreditosService(pool, req.user);

    res.status(200).send({ data: resumen });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener resumen créditos:", error);
    res.status(500).send({
      message: "Error al obtener el resumen de créditos",
      data: undefined
    });
  }
};

// Obtener cuotas pendientes por vencer
const obtenerCuotasPendientes = async (req, res) => {
  try {
    const { dias } = req.query; // Días para considerar como "próximas a vencer"

    const pool = await sql.connect(dbConfig);
    const cuotas = await CreditosServices.obtenerCuotasPendientesService(pool, req.user, dias);

    res.status(200).send({ data: cuotas });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener cuotas pendientes:", error);
    res.status(500).send({
      message: "Error al obtener las cuotas pendientes",
      data: undefined
    });
  }
};

// Obtener eficiencia de cobros por usuario
const obtenerEficienciaCobros = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const eficiencia = await CreditosServices.obtenerEficienciaCobrosService(pool, req.user);

    res.status(200).send({ data: eficiencia });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener eficiencia cobros:", error);
    res.status(500).send({
      message: "Error al obtener la eficiencia de cobros",
      data: undefined
    });
  }
};

module.exports = {
  obtenerCreditosClienteTodos,
  obtenerCreditosCliente,
  crearCredito,
  obtenerCuotasCredito,
  pagarCuota,
  obtenerResumenCreditos,
  obtenerCuotasPendientes,
  obtenerEficienciaCobros
};