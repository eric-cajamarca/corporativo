const sql = require('mssql');

exports.obtenerProductosTodosRepo = async (pool, empresa) => {
  console.log('empresa in repo:', empresa);
  const result = await pool
    .request()
    .input("idEmpresa", sql.UniqueIdentifier, empresa)
    .query(`
      SELECT 
          ss.idProducto,
          p.codigo,
          c.nombre as categoria,
          p.descripcion,
          m.nombre as marca,
          pr.codigo as codigoPresentacion,
          pr.descripcion as descripcionPres,
          ss.idSucursal,
          s.nombre as sucursal,
          p.cUnitario,
          ss.cantidad as stock,
          p.fProduccion,
          p.fVencimiento
      FROM StockSucursal ss
      INNER JOIN Productos p ON ss.idProducto = p.idProducto
      INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
      INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
      INNER JOIN Sucursal s ON ss.idSucursal = s.idSucursal
      INNER JOIN Marcas m ON p.idMarca = m.idMarca
      WHERE ss.idEmpresa = @idEmpresa;
    `);

  return result.recordset;
};
