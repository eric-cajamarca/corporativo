const sql = require('mssql');
const { idSucursalComprobantesEfectiva } = require('../utils/sucursalComprobantes.util');

const ALIAS_TABLA = /^[A-Za-z0-9]+$/;

/**
 * Fila de catálogo Comprobantes por código (ej. RA = comunicación de baja) para correlativo / serie.
 * @param {import('mssql').ConnectionPool} pool
 * @param {string} idEmpresa
 * @param {string} codigo
 * @param {string|null} [idSucursalOperativa] - si viene, filtra por sucursal efectiva (respeta idSucursalSeriesPadre)
 */
async function obtenerComprobantePorCodigoRepo(pool, idEmpresa, codigo, idSucursalOperativa = null) {
  const c = String(codigo || '')
    .trim()
    .slice(0, 10);
  if (!c) return null;
  if (idSucursalOperativa) {
    const idSuc = await idSucursalComprobantesEfectiva(pool, idSucursalOperativa);
    const result = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('codigo', sql.VarChar(10), c)
      .input('idSucursal', sql.UniqueIdentifier, idSuc)
      .query(
        `SELECT TOP 1 idComprobante, idEmpresa, idSucursal, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra
         FROM Comprobantes
         WHERE idEmpresa = @idEmpresa AND idSucursal = @idSucursal AND LTRIM(RTRIM(codigo)) = @codigo`
      );
    return result.recordset && result.recordset[0] ? result.recordset[0] : null;
  }
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('codigo', sql.VarChar(10), c)
    .query(
      `SELECT TOP 1 c.idComprobante, c.idEmpresa, c.idSucursal, c.codigo, c.nombre, c.serie, c.numero, c.activo, c.usarEnVenta, c.usarEnCompra
       FROM Comprobantes c
       INNER JOIN Sucursal s ON s.idSucursal = c.idSucursal AND s.idEmpresa = c.idEmpresa
       WHERE c.idEmpresa = @idEmpresa AND LTRIM(RTRIM(c.codigo)) = @codigo
       ORDER BY CASE WHEN ISNULL(s.esPrincipal, 0) = 1 THEN 0 ELSE 1 END, s.fRegistro ASC, c.idComprobante ASC`
    );
  return result.recordset && result.recordset[0] ? result.recordset[0] : null;
}

/**
 * @param {string|null} [idSucursalOperativa] - sucursal de trabajo; si null, usa sucursal principal de la empresa
 */
async function listarPorEmpresaYuso(pool, idEmpresa, uso, idSucursalOperativa = null) {
  let idSucFilt = idSucursalOperativa;
  if (!idSucFilt) {
    const r = await pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT TOP 1 idSucursal
        FROM Sucursal
        WHERE idEmpresa = @idEmpresa
        ORDER BY CASE WHEN ISNULL(esPrincipal, 0) = 1 THEN 0 ELSE 1 END, fRegistro ASC
      `);
    idSucFilt = r.recordset?.[0]?.idSucursal;
  }
  const idSuc = idSucFilt ? await idSucursalComprobantesEfectiva(pool, idSucFilt) : null;
  let sqlText =
    'SELECT idComprobante, idEmpresa, idSucursal, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra FROM Comprobantes WHERE idEmpresa = @idEmpresa';
  if (idSuc) {
    sqlText += ' AND idSucursal = @idSucursal';
  }
  if (uso === 'venta') {
    sqlText += ' AND usarEnVenta = 1';
  } else if (uso === 'compra') {
    sqlText += ' AND usarEnCompra = 1';
  }
  sqlText += ' ORDER BY codigo';
  const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  if (idSuc) req.input('idSucursal', sql.UniqueIdentifier, idSuc);
  const result = await req.query(sqlText);
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
    idSucursal,
    codigo,
    nombre,
    serie,
    numero,
    usarEnVenta,
    usarEnCompra
  } = payload;
  if (!idSucursal) {
    throw new Error('idSucursal es requerido para crear comprobante');
  }
  const result = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .input('codigo', sql.VarChar(2), codigo)
    .input('nombre', sql.VarChar(50), nombre)
    .input('serie', sql.VarChar(4), serie)
    .input('numero', sql.Int, numero)
    .input('usarEnVenta', sql.Bit, usarEnVenta)
    .input('usarEnCompra', sql.Bit, usarEnCompra)
    .query(
      `INSERT INTO Comprobantes (idEmpresa, idSucursal, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra)
       VALUES (@idEmpresa, @idSucursal, @codigo, @nombre, @serie, @numero, 1, @usarEnVenta, @usarEnCompra);
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

/**
 * Obtiene comprobante por id y empresa (compat inventario).
 * Devuelve objeto con forma { recordset: [...] } para compatibilidad.
 */
async function obtenerComprobantePorIdEmpresa(conn, idEmpresa, idComprobante) {
  const result = await conn
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idComprobante', sql.Int, idComprobante)
    .query(`
      SELECT TOP 1 idComprobante, idEmpresa, idSucursal, codigo, nombre, serie, numero, activo, usarEnVenta, usarEnCompra
      FROM Comprobantes
      WHERE idEmpresa = @idEmpresa AND idComprobante = @idComprobante
    `);
  return result;
}

/**
 * Actualiza correlativo del comprobante (compat inventario/cotizaciones/ventas).
 */
async function actualizarNumeroComprobante(conn, idEmpresa, idComprobante, numeroUsado) {
  const num = parseInt(String(numeroUsado || '0').replace(/^0+/, '') || '0', 10);
  if (Number.isNaN(num) || num < 0) return;
  await conn
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idComprobante', sql.Int, idComprobante)
    .input('numero', sql.Int, num)
    .query(`
      UPDATE Comprobantes
      SET numero = @numero
      WHERE idEmpresa = @idEmpresa AND idComprobante = @idComprobante
    `);
}

module.exports = {
  obtenerComprobantePorCodigoRepo,
  obtenerComprobantePorIdEmpresa,
  actualizarNumeroComprobante,
  listarPorEmpresaYuso,
  listarPorTablaAlias,
  insertar,
  actualizar
};
