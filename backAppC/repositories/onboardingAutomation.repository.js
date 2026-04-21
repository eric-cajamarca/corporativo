const sql = require('mssql');

async function listarEmpresasParaOnboarding(pool) {
  const r = await pool.request().query(`
    SELECT
      s.idEmpresa,
      s.planCode,
      s.estado AS estadoSuscripcion,
      CONVERT(VARCHAR(19), s.fechaInicio, 120) AS fechaInicioSuscripcion,
      e.razon_Social AS razonSocial,
      e.correo AS correoEmpresa,
      ISNULL((
        SELECT TOP 1 u.email
        FROM dbo.UsuarioWeb u
        WHERE u.idEmpresa = s.idEmpresa
          AND ISNULL(u.estado, 1) = 1
          AND ISNULL(LTRIM(RTRIM(u.email)), '') <> ''
        ORDER BY u.fRegistro ASC
      ), '') AS correoUsuario,
      ISNULL((
        SELECT COUNT(1)
        FROM dbo.ConfiguracionFacturacionElectronica c
        INNER JOIN dbo.Empresas e ON e.idEmpresa = c.idEmpresa
        WHERE c.idEmpresa = s.idEmpresa
          AND ISNULL(LTRIM(RTRIM(e.ruc)), '') <> ''
          AND ISNULL(LTRIM(RTRIM(c.usuarioSunat)), '') <> ''
          AND ISNULL(LTRIM(RTRIM(c.claveSunat)), '') <> ''
      ), 0) AS tieneConfigSunat,
      ISNULL((
        SELECT COUNT(1)
        FROM dbo.ComprobantesElectronicos ce
        WHERE ce.idEmpresa = s.idEmpresa
          AND (
            ce.idEstadoSunat IN (1, 3)
            OR EXISTS (
              SELECT 1
              FROM dbo.EstadosSunat es
              WHERE es.idEstadoSunat = ce.idEstadoSunat
                AND es.codigo = '08'
            )
          )
      ), 0) AS comprobantesAceptados,
      (
        SELECT MIN(ce.fechaRespuesta)
        FROM dbo.ComprobantesElectronicos ce
        WHERE ce.idEmpresa = s.idEmpresa
          AND (
            ce.idEstadoSunat IN (1, 3)
            OR EXISTS (
              SELECT 1
              FROM dbo.EstadosSunat es
              WHERE es.idEstadoSunat = ce.idEstadoSunat
                AND es.codigo = '08'
            )
          )
      ) AS fechaPrimerComprobante
    FROM dbo.EmpresaSuscripcion s
    INNER JOIN dbo.Empresas e ON e.idEmpresa = s.idEmpresa
    WHERE s.estado IN ('DEMO', 'ACTIVA', 'PENDIENTE_PAGO')
  `);
  return r.recordset || [];
}

async function contarEventoReciente(pool, idEmpresa, tipoEvento, horas) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('tipoEvento', sql.VarChar(40), tipoEvento)
    .input('horas', sql.Int, horas)
    .query(`
      SELECT COUNT(1) AS total
      FROM dbo.OnboardingAutomationLog
      WHERE idEmpresa = @idEmpresa
        AND tipoEvento = @tipoEvento
        AND fechaEnvio >= DATEADD(HOUR, -@horas, GETDATE())
    `);
  return Number(r.recordset[0]?.total || 0);
}

async function registrarEvento(pool, row) {
  await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, row.idEmpresa)
    .input('tipoEvento', sql.VarChar(40), row.tipoEvento)
    .input('canal', sql.VarChar(20), row.canal || 'EMAIL')
    .input('destinatario', sql.VarChar(200), row.destinatario || null)
    .input('asunto', sql.NVarChar(250), row.asunto || null)
    .input('detalle', sql.NVarChar(1000), row.detalle || null)
    .input('metadataJson', sql.NVarChar(sql.MAX), row.metadataJson || null)
    .query(`
      INSERT INTO dbo.OnboardingAutomationLog (
        idEmpresa, tipoEvento, canal, destinatario, asunto, detalle, metadataJson
      ) VALUES (
        @idEmpresa, @tipoEvento, @canal, @destinatario, @asunto, @detalle, @metadataJson
      )
    `);
}

module.exports = {
  listarEmpresasParaOnboarding,
  contarEventoReciente,
  registrarEvento
};

