const sql = require('mssql');

const ALIAS_TABLA = /^[A-Za-z0-9]+$/;

/**
 * Fila de catálogo Comprobantes por código (ej. RA = comunicación de baja) para correlativo / serie.
 */
async function obtenerComprobantePorCodigoRepo(pool, idEmpresa, codigo) {
  const c = String(codigo || '')
    .trim()
    .slice(0, 10);
  if (!c) return null;
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('codigo', sql.VarChar(10), c)
    .query(
      `SELECT TOP 1 idComprobante, idEmpresa, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra
       FROM Comprobantes
       WHERE idEmpresa = @idEmpresa AND LTRIM(RTRIM(codigo)) = @codigo`
    );
  return result.recordset && result.recordset[0] ? result.recordset[0] : null;
}

async function listarPorEmpresaYuso(pool, idEmpresa, uso) {
  let sqlText =
    'SELECT idComprobante, idEmpresa, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra FROM Comprobantes WHERE idEmpresa = @idEmpresa';
  if (uso === 'venta') {
    sqlText += ' AND usarEnVenta = 1';
  } else if (uso === 'compra') {
    sqlText += ' AND usarEnCompra = 1';
  }
  sqlText += ' ORDER BY codigo';
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(sqlText);
  return result.recordset;
}

async function listarPorTablaAlias(pool, alias) {
  const a = String(alias || '').trim();
  if (!ALIAS_TABLA.test(a) || a.length > 40) {
    throw new Error('ALIAS_INVALIDO');
  }
  const result = await pool.request().query(`SELECT * FROM Comprobantes${a} WHERE id = 15`);
  return result.recordset;
}

async function insertar(pool, payload) {
  const {
    idEmpresa,
    codigo,
    nombre,
    serie,
    numero,
    usarEnVenta,
    usarEnCompra
  } = payload;
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('codigo', sql.VarChar(2), codigo)
    .input('nombre', sql.VarChar(50), nombre)
    .input('serie', sql.VarChar(4), serie)
    .input('numero', sql.Int, numero)
    .input('usarEnVenta', sql.Bit, usarEnVenta)
    .input('usarEnCompra', sql.Bit, usarEnCompra)
    .query(
      `INSERT INTO Comprobantes (idEmpresa, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra)
       VALUES (@idEmpresa, @codigo, @nombre, @serie, @numero, 1, @usarEnVenta, @usarEnCompra);
       SELECT SCOPE_IDENTITY() AS idComprobante;`
    );
  const idNew =
    result.recordset && result.recordset[0] ? result.recordset[0].idComprobante : null;
  return idNew;
}

async function actualizar(pool, idEmpresa, idComprobante, updates) {
  const request = pool
    .request()
    .input('idComprobante', sql.Int, idComprobante)
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  const parts = [];
  if (updates.serie !== undefined) {
    parts.push('serie = @serie');
    request.input('serie', sql.VarChar(4), updates.serie);
  }
  if (updates.numero !== undefined) {
    parts.push('numero = @numero');
    request.input('numero', sql.Int, updates.numero);
  }
  if (updates.usarEnVenta !== undefined) {
    parts.push('usarEnVenta = @usarEnVenta');
    request.input('usarEnVenta', sql.Bit, updates.usarEnVenta);
  }
  if (updates.usarEnCompra !== undefined) {
    parts.push('usarEnCompra = @usarEnCompra');
    request.input('usarEnCompra', sql.Bit, updates.usarEnCompra);
  }
  if (parts.length === 0) {
    throw new Error('SIN_CAMPOS');
  }
  const sqlText = `UPDATE Comprobantes SET ${parts.join(', ')} WHERE idComprobante = @idComprobante AND idEmpresa = @idEmpresa`;
  const result = await request.query(sqlText);
  return result.rowsAffected[0];
}

module.exports = {
  obtenerComprobantePorCodigoRepo,
  listarPorEmpresaYuso,
  listarPorTablaAlias,
  insertar,
  actualizar
};
