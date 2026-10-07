const sql = require('mssql');

/** Comprobantes electrónicos pendientes de envío SUNAT (estado 7). Excluye ventas anuladas. */
exports.contarComprobantesPendienteEnvioRepo = async (pool, idEmpresa) => {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) AS n
      FROM dbo.ComprobantesElectronicos ce
      INNER JOIN dbo.Ventas v ON v.idVenta = ce.idVenta AND v.idEmpresa = ce.idEmpresa
      WHERE ce.idEmpresa = @idEmpresa
        AND ce.idEstadoSunat = 7
        AND ce.tipoComprobante IN ('01', '03', '07', '08')
        AND ISNULL(v.eliminado, 0) = 0
    `);
  return r.recordset && r.recordset[0] ? Number(r.recordset[0].n) || 0 : 0;
};

/**
 * Comprobantes que requieren acción: rechazado (4) o error de envío (6).
 * No incluye aceptados, pendiente de envío, ni baja/anulación SUNAT (código 08).
 */
exports.contarComprobantesSunatNoOkRepo = async (pool, idEmpresa) => {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) AS n
      FROM dbo.ComprobantesElectronicos ce
      INNER JOIN dbo.Ventas v ON v.idVenta = ce.idVenta AND v.idEmpresa = ce.idEmpresa
      LEFT JOIN dbo.EstadosSunat es ON es.idEstadoSunat = ce.idEstadoSunat
      WHERE ce.idEmpresa = @idEmpresa
        AND ce.tipoComprobante IN ('01', '03', '07', '08')
        AND ISNULL(v.eliminado, 0) = 0
        AND ISNULL(es.codigo, '') <> '08'
        AND ce.idEstadoSunat IN (4, 6)
    `);
  return r.recordset && r.recordset[0] ? Number(r.recordset[0].n) || 0 : 0;
};

/**
 * Detecta falta de certificado o canal de envío SUNAT en la configuración de la empresa.
 * @returns {Promise<null|{faltaCertificado: boolean, faltaCanalEnvio: boolean}>}
 */
exports.obtenerAlertaConfigFacturacionRepo = async (pool, idEmpresa) => {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        ISNULL(c.envioDirectoSunat, 0) AS envioDirectoSunat,
        CASE WHEN c.certificadoDigital IS NOT NULL AND LEN(LTRIM(RTRIM(ISNULL(c.certificadoDigital, '')))) > 20 THEN 1 ELSE 0 END AS tieneCertificado,
        CASE WHEN c.claveCertificado IS NOT NULL AND LEN(LTRIM(RTRIM(ISNULL(c.claveCertificado, '')))) > 0 THEN 1 ELSE 0 END AS tieneClaveCertificado,
        CASE WHEN c.usuarioSunat IS NOT NULL AND LTRIM(RTRIM(c.usuarioSunat)) <> '' THEN 1 ELSE 0 END AS tieneUsuarioSunat,
        CASE WHEN c.claveSunat IS NOT NULL AND LTRIM(RTRIM(c.claveSunat)) <> '' THEN 1 ELSE 0 END AS tieneClaveSunat,
        CASE WHEN c.urlEnvio IS NOT NULL AND LTRIM(RTRIM(c.urlEnvio)) <> '' THEN 1 ELSE 0 END AS tieneUrlEnvio
      FROM dbo.ConfiguracionFacturacionElectronica c
      WHERE c.idEmpresa = @idEmpresa
    `);
  const row = r.recordset && r.recordset[0];
  if (!row) return null;
  const envioDirecto = row.envioDirectoSunat === true || row.envioDirectoSunat === 1 || String(row.envioDirectoSunat || '').trim() === '1';
  const canalDirecto = envioDirecto && Number(row.tieneUsuarioSunat) === 1 && Number(row.tieneClaveSunat) === 1 && Number(row.tieneUrlEnvio) === 1;
  const faltaCanalEnvio = !canalDirecto;
  const faltaCertificado =
    canalDirecto && (Number(row.tieneCertificado) !== 1 || Number(row.tieneClaveCertificado) !== 1);
  if (!faltaCertificado && !faltaCanalEnvio) return null;
  return { faltaCertificado, faltaCanalEnvio };
};

exports.contarCuotasCreditoPorVencerMananaRepo = async (pool, idEmpresa) => {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) AS n
      FROM dbo.CuotasCredito cu
      INNER JOIN dbo.CreditosClientes cr ON cr.idCredito = cu.idCredito AND cr.idEmpresa = cu.idEmpresa
      LEFT JOIN dbo.Ventas v ON v.idVenta = cr.idVenta AND v.idEmpresa = cr.idEmpresa
      WHERE cu.idEmpresa = @idEmpresa
        AND cr.estado = 'ACTIVO'
        AND cu.estado IN ('PENDIENTE', 'VENCIDO', 'PARCIAL')
        AND ISNULL(cu.saldoPendiente, 0) > 0.01
        AND (cr.idVenta IS NULL OR ISNULL(v.eliminado, 0) = 0)
        AND CONVERT(DATE, cu.fechaVencimiento) = DATEADD(DAY, 1, CONVERT(DATE, GETDATE()))
    `);
  return r.recordset && r.recordset[0] ? Number(r.recordset[0].n) || 0 : 0;
};

exports.contarCuotasCreditoVencidasRepo = async (pool, idEmpresa) => {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) AS n
      FROM dbo.CuotasCredito cu
      INNER JOIN dbo.CreditosClientes cr ON cr.idCredito = cu.idCredito AND cr.idEmpresa = cu.idEmpresa
      LEFT JOIN dbo.Ventas v ON v.idVenta = cr.idVenta AND v.idEmpresa = cr.idEmpresa
      WHERE cu.idEmpresa = @idEmpresa
        AND cr.estado = 'ACTIVO'
        AND cu.estado IN ('PENDIENTE', 'VENCIDO', 'PARCIAL')
        AND ISNULL(cu.saldoPendiente, 0) > 0.01
        AND (cr.idVenta IS NULL OR ISNULL(v.eliminado, 0) = 0)
        AND CONVERT(DATE, cu.fechaVencimiento) < CONVERT(DATE, GETDATE())
    `);
  return r.recordset && r.recordset[0] ? Number(r.recordset[0].n) || 0 : 0;
};
