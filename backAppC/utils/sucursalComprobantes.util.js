const sql = require('mssql');

/**
 * Sucursal desde la que se leen/actualizan filas Comprobantes (serie/correlativo).
 * Si la sucursal tiene idSucursalSeriesPadre, las series están en la sucursal padre.
 */
async function idSucursalComprobantesEfectiva(poolOrTx, idSucursal) {
  if (!idSucursal) return null;
  const r = await poolOrTx.request()
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .query(`
      SELECT COALESCE(s.idSucursalSeriesPadre, s.idSucursal) AS idSuc
      FROM dbo.Sucursal s
      WHERE s.idSucursal = @idSucursal
    `);
  const idSuc = r.recordset?.[0]?.idSuc;
  return idSuc || idSucursal;
}

/**
 * Resuelve idComprobante del catálogo para la sucursal operativa de la venta.
 * El cliente puede enviar id de otra sucursal; se busca la fila equivalente por codigo en la sucursal efectiva.
 */
async function resolverIdComprobanteParaSucursal(transaction, idEmpresa, idComprobanteSolicitado, idSucursalOperativa) {
  const idSucComp = await idSucursalComprobantesEfectiva(transaction, idSucursalOperativa);
  const r0 = await transaction.request()
    .input('id', sql.Int, idComprobanteSolicitado)
    .input('emp', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT idComprobante, LTRIM(RTRIM(codigo)) AS codigo, idSucursal
      FROM dbo.Comprobantes
      WHERE idComprobante = @id AND idEmpresa = @emp
    `);
  const row0 = r0.recordset?.[0];
  if (!row0) return null;
  if (String(row0.idSucursal).toLowerCase() === String(idSucComp).toLowerCase()) {
    return { idComprobante: row0.idComprobante, codigo: String(row0.codigo || '').trim() };
  }
  const cod = String(row0.codigo || '').trim();
  const r1 = await transaction.request()
    .input('emp', sql.UniqueIdentifier, idEmpresa)
    .input('idSuc', sql.UniqueIdentifier, idSucComp)
    .input('codigo', sql.VarChar(10), cod)
    .query(`
      SELECT TOP 1 idComprobante, LTRIM(RTRIM(codigo)) AS codigo
      FROM dbo.Comprobantes
      WHERE idEmpresa = @emp AND idSucursal = @idSuc AND LTRIM(RTRIM(codigo)) = @codigo
    `);
  const row1 = r1.recordset?.[0];
  if (row1) {
    return { idComprobante: row1.idComprobante, codigo: String(row1.codigo || '').trim() };
  }
  return null;
}

module.exports = {
  idSucursalComprobantesEfectiva,
  resolverIdComprobanteParaSucursal
};
