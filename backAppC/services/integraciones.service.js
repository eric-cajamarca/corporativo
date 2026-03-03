const sql = require('mssql');
const { v4: uuidv4 } = require('uuid');

/**
 * Lee flags de integraciones habilitadas para una empresa.
 */
async function obtenerIntegracionesEmpresa(pool, idEmpresa) {
  const res = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1 * FROM EmpresaIntegraciones WHERE idEmpresa = @idEmpresa
    `);
  return res.recordset[0] || null;
}

/**
 * Obtiene credenciales de un proveedor para una empresa como objeto clave->valor.
 */
async function obtenerCredencialesProveedor(pool, idEmpresa, proveedor) {
  const res = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('proveedor', sql.VarChar(50), proveedor)
    .query(`
      SELECT clave, valor
      FROM EmpresaApiCredenciales
      WHERE idEmpresa = @idEmpresa AND proveedor = @proveedor AND activo = 1
    `);
  const map = {};
  for (const row of res.recordset || []) {
    map[row.clave] = row.valor;
  }
  return map;
}

/**
 * Construye un orderNumber multiempresa para pagos SaaS.
 * Patrón: idEmpresaCliente-UUID.
 */
function construirOrderNumber(idEmpresaCliente) {
  return `${idEmpresaCliente}-${uuidv4()}`;
}

/**
 * Parsea un orderNumber multiempresa (idEmpresa-uuid).
 */
function parsearOrderNumber(orderNumber) {
  if (!orderNumber || typeof orderNumber !== 'string') return null;
  const idx = orderNumber.indexOf('-');
  if (idx <= 0) return null;
  const idEmpresa = orderNumber.substring(0, idx);
  const uuid = orderNumber.substring(idx + 1);
  return { idEmpresa, uuid };
}

module.exports = {
  obtenerIntegracionesEmpresa,
  obtenerCredencialesProveedor,
  construirOrderNumber,
  parsearOrderNumber
};

