const sql = require('mssql');

async function contarPorEmpresa(pool, idEmpresa) {
  try {
    const r = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT COUNT(1) AS total,
               CONVERT(VARCHAR(19), MAX(fSync), 120) AS ultimaSync
        FROM WhatsAppBotCatalogoIndice WHERE idEmpresa = @idEmpresa
      `);
    return r.recordset[0] || { total: 0, ultimaSync: null };
  } catch (e) {
    if (e && e.number === 208) return { total: 0, ultimaSync: null };
    throw e;
  }
}

async function reemplazarCatalogo(pool, idEmpresa, filas) {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx)
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query('DELETE FROM WhatsAppBotCatalogoIndice WHERE idEmpresa = @idEmpresa');

    for (const f of filas) {
      await new sql.Request(tx)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .input('idProducto', sql.UniqueIdentifier, f.idProducto)
        .input('codigo', sql.VarChar(50), f.codigo)
        .input('descripcion', sql.NVarChar(300), f.descripcion)
        .input('textoBusqueda', sql.NVarChar(2000), f.textoBusqueda)
        .input('precioLista', sql.Decimal(18, 6), f.precioLista)
        .input('stockTotal', sql.Decimal(18, 6), f.stockTotal)
        .query(`
          INSERT INTO WhatsAppBotCatalogoIndice
            (idEmpresa, idProducto, codigo, descripcion, textoBusqueda, precioLista, stockTotal)
          VALUES (@idEmpresa, @idProducto, @codigo, @descripcion, @textoBusqueda, @precioLista, @stockTotal)
        `);
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

async function obtenerFilasSync(pool, idEmpresa) {
  const r = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        p.idProducto,
        p.codigo,
        p.descripcion,
        ISNULL(m.nombre, '') AS marca,
        ISNULL(c.nombre, '') AS categoria,
        ISNULL(pp.precio, 0) AS precioLista,
        ISNULL(st.stockTotal, 0) AS stockTotal
      FROM Productos p
      INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
      INNER JOIN Marcas m ON p.idMarca = m.idMarca
      LEFT JOIN (
        SELECT l.idProducto, SUM(CONVERT(DECIMAL(18,6), ISNULL(l.cantidadDisponible, 0))) AS stockTotal
        FROM Lotes l
        WHERE l.idEmpresa = @idEmpresa AND ISNULL(l.cantidadDisponible, 0) > 0
        GROUP BY l.idProducto
      ) st ON st.idProducto = p.idProducto
      OUTER APPLY (
        SELECT TOP 1 pp.precio
        FROM PreciosProducto pp
        INNER JOIN ListasPrecio lp ON pp.idLista = lp.idLista
        WHERE pp.idProducto = p.idProducto AND lp.idEmpresa = @idEmpresa AND lp.activo = 1
        ORDER BY CASE WHEN lp.principal = 1 THEN 0 ELSE 1 END, pp.fActualizacion DESC
      ) pp
      WHERE p.idEmpresa = @idEmpresa AND ISNULL(p.estado, 1) = 1
    `);
  return r.recordset || [];
}

async function buscarPorTerminos(pool, idEmpresa, terminos, limite = 20) {
  const tokens = (terminos || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 6);
  if (tokens.length === 0) return { total: 0, items: [] };

  const req = pool.request().input('idEmpresa', sql.UniqueIdentifier, idEmpresa);
  const ors = tokens.map((tok, i) => {
    const p = `t${i}`;
    req.input(p, sql.NVarChar(120), `%${tok.replace(/[%_[\]]/g, '')}%`);
    return `textoBusqueda LIKE @${p}`;
  });

  const r = await req.query(`
    SELECT idProducto, codigo, descripcion, precioLista, stockTotal, textoBusqueda
    FROM WhatsAppBotCatalogoIndice
    WHERE idEmpresa = @idEmpresa AND (${ors.join(' OR ')})
    ORDER BY descripcion
  `);
  const items = r.recordset || [];
  return { total: items.length, items: items.slice(0, limite) };
}

async function listarTodos(pool, idEmpresa) {
  try {
    const r = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT idProducto, codigo, descripcion, precioLista, stockTotal, textoBusqueda
        FROM WhatsAppBotCatalogoIndice WHERE idEmpresa = @idEmpresa
      `);
    return r.recordset || [];
  } catch (e) {
    if (e && e.number === 208) return [];
    throw e;
  }
}

module.exports = {
  contarPorEmpresa,
  reemplazarCatalogo,
  obtenerFilasSync,
  buscarPorTerminos,
  listarTodos
};
