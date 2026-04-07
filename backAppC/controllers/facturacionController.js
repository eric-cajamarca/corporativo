const dbConfig = require('../dbconfig');
const sql = require('mssql');
const FacturacionServices = require('../services/facturacion.service');
const ResumenDiarioSunatService = require('../services/resumenDiarioSunat.service');
const ComunicacionBajaService = require('../services/comunicacionBaja.service');
const debugSunatLog = require('../utils/debugSunatLog.util');

// Obtener configuración de facturación electrónica
const obtenerConfiguracionFacturacion = async (req, res, next) => {
  try {
    const pool = await sql.connect(dbConfig);
    const configuracion = await FacturacionServices.obtenerConfiguracionFacturacionService(pool, req.user);

    res.status(200).send({ data: configuracion });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener configuración facturación:", error);
    return next(error);
  }
};

// Actualizar configuración de facturación electrónica
const actualizarConfiguracionFacturacion = async (req, res, next) => {
  try {
    const {
      certificadoDigital,
      claveCertificado,
      usuarioSunat,
      claveSunat,
      urlEnvio,
      envioDirectoSunat,
      useResumenDiarioBoletas,
      usaGuiasElectronicas,
      urlBaseApiGuias,
      idApiGuias,
      claveApiGuias,
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
      programacionEnvioLotes,
      modoEnvioSunat,
      horaEnvioSunat
    } = req.body;

    const pool = await sql.connect(dbConfig);
    const result = await FacturacionServices.actualizarConfiguracionFacturacionService(pool, req.user, {
      certificadoDigital,
      claveCertificado,
      usuarioSunat,
      claveSunat,
      urlEnvio,
      envioDirectoSunat,
      useResumenDiarioBoletas,
      usaGuiasElectronicas,
      urlBaseApiGuias,
      idApiGuias,
      claveApiGuias,
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
      programacionEnvioLotes,
      modoEnvioSunat,
      horaEnvioSunat
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
    return next(error);
  }
};

// Subir certificado digital (.pfx) y clave para firma de XML. Multipart: campo 'certificado' (archivo) y 'claveCertificado' (texto).
const subirCertificadoFacturacion = async (req, res, next) => {
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
    return next(error);
  }
};

// Obtener comprobantes electrónicos
const obtenerComprobantesElectronicos = async (req, res, next) => {
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
    return next(error);
  }
};

// Generar comprobante electrónico
const generarComprobanteElectronico = async (req, res, next) => {
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
    return next(error);
  }
};

// Enviar comprobante a SUNAT. Body opcional: { usarXmlUbl: true } para generar XML UBL y enviar sin archivos planos.
const enviarComprobanteSunat = async (req, res, next) => {
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
      const rawMsg = result.mensaje || "Error al enviar a SUNAT";
      const message = typeof rawMsg === "string" && (rawMsg.includes("<") || rawMsg.length > 500)
        ? "SUNAT rechazó el envío. El sistema no puede responder su solicitud. Intente nuevamente o comuníquese con su Administrador."
        : rawMsg;
      return res.status(400).json({
        message,
        data: { ok: result.ok, idEstadoSunat: result.idEstadoSunat, codigoRespuesta: result.codigoRespuesta, descripcionRespuesta: result.descripcionRespuesta }
      });
    }
    res.status(200).json({
      message: result?.mensaje || "Comprobante enviado a SUNAT exitosamente",
      data: result
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).json({ message: "No autorizado", data: undefined });
    }
    if (error.message === "COMPROBANTE_NO_ENCONTRADO") {
      return res.status(404).json({
        message: "Comprobante electrónico no encontrado",
        data: undefined
      });
    }
    if (error.message === "CONFIG_FACTURADOR_INCOMPLETA") {
      return res.status(400).json({
        message: "Configure la carpeta del Facturador SUNAT en Configuración > Facturación",
        data: undefined
      });
    }
    if (error.message === "CDR_NO_ENCONTRADO" || error.message === "XML no encontrado") {
      return res.status(404).json({ message: error.message, data: undefined });
    }
    // #region agent log
    console.error("[SUNAT] enviarComprobanteSunat: error", error.message);
    debugSunatLog.write({ location: "facturacionController.enviarComprobanteSunat:error", message: "error", data: { error: error.message } });
    // #endregion
    console.error("Error enviar comprobante SUNAT:", error);
    return next(error);
  }
};

// Consultar estado en SUNAT (y opcionalmente consultar CDR en SUNAT si urlConsulta está configurada)
const consultarEstadoSunat = async (req, res, next) => {
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
    return next(error);
  }
};

// Consultar validez de un comprobante en SUNAT (billValidService). Query: idComprobanteElectronico O (ruc, tipoComprobante, serie, numero)
const consultarValidezComprobante = async (req, res, next) => {
  try {
    const { idComprobanteElectronico, ruc, tipoComprobante, serie, numero } = req.query;
    const pool = await sql.connect(dbConfig);
    const result = await FacturacionServices.consultarValidezComprobanteService(pool, req.user, {
      idComprobanteElectronico: idComprobanteElectronico || undefined,
      ruc: ruc || undefined,
      tipoComprobante: tipoComprobante || undefined,
      serie: serie || undefined,
      numero: numero !== undefined && numero !== "" ? numero : undefined
    });
    res.status(200).send({ message: result.mensaje || (result.valido ? "Comprobante válido" : "Comprobante no válido"), data: result });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    if (error.message === "COMPROBANTE_NO_ENCONTRADO") return res.status(404).send({ message: "Comprobante no encontrado", data: undefined });
    console.error("Error consultar validez comprobante:", error);
    return next(error);
  }
};

// Obtener estadísticas de facturación
const obtenerEstadisticasFacturacion = async (req, res, next) => {
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
    return next(error);
  }
};

// Obtener estados SUNAT
const obtenerEstadosSunat = async (req, res, next) => {
  try {
    const pool = await sql.connect(dbConfig);
    const estados = await FacturacionServices.obtenerEstadosSunatService(pool, req.user);
    res.status(200).send({ data: estados });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error obtener estados SUNAT:", error);
    return next(error);
  }
};

/** Valida credenciales SOL: descifrado de claves y apertura del certificado PFX. */
const validarCredencialesSol = async (req, res, next) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await FacturacionServices.validarCredencialesSolService(pool, req.user);
    res.status(200).send({
      message: result.mensaje,
      data: {
        ok: result.ok,
        certificadoOk: result.certificadoOk,
        claveSolOk: result.claveSolOk
      }
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") {
      return res.status(401).send({ message: "No autorizado", data: undefined });
    }
    console.error("Error validar credenciales SOL:", error);
    return next(error);
  }
};

// Envío por lotes (manual): envía todos los comprobantes pendientes de la empresa del usuario
const enviarLoteSunat = async (req, res, next) => {
  // #region agent log
  const loteEntry = { idEmpresa: req.user?.empresa };
  console.error("[SUNAT] enviarLoteSunat: entry", loteEntry);
  debugSunatLog.write({ location: "facturacionController.enviarLoteSunat:entry", message: "entry", data: loteEntry });
  // #endregion
  try {
    const pool = await sql.connect(dbConfig);
    const result = await FacturacionServices.enviarLotePendientesService(pool, req.user.empresa, { manual: true });
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
    return next(error);
  }
};

// Obtener contenido XML del comprobante (para ver o descargar)
const obtenerXmlComprobante = async (req, res, next) => {
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
    return next(error);
  }
};

// Descargar XML firmado listo para SUNAT (genera + firma y devuelve como archivo)
const obtenerXmlComprobanteDescarga = async (req, res, next) => {
  try {
    const { idComprobanteElectronico } = req.params;
    const pool = await sql.connect(dbConfig);
    const { xml, nombreBase } = await FacturacionServices.obtenerXmlFirmadoParaDescargaService(pool, req.user, idComprobanteElectronico);
    const filename = `${nombreBase}.xml`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.type("application/xml");
    res.status(200).send(xml);
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    if (error.message === "Comprobante no encontrado") return res.status(404).send({ message: error.message, data: undefined });
    if (error.message && (error.message.includes("certificado") || error.message.includes("Configuración"))) return res.status(400).send({ message: error.message, data: undefined });
    console.error("Error descarga XML comprobante:", error);
    return next(error);
  }
};

// Obtener contenido CDR del comprobante (para ver o descargar)
const obtenerCdrComprobante = async (req, res, next) => {
  try {
    const { idComprobanteElectronico } = req.params;
    const pool = await sql.connect(dbConfig);
    const contenido = await FacturacionServices.obtenerCdrComprobanteService(pool, req.user, idComprobanteElectronico);
    res.status(200).send({ data: { content: contenido } });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    if (error.message === "COMPROBANTE_NO_ENCONTRADO" || error.message === "CDR_NO_ENCONTRADO") return res.status(404).send({ message: "CDR no encontrado", data: undefined });
    console.error("Error obtener CDR comprobante:", error);
    return next(error);
  }
};

// Resumen diario (RC): listar resúmenes con filtros
const listarResumenesDiarios = async (req, res, next) => {
  try {
    const pool = await sql.connect(dbConfig);
    const { fechaDesde, fechaHasta, idEstadoSunat, pagina, porPagina } = req.query;
    const result = await FacturacionServices.listarResumenesDiariosService(pool, req.user, {
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      idEstadoSunat: idEstadoSunat !== undefined && idEstadoSunat !== "" ? parseInt(idEstadoSunat, 10) : undefined,
      pagina: pagina ? parseInt(pagina, 10) : 1,
      porPagina: porPagina ? parseInt(porPagina, 10) : 20
    });
    res.status(200).send({ data: result.items, total: result.total });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    console.error("Error listar resúmenes diarios:", error);
    return next(error);
  }
};

// Resumen diario: enviar resumen para una fecha (POST body: fechaResumen YYYY-MM-DD)
const enviarResumenDiario = async (req, res, next) => {
  try {
    const { fechaResumen } = req.body || {};
    if (!fechaResumen || typeof fechaResumen !== "string") {
      return res.status(400).send({ message: "fechaResumen (YYYY-MM-DD) es requerido", data: undefined });
    }
    const pool = await sql.connect(dbConfig);
    const result = await ResumenDiarioSunatService.enviarResumenDiarioService(pool, req.user, fechaResumen.trim());
    if (!result.ok) {
      return res.status(400).send({ message: result.error || "Error al enviar resumen", data: result });
    }
    res.status(200).send({ message: result.mensaje, data: result });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    console.error("Error enviar resumen diario:", error);
    return next(error);
  }
};

// Resumen diario: boletas pendientes por fecha (GET ?fechaDesde=&fechaHasta=)
const obtenerBoletasPendientesResumen = async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta } = req.query || {};
    if (!fechaDesde || !fechaHasta) {
      return res.status(400).send({ message: "fechaDesde y fechaHasta son requeridos (YYYY-MM-DD)", data: [] });
    }
    const pool = await sql.connect(dbConfig);
    const items = await FacturacionServices.listarBoletasPendientesPorFechaService(
      pool, req.user, String(fechaDesde).trim(), String(fechaHasta).trim()
    );
    res.status(200).send({ data: items || [] });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: [] });
    console.error("Error obtener boletas pendientes resumen:", error);
    return next(error);
  }
};

// Resumen diario: consultar estado en SUNAT (getStatus) por idResumenDiarioSunat
const consultarEstadoResumenDiario = async (req, res, next) => {
  try {
    const { idResumenDiarioSunat } = req.params;
    if (!idResumenDiarioSunat) {
      return res.status(400).send({ message: "idResumenDiarioSunat es requerido", data: undefined });
    }
    const pool = await sql.connect(dbConfig);
    const result = await ResumenDiarioSunatService.consultarEstadoResumenDiarioService(pool, req.user, idResumenDiarioSunat);
    if (!result.ok && result.error) {
      return res.status(400).send({ message: result.error, data: result });
    }
    res.status(200).send({ data: result });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    console.error("Error consultar estado resumen:", error);
    return next(error);
  }
};

// Obtener comprobante origen (Factura/Boleta aceptada) para emitir NC/ND. Params: idComprobanteElectronico. Query: serie, numero, tipoComprobante (01/03).
// Comprobante por serie/numero para origen de guía (incluye cliente e items; no exige aceptado SUNAT)
const obtenerOrigenParaGuia = async (req, res, next) => {
  try {
    const { serie, numero } = req.query || {};
    if (serie == null || numero == null) {
      return res.status(400).send({ message: "Indique serie y numero (query)", data: null });
    }
    const pool = await sql.connect(dbConfig);
    const data = await FacturacionServices.obtenerComprobanteOrigenParaGuiaService(pool, req.user, serie, numero);
    if (!data) {
      return res.status(404).send({ message: "No se encontró comprobante con esa serie y número", data: null });
    }
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: null });
    console.error("Error obtener origen para guía:", error);
    return next(error);
  }
};

const obtenerOrigenParaNota = async (req, res, next) => {
  try {
    const { idComprobanteElectronico } = req.params;
    const { serie, numero, tipoComprobante } = req.query || {};
    const pool = await sql.connect(dbConfig);
    const id = idComprobanteElectronico || null;
    const byQuery = serie != null && numero != null;
    if (!id && !byQuery) {
      return res.status(400).send({ message: "Indique idComprobanteElectronico (path) o serie, numero y tipoComprobante (query)", data: null });
    }
    const data = await FacturacionServices.obtenerComprobanteOrigenParaNotaService(pool, req.user, id, byQuery ? { serie, numero, tipoComprobante } : {});
    if (!data) {
      return res.status(404).send({ message: "Comprobante no encontrado o no está aceptado (solo Factura/Boleta aceptada)", data: null });
    }
    res.status(200).send({ data });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: null });
    console.error("Error obtener origen para nota:", error);
    return next(error);
  }
};

// Listar comprobantes origen (Factura/Boleta aceptados) por RUC o razón social del cliente. Query: rucCliente, razonSocial, tipoComprobante (01/03 opcional).
const listarComprobantesOrigenPorCliente = async (req, res, next) => {
  try {
    const { rucCliente, razonSocial, tipoComprobante } = req.query || {};
    const ruc = (rucCliente != null && String(rucCliente).trim() !== "") ? String(rucCliente).trim() : "";
    const razon = (razonSocial != null && String(razonSocial).trim() !== "") ? String(razonSocial).trim() : "";
    if (!ruc && !razon) {
      return res.status(400).send({ message: "Indique rucCliente o razonSocial (query)", data: [] });
    }
    const pool = await sql.connect(dbConfig);
    const list = await FacturacionServices.listarComprobantesOrigenPorClienteService(pool, req.user, {
      rucCliente: ruc || undefined,
      razonSocial: razon || undefined,
      tipoComprobante: tipoComprobante != null ? String(tipoComprobante).trim() : undefined
    });
    res.status(200).send({ data: list || [] });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: [] });
    console.error("Error listar comprobantes origen por cliente:", error);
    return next(error);
  }
};

// Crear Nota de Crédito (07) o Débito (08)
const crearNotaCreditoDebito = async (req, res, next) => {
  try {
    const { idComprobanteElectronicoOrigen, tipoNota, codigoMotivoNotaCredito, items } = req.body || {};
    if (!idComprobanteElectronicoOrigen || !tipoNota || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).send({
        message: "Se requieren: idComprobanteElectronicoOrigen, tipoNota ('07' o '08'), items (array con idProducto, cantidad, pVenta, subtotal, total)",
        data: undefined
      });
    }
    if (!["07", "08"].includes(String(tipoNota).trim())) {
      return res.status(400).send({ message: "tipoNota debe ser '07' (Nota de Crédito) o '08' (Nota de Débito)", data: undefined });
    }
    const pool = await sql.connect(dbConfig);
    const result = await FacturacionServices.crearNotaCreditoDebitoService(pool, req.user, {
      idComprobanteElectronicoOrigen,
      tipoNota: String(tipoNota).trim(),
      codigoMotivoNotaCredito: tipoNota === "07" ? (codigoMotivoNotaCredito || "01") : undefined,
      items: items.map((it) => ({
        idProducto: it.idProducto,
        cantidad: Number(it.cantidad) || 0,
        pVenta: Number(it.pVenta) || 0,
        subtotal: Number(it.subtotal) || 0,
        total: Number(it.total) || 0
      }))
    });
    if (!result) {
      return res.status(400).send({ message: "No se pudo crear la nota. Verifique que el comprobante origen esté aceptado.", data: undefined });
    }
    res.status(201).send({
      message: tipoNota === "07" ? "Nota de Crédito creada" : "Nota de Débito creada",
      data: result
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    if (error.message && String(error.message).includes("No hay comprobante configurado para nota")) {
      return res.status(400).send({ message: error.message, data: undefined });
    }
    console.error("Error crear nota crédito/débito:", error);
    return next(error);
  }
};

// ---------- Comunicación de baja (RA) ----------
const listarComprobantesParaBaja = async (req, res, next) => {
  try {
    const pool = await sql.connect(dbConfig);
    const data = await FacturacionServices.listarComprobantesAceptadosParaBajaService(pool, req.user);
    res.status(200).send({ data: data || [] });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: [] });
    console.error("Error listar comprobantes para baja:", error);
    return next(error);
  }
};

const listarMotivosBaja = async (req, res, next) => {
  try {
    const pool = await sql.connect(dbConfig);
    const data = await FacturacionServices.listarMotivosBajaService(pool);
    res.status(200).send({ data: data || [] });
  } catch (error) {
    console.error("Error listar motivos baja:", error);
    return next(error);
  }
};

const listarComunicacionesBaja = async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta, idEstadoSunat, pagina, porPagina } = req.query || {};
    const pool = await sql.connect(dbConfig);
    const result = await FacturacionServices.listarComunicacionesBajaService(pool, req.user, {
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      idEstadoSunat: idEstadoSunat != null && idEstadoSunat !== "" ? idEstadoSunat : undefined,
      pagina: pagina != null ? parseInt(pagina, 10) : 1,
      porPagina: porPagina != null ? parseInt(porPagina, 10) : 20
    });
    res.status(200).send({ data: result.items || [], total: result.total ?? 0 });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: [], total: 0 });
    console.error("Error listar comunicaciones baja:", error);
    return next(error);
  }
};

const enviarComunicacionBaja = async (req, res, next) => {
  try {
    const { comprobantes } = req.body || {};
    const pool = await sql.connect(dbConfig);
    const result = await ComunicacionBajaService.enviarComunicacionBajaService(pool, req.user, { comprobantes: comprobantes || [] });
    if (!result.ok) {
      return res.status(400).send({ message: result.error || "No se pudo enviar", data: undefined });
    }
    res.status(201).send({
      message: result.mensaje || "Comunicación de baja enviada.",
      data: { idComunicacionBaja: result.idComunicacionBaja, ticket: result.ticket }
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    console.error("Error enviar comunicación de baja:", error);
    return next(error);
  }
};

const consultarEstadoComunicacionBaja = async (req, res, next) => {
  try {
    const { idComunicacionBaja } = req.params;
    const pool = await sql.connect(dbConfig);
    const result = await ComunicacionBajaService.consultarEstadoComunicacionBajaService(pool, req.user, idComunicacionBaja);
    if (!result.ok && !result.statusCode) {
      return res.status(400).send({ message: result.error || "Error", data: undefined });
    }
    res.status(200).send({
      mensaje: result.mensaje || result.error,
      statusCode: result.statusCode,
      idEstadoSunat: result.idEstadoSunat,
      data: result
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    console.error("Error consultar estado comunicación baja:", error);
    return next(error);
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
  consultarValidezComprobante,
  enviarLoteSunat,
  obtenerEstadisticasFacturacion,
  obtenerEstadosSunat,
  validarCredencialesSol,
  obtenerXmlComprobante,
  obtenerXmlComprobanteDescarga,
  obtenerCdrComprobante,
  listarResumenesDiarios,
  obtenerBoletasPendientesResumen,
  enviarResumenDiario,
  consultarEstadoResumenDiario,
  obtenerOrigenParaGuia,
  obtenerOrigenParaNota,
  listarComprobantesOrigenPorCliente,
  crearNotaCreditoDebito,
  listarComprobantesParaBaja,
  listarMotivosBaja,
  listarComunicacionesBaja,
  enviarComunicacionBaja,
  consultarEstadoComunicacionBaja
};