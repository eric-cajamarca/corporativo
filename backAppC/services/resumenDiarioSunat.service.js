/**
 * Servicio de resumen diario (RC): arma XML, envía sendSummary, consulta getStatus y actualiza comprobantes.
 */

const sql = require("mssql");
const FacturacionRepository = require("../repositories/facturacion.repository");
const { idUsuarioDesdePayloadUser } = require("../utils/idUsuarioSesion.util");
const generadorXmlResumenDiario = require("./generadorXmlResumenDiarioSunat.service");
const firmaXmlSunat = require("./firmaXmlSunat.service");
const envioDirectoSunat = require("./envioDirectoSunat.service");
const cifradoClaveCertificado = require("../utils/cifradoClaveCertificado.util");
const { getFechaHoyLocal } = require("../utils/fechaHoraLocal.util");

/**
 * Arma lineas para el XML de resumen a partir de comprobantes pendientes (con datos venta/cliente).
 * Para 07/08 obtiene documento de referencia desde Ventas.compRelacionado.
 */
async function armarLineasResumen(pool, idEmpresa, comprobantes) {
  const lineas = [];
  for (const ce of comprobantes) {
    const ref = (ce.tipoComprobante === "07" || ce.tipoComprobante === "08")
      ? await FacturacionRepository.obtenerDocumentoReferenciaVentaRepo(pool, ce.idVenta, idEmpresa)
      : { serieReferencia: "", numeroReferencia: "" };
    lineas.push({
      tipoComprobante: ce.tipoComprobante,
      serie: ce.serie,
      numero: ce.numero,
      fechaEmision: ce.fechaEmision,
      tipoDocReceptor: ce.tipoDocReceptor || "1",
      numeroDocReceptor: (ce.numeroDocReceptor || "").replace(/\D/g, "").padStart(8, "0") || "00000000",
      totalGravada: ce.subtotal,
      totalIgv: ce.igv,
      total: ce.total,
      estado: 1,
      serieReferencia: ref.serieReferencia,
      numeroReferencia: ref.numeroReferencia
    });
  }
  return lineas;
}

/**
 * Genera y envía resumen diario para una fecha. Requiere envío directo configurado y certificado.
 * @param {object} pool - Pool SQL
 * @param {object} user - req.user (empresa, etc.)
 * @param {string} fechaResumen - Fecha del resumen YYYY-MM-DD
 * @returns {Promise<{ ok: boolean, idResumenDiarioSunat?: string, ticket?: string, mensaje?: string, error?: string }>}
 */
async function enviarResumenDiarioService(pool, user, fechaResumen) {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");

  const config = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, user.empresa);
  if (!config || !config.envioDirectoSunat || !config.urlEnvio || !config.usuarioSunat || !config.claveSunat) {
    return { ok: false, error: "Configure envío directo SUNAT (URL, usuario y clave) en Configuración > Facturación" };
  }

  const comprobantes = await FacturacionRepository.listarBoletasPendientesParaResumenRepo(pool, user.empresa, fechaResumen);
  if (!comprobantes || comprobantes.length === 0) {
    return { ok: false, error: "No hay boletas o notas (03/07/08) pendientes de envío para esa fecha" };
  }

  const configFirma = await FacturacionRepository.obtenerConfiguracionParaFirmaRepo(pool, user.empresa);
  const certBase64 = configFirma?.certificadoDigital;
  const claveCert = configFirma?.claveCertificado ? cifradoClaveCertificado.descifrar(configFirma.claveCertificado) : null;
  if (!certBase64 || !claveCert) {
    return { ok: false, error: "Certificado digital y clave son requeridos para enviar resumen diario" };
  }

  const rucStr = String(config.rucEmpresa || "").replace(/\D/g, "").padStart(11, "0");
  const correlativo = await FacturacionRepository.obtenerSiguienteCorrelativoResumenRepo(pool, user.empresa, fechaResumen);
  const fechaRef = typeof fechaResumen === "string" ? fechaResumen.slice(0, 10).replace(/\D/g, "") : "";
  const fechaRefStr = fechaRef.length >= 8 ? `${fechaRef.slice(0, 4)}${fechaRef.slice(4, 6)}${fechaRef.slice(6, 8)}` : "";
  const fechaGenStr = getFechaHoyLocal().replace(/\D/g, "").slice(0, 8);

  const lineas = await armarLineasResumen(pool, user.empresa, comprobantes);
  const empresaResult = await pool.request()
    .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
    .query("SELECT ruc, razon_Social FROM Empresas WHERE idEmpresa = @idEmpresa");
  const emp = empresaResult.recordset && empresaResult.recordset[0] ? empresaResult.recordset[0] : {};
  const datosResumen = {
    rucEmisor: emp.ruc,
    razonSocialEmisor: emp.razon_Social,
    fechaResumen: fechaRefStr,
    fechaGeneracion: fechaGenStr,
    correlativo
  };

  let xml = generadorXmlResumenDiario.generarXmlResumenDiario(datosResumen, lineas);
  try {
    xml = firmaXmlSunat.firmarXmlUbl(xml, Buffer.from(certBase64, "base64"), claveCert);
  } catch (err) {
    console.error("resumenDiarioSunat: error al firmar XML:", err.message);
    return { ok: false, error: err.message || "Error al firmar el XML del resumen" };
  }

  const nombreBase = `${rucStr}-RC-${fechaRefStr}-${correlativo}`;
  const usuarioSOAP = (config.usuarioSunat.length >= 20 || /^\d+/.test(config.usuarioSunat))
    ? config.usuarioSunat
    : rucStr + String(config.usuarioSunat).trim();
  const claveSunatDec = config.claveSunat ? cifradoClaveCertificado.descifrar(config.claveSunat) : null;

  const resultadoSend = await envioDirectoSunat.enviarResumenDirectoSunat(
    xml,
    nombreBase,
    usuarioSOAP,
    claveSunatDec || config.claveSunat,
    config.urlEnvio
  );

  if (!resultadoSend.ok || !resultadoSend.ticket) {
    return { ok: false, error: resultadoSend.error || "SUNAT no devolvió ticket" };
  }

  const idResumen = await FacturacionRepository.insertarResumenDiarioRepo(
    pool,
    user.empresa,
    fechaResumen,
    correlativo,
    resultadoSend.ticket
  );
  for (const ce of comprobantes) {
    await FacturacionRepository.insertarResumenDiarioDetalleRepo(pool, idResumen, ce.idComprobanteElectronico);
  }

  return {
    ok: true,
    idResumenDiarioSunat: idResumen,
    ticket: resultadoSend.ticket,
    mensaje: "Resumen diario enviado. El estado se actualizará al consultar SUNAT (getStatus)."
  };
}

/**
 * Consulta estado de un resumen en SUNAT (getStatus) y actualiza BD y comprobantes si ya procesado.
 * @param {object} pool
 * @param {object} user
 * @param {string} idResumenDiarioSunat
 * @returns {Promise<{ ok: boolean, statusCode?: number, idEstadoSunat?: number, mensaje?: string, error?: string }>}
 */
async function consultarEstadoResumenDiarioService(pool, user, idResumenDiarioSunat) {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");

  const config = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, user.empresa);
  if (!config || !config.envioDirectoSunat || !config.urlEnvio || !config.usuarioSunat || !config.claveSunat) {
    return { ok: false, error: "Configure envío directo SUNAT" };
  }

  const resumenResult = await pool.request()
    .input("idResumenDiarioSunat", sql.UniqueIdentifier, idResumenDiarioSunat)
    .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
    .query(`
      SELECT ticketSunat, idEstadoSunat FROM ResumenesDiariosSunat
      WHERE idResumenDiarioSunat = @idResumenDiarioSunat AND idEmpresa = @idEmpresa
    `);
  const resumen = resumenResult.recordset && resumenResult.recordset[0] ? resumenResult.recordset[0] : null;
  if (!resumen || !resumen.ticketSunat) {
    return { ok: false, error: "Resumen no encontrado o sin ticket" };
  }
  if (resumen.idEstadoSunat != null && resumen.idEstadoSunat !== 7) {
    return { ok: true, statusCode: 0, idEstadoSunat: resumen.idEstadoSunat, mensaje: "Resumen ya fue procesado." };
  }

  const usuarioSOAP = (config.usuarioSunat.length >= 20 || /^\d+/.test(config.usuarioSunat))
    ? config.usuarioSunat
    : String(config.rucEmpresa || "").replace(/\D/g, "").padStart(11, "0") + String(config.usuarioSunat).trim();
  const claveSunatDec = config.claveSunat ? cifradoClaveCertificado.descifrar(config.claveSunat) : null;

  const status = await envioDirectoSunat.consultarEstadoResumenSunat(
    resumen.ticketSunat,
    usuarioSOAP,
    claveSunatDec || config.claveSunat,
    config.urlEnvio
  );

  if (status.statusCode === 98) {
    return { ok: true, statusCode: 98, mensaje: "Resumen aún en proceso en SUNAT. Vuelva a consultar más tarde." };
  }

  if (status.statusCode === 0 && status.content) {
    try {
      const zipBuffer = Buffer.from(status.content, "base64");
      const cdr = await envioDirectoSunat.extraerCdrDeZipBuffer(zipBuffer);
      const idEstadoSunat = envioDirectoSunat.responseCodeToIdEstadoSunat(cdr ? cdr.codigo : "99");
      await FacturacionRepository.actualizarResumenDiarioResultadoRepo(pool, idResumenDiarioSunat, {
        idEstadoSunat,
        codigoRespuesta: cdr ? cdr.codigo : null,
        descripcionRespuesta: cdr ? cdr.descripcion : null,
        cdr: cdr ? cdr.xml : null
      });
      if (idEstadoSunat === 1 || idEstadoSunat === 3) {
        const idsComp = await FacturacionRepository.listarComprobantesDeResumenRepo(pool, idResumenDiarioSunat);
        await FacturacionRepository.actualizarEstadoComprobantesRepo(
          pool,
          idsComp,
          idEstadoSunat,
          cdr ? cdr.xml : null,
          cdr ? cdr.codigo : null,
          cdr ? cdr.descripcion : null,
          { idUsuarioEjecutor: idUsuarioDesdePayloadUser(user) }
        );
      }
      return { ok: true, statusCode: 0, idEstadoSunat, mensaje: cdr ? cdr.descripcion : "Procesado" };
    } catch (err) {
      console.error("resumenDiarioSunat: error al procesar CDR:", err.message);
      return { ok: false, error: err.message };
    }
  }

  if (status.statusCode === 99) {
    await FacturacionRepository.actualizarResumenDiarioResultadoRepo(pool, idResumenDiarioSunat, {
      idEstadoSunat: 4,
      descripcionRespuesta: status.error || "Rechazado"
    });
    return { ok: false, statusCode: 99, error: status.error || "SUNAT rechazó el resumen" };
  }

  return { ok: false, statusCode: status.statusCode, error: status.error || "Error al consultar estado" };
}

module.exports = {
  enviarResumenDiarioService,
  consultarEstadoResumenDiarioService
};
