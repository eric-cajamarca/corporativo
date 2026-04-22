const sql = require('mssql');

/** Sucursal principal: primera activa por fecha de registro (misma regla que asignación de usuario). */
async function obtenerIdSucursalPrincipal(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1 idSucursal
      FROM dbo.Sucursal
      WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1
      ORDER BY fRegistro ASC
    `);
  return r.recordset?.[0]?.idSucursal ?? null;
}

/** Catálogo global Presentacion (código SUNAT ej. NIU). */
async function obtenerIdPresentacionPorCodigo(pool, codigo) {
  const c = String(codigo || '')
    .trim()
    .toUpperCase();
  if (!c) return null;
  const r = await pool
    .request()
    .input('codigo', sql.VarChar(10), c)
    .query(`
      SELECT TOP 1 idPresentacion
      FROM dbo.Presentacion
      WHERE UPPER(LTRIM(RTRIM(codigo))) = @codigo
    `);
  return r.recordset?.[0]?.idPresentacion != null ? Number(r.recordset[0].idPresentacion) : null;
}

/**
 * Categoría por nombre o alias VARIOS (vacío = VARIOS).
 * Coincidencia: exacta insensible, o nombre que contenga VARIOS.
 */
async function obtenerIdCategoriaPorAlias(pool, idEmpresa, aliasRaw) {
  const raw = String(aliasRaw || '')
    .trim()
    .toUpperCase();
  const alias = raw === '' ? 'VARIOS' : raw;
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('alias', sql.NVarChar(80), alias)
    .query(`
      SELECT TOP 1 idCategoria
      FROM dbo.Categorias
      WHERE idEmpresa = @idEmpresa
        AND (
          UPPER(LTRIM(RTRIM(nombre))) = @alias
          OR (@alias = N'VARIOS' AND UPPER(LTRIM(RTRIM(nombre))) LIKE N'%VARIO%')
        )
      ORDER BY CASE WHEN UPPER(LTRIM(RTRIM(nombre))) = @alias THEN 0 ELSE 1 END
    `);
  return r.recordset?.[0]?.idCategoria != null ? Number(r.recordset[0].idCategoria) : null;
}

/**
 * Marca: vacío o SM / SIN MARCA → busca marca genérica; si no, coincidencia exacta por nombre.
 */
async function obtenerIdMarcaPorAlias(pool, idEmpresa, aliasRaw) {
  let norm = String(aliasRaw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  if (!norm || norm === 'SINMARCA' || norm === 'SIN MARCA' || norm === 'SM') {
    norm = 'SM';
  }
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('norm', sql.NVarChar(80), norm)
    .query(`
      SELECT TOP 1 idMarca
      FROM dbo.Marcas
      WHERE idEmpresa = @idEmpresa
        AND (
          (@norm = N'SM' AND (
            UPPER(LTRIM(RTRIM(nombre))) IN (N'SM', N'SIN MARCA', N'SINMARCA')
            OR UPPER(LTRIM(RTRIM(nombre))) LIKE N'%SIN%MARCA%'
          ))
          OR (@norm <> N'SM' AND UPPER(LTRIM(RTRIM(nombre))) = @norm)
        )
      ORDER BY CASE WHEN UPPER(LTRIM(RTRIM(nombre))) = @norm THEN 0 ELSE 1 END
    `);
  return r.recordset?.[0]?.idMarca != null ? Number(r.recordset[0].idMarca) : null;
}

async function existeCodigoProducto(pool, idEmpresa, codigo) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('Codigo', sql.VarChar(50), String(codigo || '').trim())
    .query(`
      SELECT COUNT(1) AS n
      FROM dbo.Productos
      WHERE idEmpresa = @idEmpresa AND RTRIM(LTRIM(Codigo)) = @Codigo
    `);
  return Number(r.recordset?.[0]?.n || 0) > 0;
}

module.exports = {
  obtenerIdSucursalPrincipal,
  obtenerIdPresentacionPorCodigo,
  obtenerIdCategoriaPorAlias,
  obtenerIdMarcaPorAlias,
  existeCodigoProducto
};
