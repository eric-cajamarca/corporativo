const sql = require('mssql');

/** Comprobantes electrónicos pendientes de envío SUNAT (estado 7). */
exports.contarComprobantesPendienteEnvioRepo = async (pool, idEmpresa) => {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) AS n
      FROM dbo.ComprobantesElectronicos ce
      WHERE ce.idEmpresa = @idEmpresa
        AND ce.idEstadoSunat = 7
        AND ce.tipoComprobante IN ('01', '03', '07', '08')
    `);
  return r.recordset && r.recordset[0] ? Number(r.recordset[0].n) || 0 : 0;
};

/**
 * Comprobantes con respuesta SUNAT distinta de aceptado/observado/pendiente envío.
 * Excluye NULL (borrador sin envío) para no confundir con pendiente.
 */
exports.contarComprobantesSunatNoOkRepo = async (pool, idEmpresa) => {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT COUNT(*) AS n
      FROM dbo.ComprobantesElectronicos ce
      WHERE ce.idEmpresa = @idEmpresa
        AND ce.idEstadoSunat IS NOT NULL
        AND ce.idEstadoSunat NOT IN (1, 2, 3, 7)
        AND ce.tipoComprobante IN ('01', '03', '07', '08')
    `);
  return r.recordset && r.recordset[0] ? Number(r.recordset[0].n) || 0 : 0;
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
        AND cu.estado IN ('PENDIENTE', 'VENCIDO')
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
        AND cu.estado IN ('PENDIENTE', 'VENCIDO')
        AND ISNULL(cu.saldoPendiente, 0) > 0.01
        AND (cr.idVenta IS NULL OR ISNULL(v.eliminado, 0) = 0)
        AND CONVERT(DATE, cu.fechaVencimiento) < CONVERT(DATE, GETDATE())
    `);
  return r.recordset && r.recordset[0] ? Number(r.recordset[0].n) || 0 : 0;
};
