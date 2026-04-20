const sql = require("mssql");
const { v4: uuidv4 } = require("uuid");
const saasContadorComprobantesSunatService = require("../services/saasContadorComprobantesSunat.service");

/**
 * Devuelve RUC, razón social y dirección fiscal (principal o primera) para GRE / XML UBL emisor.
 */
exports.obtenerDatosEmpresaParaGuiaRepo = async (pool, idEmpresa) => {
  const r = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1
        e.ruc,
        ISNULL(e.razon_Social, ISNULL(e.nombreComercial, '')) AS razonSocial,
        d.ubigeo        AS emisorUbigeo,
        d.codLocal      AS emisorCodLocal,
        d.region        AS emisorDepartamento,
        d.provincia     AS emisorProvincia,
        d.distrito      AS emisorDistrito,
        d.direccion     AS emisorDireccion,
        d.urbanizacion  AS emisorUrbanizacion
      FROM Empresas e
      OUTER APPLY (
        SELECT TOP 1
          de.ubigeo,
          de.codLocal,
          de.region,
          de.provincia,
          de.distrito,
          de.direccion,
          de.urbanizacion
        FROM DireccionEmpresa de
        WHERE de.idEmpresa = e.idEmpresa
        ORDER BY CASE WHEN de.principal = 1 THEN 0 ELSE 1 END, de.idDireccionEmpresa ASC
      ) d
      WHERE e.idEmpresa = @idEmpresa
    `);
  return r.recordset[0] || null;
};

/**
 * Siguiente número correlativo para una serie de guía en la empresa.
 */
exports.siguienteNumeroGuiaRepo = async (pool, idEmpresa, serie) => {
  const r = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("serie", sql.VarChar(10), serie)
    .query(`
      SELECT ISNULL(MAX(TRY_CAST(numero AS INT)), 0) + 1 AS siguiente
      FROM GuiasElectronicasEmitidas
      WHERE idEmpresa = @idEmpresa AND serie = @serie
    `);
  return r.recordset[0]?.siguiente ?? 1;
};

/**
 * Inserta una guía electrónica en la tabla GuiasElectronicasEmitidas.
 * Devuelve el idGuiaElectronica generado.
 */
exports.insertarGuiaRepo = async (pool, datos) => {
  const id = datos.idGuiaElectronica || uuidv4();
  const numero = String(datos.numero).padStart(8, "0");
  const datosGuiaJson = datos.datosGuia ? JSON.stringify(datos.datosGuia) : null;

  // Intentar insertar con columna datosGuia; si no existe la columna, insertar sin ella
  try {
    await pool
      .request()
      .input("idGuiaElectronica", sql.UniqueIdentifier, id)
      .input("idEmpresa", sql.UniqueIdentifier, datos.idEmpresa)
      .input("tipoDocumento", sql.VarChar(2), datos.tipoDocumento)
      .input("tipoRol", sql.VarChar(20), datos.tipoRol)
      .input("serie", sql.VarChar(10), datos.serie)
      .input("numero", sql.VarChar(12), numero)
      .input("fechaEmision", sql.DateTime2, new Date(datos.fechaEmision))
      .input("idEstadoSunat", sql.Int, datos.idEstadoSunat ?? null)
      .input("descripcionEstado", sql.VarChar(200), datos.descripcionEstado ?? null)
      .input("ticketSunat", sql.VarChar(100), datos.ticketSunat ?? null)
      .input("comprobanteOrigenSerie", sql.VarChar(10), datos.comprobanteOrigenSerie ?? null)
      .input("comprobanteOrigenNumero", sql.VarChar(12), datos.comprobanteOrigenNumero ?? null)
      .input("motivoTraslado", sql.VarChar(10), datos.motivoTraslado ?? null)
      .input("datosGuia", sql.NVarChar(sql.MAX), datosGuiaJson)
      .query(`
        INSERT INTO GuiasElectronicasEmitidas (
          idGuiaElectronica, idEmpresa, tipoDocumento, tipoRol, serie, numero, fechaEmision,
          idEstadoSunat, descripcionEstado, ticketSunat,
          comprobanteOrigenSerie, comprobanteOrigenNumero, motivoTraslado, datosGuia
        ) VALUES (
          @idGuiaElectronica, @idEmpresa, @tipoDocumento, @tipoRol, @serie, @numero, @fechaEmision,
          @idEstadoSunat, @descripcionEstado, @ticketSunat,
          @comprobanteOrigenSerie, @comprobanteOrigenNumero, @motivoTraslado, @datosGuia
        )
      `);
  } catch (err) {
    if (/column.*datosGuia|Invalid column/i.test(err.message)) {
      console.error(
        "guiaElectronica.repository insertarGuiaRepo: columna datosGuia ausente; ejecute migración add_guias_emitidas_datos_json.sql. La guía quedará sin JSON de detalle (PDF/SUNAT)."
      );
      // Columna aún no existe (migración pendiente): insertar sin datosGuia
      await pool
        .request()
        .input("idGuiaElectronica", sql.UniqueIdentifier, id)
        .input("idEmpresa", sql.UniqueIdentifier, datos.idEmpresa)
        .input("tipoDocumento", sql.VarChar(2), datos.tipoDocumento)
        .input("tipoRol", sql.VarChar(20), datos.tipoRol)
        .input("serie", sql.VarChar(10), datos.serie)
        .input("numero", sql.VarChar(12), numero)
        .input("fechaEmision", sql.DateTime2, new Date(datos.fechaEmision))
        .input("idEstadoSunat", sql.Int, datos.idEstadoSunat ?? null)
        .input("descripcionEstado", sql.VarChar(200), datos.descripcionEstado ?? null)
        .input("ticketSunat", sql.VarChar(100), datos.ticketSunat ?? null)
        .input("comprobanteOrigenSerie", sql.VarChar(10), datos.comprobanteOrigenSerie ?? null)
        .input("comprobanteOrigenNumero", sql.VarChar(12), datos.comprobanteOrigenNumero ?? null)
        .input("motivoTraslado", sql.VarChar(10), datos.motivoTraslado ?? null)
        .query(`
          INSERT INTO GuiasElectronicasEmitidas (
            idGuiaElectronica, idEmpresa, tipoDocumento, tipoRol, serie, numero, fechaEmision,
            idEstadoSunat, descripcionEstado, ticketSunat,
            comprobanteOrigenSerie, comprobanteOrigenNumero, motivoTraslado
          ) VALUES (
            @idGuiaElectronica, @idEmpresa, @tipoDocumento, @tipoRol, @serie, @numero, @fechaEmision,
            @idEstadoSunat, @descripcionEstado, @ticketSunat,
            @comprobanteOrigenSerie, @comprobanteOrigenNumero, @motivoTraslado
          )
        `);
    } else {
      throw err;
    }
  }
  return id;
};

/**
 * Actualiza datos de una guía pendiente o con error SUNAT (no aceptada ni en proceso).
 * Deja la guía en estado pendiente, sin ticket ni XML firmado, para volver a enviar.
 * @returns {Promise<boolean>} true si se actualizó al menos una fila
 */
exports.actualizarGuiaDatosRepo = async (pool, idGuiaElectronica, idEmpresa, datos) => {
  const datosGuiaJson = datos.datosGuia ? JSON.stringify(datos.datosGuia) : null;
  const coNum = datos.comprobanteOrigenNumero
    ? String(datos.comprobanteOrigenNumero).padStart(8, "0")
    : null;

  const runUpdate = async (includeXmlFirmado) => {
    const req = pool
      .request()
      .input("idGuiaElectronica", sql.UniqueIdentifier, idGuiaElectronica)
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .input("fechaEmision", sql.DateTime2, new Date(datos.fechaEmision))
      .input("motivoTraslado", sql.VarChar(10), datos.motivoTraslado ?? null)
      .input("comprobanteOrigenSerie", sql.VarChar(10), datos.comprobanteOrigenSerie ?? null)
      .input("comprobanteOrigenNumero", sql.VarChar(12), coNum)
      .input("datosGuia", sql.NVarChar(sql.MAX), datosGuiaJson);
    const setXml = includeXmlFirmado ? ", xmlFirmado = NULL" : "";
    const r = await req.query(`
      UPDATE GuiasElectronicasEmitidas
      SET fechaEmision = @fechaEmision,
          motivoTraslado = @motivoTraslado,
          comprobanteOrigenSerie = @comprobanteOrigenSerie,
          comprobanteOrigenNumero = @comprobanteOrigenNumero,
          datosGuia = @datosGuia,
          ticketSunat = NULL,
          idEstadoSunat = NULL,
          descripcionEstado = NULL${setXml}
      WHERE idGuiaElectronica = @idGuiaElectronica
        AND idEmpresa = @idEmpresa
        AND (idEstadoSunat IS NULL OR idEstadoSunat = 98)
    `);
    return (r.rowsAffected && r.rowsAffected[0] > 0) || false;
  };

  try {
    return await runUpdate(true);
  } catch (err) {
    if (/Invalid column name ['"]xmlFirmado['"]|column.*xmlFirmado/i.test(err.message)) {
      return runUpdate(false);
    }
    throw err;
  }
};

/**
 * Actualiza idEstadoSunat, descripcionEstado y ticketSunat de una guía ya insertada.
 */
exports.actualizarEstadoGuiaRepo = async (pool, idGuiaElectronica, idEmpresa, estado) => {
  const idNuevo = estado.idEstadoSunat != null ? Number(estado.idEstadoSunat) : null;
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const prevR = await transaction
      .request()
      .input("idGuiaElectronica", sql.UniqueIdentifier, idGuiaElectronica)
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT idEstadoSunat FROM GuiasElectronicasEmitidas
        WHERE idGuiaElectronica = @idGuiaElectronica AND idEmpresa = @idEmpresa
      `);
    const idAnterior = prevR.recordset && prevR.recordset[0] != null ? prevR.recordset[0].idEstadoSunat : null;

    await transaction
      .request()
      .input("idGuiaElectronica", sql.UniqueIdentifier, idGuiaElectronica)
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .input("idEstadoSunat", sql.Int, estado.idEstadoSunat ?? null)
      .input("descripcionEstado", sql.VarChar(200), estado.descripcionEstado ?? null)
      .input("ticketSunat", sql.VarChar(100), estado.ticketSunat ?? null)
      .query(`
        UPDATE GuiasElectronicasEmitidas
        SET idEstadoSunat = @idEstadoSunat,
            descripcionEstado = @descripcionEstado,
            ticketSunat = @ticketSunat
        WHERE idGuiaElectronica = @idGuiaElectronica AND idEmpresa = @idEmpresa
      `);

    await saasContadorComprobantesSunatService.registrarTransicionGuiaElectronica(
      transaction,
      idEmpresa,
      idAnterior,
      idNuevo
    );

    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
};

/**
 * Guarda el XML UBL firmado enviado a SUNAT (columna xmlFirmado). Requiere migración add_guias_emitidas_xml_firmado.sql.
 */
exports.guardarXmlFirmadoGuiaRepo = async (pool, idGuiaElectronica, idEmpresa, xmlFirmado) => {
  await pool
    .request()
    .input("idGuiaElectronica", sql.UniqueIdentifier, idGuiaElectronica)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("xmlFirmado", sql.NVarChar(sql.MAX), xmlFirmado ?? null)
    .query(`
      UPDATE GuiasElectronicasEmitidas
      SET xmlFirmado = @xmlFirmado
      WHERE idGuiaElectronica = @idGuiaElectronica AND idEmpresa = @idEmpresa
    `);
};

/**
 * Obtiene una guía por id, incluyendo datosGuia JSON si existe.
 */
exports.obtenerGuiaPorIdRepo = async (pool, idGuiaElectronica, idEmpresa) => {
  const r = await pool
    .request()
    .input("idGuiaElectronica", sql.UniqueIdentifier, idGuiaElectronica)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        g.idGuiaElectronica,
        g.tipoDocumento,
        g.tipoRol,
        g.serie,
        g.numero,
        CONVERT(VARCHAR(19), g.fechaEmision, 120) AS fechaEmision,
        g.idEstadoSunat,
        g.descripcionEstado,
        g.ticketSunat,
        g.comprobanteOrigenSerie,
        g.comprobanteOrigenNumero,
        g.motivoTraslado,
        CONVERT(VARCHAR(19), g.fechaCreacion, 120) AS fechaCreacion,
        g.datosGuia,
        g.xmlFirmado
      FROM GuiasElectronicasEmitidas g
      WHERE g.idGuiaElectronica = @idGuiaElectronica AND g.idEmpresa = @idEmpresa
    `);
  const row = r.recordset?.[0];
  if (!row) return null;
  if (row.datosGuia && typeof row.datosGuia === "string") {
    try { row.datosGuia = JSON.parse(row.datosGuia); } catch { row.datosGuia = null; }
  }
  return row;
};

/**
 * Elimina una guía. Solo permite eliminar guías pendientes (idEstadoSunat IS NULL o PENDIENTE/ERROR).
 */
exports.eliminarGuiaRepo = async (pool, idGuiaElectronica, idEmpresa) => {
  await pool
    .request()
    .input("idGuiaElectronica", sql.UniqueIdentifier, idGuiaElectronica)
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .query(`
      DELETE FROM GuiasElectronicasEmitidas
      WHERE idGuiaElectronica = @idGuiaElectronica
        AND idEmpresa = @idEmpresa
        AND ISNULL(idEstadoSunat, 0) <> 1
    `);
};

/**
 * Lista guías EN_PROCESO (idEstadoSunat = 2) que tienen ticket pendiente.
 * Usada por guiasTicket.job para polling automático.
 */
exports.listarGuiasPendientesTicketRepo = async (pool) => {
  const r = await pool.request().query(`
    SELECT TOP 50
      g.idGuiaElectronica,
      g.idEmpresa,
      g.serie,
      g.numero,
      g.ticketSunat,
      c.urlBaseApiGuias,
      c.idApiGuias,
      c.claveApiGuias,
      ISNULL(NULLIF(LTRIM(RTRIM(c.rucApiGuias)), ''), e.ruc) AS ruc
    FROM GuiasElectronicasEmitidas g
    INNER JOIN ConfiguracionFacturacionElectronica c ON c.idEmpresa = g.idEmpresa
    INNER JOIN Empresas e ON e.idEmpresa = g.idEmpresa
    WHERE g.idEstadoSunat = 2
      AND g.ticketSunat IS NOT NULL AND g.ticketSunat != ''
      AND ISNULL(c.urlBaseApiGuias, '') != ''
      AND ISNULL(c.idApiGuias,      '') != ''
      AND ISNULL(c.claveApiGuias,   '') != ''
    ORDER BY g.fechaCreacion ASC
  `);
  return r.recordset || [];
};

/**
 * Lista guías electrónicas emitidas por empresa con paginación.
 * @param {import('mssql').ConnectionPool} pool
 * @param {string} idEmpresa UUID
 * @param {{ pagina?: number, porPagina?: number }} opts
 * @returns {Promise<{ items: object[], total: number }>}
 */
exports.listarGuiasEmitidasPaginadoRepo = async (pool, idEmpresa, opts = {}) => {
  const pagina = Math.max(1, parseInt(String(opts.pagina || 1), 10) || 1);
  const porPagina = Math.min(100, Math.max(1, parseInt(String(opts.porPagina || 10), 10) || 10));
  const offset = (pagina - 1) * porPagina;

  const reqCount = pool.request().input("idEmpresa", sql.UniqueIdentifier, idEmpresa);
  const countR = await reqCount.query(`
    SELECT COUNT(*) AS total
    FROM GuiasElectronicasEmitidas
    WHERE idEmpresa = @idEmpresa
  `);
  const total = countR.recordset?.[0]?.total ?? 0;

  const req = pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
    .input("offset", sql.Int, offset)
    .input("limite", sql.Int, porPagina);

  const result = await req.query(`
    SELECT
      g.idGuiaElectronica,
      g.tipoDocumento,
      g.tipoRol,
      g.serie,
      g.numero,
      CONVERT(VARCHAR(19), g.fechaEmision, 120) AS fechaEmision,
      g.idEstadoSunat,
      g.descripcionEstado,
      g.ticketSunat,
      g.comprobanteOrigenSerie,
      g.comprobanteOrigenNumero,
      g.motivoTraslado,
      CONVERT(VARCHAR(19), g.fechaCreacion, 120) AS fechaCreacion
    FROM GuiasElectronicasEmitidas g
    WHERE g.idEmpresa = @idEmpresa
    ORDER BY g.fechaEmision DESC, g.fechaCreacion DESC
    OFFSET @offset ROWS FETCH NEXT @limite ROWS ONLY
  `);

  return { items: result.recordset || [], total: Number(total) || 0 };
};
