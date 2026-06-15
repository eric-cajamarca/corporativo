const sql = require('mssql');
const { getFechaHoyApp } = require('../utils/fechaDisplay.util');

const MESES_VENTAS = 6;

function fechaDesdeVentas() {
  const hoy = getFechaHoyApp();
  const [y, m] = hoy.split('-').map(Number);
  let yN = y;
  let mN = m - MESES_VENTAS;
  while (mN < 1) {
    mN += 12;
    yN -= 1;
  }
  return `${yN}-${String(mN).padStart(2, '0')}-01`;
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

/**
 * Un producto representativo para ejemplos de busqueda en el chat.
 * Prioridad: mas vendido (6 meses) > indice WA con stock > indice WA > producto activo con stock.
 */
async function productoEjemploBusqueda(pool, idEmpresa) {
  const desde = fechaDesdeVentas();
  const topVendidos = await productosMasVendidos(pool, idEmpresa, 1);
  const vendido = String(topVendidos[0]?.descripcion || '').trim();
  if (vendido) return vendido;

  try {
    const conStock = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT TOP 1 LTRIM(RTRIM(descripcion)) AS descripcion
        FROM WhatsAppBotCatalogoIndice
        WHERE idEmpresa = @idEmpresa AND ISNULL(stockTotal, 0) > 0
        ORDER BY stockTotal DESC, descripcion
      `);
    const indiceStock = String(conStock.recordset[0]?.descripcion || '').trim();
    if (indiceStock) return indiceStock;

    const cualquieraIndice = await pool.request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT TOP 1 LTRIM(RTRIM(descripcion)) AS descripcion
        FROM WhatsAppBotCatalogoIndice
        WHERE idEmpresa = @idEmpresa
        ORDER BY descripcion
      `);
    const indice = String(cualquieraIndice.recordset[0]?.descripcion || '').trim();
    if (indice) return indice;
  } catch (e) {
    if (!(e && e.number === 208)) throw e;
  }

  const rProd = await pool.request()
    .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
    .query(`
      SELECT TOP 1 LTRIM(RTRIM(p.descripcion)) AS descripcion
      FROM Productos p
      LEFT JOIN (
        SELECT l.idProducto, SUM(CONVERT(DECIMAL(18,6), ISNULL(l.cantidadDisponible, 0))) AS stockTotal
        FROM Lotes l
        WHERE l.idEmpresa = @idEmpresa AND ISNULL(l.cantidadDisponible, 0) > 0
        GROUP BY l.idProducto
      ) st ON st.idProducto = p.idProducto
      WHERE p.idEmpresa = @idEmpresa AND ISNULL(p.estado, 1) = 1
      ORDER BY ISNULL(st.stockTotal, 0) DESC, p.descripcion
    `);
  return String(rProd.recordset[0]?.descripcion || '').trim();
}

async function productosCatalogoFallback(pool, idEmpresa, top = 8) {
  try {
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
  } catch (e) {
    if (!(e && e.number === 208)) throw e;
  }
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
  productoEjemploBusqueda,
  MESES_VENTAS
};
