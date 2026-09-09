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
