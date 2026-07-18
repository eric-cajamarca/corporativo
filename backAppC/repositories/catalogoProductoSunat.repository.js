const sql = require('mssql');

async function listarAnexos(pool, { anexo, q, limite } = {}) {
  const lim = Math.min(Math.max(parseInt(limite, 10) || 50, 1), 200);
  const req = pool.request().input('limite', sql.Int, lim);
  let where = 'WHERE activo = 1';
  if (anexo && ['25.1', '25.2', '25.3'].includes(String(anexo).trim())) {
    req.input('anexo', sql.VarChar(5), String(anexo).trim());
    where += ' AND anexo = @anexo';
  }
  if (q && String(q).trim()) {
    req.input('q', sql.VarChar(100), `%${String(q).trim()}%`);
    where += ' AND (codigo LIKE @q OR descripcion LIKE @q)';
  }
  const r = await req.query(`
    SELECT TOP (@limite)
      codigo,
      anexo,
      descripcion,
      ISNULL(partidaArancelaria, '') AS partidaArancelaria
    FROM CatProductoSunatAnexo
    ${where}
    ORDER BY anexo, descripcion
  `);
  return r.recordset || [];
}

async function listarTodosActivos(pool) {
  const r = await pool.request().query(`
    SELECT codigo, anexo, descripcion, ISNULL(partidaArancelaria, '') AS partidaArancelaria
    FROM CatProductoSunatAnexo
    WHERE activo = 1
    ORDER BY anexo, descripcion
  `);
  return r.recordset || [];
}

async function existeCodigo(pool, codigo) {
  const c = String(codigo || '').trim();
  if (!/^\d{8}$/.test(c)) return false;
  const r = await pool
    .request()
    .input('codigo', sql.Char(8), c)
    .query(`
      SELECT TOP 1 1 AS ok
      FROM CatProductoSunatAnexo
      WHERE codigo = @codigo AND activo = 1
    `);
  return !!(r.recordset && r.recordset[0]);
}

async function obtenerPorCodigo(pool, codigo) {
  const c = String(codigo || '').trim();
  if (!/^\d{8}$/.test(c)) return [];
  const r = await pool
    .request()
    .input('codigo', sql.Char(8), c)
    .query(`
      SELECT codigo, anexo, descripcion, ISNULL(partidaArancelaria, '') AS partidaArancelaria
      FROM CatProductoSunatAnexo
      WHERE codigo = @codigo AND activo = 1
      ORDER BY anexo
    `);
  return r.recordset || [];
}

module.exports = {
  listarAnexos,
  listarTodosActivos,
  existeCodigo,
  obtenerPorCodigo
};
