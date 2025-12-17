const sql = require("mssql");

// exports.obtenerProductosTodosRepo = async (pool, empresa) => {
//   console.log('empresa in repo:', empresa);
//   const result = await pool
//     .request()
//     .input("idEmpresa", sql.UniqueIdentifier, empresa)
//     .query(`
//       SELECT
//           ss.idProducto,
//           p.codigo,
//           c.nombre as categoria,
//           p.descripcion,
//           m.nombre as marca,
//           pr.codigo as codigoPresentacion,
//           pr.descripcion as descripcionPres,
//           ss.idSucursal,
//           s.nombre as sucursal,
//           p.cUnitario,
//           pp.precio,
//           pp.idPrecio,
//           pp.idLista,
//           lp.nombre as nombreLista,  -- Nombre de la lista
//           lp.principal,              -- Si es lista principal
//           ss.cantidad as stock,
//           p.fProduccion,
//           p.fVencimiento
//       FROM StockSucursal ss
//       INNER JOIN Productos p ON ss.idProducto = p.idProducto
//       INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
//       INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
//       INNER JOIN Sucursal s ON ss.idSucursal = s.idSucursal
//       INNER JOIN Marcas m ON p.idMarca = m.idMarca
//       LEFT JOIN PreciosProducto pp ON p.idProducto = pp.idProducto
//       LEFT JOIN ListasPrecio lp ON pp.idLista = lp.idLista  -- Para info de la lista
//       WHERE ss.idEmpresa = @idEmpresa
//         AND (lp.activo = 1 OR lp.activo IS NULL);  -- Solo listas activas
//     `);

//   return result.recordset;
// };
exports.obtenerProductosTodosRepo = async (pool, idEmpresa) => {
  try {
    // Primero, obtener productos básicos
    const result = await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
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
        WHERE ss.idEmpresa = @idEmpresa
      `);

    // Obtener precios por separado
    const preciosResult = await pool
      .request()
      .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
      .query(`
        SELECT 
            pp.idProducto,
            pp.idLista,
            pp.precio,
            pp.idPrecio,
            lp.nombre as nombreLista,
            lp.principal,
            m.simbolo as simboloMoneda
        FROM PreciosProducto pp
        INNER JOIN ListasPrecio lp ON pp.idLista = lp.idLista
        INNER JOIN Moneda m ON lp.idMoneda = m.idMoneda
        INNER JOIN Productos p ON pp.idProducto = p.idProducto
        WHERE p.idEmpresa = @idEmpresa
        AND lp.activo = 1
      `);

    // Crear mapa de precios
    const preciosMap = {};
    preciosResult.recordset.forEach(precio => {
      if (!preciosMap[precio.idProducto]) {
        preciosMap[precio.idProducto] = {};
      }
      preciosMap[precio.idProducto][precio.idLista] = {
        precio: precio.precio,
        idPrecio: precio.idPrecio,
        nombreLista: precio.nombreLista,
        principal: precio.principal,
        simboloMoneda: precio.simboloMoneda
      };
    });

    // Combinar productos con precios
    const productos = result.recordset.map((producto) => ({
      idProducto: producto.idProducto,
      codigo: producto.codigo,
      categoria: producto.categoria,
      descripcion: producto.descripcion,
      marca: producto.marca,
      codigoPresentacion: producto.codigoPresentacion,
      descripcionPres: producto.descripcionPres,
      idSucursal: producto.idSucursal,
      sucursal: producto.sucursal,
      cUnitario: producto.cUnitario,
      stock: producto.stock,
      fProduccion: producto.fProduccion,
      fVencimiento: producto.fVencimiento,
      precios: preciosMap[producto.idProducto] || {}
    }));

    console.log('Productos obtenidos en repo:', productos.length);

    return productos;
  } catch (error) {
    throw new Error(`Repository Error: ${error.message}`);
  }
};
// exports.obtenerProductosTodosRepo = async (pool, idEmpresa) => {
//   try {
//     const result = await pool
//       .request()
//       .input("idEmpresa", sql.UniqueIdentifier, idEmpresa)
//       .query(`
//         SELECT 
//             ss.idProducto,
//             p.codigo,
//             c.nombre as categoria,
//             p.descripcion,
//             m.nombre as marca,
//             pr.codigo as codigoPresentacion,
//             pr.descripcion as descripcionPres,
//             ss.idSucursal,
//             s.nombre as sucursal,
//             p.cUnitario,
//             (
//                 SELECT 
//                     pp.idLista,
//                     pp.precio,
//                     pp.idPrecio,
//                     lp.nombre as nombreLista,
//                     lp.principal,
//                     m2.simbolo as simboloMoneda
//                 FROM PreciosProducto pp
//                 INNER JOIN ListasPrecio lp ON pp.idLista = lp.idLista
//                 INNER JOIN Moneda m2 ON lp.idMoneda = m2.idMoneda
//                 WHERE pp.idProducto = p.idProducto
//                 AND lp.activo = 1
//                 FOR JSON PATH
//             ) as preciosJson,
//             ss.cantidad as stock,
//             p.fProduccion,
//             p.fVencimiento
//         FROM StockSucursal ss
//         INNER JOIN Productos p ON ss.idProducto = p.idProducto
//         INNER JOIN Categorias c ON p.idCategoria = c.idCategoria
//         INNER JOIN Presentacion pr ON p.idPresentacion = pr.idPresentacion
//         INNER JOIN Sucursal s ON ss.idSucursal = s.idSucursal
//         INNER JOIN Marcas m ON p.idMarca = m.idMarca
//         WHERE ss.idEmpresa = @idEmpresa
//       `);

//     // Procesar resultados
//     const productos = result.recordset.map((producto) => ({
//       idProducto: producto.idProducto,
//       codigo: producto.codigo,
//       categoria: producto.categoria,
//       descripcion: producto.descripcion,
//       marca: producto.marca,
//       codigoPresentacion: producto.codigoPresentacion,
//       descripcionPres: producto.descripcionPres,
//       idSucursal: producto.idSucursal,
//       sucursal: producto.sucursal,
//       cUnitario: producto.cUnitario,
//       stock: producto.stock,
//       fProduccion: producto.fProduccion,
//       fVencimiento: producto.fVencimiento,
      
//       // Convertir JSON a objeto y crear mapa rápido
//       precios: producto.preciosJson
//         ? JSON.parse(producto.preciosJson).reduce((map, precio) => {
//             map[precio.idLista] = {
//               precio: precio.precio,
//               idPrecio: precio.idPrecio,
//               nombreLista: precio.nombreLista,
//               principal: precio.principal,
//               simboloMoneda: precio.simboloMoneda,
//             };
//             return map;
//           }, {})
//         : {},
//     }));

//     console.log('Productos obtenidos en repo:', productos.length);

//     return productos;
//   } catch (error) {
//     throw new Error(`Repository Error: ${error.message}`);
//   }
// };
