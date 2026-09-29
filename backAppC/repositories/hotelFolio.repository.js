const sql = require('mssql');

const CODIGOS_NC = ['F7', 'B7', '07'];
const CODIGOS_ND = ['F8', 'B8', '08'];

async function ventasTieneColumnaEstancia(pool) {
  const r = await pool.request().query(`
    SELECT COL_LENGTH('dbo.Ventas', 'idEstanciaHotel') AS n
  `);
  return Number(r.recordset?.[0]?.n) > 0;
}

async function listarVentasDeEstancia(pool, idEmpresa, idEstancia, idsVentaExtra) {
  const ids = [...new Set((idsVentaExtra || []).filter((id) => Number(id) > 0).map((id) => Number(id)))];
  const tieneCol = await ventasTieneColumnaEstancia(pool);
  const req = pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idEstancia', sql.UniqueIdentifier, idEstancia);

  const extraVenta = [];
  ids.forEach((id, i) => {
    req.input(`vextra${i}`, sql.Int, id);
    extraVenta.push(`@vextra${i}`);
  });
  const orIds = extraVenta.length ? ` OR v.idVenta IN (${extraVenta.join(', ')})` : '';
  const porEstancia = tieneCol ? 'v.idEstanciaHotel = @idEstancia' : '1 = 0';

  const result = await req.query(`
    SELECT v.idVenta, v.compVenta,
           CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
           v.total, v.idEstadoPago, v.compRelacionado,
           UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) AS codigoComprobante,
           ISNULL(ep.descripcion, CASE WHEN v.idEstadoPago = 2 THEN N'Pagado' ELSE N'Pendiente' END) AS estadoPago
    FROM Ventas v
    LEFT JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
    LEFT JOIN EstadoPago ep ON ep.idEstadoPago = v.idEstadoPago
    WHERE v.idEmpresa = @idEmpresa
      AND ISNULL(v.eliminado, 0) = 0
      AND (${porEstancia}${orIds})
    ORDER BY v.fEmision, v.idVenta
  `);
  return result.recordset || [];
}

async function listarNotasDeComprobantes(pool, idEmpresa, comps) {
  const lista = [...new Set((comps || []).map((c) => String(c || '').trim().toUpperCase()).filter(Boolean))];
  if (!lista.length) return [];
  const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  const inClause = lista.map((comp, i) => {
    req.input(`comp${i}`, sql.VarChar(30), comp.slice(0, 30));
    return `@comp${i}`;
  }).join(', ');
  const result = await req.query(`
    SELECT v.idVenta, v.compVenta,
           CONVERT(VARCHAR(19), v.fEmision, 120) AS fEmision,
           v.total, v.idEstadoPago, v.compRelacionado,
           UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) AS codigoComprobante,
           ISNULL(ep.descripcion, CASE WHEN v.idEstadoPago = 2 THEN N'Pagado' ELSE N'Pendiente' END) AS estadoPago
    FROM Ventas v
    INNER JOIN Comprobantes c ON c.idComprobante = v.idComprobante AND c.idEmpresa = v.idEmpresa
    LEFT JOIN EstadoPago ep ON ep.idEstadoPago = v.idEstadoPago
    WHERE v.idEmpresa = @idEmpresa
      AND ISNULL(v.eliminado, 0) = 0
      AND UPPER(LTRIM(RTRIM(ISNULL(c.codigo, '')))) IN ('F7','B7','F8','B8','07','08')
      AND RTRIM(LTRIM(UPPER(ISNULL(v.compRelacionado, '')))) IN (${inClause})
    ORDER BY v.fEmision, v.idVenta
  `);
  return result.recordset || [];
}

function esNotaCredito(codigo) {
  return CODIGOS_NC.includes(String(codigo || '').toUpperCase());
}

function esNotaDebito(codigo) {
  return CODIGOS_ND.includes(String(codigo || '').toUpperCase());
}

module.exports = {
  listarVentasDeEstancia,
  listarNotasDeComprobantes,
  esNotaCredito,
  esNotaDebito
};
