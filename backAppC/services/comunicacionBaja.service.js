/**
 * Servicio de comunicación de baja (RA): arma XML VoidedDocuments, envía sendSummary, consulta getStatus y actualiza comprobantes a Baja aceptada.
 */

const sql = require("mssql");
const FacturacionRepository = require("../repositories/facturacion.repository");
const comprobantesRepository = require("../repositories/comprobantes.repository");
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
  
  // SUNAT VoidedDocuments según documentación oficial:
  // - ID y nombre archivo: RA-{YYYYMMDD de COMUNICACIÓN}-{correlativo} (fecha de HOY)
  // - ReferenceDate: fecha de EMISIÓN de los comprobantes a anular
  // - IssueDate: fecha de COMUNICACIÓN (hoy)
  // IMPORTANTE: Usar zona horaria de Perú (America/Lima, UTC-5) para la fecha
  const fechaComunicacion = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }).replace(/\D/g, ""); // YYYYMMDD de hoy en Perú
  
  // Obtener fecha de emisión de los comprobantes para ReferenceDate
  const fechasCp = comps.map((c) => (c.fechaEmision || "").slice(0, 10)).filter(Boolean);
  const fechasUnicas = [...new Set(fechasCp)];
  if (fechasUnicas.length === 0) {
    return { ok: false, error: "No se pudo obtener la fecha de emisión de los comprobantes." };
  }
  if (fechasUnicas.length > 1) {
    return { ok: false, error: "Los comprobantes a dar de baja deben tener la misma fecha de emisión. Envíe comunicaciones separadas por fecha." };
  }
  const fechaReferencia = fechasUnicas[0].replace(/\D/g, ""); // YYYYMMDD de emisión del comprobante

  const fechaComDateStr = `${fechaComunicacion.slice(0, 4)}-${fechaComunicacion.slice(4, 6)}-${fechaComunicacion.slice(6, 8)}`;
  // Correlativo: máximo entre (siguiente por historial del día en ComunicacionesBaja) y (último en catálogo RA + 1),
  // igual que en ventas (Comprobantes.numero = último correlativo usado).
  const correlativoHistorialStr = await FacturacionRepository.obtenerSiguienteCorrelativoBajaRepo(pool, user.empresa, fechaComDateStr);
  let nHistorial = parseInt(String(correlativoHistorialStr).replace(/\D/g, ""), 10);
  if (Number.isNaN(nHistorial) || nHistorial < 1) nHistorial = 1;
  nHistorial = Math.min(99999, nHistorial);

  const raCatalogo = await comprobantesRepository.obtenerComprobantePorCodigoRepo(pool, user.empresa, "RA");
  const ultimoCatalogo = parseInt(String(raCatalogo?.numero ?? "0").replace(/\D/g, ""), 10);
  const nCatalogo = Math.min(99999, (Number.isNaN(ultimoCatalogo) ? 0 : ultimoCatalogo) + 1);

  const correlativo = String(Math.min(99999, Math.max(nHistorial, nCatalogo)));

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
    fechaReferencia,      // Fecha de emisión de los comprobantes (para ReferenceDate y ID)
    fechaComunicacion,    // Fecha de hoy (para IssueDate)
    correlativo
  };

  let xml = generadorXmlVoidedDocuments.generarXmlVoidedDocuments(datosXml, lineas);
  try {
    xml = firmaXmlSunat.firmarXmlUbl(xml, Buffer.from(certBase64, "base64"), claveCert);
  } catch (err) {
    console.error("comunicacionBaja: error al firmar XML:", err.message);
    return { ok: false, error: err.message || "Error al firmar el XML." };
  }

  const nombreBase = `${rucStr}-RA-${fechaComunicacion}-${correlativo}`;
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

  const idComunicacionBaja = await FacturacionRepository.insertarComunicacionBajaRepo(
    pool,
    user.empresa,
    fechaComDateStr,
    correlativo,
    resultadoSend.ticket,
    xml
  );
  for (const c of comprobantes) {
    await FacturacionRepository.insertarComunicacionBajaDetalleRepo(
      pool,
      idComunicacionBaja,
      c.idComprobanteElectronico,
      c.motivoBaja || "Anulación de la operación"
    );
  }

  try {
    const idRaComp = raCatalogo?.idComprobante != null ? raCatalogo.idComprobante : null;
    if (idRaComp != null) {
      const numCorr = parseInt(String(correlativo).replace(/\D/g, ""), 10);
      if (!Number.isNaN(numCorr) && numCorr >= 0) {
        await comprobantesRepository.actualizarNumeroComprobante(pool, user.empresa, idRaComp, numCorr);
      }
    }
  } catch (err) {
    console.error("comunicacionBaja: no se pudo sincronizar correlativo RA en Comprobantes:", err.message);
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
      
      console.error("comunicacionBaja: CDR procesado", { idEstadoSunat, codigo: cdr?.codigo, descripcion: cdr?.descripcion?.substring(0, 100) });
      
      await FacturacionRepository.actualizarComunicacionBajaResultadoRepo(pool, idComunicacionBaja, {
        idEstadoSunat,
        codigoRespuesta: cdr ? cdr.codigo : null,
        descripcionRespuesta: cdr ? cdr.descripcion : null,
        cdr: cdr ? cdr.xml : null
      });
      
      // Si la comunicación fue aceptada, actualizar estado de los comprobantes a "Baja Aceptada"
      if (idEstadoSunat === 1 || idEstadoSunat === 3) {
        const idBajaAceptada = await FacturacionRepository.obtenerIdEstadoSunatPorCodigoRepo(pool, "08");
        const idsComp = await FacturacionRepository.listarComprobantesDeComunicacionBajaRepo(pool, idComunicacionBaja);
        
        console.error("comunicacionBaja: actualizando comprobantes", { idBajaAceptada, idsCompCount: idsComp?.length, idsComp });
        
        if (idsComp && idsComp.length > 0) {
          // Si no existe estado "08", usar idEstadoSunat (1=Aceptado)
          const estadoFinal = idBajaAceptada != null ? idBajaAceptada : idEstadoSunat;
          await FacturacionRepository.actualizarEstadoComprobantesRepo(
            pool,
            idsComp,
            estadoFinal,
            cdr ? cdr.xml : null,
            cdr ? cdr.codigo : null,
            cdr ? `Baja aceptada: ${cdr.descripcion || ''}`.trim() : "Baja aceptada"
          );
          console.error("comunicacionBaja: comprobantes actualizados a estado", estadoFinal);
        } else {
          console.error("comunicacionBaja: ADVERTENCIA - No se encontraron comprobantes para actualizar en ComunicacionBajaDetalle");
        }
      }
      return { ok: true, statusCode: 0, idEstadoSunat, mensaje: cdr ? cdr.descripcion : "Procesado" };
    } catch (err) {
      console.error("comunicacionBaja: error al procesar CDR:", err.message, err.stack);
      return { ok: false, error: err.message };
    }
  }

  if (status.statusCode === 99) {
    let codigoRespuesta = null;
    let descripcionRespuesta = status.error || "Rechazado";
    let cdrXml = null;
    if (status.content) {
      const cdr = await envioDirectoSunat.extraerCdrDesdeContentBase64(status.content);
      if (cdr) {
        codigoRespuesta = cdr.codigo;
        descripcionRespuesta = (cdr.descripcion && cdr.descripcion.trim()) ? cdr.descripcion : descripcionRespuesta;
        cdrXml = cdr.xml;
      }
    }
    await FacturacionRepository.actualizarComunicacionBajaResultadoRepo(pool, idComunicacionBaja, {
      idEstadoSunat: 4,
      codigoRespuesta,
      descripcionRespuesta,
      cdr: cdrXml
    });
    return { ok: false, statusCode: 99, idEstadoSunat: 4, error: descripcionRespuesta };
  }

  return { ok: false, statusCode: status.statusCode, error: status.error || "Error al consultar estado." };
}

/**
 * Permite borrar historial que no alinea con el correlativo RA del catálogo (Comprobantes), o comunicaciones rechazadas.
 * No aplica a baja aceptada (8). No modifica Comprobantes.numero.
 */
function puedeEliminarComunicacionBajaPorCorrelativo(row, numeroUltimoRaCatalogo) {
  const estado = row.idEstadoSunat;
  if (estado === 8) return false;
  if (estado === 4) return true;
  const c = parseInt(String(row.numeroCorrelativo ?? "").replace(/\D/g, ""), 10);
  const cat = parseInt(String(numeroUltimoRaCatalogo ?? "0"), 10);
  const catNorm = Number.isNaN(cat) ? 0 : cat;
  if (Number.isNaN(c)) return true;
  return c !== catNorm;
}

async function eliminarComunicacionBajaDesalineadaService(pool, user, idComunicacionBaja) {
  if (!user || !user.empresa) throw new Error("NO_ACCESS");
  const id = String(idComunicacionBaja || "").trim();
  if (!id) throw new Error("COMUNICACION_BAJA_NO_ENCONTRADA");

  const row = await FacturacionRepository.obtenerComunicacionBajaPorIdRepo(pool, user.empresa, id);
  if (!row) throw new Error("COMUNICACION_BAJA_NO_ENCONTRADA");

  const ra = await comprobantesRepository.obtenerComprobantePorCodigoRepo(pool, user.empresa, "RA");
  const numeroCat = ra != null ? ra.numero : null;

  if (!puedeEliminarComunicacionBajaPorCorrelativo(row, numeroCat)) {
    throw new Error("COMUNICACION_BAJA_NO_ELIMINABLE");
  }

  const ok = await FacturacionRepository.eliminarComunicacionBajaPorIdRepo(pool, user.empresa, id);
  if (!ok) throw new Error("COMUNICACION_BAJA_NO_ENCONTRADA");
  return { ok: true, mensaje: "Comunicación de baja eliminada del historial. El correlativo del catálogo RA no se modificó." };
}

module.exports = {
  enviarComunicacionBajaService,
  consultarEstadoComunicacionBajaService,
  eliminarComunicacionBajaDesalineadaService
};
