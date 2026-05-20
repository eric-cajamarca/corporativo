const { withPool } = require('../utils/dbPool.util');
const FacturacionServices = require('../services/facturacion.service');
const ResumenDiarioSunatService = require('../services/resumenDiarioSunat.service');
const ComunicacionBajaService = require('../services/comunicacionBaja.service');
const GuiaElectronicaService = require('../services/guiaElectronica.service');
const debugSunatLog = require('../utils/debugSunatLog.util');
const { construirDatosQrRepresentacionImpresaGre } = require('../utils/sunatCadenaQrGre.util');

// Obtener configuración de facturación electrónica
const obtenerConfiguracionFacturacion = async (req, res, next) => {
  try {
    const configuracion = await withPool(async (pool) => FacturacionServices.obtenerConfiguracionFacturacionService(pool, req.user));

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

    const result = await withPool(async (pool) => FacturacionServices.actualizarConfiguracionFacturacionService(pool, req.user, {
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
    }));

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
    const result = await withPool(async (pool) => FacturacionServices.actualizarCertificadoFacturacionService(
      pool,
      req.user,
      req.file.buffer,
      claveCertificado
    ));
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

    const comprobantes = await withPool(async (pool) => FacturacionServices.obtenerComprobantesElectronicosService(pool, req.user, {
      tipoComprobante,
      estadoSunat,
      fechaDesde,
      fechaHasta
    }));

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

    const result = await withPool(async (pool) => FacturacionServices.generarComprobanteElectronicoService(pool, req.user, {
      idVenta,
      tipoComprobante
    }));

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
  try {
    const result = await withPool(async (pool) => FacturacionServices.enviarComprobanteSunatService(pool, req.user, idComprobanteElectronico, opciones));

    if (result && !result.ok) {
      if (result.quedarPendiente) {
        return res.status(503).json({
          message:
            result.mensaje ||
            "SUNAT o el servicio de envío no respondió. El comprobante sigue pendiente y se reintentará automáticamente.",
          data: {
            ok: false,
            quedarPendiente: true,
            idEstadoSunat: result.idEstadoSunat
          }
        });
      }
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
    console.error("Error enviar comprobante SUNAT:", error);
    return next(error);
  }
};

// Consultar estado en SUNAT (y opcionalmente consultar CDR en SUNAT si urlConsulta está configurada)
const consultarEstadoSunat = async (req, res, next) => {
  try {
    const { idComprobanteElectronico } = req.params;

    const result = await withPool(async (pool) => FacturacionServices.consultarEstadoSunatService(pool, req.user, idComprobanteElectronico));

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
    const result = await withPool(async (pool) => FacturacionServices.consultarValidezComprobanteService(pool, req.user, {
      idComprobanteElectronico: idComprobanteElectronico || undefined,
      ruc: ruc || undefined,
      tipoComprobante: tipoComprobante || undefined,
      serie: serie || undefined,
      numero: numero !== undefined && numero !== "" ? numero : undefined
    }));
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

    const estadisticas = await withPool(async (pool) => FacturacionServices.obtenerEstadisticasFacturacionService(pool, req.user, periodo));

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
    const estados = await withPool(async (pool) => FacturacionServices.obtenerEstadosSunatService(pool, req.user));
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
    const result = await withPool(async (pool) => FacturacionServices.validarCredencialesSolService(pool, req.user));
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
  try {
    const result = await withPool(async (pool) => FacturacionServices.enviarLotePendientesService(pool, req.user.empresa, { manual: true }));
    res.status(200).send({
      message: `Envío por lotes: ${result.enviados} enviados, ${result.errores} errores`,
      data: result
    });
  } catch (error) {
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
    const contenido = await withPool(async (pool) => FacturacionServices.obtenerXmlComprobanteService(pool, req.user, idComprobanteElectronico));
    res.status(200).send({ data: { content: contenido } });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    if (error.message === "COMPROBANTE_NO_ENCONTRADO") return res.status(404).send({ message: "Comprobante no encontrado", data: undefined });
    if (error.message && (error.message.includes("XML") || error.message.includes("no encontrado"))) return res.status(404).send({ message: error.message, data: undefined });
    console.error("Error obtener XML comprobante:", error);
    return next(error);
  }
};

// Descargar XML firmado listo para SUNAT (genera + firma y devuelve como archivo)
const obtenerXmlComprobanteDescarga = async (req, res, next) => {
  try {
    const { idComprobanteElectronico } = req.params;
    const { xml, nombreBase } = await withPool(async (pool) => FacturacionServices.obtenerXmlFirmadoParaDescargaService(pool, req.user, idComprobanteElectronico));
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
    const contenido = await withPool(async (pool) => FacturacionServices.obtenerCdrComprobanteService(pool, req.user, idComprobanteElectronico));
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
    const { fechaDesde, fechaHasta, idEstadoSunat, pagina, porPagina } = req.query;
    const result = await withPool(async (pool) => FacturacionServices.listarResumenesDiariosService(pool, req.user, {
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      idEstadoSunat: idEstadoSunat !== undefined && idEstadoSunat !== "" ? parseInt(idEstadoSunat, 10) : undefined,
      pagina: pagina ? parseInt(pagina, 10) : 1,
      porPagina: porPagina ? parseInt(porPagina, 10) : 20
    }));
    res.status(200).send({ data: result.items, total: result.total });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    console.error("Error listar resúmenes diarios:", error);
    return next(error);
  }
};

/**
 * GET /api/facturacion/guias/:id/preview-xml
 * - JSON por defecto: { data: { xmlSinFirmar, xmlFirmado?, nomArchivo, ... } }
 * - ?firmado=1 incluye firma PFX (mismo XML que se comprime y envía a SUNAT).
 * - ?raw=1 devuelve el cuerpo como application/xml (firmado si firmado=1; si no, sin firmar).
 */
const previewXmlGuia = async (req, res, next) => {
  try {
    const incluirFirmado =
      String(req.query.firmado || "") === "1" ||
      String(req.query.firmado || "").toLowerCase() === "true";
    const rawXml =
      String(req.query.raw || "") === "1" ||
      String(req.query.raw || "").toLowerCase() === "true";
    const result = await withPool(async (pool) => GuiaElectronicaService.previewXmlGuiaService(pool, req.user, req.params.id, {
      incluirFirmado
    }));
    if (rawXml) {
      const body = incluirFirmado ? result.xmlFirmado : result.xmlSinFirmar;
      if (!body) {
        return res.status(400).send({
          message:
            result.errorFirma ||
            "No hay XML firmado. Use firmado=1 y configure certificado, o quite raw=1 para ver JSON."
        });
      }
      const nameBase = (result.nomArchivo || "guia").replace(/\.xml$/i, "");
      const filename = incluirFirmado ? `${nameBase}-firmado.xml` : result.nomArchivo || "guia.xml";
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.status(200).send(Buffer.from(body, "utf8"));
    }
    res.status(200).send({ data: result });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado" });
    if (error.message === "GUIA_NOT_FOUND") return res.status(404).send({ message: "Guía no encontrada" });
    const msg = error.message || String(error);
    console.error("Error preview XML guía:", error);
    return res.status(400).send({ message: msg });
  }
};

/** GET /api/facturacion/guias/:id/xml-firmado — Descarga el último XML firmado guardado (no regenera). */
const descargarXmlFirmadoGuia = async (req, res, next) => {
  try {
    const row = await withPool(async (pool) => GuiaElectronicaService.obtenerGuiaService(pool, req.user, req.params.id));
    const xml = row.xmlFirmado;
    if (!xml || typeof xml !== "string" || !String(xml).trim()) {
      return res.status(404).send({
        message:
          "No hay XML firmado almacenado. Ejecute la migración add_guias_emitidas_xml_firmado.sql y reenvíe la guía, o use preview-xml?firmado=1."
      });
    }
    const safeName = `${row.serie || "GUIA"}-${String(row.numero || "").replace(/\s/g, "")}-firmado.xml`.replace(
      /[^A-Za-z0-9._-]/g,
      "_"
    );
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    return res.status(200).send(Buffer.from(xml, "utf8"));
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado" });
    if (error.message === "GUIA_NOT_FOUND") return res.status(404).send({ message: "Guía no encontrada" });
    const msg = error.message || String(error);
    if (/Invalid column name ['"]xmlFirmado['"]/i.test(msg)) {
      return res.status(503).send({
        message: "Ejecute la migración add_guias_emitidas_xml_firmado.sql para habilitar el almacenamiento del XML."
      });
    }
    console.error("Error descargar XML firmado guía:", error);
    return next(error);
  }
};

/** PUT /api/facturacion/guias/:id — Actualiza una guía pendiente o con error SUNAT (conserva serie/número). */
const actualizarGuia = async (req, res, next) => {
  try {
    const result = await withPool(async (pool) => GuiaElectronicaService.actualizarGuiaService(pool, req.user, req.params.id, req.body));
    res.status(200).send({ message: result.mensaje, data: result.guia });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado" });
    if (error.message === "GUIA_NOT_FOUND") return res.status(404).send({ message: "Guía no encontrada" });
    const msg = error.message || String(error);
    console.error("Error actualizar guía:", error);
    return res.status(400).send({ message: msg });
  }
};

/** GET /api/facturacion/guias/:id — Detalle completo de una guía electrónica. */
const obtenerGuia = async (req, res, next) => {
  try {
    const row = await withPool(async (pool) => GuiaElectronicaService.obtenerGuiaService(pool, req.user, req.params.id));
    const data = { ...row };
    const tieneXmlFirmado = Boolean(data.xmlFirmado && String(data.xmlFirmado).trim());
    const { codigoHashSunat, cadenaQrSunat } = construirDatosQrRepresentacionImpresaGre(data);
    delete data.xmlFirmado;
    res.status(200).send({ data: { ...data, tieneXmlFirmado, codigoHashSunat, cadenaQrSunat } });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado" });
    if (error.message === "GUIA_NOT_FOUND") return res.status(404).send({ message: "Guía no encontrada" });
    console.error("Error obtener guía:", error);
    return next(error);
  }
};

/** POST /api/facturacion/guias/:id/enviar — Reenvía guía pendiente/error a SUNAT. */
const reenviarGuia = async (req, res, next) => {
  try {
    const result = await withPool(async (pool) => GuiaElectronicaService.reenviarGuiaService(pool, req.user, req.params.id));
    res.status(200).send({ message: result.mensaje, data: result });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado" });
    if (error.message === "GUIA_NOT_FOUND") return res.status(404).send({ message: "Guía no encontrada" });
    const msg = error.message || String(error);
    console.error("Error reenviar guía:", error);
    return res.status(400).send({ message: msg });
  }
};

/** DELETE /api/facturacion/guias/:id — Elimina una guía no aceptada. */
const eliminarGuia = async (req, res, next) => {
  try {
    await withPool(async (pool) => GuiaElectronicaService.eliminarGuiaService(pool, req.user, req.params.id));
    res.status(200).send({ message: "Guía eliminada correctamente." });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado" });
    if (error.message === "GUIA_NOT_FOUND") return res.status(404).send({ message: "Guía no encontrada" });
    const msg = error.message || String(error);
    console.error("Error eliminar guía:", error);
    return res.status(400).send({ message: msg });
  }
};

/** GET /api/facturacion/guias/:id/ticket — Consulta el ticket pendiente de una GRE en SUNAT. */
const consultarTicketGuia = async (req, res, next) => {
  try {
    const result = await withPool(async (pool) => GuiaElectronicaService.consultarTicketGuiaService(pool, req.user, req.params.id));
    res.status(200).send(result);
  } catch (error) {
    if (error.message === "NO_ACCESS")      return res.status(401).send({ message: "No autorizado" });
    if (error.message === "GUIA_NOT_FOUND") return res.status(404).send({ message: "Guía no encontrada" });
    const msg = error.message || String(error);
    console.error("Error consultar ticket guía:", error);
    return res.status(400).send({ message: msg });
  }
};

/** POST /api/facturacion/guias/:id/consultar-estado-sol — Sincroniza estado en SUNAT vía GEM (envíos/ticket y fallback por clave); actualiza BD. */
const consultarEstadoGuiaSol = async (req, res, next) => {
  try {
    const result = await withPool(async (pool) => GuiaElectronicaService.consultarEstadoGuiaSolService(pool, req.user, req.params.id));
    res.status(200).send(result);
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado" });
    if (error.message === "GUIA_NOT_FOUND") return res.status(404).send({ message: "Guía no encontrada" });
    const msg = error.message || String(error);
    console.error("Error consultar estado guía (GEM):", error);
    return res.status(400).send({ message: msg });
  }
};

/** POST /api/facturacion/guias/registrar — Registra la GRE en BD y la envía a SUNAT si hay credenciales. */
const registrarGuia = async (req, res, next) => {
  try {
    const result = await withPool(async (pool) => GuiaElectronicaService.registrarGuiaService(pool, req.user, req.body));
    if (!result.ok) {
      return res.status(400).send({ message: result.mensaje || "Error al registrar la guía", data: result });
    }
    return res.status(201).send({
      message: result.mensaje,
      advertencia: result.advertencia,
      data: result.guia,
      enviado: result.enviado,
      aceptado: result.aceptado
    });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado" });
    const msg = error.message || String(error);
    if (/Invalid object name ['"](GuiasElectronicas|GuiasElectronicasEmitidas)['"]/i.test(msg)) {
      return res.status(503).send({
        message: "Ejecute la migración create_guias_electronicas_emitidas.sql antes de usar esta función.",
        data: null
      });
    }
    console.error("Error registrar guía electrónica:", error);
    return next(error);
  }
};

const listarGuiasEmitidas = async (req, res, next) => {
  try {
    const { pagina, porPagina } = req.query;
    const result = await withPool(async (pool) => FacturacionServices.listarGuiasEmitidasService(pool, req.user, {
      pagina: pagina ? parseInt(pagina, 10) : 1,
      porPagina: porPagina ? parseInt(porPagina, 10) : 10
    }));
    res.status(200).send({ data: result.items, total: result.total });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    const msg = error.message || String(error);
    if (/Invalid object name ['\"]GuiasElectronicasEmitidas['\"]/i.test(msg)) {
      return res.status(503).send({
        message: "Ejecute la migración create_guias_electronicas_emitidas.sql para habilitar el listado de guías.",
        data: [],
        total: 0
      });
    }
    console.error("Error listar guías emitidas:", error);
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
    const result = await withPool(async (pool) => ResumenDiarioSunatService.enviarResumenDiarioService(pool, req.user, fechaResumen.trim()));
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
    const items = await withPool(async (pool) => FacturacionServices.listarBoletasPendientesPorFechaService(
      pool, req.user, String(fechaDesde).trim(), String(fechaHasta).trim()
    ));
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
    const result = await withPool(async (pool) => ResumenDiarioSunatService.consultarEstadoResumenDiarioService(pool, req.user, idResumenDiarioSunat));
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
    const data = await withPool(async (pool) => FacturacionServices.obtenerComprobanteOrigenParaGuiaService(pool, req.user, serie, numero));
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
    const id = idComprobanteElectronico || null;
    const byQuery = serie != null && numero != null;
    if (!id && !byQuery) {
      return res.status(400).send({ message: "Indique idComprobanteElectronico (path) o serie, numero y tipoComprobante (query)", data: null });
    }
    const data = await withPool(async (pool) => FacturacionServices.obtenerComprobanteOrigenParaNotaService(pool, req.user, id, byQuery ? { serie, numero, tipoComprobante } : {}));
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
    const list = await withPool(async (pool) => FacturacionServices.listarComprobantesOrigenPorClienteService(pool, req.user, {
      rucCliente: ruc || undefined,
      razonSocial: razon || undefined,
      tipoComprobante: tipoComprobante != null ? String(tipoComprobante).trim() : undefined
    }));
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
    const result = await withPool(async (pool) => FacturacionServices.crearNotaCreditoDebitoService(pool, req.user, {
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
    }));
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
    const data = await withPool(async (pool) => FacturacionServices.listarComprobantesAceptadosParaBajaService(pool, req.user));
    res.status(200).send({ data: data || [] });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: [] });
    console.error("Error listar comprobantes para baja:", error);
    return next(error);
  }
};

const listarMotivosBaja = async (req, res, next) => {
  try {
    const data = await withPool(async (pool) => FacturacionServices.listarMotivosBajaService(pool));
    res.status(200).send({ data: data || [] });
  } catch (error) {
    console.error("Error listar motivos baja:", error);
    return next(error);
  }
};

const listarComunicacionesBaja = async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta, idEstadoSunat, pagina, porPagina } = req.query || {};
    const result = await withPool(async (pool) => FacturacionServices.listarComunicacionesBajaService(pool, req.user, {
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      idEstadoSunat: idEstadoSunat != null && idEstadoSunat !== "" ? idEstadoSunat : undefined,
      pagina: pagina != null ? parseInt(pagina, 10) : 1,
      porPagina: porPagina != null ? parseInt(porPagina, 10) : 20
    }));
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
    const result = await withPool(async (pool) => ComunicacionBajaService.enviarComunicacionBajaService(pool, req.user, { comprobantes: comprobantes || [] }));
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

const obtenerXmlComunicacionBaja = async (req, res, next) => {
  try {
    const { idComunicacionBaja } = req.params;
    const contenido = await withPool(async (pool) => FacturacionServices.obtenerXmlComunicacionBajaService(pool, req.user, idComunicacionBaja));
    res.status(200).send({ data: { content: contenido } });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    if (error.message === "XML_COMUNICACION_BAJA_NO_DISPONIBLE") {
      return res.status(404).send({ message: "XML no disponible (comunicación anterior a la migración o sin guardado).", data: undefined });
    }
    console.error("Error obtener XML comunicación de baja:", error);
    return next(error);
  }
};

const obtenerCdrComunicacionBaja = async (req, res, next) => {
  try {
    const { idComunicacionBaja } = req.params;
    const contenido = await withPool(async (pool) => FacturacionServices.obtenerCdrComunicacionBajaService(pool, req.user, idComunicacionBaja));
    res.status(200).send({ data: { content: contenido } });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    if (error.message === "CDR_COMUNICACION_BAJA_NO_DISPONIBLE") {
      return res.status(404).send({ message: "CDR no disponible. Consulte el estado en SUNAT primero.", data: undefined });
    }
    console.error("Error obtener CDR comunicación de baja:", error);
    return next(error);
  }
};

const eliminarComunicacionBaja = async (req, res, next) => {
  try {
    const { idComunicacionBaja } = req.params;
    const result = await withPool(async (pool) => ComunicacionBajaService.eliminarComunicacionBajaDesalineadaService(pool, req.user, idComunicacionBaja));
    res.status(200).send({ message: result.mensaje || "Eliminado.", data: undefined });
  } catch (error) {
    if (error.message === "NO_ACCESS") return res.status(401).send({ message: "No autorizado", data: undefined });
    if (error.message === "COMUNICACION_BAJA_NO_ENCONTRADA") {
      return res.status(404).send({ message: "Comunicación de baja no encontrada.", data: undefined });
    }
    if (error.message === "COMUNICACION_BAJA_NO_ELIMINABLE") {
      return res.status(400).send({
        message:
          "No se puede eliminar: solo registros rechazados por SUNAT, con correlativo distinto al último guardado en catálogo RA, o con correlativo inválido. No se eliminan comunicaciones con baja aceptada.",
        data: undefined
      });
    }
    console.error("Error eliminar comunicación de baja:", error);
    return next(error);
  }
};

const consultarEstadoComunicacionBaja = async (req, res, next) => {
  try {
    const { idComunicacionBaja } = req.params;
    const result = await withPool(async (pool) => ComunicacionBajaService.consultarEstadoComunicacionBajaService(pool, req.user, idComunicacionBaja));
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
  listarGuiasEmitidas,
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
  consultarEstadoComunicacionBaja,
  eliminarComunicacionBaja,
  obtenerXmlComunicacionBaja,
  obtenerCdrComunicacionBaja,
  registrarGuia,
  actualizarGuia,
  obtenerGuia,
  previewXmlGuia,
  descargarXmlFirmadoGuia,
  reenviarGuia,
  eliminarGuia,
  consultarTicketGuia,
  consultarEstadoGuiaSol
};