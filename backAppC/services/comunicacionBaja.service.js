/**
 * Servicio de comunicación de baja (RA): arma XML VoidedDocuments, envía sendSummary, consulta getStatus y actualiza comprobantes a Baja aceptada.
 */

const sql = require("mssql");
const FacturacionRepository = require("../repositories/facturacion.repository");
const generadorXmlVoidedDocuments = require("./generadorXmlVoidedDocumentsSunat.service");
const firmaXmlSunat = require("./firmaXmlSunat.service");
const envioDirectoSunat = require("./envioDirectoSunat.service");
const cifradoClaveCertificado = require("../utils/cifradoClaveCertificado.util");

/**
 * Envía una comunicación de baja (RA) con los comprobantes indicados.
 * @param {object} pool
 * @param {object} user
 * @param {object} datos - { comprobantes: [ { idComprobanteElectronico, motivoBaja } ] }
 * @returns {Promise<{ ok: boolean, idComunicacionBaja?: string, ticket?: string, mensaje?: string, error?: string }>}
 */
async function enviarComunicacionBajaService(pool, user, datos) {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");

  const comprobantes = datos.comprobantes;
  if (!Array.isArray(comprobantes) || comprobantes.length === 0) {
    return { ok: false, error: "Debe incluir al menos un comprobante a dar de baja." };
  }

  const ids = comprobantes.map((c) => c.idComprobanteElectronico).filter(Boolean);
  const comps = await FacturacionRepository.obtenerComprobantesParaBajaPorIdsRepo(pool, user.empresa, ids);
  if (comps.length !== ids.length) {
    return { ok: false, error: "Algunos comprobantes no existen, no son Factura/NC/ND o no están aceptados. Solo se pueden dar de baja comprobantes en estado Aceptado." };
  }

  const config = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, user.empresa);
  if (!config || !config.envioDirectoSunat || !config.urlEnvio || !config.usuarioSunat || !config.claveSunat) {
    return { ok: false, error: "Configure envío directo SUNAT (URL, usuario y clave) en Configuración > Facturación." };
  }

  const configFirma = await FacturacionRepository.obtenerConfiguracionParaFirmaRepo(pool, user.empresa);
  const certBase64 = configFirma?.certificadoDigital;
  const claveCert = configFirma?.claveCertificado ? cifradoClaveCertificado.descifrar(configFirma.claveCertificado) : null;
  if (!certBase64 || !claveCert) {
    return { ok: false, error: "Certificado digital y clave son requeridos para enviar la comunicación de baja." };
  }

  const rucStr = String(config.rucEmpresa || "").replace(/\D/g, "").padStart(11, "0");
  const fechaCom = new Date().toISOString().slice(0, 10).replace(/\D/g, "");
  const correlativo = await FacturacionRepository.obtenerSiguienteCorrelativoBajaRepo(pool, user.empresa, fechaCom.slice(0, 4) + "-" + fechaCom.slice(4, 6) + "-" + fechaCom.slice(6, 8));

  const motivoPorId = {};
  comprobantes.forEach((c) => {
    motivoPorId[c.idComprobanteElectronico] = (c.motivoBaja || "Anulación de la operación").slice(0, 250);
  });

  const lineas = comps.map((c) => ({
    tipoComprobante: c.tipoComprobante,
    serie: c.serie,
    numero: c.numero,
    motivoBaja: motivoPorId[c.idComprobanteElectronico] || "Anulación de la operación"
  }));

  const empresaResult = await pool.request()
    .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
    .query("SELECT ruc, razon_Social FROM Empresas WHERE idEmpresa = @idEmpresa");
  const emp = empresaResult.recordset && empresaResult.recordset[0] ? empresaResult.recordset[0] : {};

  const datosXml = {
    rucEmisor: emp.ruc,
    razonSocialEmisor: emp.razon_Social,
    fechaComunicacion: fechaCom,
    correlativo
  };

  let xml = generadorXmlVoidedDocuments.generarXmlVoidedDocuments(datosXml, lineas);
  try {
    xml = firmaXmlSunat.firmarXmlUbl(xml, Buffer.from(certBase64, "base64"), claveCert);
  } catch (err) {
    console.error("comunicacionBaja: error al firmar XML:", err.message);
    return { ok: false, error: err.message || "Error al firmar el XML." };
  }

  const nombreBase = `${rucStr}-RA-${fechaCom}-${correlativo}`;
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
    return { ok: false, error: resultadoSend.error || "SUNAT no devolvió ticket." };
  }

  const fechaComDate = `${fechaCom.slice(0, 4)}-${fechaCom.slice(4, 6)}-${fechaCom.slice(6, 8)}`;
  const idComunicacionBaja = await FacturacionRepository.insertarComunicacionBajaRepo(
    pool,
    user.empresa,
    fechaComDate,
    correlativo,
    resultadoSend.ticket
  );
  for (const c of comprobantes) {
    await FacturacionRepository.insertarComunicacionBajaDetalleRepo(
      pool,
      idComunicacionBaja,
      c.idComprobanteElectronico,
      c.motivoBaja || "Anulación de la operación"
    );
  }

  return {
    ok: true,
    idComunicacionBaja,
    ticket: resultadoSend.ticket,
    mensaje: "Comunicación de baja enviada. Consulte el estado para obtener el resultado (getStatus)."
  };
}

/**
 * Consulta estado de una comunicación de baja en SUNAT (getStatus) y actualiza BD y comprobantes si ya procesado.
 * @param {object} pool
 * @param {object} user
 * @param {string} idComunicacionBaja
 * @returns {Promise<{ ok: boolean, statusCode?: number, idEstadoSunat?: number, mensaje?: string, error?: string }>}
 */
async function consultarEstadoComunicacionBajaService(pool, user, idComunicacionBaja) {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");

  const config = await FacturacionRepository.obtenerConfiguracionFacturacionRepo(pool, user.empresa);
  if (!config || !config.envioDirectoSunat || !config.urlEnvio || !config.usuarioSunat || !config.claveSunat) {
    return { ok: false, error: "Configure envío directo SUNAT." };
  }

  const resResult = await pool.request()
    .input("idComunicacionBaja", sql.UniqueIdentifier, idComunicacionBaja)
    .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
    .query(`
      SELECT ticketSunat, idEstadoSunat FROM ComunicacionesBaja
      WHERE idComunicacionBaja = @idComunicacionBaja AND idEmpresa = @idEmpresa
    `);
  const com = resResult.recordset && resResult.recordset[0] ? resResult.recordset[0] : null;
  if (!com || !com.ticketSunat) {
    return { ok: false, error: "Comunicación de baja no encontrada o sin ticket." };
  }
  if (com.idEstadoSunat != null && com.idEstadoSunat !== 7) {
    return { ok: true, statusCode: 0, idEstadoSunat: com.idEstadoSunat, mensaje: "Comunicación ya fue procesada." };
  }

  const usuarioSOAP = (config.usuarioSunat.length >= 20 || /^\d+/.test(config.usuarioSunat))
    ? config.usuarioSunat
    : String(config.rucEmpresa || "").replace(/\D/g, "").padStart(11, "0") + String(config.usuarioSunat).trim();
  const claveSunatDec = config.claveSunat ? cifradoClaveCertificado.descifrar(config.claveSunat) : null;

  const status = await envioDirectoSunat.consultarEstadoResumenSunat(
    com.ticketSunat,
    usuarioSOAP,
    claveSunatDec || config.claveSunat,
    config.urlEnvio
  );

  if (status.statusCode === 98) {
    return { ok: true, statusCode: 98, mensaje: "Comunicación aún en proceso en SUNAT. Vuelva a consultar más tarde." };
  }

  if (status.statusCode === 0 && status.content) {
    try {
      const zipBuffer = Buffer.from(status.content, "base64");
      const cdr = await envioDirectoSunat.extraerCdrDeZipBuffer(zipBuffer);
      const idEstadoSunat = envioDirectoSunat.responseCodeToIdEstadoSunat(cdr ? cdr.codigo : "99");
      await FacturacionRepository.actualizarComunicacionBajaResultadoRepo(pool, idComunicacionBaja, {
        idEstadoSunat,
        codigoRespuesta: cdr ? cdr.codigo : null,
        descripcionRespuesta: cdr ? cdr.descripcion : null,
        cdr: cdr ? cdr.xml : null
      });
      if (idEstadoSunat === 1 || idEstadoSunat === 3) {
        const idBajaAceptada = await FacturacionRepository.obtenerIdEstadoSunatPorCodigoRepo(pool, "08");
        const idsComp = await FacturacionRepository.listarComprobantesDeComunicacionBajaRepo(pool, idComunicacionBaja);
        await FacturacionRepository.actualizarEstadoComprobantesRepo(
          pool,
          idsComp,
          idBajaAceptada != null ? idBajaAceptada : idEstadoSunat,
          cdr ? cdr.xml : null,
          cdr ? cdr.codigo : null,
          cdr ? cdr.descripcion : null
        );
      }
      return { ok: true, statusCode: 0, idEstadoSunat, mensaje: cdr ? cdr.descripcion : "Procesado" };
    } catch (err) {
      console.error("comunicacionBaja: error al procesar CDR:", err.message);
      return { ok: false, error: err.message };
    }
  }

  if (status.statusCode === 99) {
    await FacturacionRepository.actualizarComunicacionBajaResultadoRepo(pool, idComunicacionBaja, {
      idEstadoSunat: 4,
      descripcionRespuesta: status.error || "Rechazado"
    });
    return { ok: false, statusCode: 99, error: status.error || "SUNAT rechazó la comunicación de baja." };
  }

  return { ok: false, statusCode: status.statusCode, error: status.error || "Error al consultar estado." };
}

module.exports = {
  enviarComunicacionBajaService,
  consultarEstadoComunicacionBajaService
};
