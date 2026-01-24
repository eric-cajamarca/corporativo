const dbConfig = require('../dbconfig');
const sql = require('mssql');
const FacturacionServices = require('../services/facturacion.service');

// Obtener configuración de facturación electrónica
const obtenerConfiguracionFacturacion = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const configuracion = await FacturacionServices.obtenerConfiguracionFacturacionService(pool, req.user);

    res.status(200).send({ data: configuracion });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener configuración facturación:", error);
    res.status(500).send({
      message: "Error al obtener la configuración de facturación",
      data: undefined
    });
  }
};

// Actualizar configuración de facturación electrónica
const actualizarConfiguracionFacturacion = async (req, res) => {
  try {
    const {
      certificadoDigital,
      claveCertificado,
      usuarioSunat,
      claveSunat,
      modoPrueba,
      serieFactura,
      serieBoleta,
      serieNotaCredito,
      serieNotaDebito
    } = req.body;

    const pool = await sql.connect(dbConfig);
    const result = await FacturacionServices.actualizarConfiguracionFacturacionService(pool, req.user, {
      certificadoDigital,
      claveCertificado,
      usuarioSunat,
      claveSunat,
      modoPrueba,
      serieFactura,
      serieBoleta,
      serieNotaCredito,
      serieNotaDebito
    });

    res.status(200).send({
      message: "Configuración de facturación actualizada exitosamente",
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
    console.error("Error actualizar configuración facturación:", error);
    res.status(500).send({
      message: "Error al actualizar la configuración de facturación",
      data: undefined
    });
  }
};

// Obtener comprobantes electrónicos
const obtenerComprobantesElectronicos = async (req, res) => {
  try {
    const { tipoComprobante, estadoSunat, fechaDesde, fechaHasta } = req.query;

    const pool = await sql.connect(dbConfig);
    const comprobantes = await FacturacionServices.obtenerComprobantesElectronicosService(pool, req.user, {
      tipoComprobante,
      estadoSunat,
      fechaDesde,
      fechaHasta
    });

    res.status(200).send({ data: comprobantes });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener comprobantes electrónicos:", error);
    res.status(500).send({
      message: "Error al obtener los comprobantes electrónicos",
      data: undefined
    });
  }
};

// Generar comprobante electrónico
const generarComprobanteElectronico = async (req, res) => {
  try {
    const { idVenta, tipoComprobante } = req.body;

    // Validación básica
    if (!idVenta || !tipoComprobante) {
      return res.status(400).send({
        message: "Datos inválidos: idVenta y tipoComprobante son requeridos",
        data: undefined
      });
    }

    const pool = await sql.connect(dbConfig);
    const result = await FacturacionServices.generarComprobanteElectronicoService(pool, req.user, {
      idVenta,
      tipoComprobante
    });

    res.status(200).send({
      message: "Comprobante electrónico generado exitosamente",
      data: result
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "VENTA_NO_ENCONTRADA") {
      return res.status(404).send({
        message: "Venta no encontrada",
        data: undefined
      });
    }
    if (error.message === "CONFIGURACION_INCOMPLETA") {
      return res.status(400).send({
        message: "Configuración de facturación electrónica incompleta",
        data: undefined
      });
    }
    console.error("Error generar comprobante electrónico:", error);
    res.status(500).send({
      message: "Error al generar el comprobante electrónico",
      data: undefined
    });
  }
};

// Enviar comprobante a SUNAT
const enviarComprobanteSunat = async (req, res) => {
  try {
    const { idComprobanteElectronico } = req.params;

    const pool = await sql.connect(dbConfig);
    const result = await FacturacionServices.enviarComprobanteSunatService(pool, req.user, idComprobanteElectronico);

    res.status(200).send({
      message: "Comprobante enviado a SUNAT exitosamente",
      data: result
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "COMPROBANTE_NO_ENCONTRADO") {
      return res.status(404).send({
        message: "Comprobante electrónico no encontrado",
        data: undefined
      });
    }
    console.error("Error enviar comprobante SUNAT:", error);
    res.status(500).send({
      message: "Error al enviar el comprobante a SUNAT",
      data: undefined
    });
  }
};

// Consultar estado en SUNAT
const consultarEstadoSunat = async (req, res) => {
  try {
    const { idComprobanteElectronico } = req.params;

    const pool = await sql.connect(dbConfig);
    const result = await FacturacionServices.consultarEstadoSunatService(pool, req.user, idComprobanteElectronico);

    res.status(200).send({
      message: "Estado consultado exitosamente",
      data: result
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    if (error.message === "COMPROBANTE_NO_ENCONTRADO") {
      return res.status(404).send({
        message: "Comprobante electrónico no encontrado",
        data: undefined
      });
    }
    console.error("Error consultar estado SUNAT:", error);
    res.status(500).send({
      message: "Error al consultar el estado en SUNAT",
      data: undefined
    });
  }
};

// Obtener estadísticas de facturación
const obtenerEstadisticasFacturacion = async (req, res) => {
  try {
    const { periodo } = req.query;

    const pool = await sql.connect(dbConfig);
    const estadisticas = await FacturacionServices.obtenerEstadisticasFacturacionService(pool, req.user, periodo);

    res.status(200).send({ data: estadisticas });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener estadísticas facturación:", error);
    res.status(500).send({
      message: "Error al obtener las estadísticas de facturación",
      data: undefined
    });
  }
};

// Obtener estados SUNAT
const obtenerEstadosSunat = async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const estados = await FacturacionServices.obtenerEstadosSunatService(pool, req.user);
    res.status(200).send({ data: estados });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener estados SUNAT:", error);
    res.status(500).send({
      message: "Error al obtener los estados de SUNAT",
      data: undefined
    });
  }
};

module.exports = {
  obtenerConfiguracionFacturacion,
  actualizarConfiguracionFacturacion,
  obtenerComprobantesElectronicos,
  generarComprobanteElectronico,
  enviarComprobanteSunat,
  consultarEstadoSunat,
  obtenerEstadisticasFacturacion,
  obtenerEstadosSunat
};