const sql = require("mssql");

exports.obtenerConfiguracionFacturacionRepo = async (pool, idEmpresa) => {
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        idConfiguracion,
        certificadoDigital,
        claveCertificado,
        usuarioSunat,
        claveSunat,
        urlEnvio,
        urlConsulta,
        modoPrueba,
        serieFactura,
        serieBoleta,
        serieNotaCredito,
        serieNotaDebito
      FROM ConfiguracionFacturacionElectronica
      WHERE idEmpresa = @idEmpresa
    `);

  return result.recordset[0];
};

exports.actualizarConfiguracionFacturacionRepo = async (pool, user, datos) => {
  // Verificar si ya existe configuración
  const existente = await this.obtenerConfiguracionFacturacionRepo(pool, user.empresa);

  if (existente) {
    // Actualizar
    await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .input("certificadoDigital", sql.VarChar, datos.certificadoDigital || null)
      .input("claveCertificado", sql.VarChar, datos.claveCertificado || null)
      .input("usuarioSunat", sql.VarChar, datos.usuarioSunat || null)
      .input("claveSunat", sql.VarChar, datos.claveSunat || null)
      .input("modoPrueba", sql.Bit, datos.modoPrueba !== undefined ? datos.modoPrueba : 1)
      .input("serieFactura", sql.VarChar, datos.serieFactura || null)
      .input("serieBoleta", sql.VarChar, datos.serieBoleta || null)
      .input("serieNotaCredito", sql.VarChar, datos.serieNotaCredito || null)
      .input("serieNotaDebito", sql.VarChar, datos.serieNotaDebito || null)
      .query(`
        UPDATE ConfiguracionFacturacionElectronica
        SET certificadoDigital = @certificadoDigital,
            claveCertificado = @claveCertificado,
            usuarioSunat = @usuarioSunat,
            claveSunat = @claveSunat,
            modoPrueba = @modoPrueba,
            serieFactura = @serieFactura,
            serieBoleta = @serieBoleta,
            serieNotaCredito = @serieNotaCredito,
            serieNotaDebito = @serieNotaDebito
        WHERE idEmpresa = @idEmpresa
      `);
  } else {
    // Crear nueva
    await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, user.empresa)
      .input("certificadoDigital", sql.VarChar, datos.certificadoDigital || null)
      .input("claveCertificado", sql.VarChar, datos.claveCertificado || null)
      .input("usuarioSunat", sql.VarChar, datos.usuarioSunat || null)
      .input("claveSunat", sql.VarChar, datos.claveSunat || null)
      .input("modoPrueba", sql.Bit, datos.modoPrueba !== undefined ? datos.modoPrueba : 1)
      .input("serieFactura", sql.VarChar, datos.serieFactura || null)
      .input("serieBoleta", sql.VarChar, datos.serieBoleta || null)
      .input("serieNotaCredito", sql.VarChar, datos.serieNotaCredito || null)
      .input("serieNotaDebito", sql.VarChar, datos.serieNotaDebito || null)
      .query(`
        INSERT INTO ConfiguracionFacturacionElectronica (
          idEmpresa, certificadoDigital, claveCertificado, usuarioSunat,
          claveSunat, modoPrueba, serieFactura, serieBoleta,
          serieNotaCredito, serieNotaDebito
        ) VALUES (
          @idEmpresa, @certificadoDigital, @claveCertificado, @usuarioSunat,
          @claveSunat, @modoPrueba, @serieFactura, @serieBoleta,
          @serieNotaCredito, @serieNotaDebito
        )
      `);
  }

  return { mensaje: "Configuración actualizada exitosamente" };
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

exports.enviarComprobanteSunatRepo = async (pool, user, idComprobanteElectronico) => {
  // Simular envío a SUNAT (en producción aquí iría la llamada real al servicio web de SUNAT)
  await pool
    .request()
    .input("idComprobanteElectronico", sql.UniqueIdentifier, idComprobanteElectronico)
    .input("fechaEnvio", sql.DateTime, new Date())
    .input("intentosEnvio", sql.Int, 1)
    .input("ultimoIntento", sql.DateTime, new Date())
    .query(`
      UPDATE ComprobantesElectronicos
      SET fechaEnvio = @fechaEnvio,
          intentosEnvio = @intentosEnvio,
          ultimoIntento = @ultimoIntento,
          idEstadoSunat = 2
      WHERE idComprobanteElectronico = @idComprobanteElectronico
    `);

  // Simular respuesta de SUNAT (éxito)
  await new Promise(resolve => setTimeout(resolve, 2000)); // Simular delay de red

  await pool
    .request()
    .input("idComprobanteElectronico", sql.UniqueIdentifier, idComprobanteElectronico)
    .input("fechaRespuesta", sql.DateTime, new Date())
    .input("codigoRespuesta", sql.VarChar, '0')
    .input("descripcionRespuesta", sql.VarChar, 'Aceptado')
    .input("cdr", sql.NVarChar, '<CDR>Aceptado</CDR>')
    .query(`
      UPDATE ComprobantesElectronicos
      SET fechaRespuesta = @fechaRespuesta,
          codigoRespuesta = @codigoRespuesta,
          descripcionRespuesta = @descripcionRespuesta,
          cdr = @cdr,
          idEstadoSunat = 1
      WHERE idComprobanteElectronico = @idComprobanteElectronico
    `);

  return { mensaje: "Comprobante enviado y aceptado por SUNAT" };
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