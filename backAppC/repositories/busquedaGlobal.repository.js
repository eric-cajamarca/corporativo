const sql = require('mssql');
const { likePattern } = require('../utils/paginacion.util');

/**
 * Búsqueda global ligera: productos, clientes y ventas recientes por término.
 */
exports.buscarGlobalRepo = async (pool, idEmpresa, opts = {}) => {
  const term = String(opts.q || '').trim();
  const limit = Math.min(20, Math.max(1, Number(opts.limit) || 12));
  if (term.length < 2 || !idEmpresa) {
    return { productos: [], clientes: [], ventas: [] };
  }

  const pat = likePattern(term);
  if (!pat) {
    return { productos: [], clientes: [], ventas: [] };
  }

  const [productosRes, clientesRes, ventasRes] = await Promise.all([
    pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('pat', sql.NVarChar(200), pat)
      .input('limite', sql.Int, limit)
      .query(`
      SELECT TOP (@limite)
        p.idProducto,
        p.codigo,
        p.descripcion,
        ISNULL(st.stock, 0) AS stock
      FROM Productos p
      LEFT JOIN (
        SELECT idEmpresa, idProducto, SUM(cantidadDisponible) AS stock
        FROM Lotes
        WHERE idEmpresa = @idEmpresa
        GROUP BY idEmpresa, idProducto
      ) st ON st.idProducto = p.idProducto AND st.idEmpresa = p.idEmpresa
      WHERE p.idEmpresa = @idEmpresa
        AND (p.codigo LIKE @pat ESCAPE '\\' OR p.descripcion LIKE @pat ESCAPE '\\')
      ORDER BY p.descripcion
    `),
    pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('pat', sql.NVarChar(200), pat)
      .input('limite', sql.Int, limit)
      .query(`
        SELECT TOP (@limite)
          idCliente,
          ruc,
          rSocial
        FROM Clientes
        WHERE idEmpresa = @idEmpresa
          AND (ruc LIKE @pat ESCAPE '\\' OR rSocial LIKE @pat ESCAPE '\\')
        ORDER BY rSocial
      `),
    pool
      .request()
      .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
      .input('pat', sql.NVarChar(200), pat)
      .input('limite', sql.Int, limit)
      .query(`
        SELECT TOP (@limite)
          v.idVenta,
          v.compVenta,
          v.total,
          CONVERT(VARCHAR(19), v.fecha, 120) AS fecha
        FROM Ventas v
        WHERE v.idEmpresa = @idEmpresa
          AND v.compVenta LIKE @pat ESCAPE '\\'
        ORDER BY v.fecha DESC
      `)
  ]);

  return {
    productos: productosRes.recordset || [],
    clientes: clientesRes.recordset || [],
    ventas: ventasRes.recordset || []
  };
};
