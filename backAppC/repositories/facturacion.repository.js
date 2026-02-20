const sql = require("mssql");
const ventasRepository = require("../repositories/ventas.repository");
const { getNowLocal, getNowLocalSQLString } = require("../utils/fechaHoraLocal.util");
const debugSunatLog = require("../utils/debugSunatLog.util");
const { escribirArchivosPlanos, escribirXmlFirma, nombreArchivoComprobante } = require("../utils/facturadorSunat.util");
const cifradoClaveCertificado = require("../utils/cifradoClaveCertificado.util");
const archivoPlanoFacturador = require("../services/archivoPlanoFacturador.service");
const generadorXmlUblSunat = require("../services/generadorXmlUblSunat.service");
const firmaXmlSunat = require("../services/firmaXmlSunat.service");
const envioDirectoSunat = require("../services/envioDirectoSunat.service");

exports.obtenerConfiguracionFacturacionRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        c.idConfiguracion,
        c.certificadoDigital,
        c.claveCertificado,
        c.usuarioSunat,
        c.claveSunat,
        c.urlEnvio,
        c.urlConsulta,
        c.modoPrueba,
        c.serieFactura,
        c.serieBoleta,
        c.serieNotaCredito,
        c.serieNotaDebito,
        c.rutaCarpetaFacturadorSunat,
        c.urlFacturadorSunat,
        c.envioAutomatico,
        c.minutosEnvioAutomatico,
        c.envioPorLotes,
        c.programacionEnvioLotes,
        c.envioDirectoSunat,
        e.ruc AS rucEmpresa
      FROM ConfiguracionFacturacionElectronica c
      LEFT JOIN Empresas e ON e.idEmpresa = c.idEmpresa
      WHERE c.idEmpresa = @idEmpresa
    `);

  const row = result.recordset[0];
  if (row) {
    const cert = row.certificadoDigital;
    row.tieneCertificado = cert != null && String(cert).trim() !== "";
    row.envioDirectoSunat = Boolean(row.envioDirectoSunat);
  }
  return row;
};

/** Obtiene configuración incluyendo certificado (base64 en certificadoDigital) y clave para firma en servidor. */
exports.obtenerConfiguracionParaFirmaRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT certificadoDigital, claveCertificado, rutaCarpetaFacturadorSunat, urlFacturadorSunat
      FROM ConfiguracionFacturacionElectronica
      WHERE idEmpresa = @idEmpresa
    `);
  return result.recordset[0] || null;
};

/** Actualiza solo el certificado digital (PFX en base64 en certificadoDigital) y su clave (guardada cifrada). */
exports.actualizarCertificadoFacturacionRepo = async (pool, idEmpresa, certificadoBuffer, claveCertificado) => {
  const certificadoDigital = (certificadoBuffer && Buffer.isBuffer(certificadoBuffer))
    ? certificadoBuffer.toString("base64")
    : "";
  const claveCifrada = (claveCertificado != null && String(claveCertificado).trim() !== "")
    ? cifradoClaveCertificado.cifrar(claveCertificado)
    : null;
  if (certificadoDigital.length > 500) {
    try {
      await pool.request().query(`
        ALTER TABLE ConfiguracionFacturacionElectronica
        ALTER COLUMN certificadoDigital VARCHAR(MAX) NULL
      `);
    } catch (_) {
      // Columna ya VARCHAR(MAX) o sin permisos; continuar con el UPDATE
    }
  }
  if (claveCifrada && claveCifrada.length > 100) {
    try {
      await pool.request().query(`
        ALTER TABLE ConfiguracionFacturacionElectronica
        ALTER COLUMN claveCertificado VARCHAR(256) NULL
      `);
    } catch (_) {}
  }
  await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("certificadoDigital", sql.VarChar(8001), certificadoDigital)
    .input("claveCertificado", sql.VarChar(256), claveCifrada)
    .query(`
      UPDATE ConfiguracionFacturacionElectronica
      SET certificadoDigital = @certificadoDigital, claveCertificado = @claveCertificado
      WHERE idEmpresa = @idEmpresa
    `);
  return { mensaje: "Certificado actualizado" };
};

exports.actualizarConfiguracionFacturacionRepo = async (pool, user, datos) => {
  // Verificar si ya existe configuración
  const existente = await this.obtenerConfiguracionFacturacionRepo(pool, user.empresa);

  const claveCertificadoGuardar = (val, existenteClave) => {
    if (val != null && String(val).trim() !== "") return cifradoClaveCertificado.cifrar(val);
    if (existenteClave !== undefined) return existenteClave;
    return null;
  };
  const claveSunatGuardar = (val, existenteClave) => {
    if (val != null && String(val).trim() !== "") return cifradoClaveCertificado.cifrar(val);
    if (existenteClave !== undefined) return existenteClave;
    return null;
  };

  if (existente) {
    const claveVal = datos.hasOwnProperty("claveCertificado")
      ? claveCertificadoGuardar(datos.claveCertificado, existente.claveCertificado)
      : existente.claveCertificado;
    const claveSunatVal = datos.hasOwnProperty("claveSunat")
      ? claveSunatGuardar(datos.claveSunat, existente.claveSunat)
      : existente.claveSunat;
    if (claveSunatVal && claveSunatVal.length > 20) {
      try {
        await pool.request().query(`
          ALTER TABLE ConfiguracionFacturacionElectronica
          ALTER COLUMN claveSunat VARCHAR(256) NULL
        `);
      } catch (_) {}
    }
    // Actualizar
    await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .input("certificadoDigital", sql.VarChar, datos.certificadoDigital || null)
      .input("claveCertificado", sql.VarChar(256), claveVal)
      .input("usuarioSunat", sql.VarChar, datos.usuarioSunat || null)
      .input("claveSunat", sql.VarChar(256), claveSunatVal)
      .input("modoPrueba", sql.Bit, datos.modoPrueba !== undefined ? datos.modoPrueba : 1)
      .input("serieFactura", sql.VarChar, datos.serieFactura || null)
      .input("serieBoleta", sql.VarChar, datos.serieBoleta || null)
      .input("serieNotaCredito", sql.VarChar, datos.serieNotaCredito || null)
      .input("serieNotaDebito", sql.VarChar, datos.serieNotaDebito || null)
      .input("rutaCarpetaFacturadorSunat", sql.VarChar, datos.rutaCarpetaFacturadorSunat || null)
      .input("urlFacturadorSunat", sql.VarChar, datos.urlFacturadorSunat || null)
      .input("urlEnvio", sql.VarChar, datos.urlEnvio || null)
      .input("envioDirectoSunat", sql.Bit, datos.envioDirectoSunat !== undefined ? datos.envioDirectoSunat : 0)
      .input("envioAutomatico", sql.Bit, datos.envioAutomatico !== undefined ? datos.envioAutomatico : 0)
      .input("minutosEnvioAutomatico", sql.Int, datos.minutosEnvioAutomatico ?? 10)
      .input("envioPorLotes", sql.Bit, datos.envioPorLotes !== undefined ? datos.envioPorLotes : 0)
      .input("programacionEnvioLotes", sql.VarChar, datos.programacionEnvioLotes || null)
      .query(`
        UPDATE ConfiguracionFacturacionElectronica
        SET certificadoDigital = @certificadoDigital,
            claveCertificado = @claveCertificado,
            usuarioSunat = @usuarioSunat,
            claveSunat = @claveSunat,
            rutaCarpetaFacturadorSunat = @rutaCarpetaFacturadorSunat,
            urlFacturadorSunat = @urlFacturadorSunat,
            urlEnvio = @urlEnvio,
            envioDirectoSunat = @envioDirectoSunat,
            modoPrueba = @modoPrueba,
            serieFactura = @serieFactura,
            serieBoleta = @serieBoleta,
            serieNotaCredito = @serieNotaCredito,
            serieNotaDebito = @serieNotaDebito,
            envioAutomatico = @envioAutomatico,
            minutosEnvioAutomatico = @minutosEnvioAutomatico,
            envioPorLotes = @envioPorLotes,
            programacionEnvioLotes = @programacionEnvioLotes
        WHERE idEmpresa = @idEmpresa
      `);
  } else {
    const claveValNueva = claveCertificadoGuardar(datos.claveCertificado, undefined);
    const claveSunatNueva = claveSunatGuardar(datos.claveSunat, undefined);
    if ((claveValNueva && claveValNueva.length > 100) || (claveSunatNueva && claveSunatNueva.length > 20)) {
      try {
        await pool.request().query(`
          ALTER TABLE ConfiguracionFacturacionElectronica
          ALTER COLUMN claveCertificado VARCHAR(256) NULL
        `);
        await pool.request().query(`
          ALTER TABLE ConfiguracionFacturacionElectronica
          ALTER COLUMN claveSunat VARCHAR(256) NULL
        `);
      } catch (_) {}
    }
    // Crear nueva
    await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .input("certificadoDigital", sql.VarChar, datos.certificadoDigital || null)
      .input("claveCertificado", sql.VarChar(256), claveValNueva)
      .input("usuarioSunat", sql.VarChar, datos.usuarioSunat || null)
      .input("claveSunat", sql.VarChar(256), claveSunatNueva)
      .input("modoPrueba", sql.Bit, datos.modoPrueba !== undefined ? datos.modoPrueba : 1)
      .input("serieFactura", sql.VarChar, datos.serieFactura || null)
      .input("serieBoleta", sql.VarChar, datos.serieBoleta || null)
      .input("serieNotaCredito", sql.VarChar, datos.serieNotaCredito || null)
      .input("serieNotaDebito", sql.VarChar, datos.serieNotaDebito || null)
      .input("rutaCarpetaFacturadorSunat", sql.VarChar, datos.rutaCarpetaFacturadorSunat || null)
      .input("urlFacturadorSunat", sql.VarChar, datos.urlFacturadorSunat || null)
      .input("urlEnvio", sql.VarChar, datos.urlEnvio || null)
      .input("envioDirectoSunat", sql.Bit, datos.envioDirectoSunat !== undefined ? datos.envioDirectoSunat : 0)
      .input("envioAutomatico", sql.Bit, datos.envioAutomatico !== undefined ? datos.envioAutomatico : 0)
      .input("minutosEnvioAutomatico", sql.Int, datos.minutosEnvioAutomatico ?? 10)
      .input("envioPorLotes", sql.Bit, datos.envioPorLotes !== undefined ? datos.envioPorLotes : 0)
      .input("programacionEnvioLotes", sql.VarChar, datos.programacionEnvioLotes || null)
      .query(`
        INSERT INTO ConfiguracionFacturacionElectronica (
          idEmpresa, certificadoDigital, claveCertificado, usuarioSunat,
          claveSunat, modoPrueba, serieFactura, serieBoleta,
          serieNotaCredito, serieNotaDebito, rutaCarpetaFacturadorSunat, urlFacturadorSunat,
          urlEnvio, envioDirectoSunat, envioAutomatico, minutosEnvioAutomatico, envioPorLotes, programacionEnvioLotes
        ) VALUES (
          @idEmpresa, @certificadoDigital, @claveCertificado, @usuarioSunat,
          @claveSunat, @modoPrueba, @serieFactura, @serieBoleta,
          @serieNotaCredito, @serieNotaDebito, @rutaCarpetaFacturadorSunat, @urlFacturadorSunat,
          @urlEnvio, @envioDirectoSunat, @envioAutomatico, @minutosEnvioAutomatico, @envioPorLotes, @programacionEnvioLotes
        )
      `);
  }

  return { mensaje: "Configuración actualizada exitosamente" };
};

/** Lista empresas con envío automático activo (Facturador o envío directo configurado). */
exports.listarEmpresasConEnvioAutomaticoRepo = async (pool) => {
  try {
    const result = await pool.request().query(`
      SELECT idEmpresa, minutosEnvioAutomatico, rutaCarpetaFacturadorSunat, urlFacturadorSunat,
             urlEnvio, usuarioSunat, claveSunat, ISNULL(envioDirectoSunat, 0) AS envioDirectoSunat
      FROM ConfiguracionFacturacionElectronica
      WHERE envioAutomatico = 1
        AND (
          (rutaCarpetaFacturadorSunat IS NOT NULL AND LTRIM(RTRIM(rutaCarpetaFacturadorSunat)) <> '')
          OR (ISNULL(envioDirectoSunat, 0) = 1 AND urlEnvio IS NOT NULL AND LTRIM(RTRIM(urlEnvio)) <> '' AND usuarioSunat IS NOT NULL AND claveSunat IS NOT NULL)
        )
    `);
    return result.recordset || [];
  } catch (_) {
    const result = await pool.request().query(`
      SELECT idEmpresa, minutosEnvioAutomatico, rutaCarpetaFacturadorSunat, urlFacturadorSunat
      FROM ConfiguracionFacturacionElectronica
      WHERE envioAutomatico = 1 AND rutaCarpetaFacturadorSunat IS NOT NULL AND LTRIM(RTRIM(rutaCarpetaFacturadorSunat)) <> ''
    `);
    return result.recordset || [];
  }
};

exports.validarVentaEmpresaRepo = async (pool, idVenta, idEmpresa) => {
  const result = await pool
    .request()
    .input("idVenta", sql.Int, idVenta)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe
      FROM Ventas
      WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
    `);

  return result.recordset[0].existe > 0;
};

exports.generarComprobanteElectronicoRepo = async (pool, user, datos, configuracion) => {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const request = transaction.request();

    // Obtener datos de la venta
    const ventaResult = await request
      .input("idVenta", sql.Int, datos.idVenta)
      .query(`
        SELECT
          v.idVenta,
          v.serie,
          v.numero,
          v.fEmision,
          v.subtotal,
          v.igv,
          v.total,
          c.ruc,
          c.rSocial,
          e.ruc AS rucEmpresa,
          e.razon_Social,
          e.correo AS correoEmpresa
        FROM Ventas v
        INNER JOIN Clientes c ON v.idCliente = c.idCliente
        INNER JOIN Empresas e ON v.idEmpresa = e.idEmpresa
        WHERE v.idVenta = @idVenta
      `);

    const venta = ventaResult.recordset[0];

    // Generar serie y número
    let serie, numero;
    if (datos.tipoComprobante === '01') { // Factura
      serie = configuracion.serieFactura || 'F001';
    } else if (datos.tipoComprobante === '03') { // Boleta
      serie = configuracion.serieBoleta || 'B001';
    }

    // Obtener siguiente número (simulado)
    numero = venta.numero.toString().padStart(8, '0');

    // Generar XML simulado (en producción se generaría XML real UBL 2.1)
    const xmlGenerado = await generarXMLFactura(venta, serie, numero);

    // Generar hash simulado
    const hash = generarHashSimulado(xmlGenerado);

    // Crear registro del comprobante electrónico
    const comprobanteResult = await request
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .input("idVenta", sql.Int, datos.idVenta)
      .input("tipoComprobante", sql.VarChar, datos.tipoComprobante)
      .input("serie", sql.VarChar, serie)
      .input("numero", sql.VarChar, numero)
      .input("fechaEmision", sql.DateTime, venta.fEmision)
      .input("xmlEnviado", sql.NVarChar, xmlGenerado)
      .input("hash", sql.VarChar, hash)
      .query(`
        INSERT INTO ComprobantesElectronicos (
          idEmpresa, idVenta, tipoComprobante, serie, numero,
          fechaEmision, xmlEnviado, hash, idEstadoSunat
        )
        OUTPUT INSERTED.idComprobanteElectronico
        VALUES (
          @idEmpresa, @idVenta, @tipoComprobante, @serie, @numero,
          @fechaEmision, @xmlEnviado, @hash, 7
        )
      `);

    await transaction.commit();
    return {
      idComprobanteElectronico: comprobanteResult.recordset[0].idComprobanteElectronico,
      serie,
      numero,
      hash,
      mensaje: "Comprobante electrónico generado exitosamente"
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/** Códigos SUNAT que se registran en ComprobantesElectronicos: Factura, Boleta, Nota de crédito, Nota de débito */
const TIPOS_COMPROBANTE_ELECTRONICO = ["01", "03", "07", "08"];

/**
 * Registra el comprobante en ComprobantesElectronicos al crear una venta.
 * Solo para tipos 01 Factura, 03 Boleta, 07 Nota de crédito, 08 Nota de débito.
 * Ejecutar dentro de la misma transacción de la venta.
 */
exports.registrarComprobanteElectronicoPorVentaRepo = async (
  transaction,
  idEmpresa,
  idVenta,
  idComprobante,
  serie,
  numero,
  fechaEmision
) => {
  const request = transaction.request();
  const codigoResult = await request
    .input("idComprobante", sql.Int, idComprobante)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT codigo FROM Comprobantes
      WHERE idComprobante = @idComprobante AND idEmpresa = @idEmpresa
    `);
  const codigo = codigoResult.recordset[0]?.codigo;
  const codigoStr = codigo != null ? String(codigo).trim() : "";
  if (!TIPOS_COMPROBANTE_ELECTRONICO.includes(codigoStr)) {
    return;
  }
  const numeroStr = numero != null ? String(numero).padStart(8, "0") : "";
  const requestInsert = transaction.request();
  await requestInsert
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idVenta", sql.Int, idVenta)
    .input("tipoComprobante", sql.VarChar(2), codigoStr)
    .input("serie", sql.VarChar(10), serie != null ? String(serie).trim() : "")
    .input("numero", sql.VarChar(10), numeroStr)
    .input("fechaEmision", sql.VarChar(23), typeof fechaEmision === 'string' ? fechaEmision : fechaEmision)
    .query(`
      INSERT INTO ComprobantesElectronicos (
        idEmpresa, idVenta, tipoComprobante, serie, numero,
        fechaEmision, xmlEnviado, hash, idEstadoSunat
      )
      VALUES (
        @idEmpresa, @idVenta, @tipoComprobante, @serie, @numero,
        @fechaEmision, '', '', 7
      )
    `);
};

exports.validarComprobanteEmpresaRepo = async (pool, idComprobanteElectronico, idEmpresa) => {
  const result = await pool
    .request()
    .input("idComprobanteElectronico", sql.UniqueIdentifier, idComprobanteElectronico)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) as existe
      FROM ComprobantesElectronicos
      WHERE idComprobanteElectronico = @idComprobanteElectronico AND idEmpresa = @idEmpresa
    `);

  return result.recordset[0].existe > 0;
};

/** Busca un comprobante electrónico por serie, número y tipo (ej: B001, 8, 03 para boleta). */
exports.obtenerComprobantePorSerieNumeroRepo = async (pool, serie, numero, tipoComprobante) => {
  const result = await pool
    .request()
    .input("serie", sql.VarChar, String(serie || "").trim())
    .input("numero", sql.VarChar, String(numero ?? "").trim())
    .input("tipoComprobante", sql.VarChar, String(tipoComprobante || "03").trim())
    .query(`
      SELECT TOP 1 ce.idComprobanteElectronico, ce.idEmpresa
      FROM ComprobantesElectronicos ce
      WHERE ce.serie = @serie AND ce.numero = @numero AND ce.tipoComprobante = @tipoComprobante
    `);
  return result.recordset && result.recordset[0] ? result.recordset[0] : null;
};

/** Obtiene datos del comprobante y RUC de la empresa para enviar al Facturador. */
exports.obtenerComprobanteParaEnvioRepo = async (pool, idComprobanteElectronico, idEmpresa) => {
  const result = await pool
    .request()
    .input("idComprobanteElectronico", sql.UniqueIdentifier, idComprobanteElectronico)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT ce.idComprobanteElectronico, ce.idVenta, ce.tipoComprobante, ce.serie, ce.numero,
             e.ruc AS rucEmpresa
      FROM ComprobantesElectronicos ce
      INNER JOIN Empresas e ON e.idEmpresa = ce.idEmpresa
      WHERE ce.idComprobanteElectronico = @idComprobanteElectronico AND ce.idEmpresa = @idEmpresa
    `);
  return result.recordset[0];
};

/** Obtiene el CDR (contenido XML) del comprobante para ver/descargar. */
exports.obtenerCdrComprobanteRepo = async (pool, idComprobanteElectronico, idEmpresa) => {
  const result = await pool
    .request()
    .input("idComprobanteElectronico", sql.UniqueIdentifier, idComprobanteElectronico)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT ce.cdr
      FROM ComprobantesElectronicos ce
      WHERE ce.idComprobanteElectronico = @idComprobanteElectronico AND ce.idEmpresa = @idEmpresa
    `);
  const row = result.recordset && result.recordset[0];
  return row && row.cdr != null && String(row.cdr).trim() !== "" ? { contenido: row.cdr } : null;
};

/** Obtiene el XML firmado del comprobante desde la BD (si fue guardado al enviar). */
exports.obtenerXmlComprobanteRepo = async (pool, idComprobanteElectronico, idEmpresa) => {
  const result = await pool
    .request()
    .input("idComprobanteElectronico", sql.UniqueIdentifier, idComprobanteElectronico)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT ce.xmlEnviado
      FROM ComprobantesElectronicos ce
      WHERE ce.idComprobanteElectronico = @idComprobanteElectronico AND ce.idEmpresa = @idEmpresa
    `);
  const row = result.recordset && result.recordset[0];
  return row && row.xmlEnviado != null && String(row.xmlEnviado).trim() !== "" ? { contenido: row.xmlEnviado } : null;
};

/** Lista comprobantes pendientes de envío (idEstadoSunat = 7) por empresa, para envío automático o por lotes. */
exports.listarPendientesEnvioRepo = async (pool, idEmpresa, limite = 500) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("limite", sql.Int, limite)
    .query(`
      SELECT TOP (@limite) ce.idComprobanteElectronico, ce.idVenta, ce.tipoComprobante, ce.serie, ce.numero,
             e.ruc AS rucEmpresa
      FROM ComprobantesElectronicos ce
      INNER JOIN Empresas e ON e.idEmpresa = ce.idEmpresa
      WHERE ce.idEmpresa = @idEmpresa AND ce.idEstadoSunat = 7
      ORDER BY ce.fechaEmision ASC
    `);
  return result.recordset;
};

/** Actualiza ComprobantesElectronicos y Ventas con el resultado del envío (mismo idEstadoSunat). Solo se guarda CDR en BD. */
exports.actualizarResultadoEnvioRepo = async (pool, idComprobanteElectronico, resultado) => {
  const nowStr = getNowLocalSQLString();
  const req1 = pool.request();
  await req1
    .input("idComprobanteElectronico", sql.UniqueIdentifier, idComprobanteElectronico)
    .input("fechaEnvio", sql.VarChar(23), nowStr)
    .input("fechaRespuesta", sql.VarChar(23), nowStr)
    .input("codigoRespuesta", sql.VarChar, resultado.codigoRespuesta || null)
    .input("descripcionRespuesta", sql.VarChar, resultado.descripcionRespuesta || null)
    .input("cdr", sql.NVarChar, resultado.cdr || null)
    .input("idEstadoSunat", sql.Int, resultado.idEstadoSunat)
    .input("intentosEnvio", sql.Int, 1)
    .input("ultimoIntento", sql.VarChar(23), nowStr)
    .query(`
      UPDATE ComprobantesElectronicos
      SET fechaEnvio = @fechaEnvio, fechaRespuesta = @fechaRespuesta,
          codigoRespuesta = @codigoRespuesta, descripcionRespuesta = @descripcionRespuesta,
          cdr = @cdr, idEstadoSunat = @idEstadoSunat,
          intentosEnvio = ISNULL(intentosEnvio, 0) + @intentosEnvio, ultimoIntento = @ultimoIntento
      WHERE idComprobanteElectronico = @idComprobanteElectronico
    `);
  const req2 = pool.request();
  await req2
    .input("idComprobanteElectronico", sql.UniqueIdentifier, idComprobanteElectronico)
    .input("idEstadoSunat", sql.Int, resultado.idEstadoSunat)
    .query(`
      UPDATE Ventas SET idEstadoSunat = @idEstadoSunat
      WHERE idVenta = (SELECT idVenta FROM ComprobantesElectronicos WHERE idComprobanteElectronico = @idComprobanteElectronico)
    `);
};

/**
 * Envía el comprobante a SUNAT. Dos flujos según otros/manual_programador.pdf (RS 097-2012/SUNAT):
 *
 * 1) ENVÍO DIRECTO (config.envioDirectoSunat + urlEnvio + usuarioSunat + claveSunat + certificado):
 *    No archivos planos. Se genera XML UBL, se firma, se envía a BillService sendBill (§2.5). Se guarda CDR en BD.
 *
 * 2) FACTURADOR SFS (envío directo no activo; rutaCarpetaFacturadorSunat obligatoria):
 *    Archivos planos en DATA → actualizar bandeja → generar/firmar XML (Facturador) → actualizar bandeja
 *    → enviar a SUNAT → recepcionar CDR y guardar en BD → actualizar bandeja.
 *    Opción usarXmlUbl: true → XML UBL firmado en Firma, solo envío (sin planos).
 */
exports.enviarComprobanteSunatRepo = async (pool, user, idComprobanteElectronico, facturadorSunatService, config, opciones = {}) => {
  const comp = await exports.obtenerComprobanteParaEnvioRepo(pool, idComprobanteElectronico, user.empresa);
  if (!comp) return null;
  // #region agent log
  const compData = { idComprobanteElectronico, ruc: comp.rucEmpresa, tipo: comp.tipoComprobante, serie: comp.serie, numero: comp.numero };
  console.error("[SUNAT] enviarComprobanteSunatRepo: comprobante", compData);
  debugSunatLog.write({ location: "facturacion.repository.enviarComprobanteSunatRepo:comprobante", message: "comprobante", data: compData });
  // #endregion

  const payload = await ventasRepository.obtenerComprobanteParaPdf(pool, comp.idVenta, user.empresa);
  if (!payload) {
    return {
      ok: false,
      mensaje: "No se encontraron datos de la venta para generar el comprobante"
    };
  }
  const nombreArchivo = nombreArchivoComprobante({
    ruc: comp.rucEmpresa,
    tipoComprobante: comp.tipoComprobante,
    serie: comp.serie,
    numero: comp.numero
  });
  const base = nombreArchivo.replace(/\.json$/i, "");
  const usarXmlUbl = opciones.usarXmlUbl === true;
  const rucStr = String(comp.rucEmpresa || "").trim().replace(/\D/g, "").padStart(11, "0");

  // Envío directo a SUNAT (SOAP BillService): requiere UBL firmado, urlEnvio, usuarioSunat, claveSunat
  if (config.envioDirectoSunat && config.urlEnvio && config.usuarioSunat && config.claveSunat) {
    // #region agent log
    console.error("[SUNAT] enviarComprobanteSunatRepo: rama ENVÍO DIRECTO SUNAT", { idComprobanteElectronico });
    debugSunatLog.write({ location: "facturacion.repository.enviarComprobanteSunatRepo:rama", message: "rama ENVÍO DIRECTO", data: { idComprobanteElectronico } });
    // #endregion
    const configFirma = await exports.obtenerConfiguracionParaFirmaRepo(pool, user.empresa);
    const certBase64 = configFirma?.certificadoDigital;
    const claveCert = configFirma?.claveCertificado ? cifradoClaveCertificado.descifrar(configFirma.claveCertificado) : null;
    if (!certBase64 || !claveCert) {
      return {
        ok: false,
        mensaje: "Para envío directo a SUNAT debe subir el certificado digital y su clave en Configuración > Facturación"
      };
    }
    const numeroComprobante = `${comp.serie}-${String(comp.numero).replace(/\D/g, "").padStart(8, "0")}`;
    let xml = generadorXmlUblSunat.generarXmlUblFacturaBoleta(payload, comp.tipoComprobante, numeroComprobante);
    try {
      xml = firmaXmlSunat.firmarXmlUbl(xml, Buffer.from(certBase64, "base64"), claveCert);
    } catch (err) {
      console.error("firmaXmlSunat:", err);
      return { ok: false, mensaje: err.message || "Error al firmar XML con el certificado" };
    }
    const usuarioSOAP = config.usuarioSunat.length >= 20 || /^\d+/.test(config.usuarioSunat)
      ? config.usuarioSunat
      : rucStr + String(config.usuarioSunat).trim();
    const claveSunatDec = config.claveSunat ? cifradoClaveCertificado.descifrar(config.claveSunat) : null;
    let resultado = await envioDirectoSunat.enviarComprobanteDirectoSunat(
      xml,
      base,
      usuarioSOAP,
      claveSunatDec || config.claveSunat,
      config.urlEnvio
    );
    await exports.actualizarResultadoEnvioRepo(pool, idComprobanteElectronico, {
      codigoRespuesta: resultado.codigoRespuesta,
      descripcionRespuesta: resultado.descripcionRespuesta || resultado.error,
      cdr: resultado.cdr,
      idEstadoSunat: resultado.idEstadoSunat ?? 6
    });
    // #region agent log
    const resDir = { ok: resultado.ok, idEstadoSunat: resultado.idEstadoSunat, codigoRespuesta: resultado.codigoRespuesta, error: resultado.error };
    console.error("[SUNAT] enviarComprobanteSunatRepo: resultado envío directo", resDir);
    debugSunatLog.write({ location: "facturacion.repository.enviarComprobanteSunatRepo:resultadoDirecto", message: "resultado", data: resDir });
    // #endregion
    return {
      ok: resultado.ok,
      mensaje: resultado.ok ? "Comprobante enviado a SUNAT (directo)" : (resultado.error || "Error en envío directo"),
      idEstadoSunat: resultado.idEstadoSunat,
      codigoRespuesta: resultado.codigoRespuesta,
      descripcionRespuesta: resultado.descripcionRespuesta || resultado.error
    };
  }

  // Facturador SFS (respaldo): archivos planos o UBL en Firma
  if (!config.rutaCarpetaFacturadorSunat) {
    return {
      ok: false,
      mensaje: "Configure la carpeta del Facturador SUNAT o active Envío directo con URL, usuario y clave SOL"
    };
  }
  // #region agent log
  const ramaData = { idComprobanteElectronico, usarXmlUbl, urlFacturador: config.urlFacturadorSunat || "(default)" };
  console.error("[SUNAT] enviarComprobanteSunatRepo: rama FACTURADOR SFS", ramaData);
  debugSunatLog.write({ location: "facturacion.repository.enviarComprobanteSunatRepo:rama", message: "rama FACTURADOR SFS", data: ramaData });
  // #endregion

  if (usarXmlUbl) {
    const numeroComprobante = `${comp.serie}-${String(comp.numero).replace(/\D/g, "").padStart(8, "0")}`;
    let xml = generadorXmlUblSunat.generarXmlUblFacturaBoleta(
      payload,
      comp.tipoComprobante,
      numeroComprobante
    );
    const configFirma = await exports.obtenerConfiguracionParaFirmaRepo(pool, user.empresa);
    const certBase64 = configFirma?.certificadoDigital;
    const claveCert = configFirma?.claveCertificado ? cifradoClaveCertificado.descifrar(configFirma.claveCertificado) : null;
    if (certBase64 && claveCert) {
      try {
        const certificadoBuffer = Buffer.from(certBase64, "base64");
        xml = firmaXmlSunat.firmarXmlUbl(xml, certificadoBuffer, claveCert);
      } catch (err) {
        console.error("firmaXmlSunat:", err);
        return {
          ok: false,
          mensaje: err.message || "Error al firmar XML con el certificado"
        };
      }
    }
    const writeXml = escribirXmlFirma(config.rutaCarpetaFacturadorSunat, base, xml);
    if (!writeXml.ok) {
      return {
        ok: false,
        mensaje: writeXml.error || "Error al escribir XML UBL en carpeta Firma del Facturador"
      };
    }
  } else {
    const contenidos = archivoPlanoFacturador.generarArchivosPlanos(payload, comp.tipoComprobante);
    const writeResult = escribirArchivosPlanos(config.rutaCarpetaFacturadorSunat, base, contenidos);
    if (!writeResult.ok) {
      return {
        ok: false,
        mensaje: writeResult.error || "Error al escribir archivos planos (.CAB, .DET, .TRI, .LEY) en DATA del Facturador"
      };
    }
  }

  const resultado = await facturadorSunatService.enviarComprobanteAlFacturador({
    baseUrl: config.urlFacturadorSunat || facturadorSunatService.URL_FACTURADOR_DEFAULT,
    rutaCarpetaFacturadorSunat: config.rutaCarpetaFacturadorSunat,
    ruc: comp.rucEmpresa,
    tipoComprobante: comp.tipoComprobante,
    serie: comp.serie,
    numero: comp.numero,
    xmlYaEnFirma: usarXmlUbl
  });

  await exports.actualizarResultadoEnvioRepo(pool, idComprobanteElectronico, {
    codigoRespuesta: resultado.codigoRespuesta,
    descripcionRespuesta: resultado.descripcionRespuesta || resultado.error,
    cdr: resultado.cdr,
    idEstadoSunat: resultado.idEstadoSunat ?? 6
  });

  // #region agent log
  const resFac = { ok: resultado.ok, idEstadoSunat: resultado.idEstadoSunat, codigoRespuesta: resultado.codigoRespuesta, error: resultado.error };
  console.error("[SUNAT] enviarComprobanteSunatRepo: resultado Facturador", resFac);
  debugSunatLog.write({ location: "facturacion.repository.enviarComprobanteSunatRepo:resultadoFacturador", message: "resultado", data: resFac });
  // #endregion
  return {
    ok: resultado.ok,
    mensaje: resultado.ok ? "Comprobante enviado a SUNAT" : (resultado.error || "Error en envío"),
    idEstadoSunat: resultado.idEstadoSunat,
    codigoRespuesta: resultado.codigoRespuesta,
    descripcionRespuesta: resultado.descripcionRespuesta || resultado.error
  };
};

exports.consultarEstadoSunatRepo = async (pool, user, idComprobanteElectronico) => {
  // Simular consulta a SUNAT
  await new Promise(resolve => setTimeout(resolve, 1000));

  const result = await pool
    .request()
    .input("idComprobanteElectronico", sql.UniqueIdentifier, idComprobanteElectronico)
    .query(`
      SELECT
        ce.serie + '-' + ce.numero AS numeroComprobante,
        ce.fechaEmision,
        es.descripcion AS estadoSunat,
        ce.fechaEnvio,
        ce.fechaRespuesta,
        ce.codigoRespuesta,
        ce.descripcionRespuesta,
        ce.cdr
      FROM ComprobantesElectronicos ce
      INNER JOIN EstadosSunat es ON ce.idEstadoSunat = es.idEstadoSunat
      WHERE ce.idComprobanteElectronico = @idComprobanteElectronico
    `);

  return result.recordset[0];
};

exports.obtenerComprobantesElectronicosRepo = async (pool, idEmpresa, filtros) => {
  let whereClause = "WHERE ce.idEmpresa = @idEmpresa";

  if (filtros.tipoComprobante) {
    whereClause += " AND ce.tipoComprobante = @tipoComprobante";
  }

  if (filtros.estadoSunat) {
    whereClause += " AND ce.idEstadoSunat = @estadoSunat";
  }

  if (filtros.fechaDesde) {
    whereClause += " AND ce.fechaEmision >= @fechaDesde";
  }

  if (filtros.fechaHasta) {
    whereClause += " AND ce.fechaEmision <= @fechaHasta";
  }

  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("tipoComprobante", sql.VarChar, filtros.tipoComprobante || null)
    .input("estadoSunat", sql.Int, filtros.estadoSunat || null)
    .input("fechaDesde", sql.DateTime, filtros.fechaDesde || null)
    .input("fechaHasta", sql.DateTime, filtros.fechaHasta || null)
    .query(`
      SELECT
        ce.idComprobanteElectronico,
        ce.tipoComprobante,
        ce.serie + '-' + ce.numero AS numeroComprobante,
        ce.fechaEmision,
        ce.fechaEnvio,
        ce.fechaRespuesta,
        es.descripcion AS estadoSunat,
        es.requiereAccion,
        ce.hash,
        ce.archivoPdf,
        v.serie + '-' + v.numero AS ventaRelacionada
      FROM ComprobantesElectronicos ce
      INNER JOIN EstadosSunat es ON ce.idEstadoSunat = es.idEstadoSunat
      LEFT JOIN Ventas v ON ce.idVenta = v.idVenta
      ${whereClause}
      ORDER BY ce.fechaEmision DESC
    `);

  return result.recordset;
};

exports.obtenerEstadisticasFacturacionRepo = async (pool, idEmpresa, periodo) => {
  const periodoFiltro = periodo || FORMAT(GETDATE(), 'yyyyMM');

  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("periodo", sql.VarChar, periodoFiltro)
    .query(`
      SELECT
        COUNT(*) AS totalComprobantes,
        COUNT(CASE WHEN idEstadoSunat = 1 THEN 1 END) AS comprobantesAceptados,
        COUNT(CASE WHEN idEstadoSunat = 4 THEN 1 END) AS comprobantesRechazados,
        COUNT(CASE WHEN idEstadoSunat = 2 THEN 1 END) AS comprobantesEnviados,
        COUNT(CASE WHEN tipoComprobante = '01' THEN 1 END) AS facturas,
        COUNT(CASE WHEN tipoComprobante = '03' THEN 1 END) AS boletas,
        SUM(intentosEnvio) AS totalIntentosEnvio,
        AVG(DATEDIFF(MINUTE, fechaEnvio, fechaRespuesta)) AS tiempoRespuestaPromedio
      FROM ComprobantesElectronicos
      WHERE idEmpresa = @idEmpresa
        AND FORMAT(fechaEmision, 'yyyyMM') = @periodo
    `);

  return result.recordset[0];
};

exports.obtenerEstadosSunatRepo = async (pool) => {
  const result = await pool
    .request()
    .query(`
      SELECT
        idEstadoSunat,
        codigo,
        descripcion,
        requiereAccion
      FROM EstadosSunat
      ORDER BY idEstadoSunat
    `);

  return result.recordset;
};

// Funciones auxiliares para simular generación de XML y hash
async function generarXMLFactura(venta, serie, numero) {
  // Simular XML de factura UBL 2.1
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>${serie}-${numero}</cbc:ID>
  <cbc:IssueDate>${venta.fEmision.toISOString().split('T')[0]}</cbc:IssueDate>
  <!-- XML simplificado para demostración -->
</Invoice>`;

  return xml;
}

function generarHashSimulado(xml) {
  // Simular hash SHA-256
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(xml).digest('hex').substring(0, 40);
}