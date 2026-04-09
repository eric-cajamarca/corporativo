const sql = require("mssql");
const fs = require("fs");
const path = require("path");
const ventasRepository = require("../repositories/ventas.repository");
const { getNowLocal, getNowLocalSQLString } = require("../utils/fechaHoraLocal.util");
const debugSunatLog = require("../utils/debugSunatLog.util");
const { formatearHoraEnvioParaInput } = require("../utils/limaSunat.util");
const { escribirArchivosPlanos, escribirXmlFirma, nombreArchivoComprobante } = require("../utils/facturadorSunat.util");
const cifradoClaveCertificado = require("../utils/cifradoClaveCertificado.util");
const archivoPlanoFacturador = require("../services/archivoPlanoFacturador.service");
const generadorXmlUblSunat = require("../services/generadorXmlUblSunat.service");
const firmaXmlSunat = require("../services/firmaXmlSunat.service");
const envioDirectoSunat = require("../services/envioDirectoSunat.service");
const consultaSunat = require("../services/consultaSunat.service");
const {
  tipoSunatDesdeCodigoComprobante,
  codigoInternoNotaCreditoPorOrigen,
  codigoInternoNotaDebitoPorOrigen
} = require("../utils/sunatCodigoComprobante.util");
const { extraerCodigoHashDesdeXmlFirmado } = require("../utils/sunatCodigoHash.util");

/** Carpeta donde se guardan los XML firmados listos para enviar (para revisión/descarga). */
const CARPETA_XML_FIRMADOS = path.join(process.cwd(), "xml_firmados_sunat");

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
        ISNULL(c.modoEnvioSunat, 2) AS modoEnvioSunat,
        c.horaEnvioSunat,
        c.fechaUltimaOlaEnvioProgramado,
        ISNULL(c.useResumenDiarioBoletas, 0) AS useResumenDiarioBoletas,
        ISNULL(c.usaGuiasElectronicas, 0) AS usaGuiasElectronicas,
        c.urlBaseApiGuias,
        c.idApiGuias,
        c.claveApiGuias,
        ISNULL(c.rucApiGuias, e.ruc) AS rucApiGuias,
        e.ruc AS rucEmpresa
      FROM ConfiguracionFacturacionElectronica c
      LEFT JOIN Empresas e ON e.idEmpresa = c.idEmpresa
      WHERE c.idEmpresa = @idEmpresa
    `);

  const row = result.recordset[0];
  if (row) {
    const cert = row.certificadoDigital;
    row.tieneCertificado = cert != null && String(cert).trim() !== "";
    // Normalizar BIT: el driver puede devolver 0/1 (number) en lugar de boolean
    row.envioDirectoSunat = row.envioDirectoSunat === true || row.envioDirectoSunat === 1 || String(row.envioDirectoSunat || "").trim() === "1";
    row.useResumenDiarioBoletas = Boolean(row.useResumenDiarioBoletas);
    row.usaGuiasElectronicas = Boolean(row.usaGuiasElectronicas);
    row.modoEnvioSunat = Number(row.modoEnvioSunat) || 2;
    if (row.horaEnvioSunat != null) {
      row.horaEnvioSunat = formatearHoraEnvioParaInput(row.horaEnvioSunat);
    }
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
  const claveApiGuiasGuardar = (val, existenteClave) => {
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
    const claveApiGuiasVal = datos.hasOwnProperty("claveApiGuias")
      ? claveApiGuiasGuardar(datos.claveApiGuias, existente.claveApiGuias)
      : existente.claveApiGuias;
    if (claveSunatVal && claveSunatVal.length > 20) {
      try {
        await pool.request().query(`
          ALTER TABLE ConfiguracionFacturacionElectronica
          ALTER COLUMN claveSunat VARCHAR(256) NULL
        `);
      } catch (_) {}
    }
    if (claveApiGuiasVal && claveApiGuiasVal.length > 20) {
      try {
        await pool.request().query(`
          ALTER TABLE ConfiguracionFacturacionElectronica
          ALTER COLUMN claveApiGuias VARCHAR(256) NULL
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
      .input("modoEnvioSunat", sql.TinyInt, datos.modoEnvioSunat !== undefined && datos.modoEnvioSunat !== null ? Number(datos.modoEnvioSunat) : 2)
      .input("horaEnvioSunat", sql.VarChar(8), datos.horaEnvioSunat && String(datos.horaEnvioSunat).trim() ? String(datos.horaEnvioSunat).trim().slice(0, 8) : null)
      .input("useResumenDiarioBoletas", sql.Bit, datos.useResumenDiarioBoletas !== undefined ? datos.useResumenDiarioBoletas : 0)
      .input("usaGuiasElectronicas", sql.Bit, datos.usaGuiasElectronicas !== undefined ? datos.usaGuiasElectronicas : 0)
      .input("urlBaseApiGuias", sql.VarChar, datos.urlBaseApiGuias || null)
      .input("idApiGuias", sql.VarChar, datos.idApiGuias || null)
      .input("claveApiGuias", sql.VarChar(256), claveApiGuiasVal)
      .input("rucApiGuias", sql.VarChar(11), datos.rucApiGuias?.trim() || null)
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
            programacionEnvioLotes = @programacionEnvioLotes,
            modoEnvioSunat = @modoEnvioSunat,
            horaEnvioSunat = CASE WHEN @horaEnvioSunat IS NULL OR LTRIM(RTRIM(@horaEnvioSunat)) = '' THEN NULL ELSE CAST(@horaEnvioSunat AS TIME) END,
            useResumenDiarioBoletas = @useResumenDiarioBoletas,
            usaGuiasElectronicas = @usaGuiasElectronicas,
            urlBaseApiGuias = @urlBaseApiGuias,
            idApiGuias = @idApiGuias,
            claveApiGuias = @claveApiGuias,
            rucApiGuias = @rucApiGuias
        WHERE idEmpresa = @idEmpresa
      `);
  } else {
    const claveValNueva = claveCertificadoGuardar(datos.claveCertificado, undefined);
    const claveSunatNueva = claveSunatGuardar(datos.claveSunat, undefined);
    const claveApiGuiasNueva = claveApiGuiasGuardar(datos.claveApiGuias, undefined);
    if ((claveValNueva && claveValNueva.length > 100) || (claveSunatNueva && claveSunatNueva.length > 20) || (claveApiGuiasNueva && claveApiGuiasNueva.length > 20)) {
      try {
        await pool.request().query(`
          ALTER TABLE ConfiguracionFacturacionElectronica
          ALTER COLUMN claveCertificado VARCHAR(256) NULL
        `);
        await pool.request().query(`
          ALTER TABLE ConfiguracionFacturacionElectronica
          ALTER COLUMN claveSunat VARCHAR(256) NULL
        `);
        await pool.request().query(`
          ALTER TABLE ConfiguracionFacturacionElectronica
          ALTER COLUMN claveApiGuias VARCHAR(256) NULL
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
      .input("modoEnvioSunat", sql.TinyInt, datos.modoEnvioSunat !== undefined && datos.modoEnvioSunat !== null ? Number(datos.modoEnvioSunat) : 2)
      .input("horaEnvioSunat", sql.VarChar(8), datos.horaEnvioSunat && String(datos.horaEnvioSunat).trim() ? String(datos.horaEnvioSunat).trim().slice(0, 8) : null)
      .input("useResumenDiarioBoletas", sql.Bit, datos.useResumenDiarioBoletas !== undefined ? datos.useResumenDiarioBoletas : 0)
      .input("usaGuiasElectronicas", sql.Bit, datos.usaGuiasElectronicas !== undefined ? datos.usaGuiasElectronicas : 0)
      .input("urlBaseApiGuias", sql.VarChar, datos.urlBaseApiGuias || null)
      .input("idApiGuias", sql.VarChar, datos.idApiGuias || null)
      .input("claveApiGuias", sql.VarChar(256), claveApiGuiasNueva)
      .input("rucApiGuias", sql.VarChar(11), datos.rucApiGuias?.trim() || null)
      .query(`
        INSERT INTO ConfiguracionFacturacionElectronica (
          idEmpresa, certificadoDigital, claveCertificado, usuarioSunat,
          claveSunat, modoPrueba, serieFactura, serieBoleta,
          serieNotaCredito, serieNotaDebito, rutaCarpetaFacturadorSunat, urlFacturadorSunat,
          urlEnvio, envioDirectoSunat, envioAutomatico, minutosEnvioAutomatico, envioPorLotes, programacionEnvioLotes,
          modoEnvioSunat, horaEnvioSunat, useResumenDiarioBoletas, usaGuiasElectronicas,
          urlBaseApiGuias, idApiGuias, claveApiGuias, rucApiGuias
        ) VALUES (
          @idEmpresa, @certificadoDigital, @claveCertificado, @usuarioSunat,
          @claveSunat, @modoPrueba, @serieFactura, @serieBoleta,
          @serieNotaCredito, @serieNotaDebito, @rutaCarpetaFacturadorSunat, @urlFacturadorSunat,
          @urlEnvio, @envioDirectoSunat, @envioAutomatico, @minutosEnvioAutomatico, @envioPorLotes, @programacionEnvioLotes,
          @modoEnvioSunat, CASE WHEN @horaEnvioSunat IS NULL OR LTRIM(RTRIM(@horaEnvioSunat)) = '' THEN NULL ELSE CAST(@horaEnvioSunat AS TIME) END, @useResumenDiarioBoletas, @usaGuiasElectronicas,
          @urlBaseApiGuias, @idApiGuias, @claveApiGuias, @rucApiGuias
        )
      `);
  }

  return { mensaje: "Configuración actualizada exitosamente" };
};

/** Empresas con job programado: modos 2 o 3, envío automático ON y Facturador o envío directo válido. */
exports.listarEmpresasConEnvioAutomaticoRepo = async (pool) => {
  try {
    const result = await pool.request().query(`
      SELECT idEmpresa, minutosEnvioAutomatico, rutaCarpetaFacturadorSunat, urlFacturadorSunat,
             urlEnvio, usuarioSunat, claveSunat, ISNULL(envioDirectoSunat, 0) AS envioDirectoSunat,
             ISNULL(modoEnvioSunat, 2) AS modoEnvioSunat, horaEnvioSunat, fechaUltimaOlaEnvioProgramado,
             ISNULL(useResumenDiarioBoletas, 0) AS useResumenDiarioBoletas
      FROM ConfiguracionFacturacionElectronica
      WHERE envioAutomatico = 1
        AND ISNULL(modoEnvioSunat, 2) IN (2, 3)
        AND (
          (rutaCarpetaFacturadorSunat IS NOT NULL AND LTRIM(RTRIM(rutaCarpetaFacturadorSunat)) <> '')
          OR (ISNULL(envioDirectoSunat, 0) = 1 AND urlEnvio IS NOT NULL AND LTRIM(RTRIM(urlEnvio)) <> '' AND usuarioSunat IS NOT NULL AND claveSunat IS NOT NULL)
        )
    `);
    return result.recordset || [];
  } catch (_) {
    const result = await pool.request().query(`
      SELECT idEmpresa, minutosEnvioAutomatico, rutaCarpetaFacturadorSunat, urlFacturadorSunat,
             NULL AS modoEnvioSunat, NULL AS horaEnvioSunat, NULL AS fechaUltimaOlaEnvioProgramado, 0 AS useResumenDiarioBoletas
      FROM ConfiguracionFacturacionElectronica
      WHERE envioAutomatico = 1 AND rutaCarpetaFacturadorSunat IS NOT NULL AND LTRIM(RTRIM(rutaCarpetaFacturadorSunat)) <> ''
    `);
    return result.recordset || [];
  }
};

exports.actualizarFechaUltimaOlaEnvioProgramadoRepo = async (pool, idEmpresa, fechaYmdLima) => {
  const d = String(fechaYmdLima || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
  await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fecha", sql.Date, d)
    .query(`
      UPDATE ConfiguracionFacturacionElectronica
      SET fechaUltimaOlaEnvioProgramado = @fecha
      WHERE idEmpresa = @idEmpresa
    `);
};

/** Tras confirmar cobro: marca pago y ventana de envío (modo 2). Modo 3 solo marca pago. */
exports.marcarPagoComprobantesElectronicosPorVentaRepo = async (pool, idVenta, idEmpresa, opts = {}) => {
  const modo = Number(opts.modoEnvioSunat) || 2;
  const minutos = Math.max(1, Number(opts.minutosEspera) || 10);
  if (modo === 2) {
    await pool
      .request()
      .input("idVenta", sql.Int, idVenta)
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .input("minutos", sql.Int, minutos)
      .query(`
        UPDATE ComprobantesElectronicos
        SET fechaConfirmacionPago = SYSUTCDATETIME(),
            fechaElegibleEnvio = DATEADD(MINUTE, @minutos, SYSUTCDATETIME())
        WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa AND idEstadoSunat = 7
      `);
    return;
  }
  if (modo === 3) {
    await pool
      .request()
      .input("idVenta", sql.Int, idVenta)
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .query(`
        UPDATE ComprobantesElectronicos
        SET fechaConfirmacionPago = SYSUTCDATETIME(),
            fechaElegibleEnvio = NULL
        WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa AND idEstadoSunat = 7
      `);
    return;
  }
};

exports.listarIdsComprobantePendientePorVentaRepo = async (pool, idVenta, idEmpresa) => {
  const r = await pool
    .request()
    .input("idVenta", sql.Int, idVenta)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT idComprobanteElectronico FROM ComprobantesElectronicos
      WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa AND idEstadoSunat = 7
    `);
  return (r.recordset || []).map((row) => row.idComprobanteElectronico);
};

exports.registrarFalloIntentoEnvioRepo = async (pool, idComprobanteElectronico, idEmpresa) => {
  await pool
    .request()
    .input("id", sql.UniqueIdentifier, idComprobanteElectronico)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      UPDATE ComprobantesElectronicos
      SET intentosEnvio = ISNULL(intentosEnvio, 0) + 1,
          fechaUltimoIntentoEnvio = SYSUTCDATETIME(),
          fechaProximoReintento = DATEADD(MINUTE, 15, SYSUTCDATETIME())
      WHERE idComprobanteElectronico = @id AND idEmpresa = @idEmpresa AND idEstadoSunat = 7
    `);
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

/** Tipos que generan fila en ComprobantesElectronicos (F7/B7 se guardan como tipo SUNAT 07). */
const TIPOS_COMPROBANTE_ELECTRONICO = ["01", "03", "07", "08", "F7", "B7", "F8", "B8"];

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
  const tipoSunatCe = tipoSunatDesdeCodigoComprobante(codigoStr);
  const numeroStr = numero != null ? String(numero).padStart(8, "0") : "";
  const requestInsert = transaction.request();
  await requestInsert
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idVenta", sql.Int, idVenta)
    .input("tipoComprobante", sql.VarChar(2), tipoSunatCe)
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

/** Lista comprobantes Factura/Boleta aceptados por RUC o razón social del cliente. Para que el usuario elija uno. */
exports.listarComprobantesOrigenPorClienteRepo = async (pool, idEmpresa, filtro) => {
  const ruc = filtro.rucCliente != null ? String(filtro.rucCliente).trim().replace(/\D/g, "") : "";
  const razon = filtro.razonSocial != null ? String(filtro.razonSocial).trim() : "";
  if (!ruc && !razon) return [];
  const tipoComprobante = filtro.tipoComprobante != null ? String(filtro.tipoComprobante).trim() : "";
  const request = pool.request();
  request.input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
  request.input("ruc", sql.VarChar(50), ruc ? "%" + ruc + "%" : "");
  request.input("razon", sql.NVarChar(200), razon ? "%" + razon + "%" : "");
  request.input("tipoComprobante", sql.VarChar(2), tipoComprobante || null);
  let whereTipo = "";
  if (tipoComprobante === "01" || tipoComprobante === "03") {
    whereTipo = " AND ce.tipoComprobante = @tipoComprobante";
  }
  const result = await request.query(`
    SELECT TOP 50
      ce.idComprobanteElectronico,
      ce.serie,
      ce.numero,
      ce.tipoComprobante,
      CONVERT(VARCHAR(19), ce.fechaEmision, 120) AS fechaEmision,
      ISNULL(cl.ruc, '') AS clienteRuc,
      ISNULL(cl.rSocial, '') AS clienteRazonSocial
    FROM ComprobantesElectronicos ce
    INNER JOIN Ventas v ON v.idVenta = ce.idVenta AND v.idEmpresa = ce.idEmpresa
    LEFT JOIN Clientes cl ON cl.idCliente = v.idCliente AND cl.idEmpresa = v.idEmpresa
    WHERE ce.idEmpresa = @idEmpresa
      AND ce.tipoComprobante IN ('01','03')
      AND ce.idEstadoSunat IN (1, 2, 3)
      AND (
        (LEN(@ruc) > 0 AND (cl.ruc LIKE @ruc OR REPLACE(ISNULL(cl.ruc,''), '-', '') LIKE REPLACE(@ruc, '-', '')))
        OR (LEN(@razon) > 0 AND ISNULL(cl.rSocial, '') LIKE @razon)
      )
      ${whereTipo}
    ORDER BY ce.fechaEmision DESC, ce.serie, ce.numero
  `);
  return result.recordset || [];
};

/** Busca comprobante Factura/Boleta aceptado por serie, número y tipo (01 o 03). Devuelve idComprobanteElectronico o null. */
exports.obtenerComprobanteOrigenPorSerieNumeroRepo = async (pool, idEmpresa, serie, numero, tipoComprobante) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("serie", sql.VarChar, String(serie || "").trim())
    .input("numero", sql.VarChar, String(numero ?? "").trim().replace(/\D/g, "").padStart(8, "0"))
    .input("tipoComprobante", sql.VarChar, String(tipoComprobante || "01").trim())
    .query(`
      SELECT TOP 1 ce.idComprobanteElectronico
      FROM ComprobantesElectronicos ce
      WHERE ce.idEmpresa = @idEmpresa AND ce.serie = @serie AND ce.numero = @numero AND ce.tipoComprobante = @tipoComprobante
        AND ce.tipoComprobante IN ('01','03') AND ce.idEstadoSunat IN (1, 2, 3)
    `);
  return result.recordset && result.recordset[0] ? result.recordset[0].idComprobanteElectronico : null;
};

/**
 * Busca comprobante por serie y número para usar como origen de guía.
 * Busca primero en ComprobantesElectronicos (cualquier estado); si no existe, en Ventas.
 * Devuelve un solo objeto con datos del comprobante, cliente e items para el front (guías).
 */
exports.obtenerComprobanteOrigenParaGuiaRepo = async (pool, idEmpresa, serie, numero) => {
  const serieStr = String(serie || "").trim();
  const numeroNorm = String(numero ?? "").replace(/\D/g, "").padStart(8, "0");
  if (!serieStr || !numeroNorm) return null;

  let idVenta = null;
  let tipoComprobante = null;

  const ceResult = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("serie", sql.VarChar, serieStr)
    .input("numero", sql.VarChar, numeroNorm)
    .query(`
      SELECT TOP 1 ce.idVenta, ce.tipoComprobante, ce.serie, ce.numero, ce.idComprobanteElectronico, ce.idEstadoSunat
      FROM ComprobantesElectronicos ce
      WHERE ce.idEmpresa = @idEmpresa AND ce.serie = @serie AND ce.numero = @numero
        AND ce.tipoComprobante IN ('01','03')
    `);
  const ce = ceResult.recordset && ceResult.recordset[0];
  if (ce) {
    idVenta = ce.idVenta;
    tipoComprobante = ce.tipoComprobante;
  } else {
    const numeroSinCeros = numeroNorm.replace(/^0+/, "") || "0";
    const vResult = await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .input("serie", sql.VarChar, serieStr)
      .input("numeroNorm", sql.VarChar, numeroNorm)
      .input("numeroSinCeros", sql.VarChar, numeroSinCeros)
      .query(`
        SELECT TOP 1 v.idVenta, c.codigo AS tipoComprobante
        FROM Ventas v
        LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
        WHERE v.idEmpresa = @idEmpresa AND v.serie = @serie
          AND (RTRIM(LTRIM(CAST(v.numero AS VARCHAR(20)))) = @numeroNorm OR RTRIM(LTRIM(CAST(v.numero AS VARCHAR(20)))) = @numeroSinCeros)
      `);
    const vRow = vResult.recordset && vResult.recordset[0];
    if (!vRow) return null;
    idVenta = vRow.idVenta;
    tipoComprobante = (vRow.tipoComprobante || "01").toString().trim();
  }

  const payload = await ventasRepository.obtenerComprobanteParaPdf(pool, idVenta, [idEmpresa]);
  if (!payload || !payload.venta || !payload.cliente) return null;

  const venta = payload.venta;
  const cliente = payload.cliente;
  const empresa = payload.empresa || {};
  const items = payload.items || [];
  const itemsWithMeta = items.map((it, idx) => ({
    ...it,
    numeroLinea: idx + 1,
    unidad: it.unidad || "NIU"
  }));
  let ubigeoCliente = "";
  const idCliente = payload.venta?.idCliente != null ? Number(payload.venta.idCliente) : null;
  if (idCliente != null && Number.isFinite(idCliente) && idCliente > 0) {
    try {
      const dirClienteResult = await pool
        .request()
        .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
        .input("idCliente", sql.Int, idCliente)
        .query(`
          SELECT TOP 1
            ISNULL(dc.ubigeo, '') AS ubigeo
          FROM DireccionClientes dc
          WHERE dc.idEmpresa = @idEmpresa
            AND dc.idCliente = @idCliente
          ORDER BY CASE WHEN dc.principal = 1 THEN 0 ELSE 1 END, dc.idDireccionClientes ASC
        `);
      const dirRow = dirClienteResult.recordset && dirClienteResult.recordset[0];
      ubigeoCliente = dirRow?.ubigeo != null ? String(dirRow.ubigeo).trim() : "";
    } catch (error) {
      console.error("facturacion.repository obtenerComprobanteOrigenParaGuiaRepo ubigeoCliente:", error);
    }
  }

  return {
    idComprobanteElectronico: ce ? ce.idComprobanteElectronico : null,
    idVenta,
    idCliente: payload.venta?.idCliente != null ? Number(payload.venta.idCliente) : null,
    tipoComprobante: tipoComprobante || "01",
    serie: venta.serie || serieStr,
    numero: venta.numero || numeroNorm,
    compVenta: venta.compVenta || `${serieStr}-${numeroNorm}`,
    idEstadoSunat: venta.idEstadoSunat != null ? venta.idEstadoSunat : null,
    cliente: cliente.rSocial || cliente.razonSocial || "",
    razon_social: cliente.rSocial || cliente.razonSocial || "",
    documento_cliente: cliente.ruc || "",
    rucCliente: cliente.ruc || "",
    total: venta.total,
    clienteDireccion: cliente.direccion || "",
    ubigeoCliente,
    rucEmpresa: (empresa && empresa.ruc) ? empresa.ruc : "",
    rucEmisor: (empresa && empresa.ruc) ? empresa.ruc : "",
    items: itemsWithMeta
  };
};

/** Obtiene comprobante origen (Factura/Boleta aceptado) para emitir NC/ND. Solo tipos 01 o 03 y idEstadoSunat en (1,2,3). */
exports.obtenerComprobanteOrigenParaNotaRepo = async (pool, idComprobanteElectronico, idEmpresa) => {
  const ceResult = await pool
    .request()
    .input("idComprobanteElectronico", sql.UniqueIdentifier, idComprobanteElectronico)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT ce.idComprobanteElectronico, ce.idVenta, ce.tipoComprobante, ce.serie, ce.numero, ce.idEstadoSunat
      FROM ComprobantesElectronicos ce
      WHERE ce.idComprobanteElectronico = @idComprobanteElectronico AND ce.idEmpresa = @idEmpresa
        AND ce.tipoComprobante IN ('01','03')
        AND ce.idEstadoSunat IN (1, 2, 3)
    `);
  const ce = ceResult.recordset && ceResult.recordset[0];
  if (!ce) return null;
  const payload = await ventasRepository.obtenerComprobanteParaPdf(pool, ce.idVenta, [idEmpresa]);
  if (!payload) return null;
  return {
    comprobanteOrigen: {
      idComprobanteElectronico: ce.idComprobanteElectronico,
      idVenta: ce.idVenta,
      tipoComprobante: ce.tipoComprobante,
      serie: ce.serie,
      numero: ce.numero,
      compVenta: payload.cabecera && payload.cabecera.compVenta ? payload.cabecera.compVenta : `${ce.serie}-${String(ce.numero).padStart(8, "0")}`
    },
    venta: payload.cabecera,
    empresa: payload.empresa,
    cliente: payload.cliente,
    items: payload.items,
    impuestos: payload.impuestos
  };
};

/** Obtiene idComprobante por codigo (F7/B7 NC, F8/B8 ND internos) de la empresa. */
exports.obtenerIdComprobantePorCodigoRepo = async (pool, idEmpresa, codigo) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("codigo", sql.VarChar(2), String(codigo || "").trim())
    .query(`
      SELECT idComprobante, serie, numero FROM Comprobantes
      WHERE idEmpresa = @idEmpresa AND codigo = @codigo
    `);
  return result.recordset && result.recordset[0] ? result.recordset[0] : null;
};

/**
 * Crea Nota de Crédito (07) o Débito (08): Venta + DetalleVenta + ComprobantesElectronicos.
 * Origen debe ser Factura/Boleta aceptada. Ejecuta en transacción.
 * @returns {{ idVenta: number, idComprobanteElectronico: string } | null }
 */
exports.crearNotaCreditoDebitoRepo = async (pool, idEmpresa, idUsuario, datos) => {
  const { idComprobanteElectronicoOrigen, tipoNota, codigoMotivoNotaCredito, items } = datos;
  if (!idComprobanteElectronicoOrigen || !["07", "08"].includes(String(tipoNota).trim()) || !Array.isArray(items) || items.length === 0) {
    return null;
  }
  const transaction = pool.transaction();
  try {
    await transaction.begin();

    const reqCe = transaction.request();
    const ceResult = await reqCe
      .input("idComprobanteElectronico", sql.UniqueIdentifier, idComprobanteElectronicoOrigen)
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT ce.idComprobanteElectronico, ce.idVenta, ce.tipoComprobante, ce.serie, ce.numero
        FROM ComprobantesElectronicos ce
        WHERE ce.idComprobanteElectronico = @idComprobanteElectronico AND ce.idEmpresa = @idEmpresa
          AND ce.tipoComprobante IN ('01','03') AND ce.idEstadoSunat IN (1, 2, 3)
      `);
    const ceOrigen = ceResult.recordset && ceResult.recordset[0];
    if (!ceOrigen) {
      await transaction.rollback();
      return null;
    }

    const reqVenta = transaction.request();
    const ventaResult = await reqVenta
      .input("idVenta", sql.Int, ceOrigen.idVenta)
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT idSucursal, idCliente, idMoneda, ISNULL(tCambio, 1) AS tCambio, idMediosPago
        FROM Ventas WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
      `);
    const ventaOrigen = ventaResult.recordset && ventaResult.recordset[0];
    if (!ventaOrigen) {
      await transaction.rollback();
      return null;
    }

    const tn = String(tipoNota).trim();
    const codigoInterno =
      tn === "08"
        ? codigoInternoNotaDebitoPorOrigen(ceOrigen.tipoComprobante)
        : codigoInternoNotaCreditoPorOrigen(ceOrigen.tipoComprobante);
    const compNota = await exports.obtenerIdComprobantePorCodigoRepo(pool, idEmpresa, codigoInterno);
    if (!compNota) {
      await transaction.rollback();
      throw new Error(
        `No hay comprobante configurado para nota (${codigoInterno}). Ejecute la migración F7/B7/F8/B8 o cree el comprobante en catálogo.`
      );
    }
    const { numero: numeroStr, serie: serieStr } = await ventasRepository.obtenerSiguienteNumeroComprobante(transaction, idEmpresa, compNota.idComprobante);
    const compVenta = `${serieStr}-${numeroStr}`;
    const compRelacionado = `${ceOrigen.serie}-${String(ceOrigen.numero).replace(/\D/g, "").padStart(8, "0")}`;

    let subtotal = 0;
    let total = 0;
    for (const it of items) {
      subtotal += Number(it.subtotal) || 0;
      total += Number(it.total) || 0;
    }
    const igv = Math.round((total - subtotal) * 100) / 100;
    const fEmision = getNowLocalSQLString().slice(0, 19).replace("T", " ");

    const insertVenta = transaction.request();
    insertVenta.input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
    insertVenta.input("idSucursal", sql.UniqueIdentifier, ventaOrigen.idSucursal);
    insertVenta.input("serie", sql.VarChar(4), serieStr.substring(0, 4));
    insertVenta.input("numero", sql.VarChar(8), numeroStr);
    insertVenta.input("compVenta", sql.VarChar(13), compVenta);
    insertVenta.input("idComprobante", sql.Int, compNota.idComprobante);
    insertVenta.input("fEmision", sql.VarChar(23), fEmision);
    insertVenta.input("idCliente", sql.Int, ventaOrigen.idCliente);
    insertVenta.input("idMoneda", sql.Int, ventaOrigen.idMoneda);
    insertVenta.input("tCambio", sql.Decimal(10, 4), ventaOrigen.tCambio);
    insertVenta.input("subtotal", sql.Decimal(18, 2), subtotal);
    insertVenta.input("igv", sql.Decimal(18, 2), igv);
    insertVenta.input("total", sql.Decimal(18, 2), total);
    insertVenta.input("idMediosPago", sql.VarChar(20), ventaOrigen.idMediosPago || "1");
    insertVenta.input("compRelacionado", sql.VarChar(30), compRelacionado);
    insertVenta.input("observaciones", sql.VarChar(500), "");
    insertVenta.input("idUsuario", sql.UniqueIdentifier, idUsuario);
    insertVenta.input("tipoComprobanteRef", sql.VarChar(2), ceOrigen.tipoComprobante || null);
    insertVenta.input("codigoMotivoNotaCredito", sql.VarChar(2), tipoNota === "07" ? (codigoMotivoNotaCredito || "01") : null);

    const ventaInsertResult = await insertVenta.query(`
      DECLARE @ins TABLE (idVenta INT);
      INSERT INTO Ventas (idEmpresa, idSucursal, serie, numero, compVenta, idComprobante, fEmision, fVencimiento, idCliente, idMoneda, tCambio,
        subtotal, igv, exonerado, gratuito, otrosCargos, descuentos, total, idMediosPago, idEstadoPedido, idEstadoPago, idEstadoSunat, compRelacionado, observaciones, idUsuario, tipoComprobanteRef, codigoMotivoNotaCredito)
      OUTPUT INSERTED.idVenta INTO @ins
      VALUES (@idEmpresa, @idSucursal, @serie, @numero, @compVenta, @idComprobante, @fEmision, @fEmision, @idCliente, @idMoneda, @tCambio,
        @subtotal, @igv, 0, 0, 0, 0, @total, @idMediosPago, 1, 1, 7, @compRelacionado, @observaciones, @idUsuario, @tipoComprobanteRef, @codigoMotivoNotaCredito);
      SELECT idVenta FROM @ins;
    `);
    const idVenta = ventaInsertResult.recordset && ventaInsertResult.recordset[0] && ventaInsertResult.recordset[0].idVenta;
    if (!idVenta) {
      await transaction.rollback();
      return null;
    }

    for (const it of items) {
      const reqDet = transaction.request();
      const cantidad = Number(it.cantidad) || 0;
      const pVenta = Number(it.pVenta) || 0;
      const subtotalItem = Number(it.subtotal) || 0;
      const totalItem = Number(it.total) || 0;
      await reqDet
        .input("idVenta", sql.Int, idVenta)
        .input("idProducto", sql.UniqueIdentifier, it.idProducto)
        .input("cantidad", sql.Decimal(18, 3), cantidad)
        .input("pVenta", sql.Decimal(18, 5), pVenta)
        .input("subtotal", sql.Decimal(18, 2), subtotalItem)
        .input("total", sql.Decimal(18, 2), totalItem)
        .query(`
          INSERT INTO DetalleVenta (idVenta, idProducto, cantidad, pVenta, descuento, subtotal, igv, isc, total, cantEntregada, idEstadoPedido, costoUnitario, costoTotal)
          VALUES (@idVenta, @idProducto, @cantidad, @pVenta, 0, @subtotal, 0, 0, @total, 0, 1, 0, 0)
        `);
    }

    await exports.registrarComprobanteElectronicoPorVentaRepo(transaction, idEmpresa, idVenta, compNota.idComprobante, serieStr, numeroStr, fEmision);

    const ceNewResult = await transaction.request()
      .input("idVenta", sql.Int, idVenta)
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT idComprobanteElectronico FROM ComprobantesElectronicos
        WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
      `);
    const idComprobanteElectronico = ceNewResult.recordset && ceNewResult.recordset[0] ? String(ceNewResult.recordset[0].idComprobanteElectronico) : null;

    await transaction.commit();
    return { idVenta, idComprobanteElectronico };
  } catch (err) {
    try { await transaction.rollback(); } catch (_) {}
    throw err;
  }
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

/** Lista comprobantes pendientes de envío (idEstadoSunat = 7) por empresa, para envío automático o por lotes.
 * @param {object} opciones - { excluirBoletas: boolean, filtroProgramacion: null|'modo2'|'modo3' }
 * filtroProgramacion null = manual / compatibilidad (solo pendiente).
 * modo2 = cobro confirmado y fechaElegibleEnvio vencida.
 * modo3 = cobro confirmado (envío en hora fija por job).
 */
exports.listarPendientesEnvioRepo = async (pool, idEmpresa, limite = 500, opciones = {}) => {
  const excluirBoletas = opciones.excluirBoletas === true;
  const filtro = opciones.filtroProgramacion || null;
  let extra = "";
  if (filtro === "modo2") {
    extra = ` AND ce.fechaElegibleEnvio IS NOT NULL AND ce.fechaElegibleEnvio <= SYSUTCDATETIME()
      AND (ce.fechaProximoReintento IS NULL OR ce.fechaProximoReintento <= SYSUTCDATETIME())
      AND ISNULL(ce.intentosEnvio, 0) < ISNULL(ce.maxIntentosEnvio, 10) `;
  } else if (filtro === "modo3") {
    extra = ` AND ce.fechaConfirmacionPago IS NOT NULL
      AND (ce.fechaProximoReintento IS NULL OR ce.fechaProximoReintento <= SYSUTCDATETIME())
      AND ISNULL(ce.intentosEnvio, 0) < ISNULL(ce.maxIntentosEnvio, 10) `;
  }
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
      ${excluirBoletas ? "AND ce.tipoComprobante = '01'" : ""}
      ${extra}
      ORDER BY ce.fechaEmision ASC
    `);
  return result.recordset;
};

/** Cuenta boletas/notas (03, 07, 08) pendientes de envío por fecha en un rango (para aviso en pantalla resúmenes diarios). */
exports.listarBoletasPendientesPorFechaRepo = async (pool, idEmpresa, fechaDesde, fechaHasta) => {
  const fd = typeof fechaDesde === "string" ? fechaDesde.slice(0, 10) : fechaDesde;
  const fh = typeof fechaHasta === "string" ? fechaHasta.slice(0, 10) : fechaHasta;
  if (!fd || !fh) return [];
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaDesde", sql.Date, fd)
    .input("fechaHasta", sql.Date, fh)
    .query(`
      SELECT CONVERT(VARCHAR(10), ce.fechaEmision, 120) AS fechaResumen, COUNT(*) AS cantidad
      FROM ComprobantesElectronicos ce
      WHERE ce.idEmpresa = @idEmpresa AND ce.idEstadoSunat = 7
        AND ce.tipoComprobante IN ('03','07','08')
        AND CONVERT(DATE, ce.fechaEmision) >= @fechaDesde AND CONVERT(DATE, ce.fechaEmision) <= @fechaHasta
      GROUP BY CONVERT(VARCHAR(10), ce.fechaEmision, 120)
      ORDER BY CONVERT(VARCHAR(10), ce.fechaEmision, 120) DESC
    `);
  return result.recordset || [];
};

/** Boletas/notas (03, 07, 08) pendientes de envío para una fecha, para armar resumen diario (RC). */
exports.listarBoletasPendientesParaResumenRepo = async (pool, idEmpresa, fechaResumen) => {
  const fechaStr = typeof fechaResumen === "string" ? fechaResumen.slice(0, 10) : fechaResumen;
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaResumen", sql.Date, fechaStr)
    .query(`
      SELECT ce.idComprobanteElectronico, ce.idVenta, ce.tipoComprobante, ce.serie, ce.numero,
             CONVERT(VARCHAR(10), ce.fechaEmision, 120) AS fechaEmision,
             v.subtotal, v.igv, v.total,
             c.ruc AS numeroDocReceptor,
             CASE WHEN LEN(LTRIM(RTRIM(ISNULL(c.ruc,'')))) = 11 THEN '6' ELSE '1' END AS tipoDocReceptor
      FROM ComprobantesElectronicos ce
      INNER JOIN Ventas v ON v.idVenta = ce.idVenta AND v.idEmpresa = ce.idEmpresa
      INNER JOIN Clientes c ON c.idCliente = v.idCliente AND c.idEmpresa = v.idEmpresa
      WHERE ce.idEmpresa = @idEmpresa AND ce.idEstadoSunat = 7
        AND ce.tipoComprobante IN ('03','07','08')
        AND CONVERT(DATE, ce.fechaEmision) = @fechaResumen
      ORDER BY ce.fechaEmision, ce.serie, ce.numero
    `);
  return result.recordset;
};

/** Obtiene comprobante(s) de referencia para NC/ND (compRelacionado en Ventas, ej. B001-15). */
exports.obtenerDocumentoReferenciaVentaRepo = async (pool, idVenta, idEmpresa) => {
  const r = await pool
    .request()
    .input("idVenta", sql.Int, idVenta)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT compRelacionado FROM Ventas WHERE idVenta = @idVenta AND idEmpresa = @idEmpresa
    `);
  const val = r.recordset && r.recordset[0] ? r.recordset[0].compRelacionado : null;
  if (!val || typeof val !== "string") return { serieReferencia: "", numeroReferencia: "" };
  const parts = String(val).trim().split("-");
  if (parts.length >= 2) {
    return { serieReferencia: parts[0].trim(), numeroReferencia: parts[1].replace(/\D/g, "") };
  }
  return { serieReferencia: "", numeroReferencia: String(val).replace(/\D/g, "") };
};

/** Siguiente correlativo de resumen para empresa y fecha (máx + 1, hasta 5 dígitos). */
exports.obtenerSiguienteCorrelativoResumenRepo = async (pool, idEmpresa, fechaResumen) => {
  const fechaStr = typeof fechaResumen === "string" ? fechaResumen.slice(0, 10).replace(/\D/g, "") : "";
  const r = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaResumen", sql.Date, fechaStr.length >= 8 ? `${fechaStr.slice(0,4)}-${fechaStr.slice(4,6)}-${fechaStr.slice(6,8)}` : fechaResumen)
    .query(`
      SELECT ISNULL(MAX(CAST(NULLIF(LTRIM(RTRIM(numeroCorrelativo)), '') AS INT)), 0) + 1 AS siguiente
      FROM ResumenesDiariosSunat
      WHERE idEmpresa = @idEmpresa AND fechaResumen = @fechaResumen
    `);
  const next = r.recordset && r.recordset[0] ? Math.min(99999, (r.recordset[0].siguiente || 1)) : 1;
  return String(next).slice(0, 5);
};

/** Inserta resumen diario y devuelve idResumenDiarioSunat. */
exports.insertarResumenDiarioRepo = async (pool, idEmpresa, fechaResumen, numeroCorrelativo, ticketSunat) => {
  const nowStr = getNowLocalSQLString();
  const fechaStr = typeof fechaResumen === "string" ? fechaResumen.slice(0, 10) : fechaResumen;
  const r = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaResumen", sql.Date, fechaStr)
    .input("numeroCorrelativo", sql.VarChar(5), String(numeroCorrelativo).slice(0, 5))
    .input("ticketSunat", sql.VarChar(50), ticketSunat || null)
    .input("fechaEnvio", sql.VarChar(23), nowStr)
    .query(`
      INSERT INTO ResumenesDiariosSunat (idEmpresa, fechaResumen, numeroCorrelativo, ticketSunat, fechaEnvio)
      OUTPUT INSERTED.idResumenDiarioSunat
      VALUES (@idEmpresa, @fechaResumen, @numeroCorrelativo, @ticketSunat, @fechaEnvio)
    `);
  return r.recordset && r.recordset[0] ? r.recordset[0].idResumenDiarioSunat : null;
};

/** Inserta detalle resumen (comprobantes incluidos en el resumen). */
exports.insertarResumenDiarioDetalleRepo = async (pool, idResumenDiarioSunat, idComprobanteElectronico) => {
  await pool
    .request()
    .input("idResumenDiarioSunat", sql.UniqueIdentifier, idResumenDiarioSunat)
    .input("idComprobanteElectronico", sql.UniqueIdentifier, idComprobanteElectronico)
    .query(`
      INSERT INTO ResumenDiarioSunatDetalle (idResumenDiarioSunat, idComprobanteElectronico)
      VALUES (@idResumenDiarioSunat, @idComprobanteElectronico)
    `);
};

/** Actualiza resumen diario con resultado de getStatus (CDR, estado). */
exports.actualizarResumenDiarioResultadoRepo = async (pool, idResumenDiarioSunat, resultado) => {
  const nowStr = getNowLocalSQLString();
  await pool
    .request()
    .input("idResumenDiarioSunat", sql.UniqueIdentifier, idResumenDiarioSunat)
    .input("idEstadoSunat", sql.Int, resultado.idEstadoSunat ?? null)
    .input("fechaRespuesta", sql.VarChar(23), nowStr)
    .input("codigoRespuesta", sql.VarChar, resultado.codigoRespuesta || null)
    .input("descripcionRespuesta", sql.VarChar, (resultado.descripcionRespuesta || resultado.error || "").slice(0, 500))
    .input("cdr", sql.NVarChar, resultado.cdr || null)
    .query(`
      UPDATE ResumenesDiariosSunat
      SET idEstadoSunat = @idEstadoSunat, fechaRespuesta = @fechaRespuesta,
          codigoRespuesta = @codigoRespuesta, descripcionRespuesta = @descripcionRespuesta,
          cdr = @cdr, fechaModificacion = GETDATE()
      WHERE idResumenDiarioSunat = @idResumenDiarioSunat
    `);
};

/** Lista IDs de comprobantes electrónicos incluidos en un resumen (para actualizar estado cuando CDR aceptado). */
exports.listarComprobantesDeResumenRepo = async (pool, idResumenDiarioSunat) => {
  const r = await pool
    .request()
    .input("idResumenDiarioSunat", sql.UniqueIdentifier, idResumenDiarioSunat)
    .query(`
      SELECT idComprobanteElectronico FROM ResumenDiarioSunatDetalle WHERE idResumenDiarioSunat = @idResumenDiarioSunat
    `);
  return (r.recordset || []).map((row) => row.idComprobanteElectronico);
};

// ---------- Comunicación de baja (RA) ----------
/** Lista motivos de baja (tabla global MotivoBaja). */
exports.listarMotivosBajaRepo = async (pool) => {
  const r = await pool.request().query(`
    SELECT idMotivoBaja, codigoSunat, descripcion FROM MotivoBaja WHERE activo = 1 ORDER BY codigoSunat
  `);
  return r.recordset || [];
};

/** Dados IDs de comprobante, devuelve tipo/serie/numero solo si son 01/07/08 y aceptados (para armar RA). */
exports.obtenerComprobantesParaBajaPorIdsRepo = async (pool, idEmpresa, idsComprobanteElectronico) => {
  if (!Array.isArray(idsComprobanteElectronico) || idsComprobanteElectronico.length === 0) return [];
  const ids = idsComprobanteElectronico.filter(Boolean);
  if (ids.length === 0) return [];
  const placeholders = ids.map((_, i) => `@id${i}`).join(", ");
  const req = pool.request();
  req.input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
  ids.forEach((id, i) => req.input(`id${i}`, sql.UniqueIdentifier, id));
  const r = await req.query(`
    SELECT idComprobanteElectronico, tipoComprobante, serie, numero,
           CONVERT(VARCHAR(10), fechaEmision, 120) AS fechaEmision
    FROM ComprobantesElectronicos
    WHERE idEmpresa = @idEmpresa AND tipoComprobante IN ('01','07','08') AND idEstadoSunat IN (1, 2, 3)
      AND idComprobanteElectronico IN (${placeholders})
  `);
  return r.recordset || [];
};

/** Lista comprobantes Factura (01), NC (07), ND (08) en estado Aceptado (1,2,3) para seleccionar y dar de baja. */
exports.listarComprobantesAceptadosParaBajaRepo = async (pool, idEmpresa) => {
  const r = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT ce.idComprobanteElectronico, ce.tipoComprobante, ce.serie, ce.numero,
             CONVERT(VARCHAR(19), ce.fechaEmision, 120) AS fechaEmision
      FROM ComprobantesElectronicos ce
      WHERE ce.idEmpresa = @idEmpresa
        AND ce.tipoComprobante IN ('01','07','08')
        AND ce.idEstadoSunat IN (1, 2, 3)
      ORDER BY ce.fechaEmision DESC, ce.serie, ce.numero
    `);
  return r.recordset || [];
};

/** Siguiente correlativo de comunicación de baja para empresa y fecha (máx 5 dígitos). */
exports.obtenerSiguienteCorrelativoBajaRepo = async (pool, idEmpresa, fechaComunicacion) => {
  const fechaStr = typeof fechaComunicacion === "string" ? fechaComunicacion.slice(0, 10).replace(/\D/g, "") : "";
  if (fechaStr.length < 8) return "1";
  const r = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaComunicacion", sql.Date, `${fechaStr.slice(0,4)}-${fechaStr.slice(4,6)}-${fechaStr.slice(6,8)}`)
    .query(`
      SELECT ISNULL(MAX(CAST(NULLIF(LTRIM(RTRIM(numeroCorrelativo)), '') AS INT)), 0) + 1 AS siguiente
      FROM ComunicacionesBaja
      WHERE idEmpresa = @idEmpresa AND fechaComunicacion = @fechaComunicacion
    `);
  const next = r.recordset && r.recordset[0] ? Math.min(99999, (r.recordset[0].siguiente || 1)) : 1;
  return String(next).slice(0, 5);
};

/** Inserta cabecera ComunicacionesBaja y devuelve idComunicacionBaja. Requiere columna xmlEnviado (migración add_comunicaciones_baja_xml_enviado.sql). */
exports.insertarComunicacionBajaRepo = async (pool, idEmpresa, fechaComunicacion, numeroCorrelativo, ticketSunat, xmlEnviado) => {
  const nowStr = getNowLocalSQLString();
  const fechaStr = typeof fechaComunicacion === "string" ? fechaComunicacion.slice(0, 10) : fechaComunicacion;
  const r = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("fechaComunicacion", sql.Date, fechaStr)
    .input("numeroCorrelativo", sql.VarChar(5), String(numeroCorrelativo).slice(0, 5))
    .input("ticketSunat", sql.VarChar(50), ticketSunat || null)
    .input("fechaEnvio", sql.VarChar(23), nowStr)
    .input("xmlEnviado", sql.NVarChar, xmlEnviado || null)
    .query(`
      INSERT INTO ComunicacionesBaja (idEmpresa, fechaComunicacion, numeroCorrelativo, ticketSunat, fechaEnvio, xmlEnviado)
      OUTPUT INSERTED.idComunicacionBaja
      VALUES (@idEmpresa, @fechaComunicacion, @numeroCorrelativo, @ticketSunat, @fechaEnvio, @xmlEnviado)
    `);
  return r.recordset && r.recordset[0] ? r.recordset[0].idComunicacionBaja : null;
};

/** Inserta detalle ComunicacionBajaDetalle. */
exports.insertarComunicacionBajaDetalleRepo = async (pool, idComunicacionBaja, idComprobanteElectronico, motivoBaja) => {
  await pool
    .request()
    .input("idComunicacionBaja", sql.UniqueIdentifier, idComunicacionBaja)
    .input("idComprobanteElectronico", sql.UniqueIdentifier, idComprobanteElectronico)
    .input("motivoBaja", sql.VarChar(250), (motivoBaja || "Anulación de la operación").slice(0, 250))
    .query(`
      INSERT INTO ComunicacionBajaDetalle (idComunicacionBaja, idComprobanteElectronico, motivoBaja)
      VALUES (@idComunicacionBaja, @idComprobanteElectronico, @motivoBaja)
    `);
};

/** Actualiza ComunicacionesBaja con resultado de getStatus (CDR, estado). */
exports.actualizarComunicacionBajaResultadoRepo = async (pool, idComunicacionBaja, resultado) => {
  const nowStr = getNowLocalSQLString();
  await pool
    .request()
    .input("idComunicacionBaja", sql.UniqueIdentifier, idComunicacionBaja)
    .input("idEstadoSunat", sql.Int, resultado.idEstadoSunat ?? null)
    .input("fechaRespuesta", sql.VarChar(23), nowStr)
    .input("codigoRespuesta", sql.VarChar(20), resultado.codigoRespuesta != null ? String(resultado.codigoRespuesta).slice(0, 20) : null)
    .input("descripcionRespuesta", sql.NVarChar, (resultado.descripcionRespuesta || resultado.error || "").trim() || null)
    .input("cdr", sql.NVarChar, resultado.cdr || null)
    .query(`
      UPDATE ComunicacionesBaja
      SET idEstadoSunat = @idEstadoSunat, fechaRespuesta = @fechaRespuesta,
          codigoRespuesta = @codigoRespuesta, descripcionRespuesta = @descripcionRespuesta,
          cdr = @cdr, fechaModificacion = GETDATE()
      WHERE idComunicacionBaja = @idComunicacionBaja
    `);
};

/** Una comunicación de baja por id (idEmpresa); incluye xmlEnviado y cdr para descarga/diagnóstico. */
exports.obtenerComunicacionBajaPorIdRepo = async (pool, idEmpresa, idComunicacionBaja) => {
  const r = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("idComunicacionBaja", sql.UniqueIdentifier, idComunicacionBaja)
    .query(`
      SELECT c.idComunicacionBaja, c.fechaComunicacion, c.numeroCorrelativo, c.ticketSunat, c.idEstadoSunat,
             c.fechaEnvio, c.fechaRespuesta, c.codigoRespuesta, c.descripcionRespuesta, c.xmlEnviado, c.cdr
      FROM ComunicacionesBaja c
      WHERE c.idComunicacionBaja = @idComunicacionBaja AND c.idEmpresa = @idEmpresa
    `);
  return r.recordset && r.recordset[0] ? r.recordset[0] : null;
};

/** Lista IDs de comprobantes incluidos en una comunicación de baja (para actualizar estado cuando CDR aceptado). */
exports.listarComprobantesDeComunicacionBajaRepo = async (pool, idComunicacionBaja) => {
  const r = await pool
    .request()
    .input("idComunicacionBaja", sql.UniqueIdentifier, idComunicacionBaja)
    .query(`
      SELECT idComprobanteElectronico FROM ComunicacionBajaDetalle WHERE idComunicacionBaja = @idComunicacionBaja
    `);
  return (r.recordset || []).map((row) => row.idComprobanteElectronico);
};

/** Devuelve idEstadoSunat por codigo (ej: '08' = Baja aceptada). */
exports.obtenerIdEstadoSunatPorCodigoRepo = async (pool, codigo) => {
  const r = await pool.request().input("codigo", sql.VarChar(10), String(codigo || "").trim()).query(`
    SELECT idEstadoSunat FROM EstadosSunat WHERE codigo = @codigo
  `);
  return r.recordset && r.recordset[0] ? r.recordset[0].idEstadoSunat : null;
};

/** Lista comunicaciones de baja con filtros. */
exports.listarComunicacionesBajaRepo = async (pool, idEmpresa, filtros = {}) => {
  const { fechaDesde, fechaHasta, idEstadoSunat, pagina = 1, porPagina = 20 } = filtros;
  const offset = (Math.max(1, pagina) - 1) * Math.min(100, Math.max(1, porPagina));
  const limit = Math.min(100, Math.max(1, porPagina));
  let where = "WHERE c.idEmpresa = @idEmpresa";
  const inputs = { idEmpresa };
  if (fechaDesde) { where += " AND c.fechaComunicacion >= @fechaDesde"; inputs.fechaDesde = typeof fechaDesde === "string" ? fechaDesde.slice(0, 10) : fechaDesde; }
  if (fechaHasta) { where += " AND c.fechaComunicacion <= @fechaHasta"; inputs.fechaHasta = typeof fechaHasta === "string" ? fechaHasta.slice(0, 10) : fechaHasta; }
  if (idEstadoSunat != null && idEstadoSunat !== "") { where += " AND c.idEstadoSunat = @idEstadoSunat"; inputs.idEstadoSunat = idEstadoSunat; }
  const reqCount = pool.request();
  reqCount.input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
  if (inputs.fechaDesde) reqCount.input("fechaDesde", sql.Date, inputs.fechaDesde);
  if (inputs.fechaHasta) reqCount.input("fechaHasta", sql.Date, inputs.fechaHasta);
  if (inputs.idEstadoSunat != null) reqCount.input("idEstadoSunat", sql.Int, inputs.idEstadoSunat);
  const countResult = await reqCount.query(`SELECT COUNT(*) AS total FROM ComunicacionesBaja c ${where}`);
  const total = countResult.recordset && countResult.recordset[0] ? countResult.recordset[0].total : 0;
  const reqList = pool.request();
  reqList.input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
  if (inputs.fechaDesde) reqList.input("fechaDesde", sql.Date, inputs.fechaDesde);
  if (inputs.fechaHasta) reqList.input("fechaHasta", sql.Date, inputs.fechaHasta);
  if (inputs.idEstadoSunat != null) reqList.input("idEstadoSunat", sql.Int, inputs.idEstadoSunat);
  reqList.input("offset", sql.Int, offset).input("porPagina", sql.Int, limit);
  const listResult = await reqList.query(`
    SELECT c.idComunicacionBaja, c.fechaComunicacion, c.numeroCorrelativo, c.ticketSunat, c.idEstadoSunat,
           c.fechaEnvio, c.fechaRespuesta, c.codigoRespuesta, c.descripcionRespuesta,
           es.codigo AS codigoEstadoSunat, es.descripcion AS descripcionEstadoSunat,
           CASE WHEN c.xmlEnviado IS NOT NULL AND LEN(c.xmlEnviado) > 0 THEN 1 ELSE 0 END AS tieneXmlEnviado,
           CASE WHEN c.cdr IS NOT NULL AND LEN(c.cdr) > 0 THEN 1 ELSE 0 END AS tieneCdr
    FROM ComunicacionesBaja c
    LEFT JOIN EstadosSunat es ON es.idEstadoSunat = c.idEstadoSunat
    ${where}
    ORDER BY c.fechaComunicacion DESC, c.numeroCorrelativo DESC
    OFFSET @offset ROWS FETCH NEXT @porPagina ROWS ONLY
  `);
  return { items: listResult.recordset || [], total };
};

/** Actualiza estado de varios comprobantes electrónicos (y sus ventas) a idEstadoSunat. */
exports.actualizarEstadoComprobantesRepo = async (pool, idsComprobanteElectronico, idEstadoSunat, cdr, codigoRespuesta, descripcionRespuesta) => {
  const nowStr = getNowLocalSQLString();
  for (const id of idsComprobanteElectronico) {
    await pool.request()
      .input("idComprobanteElectronico", sql.UniqueIdentifier, id)
      .input("idEstadoSunat", sql.Int, idEstadoSunat)
      .input("fechaRespuesta", sql.VarChar(23), nowStr)
      .input("codigoRespuesta", sql.VarChar, codigoRespuesta || null)
      .input("descripcionRespuesta", sql.VarChar, (descripcionRespuesta || "").slice(0, 500))
      .input("cdr", sql.NVarChar, cdr || null)
      .query(`
        UPDATE ComprobantesElectronicos SET idEstadoSunat = @idEstadoSunat, fechaRespuesta = @fechaRespuesta,
          codigoRespuesta = @codigoRespuesta, descripcionRespuesta = @descripcionRespuesta, cdr = @cdr
        WHERE idComprobanteElectronico = @idComprobanteElectronico
      `);
    await pool.request()
      .input("idComprobanteElectronico", sql.UniqueIdentifier, id)
      .input("idEstadoSunat", sql.Int, idEstadoSunat)
      .query(`
        UPDATE Ventas SET idEstadoSunat = @idEstadoSunat
        WHERE idVenta = (SELECT idVenta FROM ComprobantesElectronicos WHERE idComprobanteElectronico = @idComprobanteElectronico)
      `);
  }
};

/** Lista resúmenes diarios con filtros (idEmpresa, fechaDesde, fechaHasta, idEstadoSunat). */
exports.listarResumenesDiariosRepo = async (pool, idEmpresa, filtros = {}) => {
  const { fechaDesde, fechaHasta, idEstadoSunat, pagina = 1, porPagina = 20 } = filtros;
  const offset = (Math.max(1, pagina) - 1) * Math.min(100, Math.max(1, porPagina));
  const limit = Math.min(100, Math.max(1, porPagina));

  let where = "WHERE r.idEmpresa = @idEmpresa";
  const inputs = { idEmpresa };
  if (fechaDesde) { where += " AND r.fechaResumen >= @fechaDesde"; inputs.fechaDesde = typeof fechaDesde === "string" ? fechaDesde.slice(0, 10) : fechaDesde; }
  if (fechaHasta) { where += " AND r.fechaResumen <= @fechaHasta"; inputs.fechaHasta = typeof fechaHasta === "string" ? fechaHasta.slice(0, 10) : fechaHasta; }
  if (idEstadoSunat != null && idEstadoSunat !== "") { where += " AND r.idEstadoSunat = @idEstadoSunat"; inputs.idEstadoSunat = idEstadoSunat; }

  const reqCount = pool.request();
  reqCount.input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
  if (inputs.fechaDesde) reqCount.input("fechaDesde", sql.Date, inputs.fechaDesde);
  if (inputs.fechaHasta) reqCount.input("fechaHasta", sql.Date, inputs.fechaHasta);
  if (inputs.idEstadoSunat != null) reqCount.input("idEstadoSunat", sql.Int, inputs.idEstadoSunat);
  const countResult = await reqCount.query(`SELECT COUNT(*) AS total FROM ResumenesDiariosSunat r ${where}`);
  const total = countResult.recordset && countResult.recordset[0] ? countResult.recordset[0].total : 0;

  const reqList = pool.request();
  reqList.input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
  if (inputs.fechaDesde) reqList.input("fechaDesde", sql.Date, inputs.fechaDesde);
  if (inputs.fechaHasta) reqList.input("fechaHasta", sql.Date, inputs.fechaHasta);
  if (inputs.idEstadoSunat != null) reqList.input("idEstadoSunat", sql.Int, inputs.idEstadoSunat);
  reqList.input("offset", sql.Int, offset).input("porPagina", sql.Int, limit);
  const listResult = await reqList.query(`
    SELECT r.idResumenDiarioSunat, r.idEmpresa, r.fechaResumen, r.numeroCorrelativo, r.ticketSunat,
           r.idEstadoSunat, r.fechaEnvio, r.fechaRespuesta, r.codigoRespuesta, r.descripcionRespuesta,
           es.codigo AS codigoEstadoSunat, es.descripcion AS descripcionEstadoSunat
    FROM ResumenesDiariosSunat r
    LEFT JOIN EstadosSunat es ON es.idEstadoSunat = r.idEstadoSunat
    ${where}
    ORDER BY r.fechaResumen DESC, r.numeroCorrelativo DESC
    OFFSET @offset ROWS FETCH NEXT @porPagina ROWS ONLY
  `);

  return { items: listResult.recordset || [], total };
};

/**
 * Guarda el código hash (DigestValue del XML firmado) para PDF/QR. No modifica otros campos.
 */
exports.actualizarHashComprobanteElectronicoRepo = async (pool, idComprobanteElectronico, hash) => {
  const h = hash != null ? String(hash).trim() : "";
  if (!h || !idComprobanteElectronico) {
    return;
  }
  await pool
    .request()
    .input("idComprobanteElectronico", sql.UniqueIdentifier, idComprobanteElectronico)
    .input("hash", sql.VarChar(200), h.slice(0, 200))
    .query(`
      UPDATE ComprobantesElectronicos
      SET hash = @hash
      WHERE idComprobanteElectronico = @idComprobanteElectronico
    `);
};

/**
 * Tras firmar el XML, persiste hash y opcionalmente el XML completo (útil para trazabilidad / PDF si se amplía el payload).
 */
exports.persistirHashXmlComprobanteElectronicoRepo = async (pool, idComprobanteElectronico, xmlFirmado) => {
  const codigoHash = extraerCodigoHashDesdeXmlFirmado(xmlFirmado);
  if (!codigoHash) {
    console.error("[SUNAT] No se pudo extraer DigestValue del XML firmado (hash vacío).");
    return;
  }
  try {
    await exports.actualizarHashComprobanteElectronicoRepo(pool, idComprobanteElectronico, codigoHash);
  } catch (err) {
    console.error("[SUNAT] Error al guardar hash en ComprobantesElectronicos:", err);
  }
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
 * Genera y firma el XML UBL del comprobante (solo flujo envío directo). Para descarga o para enviar.
 * @returns { Promise<{ xml: string, nombreBase: string } | { ok: false, mensaje: string }> }
 */
exports.generarYFirmarXmlComprobanteRepo = async (pool, user, idComprobanteElectronico) => {
  const comp = await exports.obtenerComprobanteParaEnvioRepo(pool, idComprobanteElectronico, user.empresa);
  if (!comp) return { ok: false, mensaje: "Comprobante no encontrado" };
  const payload = await ventasRepository.obtenerComprobanteParaPdf(pool, comp.idVenta, [user.empresa]);
  if (!payload) return { ok: false, mensaje: "No se encontraron datos de la venta para generar el comprobante" };
  const configFirma = await exports.obtenerConfiguracionParaFirmaRepo(pool, user.empresa);
  const certBase64 = configFirma?.certificadoDigital;
  const claveCert = configFirma?.claveCertificado ? cifradoClaveCertificado.descifrar(configFirma.claveCertificado) : null;
  if (!certBase64 || !claveCert) {
    return { ok: false, mensaje: "Configure certificado digital y clave en Configuración > Facturación" };
  }
  const nombreArchivo = nombreArchivoComprobante({
    ruc: comp.rucEmpresa,
    tipoComprobante: comp.tipoComprobante,
    serie: comp.serie,
    numero: comp.numero
  });
  const base = nombreArchivo.replace(/\.json$/i, "");
  const numeroComprobante = `${comp.serie}-${String(comp.numero).replace(/\D/g, "").padStart(8, "0")}`;
  let xml;
  if (comp.tipoComprobante === "07" || comp.tipoComprobante === "08") {
    const venta = payload.venta || {};
    const compRel = (venta.compRelacionado || "").trim();
    const parts = compRel.split("-");
    const documentoReferencia = {
      tipoComprobanteRef: (venta.tipoComprobanteRef || "01").trim(),
      serieRef: parts[0] || "",
      numeroRef: parts.length >= 2 ? parts[1].replace(/\D/g, "") : ""
    };
    const motivo = {
      codigo: (venta.codigoMotivoNotaCredito || "01").trim(),
      descripcion: comp.tipoComprobante === "07" ? "Anulación de la operación" : "Otros conceptos"
    };
    const payloadNota = { ...payload, documentoReferencia, motivo };
    xml = comp.tipoComprobante === "07"
      ? generadorXmlUblSunat.generarXmlUblCreditNote(payloadNota, numeroComprobante)
      : generadorXmlUblSunat.generarXmlUblDebitNote(payloadNota, numeroComprobante);
  } else {
    xml = generadorXmlUblSunat.generarXmlUblFacturaBoleta(payload, comp.tipoComprobante, numeroComprobante);
  }
  try {
    xml = firmaXmlSunat.firmarXmlUbl(xml, Buffer.from(certBase64, "base64"), claveCert);
  } catch (err) {
    console.error("[SUNAT] Error al firmar XML:", err);
    return { ok: false, mensaje: err.message || "Error al firmar XML con el certificado" };
  }
  await exports.persistirHashXmlComprobanteElectronicoRepo(pool, idComprobanteElectronico, xml);
  return { xml, nombreBase: base };
};

/**
 * Envía el comprobante a SUNAT. Dos flujos según otros/manual_programador.pdf (RS 097-2012/SUNAT):
 *
 * 1) ENVÍO DIRECTO (config.envioDirectoSunat + urlEnvio + usuarioSunat + claveSunat + certificado):
 *    No archivos planos. Se genera XML UBL, se firma, se guarda en xml_firmados_sunat, se envía a BillService sendBill (§2.5). Se guarda CDR en BD.
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

  const payload = await ventasRepository.obtenerComprobanteParaPdf(pool, comp.idVenta, [user.empresa]);
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

  // Envío directo a SUNAT (SOAP BillService): requiere UBL firmado, usuarioSunat, claveSunat y URL (o modoPrueba para derivar URL)
  const usaEnvioDirecto = config.envioDirectoSunat === true || config.envioDirectoSunat === 1 || config.envioDirectoSunat === "1";
  const modoPrueba = config.modoPrueba === true || config.modoPrueba === 1 || String(config.modoPrueba || "").trim() === "1";
  const urlParaEnvio = (config.urlEnvio && String(config.urlEnvio).trim()) || (modoPrueba ? envioDirectoSunat.URL_BETA : envioDirectoSunat.URL_PRODUCCION);
  const tieneUrl = !!urlParaEnvio;
  const tieneUsuario = !!(config.usuarioSunat && String(config.usuarioSunat).trim());
  const tieneClave = !!(config.claveSunat != null && String(config.claveSunat).trim() !== "");
  if (!usaEnvioDirecto || !tieneUrl || !tieneUsuario || !tieneClave) {
    console.error("[SUNAT] enviarComprobanteSunatRepo: no se usa envío directo", {
      envioDirectoSunat: config.envioDirectoSunat,
      usaEnvioDirecto,
      tieneUrl,
      tieneUsuario,
      tieneClave
    });
  }
  if (usaEnvioDirecto && tieneUrl && tieneUsuario && tieneClave) {
    console.error("[SUNAT] Creación XML: tipo", comp.tipoComprobante, "serie-número", base);
    const signed = await exports.generarYFirmarXmlComprobanteRepo(pool, user, idComprobanteElectronico);
    if (signed.ok === false) return signed;
    const { xml, nombreBase } = signed;
    console.error("[SUNAT] Firma XML: OK");
    try {
      if (!fs.existsSync(CARPETA_XML_FIRMADOS)) fs.mkdirSync(CARPETA_XML_FIRMADOS, { recursive: true });
      const rutaXml = path.join(CARPETA_XML_FIRMADOS, `${nombreBase}.xml`);
      fs.writeFileSync(rutaXml, xml, "utf8");
      console.error("[SUNAT] Descarga guardada:", rutaXml);
    } catch (err) {
      console.error("[SUNAT] Error al guardar XML en disco:", err);
    }
    console.error("[SUNAT] Envío a SUNAT:", nombreBase);
    const usuarioSOAP = config.usuarioSunat.length >= 20 || /^\d+/.test(config.usuarioSunat)
      ? config.usuarioSunat
      : rucStr + String(config.usuarioSunat).trim();
    const claveSunatDec = config.claveSunat ? cifradoClaveCertificado.descifrar(config.claveSunat) : null;
    let resultado;
    try {
      resultado = await envioDirectoSunat.enviarComprobanteDirectoSunat(
        xml,
        nombreBase,
        usuarioSOAP,
        claveSunatDec || config.claveSunat,
        urlParaEnvio
      );
      console.error("[SUNAT] Respuesta SUNAT:", JSON.stringify(resultado));
    } catch (err) {
      console.error("[SUNAT] Error en envío a SUNAT:", err);
      return {
        ok: false,
        mensaje: err.message || "Error al enviar comprobante a SUNAT"
      };
    }
    await exports.actualizarResultadoEnvioRepo(pool, idComprobanteElectronico, {
      codigoRespuesta: resultado.codigoRespuesta,
      descripcionRespuesta: resultado.descripcionRespuesta || resultado.error,
      cdr: resultado.cdr,
      idEstadoSunat: resultado.idEstadoSunat ?? 6
    });
    const resDir = { ok: resultado.ok, idEstadoSunat: resultado.idEstadoSunat, codigoRespuesta: resultado.codigoRespuesta, error: resultado.error };
    console.error("[SUNAT] enviarComprobanteSunatRepo: resultado envío directo", resDir);
    debugSunatLog.write({ location: "facturacion.repository.enviarComprobanteSunatRepo:resultadoDirecto", message: "resultado", data: resDir });
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
    let xml;
    if (comp.tipoComprobante === "07" || comp.tipoComprobante === "08") {
      const venta = payload.venta || {};
      const compRel = (venta.compRelacionado || "").trim();
      const parts = compRel.split("-");
      const documentoReferencia = {
        tipoComprobanteRef: (venta.tipoComprobanteRef || "01").trim(),
        serieRef: parts[0] || "",
        numeroRef: parts.length >= 2 ? parts[1].replace(/\D/g, "") : ""
      };
      const motivo = {
        codigo: (venta.codigoMotivoNotaCredito || "01").trim(),
        descripcion: comp.tipoComprobante === "07" ? "Anulación de la operación" : "Otros conceptos"
      };
      const payloadNota = { ...payload, documentoReferencia, motivo };
      xml = comp.tipoComprobante === "07"
        ? generadorXmlUblSunat.generarXmlUblCreditNote(payloadNota, numeroComprobante)
        : generadorXmlUblSunat.generarXmlUblDebitNote(payloadNota, numeroComprobante);
    } else {
      xml = generadorXmlUblSunat.generarXmlUblFacturaBoleta(payload, comp.tipoComprobante, numeroComprobante);
    }
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
      await exports.persistirHashXmlComprobanteElectronicoRepo(pool, idComprobanteElectronico, xml);
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

/**
 * Consulta estado del comprobante en BD. Si hay usuario/clave SOL, consulta CDR en SUNAT (getStatusCdr)
 * usando la URL fija según modoPrueba (beta o producción) y actualiza el comprobante antes de devolver.
 */
exports.consultarEstadoSunatRepo = async (pool, user, idComprobanteElectronico) => {
  const comp = await exports.obtenerComprobanteParaEnvioRepo(pool, idComprobanteElectronico, user.empresa);
  if (!comp) return null;

  const config = await exports.obtenerConfiguracionFacturacionRepo(pool, user.empresa);
  const modoPrueba = config?.modoPrueba === true || config?.modoPrueba === 1 || String(config?.modoPrueba || "").trim() === "1";
  const urlConsultaCdr = modoPrueba ? consultaSunat.URL_CONSULTA_CDR_BETA : consultaSunat.URL_CONSULTA_CDR_PROD;
  const claveSunatDec = config?.claveSunat ? cifradoClaveCertificado.descifrar(config.claveSunat) : null;

  if (config?.usuarioSunat && claveSunatDec) {
    const rucStr = String(comp.rucEmpresa || "").trim().replace(/\D/g, "").padStart(11, "0");
    const usuarioSOAP = config.usuarioSunat.length >= 20 || /^\d+/.test(config.usuarioSunat)
      ? config.usuarioSunat
      : rucStr + String(config.usuarioSunat).trim();
    const numeroNorm = String(comp.numero ?? "").replace(/\D/g, "").padStart(8, "0");
    const resultadoCdr = await consultaSunat.consultarCdrSunat(
      rucStr,
      comp.tipoComprobante,
      comp.serie,
      numeroNorm,
      usuarioSOAP,
      claveSunatDec,
      urlConsultaCdr
    );
    if (resultadoCdr.cdr != null && resultadoCdr.idEstadoSunat != null) {
      await exports.actualizarResultadoEnvioRepo(pool, idComprobanteElectronico, {
        codigoRespuesta: resultadoCdr.codigoRespuesta,
        descripcionRespuesta: resultadoCdr.descripcionRespuesta || resultadoCdr.error,
        cdr: resultadoCdr.cdr,
        idEstadoSunat: resultadoCdr.idEstadoSunat
      });
    }
  }

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