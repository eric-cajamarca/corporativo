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

/**
 * Obtiene listas activas por nombre para importación de precios.
 * Se buscan las listas operativas: normal, cliente y mayorista.
 */
async function obtenerListasPrecioBaseImportacion(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT idLista, idMoneda, nombre, ISNULL(principal, 0) AS principal
      FROM dbo.ListasPrecio
      WHERE idEmpresa = @idEmpresa
        AND ISNULL(activo, 1) = 1
    `);
  return r.recordset || [];
}

async function obtenerPresentacionesCatalogo(pool) {
  const r = await pool
    .request()
    .query(`
      SELECT idPresentacion, codigo
      FROM dbo.Presentacion
    `);
  return r.recordset || [];
}

async function obtenerCategoriasCatalogo(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT idCategoria, nombre
      FROM dbo.Categorias
      WHERE idEmpresa = @idEmpresa
    `);
  return r.recordset || [];
}

async function obtenerMarcasCatalogo(pool, idEmpresa) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT idMarca, nombre
      FROM dbo.Marcas
      WHERE idEmpresa = @idEmpresa
    `);
  return r.recordset || [];
}

function normalizarCodigoKey(value) {
  return String(value || '').trim().toUpperCase();
}

async function obtenerCodigosExistentes(pool, idEmpresa, codigos) {
  const normalizados = Array.from(
    new Set((codigos || []).map((c) => normalizarCodigoKey(c)).filter(Boolean))
  );
  if (normalizados.length === 0) {
    return new Set();
  }

  const existentes = new Set();
  const chunkSize = 500;
  for (let i = 0; i < normalizados.length; i += chunkSize) {
    const chunk = normalizados.slice(i, i + chunkSize);
    const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
    const inList = chunk
      .map((codigo, idx) => {
        const key = `codigo${i + idx}`;
        req.input(key, sql.VarChar(50), codigo);
        return `@${key}`;
      })
      .join(',');
    const r = await req.query(`
      SELECT RTRIM(LTRIM(Codigo)) AS codigo
      FROM dbo.Productos
      WHERE idEmpresa = @idEmpresa
        AND UPPER(RTRIM(LTRIM(Codigo))) IN (${inList})
    `);
    for (const row of r.recordset || []) {
      existentes.add(normalizarCodigoKey(row.codigo));
    }
  }

  return existentes;
}

/** Ubicaciones registradas de la sucursal (para plantilla e importación). */
async function obtenerUbicacionesPorSucursal(pool, idEmpresa, idSucursal) {
  const r = await pool
    .request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('idSucursal', sql.UniqueIdentifier, idSucursal)
    .query(`
      SELECT
        up.idUbicacion,
        up.codigoUbicacion,
        CONVERT(VARCHAR(36), up.idSucursal) AS idSucursal,
        RTRIM(LTRIM(ISNULL(s.nombre, ''))) AS nombreSucursal,
        up.prioridad
      FROM dbo.UbicacionesPrioridad up
      INNER JOIN dbo.Sucursal s ON s.idSucursal = up.idSucursal AND s.idEmpresa = @idEmpresa
      WHERE up.idSucursal = @idSucursal
        AND RTRIM(LTRIM(ISNULL(up.codigoUbicacion, ''))) <> ''
      ORDER BY up.prioridad, up.codigoUbicacion
    `);
  return r.recordset || [];
}

module.exports = {
  obtenerIdSucursalPrincipal,
  obtenerIdPresentacionPorCodigo,
  obtenerIdCategoriaPorAlias,
  obtenerIdMarcaPorAlias,
  existeCodigoProducto,
  obtenerListasPrecioBaseImportacion,
  obtenerPresentacionesCatalogo,
  obtenerCategoriasCatalogo,
  obtenerMarcasCatalogo,
  obtenerCodigosExistentes,
  obtenerUbicacionesPorSucursal
};
