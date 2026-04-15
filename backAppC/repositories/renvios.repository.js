const sql = require('mssql');

async function listarHistorial(pool) {
  const r = await pool.request().query('SELECT * FROM Historialpedidos');
  return r.recordset;
}

async function buscarHistorialPorCodigo(pool, codicion) {
  const r = await pool
    .request()
    .input('codicion', sql.VarChar, codicion)
    .query(
      'SELECT * FROM Historialpedidos WHERE CompEnvio = @codicion OR CompVentas = @codicion OR FEnvio = @codicion'
    );
  return r.recordset;
}

/** Solo letras para sufijo de tabla Comprobantes (evita inyección). */
function sanitizarAliasComprobantes(alias) {
  const s = String(alias || '').trim();
  if (!/^[A-Za-z]+$/.test(s)) return null;
  return s;
}

async function obtenerComprobanteFila15(pool, alias) {
  const safe = sanitizarAliasComprobantes(alias);
  if (!safe) return null;
  const r = await pool.request().query(`SELECT * FROM Comprobantes${safe} WHERE id = 15`);
  return r.recordset;
}

async function existeCompEnvio(pool, compEnvio) {
  const r = await pool
    .request()
    .input('CompEnvio', sql.VarChar, compEnvio)
    .query('SELECT * FROM Historialpedidos WHERE CompEnvio = @CompEnvio');
  return r.recordset;
}

async function insertarHistorialLinea(pool, row) {
  return pool
    .request()
    .input('CompEnvio', sql.VarChar, row.compEnvio)
    .input('CompVentas', sql.VarChar, row.compVentas)
    .input('FEnvio', sql.VarChar, row.fEnvio)
    .input('Descripcion', sql.VarChar, row.descripcion)
    .input('Presentacion', sql.VarChar, row.presentacion)
    .input('Cantidad', sql.Decimal(18, 4), row.cantidad)
    .query(
      'INSERT INTO Historialpedidos (CompEnvio, CompVentas, FEnvio, Descripcion, Presentacion, Cantidad) VALUES (@CompEnvio, @CompVentas, @FEnvio, @Descripcion, @Presentacion, @Cantidad)'
    );
}

async function actualizarNumeroComprobante(pool, alias, numero) {
  const safe = sanitizarAliasComprobantes(alias);
  if (!safe) return null;
  return pool
    .request()
    .input('Numero', sql.Int, numero)
    .query(`UPDATE Comprobantes${safe} SET Numero = @Numero WHERE id = 15`);
}

async function actualizarHistorial(pool, row) {
  return pool
    .request()
    .input('CompEnvio', sql.VarChar, row.compEnvio)
    .input('CompVentas', sql.VarChar, row.compVentas)
    .input('FEnvio', sql.VarChar, row.fEnvio)
    .input('Descripcion', sql.VarChar, row.descripcion)
    .input('Presentacion', sql.VarChar, row.presentacion)
    .input('Cantidad', sql.Decimal(18, 4), row.cantidad)
    .query(
      'UPDATE Historialpedidos SET FEnvio = @FEnvio, Descripcion = @Descripcion, Presentacion = @Presentacion, Cantidad = @Cantidad WHERE CompEnvio = @CompEnvio'
    );
}

async function eliminarPorCompEnvio(pool, codicion) {
  return pool
    .request()
    .input('codicion', sql.VarChar, codicion)
    .query('DELETE FROM Historialpedidos WHERE CompEnvio = @codicion');
}

module.exports = {
  listarHistorial,
  buscarHistorialPorCodigo,
  obtenerComprobanteFila15,
  existeCompEnvio,
  insertarHistorialLinea,
  actualizarNumeroComprobante,
  actualizarHistorial,
  eliminarPorCompEnvio,
  sanitizarAliasComprobantes
};
