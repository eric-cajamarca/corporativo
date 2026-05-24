const sql = require('mssql');

const MESES_VENTAS = 6;

function fechaDesdeVentas() {
  const d = new Date();
  d.setMonth(d.getMonth() - MESES_VENTAS);
  return d.toISOString().slice(0, 10);
}

async function obtenerPerfilEmpresa(pool, idEmpresa) {
  const r = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT
        ISNULL(NULLIF(LTRIM(RTRIM(e.nombreComercial)), ''), LTRIM(RTRIM(e.razon_Social))) AS nombre,
        LTRIM(RTRIM(ISNULL(e.razon_Social, ''))) AS razonSocial,
        LTRIM(RTRIM(ISNULL(e.rubro, ''))) AS rubro,
        LTRIM(RTRIM(ISNULL(e.celular, ''))) AS telefono,
        LTRIM(RTRIM(ISNULL(e.correo, ''))) AS correo,
        LTRIM(RTRIM(ISNULL(e.ruc, ''))) AS ruc,
        LTRIM(RTRIM(ISNULL(de.direccion, ''))) AS direccion,
        LTRIM(RTRIM(ISNULL(de.ubigeo, ''))) AS ubigeo,
        LTRIM(RTRIM(ISNULL(de.distrito, ''))) AS distrito,
        LTRIM(RTRIM(ISNULL(de.provincia, ''))) AS provincia,
        LTRIM(RTRIM(ISNULL(de.region, ''))) AS region
      FROM Empresas e
      LEFT JOIN DireccionEmpresa de ON e.idEmpresa = de.idEmpresa AND de.principal = 1
      WHERE e.idEmpresa = @idEmpresa
    `);
  return r.recordset[0] || null;
}

async function categoriasMasVendidas(pool, idEmpresa, top = 12) {
  const desde = fechaDesdeVentas();
  const r = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('desde', sql.VarChar(10), desde)
    .input('top', sql.Int, Math.min(20, Math.max(1, top)))
    .query(`
      SELECT TOP (@top)
        LTRIM(RTRIM(c.nombre)) AS nombre,
        SUM(ISNULL(dv.cantidad, 0)) AS cantidadVendida
      FROM DetalleVenta dv
      INNER JOIN Ventas v ON dv.idVenta = v.idVenta AND v.idEmpresa = @idEmpresa
      INNER JOIN Productos p ON dv.idProducto = p.idProducto AND p.idEmpresa = @idEmpresa
      INNER JOIN Categorias c ON p.idCategoria = c.idCategoria AND c.idEmpresa = @idEmpresa
      WHERE CONVERT(DATE, v.fEmision) >= @desde
        AND ISNULL(c.estado, 1) = 1
      GROUP BY c.idCategoria, c.nombre
      ORDER BY SUM(ISNULL(dv.cantidad, 0)) DESC
    `);
  return r.recordset || [];
}

async function marcasMasVendidas(pool, idEmpresa, top = 12) {
  const desde = fechaDesdeVentas();
  const r = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('desde', sql.VarChar(10), desde)
    .input('top', sql.Int, Math.min(20, Math.max(1, top)))
    .query(`
      SELECT TOP (@top)
        LTRIM(RTRIM(m.nombre)) AS nombre,
        SUM(ISNULL(dv.cantidad, 0)) AS cantidadVendida
      FROM DetalleVenta dv
      INNER JOIN Ventas v ON dv.idVenta = v.idVenta AND v.idEmpresa = @idEmpresa
      INNER JOIN Productos p ON dv.idProducto = p.idProducto AND p.idEmpresa = @idEmpresa
      INNER JOIN Marcas m ON p.idMarca = m.idMarca AND m.idEmpresa = @idEmpresa
      WHERE CONVERT(DATE, v.fEmision) >= @desde
        AND ISNULL(m.estado, 1) = 1
      GROUP BY m.idMarca, m.nombre
      ORDER BY SUM(ISNULL(dv.cantidad, 0)) DESC
    `);
  return r.recordset || [];
}

async function productosMasVendidos(pool, idEmpresa, top = 8) {
  const desde = fechaDesdeVentas();
  const r = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('desde', sql.VarChar(10), desde)
    .input('top', sql.Int, Math.min(15, Math.max(1, top)))
    .query(`
      SELECT TOP (@top)
        LTRIM(RTRIM(p.descripcion)) AS descripcion,
        LTRIM(RTRIM(ISNULL(p.codigo, ''))) AS codigo,
        SUM(ISNULL(dv.cantidad, 0)) AS cantidadVendida
      FROM DetalleVenta dv
      INNER JOIN Ventas v ON dv.idVenta = v.idVenta AND v.idEmpresa = @idEmpresa
      INNER JOIN Productos p ON dv.idProducto = p.idProducto AND p.idEmpresa = @idEmpresa
      WHERE CONVERT(DATE, v.fEmision) >= @desde
        AND ISNULL(p.estado, 1) = 1
      GROUP BY p.idProducto, p.descripcion, p.codigo
      ORDER BY SUM(ISNULL(dv.cantidad, 0)) DESC
    `);
  return r.recordset || [];
}

async function categoriasActivasFallback(pool, idEmpresa, top = 12) {
  const r = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('top', sql.Int, top)
    .query(`
      SELECT TOP (@top) LTRIM(RTRIM(nombre)) AS nombre
      FROM Categorias
      WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1
      ORDER BY nombre
    `);
  return r.recordset || [];
}

async function marcasActivasFallback(pool, idEmpresa, top = 12) {
  const r = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('top', sql.Int, top)
    .query(`
      SELECT TOP (@top) LTRIM(RTRIM(nombre)) AS nombre
      FROM Marcas
      WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1
      ORDER BY nombre
    `);
  return r.recordset || [];
}

async function productosCatalogoFallback(pool, idEmpresa, top = 8) {
  const r = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('top', sql.Int, top)
    .query(`
      SELECT TOP (@top)
        LTRIM(RTRIM(descripcion)) AS descripcion,
        LTRIM(RTRIM(codigo)) AS codigo
      FROM WhatsAppBotCatalogoIndice
      WHERE idEmpresa = @idEmpresa
      ORDER BY descripcion
    `);
  if (r.recordset?.length) return r.recordset;
  const r2 = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .input('top', sql.Int, top)
    .query(`
      SELECT TOP (@top)
        LTRIM(RTRIM(descripcion)) AS descripcion,
        LTRIM(RTRIM(codigo)) AS codigo
      FROM Productos
      WHERE idEmpresa = @idEmpresa AND ISNULL(estado, 1) = 1
      ORDER BY descripcion
    `);
  return r2.recordset || [];
}

module.exports = {
  obtenerPerfilEmpresa,
  categoriasMasVendidas,
  marcasMasVendidas,
  productosMasVendidos,
  categoriasActivasFallback,
  marcasActivasFallback,
  productosCatalogoFallback,
  MESES_VENTAS
};
