const dbConfig = require('../dbconfig');
const sql = require('mssql');
const FacturacionServices = require('../services/facturacion.service');
const debugSunatLog = require('../utils/debugSunatLog.util');

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
      urlEnvio,
      envioDirectoSunat,
      modoPrueba,
      serieFactura,
      serieBoleta,
      serieNotaCredito,
      serieNotaDebito,
      rutaCarpetaFacturadorSunat,
      urlFacturadorSunat,
      envioAutomatico,
      minutosEnvioAutomatico,
      envioPorLotes,
      programacionEnvioLotes
    } = req.body;

    const pool = await sql.connect(dbConfig);
    const result = await FacturacionServices.actualizarConfiguracionFacturacionService(pool, req.user, {
      certificadoDigital,
      claveCertificado,
      usuarioSunat,
      claveSunat,
      urlEnvio,
      envioDirectoSunat,
      modoPrueba,
      serieFactura,
      serieBoleta,
      serieNotaCredito,
      serieNotaDebito,
      rutaCarpetaFacturadorSunat,
      urlFacturadorSunat,
      envioAutomatico,
      minutosEnvioAutomatico,
      envioPorLotes,
      programacionEnvioLotes
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

// Subir certificado digital (.pfx) y clave para firma de XML. Multipart: campo 'certificado' (archivo) y 'claveCertificado' (texto).
const subirCertificadoFacturacion = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).send({
        message: "Debe enviar un archivo .pfx en el campo 'certificado'",
        data: undefined
      });
    }
    const claveCertificado = req.body?.claveCertificado != null ? String(req.body.claveCertificado).trim() : "";
    const pool = await sql.connect(dbConfig);
    const result = await FacturacionServices.actualizarCertificadoFacturacionService(
      pool,
      req.user,
      req.file.buffer,
      claveCertificado
    );
    res.status(200).send({ message: result.mensaje, data: result });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    if (error.message === "NO_PERMISSIONS") return res.status(403).send({ message: "Sin permisos para esta acción", data: undefined });
    if (error.message === "CERTIFICADO_REQUERIDO") return res.status(400).send({ message: "Archivo de certificado requerido", data: undefined });
    if (error.message === "CONFIGURACION_FACTURACION_REQUERIDA") return res.status(400).send({ message: "Guarde primero la configuración de facturación", data: undefined });
    console.error("Error subir certificado facturación:", error);
    res.status(500).send({ message: error.message || "Error al guardar el certificado", data: undefined });
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

// Enviar comprobante a SUNAT. Body opcional: { usarXmlUbl: true } para generar XML UBL y enviar sin archivos planos.
const enviarComprobanteSunat = async (req, res) => {
  const { idComprobanteElectronico } = req.params;
  const opciones = { usarXmlUbl: req.body?.usarXmlUbl === true };
  // #region agent log
  const entryData = { idComprobanteElectronico, opciones, idEmpresa: req.user?.empresa };
  console.error("[SUNAT] enviarComprobanteSunat: entry", entryData);
  debugSunatLog.write({ location: "facturacionController.enviarComprobanteSunat:entry", message: "entry", data: entryData });
  // #endregion
  try {
    const pool = await sql.connect(dbConfig);
    const result = await FacturacionServices.enviarComprobanteSunatService(pool, req.user, idComprobanteElectronico, opciones);

    // #region agent log
    const resultData = { ok: result?.ok, idEstadoSunat: result?.idEstadoSunat, mensaje: result?.mensaje };
    console.error("[SUNAT] enviarComprobanteSunat: result", resultData);
    debugSunatLog.write({ location: "facturacionController.enviarComprobanteSunat:result", message: "result", data: resultData });
    // #endregion
    if (result && !result.ok) {
      return res.status(400).send({
        message: result.mensaje || "Error al enviar a SUNAT",
        data: result
      });
    }
    res.status(200).send({
      message: result?.mensaje || "Comprobante enviado a SUNAT exitosamente",
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
    if (error.message === "CONFIG_FACTURADOR_INCOMPLETA") {
      return res.status(400).send({
        message: "Configure la carpeta del Facturador SUNAT en Configuración > Facturación",
        data: undefined
      });
    }
    if (error.message === "CDR_NO_ENCONTRADO" || error.message === "XML no encontrado") {
      return res.status(404).send({ message: error.message, data: undefined });
    }
    // #region agent log
    console.error("[SUNAT] enviarComprobanteSunat: error", error.message);
    debugSunatLog.write({ location: "facturacionController.enviarComprobanteSunat:error", message: "error", data: { error: error.message } });
    // #endregion
    console.error("Error enviar comprobante SUNAT:", error);
    res.status(500).send({
      message: error.message || "Error al enviar el comprobante a SUNAT",
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

// Envío por lotes (manual): envía todos los comprobantes pendientes de la empresa del usuario
const enviarLoteSunat = async (req, res) => {
  // #region agent log
  const loteEntry = { idEmpresa: req.user?.empresa };
  console.error("[SUNAT] enviarLoteSunat: entry", loteEntry);
  debugSunatLog.write({ location: "facturacionController.enviarLoteSunat:entry", message: "entry", data: loteEntry });
  // #endregion
  try {
    const pool = await sql.connect(dbConfig);
    const result = await FacturacionServices.enviarLotePendientesService(pool, req.user.empresa);
    // #region agent log
    const loteResult = { enviados: result?.enviados, errores: result?.errores, total: result?.total, mensaje: result?.mensaje };
    console.error("[SUNAT] enviarLoteSunat: result", loteResult);
    debugSunatLog.write({ location: "facturacionController.enviarLoteSunat:result", message: "result", data: loteResult });
  // #endregion
    res.status(200).send({
      message: `Envío por lotes: ${result.enviados} enviados, ${result.errores} errores`,
      data: result
    });
  } catch (error) {
    // #region agent log
    console.error("[SUNAT] enviarLoteSunat: error", error.message);
    debugSunatLog.write({ location: "facturacionController.enviarLoteSunat:error", message: "error", data: { error: error.message } });
    // #endregion
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error envío por lotes SUNAT:", error);
    res.status(500).send({
      message: error.message || "Error al enviar lote a SUNAT",
      data: undefined
    });
  }
};

// Obtener contenido XML del comprobante (para ver o descargar)
const obtenerXmlComprobante = async (req, res) => {
  try {
    const { idComprobanteElectronico } = req.params;
    const pool = await sql.connect(dbConfig);
    const contenido = await FacturacionServices.obtenerXmlComprobanteService(pool, req.user, idComprobanteElectronico);
    res.status(200).send({ data: { content: contenido } });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    if (error.message === "COMPROBANTE_NO_ENCONTRADO") return res.status(404).send({ message: "Comprobante no encontrado", data: undefined });
    if (error.message === "CONFIG_FACTURADOR_INCOMPLETA") return res.status(400).send({ message: "Configure la carpeta del Facturador SUNAT", data: undefined });
    if (error.message && (error.message.includes("XML") || error.message.includes("no encontrado"))) return res.status(404).send({ message: error.message, data: undefined });
    console.error("Error obtener XML comprobante:", error);
    res.status(500).send({ message: error.message || "Error al obtener XML", data: undefined });
  }
};

// Obtener contenido CDR del comprobante (para ver o descargar)
const obtenerCdrComprobante = async (req, res) => {
  try {
    const { idComprobanteElectronico } = req.params;
    const pool = await sql.connect(dbConfig);
    const contenido = await FacturacionServices.obtenerCdrComprobanteService(pool, req.user, idComprobanteElectronico);
    res.status(200).send({ data: { content: contenido } });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    if (error.message === "COMPROBANTE_NO_ENCONTRADO" || error.message === "CDR_NO_ENCONTRADO") return res.status(404).send({ message: "CDR no encontrado", data: undefined });
    console.error("Error obtener CDR comprobante:", error);
    res.status(500).send({ message: error.message || "Error al obtener CDR", data: undefined });
  }
};

module.exports = {
  obtenerConfiguracionFacturacion,
  actualizarConfiguracionFacturacion,
  subirCertificadoFacturacion,
  obtenerComprobantesElectronicos,
  generarComprobanteElectronico,
  enviarComprobanteSunat,
  consultarEstadoSunat,
  enviarLoteSunat,
  obtenerEstadisticasFacturacion,
  obtenerEstadosSunat,
  obtenerXmlComprobante,
  obtenerCdrComprobante
};